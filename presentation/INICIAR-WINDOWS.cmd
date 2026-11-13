@echo off
cd /d "%~dp0"
if not exist data\auth.json node server\setup.mjs
node server\index.mjs
pause
