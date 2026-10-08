import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from "react";
import { cropFrame, dragCrop, resizeFrame, type BlockFrame, type FrameHandle, type FrameRect } from "./frameLayout";

const handles: FrameHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const names = { nw: "左上角", n: "上边", ne: "右上角", e: "右边", se: "右下角", s: "下边", sw: "左下角", w: "左边" };
type Props = {
  frame?: BlockFrame;
  blockRef: RefObject<HTMLElement | null>;
  onPreview: (frame: BlockFrame | null) => void;
  onCommit: (frame: BlockFrame | undefined) => void;
};

export function BlockFrameControls({ frame, blockRef, onPreview, onCommit }: Props) {
  const [crop, setCrop] = useState<{ base: BlockFrame; rect: FrameRect } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uiScale, setUiScale] = useState(1);
  useLayoutEffect(() => {
    const block = blockRef.current;
    if (!block) return;
    const width = parseFloat(getComputedStyle(block).width);
    const screenWidth = block.getBoundingClientRect().width;
    if (width > 0 && screenWidth > 0) setUiScale(Math.round(width / screenWidth * 1000) / 1000);
  });
  const drag = useRef<{
    pointerId: number; handle: FrameHandle; startX: number; startY: number;
    base: BlockFrame; rect: FrameRect; screenWidth: number; screenHeight: number;
    mode: "resize" | "crop"; changed: boolean; next?: BlockFrame;
  } | null>(null);
  const getFrame = (): BlockFrame => {
    if (frame) return frame;
    const block = blockRef.current!;
    const sourceWidth = parseFloat(getComputedStyle(block).width) || block.offsetWidth;
    const sourceHeight = parseFloat(getComputedStyle(block).height) || block.offsetHeight;
    return { width: 100, left: 0, sourceWidth, sourceHeight,
      crop: { x: 0, y: 0, width: sourceWidth, height: sourceHeight } };
  };
  const cancel = () => { drag.current = null; setDragging(false); onPreview(null); setCrop(null); };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault(); event.stopImmediatePropagation(); cancel();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  });
  const start = (event: PointerEvent<HTMLElement>, handle: FrameHandle) => {
    if (event.button !== 0 || !blockRef.current) return;
    event.preventDefault(); event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    const base = getFrame();
    const bounds = blockRef.current.getBoundingClientRect();
    drag.current = { pointerId: event.pointerId, handle, startX: event.clientX, startY: event.clientY,
      base, rect: base.crop, screenWidth: bounds.width, screenHeight: bounds.height,
      mode: handle.length === 1 ? "crop" : "resize", changed: false };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const move = (event: PointerEvent<HTMLElement>) => {
    const action = drag.current;
    if (!action || action.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const dx = event.clientX - action.startX;
    const dy = event.clientY - action.startY;
    if (Math.abs(dx) + Math.abs(dy) < 2 && !action.changed) return;
    action.changed = true;
    if (action.mode === "crop") {
      const rect = dragCrop(action.rect, action.base.crop, action.handle,
        dx * action.base.crop.width / action.screenWidth, dy * action.base.crop.height / action.screenHeight);
      action.next = cropFrame(action.base, rect);
      setCrop({ base: action.base, rect });
    } else {
      action.next = resizeFrame(action.base, action.handle, dx, dy, action.screenWidth, action.screenHeight);
      onPreview(action.next);
    }
  };
  const end = (event: PointerEvent<HTMLElement>) => {
    const action = drag.current;
    if (!action || action.pointerId !== event.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    drag.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (action.changed && action.next) onCommit(action.next);
    onPreview(null);
    setCrop(null);
  };
  const pointerEvents = { onPointerMove: move, onPointerUp: end, onPointerCancel: cancel,
    onLostPointerCapture: () => { if (drag.current) cancel(); } };
  const grip = (handle: FrameHandle) => <button key={handle} className={`frame-handle frame-handle-${handle} ${handle.length === 1 ? "frame-edge" : "frame-corner"}`}
    aria-label={`${handle.length === 1 ? "裁切" : "缩放"}外框${names[handle]}`} title={`${handle.length === 1 ? "拖动裁切，松手生效" : "拖动等比例缩放"} · ${names[handle]}`}
    onPointerDown={(event) => start(event, handle)} {...pointerEvents} />;
  const cropStyle: CSSProperties = crop ? {
    left: `${(crop.rect.x - crop.base.crop.x) / crop.base.crop.width * 100}%`,
    top: `${(crop.rect.y - crop.base.crop.y) / crop.base.crop.height * 100}%`,
    width: `${crop.rect.width / crop.base.crop.width * 100}%`,
    height: `${crop.rect.height / crop.base.crop.height * 100}%`,
  } : { inset: 0 };
  return <div className={`block-frame-controls ${dragging ? "is-dragging" : ""} ${crop ? "is-cropping" : ""}`} data-editor-only
    style={{ "--frame-ui-scale": uiScale } as CSSProperties}
    onClick={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()}>
    {crop && <div className="frame-crop-mask"><div className="frame-crop-shadow" style={cropStyle} /></div>}
    <div className="frame-crop-box" style={cropStyle}>
      {handles.map(grip)}
    </div>
  </div>;
}
