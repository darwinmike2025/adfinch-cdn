import json,sys
d,a,b=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
for k in range(a,b+1):
  try: c=json.load(open('%s/chunk-%04d.json'%(d,k)))
  except: continue
  for e in c['log']:
    if e['kind'] in('speech','do','journal','body') or 'coin' in e['msg'].lower(): print(int(e['sim'])//60,int(e['sim'])%60,e.get('who'),e['msg'][:230])
