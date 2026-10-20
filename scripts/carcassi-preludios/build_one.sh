#!/bin/sh
# Usage: scripts/carcassi-preludios/build_one.sh N [carcassi|santisteban]
set -eu
number=$(printf "%02d" "$1")
edition=${2:-carcassi}
root=$(cd "$(dirname "$0")/../.." && pwd)
cd "$root"
case "$edition" in
  carcassi) .venv-carcassi/bin/python scripts/carcassi-preludios/transcribe_originals.py ;;
  santisteban) .venv-carcassi/bin/python "scripts/carcassi-preludios/transcribe_$number.py" ;;
  *) echo "Edición desconocida: $edition" >&2; exit 1 ;;
esac
.venv-carcassi/bin/python scripts/carcassi-preludios/extract.py build "$1" --edition "$edition"
folder=carcassi-preludios
if [ "$edition" = santisteban ]; then folder=santisteban-preludios; fi
mkdir -p .work
for pdf in "downloads/$folder/Prelude $1 in "*.pdf; do
  pdftoppm -r 80 -png "$pdf" ".work/$edition-$number"
done
