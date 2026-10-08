import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent, type CSSProperties } from 'react';
import { Plus, UploadSimple, ArrowUp, ArrowDown, Copy, Trash, ArrowCounterClockwise, ArrowClockwise } from '@phosphor-icons/react';
import { arrangeText, boundLayer, layerContent, makeLayer, type Composition, type Layer } from './composition';
import { FONT_OPTIONS } from './fonts';
import { loadContentFont } from './fontLoading';
import { uid, type Asset } from './model';
import { useFileDrop } from './useFileDrop';
import { sameState } from './articleState';

const visualKeys = ['kind', 'text', 'html', 'src', 'name', 'link', 'fit', 'fontFamily', 'fontSize', 'bold', 'color', 'align', 'background', 'opacity'] as const;
const LayerVisual = memo(function LayerVisual({ layer: l }: { layer: Layer }) {
  const content = useMemo(() => ({ __html: layerContent(l) }), [l.kind, l.text, l.html, l.src, l.name, l.link, l.fit]);
  return <div className="composition-layer-content" style={{ fontFamily: l.fontFamily, fontSize: l.fontSize, fontWeight: l.bold ? 700 : 400, color: l.color, textAlign: l.align, background: l.background, opacity: l.opacity, whiteSpace: l.kind === 'text' ? 'pre-wrap' : 'normal' }} dangerouslySetInnerHTML={content} />;
}, (previous, next) => visualKeys.every(key => previous.layer[key] === next.layer[key]));

type Props = { initial: Composition; assets: Asset[]; onSave: (canvas: Composition) => void; onCancel: () => void; onAssets: (assets: Asset[]) => void };
export function CompositionEditor({ initial, assets, onSave, onCancel, onAssets }: Props) {
  const [draft, setDraft] = useState(initial);
  const current = useRef(draft); current.current = draft;
  const [selected, setSelected] = useState(initial.layers.at(-1)?.id || '');
  const [past, setPast] = useState<Composition[]>([]), [future, setFuture] = useState<Composition[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [scale, setScale] = useState(1);
  const stage = useRef<HTMLDivElement>(null), area = useRef<HTMLDivElement>(null), fileInput = useRef<HTMLInputElement>(null), textInput = useRef<HTMLTextAreaElement>(null);
  const alive = useRef(true), fontRequest = useRef(0);
  useEffect(() => { alive.current = true; return () => { alive.current = false; fontRequest.current++; }; }, []);
  useLayoutEffect(() => {
    if (!area.current) return;
    const fit = () => setScale(Math.min(1, Math.max(.15, ((area.current?.clientWidth || draft.width) - 40) / draft.width)));
    fit(); const observer = new ResizeObserver(fit); observer.observe(area.current);
    return () => observer.disconnect();
  }, [draft.width]);
  const commit = (next: Composition) => {
    const previous = current.current;
    if (sameState(next, previous)) return;
    current.current = next;
    setPast(p => [...p, previous].slice(-50)); setFuture([]); setDraft(next);
  };
  const patch = (id: string, values: Partial<Layer>) => commit({ ...current.current, layers: current.current.layers.map(l => l.id === id ? boundLayer({ ...l, ...values }, current.current) : l) });
  const layer = draft.layers.find(l => l.id === selected);
  const undo = () => { if (past.length) { const previous = current.current; setFuture(f => [previous, ...f]); setDraft(past.at(-1)!); setPast(p => p.slice(0, -1)); } };
  const redo = () => { if (future.length) { const previous = current.current; setPast(p => [...p, previous]); setDraft(future[0]); setFuture(f => f.slice(1)); } };
  const drag = useRef<{ id: string; pointer: number; mode: 'move' | 'resize'; x: number; y: number; scale: number; base: Composition } | null>(null);
  const dragFrame = useRef<number | null>(null), pendingDrag = useRef<Composition | null>(null);
  const clearDragFrame = () => {
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null; pendingDrag.current = null;
  };
  useEffect(() => () => { clearDragFrame(); drag.current = null; }, []);
  const cancelDrag = () => {
    clearDragFrame();
    if (drag.current) { current.current = drag.current.base; setDraft(drag.current.base); }
    drag.current = null;
  };
  const startDrag = (event: PointerEvent<HTMLElement>, id: string, mode: 'move' | 'resize') => {
    if (event.button !== 0) return;
    event.preventDefault(); event.stopPropagation(); setSelected(id);
    drag.current = { id, pointer: event.pointerId, mode, x: event.clientX, y: event.clientY, scale: stage.current!.getBoundingClientRect().width / draft.width, base: current.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragPosition = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return null;
    const dx = (event.clientX - d.x) / d.scale, dy = (event.clientY - d.y) / d.scale;
    return { ...d.base, layers: d.base.layers.map(l => {
      if (l.id !== d.id) return l;
      const next = d.mode === 'move' ? { ...l, x: l.x + dx, y: l.y + dy } : { ...l, width: Math.min(d.base.width - l.x, l.width + dx), height: Math.min(d.base.height - l.y, l.height + dy) };
      return boundLayer(next, d.base);
    }) };
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const next = dragPosition(event);
    if (!next) return;
    event.preventDefault(); event.stopPropagation(); pendingDrag.current = next;
    if (dragFrame.current !== null) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = null;
      if (pendingDrag.current) { current.current = pendingDrag.current; setDraft(pendingDrag.current); pendingDrag.current = null; }
    });
  };
  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointer !== event.pointerId) return;
    event.stopPropagation();
    // Flush the release position even when the last move has not painted yet.
    const next = dragPosition(event)!;
    clearDragFrame(); drag.current = null; current.current = next; setDraft(next);
    if (!sameState(next, d.base)) { setPast(p => [...p, d.base].slice(-50)); setFuture([]); }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const pointerEvents = { onPointerMove: moveDrag, onPointerUp: endDrag, onPointerCancel: cancelDrag, onLostPointerCapture: () => { if (drag.current) cancelDrag(); } };
  const remove = () => { if (layer) { commit({ ...draft, layers: draft.layers.filter(l => l.id !== layer.id) }); setSelected(''); } };
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drag.current) { e.preventDefault(); e.stopImmediatePropagation(); cancelDrag(); return; }
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.stopImmediatePropagation(); e.shiftKey ? redo() : undo(); return; }
      if (!layer) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
      const step = e.shiftKey ? 10 : 1;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault(); patch(layer.id, { x: layer.x + (e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0), y: layer.y + (e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0) });
      }
    };
    window.addEventListener('keydown', keyboard, true); return () => window.removeEventListener('keydown', keyboard, true);
  });
  const add = (value: Layer) => { const next = boundLayer(value, current.current); commit({ ...current.current, layers: [...current.current.layers, next] }); setSelected(next.id); };
  const addImage = async (asset: Asset) => {
    const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight }); image.onerror = () => reject(new Error('图片无法读取')); image.src = asset.src;
    });
    const width = Math.min(current.current.width * .55, size.width), height = Math.min(current.current.height * .8, width * size.height / size.width);
    return makeLayer('image', { name: asset.name, src: asset.src, width, height });
  };
  const upload = async (files: File[]) => {
    if (busy || !files.length) return;
    setBusy(true); setError('');
    try {
      const additions: Asset[] = [], layers: Layer[] = [];
      for (const file of files) {
        if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 20 * 1024 * 1024) throw new Error('请使用 20 MB 以内的 JPG、PNG、WebP 或 GIF 图片');
        const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('图片读取失败')); reader.readAsDataURL(file); });
        const asset: Asset = { id: uid(), type: 'image', name: file.name, src };
        additions.push(asset); layers.push(await addImage(asset));
      }
      if (!alive.current) return;
      onAssets(additions); commit({ ...current.current, layers: [...current.current.layers, ...layers.map(l => boundLayer(l, current.current))] }); setSelected(layers.at(-1)!.id);
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : '图片上传失败'); }
    finally { if (alive.current) setBusy(false); }
  };
  const fileDrop = useFileDrop(files => void upload(files));
  const arrange = (mode: 'left' | 'overlay') => { const next = arrangeText(draft, mode); commit(next); setSelected(next.layers.find(l => l.kind === 'text')!.id); };
  const reorder = (direction: number) => {
    if (!layer) return;
    const items = [...draft.layers], from = items.findIndex(l => l.id === selected), to = Math.max(0, Math.min(items.length - 1, from + direction));
    items.splice(from, 1); items.splice(to, 0, layer); commit({ ...draft, layers: items });
  };
  const font = async (value: string) => {
    if (!layer) return;
    const id = layer.id, request = ++fontRequest.current; setBusy(true); setError('');
    try { await loadContentFont(stage.current!, value); if (alive.current && request === fontRequest.current) patch(id, { fontFamily: value }); }
    catch { if (alive.current) setError('字体加载失败，请重试'); }
    finally { if (alive.current && request === fontRequest.current) setBusy(false); }
  };
  const numeric = (label: string, key: 'x' | 'y' | 'width' | 'height') => layer && <label>{label}<input aria-label={`图层${label}`} type="number" min={key === 'x' || key === 'y' ? 0 : 16} value={Math.round(layer[key])} onChange={e => patch(layer.id, { [key]: Number(e.target.value) })} /></label>;
  return <div className="composition-editor">
    <div className="composition-tools">
      <button onClick={() => add(makeLayer('text'))}><Plus size={16} />添加文字</button>
      <button disabled={busy} onClick={() => fileInput.current?.click()}><UploadSimple size={16} />上传图片</button>
      <select aria-label="从图库添加图片" value="" disabled={busy} onChange={async e => { const asset = assets.find(a => a.id === e.target.value); if (asset) { setBusy(true); try { const next = await addImage(asset); if (alive.current) add(next); } catch { setError('图片无法读取'); } finally { if (alive.current) setBusy(false); } } }}><option value="">从图库添加</option>{assets.filter(a => a.type === 'image').map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <button onClick={() => arrange('left')}>左文右图</button><button onClick={() => arrange('overlay')}>文字叠加</button>
      <button title="撤销图层操作" disabled={!past.length} onClick={undo}><ArrowCounterClockwise size={16} /></button><button title="重做图层操作" disabled={!future.length} onClick={redo}><ArrowClockwise size={16} /></button>
      <input ref={fileInput} hidden type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple onChange={e => { void upload(Array.from(e.target.files || [])); e.target.value = ''; }} />
    </div>
    <div className="composition-workspace">
      <div ref={area} className={`composition-area ${fileDrop.draggingFiles ? 'is-dropping' : ''}`} onDragEnter={fileDrop.onDragEnter} onDragOver={fileDrop.onDragOver} onDragLeave={fileDrop.onDragLeave} onDrop={fileDrop.onDrop}>
        <p className="composition-hint">拖动图层自由排列 · 拖右下角调整大小 · 双击文字编辑</p>
        <div className="composition-stage-wrap" style={{ width: draft.width * scale, height: draft.height * scale }}>
          <div ref={stage} className="composition-stage" style={{ width: draft.width, height: draft.height, transform: `scale(${scale})`, '--layer-ui-scale': 1 / scale } as CSSProperties} onPointerDown={e => { if (e.target === e.currentTarget) setSelected(''); }}>
            {draft.layers.map((l, index) => <div key={l.id} className={`composition-layer ${selected === l.id ? 'selected' : ''}`} data-layer-id={l.id} aria-label={`图层：${l.name}`} tabIndex={0}
              style={{ left: l.x, top: l.y, width: l.width, height: l.height, zIndex: index + 1 }} onPointerDown={e => startDrag(e, l.id, 'move')} {...pointerEvents}
              onDoubleClick={() => { setSelected(l.id); if (l.kind === 'text') textInput.current?.focus(); }}>
              <LayerVisual layer={l} />
            </div>)}
            {layer && <div className="composition-layer-selection" style={{ left: layer.x, top: layer.y, width: layer.width, height: layer.height }}>
              <button aria-label="调整图层大小" className="composition-resize" onPointerDown={e => startDrag(e, layer.id, 'resize')} {...pointerEvents} />
            </div>}
          </div>
        </div>
        {!draft.layers.length && <p className="composition-empty">添加文字，或把图片拖到这里</p>}
        <label className="composition-height">组合高度<input aria-label="组合高度" type="number" min="80" max="3000" value={draft.height} onChange={e => { const height = Math.max(80, Math.min(3000, Number(e.target.value))); commit({ ...draft, height, layers: draft.layers.map(l => boundLayer(l, { ...draft, height })) }); }} />px</label>
      </div>
      <aside className="composition-properties">
        <h3>图层 <small>上方显示在最前</small></h3>
        <div className="composition-layer-list">{[...draft.layers].reverse().map(l => <button key={l.id} className={selected === l.id ? 'active' : ''} onClick={() => setSelected(l.id)}><span>{l.kind === 'text' ? '文' : l.kind === 'image' ? '图' : '组'}</span>{l.kind === 'text' ? l.text.slice(0, 18) || '文字' : l.name}</button>)}</div>
        {layer && <>
          <div className="composition-order"><button title="上移一层" onClick={() => reorder(1)}><ArrowUp size={14} /></button><button title="下移一层" onClick={() => reorder(-1)}><ArrowDown size={14} /></button><button onClick={() => reorder(draft.layers.length)}>置顶</button><button onClick={() => reorder(-draft.layers.length)}>置底</button><button title="复制图层" onClick={() => add({ ...layer, id: uid(), x: layer.x + 12, y: layer.y + 12 })}><Copy size={14} /></button><button title="删除图层" onClick={remove}><Trash size={14} /></button></div>
          <div className="composition-fields">{numeric('横坐标', 'x')}{numeric('纵坐标', 'y')}{numeric('宽度', 'width')}{numeric('高度', 'height')}</div>
          <div className="composition-align"><button onClick={() => patch(layer.id, { x: 0 })}>靠左</button><button onClick={() => patch(layer.id, { x: (draft.width - layer.width) / 2 })}>居中</button><button onClick={() => patch(layer.id, { x: draft.width - layer.width })}>靠右</button><button onClick={() => patch(layer.id, { y: 0 })}>顶部</button><button onClick={() => patch(layer.id, { y: (draft.height - layer.height) / 2 })}>垂直居中</button><button onClick={() => patch(layer.id, { y: draft.height - layer.height })}>底部</button></div>
          {layer.kind === 'text' && <>
            <label>文字内容<textarea ref={textInput} aria-label="图层文字" value={layer.text} onChange={e => patch(layer.id, { text: e.target.value })} /></label>
            <label>字体<select aria-label="图层字体" value={layer.fontFamily} disabled={busy} onChange={e => void font(e.target.value)}>{FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
            <div className="composition-fields"><label>字号<input aria-label="图层字号" type="number" min="10" max="160" value={layer.fontSize} onChange={e => patch(layer.id, { fontSize: Number(e.target.value) })} /></label><label>颜色<input aria-label="文字颜色" type="color" value={/^#[\da-f]{6}$/i.test(layer.color) ? layer.color : '#333333'} onChange={e => patch(layer.id, { color: e.target.value })} /></label></div>
            <div className="composition-align"><button aria-pressed={layer.bold} onClick={() => patch(layer.id, { bold: !layer.bold })}>加粗</button>{(['left', 'center', 'right'] as const).map((a, i) => <button key={a} aria-pressed={layer.align === a} onClick={() => patch(layer.id, { align: a })}>{['文字居左', '文字居中', '文字居右'][i]}</button>)}</div>
          </>}
          {layer.kind === 'image' && <label>图片显示<select aria-label="图层图片显示" value={layer.fit} onChange={e => patch(layer.id, { fit: e.target.value as Layer['fit'] })}><option value="contain">完整显示</option><option value="cover">裁切铺满</option></select></label>}
          <label>图层背景<div className="composition-background"><input aria-label="图层背景色" type="color" value={/^#[\da-f]{6}$/i.test(layer.background) ? layer.background : '#ffffff'} onChange={e => patch(layer.id, { background: e.target.value })} /><button onClick={() => patch(layer.id, { background: 'transparent' })}>透明</button></div></label>
          <label>透明度<input aria-label="图层透明度" type="range" min="0" max="1" step=".05" value={layer.opacity} onChange={e => patch(layer.id, { opacity: Number(e.target.value) })} /></label>
        </>}
      </aside>
    </div>
    <div className="composition-footer">{error ? <span role="alert">{error}</span> : <span>{busy ? '正在加载…' : '文字和图片可自由叠放，保存后仍可继续编辑'}</span>}<button className="secondary" onClick={onCancel}>取消</button><button className="primary" disabled={busy || !draft.layers.length} onClick={() => onSave(draft)}>应用组合</button></div>
  </div>;
}
