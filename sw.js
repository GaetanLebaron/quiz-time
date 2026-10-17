/* Service worker de Quiz Time : permet l'installation (PWA) et un démarrage rapide.
   Stratégie « réseau d'abord » : les mises à jour du site sont prises en compte tout de suite,
   et les fichiers en cache ne servent que si le réseau est indisponible. */
const CACHE='quiz-time-v67';
const SHELL=['./','index.html','css/style.css','js/base.js','js/moteur.js','js/sons.js','js/liaison.js','js/libre.js','js/app.js','js/qrcode.js','donnees/questions.json','manifest.webmanifest','images/icon-192.png','images/icon-512.png','images/favicon.png','sons/bonne-reponse.mp3','sons/mauvaise-reponse.mp3','sons/roulement.mp3','sons/fanfare.mp3','polices/lilita-one.woff2','polices/nunito.woff2'];

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
