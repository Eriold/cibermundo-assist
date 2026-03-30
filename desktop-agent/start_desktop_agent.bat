@echo off
setlocal EnableExtensions DisableDelayedExpansion

cd /d "%~dp0"
title Desktop Agent POS Launcher

set "MODE=%~1"
if not defined MODE set "MODE=submit"

if /I "%MODE%"=="submit" goto :run_submit
if /I "%MODE%"=="run" goto :run_submit
if /I "%MODE%"=="fill" goto :run_fill
if /I "%MODE%"=="inspect" goto :run_inspect
if /I "%MODE%"=="help" goto :usage_ok
if /I "%MODE%"=="menu" goto :usage

echo [WARN] Modo no reconocido: %MODE%
goto :usage_error

:run_submit
call :prepare_python
if errorlevel 1 goto :finish
echo [INFO] Ejecutando bot POS con submit...
"%PYTHON_EXE%" ".\pos_login_poc.py" --submit --post-submit-delay 12
set "EXIT_CODE=%ERRORLEVEL%"
goto :finish

:run_fill
call :prepare_python
if errorlevel 1 goto :finish
echo [INFO] Ejecutando login POS sin submit...
"%PYTHON_EXE%" ".\pos_login_poc.py"
set "EXIT_CODE=%ERRORLEVEL%"
goto :finish

:run_inspect
call :prepare_python
if errorlevel 1 goto :finish
echo [INFO] Ejecutando inspeccion segura del POS...
"%PYTHON_EXE%" ".\pos_login_poc.py" --inspect-only --print-controls
set "EXIT_CODE=%ERRORLEVEL%"
goto :finish

:prepare_python
if exist ".venv\Scripts\python.exe" (
    set "PYTHON_EXE=%CD%\.venv\Scripts\python.exe"
    goto :ensure_requirements
)

call :find_base_python
if errorlevel 1 exit /b 1

echo [INFO] Creando entorno virtual en desktop-agent\.venv...
%BASE_PYTHON_CMD% -m venv ".venv"
if errorlevel 1 (
    echo [ERROR] No se pudo crear el entorno virtual.
    exit /b 1
)

set "PYTHON_EXE=%CD%\.venv\Scripts\python.exe"

:ensure_requirements
"%PYTHON_EXE%" -c "import pywinauto" >nul 2>&1
if not errorlevel 1 exit /b 0

echo [INFO] Instalando dependencias de desktop-agent...
"%PYTHON_EXE%" -m pip install --disable-pip-version-check -r ".\requirements.txt"
if errorlevel 1 (
    echo [ERROR] Fallo la instalacion de dependencias.
    exit /b 1
)

exit /b 0

:find_base_python
where py >nul 2>&1
if not errorlevel 1 (
    py -3.12 -V >nul 2>&1
    if not errorlevel 1 (
        set "BASE_PYTHON_CMD=py -3.12"
        exit /b 0
    )

    py -3.11 -V >nul 2>&1
    if not errorlevel 1 (
        set "BASE_PYTHON_CMD=py -3.11"
        exit /b 0
    )

    py -3 -V >nul 2>&1
    if not errorlevel 1 (
        set "BASE_PYTHON_CMD=py -3"
        exit /b 0
    )

    set "BASE_PYTHON_CMD=py"
    exit /b 0
)

where python >nul 2>&1
if not errorlevel 1 (
    set "BASE_PYTHON_CMD=python"
    exit /b 0
)

echo [ERROR] No se encontro Python. Instala Python 3.11 o 3.12 en el PC del POS.
exit /b 1

:usage_ok
set "EXIT_CODE=0"
goto :usage

:usage_error
set "EXIT_CODE=1"

:usage
echo.
echo Uso:
echo   start_desktop_agent.bat
echo   start_desktop_agent.bat submit
echo   start_desktop_agent.bat fill
echo   start_desktop_agent.bat inspect
echo.
echo Modos:
echo   submit   Login POS con click en Entrar o Enter fallback.
echo   fill     Carga credenciales pero no envia login.
echo   inspect  Solo imprime controles y no escribe credenciales.
echo.
echo Doble clic ejecuta el modo submit.

:finish
if not defined EXIT_CODE set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo [ERROR] El launcher termino con codigo %EXIT_CODE%.
pause
endlocal & exit /b %EXIT_CODE%
