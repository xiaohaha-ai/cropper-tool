import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { createBrick } from './brick';
import './style.css';

const el = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const status = el('status');
const settings={color:'#c52e24',rotate:false,bottom:false};
const details=el<HTMLDialogElement>('details');
el('info').onclick=()=>details.showModal();
details.addEventListener('click',e=>{if(e.target===details){const rect=details.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)details.close();}});

try {
  const host=el('scene');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=0.9;
  renderer.setClearColor(0x000000,0);
  renderer.domElement.setAttribute('aria-label','2×4 积木三维视图，使用下方按钮查看底部或复位');
  host.appendChild(renderer.domElement);
  const scene=new THREE.Scene();
  const pmrem=new THREE.PMREMGenerator(renderer);
  const room=new RoomEnvironment();
  const environment=pmrem.fromScene(room,0.04);
  scene.environment=environment.texture;
  scene.environmentIntensity=0.65;
  room.dispose();pmrem.dispose();
  const camera=new THREE.PerspectiveCamera(34,1,0.1,600);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=0.08;
  controls.enablePan=false;controls.autoRotateSpeed=1.0;
  controls.minPolarAngle=0.08;controls.maxPolarAngle=Math.PI-0.08;
  controls.target.set(0,-0.6,0);
  const {group,material}=createBrick(settings.color);
  scene.add(group);
  scene.add(new THREE.HemisphereLight(0xffffff,0xb2ab9b,0.7));
  const key=new THREE.DirectionalLight(0xfff5e6,2.2);key.position.set(-25,45,30);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-45;key.shadow.camera.right=45;
  key.shadow.camera.top=45;key.shadow.camera.bottom=-45;key.shadow.camera.near=1;key.shadow.camera.far=150;
  key.shadow.bias=-0.0001;key.shadow.normalBias=0.025;key.shadow.radius=4;scene.add(key);
  const fill=new THREE.DirectionalLight(0xe4edff,0.8);fill.position.set(25,10,-25);scene.add(fill);
  const under=new THREE.DirectionalLight(0xffffff,0.8);under.position.set(0,-25,18);scene.add(under);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(300,300),new THREE.ShadowMaterial({opacity:0.16}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-4.84;floor.receiveShadow=true;scene.add(floor);

  let frameDistance=70;
  function frame(bottom=false) {
    controls.target.set(0,-0.6,0);
    camera.position.copy(new THREE.Vector3(0.85,bottom?-0.95:0.72,1.12).normalize().multiplyScalar(frameDistance)).add(controls.target);
    controls.update();
  }
  function resize() {
    const width=host.clientWidth,height=host.clientHeight;
    camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height);
    frameDistance=Math.max(70,23/(Math.tan(THREE.MathUtils.degToRad(17))*camera.aspect));
    controls.minDistance=frameDistance*0.48;controls.maxDistance=frameDistance*2.2;
    frame(settings.bottom);
  }
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize();
  const swatches=document.querySelectorAll<HTMLButtonElement>('.swatch');
  function setColor(color:string) {
    settings.color=color;material.color.set(color);
    swatches.forEach(button=>{const active=button.dataset.color===color;button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));});
  }
  swatches.forEach(button=>button.onclick=()=>setColor(button.dataset.color!));
  el('bottom').onclick=()=>{
    settings.bottom=!settings.bottom;frame(settings.bottom);
    el('bottom').setAttribute('aria-pressed',String(settings.bottom));
    el('bottom').textContent=settings.bottom?'看顶部':'看底部';
  };
  el('rotate').onclick=()=>{
    settings.rotate=!settings.rotate;controls.autoRotate=settings.rotate;
    el('rotate').setAttribute('aria-pressed',String(settings.rotate));
    el('rotate').textContent=settings.rotate?'停止旋转':'自动旋转';
  };
  el('reset').onclick=()=>{
    settings.bottom=false;settings.rotate=false;controls.autoRotate=false;setColor('#c52e24');
    el('bottom').setAttribute('aria-pressed','false');el('bottom').textContent='看底部';
    el('rotate').setAttribute('aria-pressed','false');el('rotate').textContent='自动旋转';frame();
  };
  controls.addEventListener('start',()=>{
    if(settings.rotate){settings.rotate=false;controls.autoRotate=false;el('rotate').setAttribute('aria-pressed','false');el('rotate').textContent='自动旋转';}
  });
  el<HTMLButtonElement>('download').onclick=async()=>{
    const button=el<HTMLButtonElement>('download');button.disabled=true;status.textContent='正在导出模型…';
    try {
      const copy=group.clone(true);copy.scale.setScalar(0.001);copy.userData={...copy.userData,units:'metres',sourceDimensionsMillimetres:copy.userData.dimensions};
      const data=await new GLTFExporter().parseAsync(copy,{binary:true});
      if(!(data instanceof ArrayBuffer))throw new Error('导出格式异常');
      const url=URL.createObjectURL(new Blob([data],{type:'model/gltf-binary'}));
      const link=document.createElement('a');link.href=url;link.download='brick-2x4.glb';link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);status.textContent='模型已导出 · 保留当前颜色';
    }catch(error){status.textContent='导出失败，请重试';console.error(error);}finally{button.disabled=false;}
  };
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();renderer.setAnimationLoop(null);status.textContent='图形连接中断，请刷新页面重新加载';});
  let lastTime=0;
  renderer.setAnimationLoop(time=>{
    const delta=Math.min((time-lastTime)/1000,0.1);lastTime=time;
    controls.update(delta);floor.visible=camera.position.y>-4.7;renderer.render(scene,camera);
  });
  status.textContent='2 × 4 积木 · 8 凸点';
  window.addEventListener('pagehide',(event)=>{
    if(event.persisted)return;
    renderer.setAnimationLoop(null);resizeObserver.disconnect();controls.dispose();
    const geometries=new Set<THREE.BufferGeometry>();group.traverse(object=>{if(object instanceof THREE.Mesh)geometries.add(object.geometry);});
    geometries.forEach(geometry=>geometry.dispose());material.dispose();floor.geometry.dispose();(floor.material as THREE.Material).dispose();environment.dispose();renderer.dispose();
  },{once:true});
} catch(error) {
  status.textContent='无法启动三维画面，请使用支持 WebGL 2 的浏览器并开启硬件加速。';
  document.querySelectorAll<HTMLButtonElement>('.dock button').forEach(button=>button.disabled=true);
  console.error(error);
}
