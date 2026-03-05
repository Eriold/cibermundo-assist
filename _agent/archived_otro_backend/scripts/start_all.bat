@echo off
setlocal enabledelayedexpansion

REM Cambiar al directorio raíz del proyecto
cd /d %~dp0\..

echo.
echo ======================================================
echo  INTER ISMAEL - Backend + Worker Startup
echo ======================================================
echo.

REM Verificar que existan los directorios
if not exist "app\backend" (
    echo [ERROR] app\backend not found
    pause
    exit /b 1
)

if not exist "app\worker" (
    echo [ERROR] app\worker not found
    pause
    exit /b 1
)

REM Crear directorio de logs si no existe
if not exist "data\logs" mkdir data\logs

echo [INFO] Starting backend...
echo.

REM Iniciar backend en un proceso separado
start "Inter Ismael - Backend" cmd /k ^
    cd /d "!cd!\app\backend" ^& ^
    echo Backend starting on port 3333... ^& ^
    npm run dev

timeout /t 2 /nobreak >nul

echo.
echo [INFO] Backend started. Now starting worker...
echo.

REM Iniciar worker en un proceso separado
start "Inter Ismael - Worker" cmd /k ^
    cd /d "!cd!\app\worker" ^& ^
    echo Worker starting (poll interval 5s)... ^& ^
    npm run dev

echo.
echo ======================================================
echo  ✓ Both processes started in separate windows
echo  ✓ Backend: http://localhost:3333
echo  ✓ Database: data/app.db
echo  ✓ Check logs above for errors
echo ======================================================
echo.
echo You can close this window. The processes will keep running.
echo Use stop_all.bat to stop them.
echo.

pause
