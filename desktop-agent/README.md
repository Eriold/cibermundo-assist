# desktop-agent POC

Este folder contiene un POC minimo para validar la primera parte del flujo del POS:

1. abrir la aplicacion
2. detectar la ventana de login
3. llenar usuario y password
4. opcionalmente enviar el login

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

## Primer intento recomendado

Usa primero `--print-controls` y sin `--submit`.

```powershell
python .\pos_login_poc.py `
  --app-path "C:\Users\SERVIDOR\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Interrapidisimo\Interrapidisimo POS" `
  --username "TU_USUARIO" `
  --password "TU_PASSWORD" `
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
  --username "TU_USUARIO" `
  --password "TU_PASSWORD" `
  --submit
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
