# Esquema de implementación del proyecto final

Sistema multiagente ReAct para auditoría de hechos, razonamiento matemático y generación de código, con una base vectorial local y una aplicación web interactiva.

## 1. Qué pide el enunciado y cómo se cubre

| Requisito | Implementación |
|---|---|
| Orquestador local de tamaño medio en 4 bits | Qwen2.5 7B Instruct cuantizado en NF4 con bitsandbytes (mismo esquema del laboratorio de QLoRA). Se elige Qwen porque es abierto y no requiere token; Mistral y Llama 3 son modelos restringidos. |
| Al menos 3 agentes con LangGraph | Investigador, Auditor de Hechos y Redactor sobre un StateGraph con estado compartido, igual que el laboratorio 15a. |
| Bucle Thought, Action, Observation | El Investigador emite texto ReAct; un nodo de herramientas ejecuta la acción y devuelve la observación al Investigador (arista cíclica). |
| Herramientas | buscar_kb (FAISS local), buscar_web (DuckDuckGo con respaldo en la API de Wikipedia) y ejecutar_python (calculadora y pruebas de código). |
| Guardrails | El Auditor rechaza el reporte si no hay evidencia, si las cifras no aparecen en las observaciones o si el código no pasa las pruebas; el flujo vuelve al Investigador con la retroalimentación (máximo 2 rechazos). |
| Base vectorial | FAISS con similitud coseno sobre WikiQA (documentos por título), GSM8K train (problemas resueltos) y MBPP train (programas de ejemplo). |
| 50 consultas complejas | 20 de WikiQA test, 15 de GSM8K test y 15 de MBPP test, con semilla fija. |
| Métricas RAGAS y LLM as a Judge | Faithfulness y Answer Relevance implementadas según la definición de RAGAS, con Phi 4 (14B, otra familia de modelos) como juez. Se agregan métricas objetivas: exactitud en GSM8K, pruebas aprobadas en MBPP y acierto de recuperación en WikiQA. |
| Comparación contra Naive RAG | Tabla comparativa con Naive RAG de un solo paso, el sistema multiagente y sus ablaciones. |
| Notebook que dibuja el grafo y ejecuta el flujo | notebooks/proyecto_final.ipynb |

## 2. Ablaciones

1. Naive RAG frente a multiagente (requisito principal).
2. Multiagente sin Auditor, para medir el aporte del guardrail.
3. Orquestador de 1.5B frente a 7B, para el balance entre calidad y latencia en producción.
4. Modelo de embeddings y valor de k en la recuperación (solo recuperación, de bajo costo).

## 3. Dónde corre cada parte

| Tarea | Lugar | Motivo |
|---|---|---|
| Descarga de modelos y datos | Nodo de login de Khipu | Los nodos de cómputo no tienen internet. |
| Índice FAISS y ablación de recuperación | Khipu (también cabe en la MX450 local) | Los embeddings MiniLM son pequeños. |
| Generación de las 50 consultas y juez | Khipu, job SLURM en la RTX A6000 | Un modelo de 7B en 4 bits no entra en 2 GB; Colab gratuito se desconecta en corridas largas. |
| Notebook | Compatible con Colab (T4) y ejecutado en Khipu con nbconvert | Mismo código en ambos entornos. |
| Aplicación web | GitHub Pages, inferencia en el navegador con WebLLM | Sitio estático, sin servidor; opcionalmente se conecta a la API en Python. |

La búsqueda web dentro del job usa un túnel SOCKS al nodo de login, que sí tiene internet.

## 4. Estructura de carpetas

| Carpeta | Contenido |
|---|---|
| codes/ | Módulos de Python: configuración, datos, recuperador, LLM, herramientas, agentes, evaluación, juez y figuras. |
| data/ | Corpus, consultas de evaluación e índice FAISS (generados, ignorados por git salvo las consultas). |
| models/ | Caché local de modelos (ignorado por git). |
| results/ | Respuestas, trazas y métricas en JSON. |
| figures/ | Figuras vectoriales en PDF y SVG. |
| notebooks/ | Notebook principal documentado. |
| paper/ | Short paper en LaTeX. |
| app/ | Aplicación web con D3 v7 y WebLLM, más una API opcional en FastAPI. |
| slurm/ | Scripts de jobs y logs. |

## 5. Orden de ejecución

1. codes/prepare_data.py construye el corpus, las consultas y el índice.
2. codes/run_eval.py genera las respuestas de cada sistema.
3. codes/judge.py calcula Faithfulness, Answer Relevance y corrección.
4. notebooks/proyecto_final.ipynb dibuja el grafo, muestra una ejecución completa, carga los resultados y genera las figuras.
5. codes/export_web.py exporta el índice reducido para la aplicación web.
6. paper/paper.tex compila el short paper con las figuras vectoriales.
