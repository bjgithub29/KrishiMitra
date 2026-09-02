import os
import logging
from krishi_core import ml_loader

logger = logging.getLogger(__name__)

class RAGRetriever:
    def search(self, query: str, k: int = 5, target_crop: str = "") -> str:
        collection = ml_loader.state.get("collection")
        if not collection:
            logger.warning("Vector store not initialized. Returning empty context.")
            return ""

        try:
            # Query chroma directly
            res = collection.query(query_texts=[query], n_results=k)
            if not res.get("documents") or not res["documents"][0]:
                return ""
                
            docs = res["documents"][0]
            metadatas = res.get("metadatas", [[]])[0]
            
            filtered_docs = []
            if target_crop:
                target_lower = target_crop.lower().strip()
                CROP_ALIASES = {
                    "rice": ["rice", "paddy"],
                    "maize": ["maize", "corn"],
                    "groundnut": ["groundnut", "peanut"],
                    "cotton": ["cotton", "kapas"],
                    "wheat": ["wheat"],
                    "coffee": ["coffee"],
                    "soybean": ["soybean", "soya"],
                    "tomato": ["tomato"]
                }
                aliases = CROP_ALIASES.get(target_lower, [target_lower])
                if target_lower not in aliases:
                    aliases.append(target_lower)
                    
                for idx, doc_content in enumerate(docs):
                    doc_content_lower = doc_content.lower()
                    if any(alias in doc_content_lower for alias in aliases):
                        filtered_docs.append((doc_content, metadatas[idx] if idx < len(metadatas) else {}))
            else:
                for idx, doc_content in enumerate(docs):
                    filtered_docs.append((doc_content, metadatas[idx] if idx < len(metadatas) else {}))
                    
            if not filtered_docs:
                logger.info(f"All chunks filtered out. No relevant info found for crop: {target_crop}")
                return ""
                
            context_parts = []
            for i, (doc, meta) in enumerate(filtered_docs):
                source = meta.get("source", "Unknown Source") if meta else "Unknown Source"
                context_parts.append(f"[Source {i+1}: {os.path.basename(source)}]\n{doc}\n")
                
            return "\n".join(context_parts)
        except Exception as e:
            logger.error(f"Error during semantic search: {str(e)}")
            return ""

rag_retriever = RAGRetriever()
