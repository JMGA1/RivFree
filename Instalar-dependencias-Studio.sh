#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
python3 -m pip install -r tools/manual_editor/requirements.txt
# Conector de PostgreSQL para Studio → Base de datos (opcional, puro Python)
python3 -m pip install --require-hashes -r requirements-db.txt
