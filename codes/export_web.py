"""Exporta un índice reducido para la aplicación web: textos y embeddings cuantizados a int8.

Uso: python codes/export_web.py   (después de prepare_data.py)
"""
import base64
import json
import random
import numpy as np
from config import INDEX_DIR, ROOT, SEED

N_GSM8K_WEB = 1500  # subconjunto de problemas resueltos para que el sitio cargue rápido

docs = json.load(open(INDEX_DIR / "docs.json"))
vec = np.load(INDEX_DIR / "vectores.npy")
idx_gsm = [i for i, d in enumerate(docs) if d["fuente"] == "gsm8k"]
keep = set(random.Random(SEED).sample(idx_gsm, N_GSM8K_WEB))
sel = [i for i, d in enumerate(docs) if d["fuente"] != "gsm8k" or i in keep]

q = np.clip(np.round(vec[sel] * 127), -127, 127).astype(np.int8)  # vectores unitarios: cada componente en [-1, 1]
salida = {
    "embedder": (INDEX_DIR / "embedder.txt").read_text().strip().split("/")[-1],
    "dim": int(q.shape[1]),
    "docs": [{"id": docs[i]["id"], "f": docs[i]["fuente"], "t": docs[i]["titulo"], "x": docs[i]["texto"][:800]} for i in sel],
    "vec": base64.b64encode(q.tobytes()).decode(),
}
ruta = ROOT / "app" / "data" / "kb.json"
json.dump(salida, open(ruta, "w"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(sel)} documentos exportados a {ruta} ({ruta.stat().st_size / 1e6:.1f} MB)")
