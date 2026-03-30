from __future__ import annotations

import argparse
import ctypes
import os
import re
import sys
import time
import unicodedata
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
DEFAULT_MAIN_WINDOW_TITLE_RE = r".*POS INTERRAPIDISIMO.*"
DEFAULT_MAIN_PROCESS_NAME = "PosWPF.Cliente.exe"
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
kernel32 = ctypes.windll.kernel32
USERNAME_AUTO_IDS = ("LoginPos_txtUsername",)
PASSWORD_AUTO_IDS = ("LoginPos_txtPassword",)
LOGIN_BUTTON_AUTO_IDS = ("LoginPos_btnLogin",)
LOGIN_ACTION_HINTS = ("entrar", "ingresar", "login", "aceptar")
EXIT_HINTS = ("salir",)
MAIN_WINDOW_HINTS = (
    "facturar",
    "cajas",
    "giros",
    "admision de envios",
    "captura manual",
    "reimpresion guias",
    "mis pagos",
    "reclame oficina",
)
REPRINT_HINTS = ("reimpresion guias",)
REPRINT_WINDOW_HINTS = ("reimpresion guia",)
REPRINT_NUMBER_HINTS = ("numero",)
REPRINT_SEARCH_HINTS = ("buscar",)
REPRINT_FORMAT_MODAL_HINTS = ("seleccione el formato a reimprimir", "prueba de entrega")
REPRINT_ACCEPT_HINTS = ("aceptar",)
DEFAULT_REPRINT_TRACKING_NUMBER = "240048399888"
DEFAULT_REPRINT_FORMAT = "TIRILLA"
APP_PATH_ENV_KEYS = ("POS_EXE_PATH",)
USERNAME_ENV_KEYS = ("POS_USER", "APX_USER")
PASSWORD_ENV_KEYS = ("POS_PASS", "APX_PASS")
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
STILL_ACTIVE = 259


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
        "--main-title-re",
        default=DEFAULT_MAIN_WINDOW_TITLE_RE,
        help="Regex para detectar la ventana principal autenticada del POS.",
    )
    parser.add_argument(
        "--main-process-name",
        default=DEFAULT_MAIN_PROCESS_NAME,
        help="Nombre del ejecutable asociado a la ventana principal autenticada.",
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
    parser.add_argument(
        "--ensure-main-window",
        action="store_true",
        help="Si la ventana principal ya esta abierta, la usa; si no, intenta login y espera a que aparezca.",
    )
    parser.add_argument(
        "--main-window-timeout",
        type=float,
        default=1200.0,
        help="Segundos maximos para esperar la ventana principal despues del login.",
    )
    parser.add_argument(
        "--open-reprint",
        action="store_true",
        help="Una vez detectada la ventana principal, entra a Reimpresion de Guias.",
    )
    parser.add_argument(
        "--reprint-tracking-number",
        default=DEFAULT_REPRINT_TRACKING_NUMBER,
        help="Numero de guia para la prueba de Reimpresion de Guias.",
    )
    parser.add_argument(
        "--reprint-format",
        default=DEFAULT_REPRINT_FORMAT,
        help="Formato a seleccionar en el modal de reimpresion.",
    )
    parser.add_argument(
        "--reprint-window-timeout",
        type=float,
        default=60.0,
        help="Segundos maximos para esperar la ventana Reimpresion Guia.",
    )
    parser.add_argument(
        "--reprint-modal-timeout",
        type=float,
        default=60.0,
        help="Segundos maximos para esperar el modal SeleccionarReImpresionCW.",
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


def normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    without_accents = "".join(char for char in normalized if not unicodedata.combining(char))
    collapsed = " ".join(without_accents.casefold().split())
    return collapsed


def contains_normalized_hint(fragment: str, hints: Sequence[str]) -> bool:
    normalized_fragment = normalize_text(fragment)
    if not normalized_fragment:
        return False

    for hint in hints:
        normalized_hint = normalize_text(hint)
        if normalized_hint and normalized_hint in normalized_fragment:
            return True

    return False


def backend_candidates(selected_backend: str) -> Sequence[str]:
    if selected_backend == "auto":
        return ("uia", "win32")
    return (selected_backend,)


def score_candidate_window(window) -> Tuple[int, int, int, str]:
    class_penalty = 1 if get_window_class_name(window) in EXPLORER_CLASS_NAMES else 0
    visible_edits = count_visible_edits(window)
    login_hints = count_login_hints(window)
    return (class_penalty, -visible_edits, -login_hints, window.window_text().lower())


def process_name_matches(process_id: int | None, expected_process_name: str | None) -> bool:
    if not expected_process_name:
        return False

    image_name = get_process_image_name(process_id)
    if not image_name:
        return False

    return normalize_text(image_name) == normalize_text(expected_process_name)


def is_authenticated_main_window(window, expected_process_name: str | None = None) -> bool:
    process_id = get_process_id(window)
    process_match = process_name_matches(process_id, expected_process_name)
    return (process_match or count_main_window_hints(window) > 0) and count_visible_edits(window) == 0


def is_login_window(window) -> bool:
    return count_visible_edits(window) >= 2 or count_login_hints(window) > 0


def score_main_window(window) -> Tuple[int, int, int, str]:
    class_penalty = 1 if get_window_class_name(window) in EXPLORER_CLASS_NAMES else 0
    main_hints = count_main_window_hints(window)
    visible_edits = count_visible_edits(window)
    return (class_penalty, -main_hints, visible_edits, window.window_text().lower())


def find_main_window(title_re: str, selected_backend: str, expected_process_name: str | None = None):
    raw_hwnd = find_raw_window_handle(title_re)
    if raw_hwnd is not None:
        try:
            backend, window = connect_window_by_handle(raw_hwnd, selected_backend)
            if not is_login_window(window) and is_authenticated_main_window(window, expected_process_name):
                try:
                    window.set_focus()
                except Exception:
                    pass
                return backend, window
        except Exception:
            pass

    candidates = []

    for backend, window in list_matching_windows(title_re, selected_backend):
        if not is_authenticated_main_window(window, expected_process_name):
            continue
        candidates.append((backend, window))

    if not candidates:
        return None

    candidates.sort(key=lambda item: score_main_window(item[1]))
    backend, window = candidates[0]
    try:
        window.set_focus()
    except Exception:
        pass
    return backend, window


def find_login_window(title_re: str, selected_backend: str):
    candidates = []

    for backend, window in list_matching_windows(title_re, selected_backend):
        if not is_login_window(window):
            continue
        candidates.append((backend, window))

    if not candidates:
        return None

    candidates.sort(key=lambda item: score_candidate_window(item[1]))
    backend, window = candidates[0]
    try:
        window.set_focus()
    except Exception:
        pass
    return backend, window


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
    return count_text_hints(control, LOGIN_HINT_TEXTS)


def count_text_hints(control, hints: Sequence[str]) -> int:
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
            if contains_normalized_hint(fragment, hints):
                score += 1

    return score


def count_main_window_hints(control) -> int:
    return count_text_hints(control, MAIN_WINDOW_HINTS)


def describe_top_window(window, backend: str, index: int | None = None) -> str:
    rect = window.rectangle()
    prefix = f"[{index}] " if index is not None else ""
    process_id = "-"
    process_name = "-"
    try:
        process_id_value = int(window.process_id())
        process_id = str(process_id_value)
        process_name = get_process_image_name(process_id_value) or "-"
    except Exception:
        pass
    return (
        f"{prefix}"
        f"backend={backend} "
        f"title={window.window_text()!r} "
        f"class={get_window_class_name(window) or '-'} "
        f"pid={process_id} "
        f"process={process_name} "
        f"visible={is_control_visible(window)} "
        f"enabled={is_control_enabled(window)} "
        f"visible_edits={count_visible_edits(window)} "
        f"login_hints={count_login_hints(window)} "
        f"main_hints={count_main_window_hints(window)} "
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


def control_matches_hints(control, hints: Sequence[str]) -> bool:
    fragments = [
        get_control_text(control),
        get_control_auto_id(control),
        get_control_class_name(control),
        get_control_type_name(control),
    ]
    return any(contains_normalized_hint(fragment, hints) for fragment in fragments)


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


def control_center(control) -> Tuple[float, float]:
    rect = control.rectangle()
    return ((rect.left + rect.right) / 2.0, (rect.top + rect.bottom) / 2.0)


def control_distance(first, second) -> float:
    first_x, first_y = control_center(first)
    second_x, second_y = control_center(second)
    return abs(first_x - second_x) + abs(first_y - second_y)


def find_button_near_label(window, label_hints: Sequence[str], buttons: Sequence):
    label_candidates = []

    try:
        all_controls = dedupe_controls(window.descendants())
    except Exception:
        all_controls = []

    for control in all_controls:
        if not is_control_visible(control):
            continue
        if not control_matches_hints(control, label_hints):
            continue
        label_candidates.append(control)

    if not label_candidates or not buttons:
        return None

    best_pair = None
    for label in label_candidates:
        for button in buttons:
            distance = control_distance(label, button)
            if best_pair is None or distance < best_pair[0]:
                best_pair = (distance, button)

    if best_pair is None:
        return None

    return best_pair[1]


def find_login_button(window, button_title_re: str):
    control = find_control_by_auto_ids(window, LOGIN_BUTTON_AUTO_IDS, "Button")
    if control is not None:
        return control

    for auto_id in LOGIN_BUTTON_AUTO_IDS:
        try:
            control = window.child_window(auto_id=auto_id).wrapper_object()
            if is_control_visible(control) and is_control_enabled(control):
                return control
        except Exception:
            continue

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

    visible_buttons = [
        button
        for button in buttons
        if is_control_visible(button) and is_control_enabled(button)
    ]

    non_exit_buttons = [
        button
        for button in visible_buttons
        if not control_matches_hints(button, EXIT_HINTS)
    ]

    if non_exit_buttons:
        login_buttons = [
            button
            for button in non_exit_buttons
            if control_matches_hints(button, LOGIN_ACTION_HINTS)
        ]
        if login_buttons:
            return login_buttons[0]

        button_near_label = find_button_near_label(window, LOGIN_ACTION_HINTS, non_exit_buttons)
        if button_near_label is not None:
            return button_near_label

        return non_exit_buttons[-1]

    if visible_buttons:
        return visible_buttons[-1]

    return None


def get_window_handle(control) -> int | None:
    try:
        handle = int(control.handle)
        return handle if handle > 0 else None
    except Exception:
        return None


def get_process_id(control) -> int | None:
    try:
        process_id = int(control.process_id())
        return process_id if process_id > 0 else None
    except Exception:
        return None


def get_process_id_raw(hwnd: int) -> int | None:
    process_id = ctypes.c_ulong()
    try:
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(process_id))
    except Exception:
        return None

    return int(process_id.value) if process_id.value else None


def get_process_status(process_id: int | None) -> str:
    if process_id is None:
        return "unknown"

    process_handle = None
    try:
        process_handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, process_id)
        if not process_handle:
            return "not_running_or_access_denied"

        exit_code = ctypes.c_ulong()
        if not kernel32.GetExitCodeProcess(process_handle, ctypes.byref(exit_code)):
            return "unable_to_read_exit_code"

        if int(exit_code.value) == STILL_ACTIVE:
            return "running"

        return f"exited(code={int(exit_code.value)})"
    except Exception as exc:
        return f"error({exc})"
    finally:
        if process_handle:
            try:
                kernel32.CloseHandle(process_handle)
            except Exception:
                pass


def get_process_image_name(process_id: int | None) -> str | None:
    if process_id is None:
        return None

    process_handle = None
    try:
        process_handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, process_id)
        if not process_handle:
            return None

        buffer_size = ctypes.c_ulong(2048)
        buffer = ctypes.create_unicode_buffer(buffer_size.value)
        if not kernel32.QueryFullProcessImageNameW(process_handle, 0, buffer, ctypes.byref(buffer_size)):
            return None

        return os.path.basename(buffer.value)
    except Exception:
        return None
    finally:
        if process_handle:
            try:
                kernel32.CloseHandle(process_handle)
            except Exception:
                pass


def focus_control(control) -> None:
    try:
        control.set_focus()
    except Exception:
        pass


def get_parent_control(control):
    try:
        return control.parent()
    except Exception:
        return None


def iter_visible_controls(window) -> List:
    controls = [window]

    try:
        controls.extend(dedupe_controls(window.descendants()))
    except Exception:
        pass

    visible_controls = [control for control in dedupe_controls(controls) if is_control_visible(control)]
    visible_controls.sort(key=control_rect_key)
    return visible_controls


def find_controls_with_hints(window, hints: Sequence[str]) -> List:
    matches = []

    for control in iter_visible_controls(window):
        fragments = [
            get_control_text(control),
            get_control_auto_id(control),
            get_control_class_name(control),
            get_control_type_name(control),
        ]

        if any(contains_normalized_hint(fragment, hints) for fragment in fragments):
            matches.append(control)

    return matches


def find_visible_controls(window, control_type: str | None = None, class_name: str | None = None) -> List:
    controls = []

    try:
        if control_type is not None:
            controls.extend(window.descendants(control_type=control_type))
    except Exception:
        pass

    try:
        if class_name is not None:
            controls.extend(window.descendants(class_name=class_name))
    except Exception:
        pass

    controls = dedupe_controls(controls)
    controls = [control for control in controls if is_control_visible(control)]
    controls.sort(key=control_rect_key)
    return controls


def find_nearest_control_by_hints(window, label_hints: Sequence[str], controls: Sequence):
    labels = find_controls_with_hints(window, label_hints)
    if not labels or not controls:
        return None

    best_pair = None
    for label in labels:
        for control in controls:
            distance = control_distance(label, control)
            if best_pair is None or distance < best_pair[0]:
                best_pair = (distance, control)

    if best_pair is None:
        return None

    return best_pair[1]


def window_matches_hints(window, hints: Sequence[str]) -> bool:
    title_match = contains_normalized_hint(get_control_text(window), hints)
    body_match = count_text_hints(window, hints) > 0
    return title_match or body_match


def score_window_by_hints(window, hints: Sequence[str]) -> Tuple[int, int, int, str]:
    hint_count = count_text_hints(window, hints)
    title_bonus = 1 if contains_normalized_hint(get_control_text(window), hints) else 0
    visible_edits = count_visible_edits(window)
    return (-title_bonus, -hint_count, visible_edits, window.window_text().lower())


def is_reprint_window(window) -> bool:
    return count_text_hints(window, REPRINT_WINDOW_HINTS) > 0 and count_visible_edits(window) >= 1


def find_window_by_hints(
    selected_backend: str,
    hints: Sequence[str],
    timeout: float,
    expected_process_name: str | None = None,
    predicate=None,
):
    deadline = time.time() + timeout

    while time.time() < deadline:
        candidates = []
        for backend, window in list_matching_windows(r".*", selected_backend):
            process_id = get_process_id(window)
            if expected_process_name and not process_name_matches(process_id, expected_process_name):
                continue
            if not window_matches_hints(window, hints):
                continue
            if predicate is not None and not predicate(window):
                continue
            candidates.append((backend, window))

        if candidates:
            candidates.sort(key=lambda item: score_window_by_hints(item[1], hints))
            backend, window = candidates[0]
            try:
                window.set_focus()
            except Exception:
                pass
            return backend, window

        time.sleep(1.0)

    return None


def build_action_targets(control) -> List[Tuple[str, object]]:
    targets: List[Tuple[str, object]] = []
    seen_handles: set[int] = set()
    current = control

    for depth in range(4):
        if current is None:
            break

        handle = get_window_handle(current)
        if handle is not None and handle in seen_handles:
            current = get_parent_control(current)
            continue

        if handle is not None:
            seen_handles.add(handle)

        targets.append((f"depth_{depth}", current))
        current = get_parent_control(current)

    return targets


def try_activate_control(control, label: str) -> str | None:
    actions = [
        ("invoke", lambda current: current.invoke()),
        ("click_input", lambda current: current.click_input()),
        ("double_click_input", lambda current: current.double_click_input()),
        ("click", lambda current: current.click()),
        ("space", lambda current: current.type_keys("{SPACE}", set_foreground=True)),
        ("enter", lambda current: current.type_keys("{ENTER}", set_foreground=True)),
    ]

    for target_label, target in build_action_targets(control):
        for action_name, action in actions:
            try:
                focus_control(target)
                action(target)
                return f"{label}:{target_label}:{action_name}"
            except Exception as exc:
                print(f"[WARN] Fallo accion {action_name} sobre {label} ({target_label}): {exc}")

    return None


def set_combo_selection(control, value: str) -> str | None:
    strategies = [
        ("select", lambda current: current.select(value)),
        ("type", lambda current: current.type_keys(value, with_spaces=True, set_foreground=True)),
    ]

    for strategy_name, strategy in strategies:
        try:
            focus_control(control)
            strategy(control)
            return strategy_name
        except Exception as exc:
            print(f"[WARN] Fallo seleccion {strategy_name} del combo: {exc}")

    try:
        focus_control(control)
        control.click_input()
        time.sleep(0.5)
    except Exception as exc:
        print(f"[WARN] No se pudo expandir el combo con click_input: {exc}")
    else:
        popup_candidates = find_controls_with_hints(control.top_level_parent(), (value,))
        for popup_candidate in popup_candidates:
            strategy = try_activate_control(popup_candidate, "reprint_format_option")
            if strategy is not None:
                return f"popup:{strategy}"

    return None


def find_search_button(window):
    buttons = find_visible_controls(window, control_type="Button", class_name="Button")
    buttons = [button for button in buttons if is_control_enabled(button)]
    hinted_buttons = [button for button in buttons if control_matches_hints(button, REPRINT_SEARCH_HINTS)]
    if hinted_buttons:
        return hinted_buttons[0]
    return find_nearest_control_by_hints(window, REPRINT_SEARCH_HINTS, buttons)


def find_accept_button(window):
    buttons = find_visible_controls(window, control_type="Button", class_name="Button")
    buttons = [button for button in buttons if is_control_enabled(button)]
    hinted_buttons = [button for button in buttons if control_matches_hints(button, REPRINT_ACCEPT_HINTS)]
    if hinted_buttons:
        return hinted_buttons[0]
    return find_nearest_control_by_hints(window, REPRINT_ACCEPT_HINTS, buttons)


def find_reprint_number_edit(window):
    edits = find_visible_controls(window, control_type="Edit", class_name="Edit")
    edits = [edit for edit in edits if is_control_enabled(edit)]
    if not edits:
        return None
    if len(edits) == 1:
        return edits[0]
    return find_nearest_control_by_hints(window, REPRINT_NUMBER_HINTS, edits) or edits[0]


def find_reprint_format_combo(window):
    combos = find_visible_controls(window, control_type="ComboBox", class_name="ComboBox")
    combos = [combo for combo in combos if is_control_enabled(combo)]
    if combos:
        return combos[0]

    combo_like = []
    for control in iter_visible_controls(window):
        control_type = normalize_text(get_control_type_name(control))
        class_name = normalize_text(get_control_class_name(control))
        if "combo" in control_type or "combo" in class_name:
            if is_control_enabled(control):
                combo_like.append(control)

    if combo_like:
        combo_like.sort(key=control_rect_key)
        return combo_like[0]

    return None


def wait_for_reprint_window(selected_backend: str, expected_process_name: str | None, timeout: float):
    result = find_window_by_hints(
        selected_backend,
        REPRINT_WINDOW_HINTS,
        timeout,
        expected_process_name=expected_process_name,
        predicate=is_reprint_window,
    )
    if result is None:
        raise TimeoutError(
            f"No aparecio la ventana Reimpresion Guia en {timeout:.0f} segundos."
        )
    return result


def wait_for_reprint_modal(root_window, selected_backend: str, expected_process_name: str | None, timeout: float):
    root_top_level = None
    try:
        root_top_level = root_window.top_level_parent()
    except Exception:
        root_top_level = root_window

    deadline = time.time() + timeout
    while time.time() < deadline:
        result = find_window_by_hints(
            selected_backend,
            REPRINT_FORMAT_MODAL_HINTS,
            1.0,
            expected_process_name=expected_process_name,
        )
        if result is not None:
            return result

        if root_top_level is not None and count_text_hints(root_top_level, REPRINT_FORMAT_MODAL_HINTS) > 0:
            return selected_backend, root_top_level

        time.sleep(0.5)

    raise TimeoutError(
        f"No aparecio el modal SeleccionarReImpresionCW en {timeout:.0f} segundos."
    )


def find_modal_anchor(window):
    anchors = find_controls_with_hints(window, REPRINT_FORMAT_MODAL_HINTS)
    if not anchors:
        return None
    anchors.sort(key=control_rect_key)
    return anchors[0]


def find_controls_near_anchor(controls: Sequence, anchor, max_vertical_gap: int = 220) -> List:
    if anchor is None:
        return list(controls)

    anchor_x, anchor_y = control_center(anchor)
    scored = []
    for control in controls:
        control_x, control_y = control_center(control)
        vertical_gap = abs(control_y - anchor_y)
        horizontal_gap = abs(control_x - anchor_x)
        if vertical_gap > max_vertical_gap:
            continue
        scored.append((vertical_gap, horizontal_gap, control))

    scored.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in scored]


def find_reprint_format_combo_in_modal(window):
    anchor = find_modal_anchor(window)
    combos = find_visible_controls(window, control_type="ComboBox", class_name="ComboBox")
    combos = [combo for combo in combos if is_control_enabled(combo)]

    hinted_combos = [
        combo
        for combo in combos
        if control_matches_hints(combo, REPRINT_FORMAT_MODAL_HINTS)
    ]
    if hinted_combos:
        return hinted_combos[0]

    nearby_combos = find_controls_near_anchor(combos, anchor)
    if nearby_combos:
        return nearby_combos[0]

    return find_reprint_format_combo(window)


def find_accept_button_in_modal(window):
    anchor = find_modal_anchor(window)
    buttons = find_visible_controls(window, control_type="Button", class_name="Button")
    buttons = [button for button in buttons if is_control_enabled(button)]

    hinted_buttons = [button for button in buttons if control_matches_hints(button, REPRINT_ACCEPT_HINTS)]
    if hinted_buttons:
        nearby_hinted = find_controls_near_anchor(hinted_buttons, anchor)
        if nearby_hinted:
            return nearby_hinted[0]
        return hinted_buttons[0]

    nearby_buttons = find_controls_near_anchor(buttons, anchor)
    if nearby_buttons:
        return nearby_buttons[0]

    return find_accept_button(window)


def complete_reprint_flow(
    main_window,
    selected_backend: str,
    expected_process_name: str | None,
    tracking_number: str,
    reprint_format: str,
    reprint_window_timeout: float,
    reprint_modal_timeout: float,
) -> bool:
    if not open_reprint_guides(main_window):
        return False

    try:
        reprint_backend, reprint_window = wait_for_reprint_window(
            selected_backend,
            expected_process_name,
            reprint_window_timeout,
        )
    except TimeoutError as exc:
        print(f"[ERROR] {exc}")
        return False

    print_selected_window("Ventana Reimpresion Guia", reprint_backend, reprint_window)

    number_edit = find_reprint_number_edit(reprint_window)
    if number_edit is None:
        print("[ERROR] No se encontro el campo Numero en Reimpresion Guia.")
        return False

    print(f"[INFO] Campo Numero detectado: {describe_control(number_edit)}")
    set_text(number_edit, tracking_number)
    print(f"[INFO] Numero de guia cargado: {tracking_number}")

    search_button = find_search_button(reprint_window)
    if search_button is None:
        print("[ERROR] No se encontro el boton Buscar en Reimpresion Guia.")
        return False

    print(f"[INFO] Boton Buscar detectado: {describe_control(search_button)}")
    search_strategy = try_activate_control(search_button, "reprint_search")
    if search_strategy is None:
        print("[ERROR] No se pudo activar el boton Buscar.")
        return False

    print(f"[INFO] Buscar ejecutado usando estrategia: {search_strategy}")

    try:
        modal_backend, modal_window = wait_for_reprint_modal(
            reprint_window,
            selected_backend,
            expected_process_name,
            reprint_modal_timeout,
        )
    except TimeoutError as exc:
        print(f"[ERROR] {exc}")
        return False

    print_selected_window("Modal SeleccionarReImpresionCW", modal_backend, modal_window)

    format_combo = find_reprint_format_combo_in_modal(modal_window)
    if format_combo is None:
        print("[ERROR] No se encontro el combo del formato de reimpresion.")
        return False

    print(f"[INFO] Combo formato detectado: {describe_control(format_combo)}")
    combo_strategy = set_combo_selection(format_combo, reprint_format)
    if combo_strategy is None:
        print(f"[ERROR] No se pudo seleccionar el formato {reprint_format!r}.")
        return False

    print(f"[INFO] Formato seleccionado usando estrategia: {combo_strategy}")

    accept_button = find_accept_button_in_modal(modal_window)
    if accept_button is None:
        print("[ERROR] No se encontro el boton Aceptar en el modal de reimpresion.")
        return False

    print(f"[INFO] Boton Aceptar detectado: {describe_control(accept_button)}")
    accept_strategy = try_activate_control(accept_button, "reprint_accept")
    if accept_strategy is None:
        print("[ERROR] No se pudo activar el boton Aceptar del modal.")
        return False

    print(f"[INFO] Modal aceptado usando estrategia: {accept_strategy}")
    return True


def wait_for_main_window(
    title_re: str,
    selected_backend: str,
    timeout: float,
    expected_process_name: str | None = None,
):
    deadline = time.time() + timeout
    next_progress_log = time.time()

    while time.time() < deadline:
        result = find_main_window(title_re, selected_backend, expected_process_name)
        if result is not None:
            return result

        current_time = time.time()
        if current_time >= next_progress_log:
            remaining = max(0.0, deadline - current_time)
            print(
                "[INFO] La ventana principal aun no aparece. "
                f"Seguimos esperando... restante ~{remaining:.0f}s"
            )
            next_progress_log = current_time + 30.0

        time.sleep(2.0)

    raise TimeoutError(
        f"No aparecio la ventana principal autenticada en {timeout:.0f} segundos."
    )


def open_reprint_guides(window) -> bool:
    candidates = find_controls_with_hints(window, REPRINT_HINTS)
    if not candidates:
        print("[ERROR] No se encontro un control visible que matchee Reimpresion de Guias.")
        return False

    candidates.sort(key=control_rect_key)
    print("[INFO] Candidatos para Reimpresion de Guias:")
    for index, control in enumerate(candidates[:5]):
        print(f"[INFO] {describe_control(control, index)}")

    for control in candidates:
        strategy = try_activate_control(control, "reprint")
        if strategy is not None:
            print(f"[INFO] Se activo Reimpresion de Guias usando estrategia: {strategy}")
            return True

    print("[ERROR] No se pudo activar Reimpresion de Guias con ninguno de los candidatos.")
    return False


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


def list_visible_windows_for_process(process_id: int, selected_backend: str):
    matches = []

    for backend in backend_candidates(selected_backend):
        try:
            desktop = Desktop(backend=backend)
            for spec in desktop.windows():
                try:
                    wrapper = spec.wrapper_object()
                except Exception:
                    continue

                if not is_control_visible(wrapper):
                    continue

                try:
                    wrapper_pid = int(wrapper.process_id())
                except Exception:
                    continue

                if wrapper_pid != process_id:
                    continue

                matches.append((backend, wrapper))
        except Exception:
            continue

    matches.sort(key=lambda item: score_candidate_window(item[1]))
    return matches


def print_process_windows_snapshot(process_id: int | None, selected_backend: str) -> None:
    if process_id is None:
        print("[INFO] No se pudo determinar el PID del POS para inspeccion posterior.")
        return

    matches = list_visible_windows_for_process(process_id, selected_backend)
    if not matches:
        print(f"[INFO] No hay ventanas top-level visibles para el proceso PID={process_id} despues del submit.")
        return

    print(f"[INFO] Ventanas visibles del mismo proceso PID={process_id}:")
    for index, (backend, window) in enumerate(matches[:8]):
        print(f"[INFO] {describe_top_window(window, backend, index)}")


def print_process_status_snapshot(process_id: int | None) -> None:
    if process_id is None:
        print("[INFO] No se pudo determinar el estado del proceso del POS.")
        return

    status = get_process_status(process_id)
    print(f"[INFO] Estado del proceso PID={process_id} despues del submit: {status}")


def print_foreground_window_snapshot() -> None:
    try:
        hwnd = int(user32.GetForegroundWindow())
    except Exception:
        hwnd = 0

    if not hwnd:
        print("[INFO] No se pudo determinar la ventana en primer plano despues del submit.")
        return

    title = get_window_text_raw(hwnd)
    class_name = get_class_name_raw(hwnd)
    process_id = get_process_id_raw(hwnd)
    is_visible = bool(user32.IsWindowVisible(hwnd))
    print(
        "[INFO] Ventana en primer plano despues del submit: "
        f"hwnd={hwnd} title={title!r} class={class_name or '-'} pid={process_id or '-'} visible={is_visible}"
    )


def observe_after_submit(
    window,
    original_process_id: int | None,
    title_re: str,
    selected_backend: str,
    delay_seconds: float,
) -> None:
    if delay_seconds > 0:
        print(f"[INFO] Observando el POS durante {delay_seconds:.1f}s despues del submit...")
        time.sleep(delay_seconds)

    hwnd = get_window_handle(window)
    if hwnd is not None and bool(user32.IsWindow(hwnd)):
        print("[INFO] La ventana original del login sigue existiendo despues del submit.")
        print(f"[INFO] Estado actual: {describe_top_window(window, selected_backend)}")
    else:
        print("[INFO] La ventana original del login ya no existe despues del submit.")

    print_foreground_window_snapshot()
    print_process_status_snapshot(original_process_id)
    print_process_windows_snapshot(original_process_id, selected_backend)
    print_post_submit_snapshot(title_re, selected_backend)


def print_selected_window(label: str, backend: str, window) -> int | None:
    print(f"[INFO] {label} detectada con backend={backend}")
    print(f"[INFO] Titulo ventana: {window.window_text()!r}")
    print(f"[INFO] Clase ventana: {get_window_class_name(window) or '-'}")
    process_id = get_process_id(window)
    if process_id is not None:
        print(f"[INFO] PID ventana: {process_id}")
        process_name = get_process_image_name(process_id)
        if process_name:
            print(f"[INFO] Proceso ventana: {process_name}")
    return process_id


def main() -> int:
    args = parse_args()
    should_submit = args.submit or args.ensure_main_window or args.open_reprint

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

    username, password, credential_sources = resolve_credentials(args)
    app_path_input, app_path_source = resolve_app_path_input(args)

    if args.ensure_main_window or args.open_reprint:
        existing_main_window = find_main_window(
            args.main_title_re,
            args.backend,
            args.main_process_name,
        )
        if existing_main_window is not None:
            backend, window = existing_main_window
            print("[INFO] La ventana principal del POS ya estaba abierta.")
            print_selected_window("Ventana principal autenticada", backend, window)
            if args.print_controls:
                print()
                print_control_debug(window)
            if args.open_reprint:
                return 0 if complete_reprint_flow(
                    window,
                    backend,
                    args.main_process_name,
                    args.reprint_tracking_number,
                    args.reprint_format,
                    args.reprint_window_timeout,
                    args.reprint_modal_timeout,
                ) else 1
            return 0

    try:
        app_path = resolve_app_path(app_path_input)
    except FileNotFoundError as exc:
        print(f"[ERROR] {exc}")
        return 1

    print(f"[INFO] Fuente de ruta POS: {app_path_source}")
    print(f"[INFO] Ruta resuelta: {app_path}")

    login_window_result = None
    if args.ensure_main_window or args.open_reprint:
        login_window_result = find_login_window(args.title_re, args.backend)
        if login_window_result is not None:
            print("[INFO] Se encontro una ventana de login ya abierta. No se relanzara la app.")

    if login_window_result is None:
        print("[INFO] Abriendo aplicacion...")
        launch_app(app_path)
        if args.startup_delay > 0:
            print(f"[INFO] Esperando {args.startup_delay:.1f}s para el arranque inicial...")
            time.sleep(args.startup_delay)

        if args.ensure_main_window or args.open_reprint:
            existing_main_window = find_main_window(
                args.main_title_re,
                args.backend,
                args.main_process_name,
            )
            if existing_main_window is not None:
                backend, window = existing_main_window
                print("[INFO] La ventana principal aparecio sin necesidad de reloguear.")
                print_selected_window("Ventana principal autenticada", backend, window)
                if args.print_controls:
                    print()
                    print_control_debug(window)
                if args.open_reprint:
                    return 0 if complete_reprint_flow(
                        window,
                        backend,
                        args.main_process_name,
                        args.reprint_tracking_number,
                        args.reprint_format,
                        args.reprint_window_timeout,
                        args.reprint_modal_timeout,
                    ) else 1
                return 0

            login_window_result = find_login_window(args.title_re, args.backend)

    try:
        if login_window_result is not None:
            backend, window = login_window_result
        elif args.hwnd:
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

    process_id = print_selected_window("Ventana login", backend, window)

    if args.print_controls:
        print()
        print_control_debug(window)

    if args.inspect_only:
        print("[INFO] Modo inspect-only activo. No se escribiran credenciales.")
        return 0

    if credential_sources:
        print(f"[INFO] Credenciales resueltas: {', '.join(credential_sources)}")

    if not username and not password:
        if should_submit:
            print("[ERROR] No hay credenciales disponibles para continuar con el login del POS.")
            return 1
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

    if should_submit:
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

        if args.ensure_main_window or args.open_reprint:
            try:
                print(
                    "[INFO] Esperando la ventana principal autenticada despues del login. "
                    f"Timeout configurado: {args.main_window_timeout:.0f}s"
                )
                main_backend, main_window = wait_for_main_window(
                    args.main_title_re,
                    args.backend,
                    args.main_window_timeout,
                    args.main_process_name,
                )
            except TimeoutError as exc:
                print(f"[WARN] {exc}")
                observe_after_submit(window, process_id, args.main_title_re, backend, args.post_submit_delay)
                return 1

            print_selected_window("Ventana principal autenticada", main_backend, main_window)
            if args.print_controls:
                print()
                print_control_debug(main_window)

            if args.open_reprint:
                return 0 if complete_reprint_flow(
                    main_window,
                    main_backend,
                    args.main_process_name,
                    args.reprint_tracking_number,
                    args.reprint_format,
                    args.reprint_window_timeout,
                    args.reprint_modal_timeout,
                ) else 1
        else:
            observe_after_submit(window, process_id, args.title_re, backend, args.post_submit_delay)
    else:
        print("[INFO] Credenciales cargadas. No se envio login porque no se paso --submit.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
