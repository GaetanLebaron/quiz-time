/* Quiz Time : écran TV + télécommande du Maître du Jeu.
   Les questions sont dans questions.json. Les deux appareils s'échangent leurs messages via ntfy.sh (sans compte). */

const BASE=window.QT_BASE||'https://ntfy.sh/';   /* QT_BASE : autre serveur ntfy (tests, serveur personnel) */
const OVL_MS=2000;   /* durée de l'animation de changement d'équipe */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const plural=(n,w)=>n+' '+w+(n>1?'s':'');
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const rawGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const rawSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const rawDel=k=>{try{localStorage.removeItem(k)}catch(e){}};

/* ---------- Rôle de l'appareil : écran TV ou télécommande ---------- */
const okId=s=>/^[a-z0-9]{6,40}$/i.test(s||'');
const P=new URLSearchParams(location.search);
let JOIN=null;
const SCAN=P.has('forget');   /* ?forget : le téléphone oublie l'écran mémorisé et attend un nouveau scan */
if(SCAN)rawDel('qt-join');
else if(P.has('tv')){rawDel('qt-join');try{history.replaceState(null,'',location.pathname)}catch(e){}}
else if(okId(P.get('join'))){JOIN=P.get('join');rawSet('qt-join',JOIN)}
else if(okId(rawGet('qt-join')))JOIN=rawGet('qt-join');
const TV=!JOIN&&!SCAN;
document.body.classList.toggle('tv',TV);

/* ---------- État ---------- */
let THEMES=[],LV=[],Q=[],QMAP=new Map();
let cfg=Object.assign({teams:['Équipe 1','Équipe 2'],rounds:5,level:2,timerOn:false,timerSec:30},lsGet('qt-cfg')||{});
if(!Array.isArray(cfg.teams)||cfg.teams.length<2)cfg.teams=['Équipe 1','Équipe 2'];
cfg.teams=cfg.teams.slice(0,8).map(t=>String(t).slice(0,24));
const saveCfg=()=>lsSet('qt-cfg',cfg);
let S=null,st=null,scr=TV?'wait':'conn',conn=false,joinUrl='',err='';
let tvOk=false,pOk=false,cOk=false,gl=[],recvAt=0,lastKey=null;
const t0=Date.now();
const GK='quiz-time-games',CK='quiz-time-cur';

/* ---------- Moteur (écran TV uniquement) ---------- */
const qk=q=>q.q+'|'+q.a;
function pick(th){
  const pool=Q.filter(q=>q.th==th);let c=pool.filter(q=>!S.used.has(q));
  if(!c.length){pool.forEach(q=>S.used.delete(q));c=pool}
  const d=Math.min(...c.map(q=>Math.abs(q.l-S.level)));
  const r=c.filter(q=>Math.abs(q.l-S.level)==d);
  const q=r[Math.random()*r.length|0];S.used.add(q);return q;
}
function mkOpts(q){
  let w=[];
  if(q.w&&q.w.length>=3)w=shuf(q.w).slice(0,3);
  else if(q.yr&&/^\d+$/.test(q.a)){const s=new Set();while(s.size<3){const o=+q.a+(Math.random()*40-20|0);if(o>0&&String(o)!=q.a)s.add(String(o))}w=[...s]}
  else{
    const seen=new Set([q.a]);
    for(const pool of [Q.filter(x=>x.g&&x.g==q.g),Q.filter(x=>x.th==q.th),Q]){
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
  const rounds=Math.max(1,Math.min(30,+c.rounds||5)),level=Math.max(1,Math.min(LV.length,+c.level||2));
  let tt=Math.round(+c.timer||0);tt=tt>0?Math.max(5,Math.min(300,tt)):0;
  const bag=[];while(bag.length<rounds)bag.push(...shuf(THEMES.map((_,i)=>i)));
  S={gid:Date.now(),date:Date.now(),teams:teams.map(n=>({n,s:0})),rounds,level,tt,tEnd:0,themes:bag.slice(0,rounds),round:0,ti:0,used:new Set(),phase:'q',opts:null,hid:[],pts:0};
  S.q=pick(S.themes[0]);armTimer(true);scr='game';
}
function next(){
  S.ti++;if(S.ti>=S.teams.length){S.ti=0;S.round++}
  if(S.round>=S.rounds){scr='end';return}
  S.q=pick(S.themes[S.round]);S.opts=null;S.hid=[];S.phase='q';armTimer(true);
}
const pub=()=>S&&{teams:S.teams,rounds:S.rounds,round:S.round,ti:S.ti,level:S.level,th:S.themes[S.round],
  q:S.q?{q:S.q.q,a:S.q.a,l:S.q.l,f:S.q.f}:null,phase:S.phase,opts:S.opts,hid:S.hid,pts:S.pts,tt:S.tt||0,tl:tlNow(),
  last:S.round==S.rounds-1&&S.ti==S.teams.length-1};

function onCmd(m){
  if(m.t=='start')startGame(m.cfg||{});
  else if(m.t=='replay'||m.t=='pause'){saveS();S=null;scr='cfgd';lsSet(CK,null)}
  else if(m.t=='resume'){const g=findG(m.p);if(g&&g.scr!='end'){saveS();restore(g)}}
  else if(S&&m.t=='finish'&&scr=='game'){scr='end'}
  else if(m.t=='del'){lsSet(GK,(lsGet(GK)||[]).filter(g=>g.id!=m.p))}
  else if(S&&m.t=='show'&&S.phase=='q'){S.opts=mkOpts(S.q);S.phase='m'}
  else if(S&&m.t=='fifty'&&S.phase=='m'){S.hid=shuf(S.opts.filter(o=>o!=S.q.a)).slice(0,2);S.phase='f'}
  else if(S&&m.t=='ans'&&S.phase!='r'&&[0,1,3,5].includes(m.p)){S.teams[S.ti].s+=m.p;S.pts=m.p;S.phase='r'}
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
  if(scr=='game'&&!S.q){S.q=pick(S.themes[S.round]);S.opts=null;S.hid=[];S.phase='q'}
  armTimer(false);
}
const findG=id=>(lsGet(GK)||[]).find(g=>g.id==id);
const loadS=()=>restore(findG(lsGet(CK)));
const gsum=()=>(lsGet(GK)||[]).filter(g=>g&&g.S&&Array.isArray(g.S.teams))   /* ignore une sauvegarde abîmée au lieu de bloquer l'envoi */
  .map(g=>({id:g.id,date:g.date,rounds:g.S.rounds,round:g.S.round,done:g.scr=='end',teams:g.S.teams}));

/* ---------- Transport : messages via ntfy.sh ---------- */
const T=TV?(()=>{let id=rawGet('qt-id2');if(!okId(id)){id='qt'+Array.from(crypto.getRandomValues(new Uint8Array(14)),b=>(b%36).toString(36)).join('');rawSet('qt-id2',id)}return id})():JOIN;
const OUT=BASE+T+(TV?'s':'c'),IN=BASE+T+(TV?'c':'s');
/* État de la liaison, affiché à l'écran pour comprendre un blocage. 429 = le service gratuit limite le nombre de requêtes. */
const net={fail:'',why:'',got:0,ok:0,sse:'',poll:'',polled:null};
const codeTag=()=>'…'+String(T).slice(-4);
const refreshNet=()=>{if(TV?scr=='wait':scr=='conn')render()};
/* File d'envoi : un message à la fois, dans l'ordre. En cas d'échec (429, réseau, serveur), le même message est renvoyé
   avec une attente croissante (5 s, 10 s… 60 s) au lieu d'être perdu. Seul le dernier état de la TV compte : un nouvel état
   remplace celui qui attend encore. Un seul « hello » en attente à la fois. */
const SEND_MS=window.QT_SEND_MS||5000;
const outQ=[];let sending=false,sendT=0,sendDelay=0,lastHello=0;
function say(m){
  const last=outQ[outQ.length-1];
  if(m.k=='s'&&last&&last.k=='s'&&!(sending&&outQ.length==1)){m.ask=m.ask||last.ask;outQ[outQ.length-1]=m}
  else if(m.t=='hello'&&outQ.some((x,i)=>x.t=='hello'&&!(sending&&i==0)))return;
  else outQ.push(m);
  if(m.t=='hello')lastHello=Date.now();
  if(!sending&&!sendT)flush();
}
function retryNow(){if(sendT){clearTimeout(sendT);sendT=0;sendDelay=0;flush()}}
function flush(){
  sendT=0;if(sending||!outQ.length)return;
  sending=true;const m=outQ[0];
  const done=(ok,fail,why)=>{
    sending=false;
    if(ok||fail=='drop'){outQ.shift();sendDelay=0;if(ok){net.fail='';net.why='';net.ok++}flush()}
    else{net.fail=fail;net.why=why||'';sendDelay=Math.min(60000,sendDelay?sendDelay*2:SEND_MS);sendT=setTimeout(flush,sendDelay)}
    refreshNet();
  };
  fetch(OUT,{method:'POST',body:JSON.stringify(m)}).then(r=>{
    if(r.ok)return done(true);
    /* Le service renvoie un JSON {"error":"…"} qui précise la limite atteinte. */
    r.text().then(t=>{let w='';try{w=JSON.parse(t).error||''}catch(e){}
      /* 4xx autre que 429 (message refusé) : inutile de réessayer. */
      if(r.status>=400&&r.status<500&&r.status!=429){net.fail='HTTP '+r.status;net.why=w;return done(false,'drop')}
      done(false,r.status==429?'429':'HTTP '+r.status,w);
    },()=>done(false,r.status==429?'429':'HTTP '+r.status));
  }).catch(()=>done(false,'réseau'));
}
/* Écoute des messages. Reconnexion avec attente croissante (5 s, 10 s… 60 s) pour ne pas saturer le service, et reprise après le dernier message reçu.
   Sur le téléphone (fallback), si la liaison temps réel est fermée ou si la TV ne répond pas, une lecture directe des derniers messages prend le relais. */
const POLL_MS=window.QT_POLL_MS||10000,POLL_FIRST=window.QT_POLL_FIRST||4000,HELLO_MS=window.QT_HELLO_MS||30000;
let pollNow=()=>{};
function listen(h,onState,fallback){
  let es=null,delay=0,lastId='',lastTime=0,isOpen=false;const seen=new Set();
  const handle=txt=>{try{
    const d=JSON.parse(txt);
    if(d.event&&d.event!='message')return;
    if(d.id){if(seen.has(d.id))return;seen.add(d.id);if(seen.size>100)seen.delete(seen.values().next().value);lastId=d.id}
    if(d.time){if(lastTime&&d.time<lastTime-1)return;lastTime=Math.max(lastTime,d.time)}   /* ignore un éventuel rejeu d'anciens messages */
    net.got++;h(JSON.parse(d.message));
  }catch(x){}};
  const open=()=>{
    es=new EventSource(IN+'/sse'+(lastId?'?since='+encodeURIComponent(lastId):''));
    es.onopen=()=>{delay=0;isOpen=true;net.sse='ouverte';onState(true)};
    es.onerror=()=>{isOpen=false;net.sse='fermée';onState(false);try{es.close()}catch(e){}delay=Math.min(60000,delay?delay*2:5000);setTimeout(open,delay)};
    es.onmessage=e=>handle(e.data);
  };
  open();
  if(fallback){
    /* Lecture directe toutes les 10 s, espacée jusqu'à 60 s si le service répond 429. Tant que la TV n'a pas répondu,
       un « hello » est renvoyé toutes les 30 s : une réponse perdue ne bloque plus la connexion. */
    let pollT=0,pollDelay=POLL_MS,busy=false;
    const poll=()=>{
      clearTimeout(pollT);pollT=setTimeout(poll,pollDelay);
      if(busy||(isOpen&&scr!='conn'))return;   /* tout va bien */
      if(scr=='conn'&&Date.now()-lastHello>=HELLO_MS)say({t:'hello'});
      busy=true;
      fetch(IN+'/json?poll=1&since='+(lastId?encodeURIComponent(lastId):'5m'))
        .then(r=>{
          if(!r.ok){net.poll=r.status==429?'service saturé (429)':'HTTP '+r.status;pollDelay=Math.min(60000,pollDelay*2);return ''}
          net.poll='OK';pollDelay=POLL_MS;return r.text();
        })
        .then(t=>{const L=String(t).split('\n').filter(Boolean);if(net.poll=='OK')net.polled=L.length;L.forEach(handle)})
        .catch(()=>{net.poll='erreur réseau'})
        .finally(()=>{busy=false;refreshNet()});
    };
    pollT=setTimeout(poll,POLL_FIRST);
    pollNow=()=>{pollDelay=POLL_MS;poll()};
  }
}
const push=ask=>say({k:'s',scr,s:pub(),ask:ask===true,g:scr=='cfgd'?gsum().slice(0,6):undefined});
function tvInit(){
  joinUrl=location.href.split('#')[0].split('?')[0]+'?join='+T;
  listen(m=>{conn=true;if(m.t=='hello'&&!S)scr='cfgd';onCmd(m)},ok=>{tvOk=ok;render()});
  if(S)push(true);
}
function ctlInit(){
  listen(d=>{
    if(d.k=='s'){cOk=true;scr=d.scr;st=d.s;recvAt=Date.now();if(d.g)gl=d.g;if(d.ask)say({t:'hello'})}
    render();
  },ok=>{pOk=ok;if(ok)say({t:'hello'});render()},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)say({t:'hello'})});
}
const cmd=(t,p)=>say({t,p});
function go(){
  if(cfg.teams.map(n=>n.trim()).filter(Boolean).length<2){alert('Ajoutez au moins deux équipes.');return}
  say({t:'start',cfg:{teams:cfg.teams,rounds:cfg.rounds,level:cfg.level,timer:cfg.timerOn?cfg.timerSec:0}});
}

/* ---------- Timer (affichage) ---------- */
const tmrHTML=s=>s&&s.tt&&s.phase!='r'?`<div class="tmr" id="tmr"><div class="tmr-bar"><i id="tmrb"></i></div><span id="tmrv">${s.tt} s</span></div>`:'';
function tick(){
  const box=document.getElementById('tmr');if(!box)return;
  const s=TV?pub():st;if(!s||!s.tt)return;
  const ms=TV?s.tl:Math.max(0,s.tl-(Date.now()-recvAt));
  const sec=Math.ceil(ms/1000);
  document.getElementById('tmrv').textContent=ms<=0?'Temps écoulé !':sec+' s';
  document.getElementById('tmrb').style.width=Math.min(100,ms/(s.tt*1000)*100)+'%';
  box.classList.toggle('low',ms>0&&sec<=5);box.classList.toggle('zero',ms<=0);
}

/* ---------- Animation de changement d'équipe (écran TV) ---------- */
function teamOverlay(){
  if(!S||scr!='game')return;
  const key=S.gid+'-'+S.round+'-'+S.ti;
  if(key===lastKey)return;
  lastKey=key;
  if(S.phase!='q')return;
  const th=THEMES[S.themes[S.round]];
  const d=document.createElement('div');d.className='ovl';
  d.innerHTML=`<div class="ovl-in"><span>Au tour de</span><b>${esc(S.teams[S.ti].n)}</b><i style="color:${th.c}">${th.e} ${esc(th.n)}</i></div>`;
  document.body.appendChild(d);setTimeout(()=>d.remove(),OVL_MS+100);
}

/* ---------- Vues ---------- */
function renderSetup(){
  $('#meta').textContent='Console du Maître du Jeu · '+Q.length+' questions en banque';
  return `<div class="setup">
  <section class="card"><h3>Équipes</h3>
    ${cfg.teams.map((t,i)=>`<div class="row"><input type="text" value="${esc(t)}" maxlength="24" aria-label="Nom de l'équipe ${i+1}" oninput="cfg.teams[${i}]=this.value;saveCfg()"><button class="btn x" onclick="rmTeam(${i})" aria-label="Retirer l'équipe">✕</button></div>`).join('')}
    <button class="btn mut" onclick="addTeam()" ${cfg.teams.length>=8?'disabled':''}>+ Ajouter une équipe</button>
  </section>
  <section class="card"><h3>Nombre de tours</h3>
    <div class="row" style="align-items:center"><input type="number" min="1" max="30" value="${cfg.rounds}" aria-label="Nombre de tours" oninput="cfg.rounds=Math.max(1,Math.min(30,+this.value||1));saveCfg()"><span class="sub">Un tour = une question par équipe</span></div>
  </section>
  <section class="card"><h3>Niveau de difficulté</h3>
    <div class="lv">${LV.map((l,i)=>`<button class="btn ${cfg.level==i+1?'on':''}" onclick="cfg.level=${i+1};saveCfg();render()"><b>${i+1}</b><i>${esc(l)}</i></button>`).join('')}</div>
  </section>
  <section class="card"><h3>Timer</h3>
    <label class="chk"><input type="checkbox" ${cfg.timerOn?'checked':''} onchange="cfg.timerOn=this.checked;saveCfg();render()"><span>Compte à rebours pour chaque question</span></label>
    ${cfg.timerOn?`<div class="row" style="align-items:center"><input type="number" min="5" max="300" value="${cfg.timerSec}" aria-label="Durée en secondes" oninput="cfg.timerSec=Math.max(5,Math.min(300,+this.value||30));saveCfg()"><span class="sub">secondes par question (5 à 300)</span></div>`:''}
  </section>
  <button class="btn pink big" onclick="go()">Lancer la partie</button>${savedHTML()}
  <p class="foot sub"><a href="?tv">Utiliser cet appareil comme écran TV</a></p></div>`;
}
const addTeam=()=>{cfg.teams.push('Équipe '+(cfg.teams.length+1));saveCfg();render()};
const rmTeam=i=>{if(cfg.teams.length>2){cfg.teams.splice(i,1);saveCfg();render()}};

const fmtD=t=>new Date(t).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function savedHTML(){
  if(!gl.length)return'';
  const row=g=>`<div class="anec" style="margin:0"><b>${fmtD(g.date)} · ${g.done?'Terminée':'Tour '+(g.round+1)+' / '+g.rounds}</b><p>${[...g.teams].sort((a,b)=>b.s-a.s).map(t=>esc(t.n)+' '+t.s).join(' · ')}</p><div class="row" style="margin:8px 0 0">${g.done?'':`<button class="btn" onclick="cmd('resume',${+g.id})">Reprendre</button>`}<button class="btn x" onclick="if(confirm('Supprimer cette partie ?'))cmd('del',${+g.id})">Supprimer</button></div></div>`;
  return `<section class="card"><h3>Parties enregistrées</h3><div style="display:grid;gap:10px">${gl.map(row).join('')}</div></section>`;
}
function board(s,cur){
  const r=s.teams.map((t,i)=>({...t,i})).sort((a,b)=>b.s-a.s||a.i-b.i);
  return `<aside class="card score"><h3>Classement</h3><ol>${r.map((t,k)=>`<li class="${cur&&t.i==s.i0?'cur':''}"><span class="rk">${k+1}</span><span class="nm">${esc(t.n)}</span><span class="pt">${t.s}</span></li>`).join('')}</ol></aside>`;
}
function head(s){
  const th=THEMES[s.th],dots=Array.from({length:s.rounds},(_,i)=>`<i class="${i<s.round?'d':i==s.round?'c':''}"></i>`).join('');
  return `<div class="bar" style="margin-bottom:16px"><span>Tour ${s.round+1} / ${s.rounds}</span><span class="dots">${dots}</span></div>
  <div class="ctx"><div class="who"><span>Au tour de</span>${esc(s.teams[s.ti].n)}</div><div class="theme" style="--c:${th.c}">${th.e} ${esc(th.n)}</div></div>`;
}
function optsHTML(s,mark){
  return s.opts?`<div class="opts">${s.opts.map((o,i)=>`<div class="opt ${mark&&o==s.q.a?'ok':''} ${s.hid.includes(o)?'off':''}">${'ABCD'[i]}. ${esc(o)}${mark&&o==s.q.a?' ✓':''}</div>`).join('')}</div>`:'';
}
const verdict=s=>s.pts?`<div class="res good">Bonne réponse ! +${plural(s.pts,'point')}</div>`:`<div class="res bad">Mauvaise réponse · c'était : ${esc(s.q.a)}</div>`;
function endHTML(s,ctl){
  const top=Math.max(...s.teams.map(t=>t.s)),w=s.teams.filter(t=>t.s==top).map(t=>t.n);
  return `<div class="end"><p class="sub">${w.length>1?'Égalité entre':'Victoire de'}</p><div class="win">🏆 ${esc(w.join(' & '))}</div>
  <div style="text-align:left;margin-bottom:20px">${board({...s,i0:-1},false)}</div>${ctl?'<button class="btn pink big" onclick="cmd(\'replay\')">Nouvelle partie</button>':''}</div>`;
}
const netHTML=()=>`<p class="st sub" style="font-size:.85rem">Code de l'écran : ${esc(codeTag())} · Envoi : ${net.fail?'⚠ '+esc((net.fail=='429'?'service saturé (429)':net.fail)+(net.why?' « '+net.why+' »':'')+(outQ.length?', nouvel essai en cours':'')):(net.ok?'OK':'en attente')} · Messages reçus : ${net.got}</p>`+(net.sse||net.poll?`<p class="st sub" style="font-size:.85rem">Réception en temps réel : ${esc(net.sse||'…')}${net.poll?` · Lecture directe : ${esc(net.poll)}${net.polled!=null?' ('+net.polled+' message(s) de la TV)':''}`:''}</p>`:'');
function connHelp(){
  const sat=net.fail=='429'||/429/.test(net.poll);
  let titre,texte;
  if(sat){titre='Service de messages saturé';texte='Le service gratuit limite le nombre de requêtes par connexion Internet, et la TV et le téléphone sur le même Wi-Fi comptent ensemble. Passez le téléphone en données mobiles (Wi-Fi coupé) ou fermez les autres pages Quiz Time et patientez 2 minutes : les messages sont renvoyés automatiquement.'}
  else if(net.poll=='OK'&&net.polled===0){titre="La TV ne publie aucun message";texte="Le service n'a rien reçu de la TV : elle n'arrive pas à répondre. Vérifiez que la page de la TV est ouverte, active et connectée à Internet, puis touchez Relancer."}
  else if(net.sse=='fermée'){titre='Liaison temps réel bloquée';texte='La lecture de secours est active : la connexion peut prendre une dizaine de secondes. Si elle échoue, essayez un autre navigateur ou coupez le relais privé / le VPN du téléphone.'}
  else{titre="Pas de réponse de l'écran TV";texte="Vérifiez que la page de la TV est ouverte et qu'elle affiche le même code d'écran ("+codeTag()+"). Sinon, scannez à nouveau son QR code."}
  return `<div class="anec"><b>${esc(titre)}</b><p>${esc(texte)}</p></div><button class="btn big" onclick="say({t:'hello'});retryNow();pollNow()">Relancer</button>`;
}
const qrURL=(n)=>{try{const q=qrcode(0,'M');q.addData(joinUrl);q.make();return q.createDataURL(n,2)}catch(e){return''}};
const lostBar=()=>conn?'':`<div class="anec" style="display:flex;align-items:center;gap:16px"><img alt="QR code" style="width:110px;border-radius:8px;background:#fff;padding:6px" src="${qrURL(6)}"><span>Maître du Jeu déconnecté. Il peut rescanner ce QR code ou rouvrir sa page : la partie est conservée.</span></div>`;
function tvWait(){
  const u=qrURL(8);
  const qr=u?`<div class="qr"><img alt="QR code pour rejoindre la partie" src="${u}"></div>`:'';
  const s=conn?'<p class="st on">✓ Maître du Jeu connecté · configuration en cours sur son téléphone</p>'+netHTML()
    :'<p class="st sub">En attente du Maître du Jeu…</p>'+`<p class="st sub" style="font-size:.85rem">Serveur de messages : ${tvOk?'✓ joint':'en cours (si cela dure, le réseau le bloque)…'}</p>`+netHTML();
  return `<div class="tvwait"><h2 class="hero">Quiz <span>Time</span></h2>${qr||`<p class="sub">QR code indisponible. Ouvrez l'adresse ci-dessous sur le téléphone.</p>`}
  <p style="font-size:1.4rem;margin:0">Scannez ce QR code avec le smartphone du Maître du Jeu</p>${s}${err?`<p class="st" style="color:var(--pink)">${esc(err)}</p>`:''}<p class="url">${esc(joinUrl)}</p></div>`;
}
function tvTop(s){
  const dots=Array.from({length:s.rounds},(_,i)=>`<i class="${i<s.round?'d':i==s.round?'c':''}"></i>`).join('');
  const r=s.teams.map((t,i)=>({...t,i})).sort((a,b)=>b.s-a.s||a.i-b.i);
  const chips=r.map((t,k)=>`<div class="chip ${t.i==s.ti?'cur':''}"><span class="rk">${k+1}</span><span class="nm">${esc(t.n)}</span><b>${t.s}</b></div>`).join('');
  return `<div class="tvhead"><div class="brand">Quiz <span>Time</span></div><div class="tvtour"><span>Tour ${s.round+1} / ${s.rounds}</span><span class="dots">${dots}</span></div><div class="tvscore">${chips}</div></div>`;
}
function tvGame(s){
  const q=s.q,r=s.phase=='r',th=THEMES[s.th];
  return `${tvTop(s)}<div class="ctx"><div class="who"><span>Au tour de</span>${esc(s.teams[s.ti].n)}</div>${tmrHTML(s)}<div class="theme" style="--c:${th.c}">${th.e} ${esc(th.n)}</div></div>
  <section class="card"><p class="lvl">Niveau ${q.l} · ${esc(LV[q.l-1])}</p><h2 class="q">${esc(q.q)}</h2>${optsHTML(s,r)}
  ${r?`${verdict(s)}<div class="anec"><b>Réponse : ${esc(q.a)}</b><p>Le saviez-vous ? ${esc(q.f)}</p></div>`:''}</section>`;
}
function ctlGame(s){
  const q=s.q,B=(c,t,a)=>`<button class="btn ${c} big" onclick="${a}">${t}</button>`;
  let b='';
  if(s.phase=='q')b=B('green','Bonne réponse directe (5 pts)',"cmd('ans',5)")+B('pink','Mauvaise réponse (0 pt)',"cmd('ans',0)")+B('','Afficher les 4 propositions',"cmd('show')");
  else if(s.phase=='m')b=B('green','Bonne réponse (3 pts)',"cmd('ans',3)")+B('pink','Mauvaise réponse (0 pt)',"cmd('ans',0)")+B('','50/50',"cmd('fifty')");
  else if(s.phase=='f')b=B('green','Bonne réponse (1 pt)',"cmd('ans',1)")+B('pink','Mauvaise réponse (0 pt)',"cmd('ans',0)");
  else b=`<div class="anec"><b>${s.pts?'+'+plural(s.pts,'point'):'0 point'} pour ${esc(s.teams[s.ti].n)}</b><p>Le saviez-vous ? ${esc(q.f)}</p></div>`+B('',s.last?'Voir le classement final':'Question suivante',"cmd('next')");
  return `<div class="grid"><main>${head(s)}<section class="card"><p class="lvl">Niveau ${q.l} · ${esc(LV[q.l-1])}</p>${tmrHTML(s)}<h2 class="q">${esc(q.q)}</h2>
  <p class="exp">Réponse attendue : <b>${esc(q.a)}</b></p>${optsHTML(s,true)}<div class="acts">${b}</div></section><div class="row" style="margin-top:14px;flex-wrap:wrap"><button class="btn mut" onclick="if(confirm('Mettre la partie en pause ? Elle restera enregistrée.'))cmd('pause')">Mettre en pause</button><button class="btn pink" onclick="if(confirm('Terminer la partie maintenant ?'))cmd('finish')">Terminer la partie</button></div></main>${board({...s,i0:s.ti},true)}</div>`;
}
function render(){
  $('#meta').textContent='';
  const a=$('#app');
  if(TV){
    const s=pub();
    a.innerHTML=scr=='game'&&s&&s.q?lostBar()+tvGame(s):scr=='end'&&s?endHTML(s,false):tvWait();
    teamOverlay();
  }
  else if(scr=='conn')a.innerHTML=`<div class="card"><h3>Connexion à l'écran principal…</h3><p class="st">Serveur de messages : ${pOk?'✓ joint':'en cours…'}</p><p class="st">Écran TV : ${cOk?'✓ trouvé':'en recherche…'}</p>${netHTML()}${Date.now()-t0>12000?connHelp():''}<p class="foot sub"><a href="?forget">Scanner le QR code d'un autre écran</a> · <a href="?tv">Utiliser cet appareil comme écran TV</a></p></div>`;
  else if(scr=='cfgd'||!st)a.innerHTML=renderSetup();
  else a.innerHTML=scr=='end'?endHTML(st,true):(st.q?ctlGame(st):renderSetup());
  tick();
}

/* ---------- Écran toujours allumé (si le navigateur le permet) ---------- */
async function keepAwake(){try{if('wakeLock' in navigator&&!document.hidden)await navigator.wakeLock.request('screen')}catch(e){}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)keepAwake()});

/* ---------- Démarrage : chargement des questions ---------- */
async function boot(){
  if(SCAN){$('#app').innerHTML=`<div class="card"><h3>Scanner l'écran TV</h3><p>Ce téléphone a oublié l'ancien écran. Ouvrez l'appareil photo et scannez le QR code affiché sur la TV : l'application s'ouvrira déjà connectée.</p></div>`;return}
  try{
    const r=await fetch('questions.json',{cache:'no-cache'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();
    THEMES=(d.themes||[]).map(t=>({n:t.nom,e:t.emoji,c:t.couleur}));
    LV=d.niveaux||[];
    Q=(d.questions||[]).filter(x=>x&&x.question&&x.reponse!=null&&THEMES[x.theme]&&x.niveau>=1&&x.niveau<=LV.length)
      .map(x=>({th:x.theme,l:+x.niveau,g:x.groupe||'',yr:!!x.annee,q:String(x.question),a:String(x.reponse),f:x.anecdote||'',w:Array.isArray(x.fausses)?x.fausses.map(String):null}));
    QMAP=new Map(Q.map(q=>[qk(q),q]));
    if(!Q.length||!THEMES.length||!LV.length)throw new Error('questions.json vide ou invalide');
  }catch(e){
    $('#app').innerHTML=`<div class="card"><h3>Impossible de charger les questions</h3><p>${esc(e.message||e)}</p><p class="sub">Ouvrez l'application depuis son adresse en ligne (https://…), pas depuis un fichier local, et vérifiez que questions.json est bien présent à côté de index.html.</p></div>`;
    return;
  }
  if(TV)loadS();
  render();
  TV?tvInit():ctlInit();
  setInterval(tick,250);
  if(!TV)setInterval(()=>{if(scr=='conn')render()},1000);
  keepAwake();
  if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('sw.js').catch(()=>{});
}
boot();
