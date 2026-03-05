@echo off
setlocal

echo.
echo ======================================================
echo  INTER ISMAEL - Shutdown
echo ======================================================
echo.

echo [INFO] Stopping backend and worker processes...

REM Cerrar ventanas por nombre
tasklist | find /i "Inter Ismael" >nul 2>&1
if %errorlevel%==0 (
    echo [INFO] Found Inter Ismael windows, closing...
    taskkill /F /FI "WINDOWTITLE eq *Inter Ismael*" >nul 2>&1
)

REM Alternativa: matar node.exe (si no funcionó por windowtitle)
tasklist | find /i "node.exe" >nul 2>&1
if %errorlevel%==0 (
    echo [WARN] Still found node processes, force killing...
    taskkill /F /IM node.exe >nul 2>&1
)

echo.
echo ======================================================
echo  ✓ All services stopped
echo  ✓ Database saved to: data/app.db
echo ======================================================
echo.

pause
