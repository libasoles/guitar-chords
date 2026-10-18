#!/bin/sh
# Uso: scripts/carcassi-preludios/build_one.sh N  -> transcribe_NN.py + extract.py build N + PNG de revision en .work/
set -e
N=$(printf "%02d" "$1")
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
cd "$ROOT/scripts/carcassi-preludios" && "$ROOT/.venv-carcassi/bin/python" "transcribe_$N.py"
cd "$ROOT" && .venv-carcassi/bin/python scripts/carcassi-preludios/extract.py build "$1"
pdf=$(ls downloads/carcassi-preludios/"Prelude $1 in "*.pdf)
pdftoppm -r 80 -png "$pdf" ".work/out$N"
ls .work/out$N*
