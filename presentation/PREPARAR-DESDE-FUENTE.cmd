@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto fail
node server\check-runtime.mjs
if errorlevel 1 goto fail
call npm.cmd ci
if errorlevel 1 goto fail
call npm.cmd run build
if errorlevel 1 goto fail
call INICIAR-WINDOWS.cmd
exit /b %errorlevel%
:fail
echo No se pudo preparar. Verifica Node 24 LTS y conexion a Internet.
pause
exit /b 1
