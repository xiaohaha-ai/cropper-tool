import assert from 'node:assert/strict';
import {getPart,parts} from '../src/catalog';
import {History,clone,newProject,makePiece,parseProject,starter,gridPosition,snapToTop,worldPoints,collision,bodyBounds,type Triple} from '../src/assembly';
import {createPart,exportablePart} from '../src/parts';
import {Box3,Group,Vector3} from 'three';
let checks=0;
function check(name:string,fn:()=>void){fn();checks++;console.log(`PASS ${name}`);}
check('Odd/even footprint rotations stay on stud lattice',()=>{
 for(const id of ['brick-1x1','brick-1x2','brick-2x3','brick-2x4','plate-4x6'])for(let turn=0;turn<4;turn++){
 const p=makePiece(id,'#bf2923');p.rotation=[0,turn,0];p.position=gridPosition(getPart(id),p.rotation,17,-11);for(const c of worldPoints(p,'socket')){assert.ok(Math.abs(c.x/8-Math.round(c.x/8))<1e-6);assert.ok(Math.abs(c.z/8-Math.round(c.z/8))<1e-6);}}
});
check('Stacking places sockets on studs, excluding stud height',()=>{
 const base=makePiece('brick-2x4','#bf2923',[4,9.6,4]),upper=makePiece('brick-1x1','#eeeeee');upper.position=snapToTop(upper,base,0,0)!;assert.equal(upper.position[1],19.2);assert.equal(collision(upper,[base]),false);assert.ok(worldPoints(base,'stud').some(p=>p.distanceTo(worldPoints(upper,'socket')[0])<1e-6));
 base.rotation=[0,1,0];assert.ok(snapToTop(upper,base,0,0));base.rotation=[1,0,0];assert.equal(snapToTop(upper,base,0,0),null);
 assert.equal(snapToTop(upper,makePiece('tile-2x2','#eeeeee'),0,0),null);
});
check('Overlap detection, own-instance exclusion, side-by-side clearance',()=>{
 const p=makePiece('brick-2x2','#bf2923',[4,0,4]);assert.equal(collision(p,[p]),false);const q={...clone(p),id:'other'};assert.equal(collision(q,[p]),true);q.position[0]+=16;assert.equal(collision(q,[p]),false);q.position=[4,9.6,4];assert.equal(collision(q,[p]),false);
});
check('Sample has no overlapping body envelopes',()=>{const project=starter();assert.equal(project.pieces.length,21);project.pieces.forEach(p=>assert.equal(collision(p,project.pieces),false,p.partId));});
check('All 137 envelope dimensions are finite in every principal turn',()=>{for(const p of parts)for(let axis=0;axis<3;axis++)for(let turn=0;turn<4;turn++){const piece=makePiece(p.id,'#abcdef');piece.rotation[axis]=turn;const box=bodyBounds(piece);assert.ok([...box.min.toArray(),...box.max.toArray()].every(Number.isFinite));}});
check('History owns snapshots; undo/redo restores color, position and rotation',()=>{
 const h=new History(newProject()),first=clone(h.current),p=makePiece('brick-2x4','#bf2923',[4,0,4]);first.pieces.push(p);h.commit(first);p.position[0]=999;assert.equal(h.current.pieces[0].position[0],4);
 const edited=clone(h.current);edited.pieces[0].color='#245b9f';edited.pieces[0].position=[36,3.2,20];edited.pieces[0].rotation=[0,1,0];h.commit(edited);h.undo();assert.equal(h.current.pieces[0].color,'#bf2923');h.redo();assert.deepEqual(h.current,edited);
 h.commit(newProject());h.undo();assert.deepEqual(h.current,edited);h.undo();const branch=clone(h.current);branch.name='分支';h.commit(branch);assert.equal(h.future.length,0);
});
check('Invalid imports never change document; duplicates, bad values and limits rejected',()=>{
 const h=new History(starter()),before=clone(h.current);for(const mutate of [(p:any)=>p.version=999,(p:any)=>p.pieces.push(p.pieces[0]),(p:any)=>p.pieces[0].position[0]=NaN,(p:any)=>p.pieces[0].rotation=[0,1.5,0],(p:any)=>p.pieces[0].partId='unknown',(p:any)=>p.pieces[0].color='<script>',(p:any)=>p.pieces=Array(501).fill(p.pieces[0])]){const bad=clone(before);mutate(bad);assert.throws(()=>h.commit(bad));assert.deepEqual(h.current,before);}assert.deepEqual(parseProject(JSON.parse(JSON.stringify(before))),before);
});
check('Assembly exporter transforms and units preserve mm-to-m conversion',()=>{
 const p=makePiece('brick-2x4','#245b9f',[100,19.2,-40]);p.rotation=[0,1,0];const model=createPart(getPart(p.partId),p.color),part=exportablePart(model.group);part.scale.setScalar(1);part.position.fromArray(p.position);part.rotation.set(...p.rotation.map(v=>v*Math.PI/2) as Triple);const root=new Group();root.scale.setScalar(.001);root.add(part);const b=new Box3().setFromObject(root);const size=b.getSize(new Vector3());assert.ok(Math.abs(size.x-.0158)<1e-7);assert.ok(Math.abs(size.z-.0318)<1e-7);assert.ok(Math.abs(b.min.y-.0192)<1e-7);model.dispose();
});
console.log(`${checks} assembly checks passed`);
