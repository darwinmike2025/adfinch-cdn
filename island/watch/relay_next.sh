#!/bin/bash
# Waits for the next live chunk file and prints its path, or END when the run has finished
# and every chunk has been printed. Usage: relay_next.sh <live-dir> <chunk-number>
d="$1"; n=$(printf "%04d" "$2"); f="$d/chunk-$n.json"
for i in $(seq 1 120); do
  if [ -f "$f" ]; then echo "$f"; exit 0; fi
  if [ -f "$d/final.json" ] && [ ! -f "$f" ]; then echo END; exit 0; fi
  sleep 1
done
echo TIMEOUT
