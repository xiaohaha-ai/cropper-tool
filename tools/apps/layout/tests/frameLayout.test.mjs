import test from 'node:test';
import assert from 'node:assert/strict';
import { cropFrame, dragCrop, normalizeFrame, resizeFrame } from '../src/frameLayout.ts';

const original = () => ({ width: 100, left: 0, sourceWidth: 720, sourceHeight: 160, crop: { x: 0, y: 0, width: 720, height: 160 } });
test('外框拖角等比例缩放，限制版面宽度，保留原始尺寸及裁切坐标', () => {
  const frame = original();
  const resized = resizeFrame(frame, 'se', -180, -40, 720, 160);
  assert.equal(resized.width, 75);
  assert.equal(resized.left, 0);
  assert.deepEqual(resized.crop, frame.crop);
  assert.equal(resizeFrame(frame, 'se', 100, 100, 720, 160).width, 100);
  const fromLeft = resizeFrame(frame, 'nw', 180, 40, 720, 160);
  assert.equal(fromLeft.left, 25);
  assert.equal(fromLeft.left + fromLeft.width, 100);
  assert.ok(resizeFrame(frame, 'se', -900, -300, 720, 160).width > 0);
});
test('四边裁切移除留白，裁切窗口移动不越界、不反转', () => {
  const bounds = original().crop;
  let rect = dragCrop(bounds, bounds, 'n', 0, 30);
  rect = dragCrop(rect, bounds, 's', 0, -40);
  rect = dragCrop(rect, bounds, 'w', 60, 0);
  rect = dragCrop(rect, bounds, 'e', -60, 0);
  assert.deepEqual(rect, { x: 60, y: 30, width: 600, height: 90 });
  assert.deepEqual(dragCrop(rect, bounds, 'move', 1000, 1000), { x: 120, y: 70, width: 600, height: 90 });
  const minimum = dragCrop(rect, bounds, 'nw', 1000, 1000);
  assert.equal(minimum.width, 16);
  assert.equal(minimum.height, 16);
  const cropped = cropFrame(original(), rect);
  assert.equal(cropped.width, 100 * 600 / 720);
  assert.equal(cropped.left, 100 * 60 / 720);
  assert.equal(cropped.sourceWidth, 720);
  const again = cropFrame(cropped, { x: 90, y: 40, width: 500, height: 70 });
  assert.ok(Math.abs(again.width - 100 * 500 / 720) < 1e-10);
  assert.ok(Math.abs(again.left - 12.5) < 1e-10);
});
test('导入裁切参数限制尺寸和偏移，拒绝无效数值', () => {
  assert.equal(normalizeFrame(undefined), undefined);
  assert.equal(normalizeFrame({ ...original(), width: NaN }), undefined);
  assert.equal(normalizeFrame({ ...original(), crop: { x: 0, y: 0, width: -1, height: 100 } }), undefined);
  const bounded = normalizeFrame({ ...original(), width: 200, left: -30, crop: { x: -100, y: 80, width: 9999, height: 9999 } });
  assert.deepEqual(bounded, { ...original(), crop: { x: 0, y: 80, width: 720, height: 80 } });
});
