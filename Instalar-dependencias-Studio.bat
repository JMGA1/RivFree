@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m pip install -r tools\manual_editor\requirements.txt
  rem Conector de PostgreSQL para Studio - Base de datos (opcional, puro Python)
  py -3 -m pip install --require-hashes -r requirements-db.txt
) else (
  python -m pip install -r tools\manual_editor\requirements.txt
  python -m pip install --require-hashes -r requirements-db.txt
)
pause
