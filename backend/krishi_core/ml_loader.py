"""
Loads ChromaDB collections lazily on first access.
Uses Chroma's native DefaultEmbeddingFunction (ONNX all-MiniLM-L6-v2) for low memory (<100MB).
"""
import os
import sys
import logging
import threading

from django.conf import settings

logger = logging.getLogger("core.ml_loader")

_init_lock = threading.Lock()
_initialized = False


class LazyState(dict):
    """
    Lazy dictionary proxy that initializes ChromaDB and embedding models
    only when keys ('chroma_client', 'collection', 'disease_collection')
    are accessed at runtime.
    """
    def _ensure_loaded(self):
        global _initialized
        if not _initialized:
            with _init_lock:
                if not _initialized:
                    _init_chroma()
                    _initialized = True

    def __getitem__(self, key):
        self._ensure_loaded()
        return super().__getitem__(key)

    def get(self, key, default=None):
        self._ensure_loaded()
        return super().get(key, default)

    def __contains__(self, key):
        self._ensure_loaded()
        return super().__contains__(key)


state = LazyState({
    "chroma_client": None,
    "collection": None,
    "disease_collection": None,
})


def _init_chroma():
    os.environ["CUDA_VISIBLE_DEVICES"] = "-1"
    try:
        import chromadb
        from chromadb.utils import embedding_functions

        ef = embedding_functions.DefaultEmbeddingFunction()

        chroma_client = chromadb.PersistentClient(path=settings.CHROMA_DB_PATH)
        dict.__setitem__(state, "chroma_client", chroma_client)

        collections = chroma_client.list_collections()
        if collections:
            col_names = [c.name if hasattr(c, "name") else str(c) for c in collections]
            name = "timeline_kb" if "timeline_kb" in col_names else col_names[0]
            try:
                col = chroma_client.get_collection(name, embedding_function=ef)
                dict.__setitem__(state, "collection", col)
                logger.info("Connected to ChromaDB collection '%s' (%s items)", name, col.count())
            except Exception as e:
                logger.warning("Failed to get collection '%s': %s", name, e)
        else:
            logger.warning("No ChromaDB collections found at %s", settings.CHROMA_DB_PATH)

        try:
            disease_col = chroma_client.get_collection("disease_treatments_kb", embedding_function=ef)
            dict.__setitem__(state, "disease_collection", disease_col)
            logger.info("Loaded disease_collection (%s items)", disease_col.count())
        except Exception as e:
            logger.warning("Failed to load disease_collection: %s", e)
    except Exception as e:
        logger.error("Failed to load ChromaDB: %s", e)

    logger.info("ChromaDB lazy initialization complete.")


def load_everything():
    """Backwards compatibility hook: triggers lazy load if called explicitly."""
    state._ensure_loaded()
