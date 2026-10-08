import { FONT_OPTIONS, fontWeight } from "./fonts.ts";
import { loadFont } from "./fontLoading.ts";

// Embed only the families and real weights used in this article.
function coversText(range: string, points: number[]): boolean {
  if (!range) return true;
  return range.split(",").some((part) => {
    const match = part.trim().match(/^U\+([0-9a-f?]+)(?:-([0-9a-f]+))?$/i);
    if (!match) return false;
    const min = parseInt(match[1].replace(/\?/g, "0"), 16);
    const max = parseInt(match[2] || match[1].replace(/\?/g, "f"), 16);
    return points.some((point) => point >= min && point <= max);
  });
}

export async function embedArticleFonts(paper: HTMLElement): Promise<string> {
  await document.fonts?.ready;
  const usage = new Map<string, { points: Set<number>; weights: Set<number> }>();
  for (const node of [paper, ...paper.querySelectorAll<HTMLElement>("*")]) {
    if (node.closest("[data-editor-only]")) continue;
    const ownText = Array.from(node.childNodes)
      .filter((child) => child.nodeType === 3)
      .map((child) => child.textContent || "").join("");
    if (!ownText.trim()) continue;
    const style = getComputedStyle(node);
    const family = style.fontFamily.split(",")[0].trim().replace(/["']/g, "");
    const font = FONT_OPTIONS.find((font) => font.family === family);
    if (!font) continue;
    if (!usage.has(family)) usage.set(family, { points: new Set(), weights: new Set() });
    const used = usage.get(family)!;
    Array.from(ownText, (char) => char.codePointAt(0)!).forEach((point) => used.points.add(point));
    used.weights.add(fontWeight(font.value, Number(style.fontWeight) || 400));
  }
  if (document.fonts) await Promise.all([...usage].flatMap(([family, used]) =>
    [...used.weights].map((weight) => loadFont(family, weight))));
  const rules: { rule: CSSFontFaceRule; base: string }[] = [];
  const visit = (sheet: CSSStyleSheet) => {
    let entries: CSSRuleList;
    try { entries = sheet.cssRules; } catch { return; }
    for (const rule of Array.from(entries)) {
      if (rule.type === 3) {
        const imported = (rule as CSSImportRule).styleSheet;
        if (imported) visit(imported);
      }
      if (rule.type !== 5) continue;
      const face = rule as CSSFontFaceRule;
      const family = face.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
      const extension = family === "Alibaba PuHuiTi 3 L3";
      const used = usage.get(extension ? "Alibaba PuHuiTi 3" : family);
      const weights = face.style.getPropertyValue("font-weight").split(/\s+/).map(Number);
      const minWeight = weights[0] || 400;
      const maxWeight = weights[1] || minWeight;
      if (used && (extension || [...used.weights].some((weight) => weight >= minWeight && weight <= maxWeight)) &&
        coversText(face.style.getPropertyValue("unicode-range"), [...used.points]))
        rules.push({ rule: face, base: sheet.href || document.baseURI });
    }
  };
  Array.from(document.styleSheets).forEach(visit);
  if (!rules.length) return "";
  const cache = new Map<string, Promise<string>>();
  const embed = (url: string) => {
    if (!cache.has(url)) cache.set(url, (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("字体文件读取失败，请刷新后重新导出");
      const blob = await response.blob();
      if (/text\/|json/.test(blob.type)) throw new Error("字体文件无效，请刷新后重新导出");
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("字体文件读取失败"));
        reader.readAsDataURL(blob);
      });
    })());
    return cache.get(url)!;
  };
  const css = await Promise.all(rules.map(async ({ rule, base }) => {
    let value = rule.cssText;
    for (const match of value.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
      if (match[1].startsWith("data:")) continue;
      value = value.replace(match[0], `url("${await embed(new URL(match[1], base).href)}")`);
    }
    return value;
  }));
  const licenses = FONT_OPTIONS.filter((font) => usage.has(font.family)).map((font) => font.license);
  const notices = await Promise.all(licenses.map(async (path) => {
    const license = await fetch(new URL(path, document.baseURI));
    if (!license.ok) throw new Error("字体授权文件读取失败，请刷新后重新导出");
    return (await license.text()).replace(/\*\//g, "* /").replace(/</g, "&lt;");
  }));
  return `/* Embedded font licenses and source notices\n${notices.join("\n\n")}\n*/\n${css.join("\n")}`;
}
