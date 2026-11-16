"""Construye el corpus, las 50 consultas de evaluación, el índice FAISS y la ablación de recuperación.

Uso: python codes/prepare_data.py [--solo-indice]
"""
import json
import random
import time
from collections import OrderedDict
from datasets import load_dataset
from config import DATA, RESULTS, SEED, N_WIKI, N_MATH, N_CODE, EMBEDDERS_ABLATION
from retriever import Retriever


def corpus_wikiqa():
    """Un documento por título de Wikipedia, con todas sus oraciones en orden."""
    wiki = load_dataset("microsoft/wiki_qa")
    docs = OrderedDict()
    for split in ("train", "validation", "test"):
        for r in wiki[split]:
            oraciones = docs.setdefault(r["document_title"], [])
            if r["answer"] not in oraciones:
                oraciones.append(r["answer"])
    ids = {t: f"wiki_{i}" for i, t in enumerate(docs)}
    corpus = [{"id": ids[t], "fuente": "wikiqa", "titulo": t, "texto": f"{t}. " + " ".join(o)}
              for t, o in docs.items()]
    return corpus, ids, wiki


def corpus_gsm8k():
    """Problemas resueltos de GSM8K train como ejemplos de razonamiento."""
    gsm = load_dataset("openai/gsm8k", "main")
    corpus = [{"id": f"gsm8k_{i}", "fuente": "gsm8k", "titulo": r["question"][:60],
               "texto": f"Problem: {r['question']}\nWorked solution: {r['answer']}"}
              for i, r in enumerate(gsm["train"])]
    return corpus, gsm


def corpus_mbpp():
    """Programas de MBPP (train, validation y prompt) como ejemplos de código."""
    mbpp = load_dataset("google-research-datasets/mbpp", "full")
    corpus = [{"id": f"mbpp_{r['task_id']}", "fuente": "mbpp", "titulo": r["text"][:60],
               "texto": f"Task: {r['text']}\nSolution:\n{r['code']}"}
              for s in ("train", "validation", "prompt") for r in mbpp[s]]
    return corpus, mbpp


def consultas_eval(ids_wiki, wiki, gsm, mbpp):
    rng = random.Random(SEED)
    # WikiQA test: preguntas con al menos una oración correcta
    pos = OrderedDict()
    for r in wiki["test"]:
        if r["label"] == 1:
            pos.setdefault(r["question_id"], {"q": r["question"], "t": r["document_title"], "a": []})["a"].append(r["answer"])
    wiki_q = [{"id": f"wiki_q{i}", "tipo": "wiki", "pregunta": v["q"], "doc_oro": ids_wiki[v["t"]],
               "respuesta_oro": " ".join(v["a"])} for i, v in enumerate(pos.values())]
    math_q = [{"id": f"math_q{i}", "tipo": "math", "pregunta": r["question"],
               "respuesta_oro": r["answer"].split("####")[-1].strip().replace(",", "")}
              for i, r in enumerate(gsm["test"])]
    code_q = [{"id": f"code_q{r['task_id']}", "tipo": "code",
               "pregunta": r["text"] + "\nYour code must pass these tests:\n" + "\n".join(r["test_list"]),
               "tests": r["test_list"], "setup": r["test_setup_code"], "respuesta_oro": r["code"]}
              for r in mbpp["test"]]
    return rng.sample(wiki_q, N_WIKI) + rng.sample(math_q, N_MATH) + rng.sample(code_q, N_CODE), wiki_q


def ablacion_recuperacion(corpus, preguntas_wiki, ks=(1, 3, 5, 10)):
    """Acierto en k (hit at k) del documento correcto de WikiQA para cada modelo de embeddings."""
    filas = []
    for emb in EMBEDDERS_ABLATION:
        t0 = time.time()
        r = Retriever(corpus, embedder=emb)
        t_index = time.time() - t0
        t0 = time.time()
        recuperados = [[d["id"] for d in r.buscar(q["pregunta"], k=max(ks))] for q in preguntas_wiki]
        t_query = (time.time() - t0) / len(preguntas_wiki)
        fila = {"embedder": emb, "dim": r.vectores.shape[1], "seg_indexar": t_index, "ms_por_consulta": 1000 * t_query}
        for k in ks:
            fila[f"hit@{k}"] = sum(q["doc_oro"] in rec[:k] for q, rec in zip(preguntas_wiki, recuperados)) / len(preguntas_wiki)
        print(fila)
        filas.append(fila)
    json.dump(filas, open(RESULTS / "ablacion_recuperacion.json", "w"), indent=2)


if __name__ == "__main__":
    import sys
    solo_indice = "--solo-indice" in sys.argv  # reconstruye el índice con config.EMBEDDER sin repetir la ablación
    c_wiki, ids_wiki, wiki = corpus_wikiqa()
    c_gsm, gsm = corpus_gsm8k()
    c_mbpp, mbpp = corpus_mbpp()
    corpus = c_wiki + c_gsm + c_mbpp
    print(f"Corpus: {len(c_wiki)} WikiQA, {len(c_gsm)} GSM8K, {len(c_mbpp)} MBPP")

    consultas, todas_wiki = consultas_eval(ids_wiki, wiki, gsm, mbpp)
    json.dump(consultas, open(DATA / "consultas_eval.json", "w"), ensure_ascii=False, indent=2)
    print("Consultas de evaluación:", len(consultas))

    Retriever(corpus).guardar()  # índice principal con config.EMBEDDER
    if not solo_indice:
        ablacion_recuperacion(corpus, todas_wiki)
