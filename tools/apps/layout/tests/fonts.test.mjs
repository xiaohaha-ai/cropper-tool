import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('', { url: 'http://localhost:5174/' });
for (const key of ['window', 'document', 'DOMParser', 'FileReader', 'Blob', 'location'])
  globalThis[key] = dom.window[key];
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
const { normalizeArticleFonts, normalizeFontFamily, FONT_OPTIONS, fontWeight, SANS_FONT, SERIF_FONT } = await import('../src/fonts.ts');
const { exportHtml } = await import('../src/export.ts');

// jsdom drops @font-face src/unicode-range descriptors; provide the browser CSSOM.
function fontRules(t, definitions) {
  const prior = Object.getOwnPropertyDescriptor(document, 'styleSheets');
  Object.defineProperty(document, 'styleSheets', { configurable: true, value: [{
    href: null,
    cssRules: definitions.map((properties) => ({
      type: 5,
      cssText: `@font-face {${Object.entries(properties).map(([key, value]) => `${key}:${value};`).join('')}}`,
      style: { getPropertyValue: (key) => properties[key] || '' },
    })),
  }] });
  t.after(() => prior ? Object.defineProperty(document, 'styleSheets', prior) : delete document.styleSheets);
}

test('旧字体换为内置字体时保留文字、图片、布局、标识和原稿', () => {
  const article = { id: 'original', updatedAt: 123, blocks: [{
    id: 'block', locked: true, style: { fontFamily: 'Arial, sans-serif', fontSize: 24 },
    html: '<section style="width:75%;display:grid"><p style="font:italic 700 20px Georgia,serif">可编辑文字</p><img src="/assets/photo.png" width="300"><svg><text font-family="SimSun">标题</text></svg></section>',
  }] };
  const before = structuredClone(article);
  const result = normalizeArticleFonts(article);
  assert.deepEqual(article, before);
  assert.equal(result.id, article.id);
  assert.equal(result.updatedAt, 123);
  assert.deepEqual(result.blocks[0].style, { fontFamily: SANS_FONT, fontSize: 24 });
  assert.equal(result.blocks[0].locked, true);
  const parsed = new DOMParser().parseFromString(result.blocks[0].html, 'text/html');
  assert.equal(parsed.body.textContent, '可编辑文字标题');
  assert.equal(parsed.querySelector('section').style.width, '75%');
  assert.equal(parsed.querySelector('section').style.display, 'grid');
  assert.equal(parsed.querySelector('p').style.fontFamily, SERIF_FONT);
  assert.equal(parsed.querySelector('p').style.fontWeight, '700');
  assert.equal(parsed.querySelector('p').style.fontStyle, 'italic');
  assert.equal(parsed.querySelector('img').getAttribute('src'), '/assets/photo.png');
  assert.equal(parsed.querySelector('text').getAttribute('font-family'), SERIF_FONT);
  assert.deepEqual(normalizeArticleFonts(result), result);
});

test('HTML 下载内嵌需要的字体分片和许可，保留真实文字并排除编辑工具', async (t) => {
  fontRules(t, [
    { 'font-family': 'Source Han Sans SC', src: "url('/fonts/used.woff2')", 'unicode-range': 'U+4E00-4EFF' },
    { 'font-family': 'Source Han Sans SC', src: "url('/fonts/unused.woff2')", 'unicode-range': 'U+9000-9FFF' },
    { 'font-family': 'Source Han Serif SC', src: "url('/fonts/serif.woff2')", 'unicode-range': 'U+4E00-4EFF' },
  ]);
  document.body.innerHTML = `<div id="paper"><p contenteditable="true" style='font-family:${SANS_FONT}'>中</p><button data-editor-only>删除</button></div>`;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    return { ok: true, blob: async () => new Blob(['font-data'], { type: 'font/woff2' }), text: async () => 'Google Inc.\nSIL OPEN FONT LICENSE Version 1.1' };
  });
  const paper = document.querySelector('#paper');
  const before = paper.outerHTML;
  const html = await exportHtml({ width: 414, background: '#ffffff', title: '文章 <标题>', description: '摘要' }, paper);
  assert.equal(paper.outerHTML, before);
  assert.deepEqual(calls, ['http://localhost:5174/fonts/used.woff2', 'http://localhost:5174/fonts/local/source-han-sans-NOTICE.txt']);
  assert.match(html, /data:font\/woff2;base64,/);
  assert.match(html, /SIL OPEN FONT LICENSE Version 1.1/);
  assert.doesNotMatch(html, /unused\.woff2|serif\.woff2|contenteditable|删除/);
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  assert.equal(parsed.title, '文章 <标题>');
  assert.equal(parsed.body.textContent, '中');
  assert.equal(parsed.querySelector('p').style.fontFamily, SANS_FONT);
});

test('字体读取失败时停止导出，避免静默丢失字体', async (t) => {
  fontRules(t, [{ 'font-family': 'Source Han Sans SC', src: "url('/fonts/missing.woff2')" }]);
  document.body.innerHTML = `<div id="paper" style='font-family:${SANS_FONT}'>内容</div>`;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false }));
  await assert.rejects(exportHtml({ title: '测试', description: '' }, document.querySelector('#paper')), /字体文件读取失败/);
});

test('仅保留下载的四款字体，合法字体不互相替换，旧稿和未知字体映射到允许列表', () => {
  assert.deepEqual(FONT_OPTIONS.map(font => font.label), ['思源黑体', '思源宋体', '阿里巴巴普惠体', 'Noto Sans SC']);
  for (const font of FONT_OPTIONS) {
    for (const alias of [font.value, font.family, font.label])
      assert.equal(normalizeFontFamily(alias), font.value);
  }
  assert.equal(normalizeFontFamily('"Noto Sans SC Variable", Arial'), FONT_OPTIONS[3].value);
  assert.equal(normalizeFontFamily('"RC Ticket Serif"'), SERIF_FONT);
  assert.equal(normalizeFontFamily('"RC Ticket Sans"'), SANS_FONT);
  assert.equal(normalizeFontFamily('"Noto Serif SC Variable", serif'), SERIF_FONT);
  assert.equal(normalizeFontFamily('PingFang SC'), SANS_FONT);
  assert.equal(normalizeFontFamily('initial'), SANS_FONT);
  assert.equal(normalizeFontFamily('"Source Han Sans SC", "unlicensed font"'), SANS_FONT);
});

test('使用浏览器的真实字重匹配规则，不把缺失的 600 字重导出成 500', () => {
  assert.equal(fontWeight(SANS_FONT, 600), 700);
  assert.equal(fontWeight(SANS_FONT, 450), 500);
  assert.equal(fontWeight(SERIF_FONT, 600), 600);
});

test('导出只内嵌实际使用的字重，保留普惠体自身说明', async (t) => {
  const font = FONT_OPTIONS[2];
  fontRules(t, [
    { 'font-family': font.family, 'font-weight': '400', src: "url('/fonts/regular.woff2')" },
    { 'font-family': font.family, 'font-weight': '700', src: "url('/fonts/bold.woff2')" },
    { 'font-family': font.family, 'font-weight': '900', src: "url('/fonts/black.woff2')" },
  ]);
  document.body.innerHTML = `<div id="paper"><p style='font-family:${font.value};font-weight:700'>普惠体粗体</p></div>`;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    return { ok: true, blob: async () => new Blob(['font'], { type: 'font/woff2' }), text: async () => '阿里巴巴字体官网及法律声明' };
  });
  const html = await exportHtml({ title: '测试', description: '' }, document.querySelector('#paper'));
  assert.deepEqual(calls, ['http://localhost:5174/fonts/bold.woff2', `http://localhost:5174${font.license}`]);
  assert.match(html, /阿里巴巴字体官网及法律声明/);
  assert.doesNotMatch(html, /SIL OFL|regular.woff2|black.woff2/);
});

test('普惠体生僻字使用独立扩展字库，粗体段落导出也保留扩展字库', async (t) => {
  const font = FONT_OPTIONS[2];
  fontRules(t, [
    { 'font-family': font.family, 'font-weight': '700', src: "url('/fonts/bold.woff2')", 'unicode-range': 'U+0-FFFF' },
    { 'font-family': 'Alibaba PuHuiTi 3 L3', 'font-weight': '400', src: "url('/fonts/l3.woff2')", 'unicode-range': 'U+20000-2FFFF' },
  ]);
  document.body.innerHTML = `<div id="paper"><p style='font-family:${font.value};font-weight:700'>汉字𠀀</p></div>`;
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url));
    return { ok: true, blob: async () => new Blob(['font'], { type: 'font/woff2' }), text: async () => '字体来源说明' };
  });
  const html = await exportHtml({ title: '扩展字符', description: '' }, document.querySelector('#paper'));
  assert.ok(calls.includes('http://localhost:5174/fonts/bold.woff2'));
  assert.ok(calls.includes('http://localhost:5174/fonts/l3.woff2'));
  assert.match(html, /Alibaba PuHuiTi 3 L3/);
});
