import re
import numpy as np

# OpenCV (cv2) is an OPTIONAL dependency. It is only used by
# check_image_quality() below, which the current live disease-detection flow
# does NOT call (that flow uses the Gemini API). Import it lazily so the Django
# application can start even when opencv-python is not installed. If cv2 is
# genuinely needed later, check_image_quality() raises a clear error.
try:
    import cv2  # type: ignore
except ImportError:  # pragma: no cover - depends on the environment
    cv2 = None

CROPS = [
    {"name": "Soybean", "season": "kharif", "phRange": [6.5, 7.5], "water": "medium",
     "durationDays": 100, "costPerAcre": 18000, "yieldKgPerAcre": 450, "pricePerKg": 45, "demand": "high"},
    {"name": "Cotton", "season": "kharif", "phRange": [6.0, 8.0], "water": "medium",
     "durationDays": 180, "costPerAcre": 28000, "yieldKgPerAcre": 500, "pricePerKg": 65, "demand": "high"},
    {"name": "Groundnut", "season": "kharif", "phRange": [6.0, 7.0], "water": "medium",
     "durationDays": 110, "costPerAcre": 18000, "yieldKgPerAcre": 700, "pricePerKg": 55, "demand": "high"},
    {"name": "Bajra (Pearl Millet)", "season": "kharif", "phRange": [6.5, 7.5], "water": "low",
     "durationDays": 90, "costPerAcre": 12000, "yieldKgPerAcre": 900, "pricePerKg": 24, "demand": "high"},
    {"name": "Rice (Paddy)", "season": "kharif", "phRange": [6.0, 7.5], "water": "high",
     "durationDays": 130, "costPerAcre": 22000, "yieldKgPerAcre": 1800, "pricePerKg": 21, "demand": "high"},
    {"name": "Maize", "season": "kharif", "phRange": [6.0, 8.0], "water": "medium",
     "durationDays": 100, "costPerAcre": 14000, "yieldKgPerAcre": 1200, "pricePerKg": 18, "demand": "medium"},
    {"name": "Wheat", "season": "rabi", "phRange": [6.0, 7.5], "water": "medium",
     "durationDays": 120, "costPerAcre": 16000, "yieldKgPerAcre": 1600, "pricePerKg": 23, "demand": "high"},
    {"name": "Chickpea (Chana)", "season": "rabi", "phRange": [6.0, 7.5], "water": "low",
     "durationDays": 100, "costPerAcre": 11000, "yieldKgPerAcre": 500, "pricePerKg": 58, "demand": "high"},
    {"name": "Mustard", "season": "rabi", "phRange": [6.0, 7.5], "water": "low",
     "durationDays": 110, "costPerAcre": 9000, "yieldKgPerAcre": 600, "pricePerKg": 52, "demand": "medium"},
]

WATER_COMPAT = {
    "low": {"low": 1.0, "medium": 0.6, "high": 0.2},
    "medium": {"low": 0.8, "medium": 1.0, "high": 0.6},
    "high": {"low": 0.6, "medium": 0.8, "high": 1.0},
}


def get_crop_meta(crop_name):
    for c in CROPS:
        if c["name"].lower().startswith(crop_name.lower()) or crop_name.lower().startswith(c["name"].lower()):
            return c
    return {"name": crop_name.capitalize(), "phRange": [6.0, 7.5], "water": "medium",
            "yieldKgPerAcre": 1000, "costPerAcre": 15000, "pricePerKg": 25, "durationDays": 100}


def check_image_quality(img_array):
    """Checks blur and brightness of an RGB image array (OpenCV, unit 6 CNN preprocessing).

    Requires OpenCV (cv2). If OpenCV is not installed, this raises a clear
    RuntimeError rather than crashing the whole application at import time.
    The current live disease-detection flow does not call this function.
    """
    if cv2 is None:
        raise RuntimeError(
            "OpenCV (cv2) is required for check_image_quality() but is not installed. "
            "Install it with 'pip install opencv-python' to enable local image-quality checks."
        )
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
    blur_score = cv2.Laplacian(gray, cv2.CV_64F).var()
    avg_brightness = np.mean(gray)

    issues = []
    if blur_score < 50:
        issues.append(f"Image might be blurry (score: {blur_score:.1f} < 50)")
    if avg_brightness < 30:
        issues.append(f"Image is too dark (brightness: {avg_brightness:.1f})")
    elif avg_brightness > 225:
        issues.append(f"Image is too bright (brightness: {avg_brightness:.1f})")

    return len(issues) == 0, issues


def extract_section(text, label):
    """Extract the value after a label like 'Irrigation: ...' up to next label or end."""
    pattern = rf"^{re.escape(label)}:\s*(.+?)(?=\n[A-Z][^\n]+:|$)"
    m = re.search(pattern, text, re.MULTILINE | re.DOTALL)
    return m.group(1).strip() if m else ""
