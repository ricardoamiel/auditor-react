#!/bin/bash
#SBATCH --job-name=nlpf_server
#SBATCH --partition=gpu
#SBATCH --gres=shard:8
#SBATCH --cpus-per-task=4
#SBATCH --mem=24G
#SBATCH --time=03:00:00
#SBATCH --output=slurm/logs/%x_%j.out
# Sirve el grafo con Qwen2.5 7B para la aplicación web (motor Servidor).
# Desde la laptop: ssh -N -L 8000:NODO:8000 usuario@khipu.utec.edu.pe   (NODO sale en el log o en squeue)
module load cuda/12.8 miniconda/3.0 >/dev/null 2>&1
export HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
cd ~/nlp_final
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -f -N -D 1080 khipu && export ALL_PROXY=socks5h://localhost:1080 HTTPS_PROXY=socks5h://localhost:1080
echo "Nodo: $(hostname)"
~/.conda/envs/nlp-p1/bin/python app/server.py
