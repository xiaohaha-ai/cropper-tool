export type RichContent = { html: string; text: string };

export function selectAllContent(element: HTMLElement) {
  element.focus({ preventScroll: true });
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(element);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

export function setRichClipboard(data: DataTransfer, content: RichContent) {
  data.setData("text/html", content.html);
  data.setData("text/plain", content.text);
}

export async function copyRichContent(content: RichContent, preview: HTMLElement) {
  // Content is prepared before the click so Safari keeps the user gesture.
  if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([content.html], { type: "text/html" }),
        "text/plain": new Blob([content.text], { type: "text/plain" }),
      })]);
      return;
    } catch {
      // Permission denial can still allow the browser's native Copy command.
    }
  }
  selectAllContent(preview);
  let handled = false;
  const onCopy = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    setRichClipboard(event.clipboardData, content);
    event.preventDefault();
    handled = true;
  };
  document.addEventListener("copy", onCopy, true);
  try {
    if (document.execCommand("copy") && handled) return;
  } catch {
    // Leave the whole article selected for a real keyboard/menu copy.
  } finally {
    document.removeEventListener("copy", onCopy, true);
  }
  throw new Error("浏览器未允许一键复制，正文已全选，请按 ⌘C / Ctrl+C，或右键选择复制。");
}
