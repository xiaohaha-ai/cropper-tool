import type { Article, Block } from "./model.ts";
import manifest from "./fontManifest.json" with { type: "json" };

export const FONT_OPTIONS = manifest;
export const SANS_FONT = '"Source Han Sans SC", sans-serif';
export const SERIF_FONT = '"Source Han Serif SC", serif';

// An explicit allowlist also applies to imported HTML, SVG and saved documents.
export function normalizeFontFamily(value: string): string {
  if (!value || /^(inherit|unset|revert(?:-layer)?)$/i.test(value.trim())) return value;
  const first = value.split(",")[0].replace(/["']/g, "").trim();
  const allowed = FONT_OPTIONS.find((font) => [font.family, font.label, font.id]
    .some((name) => name.toLowerCase() === first.toLowerCase()));
  if (allowed) return allowed.value;
  if (/^(Noto Sans SC Variable|NotoSansSC(?:-\w+)?)$/i.test(first)) return FONT_OPTIONS[3].value;
  if (/^(AlibabaPuHuiTi|阿里巴巴普惠体)/i.test(first)) return FONT_OPTIONS[2].value;
  return /serif|simsun|song|宋|times|georgia|ming|明朝/i.test(first) &&
    !/sans/i.test(first) ? SERIF_FONT : SANS_FONT;
}

export function fontOption(value: string) {
  return FONT_OPTIONS.find((font) => font.value === normalizeFontFamily(value)) || FONT_OPTIONS[0];
}

// Match the browser's CSS Fonts weight search, including the special 400–500 interval.
export function fontWeight(value: string, weight: number): number {
  const weights = fontOption(value).faces.map((face) => face.weight);
  const preferred = weight >= 400 && weight <= 500
    ? [...weights.filter((w) => w >= weight && w <= 500), ...weights.filter((w) => w < weight).reverse(), ...weights.filter((w) => w > 500)]
    : weight < 400
      ? [...weights.filter((w) => w <= weight).reverse(), ...weights.filter((w) => w > weight)]
      : [...weights.filter((w) => w >= weight), ...weights.filter((w) => w < weight).reverse()];
  return preferred[0];
}

export function normalizeFontHtml(html: string): string {
  if (!/font(?:-family)?\s*:|\b(?:face|font-family)\s*=/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  let changed = false;
  for (const el of doc.body.querySelectorAll<HTMLElement>("[style], [face], [font-family]")) {
    const family = el.style?.fontFamily;
    if (family && normalizeFontFamily(family) !== family) {
      const priority = el.style.getPropertyPriority("font-family");
      if (el.style.getPropertyValue("font")) {
        const properties = ["font-size", "font-weight", "font-style", "font-variant", "font-stretch", "line-height"]
          .map((name) => [name, el.style.getPropertyValue(name), el.style.getPropertyPriority(name)]);
        el.style.removeProperty("font");
        for (const [name, value, important] of properties)
          if (value) el.style.setProperty(name, value, important);
      }
      el.style.setProperty("font-family", normalizeFontFamily(family), priority);
      changed = true;
    }
    for (const attr of ["face", "font-family"]) {
      const value = el.getAttribute(attr);
      if (value && normalizeFontFamily(value) !== value) {
        el.setAttribute(attr, normalizeFontFamily(value));
        changed = true;
      }
    }
  }
  return changed ? doc.body.innerHTML : html;
}

export function normalizeBlockFonts(block: Block): Block {
  const html = normalizeFontHtml(block.html);
  const fontFamily = normalizeFontFamily(block.style.fontFamily || "");
  if (html === block.html && fontFamily === (block.style.fontFamily || "")) return block;
  return { ...block, html, style: fontFamily ? { ...block.style, fontFamily } : block.style };
}

export function normalizeArticleFonts(article: Article): Article {
  return { ...article, blocks: article.blocks.map(normalizeBlockFonts) };
}
