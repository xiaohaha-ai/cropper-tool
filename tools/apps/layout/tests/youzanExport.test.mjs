import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('', { url: 'http://localhost:5174/' });
globalThis.window = dom.window;
globalThis.DOMParser = dom.window.DOMParser;
const { publicImageUrl, resolveYouzanImages, verifyImageLinks } = await import('../src/youzanExport.ts');

test('有赞图片地址必须可对外访问，拒绝内嵌、临时、本机和带凭证的地址', () => {
  for (const url of ['data:image/png;base64,YQ==', 'blob:https://example.com/123', '/assets/test.png', 'http://example.com/photo.png', 'https://127.0.0.1/a.png', 'https://10.1.1.1/a.png', 'https://localhost/a.png', 'https://foo.local/a.png', 'https://user:password@example.com/a.png'])
    assert.equal(publicImageUrl(url), '', url);
  assert.equal(publicImageUrl(' https://img.yzcdn.cn/photo.png '), 'https://img.yzcdn.cn/photo.png');
});

test('缺少任何图片地址就阻止复制，映射后没有内嵌资源且保留同图多次使用', () => {
  const prepared = { html: '<p>首段</p><img data-youzan-image="a" src="data:image/png;base64,YQ=="><img data-youzan-image="b" src="blob:local"><img data-youzan-image="a" src="data:image/png;base64,YQ=="><p>末段</p>', images: [], flattened: 0 };
  assert.throws(() => resolveYouzanImages(prepared, { a: 'https://img.yzcdn.cn/a.png' }), /每张图片/);
  const result = resolveYouzanImages(prepared, { a: 'https://img.yzcdn.cn/a.png', b: 'https://img.yzcdn.cn/b.png' });
  assert.doesNotMatch(result, /data:image|blob:|data-youzan-image/);
  assert.equal((result.match(/https:\/\/img.yzcdn.cn\/a.png/g) || []).length, 2);
  assert.match(result, /首段/);
  assert.match(result, /末段/);
});

test('验证图片直链失败必须阻止准备复制，不能仅凭 URL 格式报告成功', async () => {
  const prepared = { images: [{ id: 'a', name: '蝴蝶', src: '', filename: '' }], html: '', flattened: 0 };
  globalThis.Image = class { set src(value) { if (value) queueMicrotask(() => this.onerror()); } };
  await assert.rejects(verifyImageLinks(prepared, { a: 'https://img.yzcdn.cn/missing.png' }), /蝴蝶.*无法打开/);
  globalThis.Image = class { set src(value) { if (value) queueMicrotask(() => this.onload()); } };
  await verifyImageLinks(prepared, { a: 'https://img.yzcdn.cn/photo.png' });
});
