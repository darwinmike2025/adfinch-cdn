#!/bin/bash
# relay_wait.sh <live-dir> <next-chunk-number> [count]
# Waits until <count> new chunks exist (or the run ends), then prints the ready chunk numbers and a digest.
D=$1; N=$2; C=${3:-3}; T=0
while true; do
  last=$(ls $D | grep -o 'chunk-[0-9]*' | sed 's/chunk-0*//' | sort -n | tail -1); last=${last:-0}
  if [ -f $D/final.json ]; then echo "READY $N $last END"; break; fi
  if [ $((last - N + 1)) -ge $C ]; then echo "READY $N $last"; break; fi
  sleep 3; T=$((T+3)); if [ $T -ge 240 ]; then echo "READY $N $last TIMEOUT"; break; fi
done
python3 - "$D" "$N" "$last" <<'P'
import json,sys
d,n,l=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
for k in range(n,l+1):
  try: c=json.load(open('%s/chunk-%04d.json'%(d,k)))
  except Exception: continue
  for e in c['log']:
    if e['kind'] in ('reflection','speech','journal','body') or (e['kind']=='sound' and e.get('who')):
      m=e['msg'];
      print(int(e['sim'])//60, int(e['sim'])%60, e.get('who','-'), e['kind'], m[:160])
P
