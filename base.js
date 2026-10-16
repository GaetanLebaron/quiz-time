/* Quiz Time : écran TV + télécommande du Maître du Jeu.
   Les questions sont dans questions.json. Les deux appareils s'échangent leurs messages via ntfy.sh et des relais Nostr publics (sans compte). */

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
else if(P.has('tv')){rawDel('qt-join');rawDel('quiz-time-cur');try{history.replaceState(null,'',location.pathname)}catch(e){}}
else if(okId(P.get('join'))){JOIN=P.get('join');rawSet('qt-join',JOIN)}
else if(okId(rawGet('qt-join')))JOIN=rawGet('qt-join');
const TV=!JOIN&&!SCAN;
document.body.classList.toggle('tv',TV);document.documentElement.classList.toggle('tv',TV);   /* html.tv : taille de base adaptée à l'écran (style.css) */

/* ---------- État ---------- */
let THEMES=[],LV=[],Q=[],QMAP=new Map();
let cfg=Object.assign({teams:['Équipe 1','Équipe 2'],rounds:5,level:2,mode:'std',levels:[1,2,3,4,5],timerOn:false,timerSec:30},lsGet('qt-cfg')||{});
if(!Array.isArray(cfg.levels))cfg.levels=[1,2,3,4,5];
if(!Array.isArray(cfg.teams)||cfg.teams.length<2)cfg.teams=['Équipe 1','Équipe 2'];
cfg.teams=cfg.teams.slice(0,8).map(t=>String(t).slice(0,24));
const saveCfg=()=>lsSet('qt-cfg',cfg);
let S=null,st=null,scr=TV?'wait':'conn',conn=false,joinUrl='';
let tvOk=false,pOk=false,cOk=false,gl=[],recvAt=0,lastKey=null;
const t0=Date.now();
const GK='quiz-time-games',CK='quiz-time-cur';

