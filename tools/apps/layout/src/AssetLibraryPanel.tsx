import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { FolderPlus, MusicNote, Plus, Trash, UploadSimple, VideoCamera } from "@phosphor-icons/react";
import { type Asset, uid } from "./model";
import { deleteAssetGroup, deleteAssets, groupNameError, moveAssets, restoreAssets, type AssetLibraryState } from "./assetLibraryState";
import { useFileDrop } from "./useFileDrop";

type Props = {
  title: string;
  library: AssetLibraryState;
  onChange: Dispatch<SetStateAction<AssetLibraryState>>;
  filter: string;
  onFilter: (filter: string) => void;
  onInsert: (asset: Asset) => void;
  onUpload: () => void;
  onDropImages: (files: File[]) => void;
  onMedia: () => void;
  notify: (message: string) => void;
};

export function AssetLibrary({ title, library, onChange, filter, onFilter, onInsert, onUpload, onDropImages, onMedia, notify }: Props) {
  const { assets, groups } = library;
  const [managing, setManaging] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [form, setForm] = useState<{ kind: "create" | "rename" | "delete"; id?: string } | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const filterControl = useRef<HTMLSelectElement>(null);
  const { draggingFiles, ...dropHandlers } = useFileDrop((files) => {
    filterControl.current?.focus();
    onDropImages(files);
  });
  const currentGroup = groups.find((group) => group.id === filter);
  const visible = assets.filter((asset) => filter === "all" || (filter === "ungrouped" ? !asset.groupId : asset.groupId === filter));
  const chosen = selected.filter((id) => visible.some((asset) => asset.id === id));
  const allSelected = visible.length > 0 && chosen.length === visible.length;
  const toggle = (id: string) => setSelected((previous) => previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id]);
  const openForm = (kind: "create" | "rename" | "delete") => {
    setForm({ kind, id: kind === "create" ? undefined : currentGroup?.id });
    setName(kind === "create" ? "" : currentGroup?.name || "");
    setError("");
  };
  const changeFilter = (next: string) => {
    filterControl.current?.focus();
    onFilter(next);
    setSelected([]);
    setForm(null);
    setError("");
  };
  const remove = (ids: string[]) => {
    filterControl.current?.focus();
    onChange((state) => deleteAssets(state, ids));
    setSelected([]);
  };
  const move = (ids: string[], groupId: string) => {
    filterControl.current?.focus();
    onChange((state) => moveAssets(state, ids, groupId));
    setSelected([]);
    notify(`已移动 ${ids.length} 个素材到${groups.find((group) => group.id === groupId)?.name || "未分组"}`);
  };
  const groupOptions = <>
    <option value="">未分组</option>
    {groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
  </>;
  return <section className={`asset-library ${draggingFiles ? "file-drop-active" : ""}`} aria-label={`${title}管理`} {...dropHandlers}>
    {draggingFiles && <div className="file-drop-notice" role="status">松开上传到{currentGroup ? `“${currentGroup.name}”` : "未分组"}</div>}
    <div className="panel-title">{title}<span>{assets.length}</span></div>
    <div className="asset-actions">
      <button className="tiny-outline" onClick={onUpload}><UploadSimple size={15} />上传图片</button>
      <button className="tiny-outline" onClick={onMedia}><MusicNote size={15} />音视频</button>
      <button className={`tiny-outline ${managing ? "is-active" : ""}`} aria-pressed={managing} onClick={() => { setManaging(!managing); setSelected([]); }}>{managing ? "完成管理" : "批量管理"}</button>
    </div>
    <div className="asset-group-filter">
      <select ref={filterControl} aria-label="图库分组" value={filter} onChange={(event) => changeFilter(event.target.value)}>
        <option value="all">全部素材（{assets.length}）</option>
        <option value="ungrouped">未分组（{assets.filter((asset) => !asset.groupId).length}）</option>
        {groups.map((group) => <option key={group.id} value={group.id}>{group.name}（{assets.filter((asset) => asset.groupId === group.id).length}）</option>)}
      </select>
      <button className="tiny-outline" onClick={() => openForm("create")}><FolderPlus size={15} />新建分组</button>
    </div>
    {currentGroup && <div className="asset-group-actions">
      <button onClick={() => openForm("rename")}>重命名分组</button>
      <button onClick={() => openForm("delete")}>删除分组</button>
    </div>}
    {form && <form className="asset-group-form" onSubmit={(event) => {
      event.preventDefault();
      if (form.kind === "delete") {
        onChange((state) => deleteAssetGroup(state, form.id!));
        changeFilter("ungrouped");
        notify("分组已删除，素材已放回未分组");
        return;
      }
      const message = groupNameError(name, groups, form.id);
      if (message) { setError(message); return; }
      const id = form.id || uid();
      onChange((state) => ({ ...state, groups: form.kind === "create"
        ? [...state.groups, { id, name: name.trim() }]
        : state.groups.map((group) => group.id === id ? { ...group, name: name.trim() } : group) }));
      changeFilter(id);
      notify(form.kind === "create" ? "分组已创建，可在这里上传素材" : "分组名称已更新");
    }}>
      {form.kind === "delete" ? <p>删除“{name}”分组？其中的素材会放回“未分组”。</p> : <label>
        {form.kind === "create" ? "新建分组" : "重命名分组"}
        <input autoFocus aria-label="分组名称" value={name} maxLength={24} placeholder="例如：二维码、海报、品牌标志" onChange={(event) => { setName(event.target.value); setError(""); }} />
      </label>}
      {error && <p className="asset-form-error" role="alert">{error}</p>}
      <div><button className="tiny-outline" type="submit">{form.kind === "delete" ? "确定删除分组" : "保存分组"}</button><button type="button" onClick={() => { filterControl.current?.focus(); setForm(null); }}>取消</button></div>
    </form>}
    {managing ? <div className="asset-batch-tools">
      <div><label><input type="checkbox" aria-label="全选当前分组" checked={allSelected} disabled={!visible.length} onChange={() => setSelected(allSelected ? [] : visible.map((asset) => asset.id))} />全选当前组</label><span>已选 {chosen.length} 个</span></div>
      <div><select aria-label="批量移动到分组" value="choose" disabled={!chosen.length} onChange={(event) => move(chosen, event.target.value)}><option value="choose" disabled>移动到…</option>{groupOptions}</select>
        <button className="tiny-outline asset-delete-selected" disabled={!chosen.length} onClick={() => remove(chosen)}><Trash size={14} />删除选中</button></div>
    </div> : <p className="panel-hint">拖入图片上传 · 点击素材插入正文<br />可在缩略图下切换分组</p>}
    {!!library.lastDeleted?.length && <div className="asset-undo" role="status">
      <span>已从图库删除 {library.lastDeleted.length} 个素材<br /><small>已插入文章的内容仍保留</small></span>
      <button onClick={() => { onChange(restoreAssets); changeFilter("all"); }}>撤销删除</button>
    </div>}
    <div className="asset-grid">
      {!visible.length && <p className="asset-empty">{filter === "all" ? "图库还没有素材，上传图片开始整理" : "这个分组还没有素材，可上传或从其他分组移入"}</p>}
      {visible.map((asset) => <div className={`asset-card ${chosen.includes(asset.id) ? "is-selected" : ""}`} key={asset.id} data-asset-id={asset.id}>
        <button className="asset-item" onClick={() => managing ? toggle(asset.id) : onInsert(asset)} title={`${managing ? "选择" : "插入"} ${asset.name}`}>
          {asset.type === "image" ? <img src={asset.src} alt={asset.name} loading="lazy" /> : <div className="media-thumb">{asset.type === "audio" ? <MusicNote size={35} /> : <VideoCamera size={35} />}</div>}
          <span>{asset.name}</span>
        </button>
        {managing && <label className="asset-checkbox"><input type="checkbox" aria-label={`选择素材 ${asset.name}`} checked={chosen.includes(asset.id)} onChange={() => toggle(asset.id)} /></label>}
        <button className="asset-delete" aria-label={`删除素材 ${asset.name}`} title={`从图库删除 ${asset.name}`} onClick={() => remove([asset.id])}><Trash size={15} /></button>
        <select className="asset-card-group" aria-label={`素材分组 ${asset.name}`} value={asset.groupId || ""} onChange={(event) => move([asset.id], event.target.value)}>{groupOptions}</select>
      </div>)}
      <button className="upload-tile" onClick={onUpload}><Plus size={32} /><span>点击或拖拽上传图片</span><small>JPG / PNG / GIF / WebP · 单张 20 MB 内</small></button>
    </div>
  </section>;
}
