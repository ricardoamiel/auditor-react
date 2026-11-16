"""Configuración central del proyecto: rutas, modelos y constantes."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RESULTS = ROOT / "results"
FIGURES = ROOT / "figures"
INDEX_DIR = DATA / "index"
for d in (DATA, RESULTS, FIGURES, INDEX_DIR):
    d.mkdir(parents=True, exist_ok=True)

# Modelos abiertos (no requieren token de Hugging Face)
LLM_7B = "Qwen/Qwen2.5-7B-Instruct"
LLM_15B = "Qwen/Qwen2.5-1.5B-Instruct"
JUDGE = "microsoft/phi-4"
EMBEDDER = "sentence-transformers/all-MiniLM-L6-v2"  # ganador de la ablación: casi igual a bge con la mitad de latencia
EMBEDDERS_ABLATION = [
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",  # el del laboratorio 14
    "sentence-transformers/all-MiniLM-L6-v2",
    "BAAI/bge-small-en-v1.5",
]

SEED = 42
TOP_K = 3              # documentos devueltos por buscar_kb
MAX_PASOS_REACT = 6    # pasos máximos Thought, Action, Observation por intento
MAX_RECHAZOS = 2       # veces que el Auditor puede devolver el flujo
N_WIKI, N_MATH, N_CODE = 20, 15, 15  # 50 consultas de evaluación

IN_COLAB = "COLAB_RELEASE_TAG" in os.environ
