import { normalizeFontFamily, SANS_FONT } from "./fonts.ts";

export const MIXED_FONT = "mixed";

function textParts(root: HTMLElement, range: Range | null) {
  const parts: { node: Text; start: number; end: number }[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, 4 /* SHOW_TEXT */);
  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    if (range && !range.intersectsNode(node)) continue;
    const start = range?.startContainer === node ? range.startOffset : 0;
    const end = range?.endContainer === node ? range.endOffset : node.length;
    if (end > start && node.data.slice(start, end).trim()) parts.push({ node, start, end });
  }
  return parts;
}

export function selectionFont(root: HTMLElement, range: Range | null): string {
  const inside = range && root.contains(range.commonAncestorContainer);
  if (inside && range.collapsed && range.startContainer !== root) {
    const node = range.startContainer;
    const element = node.nodeType === 1 ? node as Element : node.parentElement!;
    return normalizeFontFamily(getComputedStyle(element).fontFamily) || SANS_FONT;
  }
  const families = new Set(textParts(root, inside && !range.collapsed ? range : null).map(({ node }) =>
    normalizeFontFamily(getComputedStyle(node.parentElement!).fontFamily) || SANS_FONT,
  ));
  return families.size > 1 ? MIXED_FONT : [...families][0] || SANS_FONT;
}

// Apply to the actual text, so imported nested styles cannot override the choice.
// Return whether the whole component was changed (its default must also be saved).
export function applyFontFamily(root: HTMLElement, range: Range | null, value: string): boolean {
  const family = normalizeFontFamily(value) || SANS_FONT;
  if (!range || range.collapsed || !root.contains(range.commonAncestorContainer)) {
    for (const el of [root, ...root.querySelectorAll<HTMLElement>("[style], [face], [font-family]")]) {
      if (el === root || el.style?.fontFamily)
        el.style.setProperty("font-family", family, el.style.getPropertyPriority("font-family"));
      for (const attribute of ["face", "font-family"])
        if (el.hasAttribute(attribute)) el.setAttribute(attribute, family);
    }
    return true;
  }

  const spans: Element[] = [];
  // Split only selected text; keep paragraphs, links, images and other formatting.
  for (const { node, start, end } of textParts(root, range)) {
    if (end < node.length) node.splitText(end);
    const selected = start ? node.splitText(start) : node;
    const svg = selected.parentElement?.namespaceURI === "http://www.w3.org/2000/svg";
    const span = svg
      ? root.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan")
      : root.ownerDocument.createElement("span");
    span.style.fontFamily = family;
    selected.replaceWith(span);
    span.append(selected);
    spans.push(span);
  }
  if (spans.length) {
    range.setStart(spans[0].firstChild!, 0);
    const last = spans[spans.length - 1].lastChild as Text;
    range.setEnd(last, last.length);
  }
  return false;
}
