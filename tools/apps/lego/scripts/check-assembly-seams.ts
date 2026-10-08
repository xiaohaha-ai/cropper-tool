import assert from 'node:assert/strict';
import {Box3,Group,Raycaster,Vector3} from 'three';
import {getPart} from '../src/catalog';
import {createPart,exportablePart,type PartModel} from '../src/parts';
import {buildModels,newGuidedProject} from '../src/build-models';
import {BuildTargets} from '../src/build-targets';
import type {Triple} from '../src/assembly';

const car=buildModels.find(m=>m.id==='car')!;
function assembly(flush:boolean){
 const group=new Group(),models:PartModel[]=[];
 for(const p of car.pieces){const m=createPart(getPart(p.partId),p.color,{assemblyFit:flush});m.group.position.fromArray(p.position);m.group.rotation.set(...p.rotation.map(n=>n*Math.PI/2) as Triple);group.add(m.group);models.push(m);}
 group.updateMatrixWorld(true);return {group,dispose:()=>models.forEach(m=>m.dispose())};
}
const original=assembly(false),fitted=assembly(true);
// Reproduce the supplied front-facing car screenshot. The two red body joins
// and blue cabin joins share an outer X face but meet across Z = +/-8 mm.
for(const [label,y]of [['red body',34],['blue cabin',47]] as const){
 for(const z of [-8,8])for(const offset of [-.025,0,.025]){
  const ray=new Raycaster(new Vector3(100,y,z+offset),new Vector3(-1,0,0));
  assert.equal(ray.intersectObject(original.group,true).length,0,`${label}: original gap should reproduce`);
  const hit=ray.intersectObject(fitted.group,true)[0];assert.ok(hit,`${label}: joint must not expose background`);
  assert.ok(Math.abs(hit.point.x-(y===34?44:28))<1e-5,`${label}: hit the exterior, not an internal tube`);
 }
}
original.dispose();fitted.dispose();
for(const id of ['brick-2x2','brick-1x10','plate-4x6','tile-2x2','baseplate-16x16']){
 const p=getPart(id),original=createPart(p),fitted=createPart(p,undefined,{assemblyFit:true});
 const before=new Box3().setFromObject(original.group).getSize(new Vector3()),after=new Box3().setFromObject(fitted.group).getSize(new Vector3());
 assert.ok(Math.abs(before.x-(p.columns*8-.2))<1e-4);assert.ok(Math.abs(after.x-p.columns*8)<1e-4);assert.ok(Math.abs(after.z-p.rows*8)<1e-4);assert.equal(before.y,after.y);
 assert.deepEqual(fitted.group.userData.connectors,original.group.userData.connectors);
 const first=original.group.getObjectByName('Top_studs'),second=fitted.group.getObjectByName('Top_studs');
 if(first&&second)assert.ok(new Box3().setFromObject(first).equals(new Box3().setFromObject(second)),'Stud positions and sizes must stay fixed');
 const exported=exportablePart(fitted.group),exportedSize=new Box3().setFromObject(exported).getSize(new Vector3());assert.ok(Math.abs(exportedSize.x-p.columns*.008)<1e-7);
 original.dispose();fitted.dispose();
}
for(const id of ['wheel-1x1-d24','axle-1x4','technic-1x4','slope-2x2']){
 const original=createPart(getPart(id)),fitted=createPart(getPart(id),undefined,{assemblyFit:true});
 assert.ok(new Box3().setFromObject(original.group).equals(new Box3().setFromObject(fitted.group)),`${id}: unrelated geometry changed`);original.dispose();fitted.dispose();
}
const targets=new BuildTargets();targets.sync(newGuidedProject('car'),null,false);
const part=car.pieces.find(p=>p.partId==='brick-1x10')!,target=targets.group.children.find(o=>o.userData.slotId===part.id)!;
assert.ok(Math.abs(new Box3().setFromObject(target).getSize(new Vector3()).x-80)<1e-5,'Ghost and solid use the same fitted shell');targets.clear();
console.log('PASS car body/cabin gap reproduction, flush exterior ray hits, exact grid dimensions, unchanged studs and mechanical parts, export scale, matching ghost geometry');
