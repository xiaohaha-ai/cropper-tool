export type ImageAlignment = "left" | "center" | "right";
export type ImageLayout = {
  width: number;
  height: number;
  alignment: ImageAlignment;
  fit: string;
  containerWidth: number;
  aspectRatio: number;
};

export function imageAlignmentStyle(alignment: ImageAlignment) {
  return {
    display: "block",
    marginLeft: alignment === "left" ? "0" : "auto",
    marginRight: alignment === "right" ? "0" : "auto",
    objectPosition: `${alignment} center`,
    justifySelf: alignment === "center" ? "center" : alignment === "left" ? "start" : "end",
  } as const;
}

export function readImageLayout(image: HTMLImageElement): ImageLayout {
  const linked = image.parentElement?.tagName === "A";
  const box = linked ? image.parentElement! : image;
  const parent = box.parentElement!;
  const css = getComputedStyle(image);
  const boxCss = getComputedStyle(box);
  const parentCss = getComputedStyle(parent);
  const containerWidth = Math.max(1, parent.clientWidth - (parseFloat(parentCss.paddingLeft) || 0) - (parseFloat(parentCss.paddingRight) || 0));
  const authoredWidth = box.style.width;
  const width = /^\d+(\.\d+)?%$/.test(authoredWidth)
    ? parseFloat(authoredWidth) : (parseFloat(boxCss.width) || image.width) / containerWidth * 100;
  const height = image.style.height === "auto" || (!image.style.height && !image.hasAttribute("height"))
    ? 0 : parseFloat(css.height) || 0;
  let alignment: ImageAlignment = "left";
  if (box.style.marginLeft === "auto") alignment = box.style.marginRight === "auto" ? "center" : "right";
  else if (box.style.marginRight === "auto") alignment = "left";
  else if (css.objectFit === "contain" && height) {
    const position = css.objectPosition.split(" ")[0];
    alignment = position === "100%" || position === "right" ? "right" : position === "0%" || position === "left" ? "left" : "center";
  } else {
    // Imported images can be positioned by their paragraph or a flex/grid cell.
    const rect = box.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    const scale = parentRect.width / parent.offsetWidth || 1;
    const left = (rect.left - parentRect.left) / scale - (parseFloat(parentCss.paddingLeft) || 0);
    const free = containerWidth - rect.width / scale;
    if (free > 2) alignment = left > free * 0.75 ? "right" : left > free * 0.25 ? "center" : "left";
  }
  return { width: Math.min(100, Math.max(1, width)), height, alignment, fit: css.objectFit === "fill" ? "fill" : css.objectFit || "cover",
    containerWidth, aspectRatio: image.naturalWidth / image.naturalHeight || 1 };
}

// With contain + fixed height, the painted image can be much narrower than its
// element. Resize from the painted width so the first zoom step really enlarges it.
export function visibleImageWidth(layout: ImageLayout) {
  const width = layout.fit === "contain" && layout.height
    ? Math.min(layout.width, layout.height * layout.aspectRatio / layout.containerWidth * 100)
    : layout.width;
  return Math.round(width * 10) / 10;
}

export function resizeImage<T extends ImageLayout>(layout: T, width: number): T {
  return { ...layout, width: Math.min(100, Math.max(1, Number.isFinite(width) ? width : 100)), height: 0 };
}

export function applyImageLayout(image: HTMLImageElement, layout: ImageLayout, link: string) {
  const oldLink = image.closest("a");
  if (oldLink) oldLink.replaceWith(...Array.from(oldLink.childNodes));
  let box: HTMLElement = image;
  if (link) {
    const anchor = image.ownerDocument.createElement("a");
    anchor.href = link;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.dataset.imageLayout = "true";
    image.replaceWith(anchor);
    anchor.append(image);
    box = anchor;
  }
  Object.assign(box.style, imageAlignmentStyle(layout.alignment), { width: `${layout.width}%`, maxWidth: "100%", float: "none" });
  Object.assign(image.style, imageAlignmentStyle(layout.alignment), {
    width: box === image ? `${layout.width}%` : "100%", maxWidth: "100%",
    height: layout.height ? `${layout.height}px` : "auto", maxHeight: "none", minHeight: "0", aspectRatio: "auto", objectFit: layout.fit,
  });
}
