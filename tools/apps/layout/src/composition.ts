import { escapeHtml, sanitize, safeUrl, uid, type Block } from './model.ts';
import { SANS_FONT, normalizeFontFamily } from './fonts.ts';

export type Layer = {
  id: string; kind: 'text' | 'image' | 'content'; name: string;
  x: number; y: number; width: number; height: number;
  text: string; src: string; html: string; link: string;
  fontFamily: string; fontSize: number; color: string; bold: boolean;
  align: 'left' | 'center' | 'right'; fit: 'contain' | 'cover';
  background: string; opacity: number;
};
export type Composition = { width: number; height: number; layers: Layer[] };
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const color = (value: string | undefined, fallback: string) => value && /^(#[\da-f]{3,8}|rgba?\([\d\s.,%]+\)|transparent)$/i.test(value) ? value : fallback;
export function makeLayer(kind: Layer['kind'], patch: Partial<Layer> = {}): Layer {
  return { id: uid(), kind, name: kind === 'text' ? '文字' : kind === 'image' ? '图片' : '原组件',
    x: 24, y: 24, width: 260, height: 110, text: '在这里输入文字', src: '', html: '', link: '',
    fontFamily: SANS_FONT, fontSize: 24, color: '#333333', bold: false, align: 'left', fit: 'contain',
    background: 'transparent', opacity: 1, ...patch };
}
export function boundLayer(layer: Layer, canvas: Pick<Composition, 'width' | 'height'>): Layer {
  const width = clamp(finite(layer.width, 120), 16, canvas.width);
  const height = clamp(finite(layer.height, 80), 16, canvas.height);
  return { ...layer, width, height, x: clamp(finite(layer.x, 0), 0, canvas.width - width),
    y: clamp(finite(layer.y, 0), 0, canvas.height - height), fontSize: clamp(finite(layer.fontSize, 24), 10, 160),
    opacity: clamp(finite(layer.opacity, 1), 0, 1), fontFamily: normalizeFontFamily(layer.fontFamily),
    color: color(layer.color, '#333333'), background: color(layer.background, 'transparent') };
}
export function layerContent(layer: Layer): string {
  if (layer.kind === 'text') return escapeHtml(layer.text);
  if (layer.kind === 'content') return sanitize(layer.html);
  const image = `<img src="${escapeHtml(safeUrl(layer.src, true))}" alt="${escapeHtml(layer.name)}" style="display:block;width:100%;height:100%;object-fit:${layer.fit};margin:0">`;
  return layer.link && safeUrl(layer.link) ? `<a href="${escapeHtml(safeUrl(layer.link))}" style="display:block;width:100%;height:100%">${image}</a>` : image;
}
export function compositionHtml(canvas: Composition): string {
  const layers = canvas.layers.map((raw, index) => {
    const l = boundLayer(raw, canvas);
    return `<div data-composition-layer="${l.kind}" data-layer-id="${escapeHtml(l.id)}" data-name="${escapeHtml(l.name)}" data-x="${l.x}" data-y="${l.y}" data-width="${l.width}" data-height="${l.height}" style="grid-area:1 / 1;position:relative;z-index:${index + 1};align-self:start;justify-self:start;box-sizing:border-box;min-width:0;width:${l.width / canvas.width * 100}%;height:${l.height}px;margin-left:${l.x / canvas.width * 100}%;margin-top:${l.y}px;overflow:hidden;white-space:${l.kind === 'text' ? 'pre-wrap' : 'normal'};overflow-wrap:anywhere;font-family:${escapeHtml(l.fontFamily)};font-size:${l.fontSize}px;font-weight:${l.bold ? 700 : 400};line-height:1.5;color:${l.color};text-align:${l.align};background:${l.background};opacity:${l.opacity}">${layerContent(l)}</div>`;
  }).join('');
  return sanitize(`<section data-composition="1" data-width="${canvas.width}" data-height="${canvas.height}" style="display:grid;grid-template-columns:100%;grid-template-rows:100%;position:relative;z-index:0;width:100%;height:${canvas.height}px;overflow:hidden">${layers}</section>`);
}
export function readComposition(html: string): Composition | null {
  const doc = new DOMParser().parseFromString(sanitize(html), 'text/html');
  const root = doc.body.firstElementChild as HTMLElement | null;
  if (!root?.matches('[data-composition="1"]')) return null;
  const canvas: Composition = { width: clamp(finite(root.dataset.width, 720), 240, 1500), height: clamp(finite(root.dataset.height, 360), 80, 3000), layers: [] };
  canvas.layers = Array.from(root.children).filter(el => el.hasAttribute('data-composition-layer')).slice(0, 100).map(el => {
    const node = el as HTMLElement, image = node.querySelector('img');
    const kind = ['text', 'image', 'content'].includes(node.dataset.compositionLayer || '') ? node.dataset.compositionLayer as Layer['kind'] : 'content';
    return boundLayer(makeLayer(kind, {
      id: uid(), name: node.dataset.name || (kind === 'text' ? '文字' : '图片'),
      x: finite(node.dataset.x, 0), y: finite(node.dataset.y, 0), width: finite(node.dataset.width, 260), height: finite(node.dataset.height, 110),
      text: kind === 'text' ? node.textContent || '' : '', html: kind === 'content' ? node.innerHTML : '', src: kind === 'image' ? safeUrl(image?.getAttribute('src') || '', true) : '', link: safeUrl(node.querySelector('a')?.getAttribute('href') || ''),
      fontFamily: normalizeFontFamily(node.style.fontFamily), fontSize: parseFloat(node.style.fontSize) || 24,
      color: color(node.style.color, '#333333'), bold: Number(node.style.fontWeight) >= 600 || node.style.fontWeight === 'bold',
      align: ['left', 'center', 'right'].includes(node.style.textAlign) ? node.style.textAlign as Layer['align'] : 'left',
      fit: image?.style.objectFit === 'cover' ? 'cover' : 'contain', background: color(node.style.backgroundColor, 'transparent'), opacity: finite(node.style.opacity, 1),
    }), canvas);
  });
  return canvas;
}
export function seedComposition(block: Block | undefined, element: HTMLElement | null, width: number): Composition {
  if (block) { const existing = readComposition(block.html); if (existing) return existing; }
  const rect = element?.getBoundingClientRect();
  const scale = element && rect ? rect.width / parseFloat(getComputedStyle(element).width) : 1;
  const height = Math.min(3000, Math.max(120, rect ? rect.height / scale : 360));
  const canvas: Composition = { width, height, layers: [] };
  if (!block || !element || !rect) return canvas;
  const content = element.querySelector<HTMLElement>('.block-content');
  const images = content?.querySelectorAll<HTMLImageElement>('img');
  if (!block.frame && images?.length === 1 && !content?.textContent?.trim()) {
    const img = images[0], bounds = img.getBoundingClientRect();
    canvas.layers.push(boundLayer(makeLayer('image', { name: img.alt || '图片', src: img.getAttribute('src') || '',
      link: img.closest('a')?.getAttribute('href') || '', fit: getComputedStyle(img).objectFit === 'cover' ? 'cover' : 'contain',
      x: (bounds.x - rect.x) / scale, y: (bounds.y - rect.y) / scale, width: bounds.width / scale, height: bounds.height / scale }), canvas));
  } else {
    // Preserve complex templates and existing crops as an intact layer.
    canvas.layers.push(boundLayer(makeLayer('content', { name: block.name, x: block.frame ? width * block.frame.left / 100 : 0, y: 0,
      width: rect.width / scale, height: rect.height / scale, html: element.querySelector('.block-viewport')?.outerHTML || block.html }), canvas));
  }
  return canvas;
}
export function arrangeText(canvas: Composition, mode: 'left' | 'overlay'): Composition {
  const next = { ...canvas, layers: canvas.layers.map(layer => ({ ...layer })) };
  let text = next.layers.find(l => l.kind === 'text');
  if (!text) { text = makeLayer('text'); next.layers.push(text); }
  const visual = next.layers.find(l => l.kind !== 'text');
  const gap = 20, inset = 20;
  if (mode === 'left') {
    text.x = inset; text.y = inset; text.width = next.width * .36; text.height = Math.max(16, next.height - inset * 2);
    if (visual) { visual.x = text.x + text.width + gap; visual.y = inset; visual.width = next.width - visual.x - inset; visual.height = Math.max(16, next.height - inset * 2); }
  } else {
    text.x = next.width * .12; text.y = next.height * .3; text.width = next.width * .76; text.height = Math.max(32, next.height * .4);
    text.bold = true; text.color = '#ffffff'; text.background = '#00000066'; text.align = 'center';
    next.layers = next.layers.filter(l => l.id !== text.id).concat(text);
  }
  next.layers = next.layers.map(l => boundLayer(l, next));
  return next;
}
