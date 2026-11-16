"""Herramientas que el Investigador invoca en el bucle ReAct."""
import os
import subprocess
import sys
import tempfile
import requests

RETRIEVER = None  # se asigna desde fuera con el índice ya cargado


def buscar_kb(consulta, k=3):
    """Base de conocimiento local (FAISS): WikiQA, problemas resueltos de GSM8K y programas de MBPP."""
    docs = RETRIEVER.buscar(consulta, k=k)
    texto = "\n".join(f"[{d['id']}] {d['texto'][:700]}" for d in docs)
    return texto, docs


def buscar_web(consulta, k=3):
    """Búsqueda web con DuckDuckGo; si falla, usa la API pública de Wikipedia."""
    try:
        from ddgs import DDGS
        res = DDGS().text(consulta, max_results=k)
        docs = [{"id": f"web_{i}", "fuente": "web", "titulo": r["title"], "texto": r["body"], "url": r["href"]}
                for i, r in enumerate(res)]
    except Exception:
        try:
            r = requests.get("https://en.wikipedia.org/w/api.php", timeout=10, headers={"User-Agent": "nlp-course-agent"},
                             params={"action": "query", "list": "search", "srsearch": consulta,
                                     "srlimit": k, "format": "json"}).json()
            docs = [{"id": f"web_{i}", "fuente": "web", "titulo": h["title"],
                     "texto": h["snippet"].replace('<span class="searchmatch">', "").replace("</span>", "")}
                    for i, h in enumerate(r["query"]["search"])]
        except Exception as e:
            return f"ERROR: búsqueda web no disponible ({type(e).__name__}).", []
    texto = "\n".join(f"[{d['id']}] {d['titulo']}: {d['texto']}" for d in docs) or "Sin resultados."
    return texto, docs


def ejecutar_python(codigo, timeout=10):
    """Ejecuta código Python en un proceso aislado y devuelve lo impreso o el error."""
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False) as f:
        f.write(codigo)
    try:
        r = subprocess.run([sys.executable, "-I", f.name], capture_output=True, text=True, timeout=timeout)
        salida = (r.stdout + r.stderr).strip()[-1500:]
        return (salida or "(el código se ejecutó sin imprimir nada; usa print)"), r.returncode == 0
    except subprocess.TimeoutExpired:
        return "ERROR: tiempo de ejecución agotado.", False
    finally:
        os.unlink(f.name)


HERRAMIENTAS = {
    "buscar_kb": "busca en la base de conocimiento local (artículos de Wikipedia, problemas de matemáticas resueltos y programas de Python de ejemplo). Entrada: una consulta en texto.",
    "buscar_web": "busca en internet. Entrada: una consulta en texto.",
    "ejecutar_python": "ejecuta código Python y devuelve lo que imprime. Úsala para cálculos y para probar código. Entrada: código Python completo con print.",
}


def ejecutar(accion, entrada):
    """Despacho de herramientas: devuelve (observación, documentos)."""
    if accion == "buscar_kb":
        return buscar_kb(entrada)
    if accion == "buscar_web":
        return buscar_web(entrada)
    if accion == "ejecutar_python":
        return ejecutar_python(entrada)[0], []
    return f"ERROR: la herramienta {accion} no existe. Usa una de: {', '.join(HERRAMIENTAS)}.", []
