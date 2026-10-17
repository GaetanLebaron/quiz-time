/* Sons de la TV, synthétisés dans le navigateur (Web Audio) : aucun fichier à charger, fonctionne hors ligne.
   Uniquement sur l'écran TV ; les téléphones restent silencieux. La case « Sons sur la TV » de la configuration
   les coupe (S.snd). Un navigateur n'autorise le son qu'après une action sur la page : le premier appui sur
   une touche de la télécommande (ou un clic) débloque le son. */
let AC=null,VOL=null;
/* Enregistrements (MP3 libres de droits, dossier sons/) : s'ils sont présents, ils remplacent le son synthétisé correspondant.
   Un fichier absent ou illisible laisse simplement le son synthétisé. */
const FICHIERS={good:'sons/bonne-reponse.mp3',bad:'sons/mauvaise-reponse.mp3',roll:'sons/roulement.mp3',fanfare:'sons/fanfare.mp3'},BUF={};
function sndLoad(){
  Object.keys(FICHIERS).forEach(k=>fetch(FICHIERS[k]).then(r=>r.ok?r.arrayBuffer():null).then(a=>{if(a)AC.decodeAudioData(a,b=>{BUF[k]=b},()=>{})}).catch(()=>{}));
}
/* Lecture d'un enregistrement ; d : durée maximale (le roulement est répété en boucle jusque-là). Renvoie false s'il n'est pas chargé. */
function play(k,t0,d){
  const b=BUF[k];if(!b)return false;
  const s=AC.createBufferSource(),t=AC.currentTime+(t0||0);s.buffer=b;s.connect(VOL);
  if(d){s.loop=true;s.start(t);s.stop(t+d)}else s.start(t);
  return true;
}
function sndCtx(){
  try{
    if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;AC=new C();VOL=AC.createGain();VOL.gain.value=.35;VOL.connect(AC.destination);sndLoad()}
    if(AC.state=='suspended')AC.resume();
  }catch(e){return null}
  return AC;
}
if(TV){const u=()=>sndCtx();document.addEventListener('keydown',u);document.addEventListener('pointerdown',u)}
const sndOn=()=>TV&&S&&S.snd!==false&&AC&&AC.state=='running';
/* Note : forme d'onde, fréquence (ou [début, fin] pour un glissando), début et durée en secondes, volume */
function note(type,f,t0,d,v){
  const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime+t0;
  o.type=type;
  if(Array.isArray(f)){o.frequency.setValueAtTime(f[0],t);o.frequency.exponentialRampToValueAtTime(f[1],t+d)}else o.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g);g.connect(VOL);o.start(t);o.stop(t+d+.05);
}
/* Bruit blanc filtré : souffle, caisse claire, cymbale */
let NOISE=null;
function noise(t0,d,v,ftype,f0,f1){
  if(!NOISE){NOISE=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const a=NOISE.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1}
  const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain(),t=AC.currentTime+t0;
  s.buffer=NOISE;s.loop=true;fl.type=ftype;fl.frequency.setValueAtTime(f0,t);if(f1)fl.frequency.exponentialRampToValueAtTime(f1,t+d);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+Math.min(.05,d/3));g.gain.exponentialRampToValueAtTime(.001,t+d);
  s.connect(fl);fl.connect(g);g.connect(VOL);s.start(t);s.stop(t+d+.05);
}
const SONS={
  /* Annonce « Au tour de… / Question x » : souffle qui monte, puis accord bref */
  whoosh(){noise(0,.5,.5,'bandpass',300,3500);[523,659,784].forEach(f=>note('triangle',f,.38,.45,.18))},
  /* 5 dernières secondes : un tic, un peu plus aigu à chaque seconde (n = secondes restantes) */
  tick(n){note('sine',1500-n*100,0,.07,.5);note('square',(1500-n*100)/2,0,.03,.08)},
  /* Temps écoulé */
  buzz(){note('sawtooth',150,0,.7,.35);note('sawtooth',155,0,.7,.25)},
  /* Bonne réponse : carillon montant */
  good(){if(play('good'))return;[784,988,1175,1568].forEach((f,i)=>{note('sine',f,i*.09,.8,.3);note('triangle',f*2,i*.09,.3,.06)})},
  /* Mauvaise réponse : « pouet pouet » descendant, comme un trombone */
  bad(){if(play('bad'))return;note('square',[330,300],0,.28,.18);note('square',[260,175],.32,.55,.18)},
  /* Podium : roulement de tambour pendant d secondes, puis cymbale et fanfare */
  podium(d){
    if(!play('roll',0,d))for(let t=0;t<d;t+=.055)noise(t,.05,.08+.22*t/d,'bandpass',1800);
    if(play('fanfare',d))return;
    noise(d,1.4,.4,'highpass',6000);
    [[523,0,.14],[523,.16,.14],[523,.32,.14],[659,.48,.5],[587,.98,.14],[659,1.14,.14],[784,1.3,.9]]
      .forEach(([f,t,l])=>{note('sawtooth',f,d+t,l,.12);note('triangle',f/2,d+t,l,.12)});
  }
};
function snd(n,x){if(sndOn())try{SONS[n](x)}catch(e){}}
