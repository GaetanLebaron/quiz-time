/* Service worker de Quiz Time : permet l'installation (PWA) et un démarrage rapide.
   Stratégie « réseau d'abord » : les mises à jour du site sont prises en compte tout de suite,
   et les fichiers en cache ne servent que si le réseau est indisponible. */
const CACHE='quiz-time-v15';
const SHELL=['./','index.html','style.css','app.js','questions.json','qrcode.js','manifest.webmanifest','icon-192.png','icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==self.location.origin)return;   /* ntfy.sh et le reste ne passent pas par le cache */
  e.respondWith(
    fetch(r.url,{cache:'no-cache'}).then(res=>{
      if(res.ok){const copy=res.clone();caches.open(CACHE).then(c=>c.put(r,copy))}
      return res;
    }).catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('index.html')))
  );
});
