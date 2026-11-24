"""Piezas deterministas que sostienen las métricas y los guardrails: se prueban sin cargar ningún modelo."""
import tools
from agents import extraer_codigo, extraer_numero, pasa_tests


def test_extraer_numero_ignora_citas():
    # el error que escondía el 1.00 en GSM8K: la cita [1] se leía como la respuesta
    assert extraer_numero("Each child got 5 books [1].") == "5"
    assert extraer_numero("Melanie started with 18 vacuum cleaners. [wiki_3]") == "18"


def test_extraer_numero_prefiere_final_answer_y_quita_separadores():
    assert extraer_numero("Paso 1: 120 y 30.\nFinal answer: $1,250") == "1250"
    assert extraer_numero("Final answer: -3.5") == "-3.5"
    assert extraer_numero("sin números") == ""


def test_extraer_codigo_toma_el_bloque_mas_largo():
    texto = "```python\nx = 1\n```\ntexto\n```python\ndef f(a):\n    return a + 1\n```"
    assert extraer_codigo(texto) == "def f(a):\n    return a + 1"
    assert extraer_codigo("sin código") == ""


def test_pasa_tests_aprueba_y_devuelve_el_assert_que_falla():
    pregunta = "Write a function.\nYour code must pass these tests:\nassert doble(2) == 4\nassert doble(0) == 0"
    ok, _ = pasa_tests("def doble(x):\n    return 2 * x", pregunta)
    assert ok
    ok, salida = pasa_tests("def doble(x):\n    return x + 2", pregunta)
    assert not ok and "AssertionError" in salida


def test_ejecutar_python_avisa_si_no_imprime_y_corta_por_tiempo():
    salida, ok = tools.ejecutar_python("x = 300 / 15 / 4")
    assert ok and "usa print" in salida
    salida, ok = tools.ejecutar_python("while True:\n    pass", timeout=1)
    assert not ok and "tiempo" in salida


def test_herramienta_inexistente_vuelve_como_observacion():
    obs, docs = tools.ejecutar("execute_python", "print(1)")
    assert obs.startswith("ERROR") and "ejecutar_python" in obs and docs == []
