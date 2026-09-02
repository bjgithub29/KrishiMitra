import logging
from .prompt_builder import prompt_builder
from .llm_service import llm_service
from .rag_retriever import rag_retriever

logger = logging.getLogger(__name__)

class DecisionEngine:
    def generate_recommendation(self, user_query: str, ml_predictions: dict, weather: dict = None, history: dict = None) -> dict:
        crop = ml_predictions.get('recommended_crop', 'Unknown Crop')
        fertilizer = ml_predictions.get('recommended_fertilizer', '')
        irrigation = ml_predictions.get('irrigation_need', '')
        yield_val = ml_predictions.get('predicted_yield', '')

        search_query = f"Crop: {crop}. Information specifically about {crop} farming, {crop} diseases, {crop} {fertilizer} fertilizer usage, {crop} {irrigation} irrigation, and {crop} yield of {yield_val}."
        if user_query:
            search_query += f" Specific user question regarding {crop}: {user_query}"

        rag_context = rag_retriever.search(search_query, k=5, target_crop=crop)

        prompt = prompt_builder.build(
            user_query=user_query,
            ml_predictions=ml_predictions,
            weather=weather,
            history=history,
            rag_context=rag_context
        )

        response = llm_service.generate_response(prompt)
        return response

decision_engine = DecisionEngine()
