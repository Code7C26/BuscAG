@echo off
setlocal
cd /d "%~dp0"
title BuscAG - Presentacion local
where node >nul 2>nul
if errorlevel 1 goto missing_node
node server\check-runtime.mjs
if errorlevel 1 goto failed
if not exist "dist\index.html" goto missing_build
if exist "data\auth.json" goto ready
echo.
echo Primera vez: elegi una contrasena privada de al menos 12 caracteres.
echo Al escribirla no se vera en pantalla. Presiona Enter al terminar.
node server\setup.mjs
if errorlevel 1 goto failed
:ready
node server\windows-launcher.mjs
if errorlevel 1 goto failed
exit /b 0
:missing_node
echo No se encontro Node.js.
echo Instala Node 24 LTS desde https://nodejs.org/ y vuelve a abrir este archivo.
goto failed
:missing_build
echo Falta el build compilado. Usa el ZIP portable completo.
echo Si descargaste fuentes desde GitHub, ejecuta PREPARAR-DESDE-FUENTE.cmd.
:failed
echo.
echo No se inicio la presentacion. Revisa el mensaje anterior.
pause
exit /b 1
