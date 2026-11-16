#!/bin/bash
# Ejecuta todo el pipeline en cualquier máquina con GPU (Khipu, AWS o local). Cada etapa retoma desde su checkpoint.
# Uso: bash run_all.sh            (usa el python activo; instalar antes con: pip install -r requirements.txt)
set -e
cd "$(dirname "$0")"
PY=${PY:-python}
mkdir -p slurm/logs
[ -f data/index/embedder.txt ] || $PY codes/prepare_data.py --solo-indice     # corpus, consultas e índice
# Generación con 7B (núcleo y ablación del Auditor) y 1.5B (ablación de tamaño) en paralelo,
# y el juez evaluando cada respuesta apenas aparece. Juntos ocupan unos 18 GB de VRAM.
$PY codes/run_eval.py --modelo 7b --sistemas multi naive multi_sin_auditor > slurm/logs/gen_7b.log 2>&1 &
$PY codes/run_eval.py --modelo 1.5b --sistemas multi naive > slurm/logs/gen_15b.log 2>&1 &
sleep 90
$PY codes/judge.py --seguir > slurm/logs/juez.log 2>&1 &
wait
$PY codes/judge.py >> slurm/logs/juez.log 2>&1   # barrido final por si quedó alguna respuesta sin evaluar
# Consultas multisalto: dos documentos y un cálculo
$PY codes/multihop.py
$PY codes/run_eval.py --modelo 7b --sistemas naive multi multi_sin_auditor --consultas consultas_multisalto.json --carpeta multisalto
$PY codes/tablas_tex.py
$PY codes/export_web.py
$PY -m nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=-1 notebooks/proyecto_final.ipynb
echo PIPELINE_OK
