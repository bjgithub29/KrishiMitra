import os
import logging
import joblib
import pandas as pd
from django.conf import settings

logger = logging.getLogger("core.services.fertilizer")

# Correct absolute paths to the model artifacts
MODEL_DIR = os.path.join(settings.BASE_DIR, "krishi_core", "ml_models", "artifacts")
MODEL_PATH = os.path.join(MODEL_DIR, "fertilizer_model.pkl")
PREPROCESSOR_PATH = os.path.join(MODEL_DIR, "fertilizer_feature_preprocessor.pkl")
LABEL_ENCODER_PATH = os.path.join(MODEL_DIR, "fertilizer_label_encoder.pkl")


class FertilizerRecommendationService:

    def __init__(self):
        self.model = None
        self.encoder = None
        # Internal state flag: True only when the model artifacts loaded OK.
        self._loaded = False
        self._load_models()

    def _load_models(self):
        """Load the model + label encoder if the artifacts exist.

        Missing or unreadable artifacts are logged and leave the service in an
        'unavailable' state, rather than raising during import (which would
        crash Django startup). When valid artifacts are later supplied, loading
        succeeds and behavior is identical to before.
        """
        try:
            self.model = joblib.load(MODEL_PATH)
            self.encoder = joblib.load(LABEL_ENCODER_PATH)
            self._loaded = True
            logger.info("Fertilizer model loaded successfully.")
        except Exception as e:
            logger.error(
                f"Fertilizer model unavailable (could not load from {MODEL_DIR}): {e}"
            )

    def predict(self, data):
        if not self._loaded or self.model is None:
            return "N/A (Model unavailable)"

        try:
            features = pd.DataFrame([{
                "Soil_Type": data.get("Soil_Type", "Black"),
                "Crop_Type": data.get("Crop_Type", "Wheat"),
                "Crop_Growth_Stage": data.get("Crop_Growth_Stage", "Pre-emergence"),
                "Season": data.get("Season", "Kharif"),
                "Irrigation_Type": data.get("Irrigation_Type", "Drip"),
                "Previous_Crop": data.get("Previous_Crop", "Fallow"),
                "Region": data.get("Region", "Maharashtra"),
                "Soil_pH": float(data.get("Soil_pH", 6.5)),
                "Soil_Moisture": float(data.get("Soil_Moisture", 40.0)),
                "Organic_Carbon": float(data.get("Organic_Carbon", 0.5)),
                "Electrical_Conductivity": float(data.get("Electrical_Conductivity", 0.4)),
                "Nitrogen_Level": float(data.get("Nitrogen_Level", 50.0)),
                "Phosphorus_Level": float(data.get("Phosphorus_Level", 30.0)),
                "Potassium_Level": float(data.get("Potassium_Level", 40.0)),
                "Temperature": float(data.get("Temperature", data.get("Temperature_C", 25.0))),
                "Humidity": float(data.get("Humidity", 60.0)),
                "Rainfall": float(data.get("Rainfall", data.get("Rainfall_mm", 100.0))),
                "Fertilizer_Used_Last_Season": data.get("Fertilizer_Used_Last_Season", "Urea"),
                "Yield_Last_Season": float(data.get("Yield_Last_Season", 2.5)),
            }])

            prediction = self.model.predict(features)[0]
            fertilizer = self.encoder.inverse_transform([prediction])[0]
            return fertilizer
        except Exception as e:
            logger.error("Fertilizer prediction failed: %s", e)
            return "N/A (Model unavailable)"


fertilizer_service = FertilizerRecommendationService()
