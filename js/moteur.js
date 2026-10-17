/* ---------- Moteur de la partie avec Maître du Jeu (sur l'écran TV). La partie sans Maître du Jeu est dans libre.js. ---------- */
const qk=q=>q.q+'|'+q.a;
/* Mode Crescendo : les tours sont répartis entre les niveaux choisis, du plus facile au plus difficile.
   Ex. 5 tours sur les niveaux 1, 3 et 5 → 1, 1, 3, 3, 5 (les premiers niveaux reçoivent les tours en plus). */
const lvPlan=(lv,rounds)=>Array.from({length:rounds},(_,r)=>lv[Math.floor(r*lv.length/rounds)]);
const curLv=()=>S.lvl?S.lvl[S.round]:S.level;
function pick(th){
  const pool=Q.filter(q=>q.th==th);let c=pool.filter(q=>!S.used.has(q));
  if(!c.length){pool.forEach(q=>S.used.delete(q));c=pool}
  const L=curLv(),d=Math.min(...c.map(q=>Math.abs(q.l-L)));
  const r=c.filter(q=>Math.abs(q.l-L)==d);
  const q=r[Math.random()*r.length|0];S.used.add(q);return q;
}
function mkOpts(q){
  let w=[];
  if(q.w&&q.w.length>=3)w=shuf(q.w).slice(0,3);
  else if(q.yr&&/^\d+$/.test(q.a)){const s=new Set(),max=new Date().getFullYear(),sp=q.l>=4?8:q.l==3?12:20;while(s.size<3){const o=+q.a+(Math.random()*2*sp-sp|0);if(o>0&&o<=max&&String(o)!=q.a)s.add(String(o))}w=[...s]}   /* années proches (plus serrées aux niveaux élevés), jamais dans le futur */
  else{
    const seen=new Set([q.a]);
    /* D'abord les réponses du même groupe et d'un niveau voisin : aux niveaux difficiles, les leurres sont eux aussi pointus */
    for(const pool of [Q.filter(x=>x.g&&x.g==q.g&&Math.abs(x.l-q.l)<=1),Q.filter(x=>x.g&&x.g==q.g),Q.filter(x=>x.th==q.th),Q]){
      for(const x of shuf(pool)){if(w.length>=3)break;if(!seen.has(x.a)){seen.add(x.a);w.push(x.a)}}
      if(w.length>=3)break;
    }
  }
  return shuf([q.a,...w]);
}
/* Timer : tEnd = instant de fin (horloge de la TV). Au changement d'équipe, on laisse passer l'animation avant de décompter. */
function armTimer(afterOverlay){S.tEnd=S.tt?Date.now()+S.tt*1000+(afterOverlay?OVL_MS:0):0}
const tlNow=()=>S&&S.tt?Math.max(0,Math.min(S.tt*1000,S.tEnd-Date.now())):0;

function startGame(c){
  const teams=(c.teams||[]).map(n=>String(n).trim().slice(0,24)).filter(Boolean).slice(0,8);
  if(teams.length<2)return;
  const lv=c.mode=='cresc'&&Array.isArray(c.levels)?[...new Set(c.levels.map(Number))].filter(l=>l>=1&&l<=LV.length).sort((a,b)=>a-b):[];
  const cr=lv.length>=2;
  const rounds=Math.max(cr?lv.length:1,Math.min(30,+c.rounds||5)),level=cr?lv[0]:Math.max(1,Math.min(LV.length,+c.level||2));
  let tt=Math.round(+c.timer||0);tt=tt>0?Math.max(5,Math.min(300,tt)):0;
  const bag=[];while(bag.length<rounds)bag.push(...shuf(THEMES.map((_,i)=>i)));
  S={gid:Date.now(),date:Date.now(),teams:teams.map(n=>({n,s:0})),rounds,level,tt,tEnd:0,lvl:cr?lvPlan(lv,rounds):null,themes:bag.slice(0,rounds),round:0,ti:0,used:new Set(),phase:'rules',opts:null,hid:[],pts:0};
  S.q=pick(S.themes[0]);armTimer(true);scr='game';
}
function next(){
  S.ti++;if(S.ti>=S.teams.length){S.ti=0;S.round++}
  if(S.round>=S.rounds){scr='end';return}
  S.q=pick(S.themes[S.round]);S.opts=null;S.hid=[];S.pick=null;S.phase='q';armTimer(true);
}
const pub=()=>S&&(S.free?fpub():{gid:S.gid,teams:S.teams,rounds:S.rounds,round:S.round,ti:S.ti,level:S.level,lv:curLv(),cr:!!S.lvl,th:S.themes[S.round],
  q:S.q?{q:S.q.q,a:S.q.a,l:S.q.l,f:S.q.f}:null,phase:S.phase,opts:S.opts,hid:S.hid,pts:S.pts,pick:S.pick,tt:S.tt||0,tl:tlNow(),
  last:S.round==S.rounds-1&&S.ti==S.teams.length-1});

function onCmd(m){
  if(fCmd(m)){}   /* partie sans Maître du Jeu (libre.js) */
  else if(m.t=='start')startGame(m.cfg||{});
  else if(m.t=='replay'||m.t=='pause'){saveS();S=null;scr='cfgd';lsSet(CK,null)}
  else if(m.t=='resume'){const g=findG(m.p);if(g&&g.scr!='end'&&!(HOSTL&&!g.S.free)){saveS();restore(g);if(S.free&&m.pid)S.host=m.pid}}
  else if(S&&m.t=='finish'&&scr=='game'){scr='end'}
  else if(m.t=='del'){lsSet(GK,(lsGet(GK)||[]).filter(g=>g.id!=m.p))}
  /* Les règles s'affichent sur la TV avant la première question, jusqu'à ce que le Maître du Jeu lance la partie. */
  else if(S&&m.t=='begin'&&S.phase=='rules'){S.phase='q';armTimer(true)}
  else if(S&&m.t=='show'&&S.phase=='q'){S.opts=mkOpts(S.q);S.phase='m'}
  else if(S&&m.t=='fifty'&&S.phase=='m'){S.hid=shuf(S.opts.filter(o=>o!=S.q.a)).slice(0,2);S.phase='f'}
  else if(S&&m.t=='ans'&&S.phase=='q'&&[0,5].includes(m.p)){S.teams[S.ti].s+=m.p;S.pts=m.p;S.pick=null;S.phase='r'}
  /* Réponse choisie parmi les propositions (c) ou aucune réponse (c null) : la TV calcule les points. */
  else if(S&&m.t=='ans'&&(S.phase=='m'||S.phase=='f')&&(m.c==null||(S.opts.includes(m.c)&&!S.hid.includes(m.c)))){
    const p=m.c==S.q.a?(S.phase=='m'?3:1):0;S.teams[S.ti].s+=p;S.pts=p;S.pick=m.c==null?null:m.c;S.phase='r'}
  else if(S&&m.t=='next'&&S.phase=='r')next();
  saveS();push();render();
}

/* ---------- Sauvegarde des parties (navigateur de la TV) ---------- */
function saveS(){
  if(!S)return;
  const g={id:S.gid,date:S.date,scr,S:{...S,q:S.q?qk(S.q):null,used:[...S.used].map(qk)}};
  lsSet(GK,[g,...(lsGet(GK)||[]).filter(x=>x.id!=S.gid)].slice(0,10));lsSet(CK,S.gid);
}
function restore(g){
  if(!g||!g.S)return;
  const s=g.S;
  S={...s,used:new Set((s.used||[]).map(k=>QMAP.get(k)).filter(Boolean)),q:QMAP.get(s.q)||null};
  scr=g.scr;
  if(scr=='game'&&!S.q){if(S.free)fq();else{S.q=pick(S.themes[S.round]);S.opts=null;S.hid=[];S.phase='q'}}
  armTimer(false);
}
const findG=id=>(lsGet(GK)||[]).find(g=>g.id==id);
/* Sans TV (?host), seule une partie sans Maître du Jeu peut reprendre : une partie avec Maître du Jeu laissée sur ce téléphone est ignorée. */
const loadS=()=>{restore(findG(lsGet(CK)));if(HOSTL&&S&&!S.free){S=null;scr='cfgd';lsSet(CK,null)}};
const gsum=()=>(lsGet(GK)||[]).filter(g=>g&&g.S&&Array.isArray(g.S.teams))   /* ignore une sauvegarde abîmée au lieu de bloquer l'envoi */
  .map(g=>({id:g.id,date:g.date,rounds:g.S.rounds,round:g.S.round,done:g.scr=='end',cr:!!g.S.lvl,free:!!g.S.free,teams:g.S.teams.map(t=>({n:t.n,s:t.s}))}));

