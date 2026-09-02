"""
Loads all ML artifacts (ChromaDB collections) exactly once when Django starts.
"""
import os
import sys
import json
import logging

from django.conf import settings

logger = logging.getLogger("core.ml_loader")

# Populated by load_everything(); imported by views.py
state = {
    "chroma_client": None,
    "collection": None,
    "disease_collection": None,
}


def load_everything():
    os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
    base_dir = settings.BASE_DIR.parent

    # ── ChromaDB (RAG knowledge base) ────────────────────────────
    try:
        import chromadb
        from chromadb.utils import embedding_functions
        ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")
        
        chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
        state["chroma_client"] = chroma_client
        collections = chroma_client.list_collections()
        if collections:
            col_names = [c.name for c in collections]
            name = "timeline_kb" if "timeline_kb" in col_names else collections[0].name
            state["collection"] = chroma_client.get_collection(name, embedding_function=ef)
            logger.info("Connected to ChromaDB collection '%s' (%s items)", name, state["collection"].count())
        else:
            logger.warning("No ChromaDB collections found.")

        try:
            state["disease_collection"] = chroma_client.get_collection("disease_treatments_kb", embedding_function=ef)
            logger.info("Loaded disease_collection (%s items)", state["disease_collection"].count())
        except Exception as e:
            logger.warning("Failed to load disease_collection: %s", e)
    except Exception as e:
        logger.error("Failed to load ChromaDB: %s", e)

    # Local CNN models and YOLO dependencies have been removed in favor of Gemini API.
    logger.info("ML loader initialization complete.")
