@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 tools\manual_editor\server.py --open
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  python tools\manual_editor\server.py --open
  goto :eof
)
echo.
echo No se encontro Python. Instala Python 3 y vuelve a abrir este archivo.
echo.
pause
