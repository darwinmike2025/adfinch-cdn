#!/bin/bash
# Runs N identical runs of a frozen protocol back to back.
#   controller/run_batch.sh v1 5 [live-dir-for-first-run]
P=$1; N=$2; LIVE=$3
cd "$(dirname "$0")/.."
for i in $(seq 1 $N); do
  echo "=== $P run $i of $N: $(date -u +%FT%TZ) ==="
  EXTRA=""; if [ $i -eq 1 ] && [ -n "$LIVE" ]; then EXTRA="--live-dir $LIVE --live-interval 20"; fi
  node controller/run_experiment.js --protocol $P --video --headless --auto-start $EXTRA
done
echo "=== batch done: $(date -u +%FT%TZ) ==="
