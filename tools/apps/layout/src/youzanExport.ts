import { toPng } from "html-to-image";
import { inlineArticle } from "./export.ts";
import { type Article } from "./model.ts";
import { embedArticleFonts } from "./fontExport.ts";

export type YouzanImage = { id: string; src: string; name: string; filename: string };
export type YouzanExport = { html: string; images: YouzanImage[]; flattened: number };
export type ImageLinks = Record<string, string>;

export function publicImageUrl(value: string) {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password ||
      /^(localhost|127\.|10\.|192\.168\.|0\.|\[|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
      /\.(localhost|local|internal)$/.test(host)) return "";
    return url.href;
  } catch { return ""; }
}

const layoutProperties = /^(grid|flex|align-|justify-|gap|row-gap|column-gap|container-|position|z-index|top$|bottom$|left$|right$|transform|order$)/;
function removeLayout(node: HTMLElement) {
  for (const property of Array.from(node.style))
    if (layoutProperties.test(property)) node.style.removeProperty(property);
}

function flexToTable(source: HTMLElement, target: HTMLElement) {
  const css = getComputedStyle(source);
  const children = Array.from(source.children).filter((node) =>
    !node.hasAttribute("data-editor-only") && getComputedStyle(node).display !== "none");
  // Text beside a short decorative rule is already portable inline content.
  if (Array.from(source.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
    target.style.display = css.display === "inline-flex" ? "inline-block" : "block";
    Array.from(target.children).forEach((node) => {
      if (node instanceof HTMLElement) {
        node.style.display = "inline-block";
        node.style.verticalAlign = "middle";
        node.style.marginLeft = css.columnGap === "normal" ? "0" : css.columnGap;
      }
    });
    return;
  }
  if (!children.length) { target.style.display = "block"; return; }
  const column = css.flexDirection.startsWith("column");
  const table = document.createElement("table");
  table.setAttribute("role", "presentation");
  table.setAttribute("cellpadding", "0");
  table.setAttribute("cellspacing", "0");
  table.setAttribute("border", "0");
  table.setAttribute("width", "100%");
  table.style.cssText = "width:100%;border:0;border-collapse:collapse;border-spacing:0;table-layout:fixed;margin:0;";
  const tbody = table.createTBody();
  const row = column ? null : tbody.insertRow();
  const available = source.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
  const occupied = children.reduce((sum, child) => {
    const childCss = getComputedStyle(child);
    return sum + parseFloat(childCss.width) + (parseFloat(childCss.marginRight) || 0);
  }, 0) + (children.length - 1) * (parseFloat(css.columnGap) || 0);
  const total = Math.max(1, !column && !css.justifyContent.startsWith("space-") ? Math.min(available, occupied) : available);
  if (!column && total < available) {
    table.style.width = `${total / available * 100}%`;
    table.setAttribute("width", table.style.width);
    if (css.justifyContent === "center") table.style.margin = "0 auto";
    else if (css.justifyContent.endsWith("end")) table.style.margin = "0 0 0 auto";
  }
  const targetChildren = (Array.from(target.children) as HTMLElement[]).filter((node) => node.style.display !== "none");
  if (css.flexDirection.endsWith("reverse")) { children.reverse(); targetChildren.reverse(); }
  children.forEach((child, index) => {
    const content = targetChildren[index];
    if (!content) return;
    const cell = (row || tbody.insertRow()).insertCell();
    const childCss = getComputedStyle(child);
    cell.style.cssText = "padding:0;border:0;overflow-wrap:break-word;";
    const align = childCss.alignSelf === "auto" ? css.alignItems : childCss.alignSelf;
    const vertical = align === "center" ? "middle" : align.endsWith("end") ? "bottom" : "top";
    cell.setAttribute("valign", vertical);
    cell.style.verticalAlign = vertical;
    if (!column) {
      const width = `${(parseFloat(childCss.width) / total * 100).toFixed(4)}%`;
      cell.setAttribute("width", width);
      cell.style.width = width;
    }
    removeLayout(content);
    content.style.width = "100%";
    content.style.maxWidth = "100%";
    content.style.minWidth = "0";
    content.style.margin = "0";
    cell.append(content);
    if (index < children.length - 1) {
      const gap = parseFloat(column ? css.rowGap : css.columnGap) || 0;
      const margin = parseFloat(column ? childCss.marginBottom : childCss.marginRight) || 0;
      let space = gap + margin;
      if (!column && css.justifyContent === "space-between") {
        const widths = children.reduce((sum, item) => sum + parseFloat(getComputedStyle(item).width), 0);
        space = Math.max(space, (total - widths) / (children.length - 1));
      }
      if (space > 0) {
        const spacer = (row || tbody.insertRow()).insertCell();
        spacer.style.cssText = "border:0;padding:0;font-size:0;line-height:0;";
        if (column) { spacer.style.height = `${space}px`; spacer.setAttribute("height", String(space)); }
        else { spacer.style.width = `${space / total * 100}%`; spacer.setAttribute("width", spacer.style.width); }
        spacer.innerHTML = "&#8203;";
      }
    }
  });
  // A table inside a p/span would be reparsed into a different structure on paste.
  const wrapper = document.createElement("div");
  wrapper.style.cssText = target.style.cssText;
  wrapper.style.display = "block";
  removeLayout(wrapper);
  if (!column && parseFloat(css.minHeight) > 0) {
    table.style.height = css.height;
    wrapper.style.minHeight = "0";
  }
  wrapper.append(table);
  target.replaceWith(wrapper);
}

export async function prepareYouzanArticle(article: Article, paper: HTMLElement): Promise<YouzanExport> {
  // Measure at a phone-safe width, so exported pixel fonts do not depend on cqw.
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;";
  stage.style.setProperty("--theme", article.theme);
  stage.setAttribute("aria-hidden", "true");
  const source = paper.cloneNode(true) as HTMLElement;
  source.style.width = `${Math.min(article.width, 320)}px`;
  source.style.zoom = "1";
  source.querySelectorAll("[data-editor-only]").forEach((node) => node.remove());
  source.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));
  stage.append(source);
  document.body.append(stage);
  let flattened = 0;
  try {
    // Explicit wrappers reproduce anonymous flex items as table cells on export.
    for (const node of Array.from(source.querySelectorAll<HTMLElement>("*"))) {
      if (!getComputedStyle(node).display.includes("flex")) continue;
      for (const child of Array.from(node.childNodes)) {
        if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
        const span = document.createElement("span");
        child.replaceWith(span);
        span.append(child);
      }
    }
    await document.fonts.ready;
    await Promise.all(Array.from(source.querySelectorAll("img")).map(async (img) => {
      if (img.getAttribute("src")) {
        try { await img.decode(); }
        catch { throw new Error(`图片“${img.alt || "未命名图片"}”无法加载，请先在正文中修复。`); }
      }
    }));
    const html = await inlineArticle({ ...article, width: Math.min(article.width, 320) }, source, async (root, pairs) => {
      for (const [original, copied] of pairs) {
        if (original === source || !root.contains(copied)) continue;
        const css = getComputedStyle(original);
        const hasPositionedChild = Array.from(original.children).some((child) =>
          ["absolute", "fixed"].includes(getComputedStyle(child).position));
        // Overlaid titles, SVG, and transformed decorations cannot be expressed
        // faithfully by Youzan's basic rich-text layout. Preserve just that group.
        if (/grid/.test(css.display) || (css.display.includes("flex") && css.flexWrap !== "nowrap") || original.tagName.toLowerCase() === "svg" ||
          css.transform !== "none" || hasPositionedChild || css.backgroundImage.includes("url(")) {
          const width = parseFloat(css.width) || original.getBoundingClientRect().width;
          const height = Math.max(parseFloat(css.height) || 0, (original as HTMLElement).scrollHeight || 0);
          if (!width || !height) continue;
          let src: string;
          try {
            src = await toPng(original as HTMLElement, {
              fontEmbedCSS: await embedArticleFonts(original as HTMLElement),
              pixelRatio: 2, width, height,
              style: { margin: "0", width: `${width}px`, height: css.height },
            });
          } catch { throw new Error("组合图形无法转换，请检查图片是否允许读取，或改用下载保真长图。"); }
          const img = document.createElement("img");
          img.src = src;
          img.alt = `组合排版：${original.textContent?.trim().replace(/\s+/g, " ").slice(0, 40) || original.getAttribute("aria-label") || "装饰"}`;
          img.style.cssText = copied.style.cssText;
          removeLayout(img);
          img.style.display = "block";
          img.style.width = original instanceof HTMLElement && original.style.width ? css.width : "100%";
          img.style.maxWidth = "100%";
          img.style.height = "auto";
          img.style.minHeight = "0";
          copied.replaceWith(img);
          flattened++;
        }
      }
      for (const [original, copied] of Array.from(pairs).reverse()) {
        if (!root.contains(copied)) continue;
        const css = getComputedStyle(original);
        for (const property of Array.from(copied.style)) {
          if (/cq[wibh]|\bvar\(/.test(copied.style.getPropertyValue(property)))
            copied.style.setProperty(property, css.getPropertyValue(property));
        }
        if (css.whiteSpace === "nowrap" && original instanceof HTMLElement && original.clientWidth > 0 && original.scrollWidth > original.clientWidth) {
          const ratio = original.clientWidth / original.scrollWidth * 0.98;
          copied.style.fontSize = `${parseFloat(css.fontSize) * ratio}px`;
          if (css.letterSpacing !== "normal") copied.style.letterSpacing = `${parseFloat(css.letterSpacing) * ratio}px`;
          if (css.lineHeight !== "normal") copied.style.lineHeight = `${parseFloat(css.lineHeight) * ratio}px`;
        }
        if (css.display.includes("flex")) flexToTable(original as HTMLElement, copied);
      }
      for (const node of [root, ...root.querySelectorAll<HTMLElement>("[style]")]) {
        removeLayout(node);
        if (node.style.whiteSpace === "nowrap") node.style.whiteSpace = "normal";
      }
    });
    const parsed = new DOMParser().parseFromString(html, "text/html");
    const images: YouzanImage[] = [];
    const seen = new Map<string, string>();
    for (const img of Array.from(parsed.querySelectorAll("img"))) {
      const src = img.getAttribute("src") || "";
      // Existing public images keep their real address; local images need hosting.
      if (publicImageUrl(src)) continue;
      if (!src) throw new Error("正文中存在没有地址的图片，请先补齐图片。");
      let id = seen.get(src);
      if (!id) {
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(src));
        id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
        seen.set(src, id);
        const extension = /^data:image\/(jpeg|jpg)/i.test(src) ? "jpg" : /^data:image\/webp/i.test(src) ? "webp" : /^data:image\/gif/i.test(src) ? "gif" : "png";
        images.push({ id, src, name: img.alt || `图片 ${images.length + 1}`, filename: `${String(images.length + 1).padStart(2, "0")}-${id.slice(0, 8)}.${extension}` });
      }
      img.setAttribute("data-youzan-image", id);
    }
    return { html: parsed.body.innerHTML, images, flattened };
  } finally { stage.remove(); }
}

export function resolveYouzanImages(prepared: YouzanExport, links: ImageLinks) {
  const doc = new DOMParser().parseFromString(prepared.html, "text/html");
  for (const img of Array.from(doc.querySelectorAll<HTMLImageElement>("img[data-youzan-image]"))) {
    const url = publicImageUrl(links[img.dataset.youzanImage || ""] || "");
    if (!url) throw new Error("请先填写并验证每张图片的有赞素材地址，再复制正文。");
    img.src = url;
    img.removeAttribute("data-youzan-image");
  }
  return doc.body.innerHTML;
}

export async function verifyImageLinks(prepared: YouzanExport, links: ImageLinks) {
  await Promise.all(prepared.images.map(async (asset) => {
    const url = publicImageUrl(links[asset.id] || "");
    if (!url) throw new Error(`请填写“${asset.name}”的 HTTPS 图片地址。`);
    await new Promise<void>((resolve, reject) => {
      const image = new Image();
      const timer = setTimeout(() => { image.src = ""; reject(new Error(`“${asset.name}”加载超时，请检查地址。`)); }, 15000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error(`“${asset.name}”无法打开，请使用有赞素材库中的图片直链。`)); };
      image.src = url;
    });
  }));
}

export async function youzanImageZip(prepared: YouzanExport) {
  const { zipSync, strToU8 } = await import("fflate");
  const files: Record<string, Uint8Array> = {};
  for (const asset of prepared.images) files[asset.filename] = new Uint8Array(await (await fetch(asset.src)).arrayBuffer());
  files["图片对照.txt"] = strToU8(prepared.images.map((asset) => `${asset.filename}\t${asset.name}`).join("\n"));
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: "application/zip" });
}
