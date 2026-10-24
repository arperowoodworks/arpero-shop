const C='arpero-shop-v13',F=['./','index.html','cal.js','manifest.json?v=2','icon-180.png?v=2','icon-512.png?v=2','logo.png?v=2','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(F)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;e.respondWith(caches.match(e.request,{ignoreSearch:new URL(e.request.url).pathname.endsWith('/')}).then(r=>r||fetch(e.request)))});
// Web Push payload {title, body, go:'p:<id>'|'cal', tag}
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data&&e.data.text()}}
 e.waitUntil(self.registration.showNotification(d.title||'Arpero Shop',{body:d.body||'',icon:'icon-512.png?v=2',badge:'icon-180.png?v=2',tag:d.tag||'shop',data:{go:d.go||'cal'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const go=(e.notification.data&&e.notification.data.go)||'cal',url=new URL('./?go='+encodeURIComponent(go),self.registration.scope).href;
 e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(cs=>{const c=cs.find(x=>x.url.startsWith(self.registration.scope));if(c){c.postMessage({go});return c.focus()}return self.clients.openWindow(url)}))});
