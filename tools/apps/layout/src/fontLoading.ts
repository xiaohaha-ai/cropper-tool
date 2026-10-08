import { FONT_OPTIONS, fontOption, fontWeight } from "./fonts.ts";
const loading = new Map<string, Promise<void>>();

// A unicode-range font may need another face when the text changes.
export function loadFont(value: string, weight = 400, text = "字体 Aa 0123"): Promise<void> {
  const font = fontOption(value);
  const actualWeight = fontWeight(value, weight);
  const characters = [...new Set(Array.from(text || "Aa"))].sort().join("");
  const key = `${font.id}:${actualWeight}:${characters}`;
  if (!loading.has(key)) {
    const requests = [document.fonts.load(`${actualWeight} 16px "${font.family}"`, characters)];
    if (font.id === "alibaba-puhuiti")
      requests.push(document.fonts.load('400 16px "Alibaba PuHuiTi 3 L3"', characters));
    const promise = Promise.all(requests).then((groups) => {
      const faces = groups.flat();
      if (!faces.length || faces.some((face) => face.status !== "loaded"))
        throw new Error(`${font.label}加载失败，请重试`);
    }).catch((error) => { loading.delete(key); throw error; });
    loading.set(key, promise);
  }
  return loading.get(key)!;
}
export function loadContentFont(root: HTMLElement, value: string): Promise<void[]> {
  const weights = new Set([Number(getComputedStyle(root).fontWeight) || 400]);
  for (const node of root.querySelectorAll("*"))
    if (Array.from(node.childNodes).some((child) => child.nodeType === 3 && child.textContent?.trim()))
      weights.add(Number(getComputedStyle(node).fontWeight) || 400);
  return Promise.all([...weights].map((weight) => loadFont(value, weight, root.textContent || "Aa")));
}
export async function warmFonts(): Promise<void> {
  for (const font of FONT_OPTIONS)
    await Promise.allSettled([loadFont(font.value), loadFont(font.value, 700)]);
}
