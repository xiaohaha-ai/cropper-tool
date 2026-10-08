export type FrameRect = { x: number; y: number; width: number; height: number };
export type BlockFrame = {
  width: number;
  left: number;
  sourceWidth: number;
  sourceHeight: number;
  crop: FrameRect;
};
export type FrameHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function normalizeFrame(raw: unknown): BlockFrame | undefined {
  if (!raw || typeof raw !== "object") return;
  const frame = raw as BlockFrame;
  if (!frame.crop || ![frame.width, frame.left, frame.sourceWidth, frame.sourceHeight,
    frame.crop.x, frame.crop.y, frame.crop.width, frame.crop.height].every(Number.isFinite) ||
    frame.sourceWidth < 1 || frame.sourceHeight < 1 || frame.crop.width < 1 || frame.crop.height < 1) return;
  const sourceWidth = clamp(frame.sourceWidth, 1, 100000);
  const sourceHeight = clamp(frame.sourceHeight, 1, 100000);
  const width = clamp(frame.width, 1, 100);
  const x = clamp(frame.crop.x, 0, sourceWidth - 1);
  const y = clamp(frame.crop.y, 0, sourceHeight - 1);
  return { width, left: clamp(frame.left, 0, 100 - width), sourceWidth, sourceHeight,
    crop: { x, y, width: clamp(frame.crop.width, 1, sourceWidth - x), height: clamp(frame.crop.height, 1, sourceHeight - y) } };
}

export function resizeFrame(frame: BlockFrame, handle: FrameHandle, dx: number, dy: number, screenWidth: number, screenHeight: number) {
  const horizontal = (handle.includes("w") ? -dx : dx) / screenWidth;
  const vertical = (handle.includes("n") ? -dy : dy) / screenHeight;
  const factor = 1 + (Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical);
  const max = handle.includes("w") ? frame.width + frame.left : 100 - frame.left;
  const width = clamp(frame.width * factor, Math.min(max, Math.max(1, frame.width * 24 / screenWidth)), max);
  return { ...frame, width, left: handle.includes("w") ? frame.left + frame.width - width : frame.left };
}

export function dragCrop(rect: FrameRect, bounds: FrameRect, handle: FrameHandle | "move", dx: number, dy: number): FrameRect {
  if (handle === "move") return { ...rect,
    x: clamp(rect.x + dx, bounds.x, bounds.x + bounds.width - rect.width),
    y: clamp(rect.y + dy, bounds.y, bounds.y + bounds.height - rect.height) };
  const minWidth = Math.min(16, bounds.width);
  const minHeight = Math.min(16, bounds.height);
  const left = handle.includes("w") ? clamp(rect.x + dx, bounds.x, rect.x + rect.width - minWidth) : rect.x;
  const top = handle.includes("n") ? clamp(rect.y + dy, bounds.y, rect.y + rect.height - minHeight) : rect.y;
  const right = handle.includes("e") ? clamp(rect.x + rect.width + dx, left + minWidth, bounds.x + bounds.width) : rect.x + rect.width;
  const bottom = handle.includes("s") ? clamp(rect.y + rect.height + dy, top + minHeight, bounds.y + bounds.height) : rect.y + rect.height;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function cropFrame(frame: BlockFrame, crop: FrameRect): BlockFrame {
  return { ...frame, width: frame.width * crop.width / frame.crop.width,
    left: frame.left + frame.width * (crop.x - frame.crop.x) / frame.crop.width, crop };
}
