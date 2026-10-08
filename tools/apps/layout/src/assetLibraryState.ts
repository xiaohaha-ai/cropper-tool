import type { Asset } from "./model.ts";

export type AssetGroup = { id: string; name: string };
export type AssetLibraryState = {
  assets: Asset[];
  groups: AssetGroup[];
  lastDeleted?: { asset: Asset; index: number }[];
};

export function validAssetGroups(assets: Asset[], groups: AssetGroup[]): Asset[] {
  const ids = new Set(groups.map((group) => group.id));
  return assets.map((asset) => {
    if (!asset.groupId || ids.has(asset.groupId)) return asset;
    const { groupId: _groupId, ...ungrouped } = asset;
    return ungrouped;
  });
}

export function groupNameError(name: string, groups: AssetGroup[], editingId?: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "请输入分组名称";
  if (trimmed.length > 24) return "分组名称最多 24 个字";
  if (["全部素材", "未分组"].includes(trimmed)) return "请换一个分组名称";
  if (groups.some((group) => group.id !== editingId && group.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase()))
    return "已经有同名分组了";
  return "";
}

export function deleteAssetGroup(state: AssetLibraryState, id: string): AssetLibraryState {
  const groups = state.groups.filter((group) => group.id !== id);
  return { ...state, groups, assets: validAssetGroups(state.assets, groups) };
}

export function moveAssets(state: AssetLibraryState, ids: string[], groupId: string): AssetLibraryState {
  if (groupId && !state.groups.some((group) => group.id === groupId)) return state;
  const selected = new Set(ids);
  const assets = state.assets.map((asset) => {
    if (!selected.has(asset.id)) return asset;
    const { groupId: _previous, ...rest } = asset;
    return groupId ? { ...rest, groupId } : rest;
  });
  return { ...state, assets };
}

export function deleteAssets(state: AssetLibraryState, ids: string[]): AssetLibraryState {
  const selected = new Set(ids);
  const lastDeleted = state.assets.flatMap((asset, index) => selected.has(asset.id) ? [{ asset, index }] : []);
  if (!lastDeleted.length) return state;
  return { ...state, assets: state.assets.filter((asset) => !selected.has(asset.id)), lastDeleted };
}

export function restoreAssets(state: AssetLibraryState): AssetLibraryState {
  const assets = [...state.assets];
  for (const { asset, index } of state.lastDeleted || [])
    if (!assets.some((existing) => existing.id === asset.id)) assets.splice(Math.min(index, assets.length), 0, asset);
  return { ...state, assets: validAssetGroups(assets, state.groups), lastDeleted: undefined };
}
