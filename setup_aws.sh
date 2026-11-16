#!/bin/bash
# En la instancia con GPU: instala dependencias y retoma el pipeline desde los checkpoints incluidos
set -e
cd "$(dirname "$0")"
python -m pip install -q -r requirements.txt jupyter nbconvert ipykernel
nvidia-smi --query-gpu=name,memory.total --format=csv
nohup bash run_all.sh > slurm/logs/aws_run.log 2>&1 &
echo "Pipeline en segundo plano; progreso con: tail -f slurm/logs/aws_run.log"
