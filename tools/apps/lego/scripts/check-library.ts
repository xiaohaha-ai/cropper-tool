import assert from 'node:assert/strict';
import * as THREE from 'three';
import {parts,categories,searchParts,getPart} from '../src/catalog.ts';
import {createPart,exportablePart} from '../src/parts.ts';
import {compatible,getConnectors,footprint} from '../src/connectors.ts';

assert.equal(new Set(parts.map(p=>p.id)).size,parts.length,'Part IDs must be stable and unique');
assert.equal(parts.length,137);
assert.equal(categories.length,13);
assert(searchParts('2 x 4').some(p=>p.id==='brick-2x4'));
assert.equal(searchParts('齿轮').length,6);
assert.equal(searchParts('not-a-part').length,0);
assert(searchParts('','beam').every(p=>p.kind==='beam'));
let geometryCount=0,connectorCount=0;
for(const part of parts){
  const model=createPart(part),bounds=new THREE.Box3().setFromObject(model.group);
  assert(!bounds.isEmpty()&&[...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite),`${part.id}: finite bounds`);
  assert(bounds.min.y>-0.02,`${part.id}: model above bottom origin`);
  const geometries=new Set<THREE.BufferGeometry>();model.group.traverse(obj=>{if(obj instanceof THREE.Mesh)geometries.add(obj.geometry);});
  for(const geometry of geometries){assert(Array.from(geometry.attributes.position.array).every(Number.isFinite),`${part.id}: finite vertices`);geometryCount++;}
  const connectors=getConnectors(part);connectorCount+=connectors.length;
  assert.equal(new Set(connectors.map(c=>c.id)).size,connectors.length);
  connectors.forEach(c=>{assert(Math.abs(new THREE.Vector3(...c.normal).length()-1)<1e-6);assert(bounds.clone().expandByScalar(0.2).containsPoint(new THREE.Vector3(...c.position)),`${part.id}: anchor ${c.id} lies on model`);});
  if(['brick','plate','tile','baseplate'].includes(part.kind)){
    const [x,z]=footprint(part)[0];const ray=new THREE.Raycaster(new THREE.Vector3(x,-1,z),new THREE.Vector3(0,1,0));
    const first=ray.intersectObject(model.group)[0];assert(first&&first.point.y>=1.8,`${part.id}: underside must have stud clearance`);
  }
  if(part.kind==='technic'||part.kind==='beam'){
    const extents=bounds.getSize(new THREE.Vector3());assert(Math.abs(extents.x-(part.columns*8-0.2))<0.01&&Math.abs(extents.z-7.8)<0.01,`${part.id}: sleeves must stay inside the part footprint`);
    const hole=connectors.find(c=>c.type==='pin-hole')!;const ray=new THREE.Raycaster(new THREE.Vector3(hole.position[0],hole.position[1],20),new THREE.Vector3(0,0,-1));
    assert.equal(ray.intersectObject(model.group).length,0,`${part.id}: circular holes must go through`);
  }
  if(part.kind==='gear'||part.kind==='wheel'){
    const ray=new THREE.Raycaster(new THREE.Vector3(100,part.height/2,0),new THREE.Vector3(-1,0,0));
    assert.equal(ray.intersectObject(model.group).length,0,`${part.id}: cross axle hole must go through`);
  }
  model.dispose();
}
assert(compatible('stud','socket'));assert(compatible('axle-hole','axle-end'));assert(!compatible('stud','stud'));assert(!compatible('pin-end','axle-hole'));
// Two bricks aligned by connector planes must stack at exactly one brick height.
const brick=getPart('brick-2x4'),connections=getConnectors(brick),stud=connections.find(c=>c.type==='stud')!,socket=connections.find(c=>c.type==='socket')!;
assert.equal(stud.position[1]-socket.position[1],9.6);assert.deepEqual([stud.position[0],stud.position[2]],[socket.position[0],socket.position[2]]);
const source=createPart(brick),exported=exportablePart(source.group);exported.updateMatrixWorld(true);
const exportBounds=new THREE.Box3().setFromObject(exported).getSize(new THREE.Vector3());assert(Math.abs(exportBounds.x-0.0318)<1e-5);source.dispose();
console.log(`PASS: ${parts.length} parts / ${categories.length} categories / ${geometryCount} geometries / ${connectorCount} connectors. IDs, search, bounds, cavities, through-holes, mating planes and metre export checked.`);
