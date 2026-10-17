/* Quiz Time service worker: enables installation (PWA) and a fast startup.
   "Network first" strategy: site updates are picked up immediately,
   and cached files are only used when the network is unavailable. */
const CACHE='quiz-time-v74';
const SHELL=['./','index.html','css/style.css','js/base.js','js/engine.js','js/sounds.js','js/transport.js','js/freeplay.js','js/app.js','js/qrcode.js','data/questions.json','manifest.webmanifest','images/icon-192.png','images/icon-512.png','images/favicon.png','sounds/correct-answer.mp3','sounds/wrong-answer.mp3','sounds/drumroll.mp3','sounds/fanfare.mp3','sounds/countdown.mp3','sounds/whoosh.mp3','fonts/lilita-one.woff2','fonts/nunito.woff2'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin)return;   /* ntfy.sh and everything else bypass the cache */
  e.respondWith(
    fetch(r.url,{cache:'no-cache'}).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}
      return res;
    }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html')))
  );
});
