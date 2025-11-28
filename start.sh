#!/bin/sh
set -e

# Run lightweight migrations (table creation) before starting the API
python -m app.create_tables

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
