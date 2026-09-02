import json
import chromadb
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
KB_ROOT = os.path.dirname(BASE_DIR)  # knowledge-base/
DB_PATH = os.path.join(KB_ROOT, 'chroma_db')
WEBSITE_KB_PATH = os.path.join(KB_ROOT, 'data', 'website_kb.json')

# Initialize ChromaDB client
chroma_client = chromadb.PersistentClient(path=DB_PATH)
from chromadb.utils import embedding_functions
ef = embedding_functions.SentenceTransformerEmbeddingFunction(model_name="all-MiniLM-L6-v2")

try:
    chroma_client.delete_collection("website_kb")
except:
    pass

website_collection = chroma_client.create_collection(name="website_kb", embedding_function=ef)

print("Ingesting website_kb.json into ChromaDB...")
with open(WEBSITE_KB_PATH, 'r') as f:
    kb = json.load(f)

docs = []
metadatas = []
ids = []

for item in kb:
    docs.append(item['document'])
    metadatas.append(item['metadata'])
    ids.append(item['id'])

website_collection.add(
    documents=docs,
    metadatas=metadatas,
    ids=ids
)
print(f"Ingested {len(kb)} items into website_kb collection.")
