"""
Crop-recommendation inference service.

Wraps the recovered scikit-learn artifact
``krishi_core/ml_models/artifacts/best_model.joblib`` — a *complete* Pipeline
(``ColumnTransformer`` [numeric passthrough + OneHotEncoder(handle_unknown='ignore')]
-> ``RandomForestClassifier``) trained on the public Kaggle "Crop Recommendation"
dataset (22 crop classes), augmented with ``season`` and ``state`` categorical
inputs. The Pipeline is self-contained: it one-hot-encodes ``season``/``state``
internally, so callers pass raw feature values — no separate preprocessing.

Design mirrors ``yield_service.py``: the model is loaded once at import; a
missing/unreadable artifact leaves the service in an "unavailable" state
(logged, never raises) so Django startup and the heuristic fallback are
unaffected.

IMPORTANT: this service NEVER invents feature values. ``recommend()`` expects
all nine features to be present and real; the caller is responsible for
sourcing them legitimately and for falling back to the heuristic when any are
missing.
"""
import os
import logging
import threading

import joblib
import pandas as pd
from django.conf import settings

logger = logging.getLogger("core.services.crop_recommendation")

MODEL_PATH = os.path.join(
    settings.BASE_DIR,
    "krishi_core",
    "ml_models",
    "artifacts",
    "best_model.joblib",
)

# Exact feature names/order the Pipeline was fitted with (``feature_names_in_``).
FEATURES = [
    "N", "P", "K",
    "temperature_C", "humidity_pct", "ph", "rainfall_mm",
    "season", "state",
]

# ---------------------------------------------------------------------------
# Categorical normalisation to the tokens the OneHotEncoder actually learned.
# Unknown tokens are NOT an error: handle_unknown='ignore' degrades them to an
# all-zero one-hot row (safe, but that feature then carries no signal).
# ---------------------------------------------------------------------------

# App season strings (kharif / rabi / zaid) -> training season tokens.
_SEASON_ALIAS = {
    "kharif": "Kharif",
    "rabi": "Rabi",
    "zaid": "Summer",     # zaid == the summer cropping season in India
    "summer": "Summer",
    "annual": "Annual",
    "kharif/rabi": "Kharif/Rabi",
    "rabi/kharif": "Rabi/Kharif",
    "kharif/summer": "Kharif/Summer",
}

# Full state names (as returned by Nominatim geocoding) -> the compact tokens
# used in training (verified from prediction_results.csv):
#   Karnataka, Maharashtra, Gujarat, UP, Rajasthan, MP, TamilNadu, Punjab,
#   WestBengal, Bihar, AndhraPradesh, Uttarakhand, HimachalPradesh, Haryana,
#   JammuKashmir, Telangana
_STATE_MAP = {
    "uttar pradesh": "UP",
    "madhya pradesh": "MP",
    "tamil nadu": "TamilNadu",
    "west bengal": "WestBengal",
    "andhra pradesh": "AndhraPradesh",
    "himachal pradesh": "HimachalPradesh",
    "jammu and kashmir": "JammuKashmir",
    "jammu & kashmir": "JammuKashmir",
    # single-word states are already in the trained form:
    "karnataka": "Karnataka",
    "maharashtra": "Maharashtra",
    "gujarat": "Gujarat",
    "rajasthan": "Rajasthan",
    "punjab": "Punjab",
    "bihar": "Bihar",
    "uttarakhand": "Uttarakhand",
    "haryana": "Haryana",
    "telangana": "Telangana",
}


def canonical_season(app_season):
    """Map an app season string to the training season token.

    Returns None for empty input. Unknown values are Title-cased and passed
    through (encoder ignores them safely).
    """
    if not app_season:
        return None
    key = str(app_season).strip().lower()
    if not key:
        return None
    return _SEASON_ALIAS.get(key, key.title())


def normalize_state_token(raw_state):
    """Map a (possibly full-name) state string to the encoder's token.

    Returns None for empty input. Unknown states are stripped and passed
    through (encoder ignores them safely) rather than guessed.
    """
    if not raw_state:
        return None
    s = str(raw_state).strip()
    if not s:
        return None
    return _STATE_MAP.get(s.lower(), s)


class CropRecommendationService:

    def __init__(self):
        self.model = None
        self._loaded = False
        self._lock = threading.Lock()

    def _ensure_loaded(self):
        """Thread-safe lazy loader called on first access."""
        if not self._loaded:
            with self._lock:
                if not self._loaded:
                    self._load_model()

    def _load_model(self):
        """Load the artifact once. A missing/unreadable file leaves the
        service unavailable (logged), never raising at import time."""
        try:
            self.model = joblib.load(MODEL_PATH)
            self._loaded = True
            logger.info(
                "Crop recommendation model loaded (classes=%s).",
                len(getattr(self.model, "classes_", [])),
            )
        except Exception as e:
            logger.error(
                f"Crop recommendation model unavailable "
                f"(could not load {MODEL_PATH}): {e}"
            )

    def is_available(self):
        self._ensure_loaded()
        return self._loaded and self.model is not None

    def recommend(self, data, top_n=5):
        """Rank crops for one real feature row.

        ``data`` must contain every key in ``FEATURES`` with a real value.
        Returns a list of ``{"crop": str, "confidence": float|None}`` ordered
        by descending probability, or ``None`` if the model is unavailable.

        No feature is defaulted here: a missing key raises ``KeyError`` by
        design, so an incomplete row can never be silently scored.
        """
        if not self.is_available():
            return None

        row = {k: data[k] for k in FEATURES}          # KeyError if incomplete — intentional
        X = pd.DataFrame([row], columns=FEATURES)      # exact names/order; Pipeline encodes season/state

        classes = list(self.model.classes_)
        if hasattr(self.model, "predict_proba"):
            proba = self.model.predict_proba(X)[0]
            ranked = sorted(zip(classes, proba), key=lambda t: t[1], reverse=True)
            return [
                {"crop": str(c), "confidence": round(float(p), 4)}
                for c, p in ranked[:top_n]
            ]
        # Estimator without probabilities: return the single predicted label.
        return [{"crop": str(self.model.predict(X)[0]), "confidence": None}]


# Module-level singleton (mirrors yield_service / fertilizer_service / irrigation_service).
crop_recommendation_service = CropRecommendationService()
