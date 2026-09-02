import json
import chromadb
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KB_ROOT = os.path.dirname(BASE_DIR)  # knowledge-base/
DB_PATH = os.path.join(KB_ROOT, 'chroma_db')
TIMELINE_KB_PATH = os.path.join(KB_ROOT, 'data', 'timeline_kb.json')

# Initialize ChromaDB client pointing to the existing folder
chroma_client = chromadb.PersistentClient(path=DB_PATH)
from chromadb.utils import embedding_functions
ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

try:
    chroma_client.delete_collection("timeline_kb")
except Exception:
    pass

timeline_collection = chroma_client.create_collection(name="timeline_kb", embedding_function=ef)

print("Ingesting timeline_kb.json into ChromaDB...")
with open(TIMELINE_KB_PATH, 'r') as f:
    kb = json.load(f)

docs = []
metadatas = []
ids = []

for item in kb:
    docs.append(item['document'])
    metadatas.append(item['metadata'])
    ids.append(item['id'])

# ChromaDB recommends batching for large datasets, but 150 items is small enough
timeline_collection.add(
    documents=docs,
    metadatas=metadatas,
    ids=ids
)
print(f"Ingested {len(kb)} items into timeline_kb collection.")
