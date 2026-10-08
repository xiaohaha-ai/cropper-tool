import * as THREE from 'three';
import {type Piece,type Project,type Triple} from './assembly';
import {availableSlots,buildProgress,supplyKey} from './build-models';
import {getPart} from './catalog';
import {createPart,type PartModel} from './parts';

// Presentation only. Completion is derived from the canonical Project, never
// from visibility, materials or mesh counts. Targets never enter export maps.
export class BuildTargets {
 readonly group=new THREE.Group();
 private modelId='';
 private models=new Map<string,PartModel>();
 private slots:Piece[]=[];
 private pickable=new Set<string>();
 private remaining=new Set<string>();
 private selectedKey:string|null=null;
 private hovered:string|null=null;
 constructor(){this.group.name='Transparent_build_targets';}
 sync(project:Project,key:string|null,layered:boolean){
  if(!project.guide){this.clear();return;}
  const state=buildProgress(project);
  if(this.modelId!==state.model.id){
   this.clear();this.modelId=state.model.id;this.slots=state.model.pieces;
   for(const p of this.slots){
    const m=createPart(getPart(p.partId),p.color,{assemblyFit:true});m.group.userData.slotId=p.id;
    m.group.position.fromArray(p.position);m.group.rotation.set(...p.rotation.map(n=>n*Math.PI/2) as Triple);
    m.group.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=false;o.receiveShadow=false;o.renderOrder=2;const materials=Array.isArray(o.material)?o.material:[o.material];for(const mat of materials){mat.transparent=true;mat.depthWrite=false;}}});
    this.models.set(p.id,m);this.group.add(m.group);
   }
  }
  this.remaining=new Set(state.remaining.map(p=>p.id));
  this.pickable=new Set(availableSlots(project,null,layered).map(p=>p.id));
  this.selectedKey=key;this.hovered=null;this.paint();this.group.updateMatrixWorld(true);
 }
 private paint(){
  for(const slot of this.slots){const model=this.models.get(slot.id)!;
   model.group.visible=this.remaining.has(slot.id);if(!model.group.visible)continue;
   const available=this.pickable.has(slot.id),matching=available&&this.selectedKey===supplyKey(slot),hovered=slot.id===this.hovered;
   model.group.traverse(o=>{if(o instanceof THREE.Mesh){
    const materials=(Array.isArray(o.material)?o.material:[o.material]) as THREE.MeshStandardMaterial[];
    for(const mat of materials){mat.color.set(matching?'#d9a337':'#75a6a4');mat.opacity=hovered?.58:matching?.32:available?.17:.045;if(mat.emissive){mat.emissive.set(matching?'#84651f':'#41686a');mat.emissiveIntensity=.16;}}
   }});
  }
 }
 hover(id:string|null){if(this.hovered===id)return;this.hovered=id;this.paint();}
 pick(raycaster:THREE.Raycaster){
  // Other layers remain a faint full-model reference but cannot steal clicks.
  const roots=[...this.models].filter(([id])=>this.remaining.has(id)&&this.pickable.has(id)).map(([,m])=>m.group);
  const hit=raycaster.intersectObjects(roots,true)[0];if(!hit)return null;
  let o:THREE.Object3D|null=hit.object;while(o&&!o.userData.slotId)o=o.parent;
  const slot=this.slots.find(p=>p.id===o?.userData.slotId);return slot?{slot,distance:hit.distance}:null;
 }
 clear(){for(const m of this.models.values())m.dispose();this.models.clear();this.group.clear();this.modelId='';this.slots=[];this.remaining.clear();this.pickable.clear();this.hovered=null;}
}
