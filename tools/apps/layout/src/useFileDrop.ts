import { useEffect, useRef, useState, type DragEvent } from "react";

export const isFileDrag = (transfer: DataTransfer) =>
  Array.from(transfer.types).includes("Files");

// Files are only readable at drop time. Track nested drag events so moving
// across thumbnails or article children does not flicker the drop feedback.
export function useFileDrop(onFiles: (files: File[], event: DragEvent<HTMLElement>) => void) {
  const [draggingFiles, setDraggingFiles] = useState(false);
  const depth = useRef(0);
  const reset = () => { depth.current = 0; setDraggingFiles(false); };
  useEffect(() => {
    window.addEventListener("drop", reset);
    window.addEventListener("dragend", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("drop", reset);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);
  return {
    draggingFiles,
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      depth.current += 1;
      setDraggingFiles(true);
    },
    onDragLeave: () => {
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setDraggingFiles(false);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      reset();
      if (!isFileDrag(event.dataTransfer)) return;
      event.preventDefault();
      event.stopPropagation();
      onFiles(Array.from(event.dataTransfer.files), event);
    },
  };
}
