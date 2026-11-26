# Agent words (say + action) from a run's transcript after a given sim second: python3 says.py <run-dir> <fromSec>
import json,sys
d,t0=sys.argv[1],float(sys.argv[2])
for l in open(d+'/transcript.jsonl'):
  t=json.loads(l)
  if t.get('reply') and t.get('simAtReply',0)>t0:
    a={k:v for k,v in (t['reply'].get('action') or {}).items() if v is not None}
    print(t.get('agent'),int(t['simAtReply']),(t['reply'].get('say') or '')[:160],'|',json.dumps(a)[:130])
