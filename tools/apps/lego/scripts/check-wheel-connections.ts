import assert from 'node:assert/strict';
import {getPart} from '../src/catalog';
import {makePiece,worldConnectors,snapToAxle,axleFitsHole,collision,wheelStarter,bodyBounds,parseProject,History,clone,newProject,type Piece} from '../src/assembly';
const pose=(p:Piece,target:Piece,id:string)=>{const snap=snapToAxle(p,target,id);assert.ok(snap);return {...p,position:snap.position,rotation:snap.rotation};};
let combinations=0;
for(const diameter of [18,24,30,40])for(const rotation of [[0,0,0],[0,1,0],[1,1,0],[0,0,1]] as [number,number,number][]){
 const axle=makePiece('axle-1x8','#252c2f',[20,60,40]);axle.rotation=rotation;
 for(const end of worldConnectors(axle).filter(c=>c.type==='axle-end')){
  const wheel=pose(makePiece(`wheel-1x1-d${diameter}`,'#dfb021'),axle,end.id);
  assert.equal(axleFitsHole(wheel,axle),true);assert.equal(collision(wheel,[axle]),false);
  assert.equal(axleFitsHole({...wheel,position:wheel.position.map((v,i)=>v+(i===0?.6:i===1?.6:.6)) as [number,number,number]},axle),false);
  const duplicate={...clone(wheel),id:'duplicate'};assert.equal(collision(duplicate,[wheel,axle]),true);
  const obstruction=makePiece('brick-2x2','#bf2923',[...wheel.position]);assert.equal(collision(wheel,[axle,obstruction]),true);
  combinations++;
 }
}
const wheel=makePiece('wheel-1x1-d24','#245b9f',[0,0,0]);const hole=worldConnectors(wheel).find(c=>c.type==='axle-hole')!;
const rod=pose(makePiece('axle-1x4','#252c2f'),wheel,hole.id);assert.equal(collision(rod,[wheel]),false);
for(const id of ['technic-1x4','beam-1x7']){
 const support=makePiece(id,'#bf2923',[4,40,4]);support.rotation=[0,1,0];const hole=worldConnectors(support).find(c=>c.type==='pin-hole')!;
 const rod=pose(makePiece('axle-1x4','#252c2f'),support,hole.id);assert.equal(collision(rod,[support]),false);
 const wrong=clone(rod);wrong.rotation[1]=(wrong.rotation[1]+1)%4;assert.equal(axleFitsHole(wrong,support),false);
}
const floorAxle=makePiece('axle-1x4','#252c2f');const floorWheel=pose(makePiece('wheel-1x1-d24','#dfb021'),floorAxle,worldConnectors(floorAxle)[0].id);assert.ok(bodyBounds(floorWheel).min.y<0);
assert.equal(snapToAxle(wheel,makePiece('brick-2x4','#bf2923'),'stud-0'),null);
assert.equal(snapToAxle(makePiece('pin-1x2-friction','#bf2923'),wheel,hole.id),null);
const sample=wheelStarter();assert.equal(sample.pieces.length,4);for(const p of sample.pieces){assert.equal(collision(p,sample.pieces),false,p.partId);assert.ok(bodyBounds(p).min.y>=-.0001,p.partId);}
const saved=parseProject(JSON.parse(JSON.stringify(sample)));for(const p of saved.pieces)assert.equal(collision(p,saved.pieces),false);
const history=new History(newProject());history.commit(sample);history.undo();assert.equal(history.current.pieces.length,0);history.redo();assert.deepEqual(history.current,sample);
console.log(`PASS ${combinations} wheel poses, reciprocal insertion, rotated Technic/beam holes, other-part collisions, misalignment, ground clearance, save/restore, and undo.`);
