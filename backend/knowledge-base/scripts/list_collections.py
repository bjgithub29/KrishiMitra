import os
import chromadb

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(os.path.dirname(BASE_DIR), 'chroma_db')

client = chromadb.PersistentClient(path=DB_PATH)
print([c.name for c in client.list_collections()])
