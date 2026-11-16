#!/bin/bash
#SBATCH --job-name=nlpf_gen
#SBATCH --partition=gpu
#SBATCH --cpus-per-task=8
#SBATCH --mem=48G
#SBATCH --time=1-00:00:00
#SBATCH --output=slurm/logs/%x_%j.out
# Uso: sbatch --gres=gpu:a100_2g.10gb:1 slurm/generate.sh   (o -w ds001 --gres=shard:8)
module load cuda/12.8 miniconda/3.0 >/dev/null 2>&1
export HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1 TOKENIZERS_PARALLELISM=false PY=~/.conda/envs/nlp-p1/bin/python
cd ~/nlp_final
# Túnel SOCKS al nodo de login para que la herramienta buscar_web tenga internet
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -f -N -D 1080 khipu && export ALL_PROXY=socks5h://localhost:1080 HTTPS_PROXY=socks5h://localhost:1080
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv
bash run_all.sh
