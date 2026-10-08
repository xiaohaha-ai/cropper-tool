import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFont } from '../src/fontLoading.ts';
import { FONT_OPTIONS } from '../src/fonts.ts';

test('同一字体真实字重共享加载；失败可重试，不把未注册字体当成已加载', async () => {
  const calls = [];
  let resolveLoad;
  globalThis.document = { fonts: { load: (query) => {
    calls.push(query);
    return new Promise(resolve => { resolveLoad = resolve; });
  } } };
  const first = loadFont(FONT_OPTIONS[0].value, 600);
  const second = loadFont(FONT_OPTIONS[0].value, 700);
  assert.equal(first, second);
  resolveLoad([{ status: 'loaded' }]);
  await first;
  await loadFont(FONT_OPTIONS[0].value, 600);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /^700 16px "Source Han Sans SC"$/);

  let attempts = 0;
  document.fonts.load = async () => ++attempts === 1 ? [] : [{ status: 'loaded' }];
  await assert.rejects(loadFont(FONT_OPTIONS[3].value), /加载失败/);
  await loadFont(FONT_OPTIONS[3].value);
  assert.equal(attempts, 2);
});

test('按实际文字加载，后续生僻字不能复用常用字的准备结果', async () => {
  const calls=[];
  globalThis.document={fonts:{load:async(query,text)=>{calls.push({query,text});return [{status:'loaded'}];}}};
  await loadFont(FONT_OPTIONS[0].value,400,'你好');
  await loadFont(FONT_OPTIONS[0].value,400,'龘你好');
  assert.equal(calls.length,2);
  assert.ok(calls[1].text.includes('龘'));
  await loadFont(FONT_OPTIONS[0].value,400,'好你龘');
  assert.equal(calls.length,2);
});

test('普惠体普通文字不强制加载生僻字；空扩展字库匹配不算失败', async () => {
  const calls=[];
  globalThis.document={fonts:{load:async(query,text)=>{calls.push(text);return query.includes('L3')?[]:[{status:'loaded'}];}}};
  await loadFont(FONT_OPTIONS[2].value,400,'Hello');
  assert.equal(calls.length,2);
  assert.ok(calls.every(text=>!text.includes('𠀀')));
});
