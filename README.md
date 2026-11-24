# Auditor ReAct: sistema multiagente para auditoría de hechos, matemáticas y código

Proyecto final de Procesamiento de Lenguaje Natural, UTEC 2026.

Integrantes: Ricardo Acuña, Juan Aquino y Josué Velo.

El enunciado está en ENUNCIADO.md y el reporte técnico, en inglés, en report/main.pdf.

## Qué es

Un sistema de tres agentes que resuelve consultas que un solo paso de RAG suele responder mal: preguntas de hechos (WikiQA), problemas matemáticos de varios pasos (GSM8K) y programas de Python con tests (MBPP). Los agentes se coordinan con un grafo de estados de LangGraph:

1. **Investigador.** Razona con el ciclo Thought, Action, Observation y elige entre tres herramientas: buscar_kb (índice FAISS local), buscar_web (DuckDuckGo con respaldo en Wikipedia) y ejecutar_python (cálculos y pruebas de código).
2. **Auditor de Hechos.** Revisa el reporte. Lo rechaza si no se apoya en ninguna herramienta, si el código no pasa los tests o si el LLM detecta datos que no aparecen en las observaciones. Al rechazar, devuelve el flujo al Investigador con el motivo, hasta 2 veces.
3. **Redactor.** Escribe la respuesta final citando los documentos.

El orquestador es Qwen2.5 7B Instruct cuantizado en 4 bits NF4 (unos 6 GB de VRAM). Se compara contra un Naive RAG de un solo paso en 50 consultas complejas (dos documentos y un cálculo) y en 50 consultas de los datasets como control, con Faithfulness y Answer Relevance según RAGAS, usando Phi 4 como juez, más métricas objetivas por tarea.

## Resultados principales

Consultas complejas: 50 preguntas que piden los años entre dos eventos descritos en dos artículos distintos, así que exigen dos búsquedas y una resta.

| Sistema | Acierto | Faithfulness | Answer Relevance | Ambos documentos recuperados | Segundos | Llamadas al LLM |
|---|---|---|---|---|---|---|
| Multiagente 7B | 0.88 | 0.30 | 0.21 | 0.76 | 31.4 | 9.1 |
| Naive RAG 7B | 0.28 | 0.77 | 0.68 | 0.10 | 3.0 | 1.0 |
| Multiagente sin Auditor 7B | 0.84 | 0.28 | 0.21 | 0.76 | 23.0 | 5.8 |

Consultas de los datasets (control): 20 de WikiQA, 15 de GSM8K y 15 de MBPP, que casi siempre se resuelven con una sola recuperación.

| Sistema | Faithfulness | Answer Relevance | Acierto | Segundos |
|---|---|---|---|---|
| Multiagente 7B | 0.84 | 0.68 | 0.78 | 44.6 |
| Naive RAG 7B | 0.91 | 0.72 | 0.78 | 4.8 |
| Multiagente sin Auditor 7B | 0.84 | 0.68 | 0.74 | 38.6 |
| Multiagente 1.5B | 0.47 | 0.44 | 0.48 | 49.4 |
| Naive RAG 1.5B | 0.78 | 0.64 | 0.50 | 3.8 |

1. En las consultas complejas el multiagente supera con claridad al Naive RAG: 0.88 frente a 0.28. Busca cada evento por separado y recupera ambos documentos en el 76 % de los casos, contra el 10 % de una sola búsqueda.
2. En esas mismas consultas Faithfulness y Answer Relevance favorecen al Naive RAG aunque acierta mucho menos. El multiagente responde solo "Final answer: 41": el juez no encuentra la resta escrita en los documentos y, a partir de un número suelto, genera preguntas que no se parecen a la original. El Naive responde frases sobre su contexto, muchas veces para decir que no puede calcularlo. Estas métricas miden respaldo y tema, no corrección; en respuestas numéricas manda el acierto exacto.
3. En las preguntas de los datasets empatan en acierto y el Naive es algo más fiel; el multiagente gana en código (MBPP), donde ejecuta y verifica los tests.
4. El Auditor ayuda cuando puede comprobar algo concreto y devuelve el error; con un orquestador de 1.5B la arquitectura empeora.
5. Recomendación de producción: Naive RAG por defecto y el grafo completo para consultas compuestas, cálculos o código.

### Análisis de resultados

Como los cinco sistemas responden las mismas consultas, las diferencias se analizan pregunta por pregunta: solo cuentan las consultas en que un sistema acierta y el otro no.

| Comparación | Consultas | Solo acierta el primero | Solo acierta el segundo | Prueba | Lectura |
|---|---|---|---|---|---|
| Multiagente 7B frente a Naive 7B | 50 complejas | 30 | 0 | prueba del signo, p < 0.001 | Gana el multiagente |
| Con Auditor frente a sin Auditor | 50 complejas | 2 | 0 | p = 0.50 | No concluyente |
| Multiagente 7B frente a Naive 7B | 50 de datasets | 4 | 4 | IC 95 % de la diferencia: −0.12 a 0.10 | Empate |
| Con Auditor frente a sin Auditor | 50 de datasets | 3 | 1 | p = 0.63 | No concluyente |
| Naive 7B frente a Naive 1.5B | 50 | 14 | 0 | p < 0.001 | Pesa el modelo |

1. **Fidelidad.** La Faithfulness del multiagente es igual a la del Naive en WikiQA (0.91 y 0.92) y menor en GSM8K (0.83 y 1.00) y MBPP (0.74 y 0.82): ahí la respuesta afirma resultados calculados con Python o describe el código, que no están en los documentos recuperados. La métrica castiga lo que el sistema calcula, no lo que inventa.
2. **Errores.** En las complejas el multiagente falla 6 de 50: cuatro con ambos documentos (dos por un año de diferencia y dos por tomar otro año del artículo) y dos en que no recuperó uno de los artículos. El Auditor rechazó las seis al menos una vez, pero no rehace la resta. En las de datasets falla 11: 7 de MBPP en las que el Auditor encontró el test que falla y agotó sus dos rechazos, 3 respuestas parciales de WikiQA y 1 referencia desactualizada (Yankee Stadium). Siete de las 11 también las falla el Naive.
3. **El Auditor como detector.** En MBPP las 8 respuestas que aprobó pasan los tests y las 7 que rechazó dos veces fallan. Su veredicto sirve para avisar al usuario que un código no está verificado. En GSM8K rechazó en 7 de 15 problemas y solo cambió un resultado: ahí sobre todo agrega tiempo.
4. **Costo.** El Investigador consume el 75 % de los 44.6 s por consulta y fue a la web en el 75 % de las preguntas de WikiQA aunque el documento correcto ya estaba en la base.

El detalle está en notebooks/proyecto_final.ipynb y en el reporte técnico, report/main.pdf.

## Procesamiento de datos

| Fuente | Transformación | Documentos en el índice | Consultas de prueba |
|---|---|---|---|
| WikiQA (pares pregunta y oración candidata) | Las oraciones se agrupan por título del artículo, sin duplicados y en su orden | 2 811, mediana 1 065 caracteres | 20 preguntas de test con respuesta |
| GSM8K (problemas con solución) | Problem y Worked solution de train; la respuesta oro es el número tras ####, sin comas | 7 473, mediana 511 | 15 de test, fuera del índice |
| MBPP (enunciado, función y 3 asserts) | Task y Solution de train, validation y prompt; tests y setup se guardan aparte para el Auditor | 474, mediana 240 | 15 de test con sus asserts |

Los documentos son cortos y se indexan enteros, sin trocear. Los embeddings de all MiniLM L6 se normalizan y van a un índice FAISS de producto interno, que equivale al coseno; la aplicación web usa los mismos vectores cuantizados a int8. Las consultas se eligen con semilla 42. De las 50 complejas, 15 se eligieron a mano y 35 salen de artículos cuyo primer párrafo da un solo año para la propia entidad, emparejados con semilla fija; los 100 artículos son distintos y cada año se verifica en el texto. PREGUNTAS.md describe con más detalle qué contiene cada fuente.

## Pipeline de evaluación

| Paso | Script | Salida | Checkpoint |
|---|---|---|---|
| 1. Datos e índice | codes/prepare_data.py | data/consultas_eval.json, data/index/, results/ablacion_recuperacion.json | se omite si el índice existe |
| 2. Generación | codes/run_eval.py (y codes/multihop.py para las consultas multisalto) | results/respuestas_SISTEMA.jsonl | una línea por consulta; retoma donde quedó |
| 3. Juez | codes/judge.py | results/juez_SISTEMA.jsonl | una línea por respuesta; retoma donde quedó |
| 4. Índice web | codes/export_web.py | app/data/kb.json | no aplica |
| 5. Notebook | notebooks/proyecto_final.ipynb | figures/*.pdf, figures/*.svg, results/tabla_comparativa.csv, app/data/resultados.json | no aplica |
| 6. Reporte | codes/report_assets.py y luego pdflatex y bibtex en report/ | report/tables/*.tex, report/figures/*.pdf, report/main.pdf | no aplica |

run_all.sh ejecuta los cinco pasos en orden de prioridad: primero Naive frente a multiagente con 7B, luego el juez, después la ablación con 1.5B.

Los sistemas evaluados son naive_7b, multi_7b, multi_sin_auditor_7b, naive_1.5b y multi_1.5b.

1. El juez es Phi 4, de otra familia que el orquestador, para que el sistema no se califique a sí mismo. Faithfulness se calcula en dos pasos como en RAGAS: extraer afirmaciones y verificar cada una contra el contexto.
2. Hay métricas que no dependen del juez: número exacto en GSM8K, tests ejecutados en MBPP y documento oro recuperado en WikiQA.
3. Antes de reportar se auditó la propia evaluación: el juez generaba preguntas en otro idioma, el extractor leía la cita [1] como respuesta y el parser convertía un turno sin Action en una acción inválida.

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
| codes/multihop.py | Construye las 50 consultas complejas (multisalto) con el año verificado en cada documento. |
| codes/report_assets.py | Genera en inglés las tablas, la comparación pareada y las figuras del reporte técnico desde los resultados. |
| codes/export_web.py | Exporta textos y embeddings en int8 para la aplicación web. |
| app/index.html, style.css, main.js | Interfaz: chat, grafo animado, línea de tiempo y evidencia con D3 v7. |
| app/agent.js | El mismo grafo y los mismos prompts en JavaScript, para correr en el navegador. |
| app/py_worker.js | Ejecutor de Python con Pyodide en un Web Worker. |
| app/server.py | API en FastAPI que ejecuta el grafo en Python y transmite cada evento a la página. |
| notebooks/servidor_colab.ipynb | Levanta en Colab el servidor del 7B con un túnel público y devuelve el enlace a la aplicación. |
| PREGUNTAS.md | Contenido de cada fuente de la base de conocimiento y banco de preguntas para probar el sistema. |
| tests/ | Pruebas con pytest de los extractores, la ejecución de tests de código, los errores de herramientas y el flujo del grafo con un LLM de guion, sin cargar modelos. |
| report/main.tex | Reporte técnico en el formato NeurIPS, en inglés. |
| slurm/*.sh | Jobs de Khipu (preparación, prueba corta y pipeline completo) y la sincronización de checkpoints. |
| run_all.sh, setup_aws.sh, make_bundle.sh | Pipeline completo, arranque en una instancia en la nube y empaquetado para traspaso. |

## Tests

python -m pytest tests corre 11 pruebas en unos segundos y sin GPU. Cubren las piezas deterministas de las que dependen las métricas y los guardrails: el extractor de números (incluido el caso de las citas [1] que se leían como respuesta), el extractor de código, la verificación con los asserts de MBPP, el límite de tiempo y los errores de herramientas. Con un LLM de guion, que devuelve respuestas preparadas, prueban además el grafo completo: el Auditor rechaza código que falla y devuelve el assert, el flujo termina al llegar al límite de rechazos, un reporte sin evidencia se rechaza y una herramienta mal escrita vuelve como Observation.

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

Está publicada en https://ricardoamiel.github.io/auditor-react/ y su código está en app/. Tiene dos motores:

1. **Navegador:** Qwen2.5 1.5B corre con WebGPU en Chrome o Edge, los embeddings con transformers.js y el código Python con Pyodide. No necesita servidor.
2. **Servidor:** python app/server.py en una máquina con GPU, y la página se conecta a http://localhost:8000. Para un servidor remoto se abre un túnel con ssh -L 8000:localhost:8000 usuario@instancia.

Para usar el 7B desde Khipu:

1. En el nodo de login: cd ~/nlp_final y sbatch slurm/server.sh. El job carga Qwen2.5 7B en un nodo con A6000 y queda escuchando en el puerto 8000 por 3 horas.
2. Con squeue se ve el nodo asignado (por ejemplo ds001). En la laptop se abre el túnel: ssh -N -L 8000:ds001:8000 usuario@khipu.utec.edu.pe
3. En la página se elige el motor Servidor con la URL http://localhost:8000 y se presiona Cargar modelo; el estado muestra el modelo y la GPU del servidor.

Para usar el 7B desde Google Colab (sin Khipu ni túnel SSH):

1. Abrir notebooks/servidor_colab.ipynb en Colab con GPU T4 y ejecutar todo.
2. El notebook clona el repositorio, instala dependencias, construye o recupera el índice, carga Qwen2.5 7B en 4 bits, lanza app/server.py y abre un túnel https público con Cloudflare (sin cuenta).
3. La última celda imprime un enlace a la aplicación con el servidor ya configurado (parámetro ?servidor= en la URL). Funciona desde cualquier computadora o celular.

La primera vez tarda de 10 a 15 minutos. Con la opción USAR_DRIVE el índice y el modelo ya cuantizado (unos 5.5 GB) quedan en Google Drive, y las siguientes sesiones arrancan en 4 a 6 minutos. Guardar los 15 GB originales en Drive no conviene: leerlos desde Drive tarda lo mismo que descargarlos. En la T4 una consulta multiagente tarda entre 60 y 120 s. La URL del túnel cambia en cada sesión y Colab gratuito corta la sesión tras un rato sin uso.

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

La carpeta presentacion/ tiene la exposición con la plantilla y la paleta de UTEC: hallazgos, implementación, casos de uso y el enlace a la aplicación. Cada diapositiva trae su guion en las notas del orador.

1. Presentacion_Auditor_ReAct.pptx: cada clic de animación es una diapositiva más, para que los pasos se vean igual en PowerPoint, Google Slides o LibreOffice.
2. Presentacion_Auditor_ReAct_sin_pasos.pptx: una diapositiva por escena, útil para editar o imprimir.
3. Presentacion_Auditor_ReAct.html: un solo archivo con transiciones y revelado por pasos. Se avanza con las flechas o con clic, N muestra el guion y F activa la pantalla completa.

Hay dos versiones generadas del mismo contenido:

1. Completa, 31 escenas (unos 25 minutos): incluye herramientas, modelos, validación del evaluador, ablaciones, fidelidad por tarea, latencia y casos de uso. Sirve como respaldo para responder preguntas.
2. Corta, 17 escenas (unos 15 minutos), en los archivos con el sufijo _corta: problema, arquitectura, ciclo ReAct, procesamiento de datos, Auditor, diseño y pipeline de evaluación, resultado principal en las 50 consultas complejas, métricas RAGAS, control con las preguntas de los datasets, significancia, análisis de errores, demo y conclusiones.
