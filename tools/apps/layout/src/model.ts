import DOMPurify from "dompurify";
import { normalizeFontFamily, normalizeFontHtml } from "./fonts.ts";
import { normalizeFrame, type BlockFrame } from "./frameLayout.ts";
export type BlockKind =
  | "text"
  | "heading"
  | "card"
  | "image"
  | "layout"
  | "divider"
  | "svg"
  | "table"
  | "audio"
  | "video";
export type BlockStyle = {
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  background?: string;
  padding?: number;
  marginBottom?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  textAlign?: "left" | "center" | "right" | "justify";
  fontFamily?: string;
  opacity?: number;
};
export type Block = {
  id: string;
  kind: BlockKind;
  name: string;
  html: string;
  style: BlockStyle;
  locked?: boolean;
  frame?: BlockFrame;
};
export type Article = {
  version: 1;
  id: string;
  title: string;
  description: string;
  author: string;
  link: string;
  cover: string;
  tags: string[];
  enhanced: boolean;
  theme: string;
  width: number;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  background: string;
  blocks: Block[];
  updatedAt: number;
};
export type Asset = {
  id: string;
  name: string;
  src: string;
  type: "image" | "audio" | "video";
  groupId?: string;
};
export const uid = () => crypto.randomUUID();
export const clone = <T>(data: T): T => structuredClone(data);
export const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function safeUrl(url: string, media = false) {
  const text = url.trim();
  if (
    media &&
    /^data:(image\/(png|jpeg|gif|webp|svg\+xml)|audio\/[\w.+-]+|video\/[\w.+-]+);base64,[a-z\d+/=\s]+$/i.test(
      text,
    )
  )
    return text;
  if (media && /^\/assets\/[\w.-]+$/.test(text)) return text;
  try {
    const u = new URL(text);
    return ["https:", "http:", ...(media ? [] : ["mailto:", "tel:"])].includes(
      u.protocol,
    )
      ? text
      : "";
  } catch {
    return "";
  }
}
export function sanitize(html: string) {
  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ["section", "video", "audio", "source"],
    ADD_ATTR: ["controls", "playsinline", "contenteditable", "target"],
    FORBID_TAGS: [
      "style",
      "script",
      "iframe",
      "object",
      "embed",
      "form",
      "input",
      "button",
      "foreignObject",
      "animate",
      "set",
    ],
    FORBID_ATTR: ["srcdoc"],
  });
  const doc = new DOMParser().parseFromString(clean, "text/html");
  doc.body.querySelectorAll("*").forEach((el) => {
    el.removeAttribute("contenteditable");
    const style = el.getAttribute("style");
    if (
      style &&
      /url\s*\(|expression\s*\(|@import|behavior\s*:|position\s*:\s*(fixed|absolute)/i.test(
        style,
      )
    )
      el.removeAttribute("style");
    for (const attr of ["href", "src", "xlink:href"]) {
      if (
        el.hasAttribute(attr) &&
        !safeUrl(el.getAttribute(attr)!, attr !== "href")
      )
        el.removeAttribute(attr);
    }
    if (el.tagName === "IMG" && !el.getAttribute("src")) el.remove();
    if (el.tagName === "A") {
      el.setAttribute("rel", "noopener noreferrer");
      el.setAttribute("target", "_blank");
    }
  });
  return normalizeFontHtml(doc.body.innerHTML);
}
export function makeBlock(
  kind: BlockKind,
  name: string,
  html: string,
  style: BlockStyle = {},
): Block {
  return { id: uid(), kind, name, html: sanitize(html), style: style.fontFamily
    ? { ...style, fontFamily: normalizeFontFamily(style.fontFamily) } : style };
}
export const festivalText =
  "中秋节始于唐朝初年，盛行于宋朝，至明清时，已成为与春节齐名的中国传统节日之一。受中华文化的影响，中秋节也是东南亚一些国家尤其是当地的华人华侨的传统节日。";
const cake = "/assets/festival-photo.png";
const ornamentImage = (
  name: string,
  width: number,
  height: number,
  extra = "",
) =>
  `<img data-decoration="true" src="/assets/${name}.png" alt="" style="width:${width}px;height:${height}px;display:block;flex:0 0 auto;${extra}">`;
function festivalBadge(text: string, number = false, wide = false) {
  const height = number ? 40 : 46;
  const capWidth = number ? 25 : 29;
  return `<span style="display:inline-flex;align-items:stretch;height:${height}px;${wide ? "flex:1;min-width:0;" : ""}">${ornamentImage("festival-cap", capWidth, height)}<span style="display:grid;align-items:center;flex:1;min-width:${number ? 14 : 78}px"><img data-decoration="true" src="/assets/festival-band.png" alt="" style="grid-area:1/1;width:100%;height:${height}px;display:block"><strong style="grid-area:1/1;position:relative;z-index:1;display:block;color:#fff;font-size:${number ? 21 : 16}px;line-height:1.6;text-align:center;white-space:nowrap">${text}</strong></span>${ornamentImage("festival-cap", capWidth, height, "transform:scaleX(-1);margin-left:-1px;")}</span>`;
}
function festivalHeading(text = "但愿人长久", wide = false, overlap = true) {
  return `<div data-festival-heading="true" style="display:flex;align-items:center;justify-content:center;position:relative;z-index:1;margin:${overlap ? "10px 0 -21px" : "10px 0"};height:46px">${ornamentImage("festival-calligraphy", 61, 55, "margin-top:-4px;")}${festivalBadge(text, false, wide)}${ornamentImage("festival-leaf", 48, 57, "align-self:flex-start;margin-top:-10px;")}</div>`;
}
const heading = festivalHeading();
const numberHeading = `<div style="display:flex;align-items:center;justify-content:center;gap:9px;margin:10px 0"><span style="width:17%;height:1px;background:#fec772"></span>${festivalBadge("1", true)}<span style="width:17%;height:1px;background:#fec772"></span></div>`;
export const festivalCard = `${heading}<section data-festival-card="true" style="background:linear-gradient(#fff0b7 13%,rgba(255,247,217,0) 88%);border-radius:11px;padding:34px 22px 20px;margin-bottom:10px"><img src="${cake}" alt="中秋月饼" style="width:100%;border-radius:8px;display:block"><p style="margin:18px 0 0;font-size:16px;line-height:1.6;text-align:justify">${festivalText}</p></section>`;
const gallery = `<section style="background:#fff0b7;padding:22px 22px 0;border-radius:12px"><img src="/assets/festival-gallery-photo.png" alt="月饼" style="width:100%;border-radius:8px;display:block"><div style="width:98%;margin:-22px -22px 0 auto;background:#fff0b7;padding:20px 22px 0;position:relative;border-radius:12px"><img src="/assets/festival-gallery-photo.png" alt="月饼细节" style="width:100%;border-radius:8px;display:block"></div></section><div style="display:flex;align-items:center;gap:10px;margin-top:-13px;position:relative">${festivalBadge("1", true)}<span style="height:1px;width:44%;background:#fec772"></span></div>`;
// Only untouched bundled examples are upgraded. Edited article HTML stays byte-for-byte intact.
export function upgradeBundledArticle(article: Article): Article {
  const legacyHeadings = [74, 88].map(
    (width) =>
      `<div style="text-align:center;margin:0 0 -7px;position:relative;z-index:1"><img src="/assets/festival-heading.png" alt="中秋 · 但愿人长久" style="width:${width}%;display:inline-block;max-width:100%"></div>`,
  );
  const replacements = new Map<string, string>();
  for (const old of legacyHeadings) {
    replacements.set(
      sanitize(old),
      sanitize(festivalHeading("但愿人长久 千里共婵娟", true, false)),
    );
    replacements.set(
      sanitize(
        `${old}<section style="background:linear-gradient(#fff0b0,#fffdf6);border-radius:14px;padding:30px 22px 18px"><img src="/assets/mooncake.jpg" alt="中秋月饼" style="width:100%;border-radius:9px;display:block"><p style="margin:17px 0 0;font-size:16px;line-height:1.65;text-align:left">${festivalText}</p></section>`,
      ),
      sanitize(festivalCard),
    );
  }
  let changed = false;
  const blocks = article.blocks.map((block) => {
    const replacement = replacements.get(block.html);
    if (!replacement) return block;
    changed = true;
    return { ...block, html: replacement };
  });
  return changed ? { ...article, blocks } : article;
}
export function newArticle(empty = false): Article {
  return {
    version: 1,
    id: uid(),
    title: "草稿",
    description: "",
    author: "",
    link: "",
    cover: "",
    tags: [],
    enhanced: false,
    theme: "#ffb733",
    width: 414,
    fontSize: 16,
    lineHeight: 1.6,
    letterSpacing: 0,
    background: "#ffffff",
    updatedAt: Date.now(),
    blocks: empty
      ? []
      : [
          makeBlock(
            "text",
            "正文",
            "<p style='padding:0 30px 26px'>一起来补齐罗丹没有收藏齐的12生肖陶俑吧！<br>体验雕塑艺术家常用的翻模方式，<br>用陶泥创作与众不同的十二生肖泥塑，<br>12款头模，运用罗丹拼贴组合雕塑的创作手法，<br>快速体验雕塑艺术的乐趣。</p>",
            { fontSize: 18, padding: 0, marginBottom: 0 },
          ),
          makeBlock("card", "中秋 · 图文卡片", festivalCard, {
            padding: 0,
            marginBottom: 0,
          }),
        ],
  };
}
export type Template = {
  id: string;
  name: string;
  category: string;
  kind: BlockKind;
  html: string;
  tags: string[];
};
const tpl = (
  id: string,
  name: string,
  category: string,
  kind: BlockKind,
  html: string,
  tags: string[] = [],
): Template => ({ id, name, category, kind, html, tags });
const theme = "var(--theme, #ffb733)";
export const templates: Template[] = [
  tpl("number", "中秋序号标题", "标题", "heading", numberHeading, [
    "中秋",
    "序号",
  ]),
  tpl(
    "festival-heading",
    "但愿人长久 · 中秋标题",
    "标题",
    "heading",
    festivalHeading("但愿人长久 千里共婵娟", true, false),
    ["中秋"],
  ),
  tpl("festival-card", "中秋月圆 · 图文卡片", "卡片", "card", festivalCard, [
    "中秋",
    "热门",
  ]),
  tpl("festival-gallery", "中秋 · 错落双图", "图片", "layout", gallery, [
    "中秋",
  ]),
  tpl(
    "photo-caption",
    "图片与说明",
    "图片",
    "image",
    `<img src="${cake}" alt="中秋月饼" style="width:100%;border-radius:8px;display:block"><p style="text-align:center;color:#999;font-size:12px;margin:10px 0">把生活，过成喜欢的样子</p>`,
  ),
  tpl(
    "line-title",
    "简约线框标题",
    "标题",
    "heading",
    `<h2 style="font-size:20px;font-weight:500;text-align:center;border-bottom:2px solid ${theme};padding:15px 0;margin:0">把日子过成诗</h2>`,
  ),
  tpl(
    "chapter",
    "章节序号 · 双色",
    "标题",
    "heading",
    `<div style="padding:16px 10px;display:flex;align-items:center;gap:16px"><b style="font-size:36px;line-height:1;color:${theme}">01</b><div><strong style="font-size:18px">记录生活的美好</strong><div style="font-size:10px;color:#999;letter-spacing:3px;margin-top:5px">THE BEAUTY OF LIFE</div></div></div>`,
  ),
  tpl(
    "quote",
    "留白引用卡片",
    "卡片",
    "card",
    `<section style="background:#f6f7f7;border-left:3px solid ${theme};padding:24px"><p style="font-size:17px;line-height:1.9;margin:0">生活的美好，<br>藏在每一个平凡的瞬间里。</p><p style="font-size:12px;color:#888;margin:16px 0 0">—— 写给认真生活的你</p></section>`,
  ),
  tpl(
    "two-column",
    "两栏图文布局",
    "布局",
    "layout",
    `<section style="display:flex;gap:14px"><div style="flex:1;min-width:0"><img src="${cake}" alt="图一" style="width:100%;border-radius:4px"><p style="font-size:14px;line-height:1.7">一半烟火，一半诗意。点击这里编辑文字。</p></div><div style="flex:1;min-width:0"><img src="${cake}" alt="图二" style="width:100%;border-radius:4px"><p style="font-size:14px;line-height:1.7">把每个平凡的日子，都过得闪闪发光。</p></div></section>`,
  ),
  tpl(
    "three-column",
    "三栏图片布局",
    "布局",
    "layout",
    `<section style="display:flex;gap:8px">${[1, 2, 3].map((n) => `<div style="flex:1;min-width:0"><img src="${cake}" alt="图片${n}" style="width:100%;height:110px;object-fit:cover"><p style="text-align:center;font-size:12px">生活片段 ${n}</p></div>`).join("")}</section>`,
  ),
  tpl(
    "text",
    "基础正文",
    "组件",
    "text",
    "<p>在这里写下你的故事。选中文字，可以调整字体、字号、颜色与段落样式。</p>",
  ),
  tpl(
    "divider",
    "简约分隔线",
    "组件",
    "divider",
    `<div style="padding:20px 35px"><hr style="border:0;border-top:1px solid ${theme}"></div>`,
  ),
  tpl(
    "ending",
    "文章结尾 · END",
    "组件",
    "heading",
    `<div style="text-align:center;padding:24px;font-size:13px;letter-spacing:5px;color:${theme}">— END —</div>`,
  ),
  tpl(
    "table",
    "信息表格",
    "组件",
    "table",
    '<table style="width:100%;border-collapse:collapse;font-size:14px"><tbody><tr><th style="border:1px solid #ddd;padding:10px;background:#f5f5f5">时间</th><th style="border:1px solid #ddd;padding:10px;background:#f5f5f5">活动安排</th></tr><tr><td style="border:1px solid #ddd;padding:10px">09:00</td><td style="border:1px solid #ddd;padding:10px">签到与入场</td></tr><tr><td style="border:1px solid #ddd;padding:10px">10:00</td><td style="border:1px solid #ddd;padding:10px">主题分享</td></tr></tbody></table>',
  ),
  tpl(
    "svg-wave",
    "波浪装饰",
    "SVG",
    "svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 70" style="width:100%;display:block"><path d="M0 35 Q50 0 100 35 T200 35 T300 35 T400 35 V70 H0Z" fill="${theme}" opacity="0.25"/><path d="M0 50 Q50 15 100 50 T200 50 T300 50 T400 50 V70 H0Z" fill="${theme}"/></svg>`,
  ),
  tpl(
    "svg-circle",
    "圆形装饰",
    "SVG",
    "svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 70" style="width:100%;display:block"><circle cx="180" cy="35" r="18" fill="${theme}" opacity="0.3"/><circle cx="205" cy="35" r="18" fill="${theme}" opacity="0.7"/><circle cx="230" cy="35" r="18" fill="${theme}"/></svg>`,
  ),
  tpl(
    "notice",
    "活动通知卡片",
    "卡片",
    "card",
    `<section style="border:1px solid ${theme};padding:24px"><h3 style="margin:0 0 16px;color:${theme};font-size:19px">一份特别的邀请</h3><p style="margin:0;line-height:1.8">时间：2026年9月25日<br>地点：城市艺术中心<br>期待与你，一起发现生活之美。</p></section>`,
  ),
  tpl(
    "bullets",
    "重点清单",
    "组件",
    "text",
    `<ul style="padding-left:24px;line-height:2"><li>用文字，记录值得珍藏的瞬间</li><li>用图片，让故事更加生动</li><li>用排版，传递内容的温度</li></ul>`,
  ),
];
const num = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.min(max, Math.max(min, v))
    : fallback;
export function parseArticle(raw: unknown): Article {
  if (!raw || typeof raw !== "object")
    throw new Error("文件不是有效的图文工程");
  const a = raw as Partial<Article>;
  if (a.version !== 1 || !Array.isArray(a.blocks) || a.blocks.length > 500)
    throw new Error("不支持的工程格式，或组件超过 500 个");
  const base = newArticle(true);
  const str = (v: unknown, max = 10000) =>
    typeof v === "string" ? v.slice(0, max) : "";
  const kinds: BlockKind[] = [
    "text",
    "heading",
    "card",
    "image",
    "layout",
    "divider",
    "svg",
    "table",
    "audio",
    "video",
  ];
  const styles = (s: unknown): BlockStyle => {
    const v = (s && typeof s === "object" ? s : {}) as BlockStyle;
    const r: BlockStyle = {};
    for (const k of [
      "fontSize",
      "lineHeight",
      "letterSpacing",
      "padding",
      "marginBottom",
      "borderRadius",
      "borderWidth",
      "opacity",
    ] as const) {
      if (typeof v[k] === "number")
        r[k] = num(
          v[k],
          0,
          k === "letterSpacing" ? -5 : 0,
          k === "lineHeight" ? 4 : k === "opacity" ? 1 : 200,
        );
    }
    for (const k of [
      "color",
      "background",
      "borderColor",
      "fontFamily",
    ] as const)
      if (typeof v[k] === "string" && !/[;{}<>]|url\s*\(/i.test(v[k]!))
        r[k] = v[k];
    if (["left", "right", "center", "justify"].includes(v.textAlign!))
      r.textAlign = v.textAlign;
    if (r.fontFamily) r.fontFamily = normalizeFontFamily(r.fontFamily);
    return r;
  };
  return {
    ...base,
    title: str(a.title, 100),
    description: str(a.description, 500),
    author: str(a.author, 100),
    link: safeUrl(str(a.link)),
    cover: safeUrl(str(a.cover, 25000000), true),
    tags: Array.isArray(a.tags)
      ? a.tags
          .filter((x) => typeof x === "string")
          .slice(0, 20)
          .map((x) => x.slice(0, 30))
      : [],
    enhanced: !!a.enhanced,
    theme: /^#[\da-f]{6}$/i.test(a.theme || "") ? a.theme! : base.theme,
    width: num(a.width, 414, 320, 750),
    fontSize: num(a.fontSize, 16, 10, 48),
    lineHeight: num(a.lineHeight, 1.6, 1, 3),
    letterSpacing: num(a.letterSpacing, 0, -2, 10),
    background: /^#[\da-f]{6}$/i.test(a.background || "")
      ? a.background!
      : "#ffffff",
    blocks: a.blocks.map((b) => {
      if (!b || typeof b.html !== "string" || !kinds.includes(b.kind))
        throw new Error("组件数据不完整");
      return {
        id: uid(),
        kind: b.kind,
        name: str(b.name, 100) || "组件",
        html: sanitize(b.html),
        style: styles(b.style),
        locked: !!b.locked,
        ...(normalizeFrame(b.frame) ? { frame: normalizeFrame(b.frame) } : {}),
      };
    }),
  };
}
