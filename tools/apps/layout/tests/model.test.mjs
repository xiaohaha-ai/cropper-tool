import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom=new JSDOM('');
globalThis.window=dom.window;
globalThis.DOMParser=dom.window.DOMParser;
const {sanitize,safeUrl,parseArticle,newArticle,templates}=await import('../src/model.ts');

test('导入 HTML 移除脚本、事件、危险链接，保留文字和格式',()=>{
 const cleaned=sanitize('<script>alert(1)</script><p style="color:red" onclick="alert(1)">正文<b>粗体</b><a href="javascript:alert(1)">链接</a><img src="/assets/mooncake.jpg" onerror="alert(1)"></p>');
 assert.doesNotMatch(cleaned,/<script|onclick|onerror|javascript:/i);
 assert.match(cleaned,/<b>粗体<\/b>/);
 assert.match(cleaned,/color:red/);
 assert.match(cleaned,/\/assets\/mooncake.jpg/);
});
test('不允许导入可执行 SVG 或覆盖应用界面的 CSS',()=>{
 const cleaned=sanitize('<svg><foreignObject><div>test</div></foreignObject><script>alert(1)</script><circle cx="5" cy="5" r="5" fill="red"/></svg><div style="position:fixed;inset:0;background:url(https://x.test)">bad</div>');
 assert.doesNotMatch(cleaned,/foreignObject|<script|position:fixed|url\(/i);
 assert.match(cleaned,/<circle/);
});
test('导入工程严格校验版本、组件类型和尺寸',()=>{
 assert.throws(()=>parseArticle({version:2,blocks:[]}));
 assert.throws(()=>parseArticle({version:1,blocks:[{kind:'iframe',html:'x'}]}));
 const a=parseArticle({...newArticle(),width:9999,fontSize:-20,lineHeight:Infinity,title:'<script>plain title</script>',link:'javascript:alert(1)'});
 assert.equal(a.width,750);assert.equal(a.fontSize,10);assert.equal(a.lineHeight,1.6);assert.equal(a.link,'');
 assert.equal(a.title,'<script>plain title</script>');
});
test('导入工程重新分配组件 ID，保留样式、内容与锁定状态',()=>{
 const original=newArticle(); original.blocks[0].locked=true;
 original.blocks[0].frame={width:80,left:10,sourceWidth:720,sourceHeight:160,crop:{x:60,y:30,width:600,height:100}};
 const parsed=parseArticle(JSON.parse(JSON.stringify(original)));
 assert.notEqual(parsed.id,original.id);assert.notEqual(parsed.blocks[0].id,original.blocks[0].id);
 assert.equal(parsed.blocks[0].html,original.blocks[0].html);assert.deepEqual(parsed.blocks[0].style,original.blocks[0].style);assert.equal(parsed.blocks[0].locked,true);
 assert.deepEqual(parsed.blocks[0].frame,original.blocks[0].frame);
});
test('链接验证拒绝危险协议、允许合规图片和音视频',()=>{
 assert.equal(safeUrl('javascript:alert(1)'), '');assert.equal(safeUrl('file:///tmp/a'), '');
 assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
 assert.equal(safeUrl('data:text/html;base64,PHNjcmlwdD4=',true),'');
 assert.equal(safeUrl('data:image/png;base64,YWJj',true),'data:image/png;base64,YWJj');
});
test('全部内置模板均可经过清洗并插入',()=>{
 assert.equal(templates.length,18);
 for (const template of templates) {assert.ok(sanitize(template.html).length>20,template.name);}
});

test('参考素材升级只替换原样示例，不改已编辑内容和文稿属性', async()=>{
 const {upgradeBundledArticle,festivalText}=await import('../src/model.ts');
 const article=newArticle();
 const oldHeading='<div style="text-align:center;margin:0 0 -7px;position:relative;z-index:1"><img src="/assets/festival-heading.png" alt="中秋 · 但愿人长久" style="width:74%;display:inline-block;max-width:100%"></div>';
 const oldCard=`${oldHeading}<section style="background:linear-gradient(#fff0b0,#fffdf6);border-radius:14px;padding:30px 22px 18px"><img src="/assets/mooncake.jpg" alt="中秋月饼" style="width:100%;border-radius:9px;display:block"><p style="margin:17px 0 0;font-size:16px;line-height:1.65;text-align:left">${festivalText}</p></section>`;
 article.blocks[1].html=sanitize(oldCard);
 const before=JSON.stringify(article);
 const upgraded=upgradeBundledArticle(article);
 assert.equal(JSON.stringify(article),before);
 assert.match(upgraded.blocks[1].html,/festival-photo\.png/);
 assert.match(upgraded.blocks[1].html,/data-festival-heading/);
 assert.equal(upgraded.blocks[1].id,article.blocks[1].id);
 assert.deepEqual(upgraded.blocks[1].style,article.blocks[1].style);
 assert.equal(upgraded.updatedAt,article.updatedAt);
 article.blocks[1].html=article.blocks[1].html.replace('中秋节始于唐朝初年','我的独立修改');
 assert.equal(upgradeBundledArticle(article),article);
});

test('新版中秋标题文字可编辑且装饰不依赖外部图片地址',()=>{
 const card=newArticle().blocks[1];
 assert.match(card.html,/<strong[^>]*>但愿人长久<\/strong>/);
 assert.doesNotMatch(card.html,/src="https?:/);
 assert.match(card.html,/grid-area:1\/1/);
 assert.match(card.html,/transform:scaleX\(-1\)/);
});
