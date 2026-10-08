const CACHE_NAME = 'cropper-static-v20-creative-tools';
// Only the small portal shell is downloaded during installation.
const APP_SHELL = ['./','./index.html','./home.css?v=2','./styles.css','./home.js?v=2','./tool-switcher.js','./navigation.css?v=2','./manifest.webmanifest','./assets/icon.svg','./vendor/lucide.min.js'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('cropper-static-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  const editable=event.request.mode==='navigate'||/\.(html|css|js)$/.test(url.pathname);
  const cacheable=editable||/\.(woff2|wasm|gz|png|jpg|webp|svg|json)$/.test(url.pathname);
  if(!cacheable)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const cached=await cache.match(event.request);
    if(cached&&!editable)return cached;
    try{
      const response=await fetch(event.request);
      if(response.ok){event.waitUntil(cache.put(event.request,response.clone()).catch(()=>{}));}
      return response;
    }catch{
      return cached||Response.error();
    }
  })());
});
