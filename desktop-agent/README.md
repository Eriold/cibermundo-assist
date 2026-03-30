# desktop-agent POC

Este folder contiene un POC minimo para validar la primera parte del flujo del POS:

1. detectar si la ventana principal autenticada ya esta abierta
2. si no esta abierta, abrir la aplicacion e intentar login
3. esperar la carga larga del POS hasta que aparezca la ventana principal
4. entrar a `Reimpresion de Guias`

## Recomendacion de Python

Para este POC se recomienda usar Python 3.11 o 3.12 en el otro PC.

Razon:

- `pywinauto` y su ecosistema suelen ser mas estables en esas versiones
- aqui en este equipo existe Python 3.13, pero no es la mejor base para validar automatizacion Windows con `pywinauto`

## Instalacion

```powershell
cd desktop-agent
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Launcher .bat

Ya existe un launcher para doble clic:

- [start_desktop_agent.bat](c:/Users/eriold/Desktop/Frontend/adm-rep/desktop-agent/start_desktop_agent.bat)

Comportamiento:

- doble clic ejecuta el flujo principal actual:
  - usar la ventana principal si ya esta abierta
  - si no, hacer login
  - esperar hasta 20 minutos la carga del POS
  - abrir `Reimpresion de Guias`
- si no existe `.venv`, lo crea automaticamente
- si falta `pywinauto`, instala `requirements.txt`
- despues del submit observa el estado del POS durante unos segundos y reporta lo que encuentre
- deja la consola abierta al final para ver errores o confirmaciones

Modos opcionales desde consola:

```cmd
start_desktop_agent.bat run
start_desktop_agent.bat submit
start_desktop_agent.bat fill
start_desktop_agent.bat inspect
```

`submit` queda como alias de `run`.

## Primer intento recomendado

Usa primero `--print-controls` y sin `--submit`.

El script ya acepta estas variables para no hardcodear credenciales o ruta:

- `POS_EXE_PATH`
- `POS_USER`
- `POS_PASS`
- `APX_USER`
- `APX_PASS`

`POS_USER/POS_PASS` tienen prioridad sobre `APX_USER/APX_PASS`.

Si `--app-path` apunta a una carpeta, el script intenta buscar dentro el archivo real de lanzamiento del POS.
Prioriza:

- `.appref-ms`
- `.lnk`
- `.exe`

Y da preferencia a nombres como `Admisiones POS`.

```powershell
python .\pos_login_poc.py `
  --app-path "C:\Users\SERVIDOR\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Interrapidisimo\Interrapidisimo POS" `
  --print-controls
```

Eso hace:

- abrir la app usando `os.startfile`
- esperar una ventana que matchee `POS` o `Interrapidisimo`
- intentar encontrar los dos campos de texto
- escribir usuario y password
- imprimir la estructura de controles para afinar el script si hace falta

## Enviar login

Cuando ya veas que detecta bien los controles:

```powershell
python .\pos_login_poc.py `
  --app-path "C:\Users\SERVIDOR\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Interrapidisimo\Interrapidisimo POS" `
  --submit
```

## Flujo principal nuevo

Para el ejercicio actual, este es el flujo recomendado:

```powershell
python .\pos_login_poc.py `
  --ensure-main-window `
  --open-reprint `
  --main-window-timeout 1200
```

Eso hace:

- primero intenta detectar la ventana principal autenticada
- prioriza la deteccion por el ejecutable `PosWPF.Cliente.exe`
- si ya esta abierta, no relanza ni reloguea el POS
- si no esta abierta, intenta login
- espera hasta 20 minutos a que cargue la ventana principal
- cuando aparezca, entra a `Reimpresion de Guias`
- usa la guia de prueba `240048399888`
- en el modal de formato intenta seleccionar `TIRILLA` y luego `Aceptar`

Si quieres dejar mas tiempo de observacion despues del login:

```powershell
python .\pos_login_poc.py --submit --post-submit-delay 15
```

En la siguiente validacion post-login fijate sobre todo en estas lineas de consola:

- `PID ventana login: ...`
- `Ventana en primer plano despues del submit: ...`
- `Estado del proceso PID=... despues del submit: ...`
- `Ventanas visibles del mismo proceso PID=...`
- `No hay ventanas top-level visibles para el proceso ...`

## Override manual opcional

Si alguna vez quieres probar otras credenciales sin tocar `.env`, puedes sobrescribirlas:

```powershell
python .\pos_login_poc.py `
  --app-path "C:\Users\SERVIDOR\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Interrapidisimo\Interrapidisimo POS" `
  --username "OTRO_USUARIO" `
  --password "OTRA_CLAVE"
```

## Ajustes utiles

### Forzar backend

```powershell
python .\pos_login_poc.py --backend uia
python .\pos_login_poc.py --backend win32
```

### Cambiar indices de los campos

Si el script detecta mas de 2 `Edit`, puedes forzar cuales usar:

```powershell
python .\pos_login_poc.py --username-index 0 --password-index 1
```

### Afinar el titulo de la ventana

```powershell
python .\pos_login_poc.py --title-re ".*POS.*"
```

## Nota importante

La ruta dada parece ser la del acceso del menu inicio, no necesariamente la del `.exe` final.

Por eso este POC abre la ruta con `os.startfile`, que funciona mejor para:

- `.exe`
- `.lnk`
- `.appref-ms`

Si en el otro PC la ruta real termina siendo distinta, solo cambia `--app-path`.
