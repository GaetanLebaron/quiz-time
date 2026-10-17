"""Adds a batch of questions (tools/batches/*.py) to data/questions.json, after checking it.
Usage: python3 tools/add-batch.py tools/batches/geo-1.py [--dry]
Checks: fields, duplicates (against the existing bank and within the batch), wrong options
(at least 3, distinct from the answer), groups with at least 4 different answers,
numeric answers for the groups declared in ANNEES.
Capitalises the first letter of answers and wrong options (except MINUSCULE)."""
import json,sys,re,unicodedata,collections,runpy,os
QJ=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','data','questions.json')   # found whatever the current directory
lot=runpy.run_path(sys.argv[1]);dry='--dry' in sys.argv
TH,NV,Q=lot['THEME'],lot['NIVEAU'],lot['Q']
ANNEES=lot.get('ANNEES',set())   # groups whose answer is a year (wrong options = nearby years)
d=json.load(open(QJ,encoding='utf-8'))
norm=lambda t:re.sub(r'[^a-z0-9]','',unicodedata.normalize('NFD',t.lower()).encode('ascii','ignore').decode())
seen={norm(x['question']):x['question'] for x in d['questions']}
err=[];new=[]
MINUSCULE={'a-ha'}   # answers that keep their lowercase first letter (stylised proper names)
cap=lambda t:t if t in MINUSCULE or not t[:1].islower() else t[0].upper()+t[1:]   # "le Nil" becomes "Le Nil"
for i,e in enumerate(Q):
    g,q,a,f=e[:4];fa=e[4] if len(e)>4 else None
    a=cap(a);fa=[cap(t) for t in fa] if fa is not None else None
    if not q.strip().endswith('?'):err.append(f'#{i} pas de « ? » : {q}')
    if not a or not f:err.append(f'#{i} réponse ou anecdote vide : {q}')
    k=norm(q)
    if k in seen:err.append(f'#{i} doublon : {q}  ==  {seen[k]}')
    seen[k]=q
    if fa is not None and (len(fa)<3 or a in fa or len(set(fa))!=len(fa)):err.append(f'#{i} fausses propositions invalides : {q}')
    if fa is None and not g:err.append(f'#{i} ni groupe ni fausses propositions : {q}')
    x={'theme':TH,'niveau':NV};
    if g:x['groupe']=g
    if g in ANNEES:
        if not re.fullmatch(r'\d{3,4}',a):err.append(f'#{i} réponse qui n\'est pas une année : {q}')
    x.update(question=q,reponse=a,anecdote=f)
    if fa:x['fausses']=fa
    if g in ANNEES:x['annee']=True
    new.append(x)
allq=d['questions']+new
ans=collections.defaultdict(set)
for x in allq:
    if x.get('groupe'):ans[x['groupe']].add(x['reponse'])
for x in new:
    if not x.get('fausses') and not x.get('annee') and len(ans[x['groupe']])<4:err.append(f"groupe « {x['groupe']} » : moins de 4 réponses différentes ({x['question']})")
if err:print('\n'.join(err));sys.exit(1)
c=collections.Counter((x['theme'],x['niveau']) for x in allq)
print(f'{len(new)} questions ajoutées · thème {TH} niveau {NV} : {c[(TH,NV)]} · total : {len(allq)}')
if dry:sys.exit(0)
# same layout as the original file: one question per line, the batch inserted after the questions of the same theme and level
src=open(QJ,encoding='utf-8').read()
lines=src.split('\n');idx=[i for i,l in enumerate(lines) if l.startswith(' {"theme":')]
pos=max([i for i in idx if json.loads(lines[i].rstrip(',')).get('theme')==TH],default=idx[-1])
row=lambda x:' '+json.dumps(x,ensure_ascii=False,separators=(',',':'))
ins=[row(x)+',' for x in new]
if not lines[pos].endswith(','):lines[pos]+=',';ins[-1]=ins[-1][:-1]
lines[pos+1:pos+1]=ins
open(QJ,'w',encoding='utf-8').write('\n'.join(lines))
json.load(open(QJ,encoding='utf-8'))
