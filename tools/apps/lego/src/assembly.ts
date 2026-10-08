import {Box3, Euler, Matrix4, Quaternion, Vector3} from 'three';
import {getPart, type PartDefinition} from './catalog';
import {getConnectors,type ConnectorType} from './connectors';
import {buildModelIds,type BuildGuide} from './build-guide';
export type Triple=[number,number,number];
export interface Piece {id:string;partId:string;color:string;position:Triple;rotation:Triple}
export interface Project {schema:'brick-workshop';version:2;units:'mm';name:string;pieces:Piece[];guide?:BuildGuide}
export const MAX_PIECES=500;
export const clean=(v:number)=>Math.round(v*10000)/10000;
export const clone=<T>(value:T):T=>structuredClone(value);
export function newProject(name='未命名作品'):Project {return {schema:'brick-workshop',version:2,units:'mm',name,pieces:[]};}
export function makePiece(partId:string,color:string,position:Triple=[0,0,0]):Piece{return {id:crypto.randomUUID(),partId,color,position,rotation:[0,0,0]};}
export function matrix(piece:Piece){return new Matrix4().makeRotationFromEuler(new Euler(...piece.rotation.map(n=>n*Math.PI/2) as Triple,'XYZ')).setPosition(...piece.position);}
export function upright(piece:Piece){return piece.rotation[0]===0&&piece.rotation[2]===0;}
export function worldPoints(piece:Piece,type:'stud'|'socket'){const m=matrix(piece);return getConnectors(getPart(piece.partId)).filter(c=>c.type===type).map(c=>new Vector3(...c.position).applyMatrix4(m));}
// Body envelopes exclude studs so normal stacking is not a collision. Rounded,
// hollow and mechanical pieces use conservative envelopes; precision mode can bypass them.
export function bodyBounds(piece:Piece){
 const p=getPart(piece.partId);let x=p.columns*8-0.2,z=p.rows*8-0.2;
 if(p.kind==='wheel'||p.kind==='gear'){x=p.thickness!;z=p.height;}
 if(p.kind==='axle'||p.kind==='pin')z=p.height;
 return new Box3(new Vector3(-x/2,0,-z/2),new Vector3(x/2,p.height,z/2)).applyMatrix4(matrix(piece));
}
export function collision(piece:Piece,others:Piece[]):boolean{
 const box=bodyBounds(piece);box.expandByScalar(-0.06);
 return others.some(other=>other.id!==piece.id&&box.intersectsBox(bodyBounds(other).expandByScalar(-0.06))&&!axleFitsHole(piece,other));
}
export function gridPosition(part:PartDefinition,rotation:Triple,x:number,z:number,y=0):Triple{
 const temp:Piece={id:'preview',partId:part.id,color:'#ffffff',position:[0,0,0],rotation};
 const anchor=worldPoints(temp,'socket')[0]??new Vector3();
 return [clean(Math.round((x+anchor.x)/8)*8-anchor.x),clean(Math.max(0,y)),clean(Math.round((z+anchor.z)/8)*8-anchor.z)];
}
export function snapToTop(piece:Piece,target:Piece,x:number,z:number):Triple|null{
 if(!upright(piece)||!upright(target))return null;
 const studs=worldPoints(target,'stud');
 const sockets=worldPoints({...piece,position:[0,0,0]},'socket');
 let best:Triple|null=null,distance=Infinity;
 for(const stud of studs)for(const socket of sockets){const px=stud.x-socket.x,pz=stud.z-socket.z,d=(px-x)**2+(pz-z)**2;if(d<distance){distance=d;best=[clean(px),clean(stud.y-socket.y),clean(pz)];}}
 return distance<=8*8?best:null;
}
export function worldConnectors(piece:Piece){
 const transform=matrix(piece);return getConnectors(getPart(piece.partId)).map(c=>({...c,position:new Vector3(...c.position).applyMatrix4(transform),normal:new Vector3(...c.normal).transformDirection(transform)}));
}
export function axleCompatible(a:ConnectorType,b:ConnectorType){return a==='axle-end'&&(b==='axle-hole'||b==='pin-hole')||b==='axle-end'&&(a==='axle-hole'||a==='pin-hole');}
// Only a coaxial cross axle may occupy a receiver's actual through-hole. This is
// derived from canonical poses, so saves, moves and undo need no collision exemptions.
export function axleFitsHole(a:Piece,b:Piece):boolean{
 const rod=getPart(a.partId).kind==='axle'?a:getPart(b.partId).kind==='axle'?b:null;if(!rod)return false;
 const receiver=rod===a?b:a,ends=worldConnectors(rod).filter(c=>c.type==='axle-end');
 if(ends.length!==2)return false;
 const axis=ends[1].position.clone().sub(ends[0].position).normalize();
 return worldConnectors(receiver).some(hole=>{
  if(!axleCompatible('axle-end',hole.type)||Math.abs(axis.dot(hole.normal))<.9999||ends[0].radius>hole.radius)return false;
  const from=ends[0].position.clone().sub(hole.position),along=from.dot(hole.normal);
  if(from.addScaledVector(hole.normal,-along).length()>.025)return false;
  const to=ends[1].position.clone().sub(hole.position).dot(hole.normal),lo=Math.min(along,to),hi=Math.max(along,to);
  return Math.min(hi,0)-Math.max(lo,-hole.depth)>.05;
 });
}
const quarterRotations:Triple[]=[];
const seenRotations=new Set<string>();
for(let x=0;x<4;x++)for(let y=0;y<4;y++)for(let z=0;z<4;z++){
 const key=new Matrix4().makeRotationFromEuler(new Euler(x*Math.PI/2,y*Math.PI/2,z*Math.PI/2)).elements.map(n=>Math.round(n)).join(',');
 if(!seenRotations.has(key)){seenRotations.add(key);quarterRotations.push([x,y,z]);}
}
export interface AxleSnap {position:Triple;rotation:Triple;targetId:string;depth:number}
export function snapToAxle(piece:Piece,target:Piece,connectorId:string):AxleSnap|null{
 const targetPoint=worldConnectors(target).find(c=>c.id===connectorId);if(!targetPoint)return null;
 const sourcePoints=getConnectors(getPart(piece.partId)).filter(c=>axleCompatible(c.type,targetPoint.type));if(!sourcePoints.length)return null;
 const current=new Quaternion().setFromRotationMatrix(matrix(piece));let best:AxleSnap|null=null,bestScore=-Infinity;
 // Prefer the authored rotation when already aligned; automatic alignment otherwise
 // chooses the nearest of the 24 orientations on the build grid.
 for(const rotation of [piece.rotation,...quarterRotations]){
  const transform=matrix({...piece,position:[0,0,0],rotation});
  const score=Math.abs(current.dot(new Quaternion().setFromRotationMatrix(transform)));
  for(const source of sourcePoints){const normal=new Vector3(...source.normal).transformDirection(transform);if(normal.dot(targetPoint.normal)>-.9999)continue;
   const depth=Math.min(source.depth,targetPoint.depth,8),local=new Vector3(...source.position).applyMatrix4(transform);
   const position=targetPoint.position.clone().addScaledVector(targetPoint.normal,-depth).sub(local).toArray().map(clean) as Triple;
   if(score>bestScore+1e-8){bestScore=score;best={position,rotation:[...rotation],targetId:target.id,depth};}
  }
 }
 return best;
}
export function wheelStarter():Project{
 const project=newProject('轮轴连接示例');
 const support=makePiece('technic-1x4','#bf2923',[0,7.2,0]);project.pieces.push(support);
 const axle=makePiece('axle-1x4','#252c2f');
 const supportHole=worldConnectors(support).find(c=>c.type==='pin-hole'&&Math.abs(c.position.x)<.01)!;
 const axlePose=snapToAxle(axle,support,supportHole.id)!;axle.position=axlePose.position;axle.rotation=axlePose.rotation;
 // Centre the axle through the bearing, leaving equal exposed ends.
 axle.position=new Vector3(0,12,0).sub(new Vector3(0,getPart(axle.partId).height/2,0).applyMatrix4(matrix({...axle,position:[0,0,0]}))).toArray().map(clean) as Triple;
 project.pieces.push(axle);
 for(const end of worldConnectors(axle).filter(c=>c.type==='axle-end')){const wheel=makePiece('wheel-1x1-d24','#dfb021');const pose=snapToAxle(wheel,axle,end.id)!;wheel.position=pose.position;wheel.rotation=pose.rotation;project.pieces.push(wheel);}
 return project;
}
export function parseProject(value:unknown):Project{
 const obj=value as Partial<Project>|null;
 if(!obj||obj.schema!=='brick-workshop'||obj.version!==2||obj.units!=='mm'||typeof obj.name!=='string'||obj.name.length>80||!Array.isArray(obj.pieces)||obj.pieces.length>MAX_PIECES)throw new Error('文件不是有效的积木工坊作品，或超过 500 件上限。');
 const ids=new Set<string>();
 const pieces=obj.pieces.map((raw:unknown)=>{
  const p=raw as Piece;
  if(!p||typeof p.id!=='string'||!p.id.length||p.id.length>100||ids.has(p.id)||typeof p.partId!=='string'||typeof p.color!=='string'||!/^#[a-f\d]{6}$/i.test(p.color))throw new Error('零件身份或颜色数据无效。');
  try{getPart(p.partId);}catch{throw new Error(`无法识别零件：${p.partId.slice(0,80)}`);}
  if(!Array.isArray(p.position)||p.position.length!==3||!p.position.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=5000)||!Array.isArray(p.rotation)||p.rotation.length!==3||!p.rotation.every(n=>Number.isInteger(n)&&n>=0&&n<4))throw new Error('零件坐标或旋转数据无效。');
  ids.add(p.id);return {id:p.id,partId:p.partId,color:p.color,position:[...p.position] as Triple,rotation:[...p.rotation] as Triple};
 });
 if(obj.guide!==undefined&&(!obj.guide||typeof obj.guide!=='object'||!buildModelIds.includes(obj.guide.modelId)||obj.guide.version!==1))throw new Error('模型拼搭版本或模型名称无效。');
 return {schema:'brick-workshop',version:2,units:'mm',name:obj.name,pieces,...(obj.guide?{guide:{modelId:obj.guide.modelId,version:1 as const}}:{})};
}
export class History {
 current:Project;past:Project[]=[];future:Project[]=[];
 constructor(project:Project){this.current=parseProject(project);}
 commit(next:Project){const checked=parseProject(next);if(JSON.stringify(checked)===JSON.stringify(this.current))return false;this.past.push(clone(this.current));if(this.past.length>60)this.past.shift();this.current=checked;this.future=[];return true;}
 undo(){if(!this.past.length)return false;this.future.push(this.current);this.current=this.past.pop()!;return true;}
 redo(){if(!this.future.length)return false;this.past.push(this.current);this.current=this.future.pop()!;return true;}
}
export function starter():Project{
 const project=newProject('彩虹门 · 我的第一件作品');
 const add=(id:string,color:string,pos:Triple)=>project.pieces.push(makePiece(id,color,pos));
 add('baseplate-16x16','#256b50',[4,0,4]);
 for(let level=0;level<4;level++)for(const x of [-28,36])add('brick-2x2',['#245b9f','#eee8d9','#dfb021','#bf2923'][level],[x,3.2+level*9.6,4]);
 add('brick-2x10','#bf2923',[4,41.6,4]);
 add('plate-2x12','#dfb021',[4,51.2,4]);
 for(const x of [-28,36]){add('slope-2x2','#245b9f',[x,54.4,4]);if(x>0)project.pieces.at(-1)!.rotation=[0,2,0];}
 for(const z of [28,44])for(const x of [-20,-4,12,28])add('tile-2x2','#eee8d9',[x,3.2,z]);
 return project;
}
