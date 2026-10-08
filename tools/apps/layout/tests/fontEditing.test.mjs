import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { SANS_FONT, SERIF_FONT } from '../src/fonts.ts';
import { applyFontFamily, selectionFont, MIXED_FONT } from '../src/fontEditing.ts';

function editor(html) {
  const dom = new JSDOM(`<div id="editor">${html}</div>`);
  globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
  return dom.window.document.querySelector('#editor');
}

test('切换整段字体覆盖导入的嵌套字体，并保留字号、粗细、颜色、图片和布局', () => {
  const root = editor(`<section style='display:flex;font-family:${SERIF_FONT}'><h2 style='font:italic 700 36px "Noto Serif SC Variable";color:#16763b'><span style='font-family:${SERIF_FONT} !important'>更多精彩</span></h2><font face="Arial">ART</font><img src="data:image/png;base64,YQ==" width="90"></section>`);
  const image = root.querySelector('img').outerHTML;
  const range = root.ownerDocument.createRange();
  range.setStart(root.querySelector('span').firstChild, 2);
  range.collapse(true);
  assert.equal(applyFontFamily(root, range, SANS_FONT), true);
  assert.equal(root.textContent, '更多精彩ART');
  for (const el of [root, ...root.querySelectorAll('section,h2,span')])
    assert.equal(el.style.fontFamily, SANS_FONT);
  assert.equal(root.querySelector('h2').style.fontSize, '36px');
  assert.equal(root.querySelector('h2').style.fontWeight, '700');
  assert.equal(root.querySelector('h2').style.fontStyle, 'italic');
  assert.equal(root.querySelector('h2').style.color, 'rgb(22, 118, 59)');
  assert.equal(root.querySelector('section').style.display, 'flex');
  assert.equal(root.querySelector('font').getAttribute('face'), SANS_FONT);
  assert.equal(root.querySelector('img').outerHTML, image);
});

test('选中文字只修改选区，已有内层字体不再覆盖选择，并可反向切换', () => {
  const root = editor(`<p style='font-family:${SERIF_FONT};color:orange'><strong style='font-family:${SERIF_FONT}'>参与机构、活动地点</strong></p>`);
  const text = root.querySelector('strong').firstChild;
  const range = root.ownerDocument.createRange();
  range.setStart(text, 1);
  range.setEnd(text, 4);
  assert.equal(applyFontFamily(root, range, SANS_FONT), false);
  assert.equal(range.toString(), '与机构');
  assert.equal(root.textContent, '参与机构、活动地点');
  assert.equal(root.querySelector('span').style.fontFamily, SANS_FONT);
  assert.equal(root.querySelector('strong').firstChild.textContent, '参');
  assert.equal(root.querySelector('strong').lastChild.textContent, '、活动地点');
  assert.equal(root.querySelector('strong').style.fontFamily, SERIF_FONT);
  assert.equal(root.querySelector('p').style.color, 'orange');
  applyFontFamily(root, range, SERIF_FONT);
  assert.equal(range.toString(), '与机构');
  assert.equal(range.startContainer.parentElement.style.fontFamily, SERIF_FONT);
});

test('跨段选区保留段落、链接和图片，不把整段嵌进行内标签', () => {
  const root = editor('<p><a href="https://example.com">第一段</a></p><img src="/assets/test.png"><p><b>第二段</b></p>');
  const range = root.ownerDocument.createRange();
  range.setStart(root.querySelector('a').firstChild, 1);
  range.setEnd(root.querySelector('b').firstChild, 2);
  applyFontFamily(root, range, SANS_FONT);
  assert.deepEqual([...root.children].map(el => el.tagName), ['P', 'IMG', 'P']);
  assert.equal(root.querySelector('a').href, 'https://example.com/');
  assert.equal(root.querySelector('b').textContent, '第二段');
  assert.equal(root.querySelectorAll('span p,span img').length, 0);
  assert.equal(range.toString(), '一段第二');
});

test('工具栏显示光标处真实字体，混合选区显示多种字体', () => {
  const root = editor(`<p><span style='font-family:${SERIF_FONT}'>宋体</span><span style='font-family:${SANS_FONT}'>黑体</span></p>`);
  const range = root.ownerDocument.createRange();
  range.setStart(root.querySelector('span').firstChild, 1);
  range.collapse(true);
  assert.equal(selectionFont(root, range), SERIF_FONT);
  range.selectNodeContents(root);
  assert.equal(selectionFont(root, range), MIXED_FONT);
  applyFontFamily(root, null, SANS_FONT);
  assert.equal(selectionFont(root, null), SANS_FONT);
});
