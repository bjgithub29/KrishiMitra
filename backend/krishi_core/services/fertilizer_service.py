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

        features = pd.DataFrame([{
            "Soil_Type": data["Soil_Type"],
            "Crop_Type": data["Crop_Type"],
            "Crop_Growth_Stage": data["Crop_Growth_Stage"],
            "Season": data["Season"],
            "Irrigation_Type": data["Irrigation_Type"],
            "Previous_Crop": data["Previous_Crop"],
            "Region": data["Region"],
            "Soil_pH": data["Soil_pH"],
            "Soil_Moisture": data["Soil_Moisture"],
            "Organic_Carbon": data["Organic_Carbon"],
            "Electrical_Conductivity": data["Electrical_Conductivity"],
            "Nitrogen_Level": data["Nitrogen_Level"],
            "Phosphorus_Level": data["Phosphorus_Level"],
            "Potassium_Level": data["Potassium_Level"],
            "Temperature": data["Temperature"],
            "Humidity": data["Humidity"],
            "Rainfall": data["Rainfall"],
            "Fertilizer_Used_Last_Season": data["Fertilizer_Used_Last_Season"],
            "Yield_Last_Season": data["Yield_Last_Season"],
        }])

        prediction = self.model.predict(features)[0]

        fertilizer = self.encoder.inverse_transform([prediction])[0]

        return fertilizer


fertilizer_service = FertilizerRecommendationService()
