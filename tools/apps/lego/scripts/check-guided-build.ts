import assert from 'node:assert/strict';
import {History,clone,parseProject,starter,collision,bodyBounds,worldPoints,axleFitsHole} from '../src/assembly';
import {buildModels,newGuidedProject,assertGuidedProject,buildProgress,availableSlots,fillSlot,modelSupplies,supplyKey} from '../src/build-models';
import {BuildTargets} from '../src/build-targets';
import {Mesh,MeshStandardMaterial,Raycaster,Vector3} from 'three';

let checks=0;
function check(name:string,fn:()=>void){fn();checks++;console.log(`PASS ${name}`);}
check('Five model manifests use valid, distinct parts and non-overlapping poses',()=>{
 assert.equal(buildModels.length,5);assert.equal(new Set(buildModels.map(m=>m.id)).size,5);
 for(const model of buildModels){const project={...newGuidedProject(model.id),pieces:clone(model.pieces)};
  assert.deepEqual(assertGuidedProject(parseProject(project)),project);
  for(const piece of model.pieces){assert.ok(bodyBounds(piece).min.y>=-.1,`${model.id}/${piece.id} below ground`);assert.equal(collision(piece,model.pieces),false,`${model.id}/${piece.id} overlaps`);}
 }
});
check('Every elevated model part has at least one stud/socket or axle connection',()=>{
 for(const model of buildModels)for(const piece of model.pieces){
  if(bodyBounds(piece).min.y<.1)continue;
  const sockets=worldPoints(piece,'socket');
  const connected=model.pieces.some(other=>other.id!==piece.id&&(axleFitsHole(piece,other)||worldPoints(other,'stud').some(stud=>sockets.some(socket=>stud.distanceTo(socket)<.01))));
  assert.ok(connected,`${model.id}/${piece.id} ${piece.partId} has no connection`);
 }
});
check('Matching rejects wrong part, wrong color, duplicate and out-of-layer placement',()=>{
 const initial=newGuidedProject('cottage'),base=availableSlots(initial,null,true)[0],upper=buildModels[0].pieces[1],snapshot=clone(initial);
 assert.throws(()=>fillSlot(initial,base.id,null,true));
 assert.throws(()=>fillSlot(initial,base.id,'brick-2x2|#256b50',true));
 assert.throws(()=>fillSlot(initial,base.id,`${base.partId}|#bf2923`,true));
 assert.throws(()=>fillSlot(initial,upper.id,supplyKey(upper),true));
 const next=fillSlot(initial,base.id,supplyKey(base),true);assert.throws(()=>fillSlot(next,base.id,supplyKey(base),true));
 assert.deepEqual(initial,snapshot);assert.equal(buildProgress(next).completed,1);
 assert.equal(fillSlot(initial,upper.id,supplyKey(upper),false).pieces.length,1);
});
check('All five models can be completed layer by layer with exact bill counts',()=>{
 for(const model of buildModels){let project=newGuidedProject(model.id);
  for(let i=0;i<model.pieces.length;i++){const eligible=availableSlots(project,null,true);assert.ok(eligible.length,`${model.id} stuck at ${i}`);const slot=eligible[0];project=fillSlot(project,slot.id,supplyKey(slot),true);assert.equal(buildProgress(project).completed,i+1);}
  assert.equal(buildProgress(project).remaining.length,0);assert.equal(availableSlots(project,null,true).length,0);assert.ok(modelSupplies(project).every(item=>item.remaining===0));
  assert.deepEqual(assertGuidedProject(parseProject(JSON.parse(JSON.stringify(project)))),project);
  project.pieces.splice(0,1);assert.equal(buildProgress(project).completed,model.pieces.length-1);assert.equal(availableSlots(project,null,true).length,1);
 }
});
check('Undo and redo restore guide mode, supply counts and original free project',()=>{
 const free=starter(),h=new History(free);h.commit(newGuidedProject('tree'));
 const slot=availableSlots(h.current,null,true)[0];h.commit(fillSlot(h.current,slot.id,supplyKey(slot),true));h.undo();assert.equal(buildProgress(h.current).completed,0);
 h.undo();assert.deepEqual(h.current,free);h.redo();h.redo();assert.equal(buildProgress(h.current).completed,1);
 const corrupt=clone(h.current);corrupt.pieces[0].position[0]+=8;assert.throws(()=>assertGuidedProject(parseProject(corrupt)));assert.equal(buildProgress(corrupt).completed,0);
 for(const guide of [null,false,{modelId:'unknown',version:1},{modelId:'tree',version:9}])assert.throws(()=>parseProject({...h.current,guide}));
});
check('Transparent targets are separate, pickable by layer, and removed when filled',()=>{
 const targets=new BuildTargets();let p=newGuidedProject('tree');const first=availableSlots(p,null,true)[0];targets.sync(p,supplyKey(first),true);
 const originalCount=targets.group.children.length;assert.equal(originalCount,buildModels.find(m=>m.id==='tree')!.pieces.length);
 targets.group.traverse(obj=>{if(obj instanceof Mesh){assert.equal(obj.castShadow,false);const mat=obj.material as MeshStandardMaterial;assert.equal(mat.transparent,true);assert.equal(mat.depthWrite,false);}});
 const ray=new Raycaster(new Vector3(4,150,4),new Vector3(0,-1,0));assert.equal(targets.pick(ray)?.slot.id,first.id);
 p=fillSlot(p,first.id,supplyKey(first),true);targets.sync(p,null,true);assert.equal(targets.group.children.find(o=>o.userData.slotId===first.id)!.visible,false);assert.notEqual(targets.pick(ray)?.slot.id,first.id);
 targets.sync(starter(),null,true);assert.equal(targets.group.children.length,0);targets.clear();
});
console.log(`${checks} guided-build checks passed`);
