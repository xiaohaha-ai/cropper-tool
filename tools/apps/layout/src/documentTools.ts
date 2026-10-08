import {
  type Article,
  type Asset,
  type Block,
  clone,
  uid,
  newArticle,
  makeBlock,
  sanitize,
  safeUrl,
  escapeHtml,
  parseArticle,
} from "./model.ts";
import { copyArticle, sameArticle } from "./articleState.ts";

export type Revision = {
  id: string;
  savedAt: number;
  label: string;
  article: Article;
};
export type RevisionStore = Record<string, Revision[]>;

export function duplicateArticle(
  article: Article,
  title = `${article.title || "未命名图文"} - 拷贝`,
): Article {
  return {
    ...clone(article),
    id: uid(),
    title,
    updatedAt: Date.now(),
    blocks: article.blocks.map((b) => ({ ...clone(b), id: uid() })),
  };
}

export function rememberRevision(
  store: RevisionStore,
  article: Article,
  label = "自动保存",
): RevisionStore {
  const previous = store[article.id] || [];
  if (previous[0] && sameArticle(previous[0].article, article, true)) {
    // Pin explicit saves/checkpoints so a following autosave cannot coalesce them away.
    if (label !== "自动保存" && previous[0].label === "自动保存") {
      return {
        ...store,
        [article.id]: [{ ...previous[0], label }, ...previous.slice(1)],
      };
    }
    return store;
  }
  const now = Date.now();
  const coalesce =
    label === "自动保存" &&
    previous[0]?.label === label &&
    Math.floor(now / 60_000) === Math.floor(previous[0].savedAt / 60_000);
  const revision = {
    id: uid(),
    savedAt: now,
    label: previous.length ? label : "初始版本",
    article: copyArticle(article),
  };
  return {
    ...store,
    [article.id]: [revision, ...previous.slice(coalesce ? 1 : 0)].slice(0, 30),
  };
}

export function htmlText(html: string) {
  return (
    new DOMParser().parseFromString(html, "text/html").body.textContent || ""
  );
}

export function filterDocuments(
  documents: Article[],
  query: string,
  tag: string,
  fullText: boolean,
) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return documents
    .filter(
      (a) =>
        (!tag || a.tags.includes(tag)) &&
        words.every((word) =>
          [
            a.title,
            a.description,
            ...(fullText ? a.blocks.map((b) => htmlText(b.html)) : []),
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(word),
        ),
    )
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function articleFromHtml(
  html: string,
  title: string,
  link = "",
): Article {
  const doc = new DOMParser().parseFromString(html, "text/html");
  // WeChat often defers images in data-src; turn these into ordinary safe images.
  doc.querySelectorAll("img[data-src]").forEach((img) => {
    if (!img.getAttribute("src"))
      img.setAttribute("src", img.getAttribute("data-src") || "");
  });
  const body = doc.querySelector("#js_content") || doc.body;
  const clean = new DOMParser().parseFromString(
    sanitize(body.innerHTML),
    "text/html",
  ).body;
  const blocks: Block[] = [];
  clean.childNodes.forEach((node) => {
    const el = node.nodeType === 1 ? (node as HTMLElement) : null;
    const value = el ? el.outerHTML : escapeHtml(node.textContent || "").trim();
    if (!value) return;
    const imageOnly =
      el?.matches("img,figure") ||
      (el?.querySelector("img") && !el.textContent?.trim());
    const kind = el?.matches("h1,h2,h3,h4,h5,h6")
      ? "heading"
      : el?.matches("table")
        ? "table"
        : imageOnly
          ? "image"
          : "text";
    blocks.push(
      makeBlock(
        kind,
        kind === "heading"
          ? (el?.textContent || "标题").slice(0, 40)
          : "导入内容",
        el ? value : `<p>${value}</p>`,
      ),
    );
  });
  if (!blocks.length) throw new Error("没有可导入的正文内容");
  if (blocks.length > 500) throw new Error("内容超过 500 个组件，请拆分后导入");
  return {
    ...newArticle(true),
    title: title.trim() || doc.title || "导入图文",
    blocks,
    link: safeUrl(link),
  };
}

export function csvToHtml(text: string) {
  const rows: string[][] = [[]];
  let value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && quoted && text[i + 1] === '"') {
      value += '"';
      i++;
    } else if (c === '"') quoted = !quoted;
    else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      rows.at(-1)!.push(value);
      value = "";
      if (c !== ",") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        rows.push([]);
      }
    } else value += c;
  }
  if (quoted) throw new Error("CSV 引号未闭合，请检查文件");
  rows.at(-1)!.push(value);
  return tableHtml(rows.filter((r) => r.some((c) => c.trim())));
}

function tableHtml(rows: unknown[][]) {
  if (rows.length > 5000 || rows.some((r) => r.length > 100))
    throw new Error("表格请控制在 5000 行、100 列以内");
  return `<table style="width:100%;border-collapse:collapse"><tbody>${rows.map((row, i) => `<tr>${row.map((cell) => `<${i ? "td" : "th"} style="border:1px solid #ddd;padding:8px">${escapeHtml(cell instanceof Date ? cell.toISOString().slice(0, 10) : String(cell ?? "")).replace(/\n/g, "<br>")}</${i ? "td" : "th"}>`).join("")}</tr>`).join("")}</tbody></table>`;
}

export async function importDocument(
  file: File,
): Promise<{ article: Article; note: string }> {
  if (file.size > 50 * 1024 * 1024) throw new Error("文件请小于 50 MB");
  const ext = file.name.split(".").at(-1)?.toLowerCase();
  const title = file.name.replace(/\.[^.]+$/, "");
  let html = "",
    note = "";
  if (ext === "json")
    return {
      article: parseArticle(JSON.parse(await file.text())),
      note: "工程已导入",
    };
  if (ext === "docx") {
    const { default: mammoth } = await import("mammoth/mammoth.browser.js");
    const result = await mammoth.convertToHtml({
      arrayBuffer: await file.arrayBuffer(),
    });
    html = result.value;
    note = "已导入文字、图片与表格；Word 页眉页脚和复杂版式不会保留";
  } else if (ext === "xlsx") {
    const { default: readXlsxFile } = await import("read-excel-file/browser");
    const buffer = await file.arrayBuffer();
    const sheets = await readXlsxFile(buffer);
    if (sheets.length > 30) throw new Error("工作表超过 30 张，请拆分文件");
    const parts = [];
    for (const sheet of sheets) {
      parts.push(`<h2>${escapeHtml(sheet.sheet)}</h2>${tableHtml(sheet.data)}`);
    }
    html = parts.join("");
    note = `已导入 ${sheets.length} 张工作表的单元格内容（公式使用已保存的计算结果）`;
  } else if (ext === "md" || ext === "markdown") {
    const { marked } = await import("marked");
    html = await marked.parse(await file.text());
  } else if (ext === "csv") html = csvToHtml(await file.text());
  else if (ext === "txt")
    html = (await file.text())
      .split(/\n\s*\n/)
      .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
      .join("");
  else if (ext === "html" || ext === "htm") html = await file.text();
  else
    throw new Error(
      "支持 DOCX、XLSX、CSV、Markdown、HTML、TXT、JSON；旧版 DOC/XLS 请先另存为 DOCX/XLSX",
    );
  return {
    article: articleFromHtml(html, title),
    note: note || "已导入为新的图文，原图文已保留",
  };
}

export function collectImages(article: Article, assets: Asset[]) {
  const known = new Set(assets.map((a) => a.src));
  const added: Asset[] = [];
  for (const b of article.blocks) {
    const doc = new DOMParser().parseFromString(b.html, "text/html");
    doc.querySelectorAll("img:not([data-decoration])").forEach((img) => {
      const src = safeUrl(img.getAttribute("src") || "", true);
      if (!src || known.has(src)) return;
      known.add(src);
      added.push({
        id: uid(),
        type: "image",
        src,
        name:
          img.getAttribute("alt") ||
          `${article.title} · 图片 ${added.length + 1}`,
      });
    });
  }
  return added;
}

export const layoutPresets = [
  {
    id: "clean",
    name: "简洁阅读",
    color: "#333333",
    accent: "#52b4c4",
    fontSize: 16,
    lineHeight: 1.8,
    gap: 18,
  },
  {
    id: "editorial",
    name: "杂志留白",
    color: "#3d3d3d",
    accent: "#b47c48",
    fontSize: 15,
    lineHeight: 2,
    gap: 26,
  },
  {
    id: "compact",
    name: "紧凑资讯",
    color: "#303843",
    accent: "#5376a2",
    fontSize: 14,
    lineHeight: 1.65,
    gap: 12,
  },
] as const;

export function applyLayout(article: Article, presetId: string): Article {
  const p = layoutPresets.find((p) => p.id === presetId) || layoutPresets[0];
  return {
    ...clone(article),
    theme: p.accent,
    blocks: article.blocks.map((b) => {
      if (b.locked || !["text", "heading"].includes(b.kind)) return clone(b);
      const doc = new DOMParser().parseFromString(b.html, "text/html");
      // Only normalize text typography; images and decorative/nested layout keep their geometry.
      doc
        .querySelectorAll<HTMLElement>(
          "p,h1,h2,h3,h4,h5,h6,span,b,strong,em,i,a,li",
        )
        .forEach((el) => {
          if (el.closest("[data-festival-heading],[data-festival-card]"))
            return;
          [
            "font-size",
            "line-height",
            "letter-spacing",
            "font-family",
            "color",
          ].forEach((prop) => el.style.removeProperty(prop));
          if (el.matches("p")) {
            el.style.margin = "0 0 1em";
            el.style.textAlign = "justify";
          }
          if (el.matches("h1,h2,h3,h4,h5,h6")) {
            el.style.fontSize = "inherit";
            el.style.lineHeight = "inherit";
            el.style.margin = "0";
          }
        });
      return {
        ...clone(b),
        html: doc.body.innerHTML,
        style: {
          ...b.style,
          fontSize:
            b.kind === "heading" ? (p.fontSize >= 15 ? 22 : 20) : p.fontSize,
          lineHeight: p.lineHeight,
          color: b.kind === "heading" ? p.accent : p.color,
          padding: 16,
          marginBottom: p.gap,
          letterSpacing: 0.5,
        },
      };
    }),
  };
}
