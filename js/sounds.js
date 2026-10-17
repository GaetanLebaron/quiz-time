/* TV sounds (Web Audio): recordings from the sounds/ folder when they exist, otherwise sounds synthesized in the browser.
   Only on the TV screen; phones stay silent. The "Sons sur la TV" checkbox in the setup
   turns them off (S.snd). A browser only allows sound after an action on the page: the first press of
   a remote key (or a click) unlocks sound. */
let AC=null,VOL=null,FVOL=null;
/* Recordings (royalty-free MP3s, sounds/ folder): when present, they replace the matching synthesized sound.
   A missing or unreadable file simply leaves the synthesized sound. */
const FICHIERS={good:'sounds/correct-answer.mp3',bad:'sounds/wrong-answer.mp3',roll:'sounds/drumroll.mp3',fanfare:'sounds/fanfare.mp3',whoosh:'sounds/whoosh.mp3',timer:'sounds/countdown.mp3'},BUF={};
function sndLoad(){
  Object.keys(FICHIERS).forEach(k=>fetch(FICHIERS[k]).then(r=>r.ok?r.arrayBuffer():null).then(a=>{if(a)AC.decodeAudioData(a,b=>{BUF[k]=b},()=>{})}).catch(()=>{}));
}
/* Plays a recording at t0 seconds, from position off. Returns the source (to stop it), or null if it is not loaded. */
function play(k,t0,off){
  const b=BUF[k];if(!b)return null;
  const s=AC.createBufferSource();s.buffer=b;s.connect(FVOL);s.start(AC.currentTime+(t0||0),off||0);
  return s;
}
/* Drum roll lasting d seconds: the roll (without the final hit) loops, then the final hit lands just before the fanfare. */
const ROLL_FIN=1.1;
function roll(d){
  const b=BUF.roll;if(!b)return false;
  const fin=Math.max(0,d-(b.duration-ROLL_FIN)+.25),s=AC.createBufferSource(),t=AC.currentTime;
  s.buffer=b;s.loop=true;s.loopStart=.05;s.loopEnd=ROLL_FIN;s.connect(FVOL);s.start(t);s.stop(t+fin);
  play('roll',fin,ROLL_FIN);
  return true;
}
/* Recorded countdown: 5 beeps (one per second) then the end ring. Stopped if the question ends earlier. */
let TMR=null;
function sndTimerStop(){if(TMR){if(AC.currentTime-TMR.t0<4.9)try{TMR.stop()}catch(e){}TMR=null}}   /* the end ring, however, plays to the end */
function sndCtx(){
  try{
    if(!AC){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;AC=new C();VOL=AC.createGain();VOL.gain.value=.35;VOL.connect(AC.destination);FVOL=AC.createGain();FVOL.gain.value=.6;FVOL.connect(AC.destination);sndLoad()}
    if(AC.state=='suspended')AC.resume();
  }catch(e){return null}
  return AC;
}
if(TV){const u=()=>sndCtx();document.addEventListener('keydown',u);document.addEventListener('pointerdown',u)}
const sndOn=()=>TV&&S&&S.snd!==false&&AC&&AC.state=='running';
/* Note: waveform, frequency (or [start, end] for a glissando), start and duration in seconds, volume */
function note(type,f,t0,d,v){
  const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime+t0;
  o.type=type;
  if(Array.isArray(f)){o.frequency.setValueAtTime(f[0],t);o.frequency.exponentialRampToValueAtTime(f[1],t+d)}else o.frequency.setValueAtTime(f,t);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.01);g.gain.exponentialRampToValueAtTime(.001,t+d);
  o.connect(g);g.connect(VOL);o.start(t);o.stop(t+d+.05);
}
/* Filtered white noise: whoosh, snare drum, cymbal */
let NOISE=null;
function noise(t0,d,v,ftype,f0,f1){
  if(!NOISE){NOISE=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);const a=NOISE.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1}
  const s=AC.createBufferSource(),fl=AC.createBiquadFilter(),g=AC.createGain(),t=AC.currentTime+t0;
  s.buffer=NOISE;s.loop=true;fl.type=ftype;fl.frequency.setValueAtTime(f0,t);if(f1)fl.frequency.exponentialRampToValueAtTime(f1,t+d);
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+Math.min(.05,d/3));g.gain.exponentialRampToValueAtTime(.001,t+d);
  s.connect(fl);fl.connect(g);g.connect(VOL);s.start(t);s.stop(t+d+.05);
}
const SONS={
  /* "Au tour de… / Question x" announcement: recorded whoosh, synced with the screen flip (otherwise a short xylophone jingle) */
  whoosh(){
    if(play('whoosh'))return;
    const X=(f,t,d)=>{note('sine',f,t,d,.45);note('sine',f*4,t,.08,.06);note('triangle',f*2,t,d*.5,.05)};
    X(523,0,.25);X(659,.13,.25);X(784,.26,.7);X(1047,.26,.7);
  },
  /* Cascading options: a light tick per option, synced with their arrival (every 0.06 s), slightly higher each time */
  cascade(n){for(let i=0;i<n;i++){note('sine',880*Math.pow(1.19,i),i*.06+.03,.035,.22);note('triangle',1760*Math.pow(1.19,i),i*.06+.03,.015,.05)}},
  /* Last 5 seconds: a tick, slightly higher each second (n = seconds left) */
  tick(n){if(TMR)return;if(n==5&&(TMR=play('timer',0,.08))){TMR.t0=AC.currentTime;return}note('sine',1500-n*100,0,.07,.5);note('square',(1500-n*100)/2,0,.03,.08)},
  /* Time's up */
  buzz(){if(TMR){TMR=null;return}note('sawtooth',150,0,.7,.35);note('sawtooth',155,0,.7,.25)},
  /* Correct answer: rising chime */
  good(){if(play('good'))return;[784,988,1175,1568].forEach((f,i)=>{note('sine',f,i*.09,.8,.3);note('triangle',f*2,i*.09,.3,.06)})},
  /* Wrong answer: descending "wah wah", like a trombone */
  bad(){if(play('bad'))return;note('square',[330,300],0,.28,.18);note('square',[260,175],.32,.55,.18)},
  /* Podium: drum roll for d seconds, then cymbal and fanfare */
  podium(d){
    if(!roll(d))for(let t=0;t<d;t+=.055)noise(t,.05,.08+.22*t/d,'bandpass',1800);
    if(play('fanfare',d))return;
    noise(d,1.4,.4,'highpass',6000);
    [[523,0,.14],[523,.16,.14],[523,.32,.14],[659,.48,.5],[587,.98,.14],[659,1.14,.14],[784,1.3,.9]]
      .forEach(([f,t,l])=>{note('sawtooth',f,d+t,l,.12);note('triangle',f/2,d+t,l,.12)});
  }
};
function snd(n,x){if(sndOn())try{SONS[n](x)}catch(e){}}
