"""Grafo multiagente ReAct con LangGraph (Investigador, Herramientas, Auditor y Redactor) y el Naive RAG de referencia."""
import re
from typing import TypedDict
from langgraph.graph import StateGraph, START, END
import tools
from config import MAX_PASOS_REACT, MAX_RECHAZOS, TOP_K


class Estado(TypedDict):
    pregunta: str
    pasos: list        # cada paso: thought, accion, entrada, observacion
    contextos: list    # textos de las observaciones (contexto para Faithfulness)
    accion: dict       # acción pendiente de ejecutar
    reporte: str
    feedback: str
    rechazos: int
    pasos_intento: int
    veredicto: str
    respuesta: str
    traza: list        # eventos para el notebook y la aplicación web


PROMPT_INVESTIGADOR = """Eres el Agente Investigador de un equipo de auditoría. Resuelves la pregunta paso a paso con el formato ReAct.

Herramientas disponibles:
{herramientas}

Formato obligatorio, un paso por turno:
Thought: tu razonamiento breve
Action: nombre de una herramienta
Action Input: la entrada de la herramienta

Luego recibirás una Observation. Cuando tengas evidencia suficiente escribe:
Thought: ya tengo la evidencia
Final Report: hechos y cifras que encontraste, citando los [id] de las observaciones. Si la tarea pide código, incluye la función completa en un bloque ```python.

Reglas:
1. Usa al menos una herramienta antes del Final Report y no inventes datos que no estén en las observaciones.
2. Para preguntas de hechos usa buscar_kb primero y buscar_web solo si la base no tiene la respuesta.
3. Para cálculos escribe el cálculo en ejecutar_python con print y usa el resultado.
4. Para código, prueba tu función con los tests usando ejecutar_python antes del reporte.
5. Escribe las entradas de buscar_kb y buscar_web en inglés, porque la base de conocimiento está en inglés."""

PROMPT_AUDITOR = """Eres el Agente Auditor de Hechos. Verificas el reporte del Investigador contra las observaciones de las herramientas.
Rechaza el reporte si contiene datos que no aparecen en las observaciones (alucinaciones), si no responde la pregunta o si está incompleto.
Responde exactamente en dos líneas:
VEREDICTO: APROBADO o RECHAZADO
MOTIVO: una oración"""

PROMPT_REDACTOR = """Eres el Agente Redactor. Escribes la respuesta final para el usuario usando solo el reporte aprobado.
Reglas:
1. Responde en el idioma de la pregunta, de forma breve y directa, citando los [id] de las fuentes.
2. Solo si la pregunta es un problema de matemáticas con enunciado, termina con una línea: Final answer: número. En preguntas de hechos no agregues esa línea.
3. Si la pregunta pide código, copia la función del reporte sin cambios dentro de un bloque ```python."""


def extraer_codigo(texto):
    bloques = re.findall(r"```(?:python)?\n(.*?)```", texto, re.S)
    return max(bloques, key=len).strip() if bloques else ""


def extraer_numero(texto):
    texto = re.sub(r"\[[^\]]*\]", " ", texto)  # quita citas como [1] o [wiki_3] para no confundirlas con la respuesta
    m = re.search(r"Final answer:\s*\$?(-?[\d,]*\.?\d+)", texto, re.I)
    nums = [m.group(1)] if m else re.findall(r"-?\d[\d,]*\.?\d*", texto)
    return nums[-1].replace(",", "").rstrip(".") if nums else ""


def pasa_tests(codigo, pregunta, setup=""):
    """Guardrail determinista: ejecuta el código con los tests de la pregunta."""
    tests = [l for l in pregunta.splitlines() if l.strip().startswith("assert")]
    salida, ok = tools.ejecutar_python(setup + "\n" + codigo + "\n" + "\n".join(tests) + "\nprint('TESTS OK')")
    return ok and "TESTS OK" in salida, salida


def construir_grafo(llm, con_auditor=True):
    lista = "\n".join(f"{n}: {d}" for n, d in tools.HERRAMIENTAS.items())

    def investigador(s):
        scratch = "\n".join(f"Thought: {p['thought']}\nAction: {p['accion']}\nAction Input: {p['entrada']}\n"
                            f"Observation: {p['observacion']}" for p in s["pasos"])
        tarea = f"Pregunta: {s['pregunta']}"
        if s["feedback"]:
            tarea += f"\n\nEl Auditor rechazó tu reporte anterior. Motivo: {s['feedback']}\nCorrige el problema."
        if s["pasos_intento"] >= MAX_PASOS_REACT:
            tarea += "\n\nYa no puedes usar más herramientas: escribe ahora el Final Report."
        msgs = [{"role": "system", "content": PROMPT_INVESTIGADOR.format(herramientas=lista)},
                {"role": "user", "content": tarea + ("\n\n" + scratch if scratch else "")}]
        texto = llm.chat(msgs, max_new_tokens=600, stop=["Observation:"])
        thought = re.search(r"Thought:\s*(.*?)(?:\nAction:|\nFinal Report:|$)", texto, re.S)
        thought = thought.group(1).strip() if thought else texto[:200]

        # Sin Action el turno se toma como reporte final (el modelo a veces escribe Final answer en vez de Final Report)
        if "Final Report:" in texto or "Action:" not in texto or s["pasos_intento"] >= MAX_PASOS_REACT:
            reporte = texto.split("Final Report:")[-1].strip()
            return {"reporte": reporte, "accion": {},
                    "traza": s["traza"] + [{"nodo": "Investigador", "tipo": "reporte", "texto": reporte}]}
        accion = re.search(r"Action:\s*`?(\w+)", texto)
        entrada = re.search(r"Action Input:\s*(.*)", texto, re.S)
        accion = {"thought": thought, "accion": accion.group(1) if accion else "ninguna",
                  "entrada": entrada.group(1).strip() if entrada else ""}
        if accion["accion"] == "ejecutar_python":
            accion["entrada"] = extraer_codigo(accion["entrada"]) or accion["entrada"].strip("` \n")
        return {"accion": accion,
                "traza": s["traza"] + [{"nodo": "Investigador", "tipo": "thought", "texto": thought,
                                        "accion": accion["accion"], "entrada": accion["entrada"]}]}

    def herramientas(s):
        a = s["accion"]
        obs, docs = tools.ejecutar(a["accion"], a["entrada"])
        paso = {**a, "observacion": obs}
        return {"pasos": s["pasos"] + [paso], "contextos": s["contextos"] + [obs], "accion": {},
                "pasos_intento": s["pasos_intento"] + 1,
                "traza": s["traza"] + [{"nodo": "Herramientas", "tipo": "observation", "accion": a["accion"],
                                        "texto": obs, "docs": [{k: d.get(k) for k in ("id", "titulo", "score", "url")} for d in docs]}]}

    def auditor(s):
        # 1. Guardrails deterministas
        # En código los tests son la evidencia: se ejecutan siempre y el error se devuelve al Investigador
        motivo = ""
        if "must pass these tests" in s["pregunta"]:
            ok, salida = pasa_tests(extraer_codigo(s["reporte"]), s["pregunta"])
            if not ok:
                motivo = (f"El código no pasa los tests. Salida:\n{salida[-400:]}\n"
                          "Corrige la función y pruébala con ejecutar_python antes de reportar.")
        elif not s["pasos"]:
            motivo = "El reporte no se apoya en ninguna herramienta. Usa buscar_kb o ejecutar_python para obtener evidencia."
        # 2. Verificación con el LLM contra las observaciones
        if not motivo and "must pass these tests" not in s["pregunta"]:  # el código ya quedó verificado por los tests
            evidencia = "\n\n".join(s["contextos"])[-6000:]
            msgs = [{"role": "system", "content": PROMPT_AUDITOR},
                    {"role": "user", "content": f"Pregunta: {s['pregunta']}\n\nObservaciones:\n{evidencia}\n\nReporte:\n{s['reporte']}"}]
            texto = llm.chat(msgs, max_new_tokens=80)
            if "RECHAZADO" in texto.upper():
                motivo = texto.split("MOTIVO:")[-1].strip() or "Reporte no respaldado."
        if motivo and s["rechazos"] < MAX_RECHAZOS:
            return {"veredicto": "RECHAZADO", "feedback": motivo, "rechazos": s["rechazos"] + 1, "pasos_intento": 0,
                    "traza": s["traza"] + [{"nodo": "Auditor", "tipo": "rechazo", "texto": motivo}]}
        nota = "Aprobado." if not motivo else f"Aprobado con advertencia (límite de rechazos): {motivo}"
        return {"veredicto": "APROBADO", "feedback": "",
                "traza": s["traza"] + [{"nodo": "Auditor", "tipo": "aprobado", "texto": nota}]}

    def redactor(s):
        msgs = [{"role": "system", "content": PROMPT_REDACTOR},
                {"role": "user", "content": f"Pregunta: {s['pregunta']}\n\nReporte aprobado:\n{s['reporte']}"}]
        texto = llm.chat(msgs, max_new_tokens=500)
        return {"respuesta": texto, "traza": s["traza"] + [{"nodo": "Redactor", "tipo": "respuesta", "texto": texto}]}

    g = StateGraph(Estado)
    g.add_node("Investigador", investigador)
    g.add_node("Herramientas", herramientas)
    g.add_node("Redactor", redactor)
    g.add_edge(START, "Investigador")
    siguiente = "Auditor" if con_auditor else "Redactor"
    g.add_conditional_edges("Investigador", lambda s: "Herramientas" if s["accion"] else siguiente,
                            {"Herramientas": "Herramientas", siguiente: siguiente})
    g.add_edge("Herramientas", "Investigador")  # bucle Thought, Action, Observation
    if con_auditor:
        g.add_node("Auditor", auditor)
        g.add_conditional_edges("Auditor", lambda s: "Investigador" if s["veredicto"] == "RECHAZADO" else "Redactor",
                                {"Investigador": "Investigador", "Redactor": "Redactor"})
    g.add_edge("Redactor", END)
    return g.compile()


def estado_inicial(pregunta):
    return {"pregunta": pregunta, "pasos": [], "contextos": [], "accion": {}, "reporte": "", "feedback": "",
            "rechazos": 0, "pasos_intento": 0, "veredicto": "", "respuesta": "", "traza": []}


def naive_rag(llm, pregunta, k=TOP_K + 1):
    """Referencia de un solo paso: recuperar k documentos y generar una respuesta."""
    texto, docs = tools.buscar_kb(pregunta, k=k)
    msgs = [{"role": "system", "content": "Responde la pregunta usando solo el contexto, en el idioma de la pregunta, citando los [id]. "
                                          "Solo si es un problema de matemáticas con enunciado, termina con una línea: Final answer: número. "
                                          "Si pide código, entrega la función en un bloque ```python."},
            {"role": "user", "content": f"Contexto:\n{texto}\n\nPregunta: {pregunta}"}]
    return {"respuesta": llm.chat(msgs, max_new_tokens=500), "contextos": [texto],
            "docs": [d["id"] for d in docs]}
