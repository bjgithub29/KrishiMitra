import os
import logging
import threading
import joblib
import pandas as pd
from django.conf import settings

logger = logging.getLogger("core.services.yield")

MODEL_PATH = os.path.join(
    settings.BASE_DIR,
    "krishi_core",
    "ml_models",
    "artifacts",
    "crop_yield_model.pkl",
)


class CropYieldPredictionService:

    def __init__(self):
        self.model = None
        # Internal state flag: True only when the model artifact loaded OK.
        self._loaded = False
        self._lock = threading.Lock()

    def _ensure_loaded(self):
        """Thread-safe lazy loader called on first access."""
        if not self._loaded:
            with self._lock:
                if not self._loaded:
                    self._load_model()

    def _load_model(self):
        """Load the model artifact if it exists.

        A missing or unreadable artifact is logged and leaves the service in an
        'unavailable' state, rather than raising during import (which would
        crash Django startup). When a valid artifact is later supplied, loading
        succeeds and behavior is identical to before.
        """
        try:
            self.model = joblib.load(MODEL_PATH)
            self._loaded = True
            logger.info("Crop yield model loaded successfully.")
        except Exception as e:
            logger.error(
                f"Crop yield model unavailable (could not load {MODEL_PATH}): {e}"
            )

    def predict(self, data):
        self._ensure_loaded()
        if not self._loaded or self.model is None:
            return "N/A (Model unavailable)"

        features = pd.DataFrame([{
            "Crop": data["Crop"],
            "Crop_Year": data["Crop_Year"],
            "Season": data["Season"],
            "State": data["State"],
            "Area": data["Area"],
            "Annual_Rainfall": data["Annual_Rainfall"],
            "Fertilizer": data["Fertilizer"],
            "Pesticide": data["Pesticide"],
        }])

        prediction = self.model.predict(features)[0]

        return round(float(prediction), 2)


yield_service = CropYieldPredictionService()
