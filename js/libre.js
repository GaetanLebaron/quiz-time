/* ---------- Partie sans Maître du Jeu ----------
   Toutes les équipes reçoivent la même question en même temps et répondent chacune sur son téléphone.
   La partie tourne sur la TV, ou sur le téléphone de l'hôte quand on joue sans TV (?host).
   L'hôte est le téléphone qui crée la partie : il joue aussi pour son équipe, et lui seul lance, met en pause,
   termine ou force le passage à la question suivante. Les autres téléphones rejoignent avec le QR code de l'hôte (?team=…). */

/* ---------- Réponses tapées ----------
   On ignore majuscules, accents, ponctuation, espaces et mots de tête (article, « environ »), et on tolère quelques fautes
   de frappe selon la longueur de la réponse. Une réponse faite uniquement de chiffres (année, nombre) doit être exacte ;
   l'unité peut être omise (« 42,195 » pour « 42,195 km »). */
const HEAD=/^(?:(?:environ|vers|l|le|la|les|un|une|des|du|de|d|the|a|an) )+/;
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/œ/g,'oe').replace(/æ/g,'ae')
  .replace(/[^a-z0-9]+/g,' ').trim().replace(HEAD,'').replace(/ /g,'');
function lev(a,b){
  if(Math.abs(a.length-b.length)>3)return 9;
  let p=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){const c=[i];for(let j=1;j<=b.length;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]==b[j-1]?0:1));p=c}
  return p[b.length];
}
function same(v,a){
  const x=norm(v),y=norm(a);
  if(!x||!y)return false;
  if(/^\d+$/.test(y))return x==y;
  if(/^\d+$/.test(x)&&/^\d/.test(y)&&y.replace(/\D.*$/,'')==x&&!/\d/.test(y.slice(x.length)))return true;   /* unité omise */
  const tol=y.length<=3?0:y.length<=5?1:y.length<=10?2:3;
  return lev(x,y)<=tol;
}
/* Personnes (familles de questions ci-dessous) : le nom de famille seul suffit, « Hugo » pour « Victor Hugo »,
   « de Gaulle » ou « Gaulle » pour « Charles de Gaulle ». Jamais pour un roi ou un pape numéroté (« Louis XIV »),
   ni pour un surnom (« Charles le Chauve », « Jean sans Peur »). */
const PERS=new Set(['personnages-histoire','ecrivains','scientifiques','sportifs','sportives','peintres','sculpteurs','architectes',
  'compositeurs','chanteurs','chanteuses','acteurs','actrices','realisateurs','footballeurs','joueurs-tennis','joueuses-tennis',
  'coureurs','pilotes','auteurs-bd','vrais-noms']);
const PART=/^(?:de|du|des|d'|von|van|der|den|di|da|del|della|dos|las|los|ten|ter|zu)$/;
function lastNames(a){
  const w=String(a).trim().split(/\s+/);
  if(w.length<2||/,/.test(a)||w.some(x=>/^(?:[IVXL]+|Ier|Ire|1er)$/.test(x)))return[];
  /* « le », « la », « sans », « dit » en minuscules annoncent un surnom, sauf « la » après une particule (« de la Salle ») */
  if(w.some((x,i)=>/^(?:le|la|les|sans|dit|l'.*)$/.test(x)&&!(i>0&&PART.test(w[i-1]))))return[];
  const out=[];
  for(let i=1;i<w.length;i++){
    if(PART.test(w[i-1])&&i>1)out.push(w.slice(i-1).join(' '));   /* avec sa particule : « de Gaulle » */
    if(!PART.test(w[i])&&!(i>1&&/^(?:Le|La|Les|De|Du|Des|Di|Da|Del|Van|Von|Ben|El|Al|Mac)$/.test(w[i-1])))out.push(w.slice(i).join(' '));   /* pas « Tour » seul pour « Georges de La Tour » */
  }
  return out.filter(n=>norm(n).length>=3);
}
const good=(v,q)=>same(v,q.a)||PERS.has(q.g)&&lastNames(q.a).some(n=>same(v,n));

/* ---------- Moteur (TV, ou hôte sans TV) ---------- */
let lobby=[];   /* équipes inscrites avant le lancement, hors hôte : {id, n} */
let hostN='';   /* nom de l'équipe de l'hôte, envoyé par son téléphone quand la partie tourne sur la TV */
const MAXT=8;
/* Nom d'équipe unique dans la partie : « Les As » déjà pris devient « Les As 2 ». */
function fName(n,used){
  const b=String(n||'').trim().slice(0,24)||'Équipe';let k=b,i=2;
  while(used.some(u=>u.toLowerCase()==k.toLowerCase()))k=b.slice(0,21)+' '+i++;
  return k;
}
function fStart(c,pid){
  const teams=[{id:pid,n:fName(c.me,[]),s:0}];
  lobby.filter(l=>l.id!=pid).slice(0,MAXT-1).forEach(l=>teams.push({id:l.id,n:fName(l.n,teams.map(t=>t.n)),s:0}));
  if(teams.length<2)return;
  const lv=c.mode=='cresc'&&Array.isArray(c.levels)?[...new Set(c.levels.map(Number))].filter(l=>l>=1&&l<=LV.length).sort((a,b)=>a-b):[];
  const cr=lv.length>=2;
  const rounds=Math.max(cr?lv.length:1,Math.min(30,+c.rounds||10)),level=cr?lv[0]:Math.max(1,Math.min(LV.length,+c.level||2));
  const tt=Math.max(5,Math.min(300,Math.round(+c.timer||30)));   /* le timer décide de la fin de chaque question : toujours actif */
  const bag=[];while(bag.length<rounds)bag.push(...shuf(THEMES.map((_,i)=>i)));
  S={gid:Date.now(),date:Date.now(),free:true,host:pid,teams,rounds,level,tt,tEnd:0,lvl:cr?lvPlan(lv,rounds):null,themes:bag.slice(0,rounds),round:0,ti:0,used:new Set(),snd:c.snd!==false};
  lobby=[];fq();S.phase='rules';scr='game';
}
/* Nouvelle question : mêmes propositions et même 50/50 pour toutes les équipes. ans : réponse de chaque équipe, rdy : équipes prêtes. */
function fq(){
  S.q=pick(S.themes[S.round]);S.opts=mkOpts(S.q);S.hid=shuf(S.opts.filter(o=>o!=S.q.a)).slice(0,2);
  S.ans={};S.rdy=[];S.phase='q';armTimer(true);
}
/* Équipes qui jouent la question en cours : une équipe arrivée en cours de partie joue à partir de la question suivante. */
const fActive=()=>S.teams.filter(t=>!t.gone&&(t.from||0)<=S.round);
const fCan=t=>t&&!t.gone&&(t.from||0)<=S.round&&S.phase=='q'&&!(S.ans[t.id]&&S.ans[t.id].done);
function fReveal(){
  fActive().forEach(t=>{const a=S.ans[t.id];if(a&&a.pts)t.s+=a.pts});
  S.phase='r';S.tEnd=0;
}
function fNext(){
  S.round++;
  if(S.round>=S.rounds){S.round=S.rounds-1;scr='end';return}
  fq();
}
/* La question se termine quand toutes les équipes ont répondu (ou à la fin du timer, voir fTimer) ;
   la suivante démarre quand toutes les équipes présentes sont prêtes. */
function fCheck(){
  if(scr!='game')return;
  if(S.phase=='q'){const a=fActive();if(a.length&&a.every(t=>S.ans[t.id]&&S.ans[t.id].done))fReveal()}
  else if(S.phase=='r'&&S.teams.filter(t=>!t.gone).every(t=>S.rdy.includes(t.id)))fNext();
}
function fTimer(){
  if(S&&S.free&&scr=='game'&&S.phase=='q'&&S.tt&&tlNow()<=0){fReveal();saveS();push();render()}
}
/* Inscription. Avant le lancement : liste d'attente (le même téléphone peut changer de nom).
   Pendant la partie : l'équipe s'ajoute et joue à partir de la question suivante ; une équipe partie qui revient reprend sa place. */
function fJoin(id,n){
  n=String(n||'').trim().slice(0,24);
  if(!id||!n)return;
  if(S&&S.free&&scr=='game'){
    const from=S.phase=='rules'?0:S.round+1,t=S.teams.find(x=>x.id==id);
    if(t){if(t.gone){t.gone=false;t.from=from}return}
    if(S.teams.filter(x=>!x.gone).length>=MAXT)return;
    S.teams.push({id,n:fName(n,S.teams.map(x=>x.n)),s:0,from});
    return;
  }
  const l=lobby.find(x=>x.id==id);
  if(l)l.n=n;else if(lobby.length<MAXT-1)lobby.push({id,n});
}
/* Commandes de la partie sans Maître du Jeu. Renvoie vrai si la commande est traitée ici (ou refusée),
   faux pour la laisser au moteur de la partie avec Maître du Jeu (moteur.js). */
function fCmd(m){
  const id=m.pid||'';
  if(m.t=='join'){fJoin(id,m.n);return true}
  if(m.t=='hn'){hostN=String(m.n||'').trim().slice(0,24);return true}
  if(m.t=='start'&&m.cfg&&m.cfg.free){if(!S||scr!='game'||id==S.host)fStart(m.cfg,id);return true}
  if(!S||!S.free){if(m.t=='leave'){lobby=lobby.filter(l=>l.id!=id);return true}return false}
  const host=id==S.host,t=S.teams.find(x=>x.id==id);
  switch(m.t){
    case 'leave':if(host)break;if(t){t.gone=true;fCheck()}else lobby=lobby.filter(l=>l.id!=id);break;
    case 'begin':if(host&&S.phase=='rules'){S.phase='q';armTimer(true)}break;
    case 'help':if(fCan(t)){const a=S.ans[id]||(S.ans[id]={h:'q'});if(m.p=='m'&&a.h=='q')a.h='m';else if(m.p=='f'&&a.h=='m')a.h='f'}break;
    case 'ans':if(fCan(t)){
      const a=S.ans[id]||(S.ans[id]={h:'q'});
      if(a.h=='q'&&typeof m.v=='string'&&m.v.trim()){a.v=m.v.trim().slice(0,60);a.pts=good(a.v,S.q)?5:0;a.done=true}
      else if(a.h!='q'&&S.opts.includes(m.c)&&!(a.h=='f'&&S.hid.includes(m.c))){a.c=m.c;a.pts=m.c==S.q.a?(a.h=='m'?3:1):0;a.done=true}
      fCheck();
    }break;
    case 'rdy':if(t&&!t.gone&&S.phase=='r'&&!S.rdy.includes(id)){S.rdy.push(id);fCheck()}break;
    case 'next':if(host&&S.phase=='r')fNext();break;
    case 'finish':if(host&&scr=='game')scr='end';break;
    /* Nouvelle partie ou pause : les équipes restent inscrites pour la partie suivante. */
    case 'replay':case 'pause':if(host){lobby=S.teams.filter(x=>x.id!=S.host&&!x.gone).slice(0,MAXT-1).map(x=>({id:x.id,n:x.n}));saveS();S=null;scr='cfgd';lsSet(CK,null)}break;
    case 'resume':case 'del':case 'start':return !host;   /* l'hôte peut reprendre une autre partie enregistrée */
  }
  return true;
}
/* État envoyé aux téléphones et affiché par la TV. La bonne réponse, l'anecdote et les réponses des équipes
   ne partent qu'à la révélation. */
function fpub(){
  const r=S.phase=='r';
  return {free:true,gid:S.gid,host:S.host,teams:S.teams.map(t=>({id:t.id,n:t.n,s:t.s,gone:!!t.gone,from:t.from||0})),rounds:S.rounds,round:S.round,
    level:S.level,lv:curLv(),cr:!!S.lvl,th:S.themes[S.round],q:S.q?{q:S.q.q,l:S.q.l,a:r?S.q.a:'',f:r?S.q.f:''}:null,phase:S.phase,
    opts:S.opts,hid:S.hid,tt:S.tt||0,tl:tlNow(),last:S.round==S.rounds-1,rdy:S.rdy||[],
    an:Object.fromEntries(S.teams.map(t=>{const a=(S.ans||{})[t.id]||{};
      return[t.id,r?{h:a.h||'q',v:a.v||'',c:a.c==null?null:a.c,pts:a.pts||0,done:!!a.done}:{h:a.h||'q',done:!!a.done}]}))};
}

/* ---------- Actions de ce téléphone ---------- */
/* Sur l'hôte sans TV, la commande va directement au moteur local ; sinon elle part vers le moteur (TV). */
function act(m){if(ENGINE){m.pid=PID;onCmd(m)}else say(m)}
const teamUrl=()=>location.href.split('#')[0].split('?')[0]+'?team='+T;
const myLobby=()=>ENGINE?lobby:lb;
/* Nom de l'équipe de l'hôte, affiché en tête des équipes inscrites. */
const hostName=()=>HOSTL||!ENGINE&&!TEAM?cfg.me.trim():TV?hostN:lbHn;
const lobbyNames=()=>[...(hostName()?[hostName()+' (hôte)']:[]),...myLobby().map(x=>x.n)];
let fTxt='',fN=rawGet('qt-tname')||'',fKey='',fJoinAt=0;
function fSendTxt(){
  const v=fTxt.trim();if(!v)return;
  act({t:'ans',v});
}
function fPick(i){const s=ENGINE?pub():st;sel=null;if(s&&s.opts)act({t:'ans',c:s.opts[i]})}
function fJoinSend(){
  const n=fN.trim().slice(0,24);if(!n){alert('Indiquez le nom de votre équipe.');return}
  rawSet('qt-tname',n);rawSet('qt-joined',T);fJoinAt=Date.now();act({t:'join',n});
}
function fLeave(){
  if(!confirm('Quitter la partie ? Votre équipe ne jouera plus les questions suivantes.'))return;
  rawDel('qt-joined');act({t:'leave'});render();
}
/* Un téléphone d'équipe inscrit se réinscrit tout seul si le moteur l'a perdu (TV rechargée, nouvelle partie…). */
function fAutoJoin(){
  if(!TEAM||rawGet('qt-joined')!=T||!fN.trim()||Date.now()-fJoinAt<5000)return;
  const inGame=st&&st.free&&scr=='game'&&st.teams.some(t=>t.id==PID&&!t.gone);
  if(scr=='cfgd'&&!lb.some(l=>l.id==PID)||scr=='game'&&st&&st.free&&!inGame&&!st.teams.some(t=>t.id==PID)){fJoinAt=Date.now();act({t:'join',n:fN.trim()})}
}

/* ---------- Écrans des téléphones ---------- */
const HELP={q:'Réponse directe',m:'4 propositions',f:'50/50'};
/* Ce qu'une équipe a répondu, pour la révélation. */
const fSaid=a=>!a||!a.done?'Pas de réponse':a.h=='q'?a.v:a.c;
const fPts=a=>a&&a.pts?'+'+a.pts:'0';
/* Révélation : chaque équipe de la question, ce qu'elle a répondu, avec quelle aide, et ses points. */
function fRes(s,big){
  const rows=s.teams.filter(t=>!t.gone&&t.from<=s.round).map(t=>{const a=s.an[t.id];
    return `<div class="fr ${a&&a.pts?'good':'miss'} ${t.id==PID&&!big?'me':''}"><span class="fp">${fPts(a)}</span><div><b>${esc(t.n)}</b><p>${esc(fSaid(a))}</p><small>${a&&a.done?HELP[a.h]:'Temps écoulé'}</small></div></div>`}).join('');
  return `<div class="fres">${rows}</div>`;
}
const fReady=s=>{const p=s.teams.filter(t=>!t.gone),w=p.filter(t=>!s.rdy.includes(t.id));
  return w.length?'En attente de : '+w.map(t=>esc(t.n)).join(', '):'Toutes les équipes sont prêtes'};
/* Barre de l'hôte (pause, fin, QR code pour une équipe en retard) ou d'une équipe (quitter). */
let qrOpen=false;
function fBar(s,host){
  if(!host)return `<div class="ctlbar"><button class="btn mut" onclick="fLeave()">Quitter la partie</button></div>`;
  return `${s.phase=='rules'?'':`<details class="card fqr" ${qrOpen?'open':''} ontoggle="qrOpen=this.open"><summary>Inviter une équipe</summary>${fQR()}</details>`}
  <div class="ctlbar"><button class="btn mut" onclick="if(confirm('Mettre la partie en pause ? Elle restera enregistrée.'))cmd('pause')">Mettre en pause</button><button class="btn pink" onclick="if(confirm('Terminer la partie maintenant ?'))cmd('finish')">Terminer la partie</button></div>`;
}
function fQR(){
  const u=qrURL(6,teamUrl());
  return `<div class="fqrin">${u?`<img alt="QR code pour rejoindre la partie" src="${u}">`:''}<p class="sub">${TV||HOSTL||scr!='cfgd'?'Les autres équipes scannent ce QR code avec leur téléphone pour rejoindre la partie.':'Les autres équipes scannent le QR code affiché sur la TV, ou celui-ci, avec leur téléphone.'}</p></div>`;
}
function fRulesShort(s){
  return `<ul class="frl"><li><b>Tous en même temps :</b> chaque équipe répond sur son téléphone, en ${s.tt} secondes.</li>
  <li><b>5 points</b> pour une réponse tapée sans aide (les petites fautes sont acceptées, et pour une personne le nom de famille suffit), <b>3 points</b> avec les 4 propositions, <b>1 point</b> avec le 50/50.</li>
  <li>Une réponse envoyée est définitive. Après la révélation, touchez <b>Prêt</b> pour passer à la suite.</li></ul>`;
}
function fGame(s){
  const me=s.teams.find(t=>t.id==PID),host=s.host==PID;
  if(!me)return fJoinHTML(true);
  if(me.gone)return `<div class="setup"><section class="card"><h3>Partie quittée</h3><p>Votre équipe a quitté la partie.</p><button class="btn pink big" onclick="fJoinSend()">Revenir dans la partie</button></section></div>`;
  const th=THEMES[s.th],a=s.an[PID]||{h:'q'},q=s.q;
  const head=`<div class="ctx"><div class="pill ph">Tour ${s.round+1}<span>/${s.rounds}</span></div><div class="theme" style="--c:${th.c}">${thIco(s.th)}${esc(th.n)}</div></div>`;
  const B=(c,t,f)=>`<button class="btn ${c} big" onclick="${f}">${t}</button>`;
  let body='';
  if(s.phase=='rules')body=`<section class="card"><h3>Règles du jeu</h3>${HOSTL?fRulesShort(s):'<p>Les règles sont affichées sur la TV.</p>'}
    ${host?B('pink','Lancer la partie',"cmd('begin')"):'<p class="sub">L\'hôte lance la partie quand tout le monde est prêt.</p>'}</section>`
    +(host?`<section class="card"><h3>Inviter les équipes</h3>${fQR()}</section>`:'');   /* le QR code reste en grand jusqu'à la première question */
  else if(s.phase=='q'){
    const k=s.round+'-'+a.h;if(k!=selKey){selKey=k;sel=null}
    if(fKey!=s.round){fKey=s.round;fTxt=''}
    let acts;
    if(me.from>s.round)acts='<p class="sub hint">Votre équipe joue à partir de la prochaine question.</p>';
    else if(a.done)acts=`<div class="anec"><b>Réponse envoyée ✓</b><p>En attente des autres équipes…</p></div>`;
    else if(a.h=='q')acts=`<input type="text" id="fv" maxlength="60" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Votre réponse" value="${esc(fTxt)}" oninput="fTxt=this.value" onkeydown="if(event.key=='Enter')fSendTxt()" aria-label="Votre réponse">`
      +B('green','Valider ma réponse · 5 pts','fSendTxt()')+B('','Voir les 4 propositions · 3 pts',"cmd('help','m')");
    else{
      if(sel!=null&&a.h=='f'&&s.hid.includes(s.opts[sel]))sel=null;
      const o=sel!=null?s.opts[sel]:null;
      acts=`<div class="opts" style="--th:${th.c}">${s.opts.map((x,i)=>tile(x,i,a.h=='f'&&s.hid.includes(x)?'off':'','',true)).join('')}</div>`
        +(o==null?'<p class="sub hint">Touchez une proposition, puis validez.</p>':B('green',`Valider « ${esc(o)} » · ${a.h=='m'?3:1} pt${a.h=='m'?'s':''}`,`fPick(${sel})`))
        +(a.h=='m'?B('','50/50 · 1 pt',"cmd('help','f')"):'');
    }
    body=`<section class="card qcard"><p class="lvl">Niveau ${q.l} · ${esc(LV[q.l-1])}</p>${a.done||me.from>s.round?'':tmrHTML(s)}<h2 class="q">${escQ(q.q)}</h2><div class="acts">${acts}</div></section>`;
  }
  else{
    const r=s.an[PID],ok=r&&r.pts>0,mine=me.from<=s.round;
    const ready=s.rdy.includes(PID);
    /* Mauvaise réponse : en rouge, au-dessus de la bonne réponse en vert ; puis la carte jaune « Bien joué ! » ou « Dommage ! » comme sur la TV avec Maître du Jeu */
    const bad=mine&&!ok&&r&&r.done?tile(fSaid(r),0,'bad','Votre réponse'):'';
    const card=mine?`<div class="rcard ${ok?'good':'miss'}"><div class="burst"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${BURST}"/></svg><b>${ok?'+'+r.pts:'0'}</b></div>
      <div><h3>${ok?'Bien joué !':'Dommage !'}</h3><p>${ok?'Votre équipe empoche '+plural(r.pts,'point'):r&&r.done?'Pas de point cette fois':'Temps écoulé : pas de point cette fois'}</p></div></div>`:'';
    body=`<section class="card qcard"><h2 class="q">${escQ(q.q)}</h2><div class="opts one">${bad}${tile(q.a,0,'ok','Bonne réponse')}</div>
      ${card}
      ${q.f?`<div class="fact"><span class="bulb">${ICO.bulb}</span><div><h3>Le saviez-vous ?</h3><p>${esc(q.f)}</p></div></div>`:''}</section>
      <div class="acts">${ready?`<div class="anec"><b>Prêt ✓</b><p>${fReady(s)}</p></div>`:B('pink',s.last?'Prêt · voir le classement':'Prêt',"cmd('rdy')")+`<p class="sub hint">${fReady(s)}</p>`}
      ${host?B('mut',s.last?'Voir le classement final sans attendre':'Question suivante sans attendre',"cmd('next')"):''}</div>
      <section class="card"><h3>Réponses des équipes</h3>${fRes(s,false)}</section>`;
  }
  return `<div class="grid fgame"><main>${head}<div class="fstack">${body}</div>${fBar(s,host)}</main>${board({...s,i0:s.teams.indexOf(me)},true)}</div>`;
}
/* Téléphone d'équipe : inscription (avant ou pendant la partie). */
function fJoinHTML(late){
  const full=myLobby().length>=MAXT-1&&!late;
  return `<div class="setup"><section class="card"><h3>${late?'La partie a commencé':'Rejoindre la partie'}</h3>
    ${late?'<p>Inscrivez votre équipe : elle jouera à partir de la prochaine question.</p>':''}
    ${full?'<p>La partie est complète (8 équipes).</p>':`<div class="row"><input type="text" id="fn" maxlength="24" value="${esc(fN)}" placeholder="Nom de votre équipe" oninput="fN=this.value" onkeydown="if(event.key=='Enter')fJoinSend()" aria-label="Nom de votre équipe"></div>
    <button class="btn pink big" onclick="fJoinSend()">Rejoindre la partie</button>`}</section></div>`;
}
function fTeam(){
  if(scr=='game'&&st&&st.free)return fGame(st);
  if(scr=='game'&&st)return `<div class="setup"><section class="card"><h3>Partie en cours</h3><p>Une partie avec Maître du Jeu est en cours : suivez-la sur la TV.</p></section></div>`;
  if(scr=='end'&&st)return endHTML(st,false)+'<p class="sub" style="text-align:center">En attente d\'une nouvelle partie…</p>';
  const me=lb.find(l=>l.id==PID);
  if(!me||rawGet('qt-joined')!=T)return fJoinHTML(false);
  return `<div class="setup"><section class="card"><h3>Équipe inscrite ✓</h3><p class="fme">${esc(me.n)}</p><p class="sub">En attente du lancement de la partie par l'hôte…</p></section>
    <section class="card"><h3>Équipes inscrites</h3>${fLobby()}</section>
    <div class="ctlbar"><button class="btn mut" onclick="rawDel('qt-joined');render()">Changer de nom</button><button class="btn mut" onclick="fLeave()">Quitter</button></div></div>`;
}
const fLobby=()=>{const l=lobbyNames();return l.length?`<ul class="flb">${l.map(n=>`<li>${esc(n)}</li>`).join('')}</ul>`:'<p class="sub">Aucune équipe pour l\'instant.</p>'};

/* ---------- Configuration chez l'hôte ---------- */
function fSetupCards(){
  return `<section class="card"><h3>Votre équipe</h3><div class="row"><input type="text" id="me" maxlength="24" value="${esc(cfg.me)}" placeholder="Nom de votre équipe" aria-label="Nom de votre équipe" oninput="cfg.me=this.value;saveCfg()" onchange="render()"></div>
    <p class="sub" style="margin:0">Vous jouez aussi : ce téléphone sert à répondre pour votre équipe.</p></section>
  <section class="card"><h3>Équipes inscrites (${lobbyNames().length})</h3>${fQR()}${fLobby()}</section>`;
}

/* ---------- Écran TV ---------- */
function tvTopFree(s){
  const chips=s.teams.filter(t=>!t.gone).map(t=>{
    const a=s.an[t.id],late=t.from>s.round;
    const on=s.phase=='q'?a&&a.done:s.phase=='r'&&s.rdy.includes(t.id);
    const tag=s.phase=='q'?(late?'Prochaine question':a&&a.done?'A répondu ✓':'En attente'):s.phase=='r'?(s.rdy.includes(t.id)?'Prêt ✓':''):'';
    return `<div class="chip ${on?'cur':''} ${s.phase=='q'&&!on&&!late?'wait':''}" data-k="${esc(t.id)}">${tag?`<em>${tag}</em>`:''}<span class="sc"><b>${t.s}</b><small>${t.s>1?'pts':'pt'}</small></span><span class="nm">${esc(t.n)}</span></div>`}).join('');
  return `<div class="tvhead"><div class="pill">Tour ${s.round+1}<span>/${s.rounds}</span></div><div class="tvscore">${chips}</div></div>`;
}
function tvFree(s){
  const q=s.q,r=s.phase=='r',th=THEMES[s.th];
  const tag=`<span class="qtag" style="--c:${th.c}">${thIco(s.th)}${esc(th.n)}${s.cr?' · Niveau '+s.lv:''}</span>`;
  const fact=q.f?`<div class="fact"><span class="bulb">${ICO.bulb}</span><div><h3>Le saviez-vous ?</h3><p>${esc(q.f)}</p></div></div>`:'';
  return `${tvTopFree(s)}<section class="qcard ${r?'mini':''}">${tag}<h2 class="q">${escQ(q.q)}</h2>${tmrRing(s)}</section>`
    +(r?`<div class="opts one">${tile(q.a,0,'ok','Bonne réponse')}</div>${fRes(s,true)}${fact}<p class="fready">${fReady(s)}</p>`:'<p class="fhint">Répondez sur vos téléphones !</p>');
}
function tvRulesFree(s){
  const P=(t,d,x)=>`<div class="rpt"><b>${t}</b><span><strong>${d}</strong> ${x}</span></div>`;
  return `<div class="rules"><h2 class="hero">${logoRegles()} — Règles du jeu</h2>
  <p class="rintro">Bienvenue dans ${appNom()} ! Ce soir, pas de Maître du Jeu : chaque équipe joue sur son téléphone.</p>
  <div class="rgrid"><div class="rcol">
  <section class="card"><h3>Le principe</h3><p>La partie compte ${plural(s.rounds,'question')}. Toutes les équipes reçoivent la même question en même temps, sur la TV et sur leur téléphone, et ont ${s.tt} secondes pour répondre. Le thème change à chaque question, parmi :</p>
    <div class="rth">${THEMES.map((t,i)=>`<span style="--c:${t.c}">${thIco(i)}${esc(t.n)}</span>`).join('')}</div></section>
  <section class="card"><h3>La révélation</h3><p>Quand toutes les équipes ont répondu, ou quand le temps est écoulé, la TV montre la bonne réponse, ce que chaque équipe a répondu et une petite anecdote. Touchez « Prêt » sur votre téléphone pour passer à la question suivante.</p></section>
  <section class="card"><h3>La fin de partie</h3><p>Après la dernière question, l'équipe qui a le plus de points remporte la partie 🏆. En cas d'égalité, les équipes ex æquo se partagent la victoire.</p></section>
  </div><div class="rcol">
  <section class="card"><h3>Comment répondre</h3><p>Sur votre téléphone, trois façons de tenter votre chance. Plus vous prenez de risques, plus vous gagnez de points :</p>
    ${P('5 pts','Réponse tapée :','vous écrivez la réponse sans aide. Les petites fautes d\'orthographe sont acceptées, et pour une personne, le nom de famille suffit.')}
    ${P('3 pts','Les 4 propositions :','vous demandez à voir quatre réponses possibles, et vous choisissez.')}
    ${P('1 pt','Le 50/50 :','il ne reste plus que deux propositions. À vous de trouver la bonne.')}
    <p class="rwarn">⚠️ <strong>Attention :</strong> une réponse envoyée est définitive, et une mauvaise réponse rapporte 0 point. Sans réponse à la fin du temps, c'est 0 point aussi.</p></section>
  <section class="card"><h3>Les règles d'or</h3><ul><li>Une seule réponse par équipe : mettez-vous d'accord avant de valider.</li><li>Le téléphone sert à répondre, pas à chercher : pas d'aide extérieure !</li><li>Le temps est compté : ${s.tt} secondes par question.</li></ul></section>
  </div></div><p class="rluck">Bonne chance à toutes les équipes !</p></div>`;
}
