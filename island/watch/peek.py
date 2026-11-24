# Latest spoken/do/journal/coin events of a run folder (any run, live or not): python3 peek.py <run-dir> [fromMinute]
import json,sys
d=sys.argv[1];m0=float(sys.argv[2]) if len(sys.argv)>2 else 0
for l in open(d+'/island-events.jsonl'):
  e=json.loads(l)
  if e['sim']/60<m0: continue
  if e['kind'] in('speech','do','journal') or ('coin' in e['msg'].lower() and e['kind'] in('object','complete')): print('%02d:%02d'%(e['sim']//60,e['sim']%60),e.get('who'),e['msg'][:210])
