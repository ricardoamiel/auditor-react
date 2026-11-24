"""Genera las tablas (report/tables/*.tex) y las figuras en inglés (report/figures/*.pdf) del reporte técnico
directamente desde los resultados, para que ningún número del reporte se escriba a mano.

Uso: python codes/report_assets.py
"""
import json
import math
import random
import figures
from config import ROOT, RESULTS

TABLAS = ROOT / "report" / "tables"
TABLAS.mkdir(parents=True, exist_ok=True)
figures.IDIOMA, figures.SALIDA = "en", ROOT / "report" / "figures"
NOMBRE = {"Multiagente 7B": "Multi agent 7B", "Naive RAG 7B": "Naive RAG 7B",
          "Multiagente sin Auditor 7B": "Multi agent, no Auditor 7B",
          "Multiagente 1.5B": "Multi agent 1.5B", "Naive RAG 1.5B": "Naive RAG 1.5B"}
f2 = lambda v: f"{v:.2f}"


def tabla(nombre, caption, etiqueta, columnas, cabecera, filas, ancho=False):
    entorno = "table*" if ancho else "table"
    tex = [f"\\begin{{{entorno}}}[!tb]", "\\centering", f"\\caption{{{caption}}}", f"\\label{{{etiqueta}}}",
           ("\\footnotesize\n\\setlength{\\tabcolsep}{3.5pt}" if ancho else "\\small"), f"\\begin{{tabular}}{{{columnas}}}", "\\toprule", cabecera + " \\\\", "\\midrule",
           *[" & ".join(map(str, f)) + " \\\\" for f in filas], "\\bottomrule", "\\end{tabular}", f"\\end{{{entorno}}}"]
    (TABLAS / f"{nombre}.tex").write_text("\n".join(tex) + "\n")


def signo(a, b):
    """Prueba del signo bilateral sobre las consultas en que dos sistemas discrepan."""
    n, k = a + b, min(a, b)
    return 1.0 if n == 0 else min(1.0, 2 * sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n)


def texto_p(p):
    return "$p < 0.001$" if p < 0.001 else f"$p = {p + 1e-9:.2f}$"


df = figures.cargar_resultados()
t = figures.tabla_resumen(df)

# Resultado principal
tabla("main", "Results on the 50 dataset queries. Faithfulness and Answer Relevance from the judge; accuracy per task "
      "and overall; mean cost per query.", "tab:main", "lcccccccc",
      "System & Faithful. & Answer Rel. & WikiQA & GSM8K & MBPP & Overall & Seconds & Calls",
      [[NOMBRE[n], f2(r["Faithfulness"]), f2(r["Answer Relevance"]), f2(r["Acierto WikiQA"]), f2(r["Exactitud GSM8K"]),
        f2(r["Tests MBPP"]), f2(r["Acierto global"]), f"{r['Segundos por consulta']:.1f}",
        f"{r['Llamadas al LLM']:.1f}"] for n, r in t.iterrows()], ancho=True)  # tabla ancha: letra menor

# Comparación pareada: prueba del signo y bootstrap de la diferencia de acierto
P = df.pivot(index="id", columns="sistema", values="acierto")
mh = {s: {json.loads(l)["id"]: json.loads(l)["correcto"] for l in open(RESULTS / "multisalto" / f"respuestas_{s}.jsonl")}
      for s in ("multi_7b", "naive_7b")}
rng = random.Random(0)
dif = (P["multi_7b"] - P["naive_7b"]).tolist()
boot = sorted(sum(rng.choice(dif) for _ in dif) / len(dif) for _ in range(5000))
filas = []
for etiqueta, a, b in [("Multi agent vs Naive RAG, dataset", "multi_7b", "naive_7b"), ("Auditor vs no Auditor, dataset", "multi_7b", "multi_sin_auditor_7b"),
                       ("Naive RAG 7B vs 1.5B", "naive_7b", "naive_1.5b"), ("Multi agent 1.5B vs Naive RAG 1.5B", "multi_1.5b", "naive_1.5b")]:
    sa, sb = int(((P[a] == 1) & (P[b] == 0)).sum()), int(((P[a] == 0) & (P[b] == 1)).sum())
    filas.append([etiqueta, 50, sa, sb, texto_p(signo(sa, sb))])
sa = sum(mh["multi_7b"][i] and not mh["naive_7b"][i] for i in mh["multi_7b"])
sb = sum(mh["naive_7b"][i] and not mh["multi_7b"][i] for i in mh["multi_7b"])
filas.insert(0, ["Multi agent vs Naive RAG, complex", len(mh["multi_7b"]), sa, sb, texto_p(signo(sa, sb))])
mh_sa = {json.loads(l)["id"]: json.loads(l)["correcto"] for l in open(RESULTS / "multisalto" / "respuestas_multi_sin_auditor_7b.jsonl")}
a1 = sum(mh["multi_7b"][i] and not mh_sa[i] for i in mh_sa); b1 = sum(mh_sa[i] and not mh["multi_7b"][i] for i in mh_sa)
filas.insert(1, ["Auditor vs no Auditor, complex", len(mh_sa), a1, b1, texto_p(signo(a1, b1))])
filas[2][4] += f", CI $[{boot[125]:.2f}, {boot[4874]:.2f}]$"
tabla("paired", "Paired comparison; 7B unless stated. A only and B only count the queries one system answers correctly "
      "and the other does not. Two sided sign test; the interval is a 95 percent bootstrap of the accuracy difference.",
      "tab:paired", "lcccl", "A vs B & $n$ & A only & B only & Test", filas)

# Fidelidad y relevancia por tarea
g = df[df.sistema.isin(["multi_7b", "naive_7b"])].groupby(["tipo", "sistema"])[["faithfulness", "answer_relevance"]].mean()
web = df[df.sistema == "multi_7b"].assign(web=lambda d: d.docs.apply(lambda x: any(str(z).startswith("web") for z in x)))
web = web.groupby("tipo")["web"].mean()
tabla("per_task", "Faithfulness and Answer Relevance per task, and share of multi agent queries that used web search.",
      "tab:pertask", "lccccc", "Task & \\multicolumn{2}{c}{Faithfulness} & \\multicolumn{2}{c}{Answer Rel.} & Web use \\\\\n"
      " & Multi & Naive & Multi & Naive & Multi",
      [[n, f2(g.loc[(k, "multi_7b"), "faithfulness"]), f2(g.loc[(k, "naive_7b"), "faithfulness"]),
        f2(g.loc[(k, "multi_7b"), "answer_relevance"]), f2(g.loc[(k, "naive_7b"), "answer_relevance"]), f2(web[k])]
       for k, n in [("wiki", "WikiQA"), ("math", "GSM8K"), ("code", "MBPP")]])

# El Auditor como detector en MBPP: veredicto frente a resultado
m = df[(df.sistema == "multi_7b") & (df.tipo == "code")]
apr, rec = m[m.rechazos < 2], m[m.rechazos >= 2]
tabla("detector", "Auditor verdict against the test outcome on the 15 MBPP queries (multi agent 7B).", "tab:detector",
      "lcc", "Final verdict & Passes tests & Fails tests",
      [["Approved", int(apr.acierto.sum()), int((1 - apr.acierto).sum())],
       ["Rejected twice", int(rec.acierto.sum()), int((1 - rec.acierto).sum())]])

# Multisalto
mt = figures.tabla_multisalto()
con_juez = "Faithfulness" in mt
tabla("multihop", f"The {len(mh['multi_7b'])} complex queries: each needs two documents and one subtraction. "
      "Faithfulness and Answer Relevance from the judge.", "tab:multihop", "lcccccc" if con_juez else "lcccc",
      "System & Accuracy & " + ("Faithful. & Answer Rel. & " if con_juez else "") + "Both docs & Seconds & LLM calls",
      [[NOMBRE[n], f2(r["Acierto"]), *([f2(r["Faithfulness"]), f2(r["Answer Relevance"])] if con_juez else []),
        f2(r["Ambos documentos recuperados"]), f"{r['Segundos por consulta']:.1f}", f"{r['Llamadas al LLM']:.1f}"]
       for n, r in mt.iterrows()])

# Auditor v1 frente a v2 en código
a = figures.comparar_auditor_codigo()
tabla("auditor", "MBPP with an Auditor that rejects without returning the error (v1), one that returns the failing "
      "assert (v2), and no Auditor.", "tab:auditor", "llccc", "Model & Version & MBPP tests & Mean rejections & Seconds",
      [[mod, ver.replace("Sin Auditor", "No Auditor"), f2(r["Tests MBPP"]), f"{r['Rechazos promedio']:.2f}",
        f"{r['Segundos por consulta']:.1f}"] for (mod, ver), r in a.iterrows()])

# Ablación de recuperación
abl = json.load(open(RESULTS / "ablacion_recuperacion.json"))
tabla("retrieval", "Hit at k of the gold WikiQA document over the 243 test questions with an answer, and query time.",
      "tab:retrieval", "lccccc", "Embedder & Hit@1 & Hit@3 & Hit@5 & Hit@10 & ms per query",
      [[x["embedder"].split("/")[-1].replace("-", " "), *[f2(x[f"hit@{k}"]) for k in (1, 3, 5, 10)],
        f"{x['ms_por_consulta']:.0f}"] for x in abl])

# Figuras en inglés
from agents import construir_grafo
figures.fig_grafo(construir_grafo(None))
figures.fig_ragas(t)
figures.fig_tareas(df)
figures.fig_calidad_latencia(t)
figures.fig_latencia_nodos(df)
figures.fig_auditor(df)
figures.fig_recuperacion()
figures.fig_multisalto(mt)
print("tablas en", TABLAS, "y figuras en", figures.SALIDA)
