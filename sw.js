/* Fabled Foes offline copy (28/11/2026). Registered by the game only after the player chose "Play offline".
   - The page (index.html, rulebook.html) is network-first, so an online visit always gets the newest rules and refreshes the saved copy; the saved copy is used only when the network fails (or is very slow).
   - Everything else on this site (card art, music, rule book pictures, icons) is cache-first from the one cache below, which the page fills (offline-files.json lists every file with a hash; only changed files re-download).
   - version.json and offline-files.json are never answered from the cache. Google Fonts and PeerJS are kept as they go by so the page looks right offline. */
const CACHE='ff-offline-1';
const SCOPE=self.registration.scope;
const FONTS=/^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com|unpkg\.com)\//;
const bare=u=>{const x=new URL(u);x.search='';x.hash='';return x.href;};
const pageKey=u=>{const x=new URL(u);x.search='';x.hash='';if(x.pathname.endsWith('/'))x.pathname+='index.html';return x.href;};

self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});

self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(FONTS.test(r.url)){e.respondWith(stale(r));return;}
  if(u.origin!==location.origin||!r.url.startsWith(SCOPE))return;
  if(/\/(version|offline-files)\.json$/.test(u.pathname))return;
  if(r.mode==='navigate'||/\.html$/.test(u.pathname)||u.pathname.endsWith('/')){e.respondWith(page(r,u));return;}
  e.respondWith(asset(r));
});

async function page(r,u){
  const c=await caches.open(CACHE),key=pageKey(r.url);
  const fresh=u.searchParams.has('v');   // the game's own update reload: always wait for the network
  try{
    const res=await Promise.race([fetch(r),new Promise((_,no)=>{if(!fresh)setTimeout(no,15000,new Error('slow'));})]);
    if(res&&res.ok&&res.status===200){try{await c.put(key,res.clone());}catch(_){}}
    return res;
  }catch(err){
    const hit=await c.match(key);if(hit)return hit;
    // slow network but nothing saved: keep waiting for the real answer
    return fetch(r);
  }
}
async function asset(r){
  const c=await caches.open(CACHE),key=bare(r.url);
  const hit=await c.match(key);
  if(hit){
    const m=/^bytes=(\d*)-(\d*)$/.exec(r.headers.get('range')||'');
    if(!m)return hit;
    // music is streamed with Range requests: answer them from the saved copy so seeking works offline
    const b=await hit.blob(),n=b.size;let s=m[1]?+m[1]:0,t=m[2]?Math.min(+m[2],n-1):n-1;if(!m[1]&&m[2]){s=Math.max(0,n-+m[2]);t=n-1;}
    if(s>=n)return new Response('',{status:416,headers:{'Content-Range':'bytes */'+n}});
    return new Response(b.slice(s,t+1),{status:206,headers:{'Content-Type':hit.headers.get('Content-Type')||'audio/mpeg','Content-Range':'bytes '+s+'-'+t+'/'+n,'Content-Length':String(t+1-s)}});
  }
  const res=await fetch(r);
  if(res&&res.ok&&res.status===200&&res.type==='basic'){try{await c.put(key,res.clone());}catch(_){}}
  return res;
}
async function stale(r){
  const c=await caches.open(CACHE),hit=await c.match(r);
  const net=fetch(r).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(r,res.clone()).catch(()=>{});return res;}).catch(()=>null);
  return hit||(await net)||new Response('',{status:504});
}
