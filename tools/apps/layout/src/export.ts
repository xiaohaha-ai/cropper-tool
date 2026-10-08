import { toPng } from "html-to-image";
import { type Article, escapeHtml, clone, makeBlock } from "./model.ts";
import { duplicateArticle } from "./documentTools.ts";
import { embedArticleFonts } from "./fontExport.ts";
const PROPS = [
  "display",
  "box-sizing",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "color",
  "background-color",
  "background-image",
  "text-align",
  "text-decoration",
  "line-height",
  "letter-spacing",
  "white-space",
  "word-break",
  "overflow-wrap",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "width",
  "max-width",
  "height",
  "object-fit",
  "vertical-align",
  "border-collapse",
  "flex",
  "flex-direction",
  "gap",
  "align-items",
  "justify-content",
  "opacity",
  "fill",
  "position",
  "z-index",
  "transform",
  "grid-area",
  "grid-template-columns",
  "grid-template-rows",
  "align-self",
  "min-width",
  "overflow",
  "min-height",
  "max-height",
  "box-shadow",
  "background-size",
  "background-position",
  "background-repeat",
  "background-origin",
  "background-clip",
  "object-position",
  "top",
  "right",
  "bottom",
  "left",
  "transform-origin",
  "text-indent",
  "text-transform",
  "text-shadow",
  "text-decoration-color",
  "text-decoration-style",
  "text-decoration-thickness",
  "list-style-type",
  "list-style-position",
  "table-layout",
  "border-spacing",
  "caption-side",
  "flex-wrap",
  "order",
  "row-gap",
  "column-gap",
  "justify-self",
  "justify-items",
  "align-content",
  "grid-auto-flow",
  "grid-auto-columns",
  "grid-auto-rows",
  "direction",
  "writing-mode",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "fill-opacity",
  "stroke-opacity",
];
// Preserve percentages and auto sizing; computed values resolve theme variables.
const RELATIVE_PROPS = /^(width|height|min-width|max-width|min-height|max-height|margin-.+|padding-.+|top|right|bottom|left|flex|gap|row-gap|column-gap|grid-.+|transform-origin|line-height|text-indent)$/;
// Editors can wrap image sections in shrink-to-fit boxes. Size containment makes
// those sections collapse to zero width, so export resolved sizes without it.
const NEEDS_RESOLVING = /var\(|inherit|unset|revert|\bcq(?:w|h|i|b|min|max)\b|\d+cq(?:w|h|i|b|min|max)/;
export async function inlineArticle(
  article: Article,
  paper: HTMLElement,
  transform?: (root: HTMLElement, pairs: Map<Element, HTMLElement>) => Promise<void>,
) {
  const root = paper.cloneNode(true) as HTMLElement;
  const source = [
    paper,
    ...Array.from(paper.querySelectorAll<HTMLElement>("*")),
  ];
  const target = [root, ...Array.from(root.querySelectorAll<HTMLElement>("*"))];
  target.forEach((node, i) => {
    const css = getComputedStyle(source[i]);
    for (const attr of Array.from(node.attributes)) {
      if (/^(class|contenteditable|tabindex|draggable|role|spellcheck)$/.test(attr.name) ||
        /^(on|aria-|data-)/.test(attr.name) && attr.name !== "data-editor-only")
        node.removeAttribute(attr.name);
    }
    node.style.cssText = "";
    for (const p of PROPS) {
      const authored = source[i].style.getPropertyValue(p);
      node.style.setProperty(p, RELATIVE_PROPS.test(p) && authored &&
        !NEEDS_RESOLVING.test(authored) ? authored : css.getPropertyValue(p));
    }
    if (node.namespaceURI !== "http://www.w3.org/2000/svg") {
      // CSSOM reports measured pixels even when the original width/height is auto.
      for (const dimension of ["width", "height"] as const) {
        const authored = source[i].style[dimension];
        node.style[dimension] = authored || source[i].hasAttribute(dimension)
          ? authored && !NEEDS_RESOLVING.test(authored) ? authored : css[dimension]
          : "auto";
      }
    }
    if (node.tagName === "IMG") {
      const currentSrc = (source[i] as HTMLImageElement).currentSrc;
      if (currentSrc) node.setAttribute("src", currentSrc);
    }
    if (node.tagName === "A") {
      node.setAttribute("href", (source[i] as HTMLAnchorElement).href);
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
  root.querySelectorAll("[data-editor-only]").forEach((n) => n.remove());
  root.style.cssText += `;width:${article.width}px;max-width:100%;height:auto;min-height:0;margin:0 auto;box-shadow:none;outline:none;transform:none;background:${article.background};`;
  if (transform) await transform(root, new Map(source.map((node, i) => [node, target[i]])));
  const cache = new Map<string, Promise<string>>();
  const embed = (src: string) => {
    if (!src || src.startsWith("data:")) return Promise.resolve(src);
    const url = new URL(src, document.baseURI);
    if (url.protocol !== "blob:" && url.origin !== location.origin)
      return Promise.resolve(url.href);
    if (!cache.has(url.href)) cache.set(url.href, (async () => {
      const response = await fetch(url.href);
      if (!response.ok) throw new Error("有本地图片无法读取，请检查图片后重试");
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) throw new Error("图片地址未返回有效图片，请检查图片后重试");
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("图片读取失败，请重试"));
        reader.readAsDataURL(blob);
      });
    })());
    return cache.get(url.href)!;
  };
  await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>("img")).map(
      async (img) => {
        const src = img.getAttribute("src");
        if (src) img.src = await embed(src);
        img.removeAttribute("srcset");
        img.removeAttribute("sizes");
        img.removeAttribute("loading");
      },
    ),
  );
  await Promise.all([root, ...root.querySelectorAll<HTMLElement>("[style]")].map(async (node) => {
    const background = node.style.backgroundImage;
    const urls = [...background.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
    let embedded = background;
    for (const match of urls) embedded = embedded.replace(match[0], `url("${await embed(match[1])}")`);
    node.style.backgroundImage = embedded;
  }));
  return root.outerHTML;
}
export async function exportHtml(article: Article, paper: HTMLElement) {
  const fonts = await embedArticleFonts(paper);
  const body = await inlineArticle(article, paper);
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(article.title)}</title><meta name="description" content="${escapeHtml(article.description)}"><style>${fonts}\nbody{margin:0;padding:24px 0;background:#f6f6f6;font-synthesis:style}img{max-width:100%}*{box-sizing:border-box}@media print{body{background:white;padding:0}section{break-inside:auto}}</style></head><body>${body}</body></html>`;
}
export function download(
  name: string,
  content: string | Blob,
  type = "text/plain",
) {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
export async function png(article: Article, paper: HTMLElement) {
  const broken = Array.from(paper.querySelectorAll("img")).find(
    (img) => img.getAttribute("src") && img.complete && !img.naturalWidth,
  );
  if (broken) throw new Error("有图片未能加载，请替换该图片后再次导出长图");
  paper.classList.add("exporting");
  try {
    const fontEmbedCSS = await embedArticleFonts(paper);
    return await toPng(paper, {
      fontEmbedCSS,
      pixelRatio: 2,
      backgroundColor: article.background,
      filter: (node) =>
        !(node instanceof Element && node.hasAttribute("data-editor-only")) &&
        !(node instanceof HTMLImageElement && !node.getAttribute("src")),
      style: { transform: "none", boxShadow: "none", outline: "none" },
      cacheBust: false,
    });
  } finally {
    paper.classList.remove("exporting");
  }
}
export function plainText(paper: HTMLElement) {
  return Array.from(paper.querySelectorAll<HTMLElement>(".block-content"))
    .map((el) => el.innerText)
    .join("\n\n");
}

export async function portableArticle(article: Article): Promise<Article> {
  const copy = clone(article);
  const cached = new Map<string, Promise<string>>();
  const embed = (src: string) => {
    if (!src.startsWith("/assets/")) return Promise.resolve(src);
    if (!cached.has(src))
      cached.set(
        src,
        (async () => {
          const response = await fetch(src);
          if (!response.ok)
            throw new Error("有本地图片无法读取，请检查图片后重试");
          const blob = await response.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error("图片读取失败"));
            reader.readAsDataURL(blob);
          });
        })(),
      );
    return cached.get(src)!;
  };
  copy.cover = await embed(copy.cover);
  for (const block of copy.blocks) {
    const doc = new DOMParser().parseFromString(block.html, "text/html");
    await Promise.all(
      Array.from(doc.querySelectorAll("img")).map(async (img) => {
        img.setAttribute("src", await embed(img.getAttribute("src") || ""));
      }),
    );
    block.html = doc.body.innerHTML;
  }
  return copy;
}

async function renderedImage(article: Article, paper: HTMLElement) {
  const image = new Image();
  image.src = await png(article, paper);
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight)
    throw new Error("图片渲染失败，请缩短图文后重试");
  return image;
}

export async function stickerArticle(article: Article, paper: HTMLElement) {
  const image = await renderedImage(article, paper);
  const result = duplicateArticle(article, `${article.title || "图文"} - 贴纸`);
  result.blocks = [];
  for (let y = 0; y < image.height; y += 1600) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = Math.min(1600, image.height - y);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("浏览器不支持图片转换");
    ctx.drawImage(
      image,
      0,
      y,
      image.width,
      canvas.height,
      0,
      0,
      image.width,
      canvas.height,
    );
    result.blocks.push(
      makeBlock(
        "image",
        `贴纸 ${result.blocks.length + 1}`,
        `<img src="${canvas.toDataURL("image/png")}" alt="图文贴纸 ${result.blocks.length + 1}" style="width:100%;display:block">`,
        { padding: 0, marginBottom: 0 },
      ),
    );
  }
  return result;
}

export async function scrollingVideo(
  article: Article,
  paper: HTMLElement,
  onProgress: (p: number) => void,
  signal: AbortSignal,
) {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream)
    throw new Error("当前浏览器不支持视频导出，请使用新版 Chrome 或 Edge");
  const mimeType = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/mp4",
    "video/webm",
  ].find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) throw new Error("浏览器没有可用的视频编码器，请改用长图导出");
  const image = await renderedImage(article, paper);
  if (signal.aborted) throw new Error("已取消视频导出");
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 1280;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建视频画布");
  const height = (image.height * canvas.width) / image.width;
  const draw = (p: number) => {
    ctx.fillStyle = article.background;
    ctx.fillRect(0, 0, 720, 1280);
    ctx.drawImage(image, 0, -Math.max(0, height - 1280) * p, 720, height);
  };
  draw(0);
  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 4_000_000,
  });
  const recording = await new Promise<{
    blob: Blob;
    extension: string;
    durationMs: number;
  }>((resolve, reject) => {
    const parts: Blob[] = [];
    let startedAt = 0;
    let timer: ReturnType<typeof setInterval>;
    let failure: Error | undefined;
    const cleanup = () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      signal.removeEventListener("abort", cancel);
    };
    const cancel = () => {
      failure = new Error("已取消视频导出");
      if (recorder.state !== "inactive") recorder.stop();
      else {
        cleanup();
        reject(failure);
      }
    };
    signal.addEventListener("abort", cancel, { once: true });
    recorder.ondataavailable = (e) => {
      if (e.data.size) parts.push(e.data);
    };
    recorder.onerror = () => {
      failure = new Error("视频编码失败，请重试或导出长图");
      cleanup();
      reject(failure);
    };
    recorder.onstop = () => {
      cleanup();
      if (failure) {
        reject(failure);
        return;
      }
      if (!parts.length) {
        reject(new Error("未生成视频数据"));
        return;
      }
      resolve({
        blob: new Blob(parts, { type: mimeType }),
        extension: mimeType.startsWith("video/mp4") ? "mp4" : "webm",
        durationMs: performance.now() - startedAt,
      });
    };
    startedAt = performance.now();
    try {
      recorder.start(250);
    } catch (e) {
      cleanup();
      reject(e);
      return;
    }
    const start = performance.now();
    const duration = 15000;
    timer = setInterval(() => {
      const elapsed = performance.now() - start;
      draw(Math.max(0, Math.min(1, (elapsed - 1000) / (duration - 2000))));
      onProgress(Math.min(100, Math.round((elapsed / duration) * 100)));
      if (elapsed >= duration) {
        clearInterval(timer);
        recorder.stop();
      }
    }, 1000 / 30);
  });
  if (recording.extension === "webm") {
    const { default: fixWebmDuration } = await import("fix-webm-duration");
    recording.blob = await fixWebmDuration(
      recording.blob,
      recording.durationMs,
      { logger: false },
    );
  }
  if (signal.aborted) throw new Error("已取消视频导出");
  return recording;
}
