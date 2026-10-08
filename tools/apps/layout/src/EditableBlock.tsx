import { useLayoutEffect, useRef, useState, memo, type CSSProperties } from "react";
import { DotsSixVertical, LockSimple } from "@phosphor-icons/react";
import { type Block, sanitize } from "./model";
import { isFileDrag } from "./useFileDrop";
import { BlockFrameControls } from "./BlockFrameControls";
import { type BlockFrame } from "./frameLayout";

function ImageSelectionFrame({ image, locked }: { image: HTMLImageElement; locked?: boolean }) {
  const [bounds, setBounds] = useState<CSSProperties>({ display: "none" });
  useLayoutEffect(() => {
    const block = image.closest<HTMLElement>(".article-block");
    if (!block) return;
    const measure = () => {
      const rect = image.getBoundingClientRect();
      const parent = block.getBoundingClientRect();
      const scale = parent.width / block.offsetWidth || 1;
      setBounds({ left: (rect.left - parent.left) / scale, top: (rect.top - parent.top) / scale,
        width: rect.width / scale, height: rect.height / scale });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(block);
    observer.observe(image);
    return () => observer.disconnect();
  }, [image]);
  return <div className="image-selection-frame" data-editor-only style={bounds}>
    {!locked && <span>双击设置图片</span>}
  </div>;
}
type Props = {
  block: Block;
  selected: boolean;
  index: number;
  onSelect: (id: string, showToolbar?: boolean) => void;
  onChange: (id: string, html: string) => void;
  onImage: (image: HTMLImageElement, id: string) => void;
  onDrop: (id: string) => void;
  onDrag: (id: string) => void;
  onRange: () => void;
  onFrame: (id: string, frame: BlockFrame | undefined) => void;
  onCompose: (id: string) => void;
};
export const EditableBlock = memo(function EditableBlock({
  block,
  selected,
  index,
  onSelect,
  onChange,
  onImage,
  onDrop,
  onDrag,
  onRange,
  onFrame,
  onCompose,
}: Props) {
  const blockRef = useRef<HTMLElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const displayedHtml = useRef<string | null>(null);
  const emitContent = (element: HTMLDivElement) => {
    const html = element.innerHTML;
    displayedHtml.current = html;
    onChange(block.id, html);
  };
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);
  const [draftFrame, setDraftFrame] = useState<BlockFrame | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const frame = draftFrame || block.frame;
  const frameScale = frame ? (viewportWidth || frame.sourceWidth) / frame.crop.width : 1;
  const canAdjustFrame = selected && !block.locked && !!(selectedImage || block.frame || block.kind === "image");
  useLayoutEffect(() => {
    if (!viewport.current) return;
    const measure = () => setViewportWidth(viewport.current ? parseFloat(getComputedStyle(viewport.current).width) || viewport.current.clientWidth : 0);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [frame?.width]);
  useLayoutEffect(() => {
    if (content.current && displayedHtml.current !== block.html) {
      // Input already changed the DOM. Only inspect it for an external edit/undo.
      if (content.current.innerHTML !== block.html) {
        content.current.innerHTML = block.html;
        setSelectedImage(null);
      }
      displayedHtml.current = block.html;
    }
  }, [block.html]);
  useLayoutEffect(() => {
    if (!selected) { setSelectedImage(null); setDraftFrame(null); }
  }, [selected]);
  return (
    <section
      ref={blockRef}
      className={`article-block ${selected ? "selected" : ""} ${block.locked ? "locked" : ""} ${canAdjustFrame ? "has-frame-controls" : ""}`}
      style={frame ? { width: `${frame.width}%`, marginLeft: `${frame.left}%` } : undefined}
      data-block-id={block.id}
      data-selected={selected}
      onClick={() => onSelect(block.id)}
      onDragOver={(e) => {
        if (isFileDrag(e.dataTransfer)) return;
        if (!e.dataTransfer.types.includes("text/x-studio-block")) return;
        e.preventDefault();
        e.currentTarget.classList.add("drop-target");
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null))
          e.currentTarget.classList.remove("drop-target");
      }}
      onDrop={(e) => {
        e.currentTarget.classList.remove("drop-target");
        if (isFileDrag(e.dataTransfer) || !e.dataTransfer.types.includes("text/x-studio-block")) return;
        e.preventDefault();
        e.stopPropagation();
        onDrop(block.id);
      }}
    >
      <button
        className="block-drag"
        data-editor-only
        draggable
        title="拖动调整组件顺序"
        aria-label={`拖动第${index + 1}个组件`}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/x-studio-block", block.id);
          onDrag(block.id);
        }}
        onDragEnd={() => onDrag("")}
      >
        <DotsSixVertical size={17} />
      </button>
      {selected && (
        <span data-editor-only className="block-label">
          {block.locked && <LockSimple size={11} />} {block.name}
        </span>
      )}
      <div ref={viewport} className="block-viewport" style={frame ? { height: frame.crop.height * frameScale, overflow: "hidden", display: "flow-root" } : undefined}>
      <div className="block-source" style={frame ? {
        width: frame.sourceWidth, containerType: "inline-size", display: "flow-root",
        transform: `scale(${frameScale})`, transformOrigin: "0 0",
        marginLeft: -frame.crop.x * frameScale, marginTop: -frame.crop.y * frameScale,
      } : undefined}>
      <div
        ref={content}
        className="block-content"
        data-testid="block-content"
        role="textbox"
        aria-label={`${block.name}内容`}
        aria-multiline="true"
        contentEditable={
          !block.locked &&
          !["audio", "video", "svg", "divider"].includes(block.kind)
        }
        suppressContentEditableWarning
        style={{
          ...block.style,
          borderStyle: block.style.borderWidth ? "solid" : undefined,
        }}
        onInput={(e) => emitContent(e.currentTarget)}
        onMouseUp={onRange}
        onKeyUp={onRange}
        onFocus={() => onSelect(block.id)}
        onPaste={(e) => {
          e.preventDefault();
          const html = e.clipboardData.getData("text/html");
          const text = e.clipboardData.getData("text/plain");
          if (html) document.execCommand("insertHTML", false, sanitize(html));
          else document.execCommand("insertText", false, text);
          emitContent(e.currentTarget);
        }}
        onDragStart={(e) => {
          if ((e.target as HTMLElement).closest("img")) e.preventDefault();
        }}
        onMouseDown={(e) => {
          // Focusing contenteditable reveals the text toolbar and shifts the
          // canvas between mouse-down and click. Images only need selection.
          if ((e.target as HTMLElement).tagName === "IMG") {
            e.preventDefault();
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            window.getSelection()?.removeAllRanges();
          }
        }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.tagName === "IMG") {
            e.preventDefault();
            e.stopPropagation();
            onSelect(block.id, false);
            setSelectedImage(target.hasAttribute("data-decoration") ? null : target as HTMLImageElement);
          } else setSelectedImage(null);
          if (target.closest("a")) e.preventDefault();
        }}
        onDoubleClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-composition="1"]')) {
            e.preventDefault(); e.stopPropagation();
            if (!block.locked) onCompose(block.id);
            return;
          }
          if (target.tagName === "IMG") {
            e.preventDefault();
            if (!target.hasAttribute("data-decoration") && !block.locked)
              onImage(target as HTMLImageElement, block.id);
          }
          if (target.closest("a")) e.preventDefault();
        }}
      />
      </div>
      </div>
      {selected && !frame && selectedImage?.isConnected && <ImageSelectionFrame image={selectedImage} locked={block.locked} />}
      {canAdjustFrame && <BlockFrameControls key={block.frame ? JSON.stringify(block.frame) : "original"}
        frame={block.frame} blockRef={blockRef} onPreview={setDraftFrame}
        onCommit={(next) => onFrame(block.id, next)} />}
    </section>
  );
});
