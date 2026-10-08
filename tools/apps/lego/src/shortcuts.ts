export const shortcutActions = [
 {id:'move',name:'移动零件',key:'m',group:'零件编辑'},
 {id:'rotateY',name:'绕 Y 轴旋转 90°',key:'r',group:'零件编辑'},
 {id:'rotateX',name:'绕 X 轴旋转 90°',key:'x',group:'零件编辑'},
 {id:'rotateZ',name:'绕 Z 轴旋转 90°',key:'z',group:'零件编辑'},
 {id:'duplicate',name:'复制零件',key:'mod+d',group:'零件编辑'},
 {id:'delete',name:'删除零件',key:'delete',group:'零件编辑'},
 {id:'left',name:'沿 X 轴 −8 mm',key:'arrowleft',group:'选中零件微调'},
 {id:'right',name:'沿 X 轴 +8 mm',key:'arrowright',group:'选中零件微调'},
 {id:'forward',name:'沿 Z 轴 −8 mm',key:'arrowup',group:'选中零件微调'},
 {id:'backward',name:'沿 Z 轴 +8 mm',key:'arrowdown',group:'选中零件微调'},
 {id:'lower',name:'降低 3.2 mm',key:'q',group:'选中零件微调'},
 {id:'raise',name:'升高 3.2 mm',key:'e',group:'选中零件微调'},
 {id:'undo',name:'撤销',key:'mod+z',group:'作品与视图'},
 {id:'redo',name:'重做',key:'mod+shift+z',group:'作品与视图'},
 {id:'save',name:'保存作品文件',key:'mod+s',group:'作品与视图'},
 {id:'fit',name:'查看全部',key:'f',group:'作品与视图'},
 {id:'grid',name:'显示 / 隐藏网格',key:'g',group:'作品与视图'},
 {id:'snap',name:'开启 / 关闭吸附',key:'h',group:'作品与视图'},
 {id:'search',name:'搜索零件',key:'/',group:'作品与视图'},
] as const;
export type ShortcutAction=typeof shortcutActions[number]['id'];
export type Bindings=Record<ShortcutAction,string>;
export const defaults=():Bindings=>Object.fromEntries(shortcutActions.map(a=>[a.id,a.key])) as Bindings;
export interface KeyInput {key:string;ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey:boolean;isComposing?:boolean;keyCode?:number}
export function keyCombo(event:KeyInput):string|null {
 if(event.isComposing||event.keyCode===229||event.altKey||(event.ctrlKey&&event.metaKey))return null;
 let key=event.key.toLowerCase();if(key==='backspace')key='delete';if(key==='?')key='/';
 if(!/^[a-z0-9/]$/.test(key)&&!['arrowleft','arrowright','arrowup','arrowdown','delete','escape'].includes(key))return null;
 return `${event.ctrlKey||event.metaKey?'mod+':''}${event.shiftKey?'shift+':''}${key}`;
}
export function bindingError(combo:string):string|null {
 if(combo==='escape'||combo==='shift+/')return 'Esc 和 ? 为固定按键，请选择其他按键。';
 if(!/^(mod\+)?(shift\+)?([a-z0-9/]|arrowleft|arrowright|arrowup|arrowdown|delete)$/.test(combo))return '支持字母、数字、方向键、Delete 和 /，可组合 Shift。';
 if(combo.startsWith('mod+')&&!/^mod\+(shift\+)?[dszy]$/.test(combo))return '此组合为浏览器或系统保留。请选择单键或 Shift 组合。';
 return null;
}
export function rebind(bindings:Bindings,action:ShortcutAction,combo:string):Bindings {
 const error=bindingError(combo);if(error)throw new Error(error);
 const conflict=shortcutActions.find(a=>a.id!==action&&bindings[a.id]===combo);
 if(conflict)throw new Error(`这个按键已用于「${conflict.name}」，请换一个。`);
 return {...bindings,[action]:combo};
}
export function loadBindings(raw:string|null):Bindings {
 if(!raw)return defaults();
 try{const data=JSON.parse(raw);if(data.version!==1||!data.bindings)throw Error();const result=defaults(),used=new Set<string>();
  for(const action of shortcutActions){const key=data.bindings[action.id];if(typeof key!=='string'||bindingError(key)||used.has(key))throw Error();result[action.id]=key;used.add(key);}return result;
 }catch{return defaults();}
}
export function keyLabel(combo:string,mac=false):string {
 const names:Record<string,string>={mod:mac?'⌘':'Ctrl',shift:'Shift',arrowleft:'←',arrowright:'→',arrowup:'↑',arrowdown:'↓',delete:'Delete / ⌫',escape:'Esc'};
 if(combo==='shift+/')return '?';return combo.split('+').map(key=>names[key]??key.toUpperCase()).join(' + ');
}
