import {Group} from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {exportablePart,type PartModel} from './parts';
import type {Project,Triple} from './assembly';
export async function exportProject(project:Project,models:Map<string,PartModel>):Promise<ArrayBuffer>{
 const root=new Group();root.name=project.name;root.scale.setScalar(0.001);root.userData={schema:'brick-workshop',units:'metres',sourceUnits:'millimetres'};
 for(const piece of project.pieces){const source=models.get(piece.id);if(!source)throw new Error(`Missing model ${piece.id}`);const obj=exportablePart(source.group);obj.scale.setScalar(1);obj.position.fromArray(piece.position);obj.rotation.set(...piece.rotation.map(n=>n*Math.PI/2) as Triple);obj.userData={...obj.userData,units:'millimetres',instanceId:piece.id};root.add(obj);}
 const data=await new GLTFExporter().parseAsync(root,{binary:true});if(!(data instanceof ArrayBuffer))throw new Error('Invalid GLB');return data;
}
