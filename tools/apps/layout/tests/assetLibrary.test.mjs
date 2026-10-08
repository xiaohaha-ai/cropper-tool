import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteAssetGroup, deleteAssets, groupNameError, moveAssets, restoreAssets, validAssetGroups } from '../src/assetLibraryState.ts';

const library = () => ({ groups: [{ id: 'qr', name: '二维码' }, { id: 'poster', name: '海报' }], assets: [
  { id: 'a', name: 'a.png', src: 'data:image/png;base64,YQ==', type: 'image', groupId: 'qr' },
  { id: 'b', name: 'b.mp3', src: 'data:audio/mpeg;base64,Yg==', type: 'audio' },
  { id: 'c', name: 'c.png', src: 'https://example.com/c.png', type: 'image', groupId: 'qr' },
] });

test('旧图库兼容未分组，失效分组归回未分组，不改变素材内容', () => {
  const assets = library().assets;
  const normalized = validAssetGroups(assets, []);
  assert.deepEqual(normalized.map(a => a.groupId), [undefined, undefined, undefined]);
  assert.deepEqual(normalized.map(a => a.src), assets.map(a => a.src));
  assert.equal(assets[0].groupId, 'qr');
});

test('分组删除只移除分类，批量移动只修改选中的素材且保留原状态', () => {
  const original = library();
  const before = structuredClone(original);
  const moved = moveAssets(original, ['a', 'b'], 'poster');
  assert.deepEqual(moved.assets.map(a => a.groupId), ['poster', 'poster', 'qr']);
  assert.deepEqual(moveAssets(original, ['a'], 'missing'), original);
  const removed = deleteAssetGroup(moved, 'poster');
  assert.equal(removed.assets.length, 3);
  assert.deepEqual(removed.assets.map(a => a.groupId), [undefined, undefined, 'qr']);
  assert.deepEqual(removed.assets.map(a => a.src), original.assets.map(a => a.src));
  assert.deepEqual(original, before);
});

test('批量删除可恢复原顺序，撤销不会丢掉随后上传的素材或恢复已经删除的分组', () => {
  const original = library();
  const removed = deleteAssets(original, ['a', 'c']);
  assert.deepEqual(removed.assets.map(a => a.id), ['b']);
  assert.deepEqual(restoreAssets(removed).assets, original.assets);
  const withUpload = { ...deleteAssetGroup(removed, 'qr'), assets: [...removed.assets, { id: 'new', name: 'new.png', type: 'image', src: 'new' }] };
  const restored = restoreAssets(withUpload);
  assert.equal(restored.assets.length, 4);
  assert.ok(restored.assets.some(a => a.id === 'new'));
  assert.ok(restored.assets.every(a => !a.groupId));
  assert.equal(restored.lastDeleted, undefined);
  assert.deepEqual(restoreAssets(restored), restored);
});

test('分组名称校验空白、重名、保留名称和长度，允许原名保存', () => {
  const groups = library().groups;
  assert.match(groupNameError('  ', groups), /请输入/);
  assert.match(groupNameError(' 二维码 ', groups), /同名/);
  assert.match(groupNameError('未分组', groups), /换一个/);
  assert.match(groupNameError('长'.repeat(25), groups), /24/);
  assert.equal(groupNameError(' 二维码 ', groups, 'qr'), '');
  assert.equal(groupNameError('Logo', groups), '');
});
