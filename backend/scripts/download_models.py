#!/usr/bin/env python
"""
Automated ML Model Artifact Downloader for KrishiMitra.

Downloads and verifies production model binaries from GitHub Release v1.0.0:
- best_model.joblib (Random Forest Crop Recommendation pipeline)
- crop_yield_model.pkl (HistGradientBoosting Crop Yield Regressor)

Idempotent: Skips download if file already exists with matching MD5 checksum.
"""
import os
import sys
import hashlib
from pathlib import Path
import requests

BASE_DIR = Path(__file__).resolve().parent.parent
TARGET_DIR = BASE_DIR / "krishi_core" / "ml_models" / "artifacts"

MODELS = {
    "best_model.joblib": {
        "url": "https://github.com/bjgithub29/KrishiMitra/releases/download/v1.0.0/best_model.joblib",
        "md5": "ffd5def7a346704d44790a3b6067cf19",
        "description": "Random Forest Crop Recommendation pipeline (25 classes)"
    },
    "crop_yield_model.pkl": {
        "url": "https://github.com/bjgithub29/KrishiMitra/releases/download/v1.0.0/crop_yield_model.pkl",
        "md5": "7c47105d8f39cfd87acc73f3ea9b3edc",
        "description": "HistGradientBoosting Crop Yield Regressor"
    }
}


def compute_md5(filepath: Path) -> str:
    hasher = hashlib.md5()
    with open(filepath, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def download_file(url: str, dest_path: Path, expected_md5: str) -> bool:
    temp_path = dest_path.with_suffix(".download.tmp")
    print(f"Downloading from {url} ...")
    try:
        response = requests.get(url, stream=True, timeout=120)
        response.raise_for_status()
        with open(temp_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=65536):
                if chunk:
                    f.write(chunk)
    except Exception as e:
        print(f"[ERROR] Download failed: {e}")
        if temp_path.exists():
            temp_path.unlink()
        return False

    downloaded_md5 = compute_md5(temp_path)
    if downloaded_md5.lower() != expected_md5.lower():
        print(f"[ERROR] Checksum mismatch for {dest_path.name}!")
        print(f"  Expected: {expected_md5}")
        print(f"  Received: {downloaded_md5}")
        temp_path.unlink()
        return False

    if dest_path.exists():
        dest_path.unlink()
    temp_path.rename(dest_path)
    print(f"[OK] Successfully verified and saved {dest_path.name}")
    return True


def ensure_models() -> bool:
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    all_ok = True

    print("=== KrishiMitra ML Model Artifact Verification ===")
    print(f"Artifacts directory: {TARGET_DIR}")

    for filename, info in MODELS.items():
        filepath = TARGET_DIR / filename
        expected_md5 = info["md5"]
        description = info["description"]

        if filepath.exists():
            current_md5 = compute_md5(filepath)
            if current_md5.lower() == expected_md5.lower():
                print(f"[SKIP] {filename} already present and verified ({description})")
                continue
            else:
                print(f"[WARN] {filename} exists but checksum invalid. Redownloading...")

        success = download_file(info["url"], filepath, expected_md5)
        if not success:
            all_ok = False

    if all_ok:
        print("=== All ML model artifacts verified successfully ===")
        return True
    else:
        print("[FAIL] Failed to download or verify all required model artifacts.")
        return False


if __name__ == "__main__":
    if not ensure_models():
        sys.exit(1)
