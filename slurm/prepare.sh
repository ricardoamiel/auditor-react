#!/bin/bash
#SBATCH --job-name=nlpf_prep
#SBATCH --partition=standard
#SBATCH --cpus-per-task=32
#SBATCH --mem=48G
#SBATCH --time=02:00:00
#SBATCH --output=slurm/logs/%x_%j.out
# Corpus, consultas, índice FAISS y ablación de recuperación (solo CPU, sin internet)
module load miniconda/3.0 >/dev/null 2>&1
export HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1 OMP_NUM_THREADS=32
cd ~/nlp_final
~/.conda/envs/nlp-p1/bin/python codes/prepare_data.py
