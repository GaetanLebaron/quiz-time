/* Quiz Time: TV screen + Game Master remote, or a game without a Game Master where each team plays on its own phone.
   Questions live in questions.json. Devices exchange messages through ntfy.sh and public Nostr relays (no account needed).
   Files, in load order: base.js (device role, state), engine.js (game with a Game Master),
   transport.js (message exchange), freeplay.js (game without a Game Master), app.js (screens and startup). */

const BASE=window.QT_BASE||'https://ntfy.sh/';   /* QT_BASE: another ntfy server (tests, self-hosted server) */
const OVL_MS=2000;   /* duration of the team-change animation */
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Question text: non-breaking space before "?", "!", ":" and ";" so they never end up alone at the start of a line. */
const escQ=s=>esc(s).replace(/ ([?!:;])/g,'\u00a0$1');
const shuf=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const plural=(n,w)=>n+' '+w+(n>1?'s':'');
/* App logo. From October 30 to November 1, 2026 inclusive (device date), it becomes "🍄 Champotes Quiz";
   the usual title comes back on its own on November 2. Only the displayed logo changes (not the icon, the URL or the app name). */
const champ=(d=new Date())=>d.getFullYear()==2026&&(d.getMonth()==9&&d.getDate()>=30||d.getMonth()==10&&d.getDate()<=1);
const appNom=()=>champ()?'Champotes Quiz':'Quiz Time';
const logo=()=>champ()?'<b class="champ">🍄 Champotes</b> <span>Quiz</span>':'Quiz <span>Time</span>';
const logoRegles=()=>champ()?logo():'🎉 '+logo();
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch(e){return null}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
const rawGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const rawSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
const rawDel=k=>{try{localStorage.removeItem(k)}catch(e){}};

/* ---------- Device role ----------
   - TV screen (URL without a parameter, or ?tv): runs the game and displays it;
   - remote (?join=…, the TV's QR code): Game Master, or host of a game without a Game Master;
   - team phone (?team=…, QR code shown by the host): game without a Game Master;
   - host without a TV (?host): this phone runs the game and plays for its team. */
const okId=s=>/^[a-z0-9]{6,40}$/i.test(s||'');
const P=new URLSearchParams(location.search);
let JOIN=null,TEAMJ=null;
const SCAN=P.has('forget');   /* ?forget: the phone forgets the remembered screen and waits for a new scan */
const HOSTL=!SCAN&&P.has('host');
if(SCAN){rawDel('qt-join');rawDel('qt-team')}
else if(HOSTL){rawDel('qt-join');rawDel('qt-team')}
else if(P.has('tv')){rawDel('qt-join');rawDel('qt-team');rawDel('quiz-time-cur');try{history.replaceState(null,'',location.pathname)}catch(e){}}
else if(okId(P.get('team'))){TEAMJ=P.get('team');rawSet('qt-team',TEAMJ);rawDel('qt-join')}
else if(okId(P.get('join'))){JOIN=P.get('join');rawSet('qt-join',JOIN);rawDel('qt-team')}
else if(okId(rawGet('qt-join')))JOIN=rawGet('qt-join');
else if(okId(rawGet('qt-team')))TEAMJ=rawGet('qt-team');
const ENGINE=!JOIN&&!TEAMJ&&!SCAN;   /* this device runs the game: TV screen, or host without a TV */
const TV=ENGINE&&!HOSTL,TEAM=!!TEAMJ;
/* This phone's id, kept: it finds its team again after sleep or a reload. */
const PID=(()=>{let id=rawGet('qt-pid');if(!okId(id)){id='p'+Array.from(crypto.getRandomValues(new Uint8Array(12)),b=>(b%36).toString(36)).join('');rawSet('qt-pid',id)}return id})();
document.body.classList.toggle('tv',TV);document.documentElement.classList.toggle('tv',TV);   /* html.tv: base size adapted to the screen (style.css) */

/* ---------- State ---------- */
let THEMES=[],LV=[],Q=[],QMAP=new Map();
/* free: game without a Game Master; me: name of the host's team; roundsFree and timerFree: settings specific to this mode (one question per round). */
let cfg=Object.assign({teams:['Équipe 1','Équipe 2'],rounds:5,level:2,mode:'std',levels:[1,2,3,4,5],timerOn:false,timerSec:30,free:false,me:'',roundsFree:10,timerFree:30,tvSnd:true},lsGet('qt-cfg')||{});
if(HOSTL)cfg.free=true;   /* without a TV, there is no Game Master */
if(!Array.isArray(cfg.levels))cfg.levels=[1,2,3,4,5];
if(!Array.isArray(cfg.teams)||cfg.teams.length<2)cfg.teams=['Équipe 1','Équipe 2'];
cfg.teams=cfg.teams.slice(0,8).map(t=>String(t).slice(0,24));
const saveCfg=()=>lsSet('qt-cfg',cfg);
let S=null,st=null,scr=TV?'wait':HOSTL?'cfgd':'conn',conn=false,joinUrl='',lb=[],lbHn='';   /* lb: registered teams (phone's view), lbHn: host's team */
let tvOk=false,pOk=false,cOk=false,gl=[],recvAt=0,lastKey=null;
const t0=Date.now();
const GK='quiz-time-games',CK='quiz-time-cur';

