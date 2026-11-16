# Auditor ReAct: sistema multiagente para auditoría de hechos, matemáticas y código

Proyecto final de Procesamiento de Lenguaje Natural, UTEC 2026.

Integrantes: Ricardo Amiel Acuña Villogas, Juan Leibniz Aquino Espinoza y Josué Nehemías Velo Poma.

El enunciado está en ENUNCIADO.md y el esquema de implementación en ESQUEMA.md.

## Qué es

Un sistema de tres agentes que resuelve consultas que un solo paso de RAG suele responder mal: preguntas de hechos (WikiQA), problemas matemáticos de varios pasos (GSM8K) y programas de Python con tests (MBPP). Los agentes se coordinan con un grafo de estados de LangGraph:

1. **Investigador.** Razona con el ciclo Thought, Action, Observation y elige entre tres herramientas: buscar_kb (índice FAISS local), buscar_web (DuckDuckGo con respaldo en Wikipedia) y ejecutar_python (cálculos y pruebas de código).
2. **Auditor de Hechos.** Revisa el reporte. Lo rechaza si no se apoya en ninguna herramienta, si el código no pasa los tests o si el LLM detecta datos que no aparecen en las observaciones. Al rechazar, devuelve el flujo al Investigador con el motivo, hasta 2 veces.
3. **Redactor.** Escribe la respuesta final citando los documentos.

El orquestador es Qwen2.5 7B Instruct cuantizado en 4 bits NF4 (unos 6 GB de VRAM). Se compara contra un Naive RAG de un solo paso en 50 consultas, con Faithfulness y Answer Relevance según RAGAS, usando Phi 4 como juez, más métricas objetivas por tarea.

## Resultados principales

| Sistema | Faithfulness | Answer Relevance | Acierto (50 consultas) | Acierto multisalto (15) | Segundos |
|---|---|---|---|---|---|
| Multiagente 7B | 0.84 | 0.68 | 0.78 | 0.93 | 44.6 |
| Naive RAG 7B | 0.91 | 0.72 | 0.78 | 0.53 | 4.8 |
| Multiagente sin Auditor 7B | 0.84 | 0.68 | 0.74 | 0.93 | 38.6 |
| Multiagente 1.5B | 0.47 | 0.44 | 0.48 | no evaluado | 49.4 |
| Naive RAG 1.5B | 0.78 | 0.64 | 0.50 | no evaluado | 3.8 |

1. En las preguntas originales de los datasets, que se resuelven con una sola recuperación, el multiagente empata con el Naive RAG en acierto y es algo menos fiel; gana en código (MBPP), donde ejecuta y verifica los tests.
2. En consultas multisalto, que exigen dos documentos y un cálculo, el multiagente casi duplica el acierto del Naive RAG.
3. El Auditor mejora matemáticas y código cuando devuelve el error concreto; con un orquestador de 1.5B la arquitectura empeora.
4. Recomendación de producción: Naive RAG por defecto y el grafo completo para consultas compuestas, cálculos o código.

El detalle está en notebooks/proyecto_final.ipynb y en paper/paper.pdf. PROGRESO.md registra cada decisión y corrección de la corrida, y results/descartado_v1 conserva los resultados descartados.

## Flujo completo

| Paso | Script | Salida | Checkpoint |
|---|---|---|---|
| 1. Datos e índice | codes/prepare_data.py | data/consultas_eval.json, data/index/, results/ablacion_recuperacion.json | se omite si el índice existe |
| 2. Generación | codes/run_eval.py (y codes/multihop.py para las consultas multisalto) | results/respuestas_SISTEMA.jsonl | una línea por consulta; retoma donde quedó |
| 3. Juez | codes/judge.py | results/juez_SISTEMA.jsonl | una línea por respuesta; retoma donde quedó |
| 4. Índice web | codes/export_web.py | app/data/kb.json | no aplica |
| 5. Notebook | notebooks/proyecto_final.ipynb | figures/*.pdf, figures/*.svg, results/tabla_comparativa.csv, app/data/resultados.json | no aplica |

run_all.sh ejecuta los cinco pasos en orden de prioridad: primero Naive frente a multiagente con 7B, luego el juez, después la ablación con 1.5B.

Los sistemas evaluados son naive_7b, multi_7b, multi_sin_auditor_7b, naive_1.5b y multi_1.5b.

## Estructura del código

| Archivo | Qué hace |
|---|---|
| codes/config.py | Rutas, nombres de modelos y constantes (k, pasos ReAct máximos, rechazos máximos, tamaño de la muestra). |
| codes/prepare_data.py | Descarga WikiQA, GSM8K y MBPP, arma el corpus (un documento por título de WikiQA, problemas resueltos y programas), elige las 50 consultas con semilla fija, construye el índice y mide el acierto en k de tres modelos de embeddings. |
| codes/retriever.py | Clase Retriever: embeddings normalizados y FAISS con producto interno, que equivale a la similitud coseno. |
| codes/llm.py | Clase LLM: carga un modelo en 4 bits con bitsandbytes, genera con decodificación voraz, corta en cadenas de parada y cuenta llamadas, tokens y segundos. |
| codes/tools.py | Las tres herramientas y el despacho por nombre de acción. |
| codes/agents.py | Prompts, estado compartido, nodos del grafo, aristas condicionales, guardrails del Auditor y el Naive RAG de referencia. |
| codes/run_eval.py | Corre cada sistema sobre las consultas, mide tiempo por nodo y calcula exactitud en GSM8K, tests aprobados en MBPP y recuperación del documento correcto en WikiQA. |
| codes/judge.py | Faithfulness, Answer Relevance y corrección en WikiQA con el juez. |
| codes/figures.py | Carga de resultados, tabla comparativa y las 8 figuras vectoriales. |
| codes/multihop.py | Construye las 15 consultas multisalto con el año verificado en cada documento. |
| codes/tablas_tex.py | Genera las tablas del paper desde los resultados. |
| codes/export_web.py | Exporta textos y embeddings en int8 para la aplicación web. |
| app/index.html, style.css, main.js | Interfaz: chat, grafo animado, línea de tiempo y evidencia con D3 v7. |
| app/agent.js | El mismo grafo y los mismos prompts en JavaScript, para correr en el navegador. |
| app/py_worker.js | Ejecutor de Python con Pyodide en un Web Worker. |
| app/server.py | API en FastAPI que ejecuta el grafo en Python y transmite cada evento a la página. |
| PREGUNTAS.md | Contenido de cada fuente de la base de conocimiento y banco de preguntas para probar el sistema. |
| presentacion/generador/contenido.js, render.js | Contenido de la exposición y generador de los PPTX y del HTML animado. |
| slurm/*.sh | Jobs de Khipu (preparación, prueba corta y pipeline completo) y la sincronización de checkpoints. |
| run_all.sh, setup_aws.sh, make_bundle.sh | Pipeline completo, arranque en una instancia en la nube y empaquetado para traspaso. |

## Cómo ejecutar

| Entorno | Comando |
|---|---|
| Cualquier máquina con GPU | pip install -r requirements.txt y luego bash run_all.sh |
| Khipu | sbatch --gres=gpu:a100_2g.10gb:1 slurm/generate.sh |
| Instancia en la nube (AWS) | bash setup_aws.sh |
| Google Colab | abrir notebooks/proyecto_final.ipynb con GPU T4 y ejecutar todo |
| Local | conda activate nlp-final (ya creado, con CUDA para la MX450) |

## Continuar en otra máquina

1. En esta laptop: bash make_bundle.sh crea auditor_react_traspaso.zip en la carpeta superior, con código, índice y checkpoints, sin pesos de modelos (unos 50 MB).
2. Subir el zip a Drive, descargarlo en la instancia y descomprimirlo.
3. En la instancia: cd "final project" y bash setup_aws.sh. Instala dependencias, descarga los modelos y retoma desde el último checkpoint. El progreso queda en slurm/logs/aws_run.log.

Espacio en la instancia: unos 48 GB de modelos en la caché de Hugging Face (Qwen 7B 15 GB, Qwen 1.5B 3 GB, Phi 4 29 GB, embeddings 1 GB) más unos 8 GB del entorno de Python. Con 24 GB de VRAM todo cabe; el juez se carga en 4 bits automáticamente si hay menos de 35 GB libres.

## Aplicación web

Se publica con GitHub Pages desde app/. Tiene dos motores:

1. **Navegador:** Qwen2.5 1.5B corre con WebGPU en Chrome o Edge, los embeddings con transformers.js y el código Python con Pyodide. No necesita servidor.
2. **Servidor:** python app/server.py en una máquina con GPU, y la página se conecta a http://localhost:8000. Para un servidor remoto se abre un túnel con ssh -L 8000:localhost:8000 usuario@instancia.

Para usar el 7B desde Khipu:

1. En el nodo de login: cd ~/nlp_final y sbatch slurm/server.sh. El job carga Qwen2.5 7B en un nodo con A6000 y queda escuchando en el puerto 8000 por 3 horas.
2. Con squeue se ve el nodo asignado (por ejemplo ds001). En la laptop se abre el túnel: ssh -N -L 8000:ds001:8000 usuario@khipu.utec.edu.pe
3. En la página se elige el motor Servidor con la URL http://localhost:8000 y se presiona Cargar modelo; el estado muestra el modelo y la GPU del servidor.

Con los modelos del navegador (1.5B o menos), el modo Naive RAG es el recomendado: en la evaluación el multiagente con 1.5B no superó al Naive y fue mucho más lento. El Naive solo consulta la base local, así que en preguntas que no están en WikiQA responde que el contexto no tiene la respuesta.

Para probarla en local: python -m http.server 8080 dentro de app/ y abrir http://localhost:8080

## Preguntas para probar

PREGUNTAS.md describe qué contiene cada parte de la base de conocimiento y trae un banco de preguntas verificadas contra el índice, con su respuesta esperada y el modo recomendado. Las más útiles para una demostración:

| Pregunta | Modo | Qué muestra |
|---|---|---|
| How many years passed between the opening of Central Park and the opening of the Kennywood amusement park? End your answer with a line: Final answer: number | Multiagente y luego Naive RAG | El multiagente busca dos veces y responde 41; el Naive suele fallar |
| In which country is Machu Picchu located and in which century was it built? | Naive RAG | Respuesta directa desde la base: Perú, siglo XV |
| What Is Range in Math | Naive RAG | Definición matemática desde WikiQA |
| If 6 potatoes makes 36 hash browns, how many hash browns can you make out of 96 potatoes? | Multiagente | Calcula con Python: 576 |
| Write a python function to find the largest prime factor of a given number, con sus tests (ver PREGUNTAS.md) | Multiagente con Auditor | El Auditor ejecuta los tests antes de aprobar |
| Who wrote the novel The Time of the Hero (La ciudad y los perros)? | Multiagente | No está en la base: busca en la web y responde Mario Vargas Llosa |

## Presentación

La carpeta presentacion/ tiene la exposición con la plantilla y la paleta de UTEC: hallazgos, implementación, casos de uso y el enlace a la aplicación. Todo sale de un solo archivo, presentacion/generador/contenido.js, que también guarda el guion de cada diapositiva como notas del orador.

1. Presentacion_Auditor_ReAct.pptx: cada clic de animación es una diapositiva más, para que los pasos se vean igual en PowerPoint, Google Slides o LibreOffice.
2. Presentacion_Auditor_ReAct_sin_pasos.pptx: una diapositiva por escena, útil para editar o imprimir.
3. Presentacion_Auditor_ReAct.html: un solo archivo con transiciones y revelado por pasos. Se avanza con las flechas o con clic, N muestra el guion y F activa la pantalla completa.

Para regenerarla: npm install y luego npm run build dentro de presentacion/generador.

## Publicar en GitHub Pages

1. Crear en github.com/new un repositorio público vacío llamado auditor-react.
2. Desde esta carpeta:

```
git init -b main
git add .
git commit -m "Proyecto final: sistema multiagente ReAct"
git remote add origin https://github.com/ricardoamiel/auditor-react.git
git push -u origin main
```

3. En el repositorio: Settings, Pages, Source: GitHub Actions. El workflow .github/workflows/pages.yml publica la carpeta app/ en cada push.
4. La aplicación queda en https://ricardoamiel.github.io/auditor-react/ y el notebook se puede abrir en Colab desde el mismo repositorio.
