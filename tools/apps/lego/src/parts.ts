import * as THREE from 'three';
import type { PartDefinition } from './catalog';
import { getConnectors, studPositions, unitSystem } from './connectors';

export interface PartModel {group:THREE.Group;material:THREE.MeshPhysicalMaterial;definition:PartDefinition;dispose:()=>void;}
export interface PartOptions {assemblyFit?:boolean}
const SEGMENTS=32;
function roundRect(width:number,height:number,r=0.16):THREE.Shape {
  const p=new THREE.Shape(),x=-width/2,y=-height/2;
  p.moveTo(x+r,y);p.lineTo(x+width-r,y);p.quadraticCurveTo(x+width,y,x+width,y+r);
  p.lineTo(x+width,y+height-r);p.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
  p.lineTo(x+r,y+height);p.quadraticCurveTo(x,y+height,x,y+height-r);p.lineTo(x,y+r);p.quadraticCurveTo(x,y,x+r,y);
  return p;
}
function polygon(points:[number,number][]) {const p=new THREE.Shape();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();return p;}
function extrude(shape:THREE.Shape,depth:number) {return new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:16,steps:1});}
function flat(shape:THREE.Shape,height:number) {const geometry=extrude(shape,height);geometry.rotateX(-Math.PI/2);return geometry;}
function ring(outer:number,inner:number,height:number) {
  return new THREE.LatheGeometry([[inner,0],[outer,0],[outer,height],[inner,height],[inner,0]].map(([x,y])=>new THREE.Vector2(x,y)),SEGMENTS);
}
function crossPath(size=2.35,arm=0.9):THREE.Shape {
  return polygon([[-arm,-size],[arm,-size],[arm,-arm],[size,-arm],[size,arm],[arm,arm],[arm,size],[-arm,size],[-arm,arm],[-size,arm],[-size,-arm],[-arm,-arm]]);
}
function circularShape(radius:number) {const s=new THREE.Shape();s.absarc(0,0,radius,0,Math.PI*2,false);return s;}
function studGeometry(){return new THREE.LatheGeometry([[0,0],[2.34,0],[2.4,0.06],[2.4,1.68],[2.37,1.76],[2.31,1.8],[0,1.8]].map(([x,y])=>new THREE.Vector2(x,y)),SEGMENTS);}

export function createPart(definition:PartDefinition,color='#bf2923',options:PartOptions={}):PartModel {
  // A display fit for rectangular shells on the workshop's exact 8 mm grid.
  // Do not scale the group: that would also move studs, sockets and axle holes.
  // The standalone parts library retains its original manufacturing-like gap.
  const p=definition,flush=!!options.assemblyFit&&['brick','plate','tile','baseplate'].includes(p.kind);
  const clearance=flush?0:0.2,L=p.columns*8-clearance,W=p.rows*8-clearance,H=p.height;
  const group=new THREE.Group();group.name=p.id;
  group.userData={partId:p.id,name:p.name,category:p.category,units:'millimetres',coordinateSystem:unitSystem,connectors:getConnectors(p),assemblyReady:'logical-connectors-v1',geometryFidelity:p.kind==='gear'?'simplified-teeth':'display-model'};
  const material=new THREE.MeshPhysicalMaterial({color,roughness:0.32,metalness:0,clearcoat:0.2,clearcoatRoughness:0.28});
  const extraMaterials:THREE.Material[]=[];
  function add(geo:THREE.BufferGeometry,name:string,x=0,y=0,z=0,mat:THREE.Material=material) {
    const mesh=new THREE.Mesh(geo,mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
  }
  function box(x:number,y:number,z:number,name:string,px=0,py=0,pz=0){return add(new THREE.BoxGeometry(x,y,z),name,px,py,pz);}
  function tubes() {
    if(p.columns>1&&p.rows>1){
      const geo=ring(3.23,2.4,H-1.2);
      const placements:THREE.Vector3[]=[];
      for(let x=0;x<p.columns-1;x++)for(let z=0;z<p.rows-1;z++)placements.push(new THREE.Vector3((x-(p.columns-2)/2)*8,0,(z-(p.rows-2)/2)*8));
      repeated(geo,placements,'Anti_stud_tubes');
    }else if(p.columns>1){
      const geo=new THREE.CylinderGeometry(1.55,1.55,H-1.2,24);
      const placements=Array.from({length:p.columns-1},(_,i)=>new THREE.Vector3((i-(p.columns-2)/2)*8,(H-1.2)/2,0));
      repeated(geo,placements,'Underside_posts');
    }
  }
  function repeated(geo:THREE.BufferGeometry,positions:THREE.Vector3[],name:string){
    if(!positions.length){geo.dispose();return;}
    const mesh=new THREE.InstancedMesh(geo,material,positions.length);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
    positions.forEach((pos,i)=>mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(pos.x,pos.y,pos.z)));
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);
  }
  if(['brick','plate','tile','baseplate'].includes(p.kind)) {
    // Rounded exterior corners would still leave a see-through notch even at
    // nominal width. Only the assembled outer outline uses square corners.
    const outline=()=>flush?polygon([[-L/2,-W/2],[L/2,-W/2],[L/2,W/2],[-L/2,W/2]]):roundRect(L,W);
    const shell=outline();shell.holes.push(roundRect(L-2.6,W-2.6,0.12));
    add(flat(shell,H-1.2),'Hollow_body');add(flat(outline(),1.2),'Top_skin',0,H-1.2);tubes();
  }else if(p.kind==='corner') {
    const offset=(pts:[number,number][])=>pts.map(([x,z])=>[x-L/2,z-W/2] as [number,number]);
    // XY shape is rotated onto XZ; mirror Z to match the footprint coordinates.
    const outline=(t:number)=>polygon(offset([[t,t],[L-t,t],[L-t,7.8-t],[7.8-t,7.8-t],[7.8-t,W-t],[t,W-t]]).map(([x,z])=>[x,-z]));
    const shell=outline(0);shell.holes.push(outline(1.2));add(flat(shell,H-1.2),'L_hollow_body');add(flat(outline(0),1.2),'L_top_skin',0,H-1.2);
  }else if(p.kind==='slope') {
    const left=-L/2,right=L/2,landing=p.variant==='cheese'?left:left+7.8,low=2.4;
    const profile=polygon([[left,0],[right,0],[right,low],[landing,H],[left,H]]);
    add(extrude(profile,1.2),'Slope_side_front',0,0,-W/2);add(extrude(profile,1.2),'Slope_side_back',0,0,W/2-1.2);
    const cap=polygon([[left,H-0.8],[landing,H-0.8],[right,low-0.8],[right,low],[landing,H],[left,H]]);
    add(extrude(cap,W-2.4),'Sloped_roof',0,0,-W/2+1.2);
    box(1.2,H-0.8,W-2.4,'High_end_wall',left+0.6,(H-0.8)/2);box(1.2,low-0.8,W-2.4,'Low_end_wall',right-0.6,(low-0.8)/2);
  }else if(p.kind==='round'||p.kind==='cone') {
    const r=p.columns*4-0.1;
    if(p.kind==='round'){
      add(ring(r,r-1.25,H-1.2),'Round_shell');add(flat(circularShape(r),1.2),'Round_top',0,H-1.2);
      if(p.columns>1)add(ring(3.23,2.4,H-1.2),'Centre_anti_stud_tube');
    }else{
      const top=Math.max(1.6,r*0.28);
      add(new THREE.LatheGeometry([[r-1.25,0],[r,0],[top,H],[0,H],[0,H-1.2],[Math.max(0.5,top-1),H-1.2],[r-1.25,0]].map(([x,y])=>new THREE.Vector2(x,y)),48),'Hollow_cone');
    }
  }else if(p.kind==='technic') {
    const wall=roundRect(L,H),n=p.columns-1;
    for(let i=0;i<n;i++){const hole=new THREE.Path();hole.absarc((i-(n-1)/2)*8,0,2.4,0,Math.PI*2,true);wall.holes.push(hole);}
    add(extrude(wall,1.2),'Perforated_front_wall',0,H/2,-3.9);add(extrude(wall,1.2),'Perforated_back_wall',0,H/2,2.7);
    box(1.2,H,5.4,'End_wall_left',-L/2+0.6,H/2);box(1.2,H,5.4,'End_wall_right',L/2-0.6,H/2);box(L-2.4,1.2,5.4,'Top_skin',0,H-0.6);
    const sleeve=ring(3.2,2.4,5.4);sleeve.rotateX(-Math.PI/2);
    for(let i=0;i<n;i++)add(sleeve,`Through_hole_sleeve_${i}`,(i-(n-1)/2)*8,H/2,2.7);
  }else if(p.kind==='beam') {
    const shape=roundRect(L,7.8,3.9);
    for(let i=0;i<p.columns;i++){const hole=new THREE.Path();hole.absarc((i-(p.columns-1)/2)*8,0,2.4,0,Math.PI*2,true);shape.holes.push(hole);}
    add(extrude(shape,7.8),'Rounded_beam',0,3.9,-3.9);
  }else if(p.kind==='axle') {
    const geometry=extrude(crossPath(),L);geometry.rotateY(Math.PI/2);add(geometry,'Cross_axle',-L/2,H/2);
  }else if(p.kind==='pin') {
    const geometry=ring(2.35,1.35,L);geometry.rotateZ(-Math.PI/2);add(geometry,'Hollow_pin',-L/2,H/2);
    const collar=ring(2.8,1.35,0.8);collar.rotateZ(-Math.PI/2);add(collar,'Centre_stop',-0.4,H/2);
    if(p.variant==='friction')for(const sign of [-1,1]){const rib=ring(2.42,1.35,0.55);rib.rotateZ(-Math.PI/2);add(rib,`Friction_ring_${sign}`,sign*(L/2-2)-0.275,H/2);}
  }else if(p.kind==='gear') {
    const teeth=p.teeth!,root=teeth/2-1.1,tip=teeth/2+1,points:[number,number][]=[];
    for(let i=0;i<teeth;i++)for(const [phase,r]of [[0,root],[0.22,tip],[0.58,tip],[0.8,root]]){const angle=(i+phase)/teeth*Math.PI*2;points.push([Math.cos(angle)*r,Math.sin(angle)*r]);}
    const shape=polygon(points);shape.holes.push(crossPath(2.4,0.95));const geometry=extrude(shape,p.thickness!);geometry.rotateY(Math.PI/2);add(geometry,'Simplified_spur_gear',-p.thickness!/2,H/2);
  }else if(p.kind==='wheel') {
    const r=p.diameter!/2,w=p.thickness!,inner=r*0.54;
    const tyreMaterial=new THREE.MeshStandardMaterial({color:'#25292a',roughness:0.86});extraMaterials.push(tyreMaterial);
    const profile:[[number,number],...[number,number][]]=[[inner,-w/2],[r*0.86,-w/2],[r*0.97,-w/2+1],[r,-w/2+2],[r,-w*0.18-0.35],[r-0.55,-w*0.18],[r,-w*0.18+0.35],[r,w*0.18-0.35],[r-0.55,w*0.18],[r,w*0.18+0.35],[r,w/2-2],[r*0.97,w/2-1],[r*0.86,w/2],[inner,w/2],[inner,-w/2]];
    const tire=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x,y)),64);tire.rotateZ(-Math.PI/2);add(tire,'Rubber_tyre',0,r,0,tyreMaterial);
    const hub=circularShape(inner+0.05);hub.holes.push(crossPath(2.4,0.95));
    const geo=extrude(hub,w);geo.rotateY(Math.PI/2);add(geo,'Cross_hole_hub',-w/2,r);
    const lip=ring(inner,inner-0.8,0.5);lip.rotateZ(-Math.PI/2);for(const sign of [-1,1])add(lip,`Rim_lip_${sign}`,sign*(w/2-0.6),r);
  }
  repeated(studGeometry(),studPositions(p).map(([x,z])=>new THREE.Vector3(x,H,z)),'Top_studs');
  const usedGeometries=new Set<THREE.BufferGeometry>();group.traverse(object=>{if(object instanceof THREE.Mesh)usedGeometries.add(object.geometry);});usedGeometries.forEach(geometry=>geometry.normalizeNormals());
  group.updateMatrixWorld(true);
  return {group,material,definition:p,dispose(){const geometries=new Set<THREE.BufferGeometry>();group.traverse(obj=>{if(obj instanceof THREE.Mesh)geometries.add(obj.geometry);});geometries.forEach(g=>g.dispose());material.dispose();extraMaterials.forEach(m=>m.dispose());}};
}

// Export regular glTF meshes for importers without GPU instancing support.
export function exportablePart(source:THREE.Group) {
  const root=new THREE.Group();root.name=source.name;root.userData={...source.userData,sourceUnits:'millimetres',units:'metres',connectorCoordinateUnits:'millimetres',coordinateSystem:unitSystem};root.scale.setScalar(0.001);
  source.children.forEach(child=>{
    if(child instanceof THREE.InstancedMesh){const holder=new THREE.Group();holder.name=child.name;for(let i=0;i<child.count;i++){const mesh=new THREE.Mesh(child.geometry,child.material);const matrix=new THREE.Matrix4();child.getMatrixAt(i,matrix);matrix.decompose(mesh.position,mesh.quaternion,mesh.scale);mesh.name=`${child.name}_${i+1}`;holder.add(mesh);}root.add(holder);}
    else root.add(child.clone(true));
  });
  return root;
}
