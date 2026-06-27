@echo off
cd /d "%~dp0"
"C:\Program Files\nodejs\node.exe" server.js 1>server.log 2>server-error.log
