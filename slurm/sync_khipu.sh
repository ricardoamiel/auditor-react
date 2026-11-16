#!/bin/bash
# Copia cada 10 minutos los checkpoints de Khipu a esta carpeta (resultados, índice, figuras y logs)
cd "$(dirname "$0")/.."
KHIPU="${KHIPU:-usuario@khipu.utec.edu.pe}"  # exportar KHIPU con el usuario propio del clúster
while true; do
  for d in results data figures slurm/logs app/data; do
    rsync -az $KHIPU:~/nlp_final/$d/ ./$d/ 2>/dev/null
  done
  echo "$(date +%H:%M) sincronizado: $(cat results/respuestas_*.jsonl 2>/dev/null | wc -l) respuestas, $(cat results/juez_*.jsonl 2>/dev/null | wc -l) evaluadas"
  sleep 600
done
