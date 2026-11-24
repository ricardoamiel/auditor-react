#!/bin/bash
#SBATCH --job-name=nlpf_redactor_v2
#SBATCH --partition=data-science
#SBATCH --cpus-per-task=8
#SBATCH --mem=48G
#SBATCH --time=03:00:00
#SBATCH --output=slurm/logs/%x_%j.out
# Redactor que cita la evidencia: regenera los dos multiagente en las 50 consultas complejas y los juzga.
# Las respuestas y juicios anteriores quedan en results/multisalto/redactor_v1 para comparar.
module load cuda/12.8 miniconda/3.0 >/dev/null 2>&1
export HF_HUB_OFFLINE=1 HF_DATASETS_OFFLINE=1 TOKENIZERS_PARALLELISM=false
PY=~/.conda/envs/nlp-p1/bin/python
cd ~/nlp_final
ssh -o BatchMode=yes -o StrictHostKeyChecking=no -f -N -D 1080 khipu && export ALL_PROXY=socks5h://localhost:1080 HTTPS_PROXY=socks5h://localhost:1080
mkdir -p results/multisalto/redactor_v1
for s in multi_7b multi_sin_auditor_7b; do
  for f in respuestas juez; do
    [ -f results/multisalto/${f}_$s.jsonl ] && mv results/multisalto/${f}_$s.jsonl results/multisalto/redactor_v1/
  done
done
$PY codes/run_eval.py --modelo 7b --sistemas multi multi_sin_auditor --consultas consultas_multisalto.json --carpeta multisalto
$PY codes/judge.py --multisalto
echo PIPELINE_OK
