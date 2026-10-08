import { FONT_OPTIONS, fontOption, fontWeight } from "./fonts.ts";

const loading = new Map<string, Promise<void>>();

export function loadFont(value: string, weight = 400): Promise<void> {
  const font = fontOption(value);
  const actualWeight = fontWeight(value, weight);
  const key = `${font.id}:${actualWeight}`;
  if (!loading.has(key)) {
    const requests = [document.fonts.load(`${actualWeight} 16px "${font.family}"`, "字体 Aa 0123")];
    // L3 contains only additional characters. Keep it as the same typeface's fallback,
    // using its actual regular weight even when the main text is bold.
    if (font.id === "alibaba-puhuiti")
      requests.push(document.fonts.load('400 16px "Alibaba PuHuiTi 3 L3"', "𠀀"));
    const promise = Promise.all(requests)
      .then((groups) => {
        if (groups.some((faces) => !faces.length || faces.some((face) => face.status !== "loaded")))
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
  return Promise.all([...weights].map((weight) => loadFont(value, weight)));
}

// Warm common faces once the editor is ready; failures remain retryable on selection.
export async function warmFonts(): Promise<void> {
  for (const font of FONT_OPTIONS)
    await Promise.allSettled([loadFont(font.value), loadFont(font.value, 700)]);
}
