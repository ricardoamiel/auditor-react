"""Genera las tablas del paper (paper/tablas/*.tex) directamente desde los resultados.

Uso: python codes/tablas_tex.py
"""
import figures
from config import ROOT

SALIDA = ROOT / "paper" / "tablas"
SALIDA.mkdir(parents=True, exist_ok=True)
f2 = lambda v: f"{v:.2f}"

df = figures.cargar_resultados()
t = figures.tabla_resumen(df)
filas = [f"{n} & {f2(r['Faithfulness'])} & {f2(r['Answer Relevance'])} & {f2(r['Acierto WikiQA'])} & "
         f"{f2(r['Exactitud GSM8K'])} & {f2(r['Tests MBPP'])} & \\textbf{{{f2(r['Acierto global'])}}} & "
         f"{r['Segundos por consulta']:.1f} & {r['Llamadas al LLM']:.1f} \\\\" for n, r in t.iterrows()]
(SALIDA / "principal.tex").write_text("\n".join(filas) + "\n\\bottomrule\n")

m = figures.tabla_multisalto()
filas = [f"{n} & \\textbf{{{f2(r['Acierto'])}}} & {f2(r['Ambos documentos recuperados'])} & "
         f"{r['Segundos por consulta']:.1f} & {r['Llamadas al LLM']:.1f} \\\\" for n, r in m.iterrows()]
(SALIDA / "multisalto.tex").write_text("\n".join(filas) + "\n\\bottomrule\n")

a = figures.comparar_auditor_codigo()
filas = [f"{mod} & {ver} & {f2(r['Tests MBPP'])} & {r['Rechazos promedio']:.2f} & {r['Segundos por consulta']:.1f} \\\\"
         for (mod, ver), r in a.iterrows()]
(SALIDA / "auditor.tex").write_text("\n".join(filas) + "\n\\bottomrule\n")
print("tablas en", SALIDA)
