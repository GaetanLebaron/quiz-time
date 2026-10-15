"""Ajoute un lot de questions (outils/lots/*.py) à questions.json, après vérification.
Usage : python3 outils/ajouter-lot.py outils/lots/geo-1.py [--dry]
Vérifie : champs, doublons (avec la banque existante et dans le lot), fausses propositions
(au moins 3, distinctes de la réponse), groupes ayant au moins 4 réponses différentes."""
import json,sys,re,unicodedata,collections,runpy
lot=runpy.run_path(sys.argv[1]);dry='--dry' in sys.argv
TH,NV,Q=lot['THEME'],lot['NIVEAU'],lot['Q']
d=json.load(open('questions.json',encoding='utf-8'))
norm=lambda t:re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFD',t.lower()).encode('ascii','ignore').decode())
seen={norm(x['question']):x['question'] for x in d['questions']}
err=[];new=[]
for i,e in enumerate(Q):
    g,q,a,f=e[:4];fa=e[4] if len(e)>4 else None
    if not q.strip().endswith('?'):err.append(f'#{i} pas de « ? » : {q}')
    if not a or not f:err.append(f'#{i} réponse ou anecdote vide : {q}')
    k=norm(q)
    if k in seen:err.append(f'#{i} doublon : {q}  ==  {seen[k]}')
    seen[k]=q
    if fa is not None and (len(fa)<3 or a in fa or len(set(fa))!=len(fa)):err.append(f'#{i} fausses propositions invalides : {q}')
    if fa is None and not g:err.append(f'#{i} ni groupe ni fausses propositions : {q}')
    x={'theme':TH,'niveau':NV};
    if g:x['groupe']=g
    x.update(question=q,reponse=a,anecdote=f)
    if fa:x['fausses']=fa
    new.append(x)
allq=d['questions']+new
ans=collections.defaultdict(set)
for x in allq:
    if x.get('groupe'):ans[x['groupe']].add(x['reponse'])
for x in new:
    if not x.get('fausses') and len(ans[x['groupe']])<4:err.append(f"groupe « {x['groupe']} » : moins de 4 réponses différentes ({x['question']})")
if err:print('\n'.join(err));sys.exit(1)
c=collections.Counter((x['theme'],x['niveau']) for x in allq)
print(f'{len(new)} questions ajoutées · thème {TH} niveau {NV} : {c[(TH,NV)]} · total : {len(allq)}')
if dry:sys.exit(0)
# même mise en forme que le fichier d'origine : une question par ligne, le lot inséré après les questions du même thème et niveau
src=open('questions.json',encoding='utf-8').read()
lines=src.split('\n');idx=[i for i,l in enumerate(lines) if l.startswith(' {"theme":')]
pos=max([i for i in idx if json.loads(lines[i].rstrip(',')).get('theme')==TH],default=idx[-1])
row=lambda x:' '+json.dumps(x,ensure_ascii=False,separators=(',',':'))
ins=[row(x)+',' for x in new]
if not lines[pos].endswith(','):lines[pos]+=',';ins[-1]=ins[-1][:-1]
lines[pos+1:pos+1]=ins
open('questions.json','w',encoding='utf-8').write('\n'.join(lines))
json.load(open('questions.json',encoding='utf-8'))
