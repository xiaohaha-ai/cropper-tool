import * as THREE from 'three';

// Millimetres in the editor. GLB export converts the root to metres.
export const dimensions = {length:31.8, width:15.8, height:9.6, pitch:8, studDiameter:4.8, studHeight:1.8, wall:1.3};

function roundedPath(path: THREE.Path, width:number, depth:number, r:number) {
  const x=-width/2, z=-depth/2;
  path.moveTo(x+r,z); path.lineTo(x+width-r,z);
  path.quadraticCurveTo(x+width,z,x+width,z+r); path.lineTo(x+width,z+depth-r);
  path.quadraticCurveTo(x+width,z+depth,x+width-r,z+depth); path.lineTo(x+r,z+depth);
  path.quadraticCurveTo(x,z+depth,x,z+depth-r); path.lineTo(x,z+r);
  path.quadraticCurveTo(x,z,x+r,z);
  return path;
}

export function createBrick(color = '#c52e24') {
  const group=new THREE.Group(); group.name='Brick_2x4';
  group.userData={units:'millimetres', dimensions, description:'Independent 2x4 brick concept; not a certified manufacturing model'};
  const material=new THREE.MeshPhysicalMaterial({color,roughness:0.27,metalness:0,clearcoat:0.3,clearcoatRoughness:0.24});
  function add(geometry:THREE.BufferGeometry, name:string, x=0,y=0,z=0) {
    const mesh=new THREE.Mesh(geometry,material); mesh.name=name; mesh.position.set(x,y,z);
    mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh); return mesh;
  }
  function extrude(shape:THREE.Shape, depth:number) {
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:12,steps:1});
    geometry.rotateX(-Math.PI/2); return geometry;
  }
  const shell=roundedPath(new THREE.Shape(),31.8,15.8,0.22) as THREE.Shape;
  shell.holes.push(roundedPath(new THREE.Path(),29.2,13.2,0.18));
  add(extrude(shell,8.3),'Hollow_shell',0,-4.8);
  const roof=roundedPath(new THREE.Shape(),31.8,15.8,0.22) as THREE.Shape;
  add(extrude(roof,1.3),'Top_plate',0,3.5);
  // Lathed closed section adds rounded stud rims without external assets.
  const studProfile=[new THREE.Vector2(0,0),new THREE.Vector2(2.34,0),new THREE.Vector2(2.4,0.06),new THREE.Vector2(2.4,1.68),new THREE.Vector2(2.38,1.75),new THREE.Vector2(2.31,1.8),new THREE.Vector2(0,1.8)];
  const studGeometry=new THREE.LatheGeometry(studProfile,64);
  for(let row=0;row<2;row++) for(let col=0;col<4;col++) add(studGeometry,`Stud_${row+1}_${col+1}`,(col-1.5)*8,4.8,(row-0.5)*8);
  // Open circular tubes: outer radius 3.25, inner radius 2.4.
  const tubeProfile=[new THREE.Vector2(2.4,0.06),new THREE.Vector2(2.46,0),new THREE.Vector2(3.19,0),new THREE.Vector2(3.25,0.06),new THREE.Vector2(3.25,8.3),new THREE.Vector2(2.4,8.3),new THREE.Vector2(2.4,0.06)];
  const tubeGeometry=new THREE.LatheGeometry(tubeProfile,64);
  for(let i=0;i<3;i++) add(tubeGeometry,`Underside_tube_${i+1}`,(i-1)*8,-4.8);
  return {group,material};
}
