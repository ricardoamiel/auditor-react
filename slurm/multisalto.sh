#!/bin/bash
#SBATCH --job-name=nlpf_multisalto
#SBATCH --partition=gpu
#SBATCH --cpus-per-task=8
#SBATCH --mem=48G
#SBATCH --time=04:00:00
#SBATCH --output=slurm/logs/%x_%j.out
# Experimento multisalto (50 consultas que exigen dos documentos y un cálculo) y ejecución final del notebook
module load cuda/12.8 miniconda/3.0 >/dev/null 2>&1
export HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
PY=~/.conda/envs/nlp-p1/bin/python
cd ~/nlp_final
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -f -N -D 1080 khipu && export ALL_PROXY=socks5h://localhost:1080 HTTPS_PROXY=socks5h://localhost:1080
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv
$PY codes/multihop.py
$PY codes/run_eval.py --modelo 7b --sistemas naive multi multi_sin_auditor --consultas consultas_multisalto.json --carpeta multisalto
$PY -m nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=-1 notebooks/proyecto_final.ipynb
echo PIPELINE_OK
