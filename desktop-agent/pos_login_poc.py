from __future__ import annotations

import argparse
import ctypes
import os
import re
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

from pywinauto import Desktop
from pywinauto.keyboard import send_keys


DEFAULT_APP_PATH = (
    r"C:\Users\SERVIDOR\AppData\Roaming\Microsoft\Windows\Start Menu\Programs"
    r"\Interrapidisimo\Interrapidisimo POS"
)
DEFAULT_TITLE_RE = r".*(Interrapidisimo|POS).*"
DEFAULT_RAW_TITLE_RE = r".*POS INTERRAPIDISIMO.*"
DEFAULT_BUTTON_TITLE_RE = r"(?i).*(entrar|ingresar|login|aceptar).*"
ROOT_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
LOCAL_ENV_PATH = Path(__file__).resolve().parent / ".env"
LAUNCHABLE_SUFFIXES = (".appref-ms", ".lnk", ".exe")
PREFERRED_APP_NAMES = (
    "admisiones pos",
    "interrapidisimo pos",
    "pos",
)
EXPLORER_CLASS_NAMES = {"CabinetWClass", "ExploreWClass"}
LOGIN_HINT_TEXTS = ("usuario", "password", "contraseña", "entrar")
user32 = ctypes.windll.user32
USERNAME_AUTO_IDS = ("LoginPos_txtUsername",)
PASSWORD_AUTO_IDS = ("LoginPos_txtPassword",)
LOGIN_BUTTON_AUTO_IDS = ("LoginPos_btnLogin",)
APP_PATH_ENV_KEYS = ("POS_EXE_PATH",)
USERNAME_ENV_KEYS = ("POS_USER", "APX_USER")
PASSWORD_ENV_KEYS = ("POS_PASS", "APX_PASS")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="POC para abrir Interrapidisimo POS y completar el login con pywinauto."
    )
    parser.add_argument(
        "--app-path",
        help=(
            "Ruta al .exe, .lnk o .appref-ms. "
            "Si se omite, intenta POS_EXE_PATH y luego la ruta por defecto."
        ),
    )
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
        "--raw-title-re",
        default=DEFAULT_RAW_TITLE_RE,
        help="Regex para detectar la ventana real del POS desde Win32 puro.",
    )
    parser.add_argument(
        "--hwnd",
        type=int,
        help="Handle HWND de la ventana objetivo. Si se pasa, tiene prioridad sobre title-re.",
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
        "--startup-delay",
        type=float,
        default=3.0,
        help="Segundos de espera inicial para que la app termine de abrir antes de buscar ventanas.",
    )
    parser.add_argument(
        "--print-controls",
        action="store_true",
        help="Imprime la jerarquia de controles detectada.",
    )
    parser.add_argument(
        "--debug-top-windows",
        action="store_true",
        help="Imprime las ventanas top-level candidatas antes de escoger una.",
    )
    parser.add_argument(
        "--list-top-windows",
        action="store_true",
        help="Lista todas las ventanas top-level visibles y termina sin escribir nada.",
    )
    parser.add_argument(
        "--list-raw-windows",
        action="store_true",
        help="Lista ventanas top-level con Win32 puro y termina sin escribir nada.",
    )
    parser.add_argument(
        "--inspect-only",
        action="store_true",
        help="Detecta la ventana objetivo e imprime informacion, pero no escribe credenciales.",
    )
    parser.add_argument(
        "--submit",
        action="store_true",
        help="Hace click en el boton Entrar o manda Enter despues de llenar la clave.",
    )
    parser.add_argument(
        "--post-submit-delay",
        type=float,
        default=8.0,
        help="Segundos para observar el estado del POS despues de enviar el login.",
    )
    return parser.parse_args()


def resolve_app_path(raw_path: str) -> Path:
    raw = Path(raw_path)
    candidates: List[Path] = []

    if raw.exists():
        if raw.is_dir():
            return resolve_app_from_directory(raw)
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


def launchable_score(path: Path) -> Tuple[int, int, str]:
    stem = path.stem.lower()
    suffix = path.suffix.lower()

    preferred_name_score = 99
    for index, preferred_name in enumerate(PREFERRED_APP_NAMES):
        if preferred_name in stem:
            preferred_name_score = index
            break

    suffix_score_map = {
        ".appref-ms": 0,
        ".lnk": 1,
        ".exe": 2,
    }
    suffix_score = suffix_score_map.get(suffix, 99)

    return (preferred_name_score, suffix_score, stem)


def resolve_app_from_directory(directory: Path) -> Path:
    launchable_files = [
        item
        for item in directory.iterdir()
        if item.is_file() and item.suffix.lower() in LAUNCHABLE_SUFFIXES
    ]

    if not launchable_files:
        raise FileNotFoundError(
            "La ruta del POS apunta a una carpeta, pero no se encontraron archivos lanzables dentro de ella. "
            "Se esperaban extensiones .appref-ms, .lnk o .exe."
        )

    launchable_files.sort(key=launchable_score)
    return launchable_files[0]


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


def resolve_from_sources(
    cli_value: str | None,
    cli_label: str,
    env_keys: Sequence[str],
    env_values: Dict[str, str],
) -> Tuple[str | None, str | None]:
    if cli_value:
        return cli_value, cli_label

    for env_key in env_keys:
        env_value = os.environ.get(env_key)
        if env_value:
            return env_value, f"variable de entorno {env_key}"

    for env_key in env_keys:
        env_value = env_values.get(env_key)
        if env_value:
            return env_value, f"{env_key} desde .env raiz o desktop-agent/.env"

    return None, None


def resolve_credentials(args: argparse.Namespace) -> Tuple[str | None, str | None, List[str]]:
    env_values = load_env_values()
    sources: List[str] = []

    username, username_source = resolve_from_sources(
        args.username,
        "--username",
        USERNAME_ENV_KEYS,
        env_values,
    )
    password, password_source = resolve_from_sources(
        args.password,
        "--password",
        PASSWORD_ENV_KEYS,
        env_values,
    )

    if username_source:
        sources.append(f"username desde {username_source}")

    if password_source:
        sources.append(f"password desde {password_source}")

    return username, password, sources


def resolve_app_path_input(args: argparse.Namespace) -> Tuple[str, str]:
    env_values = load_env_values()
    app_path, app_path_source = resolve_from_sources(
        args.app_path,
        "--app-path",
        APP_PATH_ENV_KEYS,
        env_values,
    )

    if app_path:
        return app_path, app_path_source or "--app-path"

    return DEFAULT_APP_PATH, "ruta por defecto embebida en el script"


def backend_candidates(selected_backend: str) -> Sequence[str]:
    if selected_backend == "auto":
        return ("uia", "win32")
    return (selected_backend,)


def score_candidate_window(window) -> Tuple[int, int, int, str]:
    class_penalty = 1 if get_window_class_name(window) in EXPLORER_CLASS_NAMES else 0
    visible_edits = count_visible_edits(window)
    login_hints = count_login_hints(window)
    return (class_penalty, -visible_edits, -login_hints, window.window_text().lower())


def list_matching_windows(title_re: str, selected_backend: str):
    candidates = []

    for backend in backend_candidates(selected_backend):
        try:
            desktop = Desktop(backend=backend)
            for spec in desktop.windows():
                try:
                    wrapper = spec.wrapper_object()
                    title = wrapper.window_text() or ""
                    if not title:
                        continue
                    if not re.match(title_re, title):
                        continue
                    if not is_control_visible(wrapper):
                        continue
                    candidates.append((backend, wrapper))
                except Exception:
                    continue
        except Exception:
            continue

    return candidates


def connect_window(title_re: str, selected_backend: str, timeout: float, debug_top_windows: bool = False):
    deadline = time.time() + timeout

    while time.time() < deadline:
        candidates = list_matching_windows(title_re, selected_backend)
        if candidates:
            candidates.sort(key=lambda item: score_candidate_window(item[1]))

            if debug_top_windows:
                print("[DEBUG] Ventanas top-level candidatas:")
                for index, (backend, window) in enumerate(candidates):
                    print(describe_top_window(window, backend, index))
                print()

            backend, selected_window = candidates[0]
            try:
                selected_window.set_focus()
            except Exception:
                pass
            return backend, selected_window

        time.sleep(0.5)

    raise TimeoutError(
        f"No se encontro una ventana candidata que matchee {title_re!r} en {timeout} segundos."
    )


def connect_window_by_handle(hwnd: int, selected_backend: str):
    last_error: str | None = None

    for backend in backend_candidates(selected_backend):
        try:
            desktop = Desktop(backend=backend)
            window = desktop.window(handle=hwnd).wrapper_object()
            try:
                window.set_focus()
            except Exception:
                pass
            return backend, window
        except Exception as exc:
            last_error = str(exc)

    raise RuntimeError(
        f"No se pudo conectar a la ventana hwnd={hwnd} con backend={selected_backend}. "
        f"Ultimo error: {last_error}"
    )


def find_raw_window_handle(title_re: str) -> int | None:
    pattern = re.compile(title_re)
    candidates = []

    for hwnd, title, class_name, is_visible in list_raw_windows():
        if not is_visible:
            continue
        if not title:
            continue
        if class_name in EXPLORER_CLASS_NAMES:
            continue
        if not pattern.match(title):
            continue
        candidates.append((hwnd, title, class_name))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (0 if "pos interrapidisimo" in item[1].lower() else 1, item[1].lower()))
    return candidates[0][0]


def connect_window_by_raw_title(raw_title_re: str, selected_backend: str, timeout: float):
    deadline = time.time() + timeout

    while time.time() < deadline:
        hwnd = find_raw_window_handle(raw_title_re)
        if hwnd is not None:
            return connect_window_by_handle(hwnd, selected_backend)
        time.sleep(0.5)

    raise RuntimeError(
        f"No se encontro una ventana Win32 visible que matchee {raw_title_re!r} en {timeout} segundos."
    )


def control_rect_key(control) -> Tuple[int, int]:
    rect = control.rectangle()
    return (rect.top, rect.left)


def is_control_visible(control) -> bool:
    try:
        if not control.is_visible():
            return False
    except Exception:
        return False

    try:
        rect = control.rectangle()
        return rect.width() > 0 and rect.height() > 0
    except Exception:
        return False


def is_control_enabled(control) -> bool:
    try:
        return bool(control.is_enabled())
    except Exception:
        return False


def get_control_text(control) -> str:
    try:
        text = control.window_text()
        return text if text is not None else ""
    except Exception:
        return ""


def get_control_class_name(control) -> str:
    try:
        value = control.friendly_class_name()
        if value:
            return value
    except Exception:
        pass

    try:
        value = control.element_info.class_name
        return value or ""
    except Exception:
        return ""


def get_control_type_name(control) -> str:
    try:
        value = control.element_info.control_type
        return value or ""
    except Exception:
        return ""


def get_control_auto_id(control) -> str:
    try:
        value = control.element_info.automation_id
        return value or ""
    except Exception:
        return ""


def get_window_class_name(control) -> str:
    try:
        value = control.element_info.class_name
        return value or ""
    except Exception:
        return ""


def describe_control(control, index: int | None = None) -> str:
    rect = control.rectangle()
    prefix = f"[{index}] " if index is not None else ""
    return (
        f"{prefix}"
        f"type={get_control_type_name(control) or '-'} "
        f"class={get_control_class_name(control) or '-'} "
        f"auto_id={get_control_auto_id(control) or '-'} "
        f"text={get_control_text(control)!r} "
        f"visible={is_control_visible(control)} "
        f"enabled={is_control_enabled(control)} "
        f"rect=({rect.left},{rect.top},{rect.right},{rect.bottom})"
    )


def print_control_debug(window) -> None:
    try:
        controls = dedupe_controls(window.descendants())
    except Exception as exc:
        print(f"[WARN] No se pudieron listar descendientes: {exc}")
        return

    controls.sort(key=control_rect_key)

    print("[DEBUG] Controles detectados:\n")
    for index, control in enumerate(controls):
        print(describe_control(control, index))
    print()


def count_visible_edits(control) -> int:
    controls = []

    try:
        controls.extend(control.descendants(control_type="Edit"))
    except Exception:
        pass

    try:
        controls.extend(control.descendants(class_name="Edit"))
    except Exception:
        pass

    controls = dedupe_controls(controls)
    return sum(1 for item in controls if is_control_visible(item) and is_control_enabled(item))


def count_login_hints(control) -> int:
    score = 0
    candidates = [control]

    try:
        candidates.extend(dedupe_controls(control.descendants()))
    except Exception:
        pass

    for item in candidates:
        fragments = [
            get_control_text(item).strip().lower(),
            get_control_auto_id(item).strip().lower(),
            get_control_class_name(item).strip().lower(),
        ]
        for fragment in fragments:
            if not fragment:
                continue
            for hint in LOGIN_HINT_TEXTS:
                if hint in fragment:
                    score += 1

    return score


def describe_top_window(window, backend: str, index: int | None = None) -> str:
    rect = window.rectangle()
    prefix = f"[{index}] " if index is not None else ""
    process_id = "-"
    try:
        process_id = str(window.process_id())
    except Exception:
        pass
    return (
        f"{prefix}"
        f"backend={backend} "
        f"title={window.window_text()!r} "
        f"class={get_window_class_name(window) or '-'} "
        f"pid={process_id} "
        f"visible={is_control_visible(window)} "
        f"enabled={is_control_enabled(window)} "
        f"visible_edits={count_visible_edits(window)} "
        f"login_hints={count_login_hints(window)} "
        f"rect=({rect.left},{rect.top},{rect.right},{rect.bottom})"
    )


def get_window_text_raw(hwnd: int) -> str:
    length = user32.GetWindowTextLengthW(hwnd)
    buffer = ctypes.create_unicode_buffer(length + 1)
    user32.GetWindowTextW(hwnd, buffer, length + 1)
    return buffer.value


def get_class_name_raw(hwnd: int) -> str:
    buffer = ctypes.create_unicode_buffer(256)
    user32.GetClassNameW(hwnd, buffer, 256)
    return buffer.value


def list_raw_windows() -> List[Tuple[int, str, str, bool]]:
    windows: List[Tuple[int, str, str, bool]] = []
    callback_type = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_void_p, ctypes.c_void_p)

    def callback(hwnd, _lparam):
        title = get_window_text_raw(hwnd)
        class_name = get_class_name_raw(hwnd)
        is_visible = bool(user32.IsWindowVisible(hwnd))
        windows.append((int(hwnd), title, class_name, is_visible))
        return True

    user32.EnumWindows(callback_type(callback), 0)
    return windows


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

    actionable_controls = [
        control
        for control in controls
        if is_control_visible(control) and is_control_enabled(control)
    ]

    if actionable_controls:
        controls = actionable_controls

    if not controls:
        raise RuntimeError(
            f"No se detectaron controles Edit con backend={backend}. "
            "Corre otra vez con --print-controls para revisar identificadores."
        )

    return controls


def find_control_by_auto_ids(window, auto_ids: Sequence[str], control_type: str):
    for auto_id in auto_ids:
        try:
            control = window.child_window(auto_id=auto_id, control_type=control_type).wrapper_object()
            if is_control_visible(control) and is_control_enabled(control):
                return control
        except Exception:
            continue
    return None


def set_text(control, value: str) -> None:
    try:
        control.click_input()
    except Exception:
        pass

    try:
        control.set_focus()
    except Exception:
        pass

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
    control = find_control_by_auto_ids(window, LOGIN_BUTTON_AUTO_IDS, "Button")
    if control is not None:
        return control

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


def get_window_handle(control) -> int | None:
    try:
        handle = int(control.handle)
        return handle if handle > 0 else None
    except Exception:
        return None


def focus_control(control) -> None:
    try:
        control.set_focus()
    except Exception:
        pass


def try_login_button_actions(button) -> str | None:
    actions = [
        ("invoke", lambda: button.invoke()),
        ("click_input", lambda: button.click_input()),
        ("click", lambda: button.click()),
        ("space", lambda: button.type_keys("{SPACE}", set_foreground=True)),
        ("enter_on_button", lambda: button.type_keys("{ENTER}", set_foreground=True)),
    ]

    for action_name, action in actions:
        try:
            focus_control(button)
            action()
            return action_name
        except Exception as exc:
            print(f"[WARN] Fallo accion {action_name} sobre boton login: {exc}")

    return None


def try_enter_fallback(password_edit) -> str | None:
    actions = [
        ("enter_on_password", lambda: password_edit.type_keys("{ENTER}", set_foreground=True)),
        ("global_enter", lambda: send_keys("{ENTER}")),
    ]

    for action_name, action in actions:
        try:
            focus_control(password_edit)
            action()
            return action_name
        except Exception as exc:
            print(f"[WARN] Fallo fallback {action_name}: {exc}")

    return None


def print_post_submit_snapshot(title_re: str, selected_backend: str) -> None:
    candidates = list_matching_windows(title_re, selected_backend)
    candidates.sort(key=lambda item: score_candidate_window(item[1]))

    if not candidates:
        print("[INFO] No se encontraron ventanas top-level visibles que coincidan despues del submit.")
        return

    print("[INFO] Ventanas visibles despues del submit:")
    for index, (backend, window) in enumerate(candidates[:5]):
        print(f"[INFO] {describe_top_window(window, backend, index)}")


def observe_after_submit(window, title_re: str, selected_backend: str, delay_seconds: float) -> None:
    if delay_seconds > 0:
        print(f"[INFO] Observando el POS durante {delay_seconds:.1f}s despues del submit...")
        time.sleep(delay_seconds)

    hwnd = get_window_handle(window)
    if hwnd is not None and bool(user32.IsWindow(hwnd)):
        print("[INFO] La ventana original del login sigue existiendo despues del submit.")
        print(f"[INFO] Estado actual: {describe_top_window(window, selected_backend)}")
    else:
        print("[INFO] La ventana original del login ya no existe despues del submit.")

    print_post_submit_snapshot(title_re, selected_backend)


def main() -> int:
    args = parse_args()
    username, password, credential_sources = resolve_credentials(args)
    app_path_input, app_path_source = resolve_app_path_input(args)

    try:
        app_path = resolve_app_path(app_path_input)
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        return 1

    print(f"[INFO] Fuente de ruta POS: {app_path_source}")
    print(f"[INFO] Ruta resuelta: {app_path}")
    print("[INFO] Abriendo aplicacion...")
    launch_app(app_path)
    if args.startup_delay > 0:
        print(f"[INFO] Esperando {args.startup_delay:.1f}s para el arranque inicial...")
        time.sleep(args.startup_delay)

    if args.list_raw_windows:
        print("[DEBUG] Ventanas top-level Win32:")
        for index, (hwnd, title, class_name, is_visible) in enumerate(list_raw_windows()):
            if not title and not is_visible:
                continue
            print(
                f"[{index}] hwnd={hwnd} title={title!r} class={class_name or '-'} visible={is_visible}"
            )
        return 0

    if args.list_top_windows:
        all_windows = list_matching_windows(r".*", args.backend)
        all_windows.sort(key=lambda item: score_candidate_window(item[1]))
        print("[DEBUG] Ventanas top-level visibles:")
        for index, (backend, window) in enumerate(all_windows):
            print(describe_top_window(window, backend, index))
        return 0

    try:
        if args.hwnd:
            backend, window = connect_window_by_handle(args.hwnd, args.backend)
        elif args.raw_title_re:
            backend, window = connect_window_by_raw_title(
                args.raw_title_re,
                args.backend,
                args.startup_timeout,
            )
        else:
            backend, window = connect_window(
                args.title_re,
                args.backend,
                args.startup_timeout,
                debug_top_windows=args.debug_top_windows,
            )
    except (TimeoutError, RuntimeError) as exc:
        print(f"[ERROR] {exc}")
        return 1

    print(f"[INFO] Ventana detectada con backend={backend}")
    print(f"[INFO] Titulo ventana: {window.window_text()!r}")
    print(f"[INFO] Clase ventana: {get_window_class_name(window) or '-'}")

    if args.print_controls:
        print()
        print_control_debug(window)

    if args.inspect_only:
        print("[INFO] Modo inspect-only activo. No se escribiran credenciales.")
        return 0

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

    print(f"[INFO] Edit detectados utilizables: {len(edits)}")
    for index, control in enumerate(edits):
        print(f"[INFO] {describe_control(control, index)}")

    max_index = max(args.username_index, args.password_index)
    if max_index >= len(edits):
        print(
            "[ERROR] No hay suficientes controles Edit detectados. "
            f"Se encontraron {len(edits)} y pediste indices "
            f"{args.username_index} y {args.password_index}."
        )
        return 1

    username_edit = find_control_by_auto_ids(window, USERNAME_AUTO_IDS, "Edit") or edits[args.username_index]
    password_edit = find_control_by_auto_ids(window, PASSWORD_AUTO_IDS, "Edit") or edits[args.password_index]

    print(f"[INFO] Username target: {describe_control(username_edit)}")
    print(f"[INFO] Password target: {describe_control(password_edit)}")

    if username:
        print(f"[INFO] Escribiendo usuario en Edit[{args.username_index}]...")
        set_text(username_edit, username)

    if password:
        print(f"[INFO] Escribiendo password en Edit[{args.password_index}]...")
        set_text(password_edit, password)

    if args.submit:
        print("[INFO] Intentando enviar login...")
        button = find_login_button(window, args.button_title_re)
        submit_strategy = None

        if button is not None:
            print(f"[INFO] Boton login detectado: {describe_control(button)}")
            submit_strategy = try_login_button_actions(button)
            if submit_strategy is not None:
                print(f"[INFO] Login enviado usando estrategia: {submit_strategy}")
            else:
                print("[WARN] Ninguna accion directa sobre el boton funciono. Se intentara Enter fallback.")
        else:
            print("[WARN] No se detecto boton claro de login.")

        if submit_strategy is None:
            submit_strategy = try_enter_fallback(password_edit)
            if submit_strategy is not None:
                print(f"[INFO] Login enviado usando fallback: {submit_strategy}")
            else:
                print("[ERROR] No se pudo disparar el login ni con boton ni con Enter.")
                return 1

        observe_after_submit(window, args.title_re, backend, args.post_submit_delay)
    else:
        print("[INFO] Credenciales cargadas. No se envio login porque no se paso --submit.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
