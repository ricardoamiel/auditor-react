"""LLM as a Judge con las definiciones de RAGAS (Es et al., 2023), usando Phi 4 como juez de otra familia.

Faithfulness: fracción de afirmaciones de la respuesta que se deducen de la pregunta o del contexto recuperado
(primero se extraen las afirmaciones viendo solo la respuesta, luego se verifican).
Answer Relevance: similitud coseno media entre la pregunta original y 3 preguntas que el juez genera desde la respuesta.
Corrección (solo WikiQA): el juez compara la respuesta con la oración correcta del dataset.

Uso: python codes/judge.py [--seguir]
"""
import subprocess
import sys
import time
import json
import re
import numpy as np
import torch
from sentence_transformers import SentenceTransformer
from config import DATA, RESULTS, JUDGE, EMBEDDER
from llm import LLM

# Prompts del juez en inglés, el idioma de los datasets, para que las preguntas generadas sean comparables
P_CLAIMS = """Split the ANSWER into short atomic claims, one fact per line, without numbering.
Ignore greetings, source citations and code. If the answer only contains code, write NONE."""

P_VERIF = """For each numbered CLAIM decide whether it can be inferred from the QUESTION or the CONTEXT.
Answer with one line per claim in the same order, using the format: number. YES or number. NO"""

P_RELEV = """Write 3 different questions in English that the given ANSWER answers, one per line, without numbering."""

P_CORR = """You grade answers to factual questions. The REFERENCE is a Wikipedia sentence that answers the QUESTION.
Is the ANSWER correct, meaning it gives the same essential answer as the reference or an equivalent correct answer?
Shorter answers and extra correct details are fine. Reply only YES or NO."""


def faithfulness(juez, pregunta, contexto, respuesta):
    """Dos pasos como en RAGAS: extraer afirmaciones solo de la respuesta y luego verificarlas contra el contexto."""
    claims = juez.chat([{"role": "system", "content": P_CLAIMS},
                        {"role": "user", "content": f"ANSWER:\n{respuesta}"}], max_new_tokens=300)
    claims = [c.strip(" -*") for c in claims.splitlines() if c.strip() and c.strip().upper() != "NONE"][:15]
    if not claims:
        return None, ""
    lista = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(claims))
    texto = juez.chat([{"role": "system", "content": P_VERIF},
                       {"role": "user", "content": f"QUESTION:\n{pregunta}\n\nCONTEXT:\n{contexto}\n\nCLAIMS:\n{lista}"}],
                      max_new_tokens=8 * len(claims) + 10)
    votos = re.findall(r"^\s*\d+\.\s*(YES|NO)", texto, re.M | re.I)[: len(claims)]
    if not votos:
        return None, lista + "\n" + texto
    return sum(v.upper() == "YES" for v in votos) / len(claims), lista + "\n" + texto


def answer_relevance(juez, emb, pregunta, respuesta):
    texto = juez.chat([{"role": "system", "content": P_RELEV},
                       {"role": "user", "content": f"ANSWER:\n{respuesta}"}], max_new_tokens=150)
    preguntas = [l.strip(" .0123456789)") for l in texto.splitlines() if l.strip()][:3]
    if not preguntas:
        return 0.0, texto
    v = emb.encode([pregunta] + preguntas, normalize_embeddings=True)
    return float(np.mean(v[1:] @ v[0])), texto


def correccion(juez, pregunta, respuesta, referencia):
    texto = juez.chat([{"role": "system", "content": P_CORR},
                       {"role": "user", "content": f"QUESTION:\n{pregunta}\n\nREFERENCE:\n{referencia}\n\nANSWER:\n{respuesta}"}], max_new_tokens=5)
    return texto.strip().upper().startswith("Y")


def evaluar_pendientes(juez, emb, consultas, orden, carpeta=RESULTS):
    """Evalúa las respuestas que aún no tienen juicio; devuelve cuántas evaluó."""
    n = 0
    for s in orden:
        ruta, salida = carpeta / f"respuestas_{s}.jsonl", carpeta / f"juez_{s}.jsonl"
        if not ruta.exists():
            continue
        hechas = {json.loads(l)["id"] for l in open(salida)} if salida.exists() else set()
        for l in open(ruta):
            r = json.loads(l)
            if r["id"] in hechas:
                continue
            q = consultas[r["id"]]
            contexto = "\n\n".join(r["contextos"])[:12000]  # desde el inicio: la primera observación suele ser la base local
            fiel, t_fiel = faithfulness(juez, q["pregunta"], contexto, r["respuesta"])
            relev, t_relev = answer_relevance(juez, emb, q["pregunta"], r["respuesta"])
            fila = {"id": r["id"], "sistema": r["sistema"], "tipo": r["tipo"], "faithfulness": fiel,
                    "answer_relevance": relev, "juez_fiel": t_fiel, "juez_relev": t_relev}
            if q["tipo"] == "wiki":
                fila["correcto"] = correccion(juez, q["pregunta"], r["respuesta"], q["respuesta_oro"])
            with open(salida, "a") as f:
                f.write(json.dumps(fila, ensure_ascii=False) + "\n")
            print(r["sistema"], r["id"], fiel, round(relev, 3), fila.get("correcto"), flush=True)
            n += 1
    return n


if __name__ == "__main__":
    multisalto = "--multisalto" in sys.argv  # juzga las 50 consultas multisalto en results/multisalto
    archivo, carpeta = ("consultas_multisalto.json", RESULTS / "multisalto") if multisalto else ("consultas_eval.json", RESULTS)
    consultas = {q["id"]: q for q in json.load(open(DATA / archivo))}
    juez = LLM(JUDGE, cuatro_bits=torch.cuda.mem_get_info()[0] < 35e9)  # bf16 si hay 35 GB libres
    emb = SentenceTransformer(EMBEDDER, device="cuda")
    orden = ["multi_7b", "naive_7b", "multi_sin_auditor_7b", "multi_1.5b", "naive_1.5b"]  # prioridad
    seguir = "--seguir" in sys.argv  # evalúa mientras la generación sigue corriendo y termina cuando ella termina
    while True:
        generando = seguir and subprocess.run(["pgrep", "-f", "run_eval.py"], capture_output=True).returncode == 0
        nuevas = evaluar_pendientes(juez, emb, consultas, orden, carpeta)
        if not generando and not nuevas:
            break
        if nuevas == 0:
            time.sleep(30)
