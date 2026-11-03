#!/bin/bash
# Train + export several scripts in sequence. Usage: bash run_queue.sh <threads> <id>...
export PYTHONUTF8=1
cd "$(dirname "$0")"
T=$1; shift
for id in "$@"; do
  mkdir -p out/$id; rm -f out/$id/train.log
  python train_script.py $id --threads $T > out/$id/stdout.log 2>&1 && python export_script.py $id >> out/$id/stdout.log 2>&1
  echo "$id exit $?" >> out/queue.log
done
