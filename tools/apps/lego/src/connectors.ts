import type { PartDefinition } from './catalog';
export type Point3=[number,number,number];
export type ConnectorType='stud'|'socket'|'pin-hole'|'pin-end'|'axle-hole'|'axle-end';
export interface Connector {id:string;type:ConnectorType;position:Point3;normal:Point3;radius:number;depth:number;profile:'circular'|'cross';}
export const unitSystem={unit:'millimetres',up:'+Y',lengthAxis:'X',widthAxis:'Z',grid:8,plateHeight:3.2,brickHeight:9.6,origin:'footprint centre at bottom plane',version:1};
export function footprint(part:PartDefinition):[number,number][] {
  const cells:[number,number][]=[];
  for(let z=0;z<part.rows;z++)for(let x=0;x<part.columns;x++){
    if(part.kind==='corner'&&x>0&&z>0)continue;
    const px=(x-(part.columns-1)/2)*8,pz=(z-(part.rows-1)/2)*8;
    if((part.kind==='round'||part.kind==='cone')&&Math.hypot(px,pz)+2.4>part.columns*4+0.2)continue;
    cells.push([px,pz]);
  }
  return cells;
}
export function studPositions(part:PartDefinition):[number,number][] {
  if(['tile','beam','axle','pin','gear','wheel'].includes(part.kind)||part.variant==='tile'||part.kind==='cone'||part.variant==='cheese')return [];
  const cells=footprint(part);
  if(part.kind==='slope')return cells.filter(([x])=>Math.abs(x+(part.columns-1)*4)<0.01);
  return cells;
}
export function getConnectors(part:PartDefinition):Connector[] {
  const points:Connector[]=[];
  const push=(type:ConnectorType,position:Point3,normal:Point3,radius=2.4,depth=1.8,profile:'circular'|'cross'='circular')=>points.push({id:`${type}-${points.length}`,type,position,normal,radius,depth,profile});
  for(const [x,z]of studPositions(part))push('stud',[x,part.height,z],[0,1,0]);
  if(['brick','plate','tile','slope','round','corner','technic','baseplate'].includes(part.kind))for(const [x,z]of footprint(part))push('socket',[x,0,z],[0,-1,0]);
  if(part.kind==='cone'){
    // Cone bottom is an open circular cavity; use one centred logical socket.
    push('socket',[0,0,0],[0,-1,0]);
  }
  if(part.kind==='technic'||part.kind==='beam') {
    const n=part.kind==='technic'?part.columns-1:part.columns;
    for(let i=0;i<n;i++)for(const sign of [-1,1])push('pin-hole',[(i-(n-1)/2)*8,part.height/2,sign*3.9],[0,0,sign],2.4,7.8);
  }
  if(part.kind==='axle'||part.kind==='pin')for(const sign of [-1,1])push(part.kind==='axle'?'axle-end':'pin-end',[sign*(part.columns*8-0.2)/2,part.height/2,0],[sign,0,0],2.35,8,part.kind==='axle'?'cross':'circular');
  if(part.kind==='gear'||part.kind==='wheel')for(const sign of [-1,1])push('axle-hole',[sign*part.thickness!/2,part.height/2,0],[sign,0,0],2.4,part.thickness!,'cross');
  return points;
}
// Logical connection families for the later assembly editor, not a physics solver.
export function compatible(a:ConnectorType,b:ConnectorType) {
  return ['stud:socket','socket:stud','pin-end:pin-hole','pin-hole:pin-end','axle-end:axle-hole','axle-hole:axle-end'].includes(`${a}:${b}`);
}
