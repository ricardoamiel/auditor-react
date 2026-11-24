"""Flujo del grafo con un LLM de guion: cada llamada devuelve la siguiente respuesta preparada."""
from agents import construir_grafo, estado_inicial

PREGUNTA_CODIGO = "Write a function.\nYour code must pass these tests:\nassert doble(3) == 6"
MALO = "Final Report:\n```python\ndef doble(x):\n    return x + 2\n```"
BUENO = "Final Report:\n```python\ndef doble(x):\n    return 2 * x\n```"


class LLMGuion:
    def __init__(self, respuestas):
        self.respuestas, self.llamadas = list(respuestas), 0

    def chat(self, mensajes, max_new_tokens=512, stop=None):
        self.llamadas += 1
        return self.respuestas.pop(0)


def nodos(traza):
    return [p["nodo"] for p in traza]


def test_grafo_tiene_los_nodos_y_el_bucle_de_rechazo():
    g = construir_grafo(None).get_graph()
    assert {"Investigador", "Herramientas", "Auditor", "Redactor"} <= set(g.nodes)
    aristas = {(e.source, e.target) for e in g.edges}
    assert ("Herramientas", "Investigador") in aristas and ("Auditor", "Investigador") in aristas
    assert "Auditor" not in construir_grafo(None, con_auditor=False).get_graph().nodes


def test_auditor_rechaza_codigo_que_falla_y_devuelve_el_error():
    s = construir_grafo(LLMGuion([MALO, BUENO, "La función es [1]"])).invoke(estado_inicial(PREGUNTA_CODIGO))
    assert s["rechazos"] == 1 and s["veredicto"] == "APROBADO"
    rechazo = next(p for p in s["traza"] if p["tipo"] == "rechazo")
    assert "AssertionError" in rechazo["texto"]  # retroalimentación accionable, no un motivo genérico
    assert nodos(s["traza"]) == ["Investigador", "Auditor", "Investigador", "Auditor", "Redactor"]


def test_limite_de_rechazos_termina_el_flujo():
    s = construir_grafo(LLMGuion([MALO, MALO, MALO, "respuesta"])).invoke(estado_inicial(PREGUNTA_CODIGO))
    assert s["rechazos"] == 2
    assert "límite de rechazos" in s["traza"][-2]["texto"] and s["traza"][-1]["nodo"] == "Redactor"


def test_ciclo_react_convierte_errores_en_observaciones():
    guion = ["Thought: divido.\nAction: execute_python\nAction Input: print(300 / 15 / 4)",
             "Thought: uso la herramienta correcta.\nAction: ejecutar_python\nAction Input: print(300 / 15 / 4)",
             "Thought: ya tengo el resultado.\nFinal Report: cada hijo recibe 5 libros.",
             "VEREDICTO: APROBADO", "Each child got 5 books.\nFinal answer: 5"]
    s = construir_grafo(LLMGuion(guion)).invoke(estado_inicial("Sarah bought 300 dollars of books at 15 each for 4 kids."))
    obs = [p["texto"] for p in s["traza"] if p["tipo"] == "observation"]
    assert obs[0].startswith("ERROR") and obs[1] == "5.0"
    assert s["respuesta"].endswith("Final answer: 5") and s["rechazos"] == 0


def test_reporte_sin_evidencia_se_rechaza():
    guion = ["Final Report: Paris.", "Thought: busco.\nAction: ejecutar_python\nAction Input: print('Paris')",
             "Final Report: Paris.", "VEREDICTO: APROBADO", "Paris."]
    s = construir_grafo(LLMGuion(guion)).invoke(estado_inicial("What is the capital of France?"))
    assert s["rechazos"] == 1 and "ninguna herramienta" in next(p for p in s["traza"] if p["tipo"] == "rechazo")["texto"]
