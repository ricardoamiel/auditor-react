#!/bin/bash
#SBATCH --job-name=nlpf_juez_multisalto
#SBATCH --partition=data-science
#SBATCH --cpus-per-task=8
#SBATCH --mem=48G
#SBATCH --time=03:00:00
#SBATCH --output=slurm/logs/%x_%j.out
# Faithfulness y Answer Relevance de las 50 consultas multisalto con Phi 4, y ejecución final del notebook
module load cuda/12.8 miniconda/3.0 >/dev/null 2>&1
export HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
PY=~/.conda/envs/nlp-p1/bin/python
cd ~/nlp_final
nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv
$PY codes/judge.py --multisalto
$PY -m nbconvert --to notebook --execute --inplace --ExecutePreprocessor.timeout=-1 notebooks/proyecto_final.ipynb
echo PIPELINE_OK
