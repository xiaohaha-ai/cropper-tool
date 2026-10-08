import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {categories,colors,parts,getPart,partSizeLabel,searchParts,type Category,type PartDefinition} from './catalog';
import {createPart,exportablePart,type PartModel} from './parts';
import {getConnectors,unitSystem} from './connectors';
import css from './library.css?inline';
export function mountLibrary() {
const sheet=document.createElement('style');sheet.textContent=css;document.head.append(sheet);

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const state={category:'all' as Category|'all',query:'',selected:'brick-2x4',color:colors[0].hex,bottom:false,markers:false,rotate:false};
const categoryColors:Record<Category,string>={brick:colors[0].hex,plate:colors[5].hex,tile:colors[1].hex,slope:colors[3].hex,round:colors[1].hex,corner:colors[4].hex,technic:colors[6].hex,beam:colors[6].hex,axle:colors[7].hex,pin:colors[2].hex,gear:colors[5].hex,wheel:colors[0].hex,baseplate:colors[3].hex};
const counts=new Map(categories.map(c=>[c.id,parts.filter(p=>p.category===c.id).length]));
const status=el('status');
el('total-badge').textContent=`${categories.length} 类 · ${parts.length} 种规格`;
const nav=el('categories');
for(const category of [{id:'all',name:'全部零件'},...categories]) {
  const button=document.createElement('button');button.className='category-button';button.dataset.category=category.id;
  const name=document.createElement('span');name.textContent=category.name;
  const count=document.createElement('span');count.className='count';count.textContent=String(category.id==='all'?parts.length:counts.get(category.id as Category));
  button.append(name,count);button.onclick=()=>{state.category=category.id as Category|'all';renderCards();};nav.append(button);
}
const palette=el('palette');
for(const color of colors){const button=document.createElement('button');button.className='swatch';button.style.setProperty('--swatch',color.hex);button.setAttribute('aria-label',color.name);button.title=color.name;button.dataset.color=color.hex;button.onclick=()=>{state.color=color.hex;active?.material.color.set(color.hex);syncPalette();};palette.append(button);}
function syncPalette(){palette.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===state.color)));}
function saveBlob(blob:Blob,name:string){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),30000);}
el('manifest').onclick=()=>saveBlob(new Blob([JSON.stringify({schemaVersion:1,unitSystem,total:parts.length,categories,parts:parts.map(part=>({...part,connectors:getConnectors(part),file:`parts/${part.id}.glb`}))},null,2)],{type:'application/json'}),'parts-catalog.json');
el<HTMLInputElement>('search').addEventListener('input',event=>{state.query=(event.target as HTMLInputElement).value;renderCards();});
el('clear-search').onclick=()=>{state.query='';state.category='all';el<HTMLInputElement>('search').value='';renderCards();};
window.addEventListener('keydown',event=>{if(event.key==='/'&&!(event.target instanceof HTMLInputElement)){event.preventDefault();el('search').focus();}});

let active:PartModel|undefined;
let selectPart:(id:string)=>void=()=>{};
let observeThumb:(card:HTMLElement,part:PartDefinition)=>void=()=>{};
let resetThumbObserver=()=>{};
const grid=el('parts-grid');
const featured=['brick-2x4','plate-2x4','tile-2x2','slope-2x3','round-2x2-brick','corner-2x2-brick','technic-1x4','beam-1x7','axle-1x4','pin-1x2-friction','gear-1x1-16t','wheel-1x1-d24','baseplate-16x16'];
function renderCards(){
  resetThumbObserver();grid.replaceChildren();
  const shown=searchParts(state.query,state.category);
  if(state.category==='all'&&!state.query){const rank=(id:string)=>{const i=featured.indexOf(id);return i===-1?featured.length:i;};shown.sort((a,b)=>rank(a.id)-rank(b.id));}
  el('category-title').textContent=state.category==='all'?'全部零件':categories.find(c=>c.id===state.category)!.name;
  el('result-count').textContent=`${shown.length} 个零件`;
  nav.querySelectorAll<HTMLButtonElement>('button').forEach(b=>{const selected=b.dataset.category===state.category;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
  el('empty').hidden=shown.length!==0;
  for(const part of shown){
    const item=document.createElement('div');item.setAttribute('role','listitem');
    const button=document.createElement('button');button.className='part-card';button.dataset.part=part.id;button.style.width='100%';button.classList.toggle('selected',part.id===state.selected);button.setAttribute('aria-pressed',String(part.id===state.selected));button.setAttribute('aria-label',`预览 ${part.name}`);
    const thumb=document.createElement('div');thumb.className='thumb';thumb.innerHTML='<span class="thumb-placeholder" aria-hidden="true">· · ·</span>';
    const info=document.createElement('div');info.className='card-info';const title=document.createElement('strong');title.textContent=part.name;const subtitle=document.createElement('small');subtitle.textContent=`${partSizeLabel(part)} / ${part.kind.toUpperCase()}`;info.append(title,subtitle);button.append(thumb,info);
    button.onclick=()=>selectPart(part.id);item.append(button);grid.append(item);observeThumb(button,part);
  }
}
function updateDetails(part:PartDefinition,bounds:THREE.Box3){
  const category=categories.find(c=>c.id===part.category)!;
  el('part-name').textContent=part.name;el('part-id').textContent=part.id.toUpperCase();el('part-category').textContent=category.name;
  const size=bounds.getSize(new THREE.Vector3());el('part-dimensions').textContent=`${size.x.toFixed(1)} × ${size.z.toFixed(1)} × ${size.y.toFixed(1)} mm`;
  const connectors=getConnectors(part),studs=connectors.filter(c=>c.type==='stud').length,sockets=connectors.filter(c=>c.type==='socket').length;
  el('part-connections').textContent=[studs?`${studs} 凸点`:'',sockets?`${sockets} 底部接口`:'',connectors.length-studs-sockets?`${connectors.length-studs-sockets} 机械接口`:''].filter(Boolean).join(' · ');
  el('part-purpose').textContent=category.description;
  el('part-note').textContent=part.kind==='gear'?'齿形为视觉简化结构，适合机械布局；尚未进行齿轮啮合与动力学验证。':'已准备几何与连接点数据。返回拼搭工作台，即可放置、编辑并保存作品。';
}
try {
  const host=el('scene'),renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=0.92;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','可旋转的三维零件');
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,0.1,3000);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,0.03);room.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=0.65;
  scene.add(new THREE.HemisphereLight(0xffffff,0xb6b9a5,0.7));
  const key=new THREE.DirectionalLight(0xfff5e6,2.5);key.position.set(-60,110,75);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.normalBias=0.06;key.shadow.bias=-0.0001;scene.add(key);
  const fill=new THREE.DirectionalLight(0xe2edff,0.9);fill.position.set(40,20,-60);scene.add(fill);
  const under=new THREE.DirectionalLight(0xffffff,0.85);under.position.set(0,-40,20);scene.add(under);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.ShadowMaterial({opacity:0.12}));floor.rotation.x=-Math.PI/2;floor.position.y=-0.06;floor.receiveShadow=true;scene.add(floor);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.autoRotateSpeed=0.9;controls.minPolarAngle=0.07;controls.maxPolarAngle=Math.PI-0.07;
  const connectorGroup=new THREE.Group();scene.add(connectorGroup);
  let bounds=new THREE.Box3(),distance=60,lastTime=0;
  function disposeMarkers(){connectorGroup.children.forEach(obj=>{const mesh=obj as THREE.Mesh;mesh.geometry.dispose();(mesh.material as THREE.Material).dispose();});connectorGroup.clear();}
  function addMarkers(part:PartDefinition){
    disposeMarkers();const connectors=getConnectors(part);
    const types=['stud','socket','mechanical'] as const;
    types.forEach((type,index)=>{
      const subset=connectors.filter(c=>type==='mechanical'?!['stud','socket'].includes(c.type):c.type===type);if(!subset.length)return;
      const mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(0.7,10,8),new THREE.MeshBasicMaterial({color:[0xe68b39,0x448fcc,0x9e72cc][index],depthTest:false,transparent:true,opacity:0.92}),subset.length);
      mesh.renderOrder=5;subset.forEach((c,i)=>{const pos=new THREE.Vector3(...c.position).addScaledVector(new THREE.Vector3(...c.normal),0.2);mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(pos.x,pos.y,pos.z));});mesh.instanceMatrix.needsUpdate=true;connectorGroup.add(mesh);
    });connectorGroup.visible=state.markers;
  }
  function frame(){
    if(!active)return;
    const centre=bounds.getCenter(new THREE.Vector3()),radius=bounds.getBoundingSphere(new THREE.Sphere()).radius;
    const halfVertical=THREE.MathUtils.degToRad(camera.fov/2),halfHorizontal=Math.atan(Math.tan(halfVertical)*camera.aspect);
    distance=radius/Math.sin(Math.min(halfVertical,halfHorizontal))*1.1;
    controls.minDistance=Math.max(8,distance*0.48);controls.maxDistance=distance*2.5;
    controls.target.copy(centre);camera.position.copy(new THREE.Vector3(0.95,state.bottom?-0.8:0.75,1.3).normalize().multiplyScalar(distance).add(centre));controls.update();
    const extent=Math.max(radius*2,25);key.position.set(-extent,extent*1.8,extent*1.2);key.target.position.copy(centre);scene.add(key.target);key.shadow.camera.left=-extent;key.shadow.camera.right=extent;key.shadow.camera.top=extent;key.shadow.camera.bottom=-extent;key.shadow.camera.far=extent*6;key.shadow.camera.updateProjectionMatrix();
  }
  function syncView(){el('bottom').setAttribute('aria-pressed',String(state.bottom));el('bottom').textContent=state.bottom?'查看顶部':'查看底部';el('rotate').setAttribute('aria-pressed',String(state.rotate));el('rotate').textContent=state.rotate?'停止旋转':'自动旋转';}
  selectPart=(id:string)=>{
    const definition=getPart(id);const next=createPart(definition,categoryColors[definition.category]);
    if(active){scene.remove(active.group);active.dispose();}active=next;scene.add(active.group);state.selected=id;state.color=categoryColors[definition.category];state.bottom=false;state.rotate=false;controls.autoRotate=false;
    bounds=new THREE.Box3().setFromObject(active.group);updateDetails(definition,bounds);addMarkers(definition);syncPalette();syncView();frame();
    grid.querySelectorAll<HTMLButtonElement>('.part-card').forEach(card=>{const selected=card.dataset.part===id;card.classList.toggle('selected',selected);card.setAttribute('aria-pressed',String(selected));});
    status.textContent='模型已就绪 · 可旋转检查或下载';
  };
  const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();frame();});resize.observe(host);
  el('bottom').onclick=()=>{state.bottom=!state.bottom;syncView();frame();};
  el('rotate').onclick=()=>{state.rotate=!state.rotate;controls.autoRotate=state.rotate;syncView();};
  el('reset').onclick=()=>{state.bottom=false;state.rotate=false;controls.autoRotate=false;syncView();frame();};
  el('connections').onclick=()=>{state.markers=!state.markers;connectorGroup.visible=state.markers;el('connections').setAttribute('aria-pressed',String(state.markers));el('legend').hidden=!state.markers;};
  controls.addEventListener('start',()=>{state.rotate=false;controls.autoRotate=false;syncView();});
  el<HTMLButtonElement>('download').onclick=async()=>{
    if(!active)return;const button=el<HTMLButtonElement>('download');button.disabled=true;const name=active.definition.id;status.textContent='正在导出零件…';
    try{const data=await new GLTFExporter().parseAsync(exportablePart(active.group),{binary:true});if(!(data instanceof ArrayBuffer))throw new Error('Invalid GLB');saveBlob(new Blob([data],{type:'model/gltf-binary'}),`${name}.glb`);status.textContent='已导出 · 包含当前颜色与连接点数据';}catch(error){console.error(error);status.textContent='导出失败，请重试';}finally{button.disabled=false;}
  };
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.setAnimationLoop(null);status.textContent='图形连接已中断，请刷新页面';});
  renderer.setAnimationLoop(time=>{const delta=Math.min((time-lastTime)/1000,0.1);lastTime=time;controls.update(delta);floor.visible=camera.position.y>0;renderer.render(scene,camera);});

  // One shared offscreen renderer. Thumbnails are generated only as cards enter view.
  const thumbRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});thumbRenderer.setSize(280,200);thumbRenderer.setPixelRatio(1);thumbRenderer.setClearColor(0x000000,0);thumbRenderer.toneMapping=THREE.ACESFilmicToneMapping;thumbRenderer.toneMappingExposure=0.95;
  const thumbScene=new THREE.Scene();thumbScene.add(new THREE.HemisphereLight(0xffffff,0xa4aa96,1.8));const thumbKey=new THREE.DirectionalLight(0xffffff,3);thumbKey.position.set(-25,45,30);thumbScene.add(thumbKey);const thumbFill=new THREE.DirectionalLight(0xe6edff,1);thumbFill.position.set(30,15,-20);thumbScene.add(thumbFill);
  const thumbCamera=new THREE.PerspectiveCamera(32,1.4,0.1,3000),cache=new Map<string,string>();
  let queue:{card:HTMLElement;part:PartDefinition}[]=[],queuedFrame=0,closed=false;
  function setThumb(card:HTMLElement,data:string){const img=document.createElement('img');img.src=data;img.alt='';img.width=280;img.height=200;card.querySelector('.thumb')!.replaceChildren(img);}
  function makeThumbnail(){
    queuedFrame=0;if(closed)return;let task=queue.shift();while(task&&!task.card.isConnected)task=queue.shift();if(!task)return;
    const model=createPart(task.part,categoryColors[task.part.category]);
    try{
      thumbScene.add(model.group);const b=new THREE.Box3().setFromObject(model.group),centre=b.getCenter(new THREE.Vector3()),r=b.getBoundingSphere(new THREE.Sphere()).radius;
      thumbCamera.position.copy(new THREE.Vector3(0.9,0.95,1.4).normalize().multiplyScalar(r/Math.sin(THREE.MathUtils.degToRad(16))*1.05).add(centre));thumbCamera.lookAt(centre);thumbRenderer.render(thumbScene,thumbCamera);
      const data=thumbRenderer.domElement.toDataURL('image/png');cache.set(task.part.id,data);if(task.card.isConnected)setThumb(task.card,data);
    }catch(error){console.error(error);task.card.querySelector('.thumb')!.textContent='预览暂不可用';}finally{thumbScene.remove(model.group);model.dispose();}
    if(queue.length)queuedFrame=requestAnimationFrame(makeThumbnail);
  }
  const thumbnailObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const card=entry.target as HTMLElement;thumbnailObserver.unobserve(card);queue.push({card,part:getPart(card.dataset.part!)});}if(queue.length&&!queuedFrame)queuedFrame=requestAnimationFrame(makeThumbnail);},{root:document.querySelector('.catalogue'),rootMargin:'160px'});
  observeThumb=(card,part)=>{const data=cache.get(part.id);if(data)setThumb(card,data);else thumbnailObserver.observe(card);};resetThumbObserver=()=>{thumbnailObserver.disconnect();queue=[];};
  renderCards();selectPart(state.selected);
  window.addEventListener('pagehide',event=>{if(event.persisted)return;closed=true;cancelAnimationFrame(queuedFrame);thumbnailObserver.disconnect();resize.disconnect();renderer.setAnimationLoop(null);controls.dispose();active?.dispose();disposeMarkers();environment.dispose();floor.geometry.dispose();(floor.material as THREE.Material).dispose();renderer.dispose();thumbRenderer.dispose();},{once:true});
}catch(error){console.error(error);renderCards();status.textContent='三维预览无法启动，请使用支持 WebGL 2 的浏览器并开启硬件加速。';document.querySelectorAll<HTMLButtonElement>('.inspector button').forEach(button=>button.disabled=true);}

}
