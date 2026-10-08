import {mountLibrary} from './library';
import {mountEditor} from './editor';
if(new URLSearchParams(location.search).get('view')==='library'){
 mountLibrary();
 const link=document.createElement('a');link.href=location.pathname;link.textContent='← 返回拼搭工作台';link.style.cssText='color:#364c39;font-weight:700;margin-left:18px;text-decoration:none';document.querySelector('.header-path')!.replaceChildren(link);
}else{mountEditor();}
