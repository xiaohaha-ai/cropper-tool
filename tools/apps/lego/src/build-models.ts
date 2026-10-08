import {clone, clean, newProject, wheelStarter, type Piece, type Project, type Triple} from './assembly';

import type {BuildModelId} from './build-guide';
export interface BuildModel {id:BuildModelId;name:string;description:string;difficulty:string;pieces:Piece[]}
const red='#bf2923',yellow='#dfb021',blue='#245b9f',green='#256b50',orange='#c36a35',white='#eee8d9',grey='#646b6c',black='#252c2f';
type Add=(partId:string,color:string,position:Triple,rotation?:Triple)=>void;
function model(id:BuildModelId,name:string,description:string,difficulty:string,build:(add:Add)=>void):BuildModel {
 const pieces:Piece[]=[];
 build((partId,color,position,rotation=[0,0,0])=>pieces.push({id:`${id}-${pieces.length+1}`,partId,color,position:position.map(clean) as Triple,rotation}));
 return {id,name,description,difficulty,pieces};
}

// Model coordinates share the editor's millimetre/stud convention. IDs and
// poses are versioned: saved guide documents contain these exact slot IDs.
export const buildModels:BuildModel[]=[
 model('cottage','林间小屋','奶油色墙面、双坡屋顶与门前小径。','入门',add=>{
  add('baseplate-16x16',green,[4,0,4]);
  for(let level=0;level<3;level++){
   const y=3.2+level*9.6;
   for(const x of [-12,20])add('brick-2x4',white,[x,y,-12]);
   for(const x of [-20,28]){add('brick-2x2',level===1?blue:white,[x,y,4]);if(level<2)add('brick-2x2',white,[x,y,20]);}
   if(level===2)add('brick-2x8',white,[4,y,20]);
  }
  add('plate-6x8',white,[4,32,4]);
  for(const z of [-12,4,20])for(const x of [-20,28])add('slope-2x4-long',red,[x,35.2,z],[0,x<4?2:0,0]);
  for(const z of [-12,4,20])add('brick-2x2',red,[4,35.2,z]);
  add('brick-1x2',grey,[4,44.8,-16]);
  for(const z of [36,52])add('tile-2x4',white,[4,3.2,z]);
 }),
 model('tree','庭院小树','从树干到树冠，练习逐层填入。','入门',add=>{
  add('plate-8x8',green,[4,0,4]);
  for(let y=0;y<3;y++)add('brick-2x2',orange,[4,3.2+y*9.6,4]);
  add('plate-4x8',green,[4,32,4]);
  for(const x of [-20,-4,12,28])for(const z of [-4,12])add('brick-2x2',green,[x,35.2,z]);
  add('plate-4x6',green,[4,44.8,4]);
  for(const x of [-12,4,20])add('brick-2x2',green,[x,48,4]);
  for(const x of [0,8])for(const z of [0,8])add('round-1x1-cone',green,[x,57.6,z]);
  for(const x of [-24,32])add('round-1x1-cone',red,[x,3.2,24]);
 }),
 model('car','城市小车','底盘、四轮、车身与双色车顶。','进阶',add=>{
  // Reuse the editor's tested axle/receiver poses instead of guessing wheels.
  for(const x of [-24,24])for(const p of wheelStarter().pieces)add(p.partId,p.color,[p.position[0]+x+4,p.position[1],p.position[2]+4],p.rotation);
  for(const y of [16.8,20,23.2])add('plate-1x10',grey,[4,y,4]);
  add('plate-4x10',red,[4,26.4,0]);
  for(const x of [-28,36])add('brick-2x2',red,[x,29.6,0]);
  for(const z of [-12,12])add('brick-1x10',red,[4,29.6,z]);
  add('plate-4x6',white,[4,39.2,0]);
  for(const x of [-12,20])add('brick-2x2',blue,[x,42.4,0]);
  for(const z of [-12,12])add('brick-1x6',blue,[4,42.4,z]);
  add('plate-4x6',white,[4,52,0]);
  for(const z of [-4,4])add('round-1x1-tile',yellow,[40,39.2,z]);
 }),
 model('robot','小小机器人','对称身体、伸展手臂和表情面板。','入门',add=>{
  add('plate-6x8',green,[4,0,4]);
  for(const x of [-12,20]){
   add('brick-2x4',black,[x,3.2,12],[0,1,0]);
   for(const y of [12.8,22.4])add('brick-2x2',blue,[x,y,4]);
  }
  add('plate-4x6',yellow,[4,32,4]);
  for(const y of [35.2,44.8])for(const z of [-4,12])add('brick-2x6',blue,[4,y,z]);
  add('plate-2x10',white,[4,54.4,4]);
  for(const x of [-28,36])add('brick-2x2',yellow,[x,57.6,4]);
  add('brick-2x2',grey,[4,57.6,4]);
  add('plate-4x6',white,[4,67.2,4]);
  add('brick-2x6',white,[4,70.4,-4]);
  for(const x of [-12,4,20])add('brick-2x2',x===4?yellow:black,[x,70.4,12]);
  add('plate-4x6',white,[4,80,4]);
  add('round-1x1-cone',red,[0,83.2,0]);
 }),
 model('castle','花园城堡','双塔、门洞与城墙，拼成一座小城堡。','进阶',add=>{
  add('baseplate-16x16',green,[4,0,4]);
  for(let layer=0;layer<3;layer++){
   const y=3.2+layer*9.6;
   for(const x of [-28,36])for(const z of [-20,28])add('brick-2x2',white,[x,y,z]);
   add('brick-2x6',white,[4,y,-20]);
   for(const x of [-28,36])add('brick-2x4',white,[x,y,4],[0,1,0]);
  }
  add('brick-2x10',white,[4,32,28]);
  for(const x of [-28,36]){
   add('brick-2x2',white,[x,32,-20]);
   for(const z of [-20,28]){add('brick-2x2',grey,[x,41.6,z]);for(const dx of [-4,4])for(const dz of [-4,4])add('round-1x1-cone',red,[x+dx,51.2,z+dz]);}
  }
  for(const x of [-16,0,16])add('brick-1x1',yellow,[x,41.6,24]);
  for(const z of [44,60])add('tile-2x4',white,[4,3.2,z]);
 }),
];

export function getBuildModel(id:string){const value=buildModels.find(m=>m.id===id);if(!value)throw new Error('无法识别这个拼搭模型。');return value;}
export function newGuidedProject(id:string):Project {const m=getBuildModel(id);return {...newProject(`${m.name} · 模型拼搭`),guide:{modelId:m.id,version:1}};}
export const supplyKey=(p:Pick<Piece,'partId'|'color'>)=>`${p.partId}|${p.color.toLowerCase()}`;
function sameSlot(a:Piece,b:Piece){return a.id===b.id&&supplyKey(a)===supplyKey(b)&&a.position.every((v,i)=>Math.abs(v-b.position[i])<.0001)&&a.rotation.every((v,i)=>v===b.rotation[i]);}
export function assertGuidedProject(project:Project){
 if(!project.guide)return project;
 const model=getBuildModel(project.guide.modelId);
 if(project.guide.version!==1||project.pieces.some(p=>!model.pieces.some(t=>sameSlot(p,t))))throw new Error('模型拼搭存档中的零件与目标不一致，原作品未改变。');
 return project;
}
export function buildProgress(project:Project){
 const model=getBuildModel(project.guide!.modelId),placed=new Set(project.pieces.filter(p=>model.pieces.some(t=>sameSlot(p,t))).map(p=>p.id));
 const remaining=model.pieces.filter(p=>!placed.has(p.id));
 const levels=[...new Set(model.pieces.map(p=>p.position[1]))].sort((a,b)=>a-b),height=remaining.length?Math.min(...remaining.map(p=>p.position[1])):null;
 return {model,placed,remaining,height,level:height===null?levels.length:levels.indexOf(height)+1,levels:levels.length,total:model.pieces.length,completed:placed.size};
}
export function availableSlots(project:Project,key:string|null,layered:boolean){const state=buildProgress(project);return state.remaining.filter(p=>(!key||supplyKey(p)===key)&&(!layered||p.position[1]===state.height));}
export function fillSlot(project:Project,slotId:string,key:string|null,layered:boolean):Project {
 assertGuidedProject(project);
 const target=buildProgress(project).remaining.find(p=>p.id===slotId);
 if(!target)throw new Error('这个位置已填入积木。');
 if(!key||supplyKey(target)!==key)throw new Error('零件规格或颜色不匹配，请从零件盒选择对应零件。');
 if(!availableSlots(project,key,layered).some(p=>p.id===slotId))throw new Error('请先完成当前层，或关闭分层拼搭。');
 const next=clone(project);next.pieces.push(clone(target));return next;
}
export function modelSupplies(project:Project){
 const state=buildProgress(project),items=new Map<string,{key:string;partId:string;color:string;total:number;remaining:number}>();
 for(const p of state.model.pieces){const key=supplyKey(p),item=items.get(key)??{key,partId:p.partId,color:p.color,total:0,remaining:0};item.total++;if(!state.placed.has(p.id))item.remaining++;items.set(key,item);}
 return [...items.values()];
}
