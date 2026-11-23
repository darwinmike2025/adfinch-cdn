# Builds one person's own timeline (what they did, said, heard, saw, felt) from a run folder.
#   python3 controller/person_timeline.py runs/<run> a out.txt
import json,sys
R,who,out=sys.argv[1],sys.argv[2],sys.argv[3]
log=json.load(open(R+'/island-log.json')); tr=[json.loads(l) for l in open(R+'/transcript.jsonl')]
rows=[]
for e in log:
  if e.get('who')!=who: continue
  k=e['kind']; t=e['sim']; m=e['msg']; d=e.get('data') or {}
  if k=='reflection': rows.append((t,'SAYS',d['reflection']['text']))
  elif k=='speech': rows.append((t,'ALOUD',d['text']+(' (shouted)' if d.get('loud') else '')))
  elif k=='do': rows.append((t,'DOES-OWN-WORDS',d.get('text','')))
  elif k=='start': rows.append((t,'DOES',m.replace('Started: ','')))
  elif k in('complete','fail'): rows.append((t,'RESULT',(d.get('result') or {}).get('message') or m))
  elif k=='journal': rows.append((t,'JOURNAL',m))
  elif k in('object','sound','body'): rows.append((t,'EVENT',m))
seen=set()
for x in tr:
  if x.get('who')!=who or 'sentToAgent' not in x or 'Observation:\n' not in x['sentToAgent']: continue
  try: o=json.loads(x['sentToAgent'].split('Observation:\n')[1].split('\n\nWhat do you do?')[0])
  except Exception: continue
  for s in o.get('soundsHeard',[]):
    k=(round(o['simTimeSec']-s['secondsAgo']),s['description'])
    if k not in seen: seen.add(k); rows.append((k[0]+.01,'HEARS',s['description']))
  for n in o.get('happenedToYou',[]):
    k=('n',round(o['simTimeSec']-n['secondsAgo']),n['description'])
    if k not in seen: seen.add(k); rows.append((k[1]+.01,'PERCEIVES',n['description']))
  for p in [v for v in o['visibleObjects'] if v['type']=='person']:
    k=('p',p['name'],p['distanceFt']//60)
    if k not in seen: seen.add(k); rows.append((o['simTimeSec'],'SEES',p['description']+' (%d ft)'%p['distanceFt']))
rows.sort(key=lambda z:z[0])
with open(out,'w') as f:
  for t,k,m in rows: f.write('%02d:%02d %s %s\n'%(t//60,t%60,k,m))
print(out,len(rows))
