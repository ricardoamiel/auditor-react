#!/bin/bash
# Empaqueta el proyecto con sus checkpoints (sin pesos de modelos) para continuar en otra máquina
cd "$(dirname "$0")/.."
zip -qr auditor_react_traspaso.zip "final project" -x "*/models/*" "*/__pycache__/*" "*.ipynb_checkpoints*"
echo "Listo: $(pwd)/auditor_react_traspaso.zip ($(du -h auditor_react_traspaso.zip | cut -f1))"
