const cmd=(t,p)=>act({t,p});
const nRounds=()=>cfg.free?cfg.roundsFree:cfg.rounds;
function go(){
  const free=cfg.free;
  if(free&&!cfg.me.trim()){alert('Indiquez le nom de votre équipe.');return}
  if(free&&!myLobby().length){alert('Il faut au moins une autre équipe : elle rejoint la partie en scannant le QR code.');return}
  if(!free&&cfg.teams.map(n=>n.trim()).filter(Boolean).length<2){alert('Ajoutez au moins deux équipes.');return}
  const cr=cfg.mode=='cresc';
  if(cr&&cfg.levels.length<2){alert('Choisissez au moins deux niveaux pour le mode Crescendo.');return}
  if(cr&&nRounds()<cfg.levels.length){alert('Le mode Crescendo demande au moins un tour par niveau : '+plural(cfg.levels.length,'tour')+' minimum.');return}
  const c={rounds:nRounds(),mode:cr?'cresc':'std',level:cfg.level,levels:cfg.levels};
  act({t:'start',cfg:free?{...c,free:true,me:cfg.me.trim(),timer:cfg.timerFree}:{...c,teams:cfg.teams,timer:cfg.timerOn?cfg.timerSec:0}});
}

/* ---------- Timer (affichage) ---------- */
const tmrHTML=s=>s&&s.tt&&s.phase!='r'?`<div class="tmr" id="tmr"><div class="tmr-bar"><i id="tmrb"></i></div><span id="tmrv">${s.tt} s</span></div>`:'';
/* Écran TV : compte à rebours circulaire, à droite de la question */
const tmrRing=s=>s.tt&&s.phase!='r'?`<div class="ring" id="tmr"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="18.5" pathLength="100"/><circle id="tmrc" cx="22" cy="22" r="18.5" pathLength="100"/></svg><b id="tmrv">${s.tt}</b></div>`:'';
function tick(){
  const box=document.getElementById('tmr');if(!box)return;
  const s=ENGINE?pub():st;if(!s||!s.tt)return;
  const ms=ENGINE?s.tl:Math.max(0,s.tl-(Date.now()-recvAt));
  const sec=Math.ceil(ms/1000);
  const pc=Math.min(100,ms/(s.tt*1000)*100),ring=document.getElementById('tmrc');
  if(ring){document.getElementById('tmrv').textContent=sec;ring.style.strokeDashoffset=100-pc}
  else{document.getElementById('tmrv').textContent=ms<=0?'Temps écoulé !':sec+' s';document.getElementById('tmrb').style.width=pc+'%'}
  box.classList.toggle('low',ms>0&&sec<=5);box.classList.toggle('zero',ms<=0);
}

/* ---------- Animation de changement d'équipe (écran TV) ---------- */
function teamOverlay(){
  if(!S||scr!='game')return;
  if(S.phase=='rules')return;   /* l'animation du premier tour attend la fin des règles */
  const key=S.gid+'-'+S.round+'-'+S.ti;
  if(key===lastKey)return;
  lastKey=key;
  if(S.phase!='q')return;
  const th=THEMES[S.themes[S.round]];
  /* Sans Maître du Jeu : toutes les équipes jouent ensemble, l'animation annonce la question. */
  if(S.free){
    const L=curLv(),up=S.lvl&&(S.round==0||S.lvl[S.round-1]!=L);
    const d=document.createElement('div');d.className='ovl';
    d.innerHTML=`<div class="ovl-in">${up?`<em>${S.round?'⬆ Niveau supérieur':'Crescendo'} · ${L} ${esc(LV[L-1])}</em>`:''}<span>Question ${S.round+1} / ${S.rounds}</span><b>À vos téléphones !</b><i style="--c:${th.c}">${thIco(S.themes[S.round])}${esc(th.n)}</i></div>`;
    document.body.appendChild(d);setTimeout(()=>d.remove(),OVL_MS+100);return;
  }
  /* Crescendo : au début de la partie et à chaque passage au niveau supérieur, l'animation annonce le niveau. */
  const L=curLv(),up=S.lvl&&S.ti==0&&(S.round==0||S.lvl[S.round-1]!=L);
  const d=document.createElement('div');d.className='ovl';
  d.innerHTML=`<div class="ovl-in">${up?`<em>${S.round?'⬆ Niveau supérieur':'Crescendo'} · ${L} ${esc(LV[L-1])}</em>`:''}<span>Au tour de</span><b>${esc(S.teams[S.ti].n)}</b><i style="--c:${th.c}">${thIco(S.themes[S.round])}${esc(th.n)}</i></div>`;
  document.body.appendChild(d);setTimeout(()=>d.remove(),OVL_MS+100);
}

/* ---------- Habillage « jeu » : icônes et propositions ---------- */
const SV=d=>`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
const ICO={ok:SV('<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>'),no:SV('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>'),
  bulb:SV('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z"/>')};
/* Icônes des thèmes, dans le même style au trait que l'ampoule. Dans l'ordre des thèmes de questions.json :
   Géographie, Divertissements, Histoire, Arts et Littérature, Sciences et Nature, Sports et Loisirs. Un thème ajouté sans icône garde son émoji. */
const TICO=[
  '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18"/>',
  '<path d="M4 11v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8zM4 11l-.8-3.2a2 2 0 0 1 1.4-2.4l11.6-3.1a2 2 0 0 1 2.4 1.4l.8 3.3zM7.2 4.8l3 3.7M12.6 3.4l3 3.7"/>',
  '<path d="M3 21h18M5 18v-8M9.7 18v-8M14.3 18v-8M19 18v-8M3 10h18L12 3.5z"/>',
  '<path d="M12 21a9 9 0 1 1 9-9c0 2.5-2 3.6-4 3.6h-1.6a1.8 1.8 0 0 0-1.4 2.9A1.6 1.6 0 0 1 12 21z"/><circle cx="7.8" cy="11" r="1.1" class="fill"/><circle cx="10.6" cy="7.2" r="1.1" class="fill"/><circle cx="15.2" cy="7.6" r="1.1" class="fill"/>',
  '<path d="M9 3h6M10 3v6.3L4.6 18.7A1.5 1.5 0 0 0 5.9 21h12.2a1.5 1.5 0 0 0 1.3-2.3L14 9.3V3M7 15h10"/>',
  '<path d="M8 21h8M12 16.5V21M7 4h10v5a5 5 0 0 1-10 0zM7 6H4.5a3 3 0 0 0 2.8 4M17 6h2.5a3 3 0 0 1-2.8 4"/>'];
const thIco=i=>TICO[i]?`<svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${TICO[i]}</svg>`:esc(THEMES[i]?THEMES[i].e:'');

/* Une proposition : sa lettre dans le carré de gauche. st = '' (en jeu), 'ok' (bonne réponse révélée, ✓),
   'bad' (réponse fausse donnée, ✕), 'no' (autre proposition révélée), 'off' (retirée par le 50/50). Les couleurs vert et rouge sont réservées à ok et bad. */
function tile(o,i,st,tag,pick){
  const inner=`<span class="sh">${st=='ok'?ICO.ok:st=='bad'?ICO.no:'ABCD'[i]||''}</span><span class="ot">${esc(o)}</span>${tag?`<span class="otag">${tag}</span>`:''}`;
  return pick?`<button class="opt pk c${i} ${st} ${sel==i?'sel':''}" ${st=='off'?'disabled':''} onclick="sel=${i};render()">${inner}</button>`:`<div class="opt c${i} ${st}">${inner}</div>`;
}
/* Étoile à pointes du résultat (« +3 ») */
const BURST=Array.from({length:24},(_,k)=>{const a=k*Math.PI/12-Math.PI/2,r=k%2?35:48;return(50+r*Math.cos(a)).toFixed(1)+','+(50+r*Math.sin(a)).toFixed(1)}).join(' ');

/* ---------- Vues ---------- */
/* Choix du mode : avec ou sans Maître du Jeu, puis (sans Maître du Jeu) avec ou sans TV. Sans TV, ce téléphone devient l'hôte (?host). */
function modeCards(){
  if(HOSTL)return `<section class="card"><h3>Partie sans TV</h3><p style="margin:0">Pas de Maître du Jeu : chaque équipe joue sur son téléphone, et ce téléphone fait tourner la partie. Gardez-le allumé jusqu'à la fin.</p>
    <p class="foot sub" style="text-align:left"><a href="?tv">Utiliser plutôt cet appareil comme écran TV</a></p></section>`;
  const B=(on,f,n,d)=>`<button class="btn ${on?'on':''}" onclick="${f}"><b>${n}</b><i>${d}</i></button>`;
  return `<section class="card"><h3>Maître du Jeu</h3><div class="lv">${B(!cfg.free,"cfg.free=false;saveCfg();render()",'Avec','Il lit et valide les réponses')}${B(cfg.free,"cfg.free=true;saveCfg();render()",'Sans','Chaque équipe joue sur son téléphone')}</div></section>
  ${cfg.free?`<section class="card"><h3>Écran TV</h3><div class="lv">${B(true,'','Avec la TV','Questions et révélations sur la TV')}${B(false,"if(confirm('Jouer sans TV ? Ce téléphone fera tourner la partie.'))location.href='?host'",'Sans TV','Tout se joue sur les téléphones')}</div></section>`:''}`;
}
function renderSetup(){
  $('#meta').textContent=(cfg.free?'Partie sans Maître du Jeu':'Console du Maître du Jeu')+' · '+Q.length+' questions en banque';
  const free=cfg.free;
  return `<div class="setup">${modeCards()}
  ${free?fSetupCards():`<section class="card"><h3>Équipes</h3>
    ${cfg.teams.map((t,i)=>`<div class="row"><input type="text" value="${esc(t)}" maxlength="24" aria-label="Nom de l'équipe ${i+1}" oninput="cfg.teams[${i}]=this.value;saveCfg()"><button class="btn x" onclick="rmTeam(${i})" aria-label="Retirer l'équipe">✕</button></div>`).join('')}
    <button class="btn mut" onclick="addTeam()" ${cfg.teams.length>=8?'disabled':''}>+ Ajouter une équipe</button>
  </section>`}
  <section class="card"><h3>Nombre de tours</h3>
    <div class="row" style="align-items:center"><input type="number" id="nr" min="1" max="30" value="${nRounds()}" aria-label="Nombre de tours" oninput="cfg[cfg.free?'roundsFree':'rounds']=Math.max(1,Math.min(30,+this.value||1));saveCfg();const p=document.getElementById('plan');if(p)p.innerHTML=planHTML()"><span class="sub">${free?'Un tour = une question pour toutes les équipes':'Un tour = une question par équipe'}</span></div>
  </section>
  <section class="card"><h3>Mode de jeu</h3>
    <div class="lv">${[['std','Standard','Un seul niveau'],['cresc','Crescendo','Niveau croissant']].map(([m,n,d])=>`<button class="btn ${cfg.mode==m?'on':''}" onclick="cfg.mode='${m}';saveCfg();render()"><b>${n}</b><i>${d}</i></button>`).join('')}</div>
  </section>
  ${cfg.mode=='cresc'?crescHTML():`<section class="card"><h3>Niveau de difficulté</h3>
    <div class="lv">${LV.map((l,i)=>`<button class="btn ${cfg.level==i+1?'on':''}" onclick="cfg.level=${i+1};saveCfg();render()"><b>${i+1}</b><i>${esc(l)}</i></button>`).join('')}</div>
  </section>`}
  ${free?`<section class="card"><h3>Timer</h3>
    <div class="row" style="align-items:center"><input type="number" id="tf" min="5" max="300" value="${cfg.timerFree}" aria-label="Durée en secondes" oninput="cfg.timerFree=Math.max(5,Math.min(300,+this.value||30));saveCfg()"><span class="sub">secondes par question : la question se termine à la fin du temps, ou dès que toutes les équipes ont répondu</span></div>
  </section>`:`<section class="card"><h3>Timer</h3>
    <label class="chk"><input type="checkbox" ${cfg.timerOn?'checked':''} onchange="cfg.timerOn=this.checked;saveCfg();render()"><span>Compte à rebours pour chaque question</span></label>
    ${cfg.timerOn?`<div class="row" style="align-items:center"><input type="number" min="5" max="300" value="${cfg.timerSec}" aria-label="Durée en secondes" oninput="cfg.timerSec=Math.max(5,Math.min(300,+this.value||30));saveCfg()"><span class="sub">secondes par question (5 à 300)</span></div>`:''}
  </section>`}
  <button class="btn pink big" onclick="go()">Lancer la partie</button>${savedHTML()}
  <p class="foot sub"><span id="lnk">${esc(lnkTxt())}</span>${HOSTL?'':'<br><a href="?tv">Utiliser cet appareil comme écran TV</a>'}</p></div>`;
}
/* Mode Crescendo : choix des niveaux (au moins deux) et aperçu de la répartition des tours. */
function crescHTML(){
  return `<section class="card"><h3>Niveaux du Crescendo</h3>
    <p class="sub" style="margin:0 0 12px">Choisissez au moins deux niveaux : la partie commence par le plus facile et finit par le plus difficile.</p>
    <div class="lv">${LV.map((l,i)=>`<button class="btn ${cfg.levels.includes(i+1)?'on':''}" onclick="togLv(${i+1})"><b>${i+1}</b><i>${esc(l)}</i></button>`).join('')}</div>
    <p class="sub plan" id="plan">${planHTML()}</p>
  </section>`;
}
function togLv(l){cfg.levels=cfg.levels.includes(l)?cfg.levels.filter(x=>x!=l):[...cfg.levels,l].sort((a,b)=>a-b);saveCfg();render()}
function planHTML(){
  const lv=cfg.levels,n=nRounds();
  if(lv.length<2)return'Sélectionnez au moins deux niveaux.';
  if(n<lv.length)return'⚠ Il faut au moins '+plural(lv.length,'tour')+' (un par niveau).';
  const p=lvPlan(lv,n),out=[];
  for(let r=0;r<n;){let e=r;while(e+1<n&&p[e+1]==p[r])e++;out.push((r==e?'Tour '+(r+1):'Tours '+(r+1)+' à '+(e+1))+' : '+esc(LV[p[r]-1]));r=e+1}
  return out.join('<br>');
}
const addTeam=()=>{cfg.teams.push('Équipe '+(cfg.teams.length+1));saveCfg();render()};
const rmTeam=i=>{if(cfg.teams.length>2){cfg.teams.splice(i,1);saveCfg();render()}};

const fmtD=t=>new Date(t).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
function savedHTML(){
  const row=g=>`<div class="anec" style="margin:0"><b>${fmtD(g.date)} · ${g.free?'Sans Maître du Jeu · ':''}${g.cr?'Crescendo · ':''}${g.done?'Terminée':'Tour '+(g.round+1)+' / '+g.rounds}</b><p>${[...g.teams].sort((a,b)=>b.s-a.s).map(t=>esc(t.n)+' '+t.s).join(' · ')}</p><div class="row" style="margin:8px 0 0">${g.done||HOSTL&&!g.free?'':`<button class="btn" onclick="cmd('resume',${+g.id})">Reprendre</button>`}<button class="btn x" onclick="if(confirm('Supprimer cette partie ?'))cmd('del',${+g.id})">Supprimer</button></div></div>`;
  const l=ENGINE?gsum().slice(0,6):gl;if(!l.length)return'';
  return `<section class="card"><h3>Parties enregistrées</h3><div style="display:grid;gap:10px">${l.map(row).join('')}</div></section>`;
}
function board(s,cur){
  const r=s.teams.map((t,i)=>({...t,i})).sort((a,b)=>b.s-a.s||a.i-b.i);
  return `<aside class="card score"><h3>Classement</h3><ol>${r.map((t,k)=>`<li class="${cur&&t.i==s.i0?'cur':''}"><span class="rk">${k+1}</span><span class="nm">${esc(t.n)}</span><span class="pt">${t.s}</span></li>`).join('')}</ol></aside>`;
}
function head(s){
  const th=THEMES[s.th];   /* même pastille « TOUR x/y » que sur la TV, sans étoiles : elle tient quelle que soit la durée de la partie */
  return `<div class="pill ph">Tour ${s.round+1}<span>/${s.rounds}</span></div>
  <div class="ctx"><div class="who"><span>Au tour de</span>${esc(s.teams[s.ti].n)}</div><div class="theme" style="--c:${th.c}">${thIco(s.th)}${esc(th.n)}</div></div>`;
}
/* Propositions. Une fois la réponse donnée (phase r) : la bonne en vert, la réponse fausse choisie en rouge, les autres en retrait.
   Réponse directe (sans propositions) : la bonne réponse s'affiche seule. */
function optsHTML(s){
  const r=s.phase=='r';
  if(!s.opts)return r?`<div class="opts one">${tile(s.q.a,0,'ok','Bonne réponse')}</div>`:'';
  return `<div class="opts" style="--th:${THEMES[s.th].c}">${s.opts.map((o,i)=>{
    const st=r?(o==s.q.a?'ok':o==s.pick?'bad':s.hid.includes(o)?'off':'no'):s.hid.includes(o)?'off':'';
    return tile(o,i,st,st=='ok'?'Bonne réponse':st=='bad'?'Réponse donnée':'')}).join('')}</div>`;
}
/* Télécommande : le Maître du Jeu touche la proposition donnée par l'équipe, puis valide. */
let sel=null,selKey='';
function pickHTML(s){
  return `<div class="opts" style="--th:${THEMES[s.th].c}">${s.opts.map((o,i)=>tile(o==s.q.a?o+' ✓':o,i,s.hid.includes(o)?'off':'','',true)).join('')}</div>`;
}
const answer=c=>{sel=null;say({t:'ans',c})};   /* c (choix), pas o : o est réservé à l'offre WebRTC */
/* Écran TV, réponse révélée : points marqués et « Le saviez-vous ? » sur la même ligne */
function resultRow(s){
  const ok=s.pts>0;
  const card=`<div class="rcard ${ok?'good':'miss'}"><div class="burst"><svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${BURST}"/></svg><b>${ok?'+'+s.pts:'0'}</b></div>
    <div><h3>${ok?'Bien joué !':'Dommage !'}</h3><p>${ok?esc(s.teams[s.ti].n)+' empoche '+plural(s.pts,'point'):'Pas de point pour '+esc(s.teams[s.ti].n)+' cette fois'}</p></div></div>`;
  const fact=s.q.f?`<div class="fact"><span class="bulb">${ICO.bulb}</span><div><h3>Le saviez-vous ?</h3><p>${esc(s.q.f)}</p></div></div>`:'';
  return `<div class="rrow ${fact?'':'solo'}">${card}${fact}</div>`;
}
function endHTML(s,ctl){
  const top=Math.max(...s.teams.map(t=>t.s)),w=s.teams.filter(t=>t.s==top).map(t=>t.n);
  return `<div class="end"><p class="sub">${w.length>1?'Égalité entre':'Victoire de'}</p><div class="win"><i class="emo">🏆</i> ${esc(w.join(' & '))}</div>
  <div style="text-align:left;margin-bottom:20px">${board({...s,i0:-1},false)}</div>${ctl&&(!s.free||s.host==PID)?'<button class="btn pink big" onclick="cmd(\'replay\')">Nouvelle partie</button>':''}</div>`;
}
const netHTML=()=>`<p class="st sub" style="font-size:.85rem">${esc(lnkTxt())}</p><p class="st sub" style="font-size:.85rem">Code de l'écran : ${esc(codeTag())} · Envoi : ${net.fail?'⚠ '+esc((net.fail=='429'?'service saturé (429)':net.fail)+(net.why?' « '+net.why+' »':'')+(outQ.length?', nouvel essai en cours':'')):(net.ok?'OK':'en attente')} · Messages reçus : ${net.got}</p><p class="st sub" style="font-size:.85rem">Relais : ntfy.sh ${esc(net.ntfy||'…')} · Nostr ${nLive()}/${nr.length} connecté(s)</p>`+(net.sse||net.poll?`<p class="st sub" style="font-size:.85rem">Réception en temps réel : ${esc(net.sse||'…')}${net.poll?` · Lecture de secours : ${esc(net.poll)}${net.polled!=null?' ('+net.polled+' message(s) de la TV)':''}`:''}</p>`:'');
/* Diagnostic replié par défaut (accordéon) pour ne pas encombrer l'écran ; ⚠ dans le titre en cas de problème d'envoi.
   L'état ouvert/fermé est conservé d'un affichage à l'autre. */
let diagOpen=false;
const diagHTML=extra=>`<details class="diag" ${diagOpen?'open':''} ontoggle="diagOpen=this.open"><summary>Détails de connexion${net.fail?' ⚠':''}</summary>${extra||''}${netHTML()}</details>`;
function connHelp(){
  const sat=!nLive()&&(net.fail=='429'||/429/.test(net.poll));
  let titre,texte;
  if(sat){titre='Service de messages saturé';texte='Le service gratuit limite le nombre de requêtes par connexion Internet, et la TV et le téléphone sur le même Wi-Fi comptent ensemble. Passez le téléphone en données mobiles (Wi-Fi coupé) ou fermez les autres pages Quiz Time et patientez 2 minutes : les messages sont renvoyés automatiquement.'}
  else if(net.poll=='OK'&&net.polled===0){titre="La TV ne publie aucun message";texte="Le service n'a rien reçu de la TV : elle n'arrive pas à répondre. Vérifiez que la page de la TV est ouverte, active et connectée à Internet, puis touchez Relancer."}
  else if(net.sse=='fermée'){titre='Liaison temps réel bloquée';texte='La lecture de secours est active : la connexion peut prendre une dizaine de secondes. Si elle échoue, essayez un autre navigateur ou coupez le relais privé / le VPN du téléphone.'}
  else{titre="Pas de réponse de l'écran TV";texte="Vérifiez que la page de la TV est ouverte et qu'elle affiche le même code d'écran ("+codeTag()+"). Sinon, scannez à nouveau son QR code."}
  return `<div class="anec"><b>${esc(titre)}</b><p>${esc(texte)}</p></div><button class="btn big" onclick="hello();retryNow();pollNow()">Relancer</button>`;
}
const qrURL=(n,u)=>{try{const q=qrcode(0,'M');q.addData(u||joinUrl);q.make();return q.createDataURL(n,2)}catch(e){return''}};
const lostBar=(t='Maître du Jeu déconnecté. Il peut rescanner ce QR code ou rouvrir sa page : la partie est conservée.')=>conn?'':`<div class="anec" style="display:flex;align-items:center;gap:1rem;margin-bottom:1.4rem"><img alt="QR code" style="width:7rem;border-radius:.5rem;background:#fff;padding:.4rem" src="${qrURL(6)}"><span>${t}</span></div>`;
/* Accueil de la TV : on choisit d'abord avec ou sans Maître du Jeu, puis le QR code s'affiche pour le téléphone qui configure. */
let tvFm=null;
/* Sur un téléphone, pas d'écran TV à scanner : il devient l'hôte de la partie (?host), se configure et montre le QR code aux équipes. */
const PHONE=Math.min(screen.width,screen.height)<600;
function tvFree(){if(PHONE){lsSet(CK,null);location.href='?host';return}tvFm=true;push();render()}
function tvWait(){
  if(tvFm==null&&!conn)return `<div class="tvwait"><h2 class="hero">Quiz <span>Time</span></h2><p style="font-size:1.4rem;margin:0">Comment voulez-vous jouer ?</p>
  <div class="tvpick"><button class="btn" onclick="tvFm=false;push();render()"><b>Avec Maître du Jeu</b><i>Il lit les questions et valide les réponses sur son téléphone</i></button>
  <button class="btn" onclick="tvFree()"><b>Sans Maître du Jeu</b><i>Chaque équipe répond sur son téléphone, les questions s'affichent ici</i></button></div>
  <p class="foot sub"><a href="?host">Pas de TV ? Jouer uniquement sur les téléphones</a></p></div>`;
  const u=qrURL(8);
  const qr=u?`<div class="qr"><img alt="QR code pour rejoindre la partie" src="${u}"></div>`:'';
  const tl=lobby.length?`<p class="st">Équipes inscrites : ${lobby.map(l=>esc(l.n)).join(' · ')}</p>`:'';
  const who=tvFm?'de l\'hôte':'du Maître du Jeu';
  const s=conn?`<p class="st on">✓ Téléphone ${who} connecté · configuration en cours</p>`+tl+diagHTML()
    :`<p class="st sub">En attente du téléphone ${who}…</p>`+diagHTML(`<p class="st sub" style="font-size:.85rem">Serveur de messages : ${tvOk?'✓ joint':'en cours (si cela dure, le réseau le bloque)…'}</p>`);
  return `<div class="tvwait"><h2 class="hero">Quiz <span>Time</span></h2>${qr||`<p class="sub">QR code indisponible. Ouvrez l'adresse ci-dessous sur le téléphone.</p>`}
  <p style="font-size:1.4rem;margin:0">${tvFm?'Partie sans Maître du Jeu : l\'hôte scanne ce QR code, crée son équipe, puis montre son propre QR code aux autres équipes':'Scannez ce QR code avec le smartphone du Maître du Jeu'}</p>${s}<p class="url">${esc(joinUrl)}</p>
  ${conn?'':'<p class="foot sub"><a href="#" onclick="tvFm=null;render();return false">Changer de mode</a></p>'}</div>`;
}
/* Réinitialisation de la TV, sous le bas de l'écran (il faut défiler pour l'atteindre) : même effet que ?tv,
   utile dans l'application installée où l'adresse ne se modifie pas. La partie reste dans les parties enregistrées. */
const tvResetHTML=`<div class="tvreset"><button class="btn mut" onclick="if(confirm('Réinitialiser l\\'écran TV ? La partie en cours reste dans les parties enregistrées.'))location.href='?tv'">Réinitialiser l'écran TV</button><p class="sub">Revient à l'accueil. La partie en cours pourra être reprise depuis les parties enregistrées.</p></div>`;
/* Bandeau du haut : tour en cours et équipes, celle qui joue mise en avant. */
function tvTop(s){
  const chips=s.teams.map((t,i)=>`<div class="chip ${i==s.ti?'cur':''}">${i==s.ti?'<em>À vous !</em>':''}<span class="sc"><b>${t.s}</b><small>${t.s>1?'pts':'pt'}</small></span><span class="nm">${esc(t.n)}</span></div>`).join('');
  return `<div class="tvhead"><div class="pill">Tour ${s.round+1}<span>/${s.rounds}</span></div><div class="tvscore">${chips}</div></div>`;
}
function tvRules(){
  const P=(t,d,x)=>`<div class="rpt"><b>${t}</b><span><strong>${d}</strong> ${x}</span></div>`;
  return `<div class="rules"><h2 class="hero">🎉 Quiz <span>Time</span> — Règles du jeu</h2>
  <p class="rintro">Bienvenue dans Quiz Time ! Formez vos équipes, échauffez vos neurones : six thèmes de culture générale vous attendent.</p>
  <div class="rgrid"><div class="rcol">
  <section class="card"><h3>Le principe</h3><p>La partie se joue en plusieurs tours. À chaque tour, chaque équipe reçoit une question, à tour de rôle. Le thème change à chaque tour, parmi :</p>
    <div class="rth">${THEMES.map((t,i)=>`<span style="--c:${t.c}">${thIco(i)}${esc(t.n)}</span>`).join('')}</div></section>
  <section class="card"><h3>Le saviez-vous ?</h3><p>Après chaque question, le Maître du Jeu partage une petite anecdote. Ouvrez grand les oreilles : on ne sait jamais, elle pourrait vous servir un jour !</p></section>
  <section class="card"><h3>La fin de partie</h3><p>Après le dernier tour, l'équipe qui a le plus de points remporte la partie 🏆. En cas d'égalité, les équipes ex æquo se partagent la victoire.</p></section>
  </div><div class="rcol">
  <section class="card"><h3>Comment répondre</h3><p>Quand c'est votre tour, le Maître du Jeu lit la question. Vous avez trois façons de tenter votre chance, et plus vous prenez de risques, plus vous gagnez de points :</p>
    ${P('5 pts','Réponse directe :','vous répondez sans aide. Les vrais experts tentent leur chance ici !')}
    ${P('3 pts','Les 4 propositions :','vous demandez à voir quatre réponses possibles, et vous choisissez.')}
    ${P('1 pt','Le 50/50 :','il ne reste plus que deux propositions. À vous de trouver la bonne.')}
    <p class="rwarn">⚠️ <strong>Attention :</strong> une mauvaise réponse, à n'importe quelle étape, rapporte 0 point et la main passe à l'équipe suivante. Demander de l'aide, c'est donc moins de points, mais plus de chances de marquer.</p></section>
  <section class="card"><h3>Les règles d'or</h3><ul><li>Une seule réponse par équipe : mettez-vous d'accord avant de parler.</li><li>Pas de téléphone, pas d'aide extérieure.</li><li>Les décisions du Maître du Jeu sont sans appel… mais toujours bienveillantes !</li></ul></section>
  </div></div><p class="rluck">Bonne chance à toutes les équipes !</p></div>`;
}
function tvGame(s){
  const q=s.q,r=s.phase=='r',th=THEMES[s.th];
  const tag=`<span class="qtag" style="--c:${th.c}">${thIco(s.th)}${esc(th.n)}${s.cr?' · Niveau '+s.lv:''}</span>`;
  return `${tvTop(s)}<section class="qcard ${r?'mini':''}">${tag}<h2 class="q">${escQ(q.q)}</h2>${tmrRing(s)}</section>${optsHTML(s)}${r?resultRow(s):''}`;
}
function ctlGame(s){
  if(s.phase=='rules')return `<div class="setup"><section class="card"><h3>Règles du jeu</h3><p>Les règles sont affichées sur la TV. Laissez les équipes les lire, puis lancez la première question.</p>
    <button class="btn pink big" onclick="cmd('begin')">Lancer la partie</button></section></div>`;
  const q=s.q,B=(c,t,a)=>`<button class="btn ${c} big" onclick="${a}">${t}</button>`;
  let b='';
  if(s.phase=='q')b=B('green','Bonne réponse directe',"cmd('ans',5)")+B('pink','Mauvaise réponse',"cmd('ans',0)")+B('','Afficher les 4 propositions',"cmd('show')");
  else if(s.phase=='m'||s.phase=='f'){
    const k=s.round+'-'+s.ti+'-'+s.phase;if(k!=selKey){selKey=k;sel=null}
    if(sel!=null&&s.hid.includes(s.opts[sel]))sel=null;
    const o=sel!=null?s.opts[sel]:null;
    b=(o==null?'<p class="sub hint">Touchez la proposition donnée par l\'équipe, puis validez.</p>'
      :B(o==q.a?'green':'pink',`Valider « ${esc(o)} »`,`answer(st.opts[${sel}])`))
      +(s.phase=='m'?B('','50/50',"cmd('fifty')"):'')+B('mut','Pas de réponse','answer(null)');
  }
  else b=`<div class="anec"><b>${s.pts?'+'+plural(s.pts,'point'):'0 point'} pour ${esc(s.teams[s.ti].n)}</b><p>Le saviez-vous ? ${esc(q.f)}</p></div>`+B('',s.last?'Voir le classement final':'Question suivante',"cmd('next')");
  const opts=(s.phase=='m'||s.phase=='f')?pickHTML(s):optsHTML(s);
  return `<div class="grid"><main>${head(s)}<section class="card qcard"><p class="lvl">Niveau ${q.l} · ${esc(LV[q.l-1])}</p>${tmrHTML(s)}<h2 class="q">${escQ(q.q)}</h2>
  <p class="exp">Réponse attendue : <b>${esc(q.a)}</b></p>${opts}<div class="acts">${b}</div></section><div class="ctlbar"><button class="btn mut" onclick="if(confirm('Mettre la partie en pause ? Elle restera enregistrée.'))cmd('pause')">Mettre en pause</button><button class="btn pink" onclick="if(confirm('Terminer la partie maintenant ?'))cmd('finish')">Terminer la partie</button></div></main>${board({...s,i0:s.ti},true)}</div>`;
}
let lastH='',buzzKey='';
function render(){
  $('#meta').textContent='';
  const a=$('#app');let h;
  if(TV){
    const s=pub();
    h=scr=='game'&&s&&s.q?lostBar(s.free?'Téléphone de l\'hôte déconnecté. Il peut rescanner ce QR code ou rouvrir sa page : la partie est conservée.':undefined)+(s.phase=='rules'?(s.free?tvRulesFree(s):tvRules()):s.free?tvFree(s):tvGame(s)):scr=='end'&&s?lostBar(s.free?'Scannez ce QR code avec le téléphone de l\'hôte puis touchez « Nouvelle partie ».':'Scannez ce QR code avec le téléphone du Maître du Jeu puis touchez « Nouvelle partie ».')+endHTML(s,false):tvWait();
    if(scr=='game'||scr=='end')h=`<div class="tvmain">${h}</div>`+tvResetHTML;
  }
  else if(HOSTL){const s=pub();h=scr=='game'&&s&&s.q?fGame(s):scr=='end'&&s?endHTML(s,true):renderSetup()}
  else if(scr=='conn')h=`<div class="card"><h3>${TEAM?'Connexion à la partie…':'Connexion à l\'écran principal…'}</h3><p class="st">Serveur de messages : ${pOk?'✓ joint':'en cours…'}</p><p class="st">${TEAM?'Partie':'Écran TV'} : ${cOk?'✓ trouvé':'en recherche…'}</p>${Date.now()-t0>12000?connHelp():''}${diagHTML()}<p class="foot sub"><a href="?forget">Scanner un autre QR code</a> · <a href="?tv">Utiliser cet appareil comme écran TV</a></p></div>`;
  else if(TEAM){fAutoJoin();h=fTeam()}
  else if(scr=='cfgd'||!st)h=renderSetup();
  else h=scr=='end'?endHTML(st,true):(st.q?(st.free?fGame(st):ctlGame(st)):renderSetup());
  /* Même écran qu'avant : rien n'est redessiné, ce qui garde le clavier ouvert pendant la saisie d'une réponse.
     Sinon, le champ qui avait le focus le retrouve, avec son texte et la position du curseur. */
  if(h!==lastH){
    const f=document.activeElement,fid=f&&f.id&&f.tagName=='INPUT'?f.id:'',sv=fid?[f.value,f.selectionStart,f.selectionEnd]:null;
    a.innerHTML=h;lastH=h;
    const e=fid&&document.getElementById(fid);
    if(e){e.value=sv[0];e.focus();try{e.setSelectionRange(sv[1],sv[2])}catch(x){}}
  }
  if(TV)teamOverlay();
  /* Téléphone d'une partie sans Maître du Jeu : signal au début de chaque question. */
  const ps=ENGINE?(HOSTL&&scr=='game'?pub():null):scr=='game'?st:null;
  if(ps&&ps.free&&ps.phase=='q'){const k=ps.gid+'-'+ps.round;if(k!=buzzKey){buzzKey=k;const me=ps.teams.find(t=>t.id==PID);if(me&&!(ps.an[PID]&&ps.an[PID].done))buzz()}}
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
  if(ENGINE)loadS();
  render();
  ENGINE?tvInit():ctlInit();
  setInterval(tick,250);
  if(ENGINE)setInterval(fTimer,250);
  if(!ENGINE)setInterval(()=>{if(scr=='conn')render()},1000);
  keepAwake();
  if('serviceWorker' in navigator&&window.isSecureContext)navigator.serviceWorker.register('sw.js').catch(()=>{});
}
boot();
