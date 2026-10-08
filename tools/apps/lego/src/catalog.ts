export type Category = 'brick'|'plate'|'tile'|'slope'|'round'|'corner'|'technic'|'beam'|'axle'|'pin'|'gear'|'wheel'|'baseplate';
export type Kind = Category | 'cone';
export interface PartDefinition {
  id:string; name:string; category:Category; kind:Kind;
  columns:number; rows:number; height:number;
  variant?:string; teeth?:number; diameter?:number; thickness?:number;
}
export const categories:{id:Category;name:string;description:string}[]=[
  {id:'brick',name:'基础砖',description:'结构搭建的基本单元'},
  {id:'plate',name:'薄板',description:'叠层、加固与精细高度'},
  {id:'tile',name:'光面板',description:'地面、外饰与光滑表面'},
  {id:'slope',name:'斜坡件',description:'屋顶、车头与倾斜轮廓'},
  {id:'round',name:'圆形与锥形',description:'立柱、圆台与装饰细节'},
  {id:'corner',name:'转角件',description:'L 形转角与交错加固'},
  {id:'technic',name:'带孔砖',description:'连接凸点体系与机械体系'},
  {id:'beam',name:'机械梁',description:'带贯穿圆孔的结构梁'},
  {id:'axle',name:'十字轴',description:'机械旋转连接的基础轴件'},
  {id:'pin',name:'连接销',description:'圆孔之间的连接件'},
  {id:'gear',name:'齿轮',description:'六种齿数的简化直齿轮'},
  {id:'wheel',name:'车轮',description:'轮毂与独立橡胶轮胎'},
  {id:'baseplate',name:'底板',description:'大场景的搭建起点'},
];
export const colors=[
  {name:'经典红',hex:'#bf2923'}, {name:'暖黄色',hex:'#dfb021'},
  {name:'海蓝色',hex:'#245b9f'}, {name:'森林绿',hex:'#256b50'},
  {name:'陶土橙',hex:'#c36a35'}, {name:'暖白色',hex:'#eee8d9'},
  {name:'石墨灰',hex:'#646b6c'}, {name:'炭黑色',hex:'#252c2f'},
];
const catalog:PartDefinition[]=[];
function add(category:Category,columns:number,rows:number,height:number,variant?:string,extra:Partial<PartDefinition>={}) {
  const id=`${category}-${rows}x${columns}${variant?`-${variant}`:''}`;
  const name=`${categories.find(c=>c.id===category)!.name} ${rows} × ${columns}${variant==='tall'?' × 3':''}`;
  catalog.push({id,name,category,kind:category,columns,rows,height,variant,...extra});
}
const bricks:[[number,number],...[number,number][]]=[[1,1],[2,1],[3,1],[4,1],[6,1],[8,1],[10,1],[12,1],[16,1],[2,2],[3,2],[4,2],[6,2],[8,2],[10,2],[3,3],[4,4]];
bricks.forEach(([x,z])=>add('brick',x,z,9.6));
[[14,1],[12,2]].forEach(([x,z])=>add('brick',x,z,9.6));
[[2,1],[4,1],[2,2]].forEach(([x,z])=>add('brick',x,z,28.8,'tall'));
const plates:[number,number][]=[...[1,2,3,4,6,8,10,12].map(x=>[x,1] as [number,number]),...[2,3,4,6,8,10,12].map(x=>[x,2] as [number,number]),...[4,6,8,10].map(x=>[x,4] as [number,number]),[6,6],[8,6],[8,8]];
plates.forEach(([x,z])=>add('plate',x,z,3.2));
[[16,2],[12,4],[10,6]].forEach(([x,z])=>add('plate',x,z,3.2));
[...[1,2,3,4,6,8].map(x=>[x,1]),...[2,3,4,6,8].map(x=>[x,2]),[4,4],[6,4],[6,6]].forEach(([x,z])=>add('tile',x,z,3.2));
[[10,2],[8,4]].forEach(([x,z])=>add('tile',x,z,3.2));
for(const length of [2,3])for(const width of [1,2,3,4])add('slope',length,width,9.6);
for(const width of [1,2])add('slope',1,width,6.4,'cheese',{name:`小斜坡 ${width} × 1`});
for(const width of [1,2])add('slope',4,width,9.6,'long');
for(const variant of ['brick','plate','tile','cone'])for(const diameter of [1,2,4])add('round',diameter,diameter,['plate','tile'].includes(variant)?3.2:9.6,variant,{kind:variant==='cone'?'cone':'round',name:`${{brick:'圆砖',plate:'圆薄板',tile:'圆光面板',cone:'锥形件'}[variant]} ${diameter} × ${diameter}`});
for(const n of [2,3,4])for(const variant of ['brick','plate'])add('corner',n,n,variant==='brick'?9.6:3.2,variant,{name:`L 形${variant==='brick'?'砖':'板'} ${n} × ${n}`});
for(const n of [2,4,6,8,10,12,14,16])add('technic',n,1,9.6,undefined,{name:`带孔砖 1 × ${n}`});
for(const n of [2,3,4,5,7,9,11,13,15])add('beam',n,1,7.8,undefined,{name:`直梁 ${n} 孔`});
for(const n of [2,3,4,5,6,7,8,10,12,16])add('axle',n,1,4.7,undefined,{name:`十字轴 ${n}L`});
for(const n of [2,3])for(const variant of ['smooth','friction'])add('pin',n,1,5.6,variant,{name:`${variant==='smooth'?'光滑':'带环'}连接销 ${n}L`});
for(const teeth of [8,12,16,20,24,40])add('gear',1,1,teeth+2,`${teeth}t`,{name:`直齿轮 ${teeth} 齿`,teeth,thickness:3.2});
for(const [diameter,thickness]of [[18,8],[24,10],[30,12],[40,16]])add('wheel',1,1,diameter,`d${diameter}`,{name:`车轮 Ø${diameter} × ${thickness}`,diameter,thickness});
for(const [x,z]of [[16,16],[32,16],[32,32]])add('baseplate',x,z,3.2,undefined,{name:`底板 ${z} × ${x}`});
export const parts:readonly PartDefinition[]=catalog;
export function getPart(id:string):PartDefinition {
  const part=parts.find(p=>p.id===id);if(!part)throw new Error(`Unknown part: ${id}`);return part;
}
export function partSizeLabel(part:PartDefinition) {
  if(part.kind==='gear')return `${part.teeth} 齿`;
  if(part.kind==='wheel')return `Ø${part.diameter} mm`;
  if(part.kind==='axle'||part.kind==='pin')return `${part.columns}L`;
  if(part.kind==='beam')return `${part.columns} 孔`;
  return `${part.rows} × ${part.columns}${part.variant==='tall'?' × 3':''}`;
}
export function searchParts(query:string,category:Category|'all'='all') {
  const normalize=(text:string)=>text.toLowerCase().replace(/[×*]/g,'x').replace(/\s+/g,'');
  const term=normalize(query);
  return parts.filter(p=>(category==='all'||p.category===category)&&normalize(`${p.name} ${p.id} ${partSizeLabel(p)} ${categories.find(c=>c.id===p.category)!.name}`).includes(term));
}
