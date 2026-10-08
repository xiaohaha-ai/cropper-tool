import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('', { url: 'http://localhost:5174/' });
for (const key of ['window', 'document', 'DOMParser', 'FileReader', 'Blob', 'location'])
  globalThis[key] = dom.window[key];
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
const { inlineArticle } = await import('../src/export.ts');
const { copyRichContent } = await import('../src/clipboard.ts');
const article = { width: 414, background: '#ffffff' };

test('整篇导出保留两端正文、表格和复杂样式，排除编辑控件且不修改原文', async () => {
  document.body.innerHTML = `<div id="paper"><section data-block-id="first"><button data-editor-only>拖动</button><div contenteditable="true" class="block-content" style="background:linear-gradient(red, blue);box-shadow:2px 3px 4px red"><p style="margin-left:10%;text-indent:2em">文章开头</p><div style="position:relative;top:-12px;display:grid;grid-template-columns:1fr 2fr;gap:14px">布局</div></div></section><section data-block-id="last"><table style="table-layout:fixed;border-spacing:3px"><tr><td>文章末尾</td></tr></table></section><button data-editor-only>添加正文</button></div>`;
  const paper = document.querySelector('#paper');
  const before = paper.outerHTML;
  const html = await inlineArticle(article, paper);
  const output = new DOMParser().parseFromString(html, 'text/html');
  assert.equal(paper.outerHTML, before);
  assert.match(html, /文章开头/);
  assert.match(html, /文章末尾/);
  assert.doesNotMatch(html, /拖动|添加正文|contenteditable|data-block-id|class=/);
  assert.equal(output.querySelector('p').style.marginLeft, '10%');
  assert.equal(output.querySelector('p').style.textIndent, '2em');
  const grid = output.querySelector('p + div');
  assert.equal(grid.style.top, '-12px');
  assert.equal(grid.style.gridTemplateColumns, '1fr 2fr');
  assert.match(output.querySelector('section > div').style.boxShadow, /2px 3px 4px/);
  assert.equal(output.querySelector('table').style.tableLayout, 'fixed');
  assert.equal(output.querySelector('table').style.borderSpacing, '3px');
});

test('本地图片与背景内嵌并去重，保留外部地址，读取失败不能报成功', async (t) => {
  document.body.innerHTML = `<div id="paper"><div style="background-image:url('/assets/example.png')"><img src="/assets/example.png" srcset="/assets/missing.png 2x"><img src="https://images.example.com/photo.png"></div></div>`;
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return { ok: true, blob: async () => new Blob(['image'], { type: 'image/png' }) };
  });
  const html = await inlineArticle(article, document.querySelector('#paper'));
  assert.equal(calls, 1);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /background-image: url\(&quot;data:image\/png;base64,/);
  assert.match(html, /https:\/\/images.example.com\/photo.png/);
  assert.doesNotMatch(html, /srcset=|\/assets\//);
  globalThis.fetch = async () => ({ ok: false });
  await assert.rejects(inlineArticle(article, document.querySelector('#paper')), /本地图片无法读取/);
});

test('导出保留 HTML 图片尺寸属性并使用实际显示的响应式图片', async () => {
  document.body.innerHTML = '<div id="paper"><img width="120" height="80" src="https://images.example.com/small.png" srcset="https://images.example.com/large.png 2x"></div>';
  const img = document.querySelector('img');
  Object.defineProperty(img, 'currentSrc', { value: 'https://images.example.com/large.png' });
  // jsdom has no layout, so supply the browser-computed presentation dimensions.
  const originalComputed = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (node) => {
    const css = originalComputed(node);
    if (node === img) { css.width = '120px'; css.height = '80px'; }
    return css;
  };
  try {
    const html = await inlineArticle(article, document.querySelector('#paper'));
    const copied = new DOMParser().parseFromString(html, 'text/html').querySelector('img');
    assert.equal(copied.style.width, '120px');
    assert.equal(copied.style.height, '80px');
    assert.equal(copied.getAttribute('src'), 'https://images.example.com/large.png');
    assert.equal(copied.hasAttribute('srcset'), false);
  } finally { globalThis.getComputedStyle = originalComputed; }
});

test('跨编辑器导出移除会令图片缩成零宽的容器限制，并解析容器尺寸单位', async () => {
  document.body.innerHTML = '<div id="paper"><section style="container-type:inline-size;container-name:article"><div style="display:grid;grid-template-columns:40cqw 60cqw"><img src="data:image/png;base64,aW1hZ2U=" style="width:80cqw;height:20cqw"></div></section></div>';
  const originalComputed = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (node) => {
    const css = originalComputed(node);
    if (node.tagName === 'IMG') { css.width = '320px'; css.height = '80px'; }
    if (node.style.display === 'grid') css.gridTemplateColumns = '160px 240px';
    return css;
  };
  try {
    const paper = document.querySelector('#paper');
    const html = await inlineArticle(article, paper);
    assert.doesNotMatch(html, /container-type|container-name|cqw/);
    const output = new DOMParser().parseFromString(html, 'text/html');
    assert.equal(output.querySelector('img').style.width, '320px');
    assert.equal(output.querySelector('img').style.height, '80px');
    assert.equal(output.querySelector('section > div').style.gridTemplateColumns, '160px 240px');
    assert.equal(paper.querySelector('section').style.containerType, 'inline-size');
  } finally { globalThis.getComputedStyle = originalComputed; }
});

test('剪贴板授权失败后使用原生复制，HTML 和纯文字一起写入', async (t) => {
  document.body.innerHTML = '<div id="preview" tabindex="0"><p>首段</p><p>末段</p></div>';
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { clipboard: { write: async () => { throw new Error('denied'); } } } });
  t.after(() => Object.defineProperty(globalThis, 'navigator', originalNavigator));
  globalThis.ClipboardItem = class {};
  const content = { html: '<p style="color:red">首段</p><p>末段</p>', text: '首段\n末段' };
  const data = {};
  document.execCommand = () => {
    const event = new dom.window.Event('copy', { cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { setData: (type, value) => { data[type] = value; } } });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  };
  await copyRichContent(content, document.querySelector('#preview'));
  assert.equal(data['text/html'], content.html);
  assert.equal(data['text/plain'], content.text);
  document.execCommand = () => false;
  await assert.rejects(copyRichContent(content, document.querySelector('#preview')), /正文已全选/);
  assert.equal(window.getSelection().toString(), '首段末段');
});
