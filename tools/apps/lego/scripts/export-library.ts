import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {parts,categories} from '../src/catalog.ts';
import {createPart,exportablePart} from '../src/parts.ts';
import {getConnectors,unitSystem} from '../src/connectors.ts';
Reflect.set(globalThis,'FileReader',class {result:ArrayBuffer|null=null;onloadend:(()=>void)|null=null;readAsArrayBuffer(blob:Blob){void blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});}});
await mkdir('exports/parts',{recursive:true});
const exporter=new GLTFExporter(),loader=new GLTFLoader(),records=[];
let bytes=0;
for(const part of parts){
  const model=createPart(part),unique=new Set<THREE.BufferGeometry>();model.group.traverse(obj=>{if(obj instanceof THREE.Mesh)unique.add(obj.geometry);});unique.forEach(g=>g.normalizeNormals());
  const bounds=new THREE.Box3().setFromObject(model.group),size=bounds.getSize(new THREE.Vector3());
  const data=await exporter.parseAsync(exportablePart(model.group),{binary:true});assert(data instanceof ArrayBuffer);
  const parsed=await loader.parseAsync(data,'');const decodedSize=new THREE.Box3().setFromObject(parsed.scene).getSize(new THREE.Vector3());
  for(const axis of ['x','y','z'] as const)assert(Math.abs(decodedSize[axis]*1000-size[axis])<0.02,`${part.id}: exported scale`);
  assert(parsed.scene.getObjectByName(part.id),`${part.id}: exported identity`);
  await writeFile(`exports/parts/${part.id}.glb`,Buffer.from(data));bytes+=data.byteLength;
  records.push({...part,boundsMillimetres:{min:bounds.min.toArray(),max:bounds.max.toArray()},connectors:getConnectors(part),file:`parts/${part.id}.glb`,bytes:data.byteLength});
  const decodedGeometries=new Set<THREE.BufferGeometry>(),decodedMaterials=new Set<THREE.Material>();parsed.scene.traverse(obj=>{if(obj instanceof THREE.Mesh){decodedGeometries.add(obj.geometry);(Array.isArray(obj.material)?obj.material:[obj.material]).forEach(m=>decodedMaterials.add(m));}});decodedGeometries.forEach(g=>g.dispose());decodedMaterials.forEach(m=>m.dispose());model.dispose();
}
await writeFile('exports/parts-catalog.json',JSON.stringify({schemaVersion:1,unitSystem,total:parts.length,categories,parts:records},null,2));
await writeFile('exports/README.txt',`积木零件库第一版\n${parts.length} 种零件 / ${categories.length} 类。每个 GLB 均已重新读取校验。\nGLB 场景单位为米；连接点与参数目录以毫米表示。以零件底面中心为原点，Y 向上，X 为长度，Z 为宽度。\n连接点是后续吸附编辑器的逻辑接口，尚不包含碰撞、配合公差、摩擦、铰链约束或齿轮传动求解。\n这是独立制作的乐高风格视觉零件库，不是官方零件目录或制造级模型。\n`);
console.log(`Exported and decoded ${records.length} GLBs, ${(bytes/1024/1024).toFixed(2)} MiB total. Manifest: exports/parts-catalog.json`);
