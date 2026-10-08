import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createBrick} from '../src/brick.ts';

// GLTFExporter uses the browser FileReader API for its binary payload.
Reflect.set(globalThis,'FileReader',class {
  result:ArrayBuffer|null=null;
  onloadend:(()=>void)|null=null;
  readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}
});
const {group}=createBrick();group.updateMatrixWorld(true);
const bounds=new THREE.Box3().setFromObject(group);const size=bounds.getSize(new THREE.Vector3());
assert(Math.abs(size.x-31.8)<0.001&&Math.abs(size.y-11.4)<0.001&&Math.abs(size.z-15.8)<0.001,'Model dimensions');
assert.equal(group.children.filter(child=>child.name.startsWith('Stud_')).length,8);
assert.equal(group.children.filter(child=>child.name.startsWith('Underside_tube_')).length,3);
const cavityRay=new THREE.Raycaster(new THREE.Vector3(0,-10,0),new THREE.Vector3(0,1,0));
const cavityHit=cavityRay.intersectObject(group)[0];
assert(cavityHit&&Math.abs(cavityHit.point.y-3.5)<0.001,'Underside cavity must be open through centre tube');
group.scale.setScalar(0.001);group.userData={...group.userData,units:'metres',sourceDimensionsMillimetres:group.userData.dimensions};
const binary=await new GLTFExporter().parseAsync(group,{binary:true});
assert(binary instanceof ArrayBuffer);
const parsed=await new GLTFLoader().parseAsync(binary,'');
const importedSize=new THREE.Box3().setFromObject(parsed.scene).getSize(new THREE.Vector3());
assert(Math.abs(importedSize.x-0.0318)<0.000001,'GLB must retain real-world scale');
await mkdir('dist',{recursive:true});
await writeFile('dist/brick-2x4.glb',Buffer.from(binary));
console.log(`Geometry verified: 8 studs, 3 tubes, open cavity, ${size.toArray().map(n=>n.toFixed(1)).join(' × ')} mm overall. GLB exported and decoded (${binary.byteLength} bytes).`);
