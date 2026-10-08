import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {exportProject} from './project-export';
import {categories,colors,parts,getPart,searchParts,partSizeLabel,type Category} from './catalog';
import {createPart,type PartModel} from './parts';
import {History,clone,newProject,makePiece,parseProject,starter,gridPosition,snapToTop,collision,bodyBounds,clean,MAX_PIECES,worldConnectors,axleCompatible,snapToAxle,wheelStarter,type Piece,type Triple,type Project} from './assembly';
import {getConnectors} from './connectors';
import {installShortcuts} from './shortcut-settings';
import type {ShortcutAction} from './shortcuts';
import {buildModels,getBuildModel,newGuidedProject,assertGuidedProject,buildProgress,availableSlots,fillSlot,modelSupplies,supplyKey} from './build-models';
import {BuildTargets} from './build-targets';
import css from './editor.css?inline';
export function mountEditor() {
const sheet=document.createElement('style');sheet.textContent=css;document.head.append(sheet);

document.body.innerHTML=`
<header class="topbar"><a class="logo" href="${location.pathname}" aria-label="积木工坊"><span class="logo-icon">▦</span><span>积木工坊<small>BRICK WORKSHOP</small></span></a><tool-switcher current="lego"></tool-switcher><div class="project-title"><input id="project-name" aria-label="作品名称" maxlength="80"><span id="save-state">本地自动保存</span></div><div class="file-actions"><a href="?view=library">零件图鉴 ↗</a><button id="choose-build-model" class="model-entry">▦ 选择模型拼搭</button><button id="open-project">导入作品</button><button id="save-project">导出备份 ↓</button><button id="export-model" class="primary">导出模型 ↗</button></div></header>
<div class="mobile-parts-bar"><button id="toggle-parts" aria-expanded="false" aria-controls="mobile-part-library">挑选积木</button><button id="mobile-next">选下一块</button><button id="mobile-fill">放入积木</button></div><main class="editor-layout"><aside class="part-library" id="mobile-part-library"><div class="panel-title"><strong>零件盒</strong><span id="library-total">137 PARTS</span></div><label class="search"><span>⌕</span><input id="part-search" type="search" placeholder="搜索零件 · 2x4 / 齿轮" aria-label="搜索零件"></label><select id="part-category" aria-label="零件分类"><option value="all">全部分类</option>${categories.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select><div class="library-caption"><span id="filter-count"></span><span id="library-instruction">点击零件，开始放置</span></div><div id="part-cards" class="part-cards" aria-label="可用零件"></div><div class="library-foot"><i></i> 8 mm 网格 · 3.2 mm 高度单位</div></aside>
<section class="stage" aria-label="三维拼搭区"><div class="stage-heading"><div><span class="eyebrow">MAKE ROOM FOR IMAGINATION</span><h1>一块一块，搭出想象。</h1></div><span class="stage-tag">自由拼搭 / 02</span></div><div id="build-scene"></div><div class="scene-toolbar" role="toolbar" aria-label="编辑工具"><button id="select-mode" class="active" title="选择模式（Esc）">↖ 选择</button><button id="move-piece" data-selection title="移动选中零件（M）">✥ 移动</button><span></span><button id="undo" title="撤销（⌘ Z）">↶ 撤销</button><button id="redo" title="重做（⌘ ⇧ Z）">↷ 重做</button><span></span><button id="fit-view" title="查看全部（F）">⛶ 全景</button></div><div id="mode-banner" class="mode-banner" hidden><span id="mode-text"></span><button id="cancel-place">取消 Esc</button></div><div class="scene-bottom"><div class="axis-key"><b class="x">X</b><b class="y">Y</b><b class="z">Z</b><span>毫米 / MM</span></div><button id="toggle-grid" aria-pressed="true">网格 开</button></div><div id="hint" class="stage-hint">点击选中 · 右键单击转向 · 右键拖动平移 · 滚轮缩放</div></section>
<aside class="properties"><section id="build-guide-panel" class="build-guide-panel" hidden aria-label="模型拼搭进度"><div class="guide-panel-heading"><span class="eyebrow">FOLLOW THE MODEL</span><button id="change-build-model">换模型 ↗</button></div><h2 id="build-model-name"></h2><div class="guide-count"><strong id="build-percent">0%</strong><span id="build-count"></span></div><progress id="build-progress" max="100" value="0" aria-label="模型完成进度"></progress><p id="build-step" role="status"></p><label class="guide-layer"><input id="build-layered" type="checkbox" checked>分层拼搭 · 优先填入当前层</label><div id="build-supply-label" class="guide-supply-label">从左侧选择所需零件</div><button id="build-hint">帮我选下一块</button><button id="build-fill" class="primary">填入一个高亮位置</button><button id="build-remove" disabled>拆下选中的积木</button><button id="build-restart">重新拼搭当前模型</button><button id="leave-build-guide" class="guide-back">← 返回自由拼搭</button></section><div id="properties-heading" class="panel-title"><strong>零件属性</strong><span id="selected-label">未选中</span></div><div id="selection-empty" class="selection-empty"><span>✦</span><h2>下一块，会是什么？</h2><p>从左侧零件盒挑选零件，<br>在工作台上点击放下。</p></div><div id="selection-panel" hidden><p class="eyebrow" id="selected-id"></p><h2 id="selected-name"></h2><div class="field-label">颜色</div><div id="editor-palette" class="editor-palette"></div><div class="field-label">位置 <span>mm · 世界坐标</span></div><div class="vector-inputs">${['X','Y','Z'].map((axis,i)=>`<label>${axis}<input id="position-${i}" type="number" step="${i===1?'3.2':'8'}" min="-5000" max="5000" aria-label="${axis} 坐标"></label>`).join('')}</div><div class="field-label">旋转 <span>每次 90°</span></div><div class="rotation-buttons">${['X','Y','Z'].map((a,i)=>`<button data-rotate="${i}" aria-label="绕 ${a} 轴旋转 90 度">${a} <span id="rotation-${i}">0°</span> ↻</button>`).join('')}</div><div class="edit-actions"><button id="duplicate" data-selection>⧉ 复制</button><button id="delete-piece" data-selection>⌫ 删除</button></div></div><div class="options"><label><input id="snap" type="checkbox" checked> 凸点与网格吸附</label><label><input id="overlap" type="checkbox"> 允许重叠 · 机械装配</label><p>车轮 / 齿轮可吸附十字轴，轴可穿入带孔砖。选零件后，把鼠标移到金色连接点；连接销仍需手动装配。</p></div><div class="scene-list-heading"><strong>作品零件</strong><span id="piece-count"></span></div><div id="scene-list" class="scene-list"></div><div class="project-actions"><button id="load-sample">彩虹门</button><button id="load-wheel-sample">轮轴示例</button><button id="new-project">新建空白</button></div></aside></main>
<footer class="statusbar"><span id="editor-status" role="status">正在准备工作台…</span><button id="shortcut-settings" title="快捷键设置（?）"><span id="shortcut-summary">快捷键</span> · 设置 ⚙</button></footer><input id="project-file" type="file" accept=".json,application/json" hidden><dialog id="build-model-dialog" class="build-model-dialog" aria-labelledby="build-dialog-title"><header><div><span class="eyebrow">CHOOSE YOUR NEXT BUILD</span><h2 id="build-dialog-title">挑一个模型，开始拼搭。</h2></div><button id="close-build-models" aria-label="关闭模型选择">✕</button></header><p>选择成品模型，在工作台上逐块填满透明轮廓。当前作品会为你保留。</p><div id="build-model-cards" class="build-model-cards"></div><footer>自动对齐位置与方向 · 按零件规格和颜色匹配 · 可撤销、保存与继续</footer></dialog>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const partsToggle=$<HTMLButtonElement>('toggle-parts');
function closeParts(){document.body.classList.remove('parts-open');partsToggle.setAttribute('aria-expanded','false');partsToggle.textContent='挑选积木';}
partsToggle.onclick=()=>{const open=document.body.classList.toggle('parts-open');partsToggle.setAttribute('aria-expanded',String(open));partsToggle.textContent=open?'收起零件':'挑选积木';};
$('part-cards').addEventListener('click',event=>{if((event.target as HTMLElement).closest('.part-tile'))closeParts();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeParts();});
$('mobile-next').onclick=()=>$('build-hint').click();
$('mobile-fill').onclick=()=>$('build-fill').click();
const storageKey='brick-workshop-project-v2';
let loadMessage='已载入彩虹门示例，试试搭上你的第一块。';
let initial=starter();
try{const saved=localStorage.getItem(storageKey);if(saved){initial=assertGuidedProject(parseProject(JSON.parse(saved)));loadMessage='已恢复上次作品。';}}catch{loadMessage='上次存档无法读取，已打开示例；原存档尚未覆盖，请及时另存作品。';}
const history=new History(initial);
const sessionKey='brick-workshop-build-sessions-v1';
let freeProject:Project|null=initial.guide?null:clone(initial),buildSessions:Record<string,Project>={},buildLayered=true;
try{const stored=JSON.parse(localStorage.getItem(sessionKey)||'null');if(stored?.version===1){
 if(initial.guide&&stored.free){const saved=parseProject(stored.free);if(!saved.guide)freeProject=saved;}
 for(const m of buildModels){try{const saved=assertGuidedProject(parseProject(stored.models?.[m.id]));if(saved.guide?.modelId===m.id)buildSessions[m.id]=saved;}catch{/* Ignore one invalid model session without affecting other work. */}}
 buildLayered=stored.layered!==false;
}}catch{/* Keep the current valid document usable if auxiliary storage is unavailable. */}
let buildSupply:string|null=null,lastBuildId:string|null=null,libraryGuided=false;

let selectedId:string|null=null,mode:'select'|'add'|'move'='select',draft:Piece|null=null,ghost:PartModel|null=null;
let valid=false,hasPoint=false,lastPointer:{clientX:number;clientY:number}|null=null;
let snapEnabled=true,overlapAllowed=false,activeColor=colors[0].hex;
const models=new Map<string,PartModel>();
const status=(message:string)=>{$('editor-status').textContent=message;};
function selected(){return history.current.pieces.find(p=>p.id===selectedId);}
function saveLocal(){
 if(history.current.guide)buildSessions[history.current.guide.modelId]=clone(history.current);else freeProject=clone(history.current);
 try{localStorage.setItem(sessionKey,JSON.stringify({version:1,free:freeProject,models:buildSessions,layered:buildLayered}));localStorage.setItem(storageKey,JSON.stringify(history.current));$('save-state').textContent='已自动保存到此浏览器';try{localStorage.setItem('creative-tool-recent:lego',JSON.stringify({title:history.current.name||'未命名积木作品',updatedAt:Date.now()}));}catch{/* Saving the project succeeded. */}}catch{$('save-state').textContent='自动保存不可用 · 请保存文件';}
}
let syncScene=()=>{};
let shortcutLabel=(action:ShortcutAction):string=>action==='rotateY'?'R':action;
function commit(message:string,next=clone(history.current)){try{if(history.commit(next)){syncScene();saveLocal();}status(message);}catch(error){status((error as Error).message);}}
function download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
function fileName(){return history.current.name.replace(/[\\/:*?"<>|]/g,'_').trim()||'积木作品';}

try{
 const host=$('build-scene'),renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#eeeee7');renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;host.append(renderer.domElement);renderer.domElement.setAttribute('aria-label','拼搭画布：点击选中或放置零件');
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(38,1,0.5,20000),assembly=new THREE.Group();scene.add(assembly);
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,0.04);room.dispose();pmrem.dispose();scene.environment=env.texture;scene.environmentIntensity=0.5;
 scene.add(new THREE.HemisphereLight(0xffffff,0xa5afa0,1.3));
 const light=new THREE.DirectionalLight(0xfff9ed,3.2);light.position.set(-140,280,140);light.castShadow=true;light.shadow.mapSize.set(2048,2048);light.shadow.camera.left=-240;light.shadow.camera.right=240;light.shadow.camera.top=240;light.shadow.camera.bottom=-240;light.shadow.camera.far=750;light.shadow.normalBias=0.1;scene.add(light);
 const fill=new THREE.DirectionalLight(0xe4ecff,1.2);fill.position.set(100,100,-150);scene.add(fill);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(12000,12000),new THREE.MeshStandardMaterial({color:'#eeeee7',roughness:1}));floor.rotation.x=-Math.PI/2;floor.position.y=-0.16;floor.receiveShadow=true;scene.add(floor);
 const grid=new THREE.GridHelper(512,64,0xb4bcb0,0xd7dbd1);grid.position.y=-0.08;scene.add(grid);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2-0.025;controls.minDistance=25;controls.maxDistance=10000;controls.target.set(4,20,4);camera.position.set(195,175,220);controls.update();
 const buildTargets=new BuildTargets();scene.add(buildTargets.group);
 const selectionBox=new THREE.Box3Helper(new THREE.Box3(),0x4b6d4f);selectionBox.visible=false;scene.add(selectionBox);
 const connectorMarkers=new THREE.Group(),markerGeometry=new THREE.SphereGeometry(.9,10,8),markerMaterial=new THREE.MeshBasicMaterial({color:0xf2b43f});scene.add(connectorMarkers);
 function refreshConnectorMarkers(){
  connectorMarkers.clear();if(history.current.guide||!draft||!snapEnabled)return;const sources=getConnectors(getPart(draft.partId));
  for(const target of history.current.pieces){if(target.id===draft.id)continue;for(const c of worldConnectors(target)){if(!sources.some(s=>axleCompatible(s.type,c.type)))continue;const marker=new THREE.Mesh(markerGeometry,markerMaterial);marker.position.copy(c.position).addScaledVector(c.normal,.25);connectorMarkers.add(marker);}}
 }
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),groundPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
 function applyPose(group:THREE.Group,piece:Piece){group.position.fromArray(piece.position);group.rotation.set(...piece.rotation.map(n=>n*Math.PI/2) as Triple);group.updateMatrixWorld(true);}
 function updateSelectionBox(){const model=selectedId?models.get(selectedId):undefined;selectionBox.visible=!!model&&mode==='select';if(model){selectionBox.box.setFromObject(model.group).expandByScalar(0.6);selectionBox.updateMatrixWorld(true);}}
 function sync(){
  const guideId=history.current.guide?.modelId??null;if(guideId!==lastBuildId){buildSupply=null;lastBuildId=guideId;}
  const ids=new Set(history.current.pieces.map(p=>p.id));for(const [id,model] of models)if(!ids.has(id)){assembly.remove(model.group);model.dispose();models.delete(id);}
  for(const piece of history.current.pieces){let model=models.get(piece.id);if(model&&model.definition.id!==piece.partId){assembly.remove(model.group);model.dispose();models.delete(piece.id);model=undefined;}if(!model){model=createPart(getPart(piece.partId),piece.color,{assemblyFit:true});model.group.userData.instanceId=piece.id;models.set(piece.id,model);assembly.add(model.group);}model.material.color.set(piece.color);applyPose(model.group,piece);model.group.visible=!(mode==='move'&&piece.id===selectedId);}
  if(selectedId&&!ids.has(selectedId))selectedId=null;
  $('project-name').setAttribute('title',history.current.name);$<HTMLInputElement>('project-name').value=history.current.name;
  $('piece-count').textContent=`${history.current.pieces.length} / ${MAX_PIECES}`;
  $<HTMLButtonElement>('undo').disabled=!history.past.length;$<HTMLButtonElement>('redo').disabled=!history.future.length;
  const list=$('scene-list');list.replaceChildren();
  for(const [i,piece]of [...history.current.pieces].entries()){
   const button=document.createElement('button');button.dataset.instance=piece.id;button.className=piece.id===selectedId?'active':'';button.setAttribute('aria-pressed',String(piece.id===selectedId));
   const dot=document.createElement('i');dot.style.background=piece.color;const title=document.createElement('span');title.textContent=getPart(piece.partId).name;const number=document.createElement('small');number.textContent=String(i+1).padStart(2,'0');button.append(dot,title,number);button.onclick=()=>select(piece.id);list.append(button);
  }
  updateSelectionBox();syncProperties();refreshConnectorMarkers();syncBuildGuide();
 }
 syncScene=sync;
 function syncProperties(){
  if(history.current.guide){
   $('selection-empty').hidden=true;$('selection-panel').hidden=true;$('properties-heading').hidden=true;
   document.querySelectorAll<HTMLButtonElement>('[data-selection]').forEach(b=>b.disabled=true);
   $('mode-banner').hidden=true;$('select-mode').classList.toggle('active',!buildSupply);$('move-piece').classList.remove('active');
   renderer.domElement.style.cursor=buildSupply?'crosshair':'grab';return;
  }
  $('properties-heading').hidden=false;
  const piece=draft??selected();$('selection-empty').hidden=!!piece;$('selection-panel').hidden=!piece;
  $('selected-label').textContent=mode==='add'?'待放置':mode==='move'?'移动中':piece?'已选中':'未选中';
  document.querySelectorAll<HTMLButtonElement>('[data-selection]').forEach(b=>b.disabled=!selected()||mode!=='select');
  if(piece){$('selected-name').textContent=getPart(piece.partId).name;$('selected-id').textContent=piece.partId.toUpperCase();piece.position.forEach((n,i)=>{$<HTMLInputElement>(`position-${i}`).value=String(clean(n));$<HTMLInputElement>(`position-${i}`).disabled=mode!=='select';});piece.rotation.forEach((n,i)=>$(`rotation-${i}`).textContent=`${n*90}°`);$('editor-palette').querySelectorAll<HTMLButtonElement>('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===piece.color)));}
  $('mode-banner').hidden=mode==='select';$('select-mode').classList.toggle('active',mode==='select');$('move-piece').classList.toggle('active',mode==='move');renderer.domElement.style.cursor=mode==='select'?'grab':'crosshair';
  $('mode-text').textContent=mode==='add'?`放置 ${draft?getPart(draft.partId).name:''} · 连续添加 · 右键 / ${shortcutLabel('rotateY')} 转向`:'移动零件 · 点击确认 · 右键转向 · Esc 还原';
 }
 function clearGhost(){if(ghost){scene.remove(ghost.group);ghost.dispose();ghost=null;}}
 function cancel(){buildSupply=null;$('hint').textContent='点击选中 · 右键单击转向 · 右键拖动平移 · 滚轮缩放';clearGhost();mode='select';draft=null;hasPoint=false;sync();}
 function select(id:string|null){cancel();selectedId=id;sync();if(id)status(history.current.guide?'已选中完成的积木，可用「拆下选中的积木」移回零件盒。':`已选中 ${getPart(selected()!.partId).name}。可编辑坐标、旋转和颜色。`);}
 function begin(piece:Piece,nextMode:'add'|'move'){
  if(history.current.guide)return;
  clearGhost();draft=clone(piece);mode=nextMode;hasPoint=false;ghost=createPart(getPart(piece.partId),piece.color,{assemblyFit:true});
  ghost.group.traverse(o=>{if(o instanceof THREE.Mesh){const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>{m.transparent=true;m.opacity=0.48;m.depthWrite=false;});o.castShadow=false;}});scene.add(ghost.group);ghost.group.visible=false;sync();if(lastPointer)updatePreview(lastPointer);
  status(nextMode==='add'?'移动到工作台，点击放下。可连续放置；Esc 返回选择。':'移动到新位置，点击确认。Esc 取消并还原。');
 }
 function pick(event:{clientX:number;clientY:number}){
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
  const roots=[...models.entries()].filter(([id])=>!(mode==='move'&&id===selectedId)).map(([,m])=>m.group);
  const hit=raycaster.intersectObjects(roots,true)[0];let piece:Piece|undefined;
  if(hit){let o:THREE.Object3D|null=hit.object;while(o&&!o.userData.instanceId)o=o.parent;piece=history.current.pieces.find(p=>p.id===o?.userData.instanceId);}
  const point=raycaster.ray.intersectPlane(groundPlane,new THREE.Vector3());return {hit,piece,point};
 }
 function validateDraft(){if(!draft)return false;if(draft.position.some(n=>!Number.isFinite(n)||Math.abs(n)>5000))return false;return bodyBounds(draft).min.y>=-0.1&&(overlapAllowed||!collision(draft,history.current.pieces));}
 function mechanicalSnap(event:{clientX:number;clientY:number},hit:THREE.Intersection|undefined,hitPiece:Piece|undefined){
  if(!draft||!snapEnabled)return null;const sources=getConnectors(getPart(draft.partId));
  if(!sources.some(c=>['axle-hole','axle-end'].includes(c.type)))return null;
  const rect=renderer.domElement.getBoundingClientRect();let nearest:{target:Piece;connectorId:string}|null=null,bestDistance=30;
  for(const target of history.current.pieces){if(target.id===draft.id)continue;
   for(const c of worldConnectors(target)){
    if(!sources.some(s=>axleCompatible(s.type,c.type)))continue;
    const screen=c.position.clone().project(camera);if(screen.z< -1||screen.z>1)continue;
    if(hit&&hitPiece?.id!==target.id&&hit.distance+4<c.position.distanceTo(camera.position))continue;
    const x=rect.x+(screen.x+1)*rect.width/2,y=rect.y+(1-screen.y)*rect.height/2;
    const distance=Math.hypot(event.clientX-x,event.clientY-y);
    if(distance<bestDistance){bestDistance=distance;nearest={target,connectorId:c.id};}
   }
  }
  return nearest?snapToAxle(draft,nearest.target,nearest.connectorId):null;
 }
 function updatePreview(event:{clientX:number;clientY:number}){
  if(!draft||!ghost)return;const {hit,piece,point}=pick(event);
  const mechanical=mechanicalSnap(event,hit,piece);
  if(!point&&!mechanical){ghost.group.visible=false;hasPoint=false;return;}
  const surface=hit?.point??point!;
  const snapped=!mechanical&&snapEnabled&&piece?snapToTop(draft,piece,surface.x,surface.z):null;
  if(mechanical){draft.position=mechanical.position;draft.rotation=mechanical.rotation;}
  else if(snapped)draft.position=snapped;
  else if(snapEnabled)draft.position=gridPosition(getPart(draft.partId),draft.rotation,point!.x,point!.z);
  else draft.position=[clean(point!.x),0,clean(point!.z)];
  if(!snapped&&!mechanical){const low=bodyBounds(draft).min.y;if(low<0)draft.position[1]=clean(draft.position[1]-low);}
  hasPoint=true;valid=validateDraft();ghost.group.visible=true;ghost.material.color.set(valid?draft.color:'#f04438');applyPose(ghost.group,draft);syncProperties();
  const belowGround=bodyBounds(draft).min.y;
  $('hint').textContent=valid?(mechanical?`已对齐轴孔 · 插入 ${mechanical.depth.toFixed(1)} mm · 点击连接`:snapped?'已对齐顶部凸点 · 点击放置':'已对齐工作平面 · 点击放置'):belowGround<-.1?`连接位置低于地面，请先将轴或承载零件抬高至少 ${(-belowGround).toFixed(1)} mm`:'当前位置与其他零件重叠 · 请换一个连接点或位置';
 }
 function place(){
  if(!draft||!hasPoint||!valid){status(hasPoint?$('hint').textContent!:'请把鼠标移到工作平面、凸点或金色轴孔连接点。');return;}
  const next=clone(history.current),piece=clone(draft);
  if(mode==='move'){const i=next.pieces.findIndex(p=>p.id===selectedId);if(i<0)return;next.pieces[i]=piece;cancel();commit('零件已移动。',next);}
  else {if(next.pieces.length>=MAX_PIECES){status('当前版本最多放置 500 个零件。');return;}piece.id=crypto.randomUUID();next.pieces.push(piece);commit('已添加一块。继续点击放置，或按 Esc 结束。',next);if(lastPointer)updatePreview(lastPointer);}
 }
 function changeSelected(update:(piece:Piece)=>void,message:string){
  if(history.current.guide){status('模型拼搭会自动对齐位置与方向；自由编辑请返回自由拼搭。');return;}
  const p=selected();if(!p)return;const next=clone(history.current),piece=next.pieces.find(v=>v.id===p.id)!;update(piece);
  if(bodyBounds(piece).min.y<-0.1){status('零件不能穿过工作平面，请先提高 Y 坐标。');syncProperties();return;}
  if(!overlapAllowed&&collision(piece,next.pieces)){status('此操作会让零件重叠，已保留原位置。机械装配可开启「允许重叠」。');syncProperties();return;}
  commit(message,next);
 }
 function rotate(axis:number){if(draft){draft.rotation[axis]=(draft.rotation[axis]+1)%4;if(lastPointer)updatePreview(lastPointer);syncProperties();}else changeSelected(p=>{p.rotation[axis]=(p.rotation[axis]+1)%4;const low=bodyBounds(p).min.y;if(low<0)p.position[1]=clean(p.position[1]-low);},'已旋转 90°。');}
 // Keep clicks distinct from OrbitControls drags, including drags that return to their starting point.
 let down:{x:number;y:number;button:number;pointerId:number;dragged:boolean}|null=null;
 renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
 renderer.domElement.addEventListener('pointerdown',e=>{down=e.isPrimary?{x:e.clientX,y:e.clientY,button:e.button,pointerId:e.pointerId,dragged:false}:null;});
 renderer.domElement.addEventListener('pointermove',e=>{
  if(down&&down.pointerId===e.pointerId&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)down.dragged=true;
  lastPointer={clientX:e.clientX,clientY:e.clientY};if(!e.buttons){if(history.current.guide)hoverBuildSlot(e);else updatePreview(e);}
 });
 renderer.domElement.addEventListener('pointerup',e=>{
  const start=down;down=null;
  if(!start||start.pointerId!==e.pointerId||start.dragged||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;
  lastPointer={clientX:e.clientX,clientY:e.clientY};
  if(history.current.guide){if(start.button===0)clickBuildSlot(e);return;}
  if(start.button===2){if(draft||selected())rotate(1);else status('请先选中零件，再单击右键旋转 90°。');return;}
  if(start.button!==0)return;
  if(mode==='select'){select(pick(e).piece?.id??null);}else{updatePreview(e);place();}
 });
 renderer.domElement.addEventListener('pointerleave',()=>{buildTargets.hover(null);if(ghost)ghost.group.visible=false;hasPoint=false;});
 renderer.domElement.addEventListener('pointercancel',()=>{down=null;cancel();});window.addEventListener('blur',()=>{down=null;if(mode==='move')cancel();});
 $('cancel-place').onclick=cancel;$('select-mode').onclick=cancel;
 $('move-piece').onclick=()=>{const p=selected();if(p)begin(p,'move');};
 $('duplicate').onclick=()=>{const p=selected();if(p)begin({...clone(p),id:crypto.randomUUID()},'add');};
 $('delete-piece').onclick=()=>{if(!selected())return;const next=clone(history.current);next.pieces=next.pieces.filter(p=>p.id!==selectedId);commit('已删除零件，可撤销。',next);};
 document.querySelectorAll<HTMLButtonElement>('[data-rotate]').forEach(b=>b.onclick=()=>rotate(Number(b.dataset.rotate)));
 for(let i=0;i<3;i++)$<HTMLInputElement>(`position-${i}`).onchange=()=>{const n=$<HTMLInputElement>(`position-${i}`).valueAsNumber;if(!Number.isFinite(n)||Math.abs(n)>5000){status('坐标需要是 -5000 到 5000 之间的数字。');syncProperties();return;}changeSelected(p=>{p.position[i]=clean(n);},'已更新坐标。');};
 for(const color of colors){const b=document.createElement('button');b.style.background=color.hex;b.dataset.color=color.hex;b.title=color.name;b.setAttribute('aria-label',color.name);b.onclick=()=>{activeColor=color.hex;if(draft){draft.color=color.hex;if(ghost)ghost.material.color.set(valid?color.hex:'#f04438');syncProperties();}else{const next=clone(history.current),p=next.pieces.find(p=>p.id===selectedId);if(p){p.color=color.hex;commit(`已换成${color.name}。`,next);}}};$('editor-palette').append(b);}
 function undo(){cancel();if(history.undo()){sync();saveLocal();status('已撤销。');}}
 function redo(){cancel();if(history.redo()){sync();saveLocal();status('已重做。');}}
 $('undo').onclick=undo;$('redo').onclick=redo;
 function fit(){const box=new THREE.Box3().setFromObject(assembly);if(history.current.guide)box.expandByObject(buildTargets.group);if(box.isEmpty())box.set(new THREE.Vector3(-64,0,-64),new THREE.Vector3(64,30,64));const c=box.getCenter(new THREE.Vector3()),r=box.getBoundingSphere(new THREE.Sphere()).radius;const angle=Math.min(THREE.MathUtils.degToRad(19),Math.atan(Math.tan(THREE.MathUtils.degToRad(19))*camera.aspect));const d=Math.max(90,r/Math.sin(angle)*1.15);controls.target.copy(c);camera.position.copy(c).add(new THREE.Vector3(1.1,1.05,1.3).normalize().multiplyScalar(d));controls.update();}
 $('fit-view').onclick=fit;$('toggle-grid').onclick=()=>{grid.visible=!grid.visible;$('toggle-grid').textContent=`网格 ${grid.visible?'开':'关'}`;$('toggle-grid').setAttribute('aria-pressed',String(grid.visible));};
 $<HTMLInputElement>('snap').onchange=e=>{snapEnabled=(e.target as HTMLInputElement).checked;refreshConnectorMarkers();if(lastPointer)updatePreview(lastPointer);};
 $<HTMLInputElement>('overlap').onchange=e=>{overlapAllowed=(e.target as HTMLInputElement).checked;if(lastPointer)updatePreview(lastPointer);};
 $('new-project').onclick=()=>{cancel();commit('已新建空白作品。可撤销恢复上一件作品。',newProject());fit();};
 $('load-wheel-sample').onclick=()=>{cancel();commit('已载入轮轴示例：车轮连接十字轴，轴穿过带孔砖。可撤销返回原作品。',wheelStarter());fit();};
 $('load-sample').onclick=()=>{cancel();commit('已载入彩虹门示例。可撤销返回上一件作品。',starter());fit();};
 $<HTMLInputElement>('project-name').onchange=()=>{const next=clone(history.current);next.name=$<HTMLInputElement>('project-name').value.trim()||'未命名作品';commit('作品已重命名。',next);};
 $('save-project').onclick=()=>{download(new Blob([JSON.stringify(history.current,null,2)],{type:'application/json'}),`${fileName()}.brick.json`);status('已发起作品文件下载；可通过「打开作品」继续编辑。');};
 $('open-project').onclick=()=>{$<HTMLInputElement>('project-file').value='';$('project-file').click();};
 $<HTMLInputElement>('project-file').onchange=async e=>{const file=(e.target as HTMLInputElement).files?.[0];if(!file)return;try{if(file.size>2_000_000)throw new Error('文件过大，请选择 2 MB 以内的作品 JSON。');const imported=assertGuidedProject(parseProject(JSON.parse(await file.text())));saveLocal();cancel();commit('作品已打开，可撤销回到刚才的作品。',imported);fit();}catch(error){status(`打开失败，当前作品未改变。${(error as Error).message}`);}};
 $('export-model').onclick=async()=>{
  if(!history.current.pieces.length){status('请先添加零件再导出模型。');return;}const button=$<HTMLButtonElement>('export-model');button.disabled=true;status('正在导出整件作品…');
  try{const data=await exportProject(history.current,models);download(new Blob([data],{type:'model/gltf-binary'}),`${fileName()}.glb`);status('已生成 GLB 并发起下载，单位为米。继续编辑请使用作品 JSON。');
  }catch(error){console.error(error);status('模型导出失败，请重试或先保存作品文件。');}finally{button.disabled=false;}
 };
 function nudge(axis:number,amount:number){
  if(mode!=='select'){status('请先放下零件或按 Esc 结束放置，再用方向键或升降键微调。');return;}
  if(!selected()){status('请先选中要微调的零件。');return;}
  changeSelected(piece=>{piece.position[axis]=clean(piece.position[axis]+amount);},'零件位置已微调，可撤销。');
 }
 function refreshShortcutHints(){
  const labels:Partial<Record<ShortcutAction,[string,string]>>={move:['move-piece','移动选中零件'],duplicate:['duplicate','复制零件'],delete:['delete-piece','删除零件'],undo:['undo','撤销'],redo:['redo','重做'],save:['save-project','保存作品文件'],fit:['fit-view','查看全部'],grid:['toggle-grid','显示 / 隐藏网格'],snap:['snap','切换吸附'],search:['part-search','搜索零件']};
  for(const [action,[id,label]]of Object.entries(labels))$(id).title=`${label}（${shortcutLabel(action as ShortcutAction)}）`;
  (['rotateX','rotateY','rotateZ'] as const).forEach((action,i)=>{document.querySelector<HTMLElement>(`[data-rotate="${i}"]`)!.title=`旋转 90°（${shortcutLabel(action)}${action==='rotateY'?' / 鼠标右键':''}）`;});
  $('shortcut-summary').textContent=`${shortcutLabel('rotateY')} 旋转 · ${shortcutLabel('move')} 移动 · ? 快捷键`;
  syncProperties();
 }
 const shortcuts=installShortcuts({cancel,changed:refreshShortcutHints,run:action=>{
  const buttons:Partial<Record<ShortcutAction,string>>={move:'move-piece',duplicate:'duplicate',delete:'delete-piece',undo:'undo',redo:'redo',save:'save-project',fit:'fit-view',grid:'toggle-grid',snap:'snap'};
  if(buttons[action]){$(buttons[action]!).click();return;}
  if(action==='search'){$('part-search').focus();return;}
  const axes={rotateX:0,rotateY:1,rotateZ:2};if(action in axes){rotate(axes[action as keyof typeof axes]);return;}
  const steps:Partial<Record<ShortcutAction,[number,number]>>={left:[0,-8],right:[0,8],forward:[2,-8],backward:[2,8],lower:[1,-3.2],raise:[1,3.2]};const step=steps[action];if(step)nudge(...step);
 }});
 shortcutLabel=shortcuts.label;refreshShortcutHints();
 // A shared thumbnail renderer keeps 137 cards from creating 137 WebGL contexts.
 const thumbRenderer=new THREE.WebGLRenderer({antialias:true,alpha:true});thumbRenderer.setSize(200,140);thumbRenderer.setClearColor(0,0);thumbRenderer.toneMapping=THREE.ACESFilmicToneMapping;
 const thumbScene=new THREE.Scene();thumbScene.add(new THREE.HemisphereLight(0xffffff,0xa5ad95,2));const thumbKey=new THREE.DirectionalLight(0xffffff,3);thumbKey.position.set(-20,35,25);thumbScene.add(thumbKey);const thumbCam=new THREE.PerspectiveCamera(32,200/140,0.1,2000),cache=new Map<string,string>();
 let tasks:HTMLButtonElement[]=[],thumbnailFrame=0;
 function thumbnail(){thumbnailFrame=0;const b=tasks.shift();if(!b)return;if(b.isConnected){const id=b.dataset.part!,part=getPart(id),model=createPart(part,b.dataset.color??(part.category==='baseplate'?'#256b50':part.category==='tile'?'#dfb021':part.category==='plate'?'#eee8d9':part.category==='beam'||part.category==='technic'?'#646b6c':part.category==='axle'?'#252c2f':'#bf2923'));thumbScene.add(model.group);const box=new THREE.Box3().setFromObject(model.group),centre=box.getCenter(new THREE.Vector3()),r=box.getBoundingSphere(new THREE.Sphere()).radius;thumbCam.position.copy(centre).add(new THREE.Vector3(0.9,1.05,1.4).normalize().multiplyScalar(r/Math.sin(THREE.MathUtils.degToRad(16))*1.1));thumbCam.lookAt(centre);thumbRenderer.render(thumbScene,thumbCam);const url=thumbRenderer.domElement.toDataURL();cache.set(b.dataset.thumbkey??id,url);b.querySelector('img')!.src=url;thumbScene.remove(model.group);model.dispose();}if(tasks.length)thumbnailFrame=requestAnimationFrame(thumbnail);}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer.unobserve(entry.target);tasks.push(entry.target as HTMLButtonElement);}if(tasks.length&&!thumbnailFrame)thumbnailFrame=requestAnimationFrame(thumbnail);},{root:$('part-cards'),rootMargin:'150px'});
 function renderLibrary(){observer.disconnect();tasks=[];if(history.current.guide){renderBuildSupplies();return;}const root=$('part-cards');root.replaceChildren();const filtered=searchParts($<HTMLInputElement>('part-search').value,$<HTMLSelectElement>('part-category').value as Category|'all');
  const featured=['brick-2x4','brick-2x2','plate-2x4','tile-2x2','slope-2x3','round-2x2-brick','technic-1x4','wheel-1x1-d24','baseplate-16x16'];if(!$<HTMLInputElement>('part-search').value&&$<HTMLSelectElement>('part-category').value==='all')filtered.sort((a,b)=>(featured.includes(a.id)?featured.indexOf(a.id):100)-(featured.includes(b.id)?featured.indexOf(b.id):100));
  $('library-total').textContent='137 PARTS';$('library-instruction').textContent='点击零件，开始放置';$('filter-count').textContent=`${filtered.length} 个规格`;
  if(!filtered.length){const p=document.createElement('p');p.className='empty-results';p.textContent='没有找到零件，换个名称或分类试试。';root.append(p);}
  for(const part of filtered){const button=document.createElement('button');button.className='part-tile';button.dataset.part=part.id;button.title=`放置 ${part.name}`;button.setAttribute('aria-label',`放置 ${part.name}`);const img=document.createElement('img');img.alt='';img.width=200;img.height=140;if(cache.has(part.id))img.src=cache.get(part.id)!;const name=document.createElement('strong');name.textContent=part.name;const size=document.createElement('small');size.textContent=`${partSizeLabel(part)} · ${part.category.toUpperCase()}`;button.append(img,name,size);button.onclick=()=>{cancel();selectedId=null;begin(makePiece(part.id,activeColor),'add');};root.append(button);if(!cache.has(part.id))observer.observe(button);}
 }

 function syncBuildGuide(){
  const guided=!!history.current.guide;document.body.classList.toggle('guided-build',guided);$('build-guide-panel').hidden=!guided;
  document.querySelector<HTMLElement>('.options')!.hidden=guided;document.querySelector<HTMLElement>('.project-actions')!.hidden=guided;
  document.querySelector<HTMLElement>('.stage-heading h1')!.textContent=guided?getBuildModel(history.current.guide!.modelId).name:'一块一块，搭出想象。';
  document.querySelector<HTMLElement>('.stage-tag')!.textContent=guided?'模型拼搭 / 03':'自由拼搭 / 02';
  buildTargets.sync(history.current,buildSupply,buildLayered);
  if(guided){
   const state=buildProgress(history.current),percent=Math.round(state.completed/state.total*100),slots=availableSlots(history.current,buildSupply,buildLayered);
   $('build-model-name').textContent=state.model.name;$('build-percent').textContent=`${percent}%`;$('build-count').textContent=`${state.completed} / ${state.total} 块`;
   $<HTMLProgressElement>('build-progress').value=percent;
   $('build-step').textContent=state.remaining.length?(buildLayered?`第 ${state.level} / ${state.levels} 层 · 先填当前层，内部不会被挡住`:'全部位置开放 · 可以自由选择填充顺序'):'拼搭完成！可以旋转欣赏、保存作品或导出实体模型。';
   $<HTMLInputElement>('build-layered').checked=buildLayered;
   const supply=modelSupplies(history.current).find(item=>item.key===buildSupply);
   $('build-supply-label').textContent=supply?`${getPart(supply.partId).name} · ${colorName(supply.color)} · 剩余 ${supply.remaining} 块`:'从左侧选择所需零件';
   $<HTMLButtonElement>('build-fill').disabled=!buildSupply||!slots.length;$<HTMLButtonElement>('mobile-fill').disabled=!buildSupply||!slots.length;
   $<HTMLButtonElement>('build-hint').disabled=!state.remaining.length;$<HTMLButtonElement>('mobile-next').disabled=!state.remaining.length;
   $<HTMLButtonElement>('build-remove').disabled=!selected();
   $('piece-count').textContent=`已填 ${state.completed} / ${state.total}`;
   $('hint').textContent=!state.remaining.length?'拼搭完成 · 拖动旋转欣赏 · 保存文件可继续编辑':buildSupply?'金色：匹配位置 · 点击填入 · 拖动旋转 · 滚轮缩放':'透明：待填位置 · 从左侧选零件，再点击对应位置';
  }
  if(guided||libraryGuided!==guided)renderLibrary();libraryGuided=guided;
 }
 function colorName(hex:string){return colors.find(c=>c.hex.toLowerCase()===hex.toLowerCase())?.name??hex;}
 function selectSupply(key:string){buildSupply=key;selectedId=null;sync();const available=availableSlots(history.current,key,buildLayered);status(available.length?'已高亮匹配位置，点击透明积木即可自动对齐并填入。':'当前层暂不需要这块零件，试试「帮我选下一块」。');}
 function renderBuildSupplies(){
  const root=$('part-cards');root.replaceChildren();const state=buildProgress(history.current);
  const matches=new Set(searchParts($<HTMLInputElement>('part-search').value,$<HTMLSelectElement>('part-category').value as Category|'all').map(p=>p.id));
  const supplies=modelSupplies(history.current),filtered=supplies.filter(item=>matches.has(item.partId));
  $('library-total').textContent=`${state.total} 块 / ${supplies.length} 种`;$('library-instruction').textContent='选零件，再点金色位置';$('filter-count').textContent=`剩余 ${state.remaining.length} 块`;
  if(!filtered.length){const p=document.createElement('p');p.className='empty-results';p.textContent='此模型没有符合条件的零件，请清空搜索或切换分类。';root.append(p);}
  for(const item of filtered){
   const part=getPart(item.partId),button=document.createElement('button');button.className='part-tile guide-part';button.dataset.part=part.id;button.dataset.color=item.color;button.dataset.thumbkey=item.key;button.dataset.supply=item.key;
   button.disabled=!item.remaining;button.classList.toggle('active',buildSupply===item.key);button.setAttribute('aria-pressed',String(buildSupply===item.key));button.setAttribute('aria-label',`选择 ${colorName(item.color)} ${part.name}，剩余 ${item.remaining} 块`);
   const img=document.createElement('img');img.alt='';img.width=200;img.height=140;if(cache.has(item.key))img.src=cache.get(item.key)!;
   const name=document.createElement('strong');name.textContent=part.name;const color=document.createElement('small');color.textContent=colorName(item.color);
   const quantity=document.createElement('span');quantity.className='guide-part-count';quantity.textContent=item.remaining?`${item.remaining} / ${item.total} 剩余`:'✓ 已填满';
   button.append(img,name,color,quantity);button.onclick=()=>selectSupply(item.key);root.append(button);if(!cache.has(item.key))observer.observe(button);
  }
 }
 function pickBuildSlot(event:{clientX:number;clientY:number}){
  const actual=pick(event),target=buildTargets.pick(raycaster);
  // Filled solids occlude targets normally. Upper reference layers are not in
  // the pick set, so they cannot block the current layer.
  if(target&&(!actual.hit||target.distance<actual.hit.distance+.2))return {target:target.slot,piece:undefined};
  return {target:undefined,piece:actual.piece};
 }
 function hoverBuildSlot(event:{clientX:number;clientY:number}){
  const {target}=pickBuildSlot(event);buildTargets.hover(target?.id??null);
  if(target)$('hint').textContent=`${getPart(target.partId).name} · ${colorName(target.color)} · ${buildSupply===supplyKey(target)?'点击填入':'先从左侧选择对应零件'}`;
 }
 function fillBuildTarget(id:string){
  try{const next=fillSlot(history.current,id,buildSupply,buildLayered);selectedId=null;commit('已填入一块积木，位置和方向已自动对齐。',next);if(!buildProgress(next).remaining.length)status('模型拼搭完成！可保存文件、导出实体模型，或再选一个模型。');}
  catch(error){status((error as Error).message);}
 }
 function clickBuildSlot(event:{clientX:number;clientY:number}){
  const {target,piece}=pickBuildSlot(event);
  if(target){if(!buildSupply){status(`这里需要 ${colorName(target.color)} ${getPart(target.partId).name}，请先从左侧选择。`);return;}fillBuildTarget(target.id);}
  else if(piece)select(piece.id);
  else status(buildSupply?'请点击当前层的金色高亮位置，拖动画布可以换个角度。':'先从左侧选择零件，或点击「帮我选下一块」。');
 }
 $('build-hint').onclick=()=>{
  const next=availableSlots(history.current,null,buildLayered)[0];if(!next)return;
  $<HTMLInputElement>('part-search').value='';$<HTMLSelectElement>('part-category').value='all';selectSupply(supplyKey(next));
  const button=Array.from($('part-cards').querySelectorAll<HTMLButtonElement>('button')).find(b=>b.dataset.supply===supplyKey(next));button?.scrollIntoView({block:'nearest'});
 };
 $('build-fill').onclick=()=>{if(!buildSupply)return;const slot=availableSlots(history.current,buildSupply,buildLayered)[0];if(slot)fillBuildTarget(slot.id);};
 $('build-remove').onclick=()=>{if(history.current.guide)$('delete-piece').click();};
 $('build-restart').onclick=()=>{const id=history.current.guide?.modelId;if(!id)return;cancel();commit('已重新开始当前模型，可撤销恢复刚才的进度。',newGuidedProject(id));fit();};
 $<HTMLInputElement>('build-layered').onchange=e=>{buildLayered=(e.target as HTMLInputElement).checked;sync();saveLocal();};
 $('leave-build-guide').onclick=()=>{saveLocal();const restored=clone(freeProject??newProject());cancel();commit('已回到自由拼搭，模型拼搭进度已单独保留。',restored);fit();};
 const buildDialog=$<HTMLDialogElement>('build-model-dialog');
 function modelPreview(id:string){
  const key=`model:${id}`;if(cache.has(key))return cache.get(key)!;
  const model=getBuildModel(id),root=new THREE.Group(),created:PartModel[]=[];
  for(const p of model.pieces){const part=createPart(getPart(p.partId),p.color,{assemblyFit:true});applyPose(part.group,p);root.add(part.group);created.push(part);}
  thumbScene.add(root);thumbRenderer.setSize(480,320);thumbCam.aspect=1.5;thumbCam.updateProjectionMatrix();
  const box=new THREE.Box3().setFromObject(root),center=box.getCenter(new THREE.Vector3()),radius=box.getBoundingSphere(new THREE.Sphere()).radius;
  thumbCam.position.copy(center).add(new THREE.Vector3(1.05,.8,1.3).normalize().multiplyScalar(radius/Math.sin(THREE.MathUtils.degToRad(16))*1.05));thumbCam.lookAt(center);
  thumbRenderer.render(thumbScene,thumbCam);const image=thumbRenderer.domElement.toDataURL();cache.set(key,image);
  thumbScene.remove(root);created.forEach(m=>m.dispose());thumbRenderer.setSize(200,140);thumbCam.aspect=200/140;thumbCam.updateProjectionMatrix();return image;
 }
 function chooseModel(id:string){
  saveLocal();const next=clone(buildSessions[id]??newGuidedProject(id));cancel();$<HTMLInputElement>('part-search').value='';$<HTMLSelectElement>('part-category').value='all';
  commit('已载入透明目标模型。选择左侧零件，再点击画布中的匹配位置。',next);fit();buildDialog.close();$('choose-build-model').focus();
 }
 function openBuildModels(){
  const root=$('build-model-cards');root.replaceChildren();
  for(const m of buildModels){const card=document.createElement('button');card.className='build-model-card';card.dataset.buildModel=m.id;
   const img=document.createElement('img');img.alt=`${m.name}成品模型`;img.src=modelPreview(m.id);img.width=480;img.height=320;
   const name=document.createElement('strong');name.textContent=m.name;const meta=document.createElement('small');meta.textContent=`${m.difficulty} · ${m.pieces.length} 块 · ${new Set(m.pieces.map(supplyKey)).size} 种零件`;
   const desc=document.createElement('p');desc.textContent=m.description;
   const label=document.createElement('span');label.className='build-model-start';const saved=history.current.guide?.modelId===m.id?history.current:buildSessions[m.id];label.textContent=saved?`继续拼搭 · ${saved.pieces.length}/${m.pieces.length} →`:'开始拼搭 →';
   card.append(img,name,meta,desc,label);card.onclick=()=>chooseModel(m.id);root.append(card);
  }
  buildDialog.showModal();
 }
 $('choose-build-model').onclick=openBuildModels;$('change-build-model').onclick=openBuildModels;
 $('close-build-models').onclick=()=>{buildDialog.close();$('choose-build-model').focus();};
 buildDialog.addEventListener('click',e=>{if(e.target===buildDialog){const r=buildDialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)buildDialog.close();}});
 $('part-search').oninput=renderLibrary;$('part-category').onchange=renderLibrary;
 const resize=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});resize.observe(host);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();renderer.setAnimationLoop(null);status('三维显示中断。作品仍保存在浏览器中，请刷新页面。');});
 renderer.setAnimationLoop(()=>{controls.update();renderer.render(scene,camera);});
 sync();renderLibrary();renderer.setSize(host.clientWidth,host.clientHeight);camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();fit();status(loadMessage);
 window.addEventListener('pagehide',e=>{if(e.persisted)return;renderer.setAnimationLoop(null);observer.disconnect();resize.disconnect();cancelAnimationFrame(thumbnailFrame);controls.dispose();clearGhost();markerGeometry.dispose();markerMaterial.dispose();models.forEach(m=>m.dispose());buildTargets.clear();env.dispose();floor.geometry.dispose();(floor.material as THREE.Material).dispose();grid.geometry.dispose();(grid.material as THREE.Material).dispose();selectionBox.geometry.dispose();(selectionBox.material as THREE.Material).dispose();renderer.dispose();thumbRenderer.dispose();},{once:true});
}catch(error){console.error(error);status('工作台启动失败，请使用支持 WebGL 2 的浏览器并刷新。');}


}
