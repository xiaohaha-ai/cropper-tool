import {shortcutActions,defaults,keyCombo,keyLabel,loadBindings,rebind,type ShortcutAction} from './shortcuts';
export function installShortcuts(options:{run:(action:ShortcutAction)=>void;cancel:()=>void;changed:()=>void}){
 const storageKey='brick-workshop-shortcuts-v1',mac=/Mac|iPhone|iPad/.test(navigator.platform);
 let bindings=defaults();try{bindings=loadBindings(localStorage.getItem(storageKey));}catch{/* Session-only settings remain usable. */}
 let recording:ShortcutAction|null=null,returnFocus:HTMLElement|null=null;
 const dialog=document.createElement('dialog');dialog.className='shortcut-dialog';dialog.id='shortcut-dialog';dialog.setAttribute('aria-labelledby','shortcut-heading');
 dialog.innerHTML=`<div class="shortcut-head"><div><span class="eyebrow">YOUR WORKFLOW</span><h2 id="shortcut-heading">快捷键设置</h2></div><button id="close-shortcuts" aria-label="关闭快捷键设置">✕</button></div><p class="shortcut-intro">点击按键即可修改，设置自动记在此浏览器。<br>画布右键单击转向 90°，右键拖动平移视角。<br>输入文字时暂停快捷键；微调按世界坐标移动，仍遵守防重叠检查。</p><div class="shortcut-fixed"><span>取消放置 / 移动 <kbd>Esc</kbd></span><span>打开快捷键面板 <kbd>?</kbd></span></div><div id="shortcut-rows" class="shortcut-rows"></div><div class="shortcut-footer"><p id="shortcut-feedback" role="status" aria-live="polite">${mac?'⌘ 对应 Command；Windows 使用 Ctrl。':'Ctrl 组合在 Mac 上可使用 Command。'} Delete 与退格键等效。</p><button id="reset-shortcuts">恢复默认</button></div>`;
 document.body.append(dialog);
 const rows=dialog.querySelector<HTMLElement>('#shortcut-rows')!,feedback=dialog.querySelector<HTMLElement>('#shortcut-feedback')!;
 function render(){rows.replaceChildren();let group='';for(const action of shortcutActions){if(action.group!==group){group=action.group;const heading=document.createElement('h3');heading.textContent=group;rows.append(heading);}const row=document.createElement('div');row.className='shortcut-row';const name=document.createElement('span');name.textContent=action.name;const button=document.createElement('button');button.dataset.shortcut=action.id;button.setAttribute('aria-label',`修改${action.name}快捷键，当前 ${keyLabel(bindings[action.id],mac)}`);button.classList.toggle('recording',recording===action.id);button.textContent=recording===action.id?'请按新按键…':keyLabel(bindings[action.id],mac);button.onclick=()=>{recording=action.id;feedback.textContent=`正在设置「${action.name}」。请按单键或组合键，Esc 取消，Tab 离开。`;render();dialog.querySelector<HTMLButtonElement>(`[data-shortcut="${action.id}"]`)!.focus();};row.append(name,button);rows.append(row);}}
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify({version:1,bindings}));return true;}catch{return false;}}
 function close(){recording=null;dialog.close();returnFocus?.focus();}
 function open(){if(dialog.open)return;returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;recording=null;render();dialog.showModal();dialog.querySelector<HTMLButtonElement>('#close-shortcuts')!.focus();}
 dialog.querySelector<HTMLButtonElement>('#close-shortcuts')!.onclick=close;
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.querySelector<HTMLButtonElement>('#reset-shortcuts')!.onclick=()=>{recording=null;bindings=defaults();const saved=persist();render();options.changed();feedback.textContent=saved?'已恢复默认快捷键并保存。':'已恢复默认；浏览器无法保存设置，本次会话有效。';};
 document.getElementById('shortcut-settings')!.onclick=open;
 function keydown(event:KeyboardEvent){
  if(event.isComposing||event.keyCode===229)return;
  if(dialog.open){
   if(!recording)return;
   if(event.key==='Tab'){const action=recording;recording=null;render();dialog.querySelector<HTMLButtonElement>(`[data-shortcut="${action}"]`)!.focus();feedback.textContent='已取消改键。';return;}
   if(['Shift','Control','Meta','Alt'].includes(event.key))return;
   event.preventDefault();event.stopPropagation();if(event.repeat)return;
   const action=recording;
   if(event.key==='Escape'){recording=null;render();feedback.textContent='已取消改键，原按键未改变。';dialog.querySelector<HTMLButtonElement>(`[data-shortcut="${action}"]`)!.focus();return;}
   const combo=keyCombo(event);if(!combo){feedback.textContent='请使用字母、数字、方向键或 Delete，可组合 Shift；不支持 Alt。';return;}
   try{bindings=rebind(bindings,action,combo);recording=null;const saved=persist();render();options.changed();feedback.textContent=`已设置为 ${keyLabel(combo,mac)}。${saved?'已保存。':'浏览器无法保存设置，本次会话有效。'}`;dialog.querySelector<HTMLButtonElement>(`[data-shortcut="${action}"]`)!.focus();}catch(error){feedback.textContent=(error as Error).message;}
   return;
  }
  if(document.querySelector('dialog[open]'))return;
  if(event.target instanceof Element&&(event.target.closest('input,select,textarea,[role="textbox"]')||(event.target as HTMLElement).isContentEditable))return;
  const combo=keyCombo(event);if(!combo)return;
  if(combo==='escape'||combo==='shift+/'){event.preventDefault();if(event.repeat)return;combo==='escape'?options.cancel():open();return;}
  const action=shortcutActions.find(a=>bindings[a.id]===combo);if(!action)return;
  event.preventDefault();if(!event.repeat)options.run(action.id);
 }
 window.addEventListener('keydown',keydown,true);
 window.addEventListener('blur',()=>{if(recording){recording=null;render();feedback.textContent='已取消改键。';}});
 window.addEventListener('pagehide',event=>{if(!event.persisted)window.removeEventListener('keydown',keydown,true);},{once:true});
 return {label:(action:ShortcutAction)=>keyLabel(bindings[action],mac)};
}
