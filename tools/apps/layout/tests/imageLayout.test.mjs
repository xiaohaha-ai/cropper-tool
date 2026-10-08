import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { applyImageLayout, resizeImage, visibleImageWidth } from '../src/imageLayout.ts';

const layout = { width: 100, height: 150, fit: 'contain', alignment: 'center', containerWidth: 619, aspectRatio: 3840 / 2160 };

test('固定高度完整显示的图片，放大从实际可见尺寸开始并恢复原比例', () => {
  const width = visibleImageWidth(layout);
  assert.equal(width, 43.1);
  const resized = resizeImage(layout, width + 10);
  assert.equal(resized.width, 53.1);
  assert.equal(resized.height, 0);
  assert.equal(visibleImageWidth(resized), 53.1);
  assert.equal(layout.height, 150);
  assert.equal(resizeImage(layout, 500).width, 100);
  assert.equal(resizeImage(layout, -10).width, 1);
  assert.equal(resizeImage(layout, NaN).width, 100);
});

test('三种图片对齐同时设置图片边距与框内位置，正文和其他图片保持原样', () => {
  for (const alignment of ['left', 'center', 'right']) {
    const doc = new JSDOM('<div><p>说明文字</p><img src="first.png" style="width:100%;height:150px;object-fit:contain"><img src="second.png"></div>').window.document;
    const [image, other] = doc.querySelectorAll('img');
    const beforeOther = other.outerHTML;
    applyImageLayout(image, { ...layout, alignment, width: 60 }, '');
    assert.equal(image.style.width, '60%');
    assert.equal(image.style.marginLeft, alignment === 'left' ? '0px' : 'auto');
    assert.equal(image.style.marginRight, alignment === 'right' ? '0px' : 'auto');
    assert.equal(image.style.objectPosition, `${alignment} center`);
    assert.equal(other.outerHTML, beforeOther);
    assert.equal(doc.querySelector('p').textContent, '说明文字');
  }
});

test('带链接图片重复应用宽度不累乘百分比，移除链接保留同链接内其他内容', () => {
  const doc = new JSDOM('<div><a href="old"><span>保留说明</span><img src="first.png"></a></div>').window.document;
  const image = doc.querySelector('img');
  const next = { ...layout, width: 50, height: 0, alignment: 'right' };
  applyImageLayout(image, next, 'https://example.com/image');
  applyImageLayout(image, next, 'https://example.com/image');
  assert.equal(doc.querySelectorAll('a').length, 1);
  assert.equal(image.parentElement.style.width, '50%');
  assert.equal(image.style.width, '100%');
  assert.equal(image.style.height, 'auto');
  assert.equal(doc.querySelector('span').textContent, '保留说明');
  applyImageLayout(image, next, '');
  assert.equal(doc.querySelectorAll('a').length, 0);
  assert.equal(image.style.width, '50%');
  assert.equal(doc.querySelector('span').textContent, '保留说明');
});
