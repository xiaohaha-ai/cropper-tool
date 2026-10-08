import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.DOMParser = dom.window.DOMParser;
const { makeLayer, boundLayer, arrangeText, compositionHtml, readComposition } = await import('../src/composition.ts');
const { newArticle, parseArticle, makeBlock } = await import('../src/model.ts');
const canvas = () => ({ width: 720, height: 320, layers: [makeLayer('image', {x:290,y:10,width:410,height:300,src:'/assets/festival-photo.png'})] });
test('图层拖拽和缩放受画布边界约束，非法尺寸不能破坏版面', () => {
 const c=canvas(); const l=boundLayer(makeLayer('text',{x:-50,y:9999,width:Infinity,height:-20,fontSize:999,opacity:2}),c);
 assert.equal(l.x,0);assert.equal(l.y,c.height-l.height);assert.equal(l.height,16);assert.ok(l.width<=c.width);assert.equal(l.fontSize,160);assert.equal(l.opacity,1);
});
test('左文右图和文字叠加保留图片，原数据不变，并按照图层顺序覆盖',()=>{
 const c=canvas(), before=JSON.stringify(c), left=arrangeText(c,'left');
 assert.equal(JSON.stringify(c),before);
 const image=left.layers.find(l=>l.kind==='image'),text=left.layers.find(l=>l.kind==='text');
 assert.ok(text.x+text.width<image.x);assert.equal(image.src,c.layers[0].src);
 const over=arrangeText(left,'overlay');assert.equal(over.layers.at(-1).id,text.id);assert.equal(over.layers.at(-1).color,'#ffffff');assert.equal(over.layers.length,2);
});
test('组合经过工程导出导入后，文字、图片、坐标和层级继续可编辑',()=>{
 const c=arrangeText(canvas(),'overlay');c.layers[1].text='标题\n中文 & English';c.layers[0].link='https://example.com/';
 const article=newArticle(true);article.blocks=[makeBlock('layout','组合',compositionHtml(c))];
 const imported=parseArticle(JSON.parse(JSON.stringify(article))), restored=readComposition(imported.blocks[0].html);
 assert.equal(restored.layers.length,2);assert.equal(restored.layers[1].text,c.layers[1].text);
 assert.equal(restored.layers[0].link,c.layers[0].link);
 for(let i=0;i<2;i++)for(const key of ['x','y','width','height','src','fontFamily','fontSize','bold','align']) assert.equal(restored.layers[i][key],c.layers[i][key],key);
 assert.match(imported.blocks[0].html,/display:grid/);assert.match(imported.blocks[0].html,/grid-area:1 \/ 1/);
 assert.equal(readComposition('<p>普通组件</p>'),null);
});
test('图层文字作为文本保存，原组件及图片仍遵守 HTML 清洗规则',()=>{
 const c=canvas();c.layers.push(makeLayer('text',{text:'<script>alert(1)</script>'}),makeLayer('content',{html:'<p onclick="bad()">原文</p><script>bad()</script>'}));
 c.layers[0].src='javascript:bad()';c.layers[0].name='" onerror="bad()';
 const html=compositionHtml(c);assert.doesNotMatch(html,/<script|onclick=|javascript:/);assert.match(html,/&lt;script&gt;/);assert.match(html,/>原文<\/p>/);
 const doc=new DOMParser().parseFromString(html,'text/html');assert.equal(doc.querySelector('[onerror]'),null);
});
