#!/usr/bin/env bash
# KrishiMitra Render Free Web Service Build Script
# Idempotent: safe to run on every deploy

set -e

echo "=== [1/6] Installing Python dependencies ==="
pip install --upgrade pip
pip install -r requirements.txt

echo "=== [2/6] Downloading and verifying ML model artifacts ==="
python scripts/download_models.py

echo "=== [3/6] Applying database migrations ==="
python manage.py migrate --no-input

echo "=== [4/6] Initializing ChromaDB vector collections ==="
python knowledge-base/scripts/init_disease_chroma.py
python knowledge-base/scripts/init_timeline_chroma.py
python knowledge-base/scripts/init_website_chroma.py

echo "=== [5/6] Collecting static assets via WhiteNoise ==="
python manage.py collectstatic --no-input

echo "=== [6/6] Render build completed successfully ==="
