"""API opcional para la aplicación web: ejecuta el grafo en Python con Qwen2.5 7B y transmite cada evento.

Uso: python app/server.py   (luego elegir el motor Servidor en la página, URL http://localhost:8000)
En Khipu: sbatch slurm/server.sh y un túnel ssh hacia el nodo (ver README).
"""
import json
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "codes"))

import torch
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import tools
from agents import construir_grafo, estado_inicial, naive_rag
from config import LLM_7B, LLM_15B
from llm import LLM
from retriever import Retriever

grande = torch.cuda.is_available() and torch.cuda.get_device_properties(0).total_memory > 8e9
tools.RETRIEVER = Retriever.cargar()
MODELO = LLM_7B if grande else LLM_15B
llm = LLM(MODELO)
grafos = {"multi": construir_grafo(llm, True), "multi_sin_auditor": construir_grafo(llm, False)}

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def red_privada(request, call_next):
    # Chrome pide este permiso cuando una página publicada (GitHub Pages) llama a localhost
    r = await call_next(request)
    r.headers["Access-Control-Allow-Private-Network"] = "true"
    return r


@app.get("/salud")
def salud():
    return {"modelo": MODELO, "gpu": torch.cuda.get_device_name(0) if torch.cuda.is_available() else "cpu"}


class Consulta(BaseModel):
    pregunta: str
    modo: str = "multi"


@app.post("/chat")
def chat(c: Consulta):
    def eventos():
        if c.modo == "naive":
            t0 = time.time()
            r = naive_rag(llm, c.pregunta)
            yield json.dumps({"nodo": "Redactor", "tipo": "respuesta", "texto": r["respuesta"], "ms": 1000 * (time.time() - t0)}) + "\n"
            yield json.dumps({"fin": True, "respuesta": r["respuesta"]}) + "\n"
            return
        t, final = time.time(), ""
        for paso in grafos[c.modo].stream(estado_inicial(c.pregunta), {"recursion_limit": 60}, stream_mode="updates"):
            for nodo, cambio in paso.items():
                ahora = time.time()
                ev = {**cambio["traza"][-1], "ms": 1000 * (ahora - t)}
                t = ahora
                final = cambio.get("respuesta", final)
                yield json.dumps(ev, ensure_ascii=False, default=str) + "\n"
        yield json.dumps({"fin": True, "respuesta": final}, ensure_ascii=False) + "\n"
    return StreamingResponse(eventos(), media_type="application/x-ndjson")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
