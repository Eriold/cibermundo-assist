from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

from pywinauto import Desktop
from pywinauto.findwindows import ElementNotFoundError
from pywinauto.keyboard import send_keys


DEFAULT_APP_PATH = (
    r"C:\Users\SERVIDOR\AppData\Roaming\Microsoft\Windows\Start Menu\Programs"
    r"\Interrapidisimo\Interrapidisimo POS"
)
DEFAULT_TITLE_RE = r".*(Interrapidisimo|POS).*"
DEFAULT_BUTTON_TITLE_RE = r"(?i).*(entrar|ingresar|login|aceptar).*"
ROOT_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
LOCAL_ENV_PATH = Path(__file__).resolve().parent / ".env"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="POC para abrir Interrapidisimo POS y completar el login con pywinauto."
    )
    parser.add_argument("--app-path", default=DEFAULT_APP_PATH, help="Ruta al .exe, .lnk o .appref-ms.")
    parser.add_argument(
        "--backend",
        default="auto",
        choices=["auto", "uia", "win32"],
        help="Backend de pywinauto. Usa auto para probar primero UIA y luego Win32.",
    )
    parser.add_argument(
        "--title-re",
        default=DEFAULT_TITLE_RE,
        help="Regex para detectar la ventana del POS.",
    )
    parser.add_argument(
        "--button-title-re",
        default=DEFAULT_BUTTON_TITLE_RE,
        help="Regex para detectar el boton de login.",
    )
    parser.add_argument("--username", help="Usuario a escribir.")
    parser.add_argument("--password", help="Password a escribir.")
    parser.add_argument(
        "--username-index",
        type=int,
        default=0,
        help="Indice del campo username dentro de los controles Edit detectados.",
    )
    parser.add_argument(
        "--password-index",
        type=int,
        default=1,
        help="Indice del campo password dentro de los controles Edit detectados.",
    )
    parser.add_argument(
        "--startup-timeout",
        type=float,
        default=30.0,
        help="Segundos maximos para esperar la ventana del POS.",
    )
    parser.add_argument(
        "--print-controls",
        action="store_true",
        help="Imprime la jerarquia de controles detectada.",
    )
    parser.add_argument(
        "--submit",
        action="store_true",
        help="Hace click en el boton Entrar o manda Enter despues de llenar la clave.",
    )
    return parser.parse_args()


def resolve_app_path(raw_path: str) -> Path:
    raw = Path(raw_path)
    candidates: List[Path] = []

    if raw.exists():
        return raw

    if raw.suffix:
        candidates.append(raw)
    else:
        candidates.extend(
            [
                raw,
                raw.with_suffix(".exe"),
                raw.with_suffix(".lnk"),
                raw.with_suffix(".appref-ms"),
            ]
        )

    for candidate in candidates:
        if candidate.exists():
            return candidate

    candidate_list = "\n".join(f"- {str(candidate)}" for candidate in candidates)
    raise FileNotFoundError(
        "No se encontro la ruta del POS. Se intentaron estas variantes:\n"
        f"{candidate_list}\n"
        "Valida la ruta real en el otro PC."
    )


def launch_app(app_path: Path) -> None:
    os.startfile(str(app_path))


def parse_simple_env_file(env_path: Path) -> Dict[str, str]:
    values: Dict[str, str] = {}

    if not env_path.exists():
        return values

    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")

        if key:
            values[key] = value

    return values


def load_env_values() -> Dict[str, str]:
    values: Dict[str, str] = {}

    for env_path in (ROOT_ENV_PATH, LOCAL_ENV_PATH):
        values.update(parse_simple_env_file(env_path))

    return values


def resolve_credentials(args: argparse.Namespace) -> Tuple[str | None, str | None, List[str]]:
    env_values = load_env_values()
    sources: List[str] = []

    username = args.username or os.environ.get("APX_USER") or env_values.get("APX_USER")
    password = args.password or os.environ.get("APX_PASS") or env_values.get("APX_PASS")

    if args.username:
        sources.append("username desde --username")
    elif os.environ.get("APX_USER"):
        sources.append("username desde variable de entorno APX_USER")
    elif env_values.get("APX_USER"):
        sources.append(f"username desde {ROOT_ENV_PATH if ROOT_ENV_PATH.exists() else LOCAL_ENV_PATH}")

    if args.password:
        sources.append("password desde --password")
    elif os.environ.get("APX_PASS"):
        sources.append("password desde variable de entorno APX_PASS")
    elif env_values.get("APX_PASS"):
        sources.append(f"password desde {ROOT_ENV_PATH if ROOT_ENV_PATH.exists() else LOCAL_ENV_PATH}")

    return username, password, sources


def backend_candidates(selected_backend: str) -> Sequence[str]:
    if selected_backend == "auto":
        return ("uia", "win32")
    return (selected_backend,)


def connect_window(title_re: str, selected_backend: str, timeout: float):
    deadline = time.time() + timeout
    last_error: Exception | None = None

    while time.time() < deadline:
        for backend in backend_candidates(selected_backend):
            try:
                desktop = Desktop(backend=backend)
                window = desktop.window(title_re=title_re, found_index=0)
                if window.exists(timeout=0.5):
                    wrapper = window.wrapper_object()
                    wrapper.set_focus()
                    return backend, wrapper
            except Exception as exc:  # pragma: no cover - runtime only
                last_error = exc
        time.sleep(0.5)

    raise TimeoutError(
        f"No se encontro una ventana que matchee {title_re!r} en {timeout} segundos. "
        f"Ultimo error: {last_error}"
    )


def control_rect_key(control) -> Tuple[int, int]:
    rect = control.rectangle()
    return (rect.top, rect.left)


def dedupe_controls(controls: Iterable) -> List:
    result: List = []
    seen: set[Tuple[int, int, int, int]] = set()

    for control in controls:
        rect = control.rectangle()
        key = (rect.left, rect.top, rect.right, rect.bottom)
        if key in seen:
            continue
        seen.add(key)
        result.append(control)

    return result


def find_edit_controls(window, backend: str) -> List:
    controls = []

    try:
        controls.extend(window.descendants(control_type="Edit"))
    except Exception:
        pass

    try:
        controls.extend(window.descendants(class_name="Edit"))
    except Exception:
        pass

    controls = dedupe_controls(controls)
    controls.sort(key=control_rect_key)

    if not controls:
        raise RuntimeError(
            f"No se detectaron controles Edit con backend={backend}. "
            "Corre otra vez con --print-controls para revisar identificadores."
        )

    return controls


def set_text(control, value: str) -> None:
    control.set_focus()

    try:
        control.set_edit_text("")
    except Exception:
        try:
            control.type_keys("^a{BACKSPACE}", set_foreground=True)
        except Exception:
            send_keys("^a{BACKSPACE}")

    try:
        control.set_edit_text(value)
        return
    except Exception:
        pass

    control.type_keys(value, with_spaces=True, set_foreground=True)


def find_login_button(window, button_title_re: str):
    try:
        return window.child_window(title_re=button_title_re, control_type="Button").wrapper_object()
    except Exception:
        pass

    try:
        return window.child_window(title_re=button_title_re, class_name="Button").wrapper_object()
    except Exception:
        pass

    buttons = []

    try:
        buttons.extend(window.descendants(control_type="Button"))
    except Exception:
        pass

    try:
        buttons.extend(window.descendants(class_name="Button"))
    except Exception:
        pass

    buttons = dedupe_controls(buttons)
    buttons.sort(key=control_rect_key)

    if buttons:
        return buttons[-1]

    return None


def main() -> int:
    args = parse_args()
    username, password, credential_sources = resolve_credentials(args)

    try:
        app_path = resolve_app_path(args.app_path)
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        return 1

    print(f"[INFO] Ruta resuelta: {app_path}")
    print("[INFO] Abriendo aplicacion...")
    launch_app(app_path)

    try:
        backend, window = connect_window(args.title_re, args.backend, args.startup_timeout)
    except TimeoutError as exc:
        print(f"[ERROR] {exc}")
        return 1

    print(f"[INFO] Ventana detectada con backend={backend}")
    print(f"[INFO] Titulo ventana: {window.window_text()!r}")

    if args.print_controls:
        print("\n[DEBUG] print_control_identifiers():\n")
        try:
            window.print_control_identifiers()
        except Exception as exc:
            print(f"[WARN] No se pudieron imprimir identificadores: {exc}")
        print()

    if credential_sources:
        print(f"[INFO] Credenciales resueltas: {', '.join(credential_sources)}")

    if not username and not password:
        print("[INFO] No se recibieron credenciales. POC termina despues de abrir la app.")
        return 0

    try:
        edits = find_edit_controls(window, backend)
    except RuntimeError as exc:
        print(f"[ERROR] {exc}")
        return 1

    max_index = max(args.username_index, args.password_index)
    if max_index >= len(edits):
        print(
            "[ERROR] No hay suficientes controles Edit detectados. "
            f"Se encontraron {len(edits)} y pediste indices "
            f"{args.username_index} y {args.password_index}."
        )
        return 1

    username_edit = edits[args.username_index]
    password_edit = edits[args.password_index]

    if username:
        print(f"[INFO] Escribiendo usuario en Edit[{args.username_index}]...")
        set_text(username_edit, username)

    if password:
        print(f"[INFO] Escribiendo password en Edit[{args.password_index}]...")
        set_text(password_edit, password)

    if args.submit:
        print("[INFO] Intentando enviar login...")
        button = find_login_button(window, args.button_title_re)
        if button is not None:
            try:
                button.click_input()
                print("[INFO] Click en boton de login ejecutado.")
            except Exception as exc:
                print(f"[WARN] No se pudo hacer click en el boton: {exc}")
                password_edit.set_focus()
                password_edit.type_keys("{ENTER}", set_foreground=True)
                print("[INFO] Se envio Enter como fallback.")
        else:
            password_edit.set_focus()
            password_edit.type_keys("{ENTER}", set_foreground=True)
            print("[INFO] No se detecto boton claro. Se envio Enter como fallback.")
    else:
        print("[INFO] Credenciales cargadas. No se envio login porque no se paso --submit.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
