#!/bin/bash
#SBATCH --job-name=nlpf_smoke
#SBATCH --partition=gpu
#SBATCH --cpus-per-task=8
#SBATCH --mem=32G
#SBATCH --time=01:00:00
#SBATCH --output=slurm/logs/%x_%j.out
# Prueba corta: 2 consultas de cada tipo con el modelo indicado (por defecto 1.5b)
module load cuda/12.8 miniconda/3.0 >/dev/null 2>&1
export HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
cd ~/nlp_final
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -f -N -D 1080 khipu && export ALL_PROXY=socks5h://localhost:1080 HTTPS_PROXY=socks5h://localhost:1080
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv
~/.conda/envs/nlp-p1/bin/python codes/run_eval.py --modelo ${1:-1.5b} --sistemas naive multi --n 2
nvidia-smi --query-gpu=memory.used --format=csv
