"""Recuperador vectorial: embeddings normalizados y FAISS con producto interno (similitud coseno)."""
import json
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from config import INDEX_DIR, EMBEDDER

# bge necesita un prefijo en la consulta; los demás modelos no
PREFIJOS = {"BAAI/bge-small-en-v1.5": "Represent this sentence for searching relevant passages: "}


class Retriever:
    def __init__(self, docs, embedder=EMBEDDER, device=None, vectores=None):
        self.docs = docs  # lista de dicts con id, fuente y texto
        self.embedder = embedder
        self.model = SentenceTransformer(embedder, device=device)
        if vectores is None:
            vectores = self.model.encode([d["texto"] for d in docs], batch_size=128,
                                         normalize_embeddings=True, show_progress_bar=True)
        self.vectores = np.asarray(vectores, dtype="float32")
        self.index = faiss.IndexFlatIP(self.vectores.shape[1])  # coseno, porque los vectores son unitarios
        self.index.add(self.vectores)

    def buscar(self, consulta, k=3):
        q = self.model.encode([PREFIJOS.get(self.embedder, "") + consulta], normalize_embeddings=True)
        scores, ids = self.index.search(np.asarray(q, dtype="float32"), k)
        return [{**self.docs[i], "score": float(s)} for s, i in zip(scores[0], ids[0])]

    def guardar(self):
        np.save(INDEX_DIR / "vectores.npy", self.vectores)
        json.dump(self.docs, open(INDEX_DIR / "docs.json", "w"), ensure_ascii=False)
        (INDEX_DIR / "embedder.txt").write_text(self.embedder)

    @classmethod
    def cargar(cls, device=None):
        docs = json.load(open(INDEX_DIR / "docs.json"))
        embedder = (INDEX_DIR / "embedder.txt").read_text().strip()  # el índice recuerda con qué modelo se construyó
        return cls(docs, embedder=embedder, device=device, vectores=np.load(INDEX_DIR / "vectores.npy"))
