"""Genera las respuestas de cada sistema sobre las 50 consultas y calcula las métricas objetivas.

Uso: python codes/run_eval.py --modelo 7b --sistemas naive multi multi_sin_auditor
Cada respuesta se guarda al terminar, así un job interrumpido continúa donde quedó.
"""
import argparse
import json
import time
import torch
import tools
from agents import construir_grafo, estado_inicial, naive_rag, extraer_codigo, extraer_numero, pasa_tests
from config import DATA, RESULTS, LLM_7B, LLM_15B
from llm import LLM
from retriever import Retriever


def metrica_tarea(q, respuesta, docs):
    """Métricas objetivas: acierto de recuperación (wiki), exactitud (math) y tests aprobados (code)."""
    if q["tipo"] == "wiki":
        return {"hit_doc_oro": q["doc_oro"] in docs}
    if q["tipo"] == "multihop":  # número exacto y si se recuperaron los dos documentos necesarios
        pred = extraer_numero(respuesta)
        ok = pred.lstrip("-") == q["respuesta_oro"]
        return {"pred": pred, "correcto": ok, "ambos_docs": all(d in docs for d in q["docs_oro"])}
    if q["tipo"] == "math":
        pred = extraer_numero(respuesta)
        try:
            ok = abs(float(pred) - float(q["respuesta_oro"])) < 1e-6
        except ValueError:
            ok = False
        return {"pred": pred, "correcto": ok}
    ok, _ = pasa_tests(extraer_codigo(respuesta), q["pregunta"], q.get("setup", ""))
    return {"correcto": ok}


def correr(sistema, llm, consultas, carpeta=RESULTS):
    carpeta.mkdir(exist_ok=True)
    ruta = carpeta / f"respuestas_{sistema}.jsonl"
    hechas = {json.loads(l)["id"] for l in open(ruta)} if ruta.exists() else set()
    grafo = None if sistema.startswith("naive") else construir_grafo(llm, con_auditor="sin_auditor" not in sistema)
    for q in consultas:
        if q["id"] in hechas:
            continue
        llm.reiniciar_contadores()
        t0 = time.time()
        if grafo is None:
            r = naive_rag(llm, q["pregunta"])
            fila = {"respuesta": r["respuesta"], "contextos": r["contextos"], "docs": r["docs"], "traza": []}
        else:
            tiempo_nodo, t = {}, time.time()
            for s in grafo.stream(estado_inicial(q["pregunta"]), {"recursion_limit": 60}, stream_mode="values"):
                if s["traza"]:  # cada estado emitido corresponde al nodo que acaba de terminar
                    n = s["traza"][-1]["nodo"]
                    tiempo_nodo[n] = tiempo_nodo.get(n, 0) + time.time() - t
                t = time.time()
            docs = [d["id"] for e in s["traza"] for d in e.get("docs", []) if d.get("id")]
            fila = {"respuesta": s["respuesta"], "contextos": s["contextos"], "docs": docs, "traza": s["traza"],
                    "rechazos": s["rechazos"], "pasos": len(s["pasos"]), "segundos_nodo": tiempo_nodo}
        fila.update({"id": q["id"], "tipo": q["tipo"], "sistema": sistema, "segundos": time.time() - t0,
                     "llamadas_llm": llm.llamadas, "tokens_in": llm.tokens_in, "tokens_out": llm.tokens_out,
                     **metrica_tarea(q, fila["respuesta"], fila["docs"])})
        with open(ruta, "a") as f:
            f.write(json.dumps(fila, ensure_ascii=False) + "\n")
        print(f"{sistema} {q['id']} {fila['segundos']:.1f}s llamadas={llm.llamadas} "
              f"correcto={fila.get('correcto', fila.get('hit_doc_oro'))}", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--modelo", choices=["7b", "1.5b"], default="7b")
    ap.add_argument("--sistemas", nargs="+", default=["naive", "multi", "multi_sin_auditor"])
    ap.add_argument("--n", type=int, default=None, help="limitar consultas para una prueba rápida")
    ap.add_argument("--consultas", default="consultas_eval.json", help="archivo de consultas dentro de data/")
    ap.add_argument("--carpeta", default="", help="subcarpeta de results/ para guardar las respuestas")
    a = ap.parse_args()
    consultas = json.load(open(DATA / a.consultas))
    if a.n:  # prueba corta: a.n consultas de cada tipo
        consultas = [q for t in ("wiki", "math", "code") for q in [c for c in consultas if c["tipo"] == t][: a.n]]
    tools.RETRIEVER = Retriever.cargar(device="cuda" if torch.cuda.is_available() else "cpu")
    llm = LLM(LLM_7B if a.modelo == "7b" else LLM_15B)
    for s in a.sistemas:
        correr(f"{s}_{a.modelo}", llm, consultas, RESULTS / ("prueba" if a.n else a.carpeta))
