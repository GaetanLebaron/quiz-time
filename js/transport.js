/* ---------- Transport ----------
   Pairing through ntfy.sh, then a direct WebRTC link (data channel) over Wi-Fi: the free ntfy.sh quota
   (a few hundred messages per day per Internet connection) is no longer used up by game actions.
   If the direct link fails (phone on 4G, Wi-Fi that isolates devices…), everything goes through ntfy.sh as before.
   The device running the game (TV, or host without a TV) can have several phones: one direct link per phone,
   plus the Internet relays as long as at least one recent phone does not have its own. */
const T=ENGINE?(()=>{let id=rawGet('qt-id2');if(!okId(id)){id='qt'+Array.from(crypto.getRandomValues(new Uint8Array(14)),b=>(b%36).toString(36)).join('');rawSet('qt-id2',id)}return id})():JOIN||TEAMJ;
const OUT=BASE+T+(ENGINE?'s':'c'),IN=BASE+T+(ENGINE?'c':'s');
/* Link status, shown on screen to help understand a blockage. 429 = the free service limits the number of requests. */
const net={fail:'',why:'',got:0,ok:0,sse:'',poll:'',polled:null,ntfy:''};
const codeTag=()=>'…'+String(T).slice(-4);
const lnkTxt=()=>{
  if(ENGINE){const n=openPeers().length,k=recentPeers().length;return'Liaison : '+(n&&n>=k?'directe par le Wi-Fi ✓'+(n>1?' ('+n+' téléphones)':''):n?'directe pour '+n+' téléphone(s) sur '+k+', relais Internet pour les autres':'via ntfy.sh et Nostr')}
  return'Liaison : '+(dcOpen()?'directe par le Wi-Fi ✓':'via ntfy.sh et Nostr'+(rtc.st&&rtc.st!='active'?' (liaison directe : '+rtc.st+')':''));
};
const refreshNet=()=>{if(ENGINE?scr=='wait':scr=='conn')render();const e=document.getElementById('lnk');if(e)e.textContent=lnkTxt()};
let H=()=>{};   /* handles a received message, whatever the channel */

/* --- Direct WebRTC link (no relay server: STUN is only used to learn one's own address) --- */
const RTC_OK=!!window.RTCPeerConnection&&!window.QT_NO_RTC;
const ICE=window.QT_ICE||[{urls:'stun:stun.l.google.com:19302'}];
const rtc={pc:null,dc:null,rid:'',st:RTC_OK?'':'non prise en charge'};
const dcOpen=()=>!!(rtc.dc&&rtc.dc.readyState=='open');
function rtcClose(){const pc=rtc.pc;rtc.pc=rtc.dc=null;try{pc&&pc.close()}catch(e){}}
/* Wait for address gathering to finish (2.5 s at most) to send everything in a single message. */
const gathered=pc=>new Promise(res=>{
  if(pc.iceGatheringState=='complete')return res();
  const t=setTimeout(res,window.QT_ICE_MS||2500);
  pc.addEventListener('icegatheringstatechange',()=>{if(pc.iceGatheringState=='complete'){clearTimeout(t);res()}});
});
function rtcPc(){
  rtcClose();const pc=new RTCPeerConnection({iceServers:ICE});rtc.pc=pc;rtc.st='connexion…';
  pc.onconnectionstatechange=()=>{if(rtc.pc===pc&&pc.connectionState=='failed'){rtc.st='impossible, relais Internet';refreshNet()}};
  return pc;
}
function rtcWire(pc,dc){
  rtc.dc=dc;
  dc.onopen=()=>{if(rtc.pc!==pc)return;rtc.st='active';drainToDc();onDc(true);refreshNet()};
  dc.onclose=()=>{if(rtc.pc!==pc)return;rtc.dc=null;rtc.st='coupée, relais Internet';onDc(false);refreshNet()};
  dc.onmessage=e=>{try{recv(JSON.parse(e.data))}catch(x){}};
}
async function rtcOffer(){   /* phone */
  const pc=rtcPc();rtc.rid=Math.random().toString(36).slice(2,10);
  rtcWire(pc,pc.createDataChannel('qt'));
  await pc.setLocalDescription(await pc.createOffer());await gathered(pc);
  return pc.localDescription.sdp;
}
/* Engine side: one link per phone, keyed by the phone's id (pid). seen = last message received from that phone. */
const peers=new Map();
const pOpen=p=>!!(p.dc&&p.dc.readyState=='open');
const openPeers=()=>[...peers.values()].filter(pOpen);
const recentPeers=()=>[...peers.values()].filter(p=>pOpen(p)||Date.now()-p.seen<90000);
/* Internet relays needed: no direct link open, or a phone active in the last 90 seconds without its own. */
const needRelay=()=>!openPeers().length||recentPeers().some(p=>!pOpen(p));
function peerSeen(pid){let p=peers.get(pid);if(!p){p={pc:null,dc:null,seen:0};peers.set(pid,p)}p.seen=Date.now();return p}
async function rtcAnswer(pid,sdp){   /* engine */
  const p=peerSeen(pid);try{p.pc&&p.pc.close()}catch(e){}
  const pc=new RTCPeerConnection({iceServers:ICE});p.pc=pc;p.dc=null;
  pc.ondatachannel=e=>{
    if(p.pc!==pc)return;const dc=e.channel;p.dc=dc;
    const up=()=>{if(p.dc===dc){onDc(true);refreshNet()}};
    dc.onopen=up;if(dc.readyState=='open')up();
    dc.onclose=()=>{if(p.dc!==dc)return;p.dc=null;p.seen=Date.now();refreshNet()};
    dc.onmessage=e=>{try{recv(JSON.parse(e.data))}catch(x){}};
  };
  await pc.setRemoteDescription({type:'offer',sdp});
  await pc.setLocalDescription(await pc.createAnswer());await gathered(pc);
  return pc.localDescription.sdp;
}
let onDc=()=>{};

/* --- Nostr relays, alongside ntfy.sh: each message goes out both ways and the first relay that accepts it is enough.
   If ntfy.sh is saturated (429) or down, the public Nostr relays take over, and vice versa. No account:
   each page signs its messages with a throwaway key (Schnorr signature, required on Nostr). Events are
   "ephemeral" (kind 20000 to 29999): relays forward them to subscribers without storing them. */
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');
const unhex=h=>Uint8Array.from(h.match(/../g),x=>parseInt(x,16));
const sha=async(...p)=>{const a=new Uint8Array(p.reduce((n,x)=>n+x.length,0));let o=0;p.forEach(x=>{a.set(x,o);o+=x.length});return new Uint8Array(await crypto.subtle.digest('SHA-256',a))};
const tagged=async(t,...p)=>{const h=await sha(new TextEncoder().encode(t));return sha(h,h,...p)};
/* secp256k1 curve in Jacobian coordinates (a single inversion per multiplication). Written without "123n" literals
   so that app.js stays parseable by old TV browsers: without BigInt or WebCrypto, Nostr is simply disabled. */
const EC=typeof BigInt=='function'&&window.crypto&&crypto.subtle&&window.WebSocket?(()=>{
  const I=BigInt,n0=I(0),n1=I(1),n2=I(2),n3=I(3),n4=I(4),n8=I(8);
  const FP=n2**I(256)-n2**I(32)-I(977),FN=I('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141');
  const GX=I('0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798'),GY=I('0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8');
  const big=b=>I('0x'+(hex(b)||'0')),b32=n=>unhex(n.toString(16).padStart(64,'0'));
  const md=(a,m=FP)=>{a%=m;return a<n0?a+m:a};
  const pw=(b,e)=>{let r=n1;b=md(b);while(e>n0){if(e&n1)r=r*b%FP;b=b*b%FP;e>>=n1}return r};
  const O=[n0,n1,n0];
  const dbl=([X,Y,Z])=>{if(Z==n0||Y==n0)return O;const YY=Y*Y%FP,S=n4*X*YY%FP,M=n3*X*X%FP,X3=md(M*M-n2*S);return[X3,md(M*(S-X3)-n8*YY*YY),n2*Y*Z%FP]};
  const addG=P=>{const[X,Y,Z]=P;if(Z==n0)return[GX,GY,n1];const ZZ=Z*Z%FP,H=md(GX*ZZ-X),R=md(GY*Z*ZZ-Y);
    if(H==n0)return R==n0?dbl(P):O;const HH=H*H%FP,HHH=H*HH%FP,V=X*HH%FP,X3=md(R*R-HHH-n2*V);return[X3,md(R*(V-X3)-Y*HHH),Z*H%FP]};
  const mulG=k=>{let P=O;for(let i=255;i>=0;i--){P=dbl(P);if((k>>I(i))&n1)P=addG(P)}const zi=pw(P[2],FP-n2),z2=zi*zi%FP;return[P[0]*z2%FP,P[1]*z2%FP*zi%FP]};
  let d=n0;while(d==n0||d>=FN)d=big(crypto.getRandomValues(new Uint8Array(32)));   /* throwaway key, specific to this page */
  const[x,y]=mulG(d);if(y&n1)d=FN-d;const px=b32(x);
  return{pub:hex(px),async sign(m){   /* BIP-340 Schnorr signature */
    const t=b32(d^big(await tagged('BIP0340/aux',crypto.getRandomValues(new Uint8Array(32)))));
    const k0=md(big(await tagged('BIP0340/nonce',t,px,m)),FN),[rx,ry]=mulG(k0),k=ry&n1?FN-k0:k0;
    const e=md(big(await tagged('BIP0340/challenge',b32(rx),px,m)),FN);
    return hex(b32(rx))+hex(b32(md(k+e*d,FN)));
  }};
})():null;
const NOSTR=!EC?[]:window.QT_NOSTR||['wss://relay.damus.io','wss://nos.lol','wss://relay.primal.net'];
const NKIND=21212,TOUT=T+(ENGINE?'s':'c'),TIN=T+(ENGINE?'c':'s');
async function nEvent(content){
  const created_at=Math.floor(Date.now()/1000),tags=[['t',TOUT]];
  const id=hex(await sha(new TextEncoder().encode(JSON.stringify([0,EC.pub,created_at,NKIND,tags,content]))));
  return{id,pubkey:EC.pub,created_at,kind:NKIND,tags,content,sig:await EC.sign(unhex(id))};
}
const nr=NOSTR.map(url=>({url,ws:null,ok:false,delay:0,wait:new Map()}));
const nLive=()=>nr.filter(r=>r.ok).length;
let nHook=()=>{};   /* called when a relay opens or closes */
function nOpen(r){
  let ws;try{ws=new WebSocket(r.url)}catch(e){return}
  r.ws=ws;
  ws.onopen=()=>{r.ok=true;r.delay=0;ws.send(JSON.stringify(['REQ','qt',{kinds:[NKIND],'#t':[TIN],limit:0}]));nHook(true);refreshNet()};
  ws.onmessage=e=>{let d;try{d=JSON.parse(e.data)}catch(x){return}
    if(d[0]=='EVENT'&&d[2]&&d[2].pubkey!=EC.pub&&(d[2].tags||[]).some(t=>t[0]=='t'&&t[1]==TIN)){try{recv(JSON.parse(d[2].content))}catch(x){}}
    else if(d[0]=='OK'){const cb=r.wait.get(d[1]);if(cb){r.wait.delete(d[1]);cb(d[2]===true)}}};
  ws.onclose=()=>{if(r.ws!==ws)return;const was=r.ok;r.ok=false;r.ws=null;r.wait.forEach(cb=>cb(false));r.wait.clear();
    r.delay=Math.min(60000,r.delay?r.delay*2:5000);setTimeout(()=>nOpen(r),r.delay);if(was)nHook(false);refreshNet()};
}
const nStart=()=>nr.forEach(nOpen);
/* Publishes to all open relays; true as soon as one relay confirms ("OK"), false if none accepts within 8 s. */
function nPub(content){
  const live=nr.filter(r=>r.ok);
  if(!live.length)return Promise.resolve(false);
  return nEvent(content).then(ev=>new Promise(res=>{
    let left=live.length,end=false;
    const fin=ok=>{if(end)return;if(ok||--left==0){end=true;res(ok)}};
    live.forEach(r=>{r.wait.set(ev.id,fin);try{r.ws.send(JSON.stringify(['EVENT',ev]))}catch(e){r.wait.delete(ev.id);fin(false)}});
    setTimeout(()=>{live.forEach(r=>r.wait.delete(ev.id));if(!end){end=true;res(false)}},8000);
  }),()=>false);
}
/* The same message can arrive through ntfy.sh, Nostr and the direct link: it is only handled once,
   and a TV state older than the last one received is ignored. */
const seenM=new Set();let lastN=0,sendN=0;
function recv(m){
  if(m._i){if(seenM.has(m._i))return;seenM.add(m._i);if(seenM.size>300)seenM.delete(seenM.values().next().value)}
  if(m.k=='s'&&m._n){if(m._n<lastN)return;lastN=m._n}
  net.got++;H(m);
}

/* --- Sending. Direct link if it is open, otherwise the ntfy.sh send queue: one message at a time, in order.
   On failure (429, network, server), the same message is resent with an increasing delay (5 s, 10 s… 60 s).
   Only the latest TV state matters: a new state replaces the one still waiting. Only one "hello" pending. */
const SEND_MS=window.QT_SEND_MS||5000,MAX_B=3900;   /* ntfy.sh turns a message over 4 KB into an attachment */
const outQ=[];let sending=false,sendT=0,sendDelay=0,lastHello=0;
const queued=i=>!(sending&&i==0);   /* false for the message currently being sent */
function say(m,relay){
  if(m.t=='hello')lastHello=Date.now();
  if(!ENGINE)m.pid=PID;   /* this way the engine knows which phone the message comes from */
  m._i=Math.random().toString(36).slice(2,10);m._n=sendN=Math.max(Date.now(),sendN+1);   /* message id and order (see recv) */
  if(ENGINE&&!relay){
    /* Engine: the state goes out through each open direct link, and also through the relays if a phone has none. */
    const js=JSON.stringify(m),op=openPeers();op.forEach(p=>{try{p.dc.send(js)}catch(e){}});
    if(op.length&&!needRelay()){net.ok++;return}
  }
  else if(!relay&&dcOpen()){try{rtc.dc.send(JSON.stringify(m));net.ok++;return}catch(e){}}
  const n=outQ.length,last=outQ[n-1];
  /* Two WebRTC answers meant for two different phones do not replace each other. */
  if(m.k=='s'&&last&&last.m.k=='s'&&queued(n-1)&&!(m.a&&last.m.a)){if(last.m.a&&!m.a){m.a=last.m.a;m.rid=last.m.rid;relay=true}outQ[n-1]={m,relay}}
  else if(m.t=='hello'){const i=outQ.findIndex((x,i)=>x.m.t=='hello'&&queued(i));if(i>=0)outQ[i]={m,relay};else outQ.push({m,relay})}
  else outQ.push({m,relay});
  if(!sending&&!sendT)flush();
}
/* The direct link just opened: whatever was waiting goes through it (except WebRTC offer/answer, now useless). */
function drainToDc(){
  const keep=[];
  outQ.forEach((x,i)=>{if(!queued(i))keep.push(x);else if(!x.m.o&&!x.m.a)try{rtc.dc.send(JSON.stringify(x.m))}catch(e){}});
  outQ.splice(0,outQ.length,...keep);
  if(!outQ.length&&sendT){clearTimeout(sendT);sendT=0;sendDelay=0}
}
function retryNow(){if(sendT){clearTimeout(sendT);sendT=0;sendDelay=0;flush()}}
const bytes=s=>new TextEncoder().encode(s).length;
function body(m){
  let b=JSON.stringify(m);
  if(bytes(b)>MAX_B&&m.g){m={...m};delete m.g;b=JSON.stringify(m)}
  if(bytes(b)>MAX_B&&m.a){m={...m};delete m.a;delete m.rid;b=JSON.stringify(m)}   /* too bad for the direct link */
  return b;
}
function flush(){
  sendT=0;if(sending||!outQ.length)return;
  sending=true;const m=outQ[0].m;
  const done=(ok,fail,why)=>{
    sending=false;
    if(ok||fail=='drop'){outQ.shift();sendDelay=0;if(ok){net.fail='';net.why='';net.ok++}flush()}
    else{net.fail=fail;net.why=why||'';sendDelay=Math.min(60000,sendDelay?sendDelay*2:SEND_MS);sendT=setTimeout(flush,sendDelay)}
    refreshNet();
  };
  /* ntfy.sh and Nostr in parallel: the message counts as sent as soon as either accepts it, and is resent if both fail. */
  let end=false,nf=null,ns=null;
  const settle=()=>{
    if(end)return;
    if((nf&&nf.ok)||ns){end=true;return done(true)}
    if(nf&&ns===false){end=true;if(nf.fail=='drop'){net.fail=nf.code;net.why=nf.why}done(false,nf.fail,nf.why)}
  };
  nPub(JSON.stringify(m)).then(ok=>{ns=ok;settle()});
  const ko=(fail,why,code)=>{nf={fail,why,code};net.ntfy=fail=='429'?'saturé (429)':code||fail;settle()};
  fetch(OUT,{method:'POST',body:body(m)}).then(r=>{
    if(r.ok){nf={ok:true};net.ntfy='OK';return settle()}
    /* The service returns a JSON {"error":"…"} that details the limit reached. */
    r.text().then(t=>{let w='';try{w=JSON.parse(t).error||''}catch(e){}
      /* 4xx other than 429 (message rejected): no point retrying. */
      if(r.status>=400&&r.status<500&&r.status!=429)return ko('drop',w,'HTTP '+r.status);
      ko(r.status==429?'429':'HTTP '+r.status,w);
    },()=>ko(r.status==429?'429':'HTTP '+r.status));
  }).catch(()=>ko('réseau'));
}
/* Listening for ntfy.sh messages. Reconnects with an increasing delay (5 s, 10 s… 60 s) so as not to saturate the service, resuming after the last message received.
   On the phone (fallback), if the real-time link is closed or the TV does not answer, a backup read of the latest messages takes over. */
const POLL_MS=window.QT_POLL_MS||10000,POLL_FIRST=window.QT_POLL_FIRST||4000,HELLO_MS=window.QT_HELLO_MS||30000;
let pollNow=()=>{};
function listen(onState,fallback){
  let es=null,delay=0,lastId='',lastTime=0,isOpen=false;const seen=new Set();
  const handle=txt=>{try{
    const d=JSON.parse(txt);
    if(d.event&&d.event!='message')return;
    if(d.id){if(seen.has(d.id))return;seen.add(d.id);if(seen.size>100)seen.delete(seen.values().next().value);lastId=d.id}
    if(d.time){if(lastTime&&d.time<lastTime-1)return;lastTime=Math.max(lastTime,d.time)}   /* ignore a possible replay of old messages */
    recv(JSON.parse(d.message));
  }catch(x){}};
  const open=()=>{
    es=new EventSource(IN+'/sse'+(lastId?'?since='+encodeURIComponent(lastId):''));
    es.onopen=()=>{delay=0;isOpen=true;net.sse='ouverte';onState(true)};
    es.onerror=()=>{isOpen=false;net.sse='fermée';onState(false);try{es.close()}catch(e){}delay=Math.min(60000,delay?delay*2:5000);setTimeout(open,delay)};
    es.onmessage=e=>handle(e.data);
  };
  open();
  if(fallback){
    /* Backup read every 10 s, spaced out up to 60 s if the service answers 429. Until the TV has answered,
       a "hello" is resent every 30 s: a lost answer no longer blocks the connection. */
    let pollT=0,pollDelay=POLL_MS,busy=false;
    const poll=()=>{
      clearTimeout(pollT);pollT=setTimeout(poll,pollDelay);
      if(busy||dcOpen()||((isOpen||nLive())&&scr!='conn'))return;   /* all good */
      if(scr=='conn'&&Date.now()-lastHello>=HELLO_MS)hello();
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
/* State sent by the TV. extra = WebRTC answer: this message necessarily goes through the Internet relays (ntfy.sh and Nostr). */
const push=(ask,extra)=>{const m={k:'s',scr,s:pub(),ask:ask===true,g:scr=='cfgd'?gsum().slice(0,6):undefined,lb:lobby,hn:hostN,fm:TV?tvFm:undefined};if(extra)say(Object.assign(m,extra),true);else say(m)};
function tvInit(){
  joinUrl=location.href.split('#')[0].split('?')[0]+'?join='+T;
  H=m=>{
    conn=true;if(m.t=='hello'&&!S&&!HOSTL)scr='cfgd';
    if(m.pid)peerSeen(m.pid);
    /* Direct link offer from the phone: the engine answers and attaches its state (a single ntfy.sh message). */
    if(m.t=='hello'&&m.o&&RTC_OK)rtcAnswer(m.pid||'?',m.o).then(a=>{saveS();push(false,{a,rid:m.rid});render()},()=>onCmd(m));
    else onCmd(m);
  };
  /* A direct link just opened: if no phone needs the relays any more, whatever was waiting there is dropped. */
  onDc=()=>{if(!needRelay()){outQ.splice(sending?1:0);if(sendT){clearTimeout(sendT);sendT=0;sendDelay=0}}push()};
  let sse=false;nHook=()=>{tvOk=sse||nLive()>0;render()};nStart();
  listen(ok=>{sse=ok;tvOk=ok||nLive()>0;render()});
  if(S)push(true);
}
/* Phone: "hello" asks for the TV state. Without an open direct link, it carries a new WebRTC offer. */
let offering=false;
function hello(){
  if(dcOpen()||!RTC_OK)return say({t:'hello'});
  if(offering)return;offering=true;lastHello=Date.now();
  rtcOffer().then(o=>say({t:'hello',o,rid:rtc.rid},true),()=>{rtc.st='impossible, relais Internet';say({t:'hello'})}).finally(()=>{offering=false});
}
let tvFmSeen=null;
function ctlInit(){
  H=d=>{
    if(d.k=='s'){
      cOk=true;scr=d.scr;st=d.s;recvAt=Date.now();if(d.g)gl=d.g;lb=d.lb||[];lbHn=d.hn||'';
      if(d.fm!=null&&d.fm!==tvFmSeen){tvFmSeen=d.fm;cfg.free=d.fm;saveCfg()}   /* mode chosen on the TV before the QR code */
      if(d.a&&d.rid==rtc.rid&&rtc.pc&&rtc.pc.signalingState=='have-local-offer')rtc.pc.setRemoteDescription({type:'answer',sdp:d.a}).catch(()=>{rtc.st='impossible, relais Internet'});
      if(d.ask)hello();
    }
    render();
  };
  onDc=open=>{if(open)say({t:'hello'});else setTimeout(()=>{if(!dcOpen())hello()},1500)};
  let sse=false;nHook=up=>{pOk=sse||nLive()>0;if(up&&nLive()==1)hello();render()};nStart();
  listen(ok=>{sse=ok;pOk=ok||nLive()>0;if(ok)hello();render()},true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)hello()});
}
