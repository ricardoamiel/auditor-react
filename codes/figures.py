"""Carga de resultados, tabla comparativa y figuras vectoriales (PDF y SVG) del proyecto."""
import json
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from config import RESULTS, FIGURES, DATA

plt.rcParams.update({"font.size": 9, "axes.spines.top": False, "axes.spines.right": False,
                     "axes.grid": True, "grid.color": "#e2e0da", "grid.linewidth": 0.6, "axes.axisbelow": True,
                     "axes.edgecolor": "#8a8984", "svg.fonttype": "none", "pdf.fonttype": 42})

# Orden y color fijos por sistema (paleta categórica validada para daltonismo)
SISTEMAS = {
    "multi_7b": ("Multiagente 7B", "#2a78d6"),
    "naive_7b": ("Naive RAG 7B", "#eb6834"),
    "multi_sin_auditor_7b": ("Multiagente sin Auditor 7B", "#1baf7a"),
    "multi_1.5b": ("Multiagente 1.5B", "#eda100"),
    "naive_1.5b": ("Naive RAG 1.5B", "#e87ba4"),
}
NODOS = {"Investigador": "#2a78d6", "Herramientas": "#eb6834", "Auditor": "#1baf7a", "Redactor": "#eda100"}
TIPOS = {"wiki": "WikiQA (hechos)", "math": "GSM8K (matemáticas)", "code": "MBPP (código)"}


# Versión en inglés para el reporte: report_assets.py pone IDIOMA = "en" y SALIDA = report/figures
IDIOMA, SALIDA = "es", FIGURES
EN_EXACTO = {"Inicio": "Start", "Fin": "End", "Acierto": "Accuracy", "Consultas": "Queries", "reporte": "report",
             "rechazo": "rejection", "aprobado": "approved", "sin Auditor": "no Auditor"}
EN = [("Multiagente sin Auditor", "Multi agent, no Auditor"), ("Multiagente", "Multi agent"),
      ("Investigador", "Researcher"), ("Herramientas", "Tools"), ("Redactor", "Writer"),
      ("Faithfulness (fidelidad al contexto)", "Faithfulness"), ("Answer Relevance (relevancia)", "Answer Relevance"),
      ("WikiQA (hechos)", "WikiQA (facts)"), ("GSM8K (matemáticas)", "GSM8K (math)"), ("MBPP (código)", "MBPP (code)"),
      ("Acierto global", "Overall accuracy"), ("Acierto en k (WikiQA)", "Hit at k (WikiQA)"),
      ("Segundos por consulta (escala logarítmica)", "Seconds per query (log scale)"),
      ("Segundos promedio por consulta", "Mean seconds per query"), ("k documentos recuperados", "k retrieved documents"),
      ("Ambos documentos recuperados", "Both documents retrieved"), ("rechazos", "rejections"), ("rechazo", "rejection")]


def _en(s):
    if s in EN_EXACTO:
        return EN_EXACTO[s]
    for a, b in EN:
        s = s.replace(a, b)
    return s


def traducir(fig):
    import matplotlib.text
    fig.canvas.draw()  # las etiquetas de los ejes se crean al dibujar
    for ax in fig.axes:
        for eje in (ax.xaxis, ax.yaxis):
            textos = [t.get_text() for t in eje.get_ticklabels()]
            if any(textos):
                eje.set_ticks(eje.get_ticklocs(), [_en(x) for x in textos])
    for t in fig.findobj(matplotlib.text.Text):
        t.set_text(_en(t.get_text()))


def guardar(fig, nombre):
    if IDIOMA == "en":
        traducir(fig)
    SALIDA.mkdir(parents=True, exist_ok=True)
    for ext in ("pdf", "svg") if IDIOMA == "es" else ("pdf",):
        fig.savefig(SALIDA / f"{nombre}.{ext}", bbox_inches="tight")


def cargar_resultados(carpeta=RESULTS):
    filas = []
    for s in SISTEMAS:
        r, j = carpeta / f"respuestas_{s}.jsonl", carpeta / f"juez_{s}.jsonl"
        if not r.exists():
            continue
        a = pd.DataFrame([json.loads(l) for l in open(r)])
        if j.exists():
            b = pd.DataFrame([json.loads(l) for l in open(j)])
            b = b.rename(columns={"correcto": "correcto_juez"})
            b = b[[c for c in ("id", "faithfulness", "answer_relevance", "correcto_juez") if c in b]]
            a = a.merge(b.drop_duplicates("id"), on="id", how="left")
        filas.append(a)
    df = pd.concat(filas, ignore_index=True)
    # GSM8K se recalcula con el extractor actual (ignora citas como [1] que antes se leían como la respuesta)
    from agents import extraer_numero
    oro = {q["id"]: float(q["respuesta_oro"]) for q in json.load(open(DATA / "consultas_eval.json")) if q["tipo"] == "math"}
    def exacto(r):
        try:
            return abs(float(extraer_numero(r.respuesta)) - oro[r.id]) < 1e-6
        except ValueError:
            return False
    es_math = df["tipo"] == "math"
    df.loc[es_math, "correcto"] = [exacto(r) for r in df[es_math].itertuples()]
    # Acierto unificado: juez para WikiQA, número exacto para GSM8K y tests aprobados para MBPP
    df["acierto"] = np.where(df["tipo"] == "wiki", df.get("correcto_juez", np.nan), df["correcto"]).astype(float)
    return df


def tabla_resumen(df):
    g = df.groupby("sistema")
    t = pd.DataFrame({
        "Faithfulness": g["faithfulness"].mean(),
        "Answer Relevance": g["answer_relevance"].mean(),
        "Acierto WikiQA": df[df.tipo == "wiki"].groupby("sistema")["acierto"].mean(),
        "Recuperación WikiQA": df[df.tipo == "wiki"].groupby("sistema")["hit_doc_oro"].mean(),
        "Exactitud GSM8K": df[df.tipo == "math"].groupby("sistema")["acierto"].mean(),
        "Tests MBPP": df[df.tipo == "code"].groupby("sistema")["acierto"].mean(),
        "Acierto global": g["acierto"].mean(),
        "Segundos por consulta": g["segundos"].mean(),
        "Llamadas al LLM": g["llamadas_llm"].mean(),
        "Tokens generados": g["tokens_out"].mean(),
    })
    t = t.loc[[s for s in SISTEMAS if s in t.index]]
    t.index = [SISTEMAS[s][0] for s in t.index]
    return t


def fig_grafo(grafo):
    """Dibuja el grafo compilado de LangGraph; las aristas se toman del grafo real y se ubican a mano."""
    g = grafo.get_graph()
    pos = {"__start__": (0, 0), "Investigador": (1.6, 0), "Herramientas": (1.6, 1.2), "Auditor": (3.6, 0),
           "Redactor": (5.6, 0), "__end__": (6.8, 0)}
    # origen, destino, curvatura y etiqueta de cada arista, medidos desde el borde de las cajas
    geo = {("__start__", "Investigador"): ((0.16, 0), (1.0, 0), 0, None),
           ("Investigador", "Herramientas"): ((1.42, 0.22), (1.42, 0.98), 0, ("Action", 1.36, 0.6, "right")),
           ("Herramientas", "Investigador"): ((1.78, 0.98), (1.78, 0.22), 0, ("Observation", 1.84, 0.6, "left")),
           ("Investigador", "Auditor"): ((2.2, 0), (3.0, 0), 0, ("reporte", 2.6, 0.1, "center")),
           ("Auditor", "Investigador"): ((3.6, -0.22), (1.6, -0.22), -0.35, ("rechazo", 2.6, -0.72, "center")),
           ("Investigador", "Redactor"): ((1.6, 0.22), (5.6, 0.22), -0.3, ("sin Auditor", 3.6, 0.95, "center")),
           ("Auditor", "Redactor"): ((4.2, 0), (5.0, 0), 0, ("aprobado", 4.6, 0.1, "center")),
           ("Redactor", "__end__"): ((6.2, 0), (6.64, 0), 0, None)}
    nombre = {"__start__": "Inicio", "__end__": "Fin"}
    fig, ax = plt.subplots(figsize=(7, 2.6))
    ax.axis("off")
    for e in g.edges:
        (p0, p1, rad, et) = geo[(e.source, e.target)]
        ax.annotate("", xy=p1, xytext=p0, arrowprops=dict(arrowstyle="-|>", color="#8a8984", lw=1.3, shrinkA=0, shrinkB=0,
                    linestyle="--" if e.conditional else "-", connectionstyle=f"arc3,rad={rad}"))
        if et:
            ax.text(et[1], et[2], et[0], ha=et[3], fontsize=8, color="#52514e")
    for n, (x, y) in pos.items():
        if n in nombre:
            ax.add_patch(plt.Circle((x, y), 0.14, color="#d9d7d0"))
            ax.text(x, y - 0.34, nombre[n], ha="center", fontsize=8)
        else:
            ax.add_patch(plt.Rectangle((x - 0.6, y - 0.22), 1.2, 0.44, fc="white", ec=NODOS[n], lw=2))
            ax.text(x, y, n, ha="center", va="center", fontsize=9)
    ax.set_xlim(-0.4, 7.2)
    ax.set_ylim(-1.0, 1.6)
    ax.set_aspect("equal")
    guardar(fig, "fig1_grafo_agentes")
    return fig


def _barras(ax, t, col, titulo):
    s = [s for s in SISTEMAS if SISTEMAS[s][0] in t.index]
    y = np.arange(len(s))
    ax.barh(y, t[col].values, color=[SISTEMAS[k][1] for k in s], height=0.6)
    for i, v in enumerate(t[col].values):
        ax.text(v + 0.01, i, f"{v:.2f}", va="center", fontsize=8, color="#52514e")
    ax.set_yticks(y, t.index)
    ax.set_xlim(0, 1.1)
    ax.set_title(titulo, fontsize=9, loc="left")
    ax.grid(axis="y", visible=False)


def fig_ragas(t):
    fig, axs = plt.subplots(1, 2, figsize=(7.2, 2.4), sharey=True)
    _barras(axs[0], t, "Faithfulness", "Faithfulness (fidelidad al contexto)")
    _barras(axs[1], t, "Answer Relevance", "Answer Relevance (relevancia)")
    axs[0].invert_yaxis()  # los ejes comparten la escala vertical: se invierte una sola vez
    fig.tight_layout()
    guardar(fig, "fig2_ragas")
    return fig


def fig_tareas(df):
    s = [k for k in SISTEMAS if k in df.sistema.unique()]
    tabla = df.groupby(["tipo", "sistema"])["acierto"].mean().unstack().reindex(index=list(TIPOS), columns=s)
    fig, ax = plt.subplots(figsize=(7.2, 2.6))
    x, w = np.arange(len(TIPOS)), 0.8 / len(s)
    for i, k in enumerate(s):
        ax.bar(x + (i - (len(s) - 1) / 2) * w, tabla[k].values, w * 0.92, color=SISTEMAS[k][1], label=SISTEMAS[k][0])
    ax.set_xticks(x, list(TIPOS.values()))
    ax.set_ylabel("Acierto")
    ax.set_ylim(0, 1)
    ax.grid(axis="x", visible=False)
    ax.legend(frameon=False, fontsize=7.5, ncol=3, loc="upper center", bbox_to_anchor=(0.5, 1.22))
    guardar(fig, "fig3_acierto_por_tarea")
    return fig


def fig_calidad_latencia(t):
    fig, ax = plt.subplots(figsize=(4.2, 3))
    for nombre, (lab, color) in SISTEMAS.items():
        if lab in t.index:
            r = t.loc[lab]
            ax.scatter(r["Segundos por consulta"], r["Acierto global"], s=60, color=color, edgecolor="white", linewidth=1.5, zorder=3)
            ax.annotate(lab, (r["Segundos por consulta"], r["Acierto global"]), xytext=(6, -3), textcoords="offset points", fontsize=7.5)
    ax.set_xscale("log")
    ticks = [v for v in (1, 2, 5, 10, 20, 50, 100, 200) if v <= 2 * t["Segundos por consulta"].max()]
    ax.set_xticks(ticks, [str(v) for v in ticks])
    ax.xaxis.set_minor_formatter(plt.NullFormatter())
    ax.set_xlim(right=4 * t["Segundos por consulta"].max())  # espacio para las etiquetas
    ax.set_xlabel("Segundos por consulta (escala logarítmica)")
    ax.set_ylabel("Acierto global")
    guardar(fig, "fig4_calidad_vs_latencia")
    return fig


def fig_latencia_nodos(df):
    m = df[df.sistema.str.startswith("multi")].copy()
    s = [k for k in SISTEMAS if k in m.sistema.unique()]
    tiempos = pd.DataFrame([{"sistema": r.sistema, **r.segundos_nodo} for r in m.itertuples()]).fillna(0)
    medias = tiempos.groupby("sistema").mean().loc[s]
    fig, ax = plt.subplots(figsize=(6.5, 1.9))
    izq = np.zeros(len(s))
    for n, c in NODOS.items():
        if n in medias:
            ax.barh(range(len(s)), medias[n], left=izq, color=c, height=0.55, label=n, edgecolor="white", linewidth=1)
            izq += medias[n].values
    ax.set_yticks(range(len(s)), [SISTEMAS[k][0] for k in s])
    ax.invert_yaxis()
    ax.set_xlabel("Segundos promedio por consulta")
    ax.grid(axis="y", visible=False)
    ax.legend(frameon=False, ncol=4, fontsize=7.5, loc="upper center", bbox_to_anchor=(0.5, 1.35))
    guardar(fig, "fig5_latencia_por_agente")
    return fig


def fig_auditor(df, sistema="multi_7b"):
    m = df[df.sistema == sistema]
    tabla = m.groupby(["tipo", "rechazos"]).size().unstack(fill_value=0).reindex(list(TIPOS), fill_value=0)
    tonos = ["#b7d3f6", "#5598e7", "#1c5cab"]  # rampa secuencial: más oscuro, más rechazos
    fig, ax = plt.subplots(figsize=(5, 1.9))
    izq = np.zeros(len(tabla))
    for i, c in enumerate(tabla.columns):
        ax.barh(range(len(tabla)), tabla[c], left=izq, color=tonos[min(int(c), 2)], height=0.55, label=f"{int(c)} rechazo" + ("" if int(c) == 1 else "s"),
                edgecolor="white", linewidth=1)
        izq += tabla[c].values
    ax.set_yticks(range(len(tabla)), [TIPOS[t] for t in tabla.index])
    ax.invert_yaxis()
    ax.set_xlabel("Consultas")
    ax.grid(axis="y", visible=False)
    ax.legend(frameon=False, ncol=3, fontsize=7.5, loc="upper center", bbox_to_anchor=(0.5, 1.35))
    guardar(fig, "fig6_rechazos_auditor")
    return fig


def fig_recuperacion():
    abl = json.load(open(RESULTS / "ablacion_recuperacion.json"))
    colores = ["#2a78d6", "#eb6834", "#1baf7a"]
    fig, ax = plt.subplots(figsize=(4.2, 2.8))
    for a, c in zip(abl, colores):
        ks = [int(k.split("@")[1]) for k in a if k.startswith("hit@")]
        ax.plot(ks, [a[f"hit@{k}"] for k in ks], marker="o", color=c, lw=2, ms=5,
                label=f"{a['embedder'].split('/')[-1]} ({a['ms_por_consulta']:.0f} ms)")
    ax.set_xscale("log")
    ax.set_xticks([1, 3, 5, 10], ["1", "3", "5", "10"])
    ax.set_xlabel("k documentos recuperados")
    ax.set_ylabel("Acierto en k (WikiQA)")
    ax.set_ylim(0, 1)
    ax.legend(frameon=False, fontsize=7)
    guardar(fig, "fig7_recuperacion")
    return fig


def comparar_auditor_codigo(carpeta=RESULTS):
    """MBPP con el Auditor v1 (rechaza sin devolver el error) frente al v2 (devuelve el assert que falla) y sin Auditor."""
    filas = []
    fuentes = [("Sin Auditor", carpeta / "respuestas_multi_sin_auditor_7b.jsonl", "7B"),
               ("Auditor v1", carpeta / "descartado_v1" / "codigo_auditor_v1" / "respuestas_multi_7b.jsonl", "7B"),
               ("Auditor v2", carpeta / "respuestas_multi_7b.jsonl", "7B"),
               ("Auditor v1", carpeta / "descartado_v1" / "codigo_auditor_v1" / "respuestas_multi_1.5b.jsonl", "1.5B"),
               ("Auditor v2", carpeta / "respuestas_multi_1.5b.jsonl", "1.5B")]
    for version, ruta, modelo in fuentes:
        if not ruta.exists():
            continue
        r = pd.DataFrame([json.loads(l) for l in open(ruta)])
        r = r[r.tipo == "code"]
        filas.append({"Modelo": modelo, "Versión": version, "Tests MBPP": r["correcto"].mean(),
                      "Rechazos promedio": r["rechazos"].mean() if "rechazos" in r else 0,
                      "Segundos por consulta": r["segundos"].mean()})
    return pd.DataFrame(filas).set_index(["Modelo", "Versión"])


def tabla_multisalto(carpeta=RESULTS / "multisalto"):
    """Consultas multisalto: dos documentos y una resta. Acierto, recuperación de ambos documentos y costo."""
    filas = {}
    for s in ("multi_7b", "naive_7b", "multi_sin_auditor_7b"):
        ruta = carpeta / f"respuestas_{s}.jsonl"
        if ruta.exists():
            r = pd.DataFrame([json.loads(l) for l in open(ruta)])
            filas[SISTEMAS[s][0]] = {"Acierto": r["correcto"].mean(), "Ambos documentos recuperados": r["ambos_docs"].mean(),
                                     "Segundos por consulta": r["segundos"].mean(), "Llamadas al LLM": r["llamadas_llm"].mean()}
    return pd.DataFrame(filas).T


def fig_multisalto(t):
    fig, axs = plt.subplots(1, 2, figsize=(7.2, 2.0), sharey=True)
    colores = [SISTEMAS[k][1] for k in SISTEMAS if SISTEMAS[k][0] in t.index]
    for ax, col in zip(axs, ["Acierto", "Ambos documentos recuperados"]):
        y = np.arange(len(t))
        ax.barh(y, t[col].values, color=colores, height=0.6)
        for i, v in enumerate(t[col].values):
            ax.text(v + 0.01, i, f"{v:.2f}", va="center", fontsize=8, color="#52514e")
        ax.set_yticks(y, t.index)
        ax.set_xlim(0, 1.1)
        ax.set_title(col, fontsize=9, loc="left")
        ax.grid(axis="y", visible=False)
    axs[0].invert_yaxis()
    fig.tight_layout()
    guardar(fig, "fig8_multisalto")
    return fig
