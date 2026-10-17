/* Quiz Time : écran TV + télécommande du Maître du Jeu, ou partie sans Maître du Jeu où chaque équipe joue sur son téléphone.
   Les questions sont dans questions.json. Les appareils s'échangent leurs messages via ntfy.sh et des relais Nostr publics (sans compte).
   Fichiers, dans l'ordre de chargement : base.js (rôle de l'appareil, état), moteur.js (partie avec Maître du Jeu),
   liaison.js (échange de messages), libre.js (partie sans Maître du Jeu), app.js (écrans et démarrage). */

const BASE=window.QT_BASE||'https://ntfy.sh/';   /* QT_BASE : autre serveur ntfy (tests, serveur personnel) */
const OVL_MS=2000;   /* durée de l'animation de changement d'équipe */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Texte d'une question : espace insécable devant « ? », « ! », « : » et « ; » pour qu'ils ne se retrouvent jamais seuls en début de ligne. */
const escQ=s=>esc(s).replace(/ ([?!:;])/g,'\u00a0$1');
const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const plural=(n,w)=>n+' '+w+(n>1?'s':'');
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const rawGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const rawSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const rawDel=k=>{try{localStorage.removeItem(k)}catch(e){}};

/* ---------- Rôle de l'appareil ----------
   - écran TV (adresse sans paramètre, ou ?tv) : fait tourner la partie et l'affiche ;
   - télécommande (?join=…, QR code de la TV) : Maître du Jeu, ou hôte d'une partie sans Maître du Jeu ;
   - téléphone d'équipe (?team=…, QR code affiché par l'hôte) : partie sans Maître du Jeu ;
   - hôte sans TV (?host) : ce téléphone fait tourner la partie et joue pour son équipe. */
const okId=s=>/^[a-z0-9]{6,40}$/i.test(s||'');
const P=new URLSearchParams(location.search);
let JOIN=null,TEAMJ=null;
const SCAN=P.has('forget');   /* ?forget : le téléphone oublie l'écran mémorisé et attend un nouveau scan */
const HOSTL=!SCAN&&P.has('host');
if(SCAN){rawDel('qt-join');rawDel('qt-team')}
else if(HOSTL){rawDel('qt-join');rawDel('qt-team')}
else if(P.has('tv')){rawDel('qt-join');rawDel('qt-team');rawDel('quiz-time-cur');try{history.replaceState(null,'',location.pathname)}catch(e){}}
else if(okId(P.get('team'))){TEAMJ=P.get('team');rawSet('qt-team',TEAMJ);rawDel('qt-join')}
else if(okId(P.get('join'))){JOIN=P.get('join');rawSet('qt-join',JOIN);rawDel('qt-team')}
else if(okId(rawGet('qt-join')))JOIN=rawGet('qt-join');
else if(okId(rawGet('qt-team')))TEAMJ=rawGet('qt-team');
const ENGINE=!JOIN&&!TEAMJ&&!SCAN;   /* cet appareil fait tourner la partie : écran TV, ou hôte sans TV */
const TV=ENGINE&&!HOSTL,TEAM=!!TEAMJ;
/* Identifiant de ce téléphone, conservé : il retrouve son équipe après une mise en veille ou un rechargement. */
const PID=(()=>{let id=rawGet('qt-pid');if(!okId(id)){id='p'+Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>(b%36).toString(36)).join('');rawSet('qt-pid',id)}return id})();
document.body.classList.toggle('tv',TV);document.documentElement.classList.toggle('tv',TV);   /* html.tv : taille de base adaptée à l'écran (style.css) */

/* ---------- État ---------- */
let THEMES=[],LV=[],Q=[],QMAP=new Map();
/* free : partie sans Maître du Jeu ; me : nom de l'équipe de l'hôte ; roundsFree et timerFree : réglages propres à ce mode (une question par tour). */
let cfg=Object.assign({teams:['Équipe 1','Équipe 2'],rounds:5,level:2,mode:'std',levels:[1,2,3,4,5],timerOn:false,timerSec:30,free:false,me:'',roundsFree:10,timerFree:30},lsGet('qt-cfg')||{});
if(HOSTL)cfg.free=true;   /* sans TV, il n'y a pas de Maître du Jeu */
if(!Array.isArray(cfg.levels))cfg.levels=[1,2,3,4,5];
if(!Array.isArray(cfg.teams)||cfg.teams.length<2)cfg.teams=['Équipe 1','Équipe 2'];
cfg.teams=cfg.teams.slice(0,8).map(t=>String(t).slice(0,24));
const saveCfg=()=>lsSet('qt-cfg',cfg);
let S=null,st=null,scr=TV?'wait':HOSTL?'cfgd':'conn',conn=false,joinUrl='',lb=[],lbHn='';   /* lb : équipes inscrites (vue du téléphone), lbHn : équipe de l'hôte */
let tvOk=false,pOk=false,cOk=false,gl=[],recvAt=0,lastKey=null;
const t0=Date.now();
const GK='quiz-time-games',CK='quiz-time-cur';

