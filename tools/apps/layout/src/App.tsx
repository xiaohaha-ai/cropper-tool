import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import { FONT_OPTIONS, SANS_FONT } from "./fonts";
import { loadContentFont, warmFonts } from "./fontLoading";
import { AssetLibrary } from "./AssetLibraryPanel";
import { TemplateCards } from "./TemplateCards";
import { applyFontFamily, selectionFont, MIXED_FONT } from "./fontEditing";
import {
  FolderOpen,
  Camera,
  FloppyDisk,
  CheckCircle,
  CaretDown,
  CaretLeft,
  CaretRight,
  ArrowCounterClockwise,
  ArrowClockwise,
  Question,
  Gear,
  Image as ImageIcon,
  Images,
  Article,
  ClipboardText,
  Star,
  Shapes,
  Plus,
  MagnifyingGlass,
  ArrowsClockwise,
  Trash,
  Copy,
  PushPin,
  DotsThree,
  HandPointing,
  ArrowUp,
  ArrowDown,
  TextB,
  TextItalic,
  TextUnderline,
  TextStrikethrough,
  TextAlignLeft,
  TextAlignCenter,
  TextAlignRight,
  TextAlignJustify,
  ListBullets,
  ListNumbers,
  Link as LinkIcon,
  Broom,
  Minus,
  UploadSimple,
  DownloadSimple,
  X,
  Eye,
  SquaresFour,
  ChartBar,
  Palette,
  Check,
  DeviceMobile,
  Desktop,
  Code,
  FileHtml,
  FileText,
  FileJs,
  LockSimple,
  LockSimpleOpen,
  Scissors,
  MusicNote,
  VideoCamera,
  Table,
  ArrowSquareOut,
  ClockCounterClockwise,
  Paragraph,
  TextIndent,
  TextOutdent,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  type Article as ArticleData,
  type BlockKind,
  type BlockStyle,
  type Asset,
  type Template,
  templates,
  newArticle,
  makeBlock,
  clone,
  uid,
  sanitize,
  safeUrl,
  escapeHtml,
} from "./model";
import { useStudio } from "./useStudio";
import { EditableBlock } from "./EditableBlock";
import { CompositionEditor } from "./CompositionEditor";
import { arrangeText, compositionHtml, seedComposition, type Composition } from "./composition";
import { isFileDrag, useFileDrop } from "./useFileDrop";
import { applyImageLayout, imageAlignmentStyle, readImageLayout, resizeImage, visibleImageWidth, type ImageLayout } from "./imageLayout";
import { type BlockFrame } from "./frameLayout";
import {
  download,
  exportHtml,
  png,
  plainText,
  portableArticle,
  stickerArticle,
  scrollingVideo,
} from "./export";
import { DocumentPicker } from "./DocumentPicker";
import { CopyExport } from "./CopyExport";
import {
  WorkflowDialog,
  workflowTitles,
  type Workflow,
} from "./WorkflowDialogs";
import {
  collectImages,
  duplicateArticle,
  importDocument,
} from "./documentTools";

type Modal =
  | Workflow
  | "open"
  | "preview"
  | "export"
  | "copy"
  | "settings"
  | "help"
  | "source"
  | "link"
  | "media"
  | "table"
  | "image"
  | "composition"
  | "find"
  | "history"
  | "tags"
  | null;
type ImageSelection = ImageLayout & {
  blockId: string;
  index: number;
  src: string;
  alt: string;
  radius: number;
  link: string;
};
const categories = ["标题", "卡片", "图片", "布局", "SVG", "组件", "热门"];
const colors = [
  "#ffb733",
  "#e97676",
  "#88a997",
  "#78a9c0",
  "#9791b8",
  "#476653",
  "#343e4c",
  "#111111",
];
function IconButton({
  title,
  children,
  onClick,
  disabled = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`icon-button ${className}`}
    >
      {children}
    </button>
  );
}
function ModalWindow({
  title,
  children,
  onClose,
  wide = false,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const focusable = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,textarea,select,[tabindex="0"]',
        ) || [],
      );
    focusable()[0]?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const els = focusable();
        if (e.shiftKey && document.activeElement === els[0]) {
          e.preventDefault();
          els.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === els.at(-1)) {
          e.preventDefault();
          els[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <IconButton title="关闭弹窗" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export default function App() {
  const studio = useStudio();
  const { article, change, updateBlock, insert } = studio;
  const [selected, setSelected] = useState<string | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [side, setSide] = useState("图文模板");
  const [category, setCategory] = useState("全部");
  const [templateTab, setTemplateTab] = useState("推荐模板");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [shuffle, setShuffle] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [compositionSession, setCompositionSession] = useState<{ articleId: string; blockId?: string; initial: Composition } | null>(null);
  const [inspector, setInspector] = useState(false);
  const [outline, setOutline] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [topMenu, setTopMenu] = useState<"more" | "export" | null>(null);
  const topNav = useRef<HTMLElement>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [exportError, setExportError] = useState("");
  const [videoResult, setVideoResult] = useState<{
    url: string;
    filename: string;
  } | null>(null);
  const videoAbort = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      if (videoResult) URL.revokeObjectURL(videoResult.url);
    },
    [videoResult],
  );
  useEffect(() => {
    const dismiss = (e: Event) => {
      if (!topNav.current?.contains(e.target as Node)) setTopMenu(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTopMenu(null);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    if (modal) setTopMenu(null);
  }, [modal]);
  const [zoom, setZoom] = useState(100);
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth);
  useEffect(() => {
    const resize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const canvasScale =
    viewportWidth <= 800
      ? Math.min(zoom / 100, (viewportWidth - 86) / article.width)
      : zoom / 100;
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [previewWidth, setPreviewWidth] = useState(375);
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const [mediaType, setMediaType] = useState<"audio" | "video">("audio");
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(2);
  const [find, setFind] = useState("");
  const [replacement, setReplacement] = useState("");
  const [tagText, setTagText] = useState("");
  const [imageSelection, setImageSelection] = useState<ImageSelection | null>(
    null,
  );
  const [replaceImage, setReplaceImage] = useState(false);
  const [activeFormat, setActiveFormat] = useState<Record<string, boolean>>({});
  const [activeFont, setActiveFont] = useState(SANS_FONT);
  const [pendingFont, setPendingFont] = useState("");
  const fontRequest = useRef(0);
  const fontContext = useRef({ article, selected });
  fontContext.current = { article, selected };
  const paper = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const svgInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<{
    purpose: "library" | "canvas" | "cover" | "replace";
    articleId: string;
    groupId?: string;
    afterId?: string;
    image?: ImageSelection | null;
    imageSession?: number;
  }>({ purpose: "library", articleId: article.id });
  const imageSession = useRef(0);
  const uploadContext = useRef({ articleId: article.id, modal });
  uploadContext.current = { articleId: article.id, modal };
  const uploadGroup = useRef<string | undefined>(undefined);
  const [assetGroupFilter, setAssetGroupFilter] = useState("all");
  const savedRange = useRef<Range | null>(null);
  const dragId = useRef<string>("");
  const startBlockDrag = useCallback((id: string) => { dragId.current = id; }, []);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const activeBlock = article.blocks.find((b) => b.id === selected);
  const notify = useCallback((message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);
  const closeModal = useCallback(() => {
    imageSession.current += 1;
    setModal(null);
    setReplaceImage(false);
  }, []);
  useEffect(() => {
    const preventFileNavigation = (event: DragEvent) => {
      if (event.dataTransfer && isFileDrag(event.dataTransfer)) event.preventDefault();
    };
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);
  const select = useCallback((id: string, showToolbar = true) => {
    setSelected(id);
    if (showToolbar) setToolbarVisible(true);
  }, []);
  useEffect(() => {
    if (!studio.ready) return;
    const timer = window.setTimeout(() => { void warmFonts(); }, 500);
    return () => window.clearTimeout(timer);
  }, [studio.ready]);
  useEffect(() => {
    fontRequest.current += 1;
    setPendingFont("");
  }, [article.id, selected]);
  useEffect(() => {
    setToolbarVisible(false);
  }, [article.id]);
  useEffect(() => {
    const dismissToolbar = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (
        !target?.closest(
          ".article-block, .toolbar-stack, .inspector, .outline-panel, .modal",
        )
      )
        setToolbarVisible(false);
    };
    document.addEventListener("pointerdown", dismissToolbar);
    document.addEventListener("focusin", dismissToolbar);
    return () => {
      document.removeEventListener("pointerdown", dismissToolbar);
      document.removeEventListener("focusin", dismissToolbar);
    };
  }, []);
  useEffect(() => {
    if (studio.ready && !article.blocks.some((block) => block.id === selected))
      setSelected(article.blocks[0]?.id || null);
  }, [studio.ready, article.id, article.blocks, selected]);
  const selectedContent = useCallback(
    () =>
      paper.current?.querySelector<HTMLElement>(
        `[data-block-id="${selected}"] .block-content`,
      ) || null,
    [selected],
  );
  const saveRange = useCallback(() => {
    const selection = window.getSelection();
    if (
      selection?.rangeCount &&
      paper.current?.contains(selection.anchorNode)
    ) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
      const node = selection.anchorNode;
      const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
      const content = element?.closest<HTMLElement>(".block-content");
      if (content) setActiveFont(selectionFont(content, savedRange.current));
      const format = Object.fromEntries(
          [
            "bold",
            "italic",
            "underline",
            "strikeThrough",
            "insertUnorderedList",
            "insertOrderedList",
          ].map((k) => [k, document.queryCommandState(k)]),
        );
      setActiveFormat(previous => Object.keys(format).every(key => previous[key] === format[key]) ? previous : format);
    }
  }, []);
  useEffect(() => {
    document.addEventListener("selectionchange", saveRange);
    return () => document.removeEventListener("selectionchange", saveRange);
  }, [saveRange]);
  useEffect(() => {
    const content = selectedContent();
    if (content) setActiveFont(selectionFont(content, savedRange.current));
  }, [article.blocks, selectedContent]);
  useEffect(() => {
    const dismiss = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      document
        .querySelectorAll<HTMLDetailsElement>(".toolbar-menu[open]")
        .forEach((menu) => {
          if (
            !target ||
            !menu.contains(target) ||
            target.closest(".toolbar-menu button")
          )
            menu.open = false;
        });
    };
    const exclusive = (event: Event) => {
      const target = event.target;
      if (
        !(target instanceof HTMLDetailsElement) ||
        !target.open ||
        !target.matches(".toolbar-menu")
      )
        return;
      document
        .querySelectorAll<HTMLDetailsElement>(".toolbar-menu[open]")
        .forEach((menu) => {
          if (menu !== target) menu.open = false;
        });
    };
    document.addEventListener("click", dismiss);
    document.addEventListener("toggle", exclusive, true);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("toggle", exclusive, true);
    };
  }, []);
  const restoreRange = () => {
    const content = selectedContent();
    if (!content || activeBlock?.locked) return null;
    content.focus();
    const sel = window.getSelection();
    if (
      savedRange.current &&
      content.contains(savedRange.current.commonAncestorContainer)
    ) {
      sel?.removeAllRanges();
      sel?.addRange(savedRange.current);
    }
    return content;
  };
  const syncContent = () => {
    const content = selectedContent();
    if (content && selected)
      updateBlock(selected, { html: content.innerHTML }, `text:${selected}`);
    saveRange();
  };
  const command = (name: string, value?: string) => {
    if (!restoreRange()) {
      notify("请先选择一个可编辑组件");
      return;
    }
    document.execCommand(name, false, value);
    syncContent();
  };
  const styleBlock = (patch: BlockStyle) => {
    if (!activeBlock || activeBlock.locked) {
      notify("请先选择一个未锁定的组件");
      return;
    }
    updateBlock(activeBlock.id, { style: { ...activeBlock.style, ...patch } });
  };
  const inlineStyle = (property: string, value: string) => {
    const content = restoreRange();
    const range = window.getSelection()?.rangeCount
      ? window.getSelection()!.getRangeAt(0)
      : null;
    if (!content || !range) return;
    if (range.collapsed) {
      styleBlock({
        [property]: property === "fontSize" ? parseInt(value) : value,
      });
      return;
    }
    const span = document.createElement("span");
    span.style.setProperty(
      property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`),
      value,
    );
    span.append(range.extractContents());
    range.insertNode(span);
    range.selectNodeContents(span);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    syncContent();
  };
  const changeFont = async (value: string) => {
    const content = selectedContent();
    if (!content || !activeBlock || activeBlock.locked) {
      notify("请先选择一个未锁定的文字组件");
      return;
    }
    const range = savedRange.current && content.contains(savedRange.current.commonAncestorContainer)
      ? savedRange.current.cloneRange() : null;
    const request = ++fontRequest.current;
    const originalHtml = content.innerHTML;
    setPendingFont(value);
    try {
      await loadContentFont(content, value);
      if (request !== fontRequest.current) return;
      const context = fontContext.current;
      const latest = context.article.blocks.find((block) => block.id === activeBlock.id);
      if (context.article.id !== article.id || context.selected !== activeBlock.id ||
        !content.isConnected || !latest || latest.locked || latest !== activeBlock || content.innerHTML !== originalHtml) return;
      content.focus();
      const wholeBlock = applyFontFamily(content, range, value);
      if (range) {
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        savedRange.current = range.cloneRange();
      }
      updateBlock(activeBlock.id, {
        html: content.innerHTML,
        ...(wholeBlock ? { style: { ...activeBlock.style, fontFamily: value || SANS_FONT } } : {}),
      });
      setActiveFont(value || SANS_FONT);
    } catch (error) {
      if (request === fontRequest.current)
        notify(error instanceof Error ? error.message : "字体加载失败，请重试");
    } finally {
      if (request === fontRequest.current) setPendingFont("");
    }
  };
  const contentChanged = useCallback(
    (id: string, html: string) => updateBlock(id, { html }, `text:${id}`),
    [updateBlock],
  );
  const frameChanged = useCallback((id: string, frame: BlockFrame | undefined) => {
    updateBlock(id, { frame });
  }, [updateBlock]);
  const openComposition = useCallback((id?: string, leftText = false) => {
    const { article, selected } = fontContext.current;
    const block = article.blocks.find(b => b.id === (id || selected));
    if (block?.locked) { notify("组件已锁定，请先解锁"); return; }
    const element = block ? paper.current?.querySelector<HTMLElement>(`[data-block-id="${block.id}"]`) || null : null;
    let initial = seedComposition(block, element, article.width - 30);
    if (leftText) initial = arrangeText(initial, 'left');
    setCompositionSession({ articleId: article.id, blockId: block?.id, initial });
    setModal('composition');
  }, [notify]);
  const addTemplate = useCallback((t: Template, afterId = fontContext.current.selected || undefined) => {
    const id = insert(makeBlock(t.kind, t.name, t.html), afterId);
    setSelected(id);
    studio.setRecent((r) =>
      [t.id, ...r.filter((v) => v !== t.id)].slice(0, 30),
    );
    notify("已插入 " + t.name);
  }, [insert, studio.setRecent, notify]);
  const addText = () => {
    const id = insert(
      makeBlock("text", "正文", "<p>点击这里输入正文</p>", { padding: 16 }),
      selected || undefined,
    );
    setSelected(id);
  };
  const move = (id: string, direction: number) => {
    change((a) => {
      const i = a.blocks.findIndex((b) => b.id === id);
      const target = i + direction;
      if (target < 0 || target >= a.blocks.length) return a;
      [a.blocks[i], a.blocks[target]] = [a.blocks[target], a.blocks[i]];
      return a;
    });
  };
  const dropBlock = useCallback(
    (target: string) => {
      const dragged = dragId.current;
      dragId.current = "";
      if (!dragged || dragged === target) return;
      change((a) => {
        const from = a.blocks.findIndex((b) => b.id === dragged);
        const to = a.blocks.findIndex((b) => b.id === target);
        if (from < 0 || to < 0) return a;
        const [b] = a.blocks.splice(from, 1);
        a.blocks.splice(to, 0, b);
        return a;
      });
    },
    [change],
  );
  const removeBlock = () => {
    if (!activeBlock) return;
    if (activeBlock.locked) {
      notify("请先解锁组件");
      return;
    }
    const index = article.blocks.findIndex((b) => b.id === selected);
    change((a) => ({
      ...a,
      blocks: a.blocks.filter((b) => b.id !== selected),
    }));
    setSelected(
      article.blocks[index + 1]?.id || article.blocks[index - 1]?.id || null,
    );
  };
  const copyBlock = (cut = false) => {
    if (!activeBlock) return;
    studio.setClipboard([clone(activeBlock)]);
    notify(cut ? "已剪切，可从剪贴板粘贴" : "组件已放入剪贴板");
    if (cut) removeBlock();
  };
  const favorite = () => {
    if (!activeBlock) return;
    studio.setFavorites((f) => [{ ...clone(activeBlock), id: uid() }, ...f]);
    notify("已加入图文收藏");
  };
  const save = useCallback(async () => {
    try {
      await studio.persist(true);
      notify("图文已保存在本机");
    } catch (e) {
      notify((e as Error).message);
    }
  }, [studio.persist, notify]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const textField =
        target.matches("input,textarea,select") || target.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
      if (modal) return;
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !target.matches("input,textarea")
      ) {
        e.preventDefault();
        e.shiftKey ? studio.redo() : studio.undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "y" &&
        !target.matches("input,textarea")
      ) {
        e.preventDefault();
        studio.redo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "d" &&
        !textField &&
        activeBlock
      ) {
        e.preventDefault();
        setSelected(insert(activeBlock, selected!));
      }
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !textField &&
        selected
      ) {
        e.preventDefault();
        removeBlock();
      }
      if (e.key === "Escape") {
        setInspector(false);
        setThemeOpen(false);
        setTopMenu(null);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const readData = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("文件读取失败"));
      r.readAsDataURL(file);
    });
  const chooseUpload = (purpose: "library" | "cover" | "replace") => {
    uploadTarget.current = { purpose, articleId: article.id,
      groupId: purpose === "library" ? currentUploadGroup() : undefined,
      image: imageSelection, imageSession: imageSession.current };
    imageInput.current?.click();
  };
  const openImageSettings = useCallback((image: HTMLImageElement, id: string) => {
    imageSession.current += 1;
    setReplaceImage(false);
    const root = image.closest(".block-content");
    const images = Array.from(root?.querySelectorAll("img") || []);
    setImageSelection({
      blockId: id,
      index: images.indexOf(image),
      src: image.getAttribute("src") || "",
      alt: image.alt,
      ...readImageLayout(image),
      radius: parseFloat(image.style.borderRadius) || 0,
      link: image.closest("a")?.getAttribute("href") || "",
    });
    setSelected(id);
    setModal("image");
  }, []);
  const applyImage = (next: ImageSelection) => {
    const b = article.blocks.find((b) => b.id === next.blockId);
    if (!b || b.locked) {
      notify("组件已锁定，请先解锁");
      return;
    }
    if (!safeUrl(next.src, true) || (next.link && !safeUrl(next.link))) {
      notify("请输入有效的图片或跳转地址");
      return;
    }
    const doc = new DOMParser().parseFromString(b.html, "text/html");
    const img = doc.querySelectorAll("img")[next.index];
    if (!img) return;
    img.src = next.src;
    img.alt = next.alt;
    img.style.borderRadius = `${next.radius}px`;
    applyImageLayout(img, next, safeUrl(next.link));
    updateBlock(b.id, { html: sanitize(doc.body.innerHTML) });
    setModal(null);
    notify("图片已更新");
  };
  const currentUploadGroup = () => studio.assetGroups.some((group) => group.id === assetGroupFilter)
    ? assetGroupFilter : undefined;
  const uploadImages = async (files: FileList | File[] | null, target: typeof uploadTarget.current) => {
    if (!files?.length) return;
    // Copy the files and destination before decoding: a second upload, another
    // group, or a different article must not redirect an in-flight operation.
    const batch = Array.from(files);
    const { groupId, purpose, articleId } = target;
    try {
      const result: Asset[] = [];
      for (const file of batch) {
        if (
          !["image/png", "image/jpeg", "image/gif", "image/webp"].includes(
            file.type,
          )
        )
          throw new Error(`${file.name}：支持 JPG、PNG、GIF、WebP；SVG 请使用 SVG 导入`);
        if (file.size > 20 * 1024 * 1024)
          throw new Error(`${file.name}：单张图片请小于 20 MB`);
        const src = await readData(file);
        await new Promise<void>((resolve, reject) => {
          const im = new Image();
          im.onload = () => resolve();
          im.onerror = () => reject(new Error("图片无法解码"));
          im.src = src;
        });
        result.push({ id: uid(), name: file.name, src, type: "image", ...(groupId ? { groupId } : {}) });
      }
      studio.setAssets((a) => [...result, ...a]);
      if (purpose !== "library" && uploadContext.current.articleId !== articleId) {
        notify("已上传到图库；切换了文章，未修改当前正文");
      } else if (purpose === "cover") {
        change((a) => a.id === articleId ? { ...a, cover: result[0].src } : a);
      } else if (purpose === "replace") {
        if (uploadContext.current.modal === "image" && target.imageSession === imageSession.current) {
          setImageSelection((current) => current && current.blockId === target.image?.blockId && current.index === target.image.index
            ? { ...current, src: result[0].src } : current);
        } else notify("已上传到图库；图片设置已关闭");
      } else if (purpose === "canvas") {
        const blocks = result.map((asset) => makeBlock("image", asset.name,
          `<img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.name)}" style="width:100%;display:block">`, { padding: 10 }));
        change((a) => {
          if (a.id !== articleId) return a;
          const index = a.blocks.findIndex((block) => block.id === target.afterId);
          a.blocks.splice(index < 0 ? a.blocks.length : index + 1, 0, ...blocks);
          return a;
        });
        select(blocks[0].id);
        notify(`已上传并插入 ${result.length} 张图片`);
      } else {
        setSide("我的图库");
        notify(`已添加 ${result.length} 张图片，点击可插入正文`);
      }
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const { draggingFiles: draggingImages, ...paperFileDrop } = useFileDrop((files, event) => {
    const afterId = (event.target as HTMLElement).closest<HTMLElement>(".article-block")?.dataset.blockId;
    void uploadImages(files, { purpose: "canvas", articleId: article.id, afterId, groupId: currentUploadGroup() });
  });
  const insertAsset = (asset: Asset) => {
    if (replaceImage && imageSelection) {
      setImageSelection({ ...imageSelection, src: asset.src });
      setReplaceImage(false);
      return;
    }
    const html =
      asset.type === "image"
        ? `<img src="${escapeHtml(asset.src)}" alt="${escapeHtml(asset.name)}" style="width:100%;display:block">`
        : `<${asset.type} src="${escapeHtml(asset.src)}" controls style="width:100%"></${asset.type}>`;
    setSelected(
      insert(
        makeBlock(asset.type, asset.name, html, { padding: 10 }),
        selected || undefined,
      ),
    );
    notify("已插入素材");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const result = await importDocument(file);
      studio.open(result.article);
      setSelected(result.article.blocks[0]?.id || null);
      notify(result.note);
      setModal(null);
    } catch (e) {
      notify("导入失败：" + (e as Error).message);
    }
    if (importInput.current) importInput.current.value = "";
  };
  const exportAction = async (
    type: "html" | "json" | "png" | "text" | "clipboard" | "print" | "video",
  ) => {
    if (!paper.current) return;
    if (type === "clipboard") {
      if (!article.blocks.length) {
        notify("请先添加正文内容，再复制图文");
        return;
      }
      setModal("copy");
      return;
    }
    setBusy(true);
    setExportError("");
    try {
      const filename = (article.title || "未命名图文").replace(
        /[\\/:*?"<>|]/g,
        "_",
      );
      if (type === "json")
        download(
          filename + ".json",
          JSON.stringify(await portableArticle(article), null, 2),
          "application/json",
        );
      if (type === "html")
        download(
          filename + ".html",
          await exportHtml(article, paper.current),
          "text/html",
        );
      if (type === "text")
        download(filename + ".txt", plainText(paper.current));
      if (type === "png") {
        const data = await png(article, paper.current);
        const a = document.createElement("a");
        a.download = filename + ".png";
        a.href = data;
        a.click();
      }
      if (type === "print") {
        window.print();
      }
      if (type === "video") {
        videoAbort.current = new AbortController();
        setVideoProgress(0);
        const result = await scrollingVideo(
          article,
          paper.current,
          setVideoProgress,
          videoAbort.current.signal,
        );
        setVideoResult({
          url: URL.createObjectURL(result.blob),
          filename: `${filename}.${result.extension}`,
        });
        download(`${filename}.${result.extension}`, result.blob);
      }
      notify(
        type === "print"
            ? "请在打印窗口选择“存储为 PDF”"
            : "已导出，请查看浏览器下载",
      );
    } catch (e) {
      setExportError((e as Error).message || "导出失败，请重试或选择其他格式");
      notify(
        "操作未完成：" +
          ((e as Error).message ||
            "图片无法渲染，请检查图片地址或改用 HTML 导出"),
      );
    } finally {
      setBusy(false);
      setVideoProgress(null);
      videoAbort.current = null;
    }
  };
  const insertMedia = () => {
    const valid = safeUrl(url, true);
    if (!valid) {
      notify("请输入 http 或 https 的音视频文件地址");
      return;
    }
    setSelected(
      insert(
        makeBlock(
          mediaType,
          mediaType === "audio" ? "音频" : "视频",
          `<${mediaType} controls src="${escapeHtml(valid)}" style="width:100%"></${mediaType}>`,
          { padding: 16 },
        ),
        selected || undefined,
      ),
    );
    setModal(null);
  };
  const makeTable = () => {
    const html = `<table style="width:100%;border-collapse:collapse"><tbody>${Array.from({ length: tableRows }, (_, r) => `<tr>${Array.from({ length: tableCols }, (_, c) => `<${r === 0 ? "th" : "td"} style="border:1px solid #ddd;padding:10px;${r === 0 ? "background:#f4f4f4" : ""}">${r === 0 ? "栏目 " + (c + 1) : "内容"}</${r === 0 ? "th" : "td"}>`).join("")}</tr>`).join("")}</tbody></table>`;
    setSelected(
      insert(
        makeBlock("table", "表格", html, { padding: 16 }),
        selected || undefined,
      ),
    );
    setModal(null);
  };
  const tableChange = (action: "row" | "col" | "removeRow" | "removeCol") => {
    if (!activeBlock || activeBlock.locked) return;
    const dom = new DOMParser().parseFromString(activeBlock.html, "text/html");
    const table = dom.querySelector("table");
    if (!table) return;
    const rows = Array.from(table.rows);
    if (action === "row") {
      const row = table.insertRow();
      Array.from(rows[0]?.cells || []).forEach(() => {
        const td = row.insertCell();
        td.textContent = "内容";
        td.style.cssText = "border:1px solid #ddd;padding:10px";
      });
    }
    if (action === "col")
      rows.forEach((row) => {
        const cell = row.insertCell();
        cell.textContent = "内容";
        cell.style.cssText = "border:1px solid #ddd;padding:10px";
      });
    if (action === "removeRow" && rows.length > 1) table.deleteRow(-1);
    if (action === "removeCol" && rows[0]?.cells.length > 1)
      rows.forEach((row) => row.deleteCell(-1));
    updateBlock(activeBlock.id, { html: dom.body.innerHTML });
  };
  const replaceAll = () => {
    if (!find) {
      notify("请先输入查找内容");
      return;
    }
    let count = 0;
    change((a) => ({
      ...a,
      blocks: a.blocks.map((b) => {
        if (b.locked) return b;
        const doc = new DOMParser().parseFromString(b.html, "text/html");
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent || "";
          const pieces = text.split(find);
          count += pieces.length - 1;
          node.textContent = pieces.join(replacement);
        }
        return { ...b, html: doc.body.innerHTML };
      }),
    }));
    notify(`已替换 ${count} 处内容（锁定组件已跳过）`);
  };
  const newDocument = () => {
    const a = newArticle(true);
    studio.open(a);
    setSelected(null);
    setModal(null);
    notify("已新建空白图文，原图文已保留");
  };
  const shown = useMemo(() => {
    const available = templates.filter(
    (t) =>
      (category === "全部" ||
        (category === "热门" &&
          [
            "festival-card",
            "quote",
            "chapter",
            "two-column",
            "notice",
          ].includes(t.id)) ||
        t.category === category) &&
      (templateTab !== "最近使用" || studio.recent.includes(t.id)) &&
      (!search || [t.name, ...t.tags, t.category].join(" ").includes(search)),
  );
    return available.length
    ? [
        ...available.slice(shuffle % available.length),
        ...available.slice(0, shuffle % available.length),
      ]
    : [];
  }, [category, templateTab, studio.recent, search, shuffle]);
  const textCount = useMemo(() => article.blocks
    .map((b) => b.html.replace(/<[^>]*>/g, "").replace(/&[^;]*;/g, " "))
    .join("")
    .replace(/\s/g, "").length, [article.blocks]);
  const setMeta = (key: keyof ArticleData, value: unknown) =>
    change((a) => ({ ...a, [key]: value }), `meta:${key}`);
  const topActions = [
    { name: "打开", icon: FolderOpen, run: () => setModal("open") },
    { name: "预览", icon: Camera, run: () => setModal("preview") },
    { name: "保存", icon: FloppyDisk, run: () => void save() },
    {
      name: "导出",
      icon: CheckCircle,
      run: () => setTopMenu(topMenu === "export" ? null : "export"),
      menu: "export",
    },
    {
      name: "更多",
      icon: CaretDown,
      run: () => setTopMenu(topMenu === "more" ? null : "more"),
      menu: "more",
    },
  ];
  const openArticle = (a: ArticleData) => {
    studio.open(a);
    setSelected(a.blocks[0]?.id || null);
    closeModal();
  };
  const moreGroups = [
    [
      { label: "新建一个图文", icon: FileText, run: newDocument },
      {
        label: "打开图文的历史记录",
        icon: ClockCounterClockwise,
        run: () => setModal("savedHistory"),
      },
      {
        label: "导入 Word/Excel/Markdown",
        icon: UploadSimple,
        run: () => setModal("import"),
      },
      {
        label: "导入公众号文章",
        icon: UploadSimple,
        run: () => setModal("importWechat"),
      },
      {
        label: "导入 HTML 代码",
        icon: Code,
        run: () => setModal("importHtml"),
      },
      { label: "另存一个图文", icon: Copy, run: () => setModal("saveAs") },
      {
        label: "另存图文给其他用户",
        icon: ArrowSquareOut,
        run: () => setModal("share"),
      },
    ],
    [
      {
        label: "收集图片",
        icon: Images,
        run: () => {
          const added = collectImages(article, studio.assets);
          studio.setAssets((a) => [...added, ...a]);
          setAssetGroupFilter("all");
          setSide("我的图库");
          setCollapsed(false);
          notify(
            added.length
              ? `已收集 ${added.length} 张图片到我的图库`
              : "正文中的图片已在图库中，或暂无可收集图片",
          );
        },
      },
      {
        label: "生成长图/PDF/视频",
        icon: ImageIcon,
        run: () => setModal("export"),
      },
      {
        label: "生成贴纸图文",
        icon: ImageIcon,
        run: () => setModal("sticker"),
      },
    ],
    [
      { label: "一键排版", icon: Paragraph, run: () => setModal("autoLayout") },
      {
        label: "将本图文设置为样刊",
        icon: Article,
        run: () => setModal("sample"),
      },
    ],
    [
      {
        label: "查找与替换",
        icon: MagnifyingGlass,
        run: () => setModal("find"),
      },
      { label: "功能与快捷键", icon: Question, run: () => setModal("help") },
    ],
  ];
  const sourceOpen = () => {
    if (!activeBlock) {
      notify("请先选择组件");
      return;
    }
    setSource(activeBlock.html);
    setModal("source");
  };
  const openLink = () => {
    saveRange();
    setUrl("");
    setLinkLabel(window.getSelection()?.toString() || "");
    setModal("link");
  };
  const insertLink = () => {
    const valid = safeUrl(url);
    if (!valid) {
      notify("请输入有效链接，如 https://example.com");
      return;
    }
    setModal(null);
    requestAnimationFrame(() => {
      if (!restoreRange()) return;
      const selection = window.getSelection();
      if (selection?.isCollapsed) {
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${escapeHtml(valid)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkLabel || url)}</a>`,
        );
      } else document.execCommand("createLink", false, valid);
      syncContent();
    });
  };
  return (
    <div
      className={`studio ${collapsed ? "library-collapsed" : ""}`}
      style={{ "--theme": article.theme } as CSSProperties}
    >
      <header className="app-header">
        <div className="brand">
          <img
            className="brand-logo"
            src="/assets/xiumi-logo.png"
            alt="秀米风格编辑器"
          />
          <span className="brand-name">
            秀米<span>XIUMI</span>
          </span>
          <span className="breadcrumb-separator">/</span>
          <button onClick={() => setModal("open")}>我的图文</button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">图文排版</span>
        </div>
        <nav className="top-actions" ref={topNav} aria-label="图文操作">
          {topActions.map(({ name, icon: Icon, run, menu }) => (
            <div className="top-action-slot" key={name}>
              <button
                onClick={run}
                title={name}
                aria-haspopup={menu ? "menu" : undefined}
                aria-expanded={menu ? topMenu === menu : undefined}
                className={menu && topMenu === menu ? "active" : ""}
                onKeyDown={(e) => {
                  if (menu && e.key === "ArrowDown") {
                    e.preventDefault();
                    setTopMenu(menu as "export" | "more");
                    requestAnimationFrame(() =>
                      topNav.current
                        ?.querySelector<HTMLElement>('[role="menu"] button')
                        ?.focus(),
                    );
                  }
                }}
              >
                <span>
                  <Icon size={22} weight="light" />
                </span>
                {name}
              </button>
              {menu && topMenu === menu && (
                <div
                  className={`header-menu ${menu === "more" ? "more-dropdown" : "export-dropdown"}`}
                  role="menu"
                  aria-label={menu === "more" ? "更多图文操作" : "导出图文操作"}
                  onKeyDown={(e) => {
                    if (
                      !["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)
                    )
                      return;
                    e.preventDefault();
                    const buttons = Array.from(
                      e.currentTarget.querySelectorAll<HTMLButtonElement>(
                        "button",
                      ),
                    );
                    const index = buttons.indexOf(
                      document.activeElement as HTMLButtonElement,
                    );
                    buttons[
                      e.key === "Home"
                        ? 0
                        : e.key === "End"
                          ? buttons.length - 1
                          : (index +
                              (e.key === "ArrowDown" ? 1 : -1) +
                              buttons.length) %
                            buttons.length
                    ]?.focus();
                  }}
                >
                  {menu === "more" ? (
                    moreGroups.map((group, i) => (
                      <div className="header-menu-group" key={i}>
                        {group.map((item) => (
                          <button
                            key={item.label}
                            role="menuitem"
                            onClick={() => {
                              setTopMenu(null);
                              item.run();
                            }}
                          >
                            <item.icon size={17} />
                            {item.label}
                          </button>
                        ))}
                      </div>
                    ))
                  ) : (
                    <>
                      <div className="header-menu-group">
                        <button
                          role="menuitem"
                          onClick={() => setModal("sync")}
                        >
                          <UploadSimple />
                          同步到公众号
                        </button>
                        <button
                          role="menuitem"
                          disabled={busy}
                          onClick={() => {
                            setTopMenu(null);
                            void exportAction("clipboard");
                          }}
                        >
                          <ArrowSquareOut />
                          继续用复制粘贴
                        </button>
                      </div>
                      <div className="header-menu-group">
                        <button
                          role="menuitem"
                          onClick={() => setModal("multiSync")}
                        >
                          <UploadSimple />
                          去同步多图文
                        </button>
                      </div>
                      <div className="header-menu-group">
                        <button
                          role="menuitem"
                          disabled={busy}
                          onClick={() => {
                            setTopMenu(null);
                            void exportAction("html");
                          }}
                        >
                          <FileHtml />
                          导出 HTML 文件
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="account">
          <span
            className="save-state"
            title="图文保存在当前浏览器，重要内容请导出工程备份"
          >
            <span
              className={
                studio.saveStatus.includes("失败") ? "error-dot" : "saved-dot"
              }
            />
            {studio.saveStatus}
          </span>
          <button
            className="avatar"
            onClick={() => setModal("help")}
            title="本机工作区"
          >
            秀
          </button>
          <span className="local-label">本地版</span>
        </div>
      </header>
      <aside className="library">
        <nav className="side-rail">
          {[
            { label: "图文模板", icon: Article },
            { label: "图片素材", icon: Images },
            { label: "图文收藏", icon: Star },
            { label: "剪贴板", icon: ClipboardText },
            { label: "我的图库", icon: ImageIcon },
          ].map(({ label, icon: Icon }) => (
            <button
              className={side === label ? "active" : ""}
              key={label}
              onClick={() => {
                setSide(label);
                setCollapsed(false);
                setSearch("");
              }}
            >
              <span>
                <Icon size={26} weight="light" />
              </span>
              {label}
            </button>
          ))}
          <button
            className="collapse-control"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <CaretRight /> : <CaretLeft />}
            <span>{collapsed ? "展开" : "收起"}</span>
          </button>
        </nav>
        {!collapsed && (
          <div className="library-body">
            {side === "图文模板" ? (
              <>
                <div className="category-row">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={category === c ? "active" : ""}
                      onClick={() => setCategory(category === c ? "全部" : c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="template-tabs">
                  {["推荐模板", "最近使用", "样刊模板", "更多模板"].map((t) => (
                    <button
                      key={t}
                      className={templateTab === t ? "active" : ""}
                      onClick={() => {
                        setTemplateTab(t);
                        if (t === "更多模板") setCategory("全部");
                      }}
                    >
                      {t}
                    </button>
                  ))}
                  <IconButton
                    title="搜索模板"
                    onClick={() => setSearchOpen(!searchOpen)}
                  >
                    <MagnifyingGlass size={17} />
                  </IconButton>
                </div>
                <div className="library-tools">
                  <IconButton
                    title="上一组模板"
                    onClick={() =>
                      setShuffle((n) => n + Math.max(1, shown.length - 1))
                    }
                  >
                    <CaretLeft weight="fill" />
                  </IconButton>
                  <IconButton
                    title="下一组模板"
                    onClick={() => setShuffle((n) => n + 1)}
                  >
                    <CaretRight weight="fill" />
                  </IconButton>
                  <button
                    className="tiny-outline"
                    onClick={() => {
                      setShuffle(0);
                      setCategory("全部");
                      setTemplateTab("推荐模板");
                    }}
                  >
                    <Shapes size={13} />
                    最新模板
                  </button>
                  <button
                    className="tiny-outline"
                    onClick={() => setShuffle((n) => n + 3)}
                  >
                    <ArrowsClockwise size={14} />
                    换一换
                  </button>
                </div>
                {searchOpen && (
                  <div className="library-search">
                    <MagnifyingGlass size={16} />
                    <input
                      aria-label="搜索模板关键词"
                      placeholder="搜索模板、节日、样式"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <button onClick={() => setSearch("")}>
                      <X size={13} />
                    </button>
                  </div>
                )}
                <div className="template-scroll">
                  {templateTab === "样刊模板" ? (
                    <>
                      {studio.samples.map((sample) => (
                        <div
                          className="sample-paper saved-sample"
                          key={sample.id}
                        >
                          <div className="sample-title">{sample.title}</div>
                          <div className="saved-sample-preview">
                            {sample.blocks.slice(0, 3).map((b) => (
                              <div
                                className="block-content"
                                key={b.id}
                                style={b.style}
                                dangerouslySetInnerHTML={{ __html: b.html }}
                              />
                            ))}
                          </div>
                          <button
                            className="primary"
                            onClick={() => {
                              openArticle(
                                duplicateArticle(
                                  sample,
                                  `${sample.title} - 新图文`,
                                ),
                              );
                              notify("已从样刊新建图文");
                            }}
                          >
                            使用此样刊
                          </button>
                        </div>
                      ))}
                      <div className="sample-paper">
                        <div className="sample-title">中秋 · 月满人团圆</div>
                        {templates.slice(0, 4).map((t) => (
                          <div
                            key={t.id}
                            className="sample-part"
                            dangerouslySetInnerHTML={{ __html: t.html }}
                          />
                        ))}
                        <button
                          className="primary"
                          onClick={() => {
                            change((a) => ({
                              ...a,
                              blocks: [
                                ...a.blocks,
                                ...templates
                                  .slice(0, 4)
                                  .map((t) =>
                                    makeBlock(t.kind, t.name, t.html),
                                  ),
                              ],
                            }));
                            notify("已将整套样刊添加至文末");
                          }}
                        >
                          使用整套样刊
                        </button>
                      </div>
                    </>
                  ) : (
                    <TemplateCards items={shown} onInsert={addTemplate} onDrag={startBlockDrag} />
                  )}
                  {!shown.length && templateTab !== "样刊模板" && (
                    <div className="empty-library">
                      <MagnifyingGlass size={32} />
                      <p>
                        {templateTab === "最近使用"
                          ? "还没有使用过的模板"
                          : "没有找到匹配模板"}
                      </p>
                      <small>试试插入一张模板，或换个关键词</small>
                    </div>
                  )}
                  <div className="library-end">更多灵感，从这里开始</div>
                </div>
              </>
            ) : side === "图文收藏" || side === "剪贴板" ? (
              <>
                <div className="panel-title">
                  {side}
                  <span>
                    {side === "图文收藏"
                      ? studio.favorites.length
                      : studio.clipboard.length}
                  </span>
                </div>
                <p className="panel-hint">
                  {side === "图文收藏"
                    ? "收藏常用组件，随时点击再次使用"
                    : "复制或剪切的组件会出现在这里"}
                </p>
                <div className="template-scroll">
                  {(side === "图文收藏"
                    ? studio.favorites
                    : studio.clipboard
                  ).map((b) => (
                    <div className="saved-template" key={b.id}>
                      <button
                        className="template-card"
                        onClick={() =>
                          setSelected(insert(b, selected || undefined))
                        }
                      >
                        <div
                          className="template-render"
                          dangerouslySetInnerHTML={{ __html: b.html }}
                        />
                        <span className="template-hover">
                          点击插入 · {b.name}
                        </span>
                      </button>
                      {side === "图文收藏" && (
                        <button
                          className="remove-favorite"
                          aria-label="取消收藏"
                          title="取消收藏"
                          onClick={() => {
                            studio.setFavorites((f) =>
                              f.filter((v) => v.id !== b.id),
                            );
                            notify("已取消收藏，文章内容仍保留");
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {!(side === "图文收藏" ? studio.favorites : studio.clipboard)
                    .length && (
                    <div className="empty-library">
                      <ClipboardText size={38} />
                      <p>这里还没有组件</p>
                      <small>
                        选中正文组件，点击工具条中的
                        {side === "图文收藏" ? "“收藏”" : "“复制”"}
                      </small>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <AssetLibrary
                title={side}
                library={studio.assetLibrary}
                onChange={studio.setAssetLibrary}
                filter={assetGroupFilter}
                onFilter={setAssetGroupFilter}
                onInsert={insertAsset}
                onUpload={() => chooseUpload("library")}
                onDropImages={(files) => void uploadImages(files, { purpose: "library", articleId: article.id, groupId: currentUploadGroup() })}
                onMedia={() => {
                  uploadGroup.current = studio.assetGroups.some((group) => group.id === assetGroupFilter) ? assetGroupFilter : undefined;
                  setUrl("");
                  setMediaType("audio");
                  setModal("media");
                }}
                notify={notify}
              />
            )}
          </div>
        )}
        {!collapsed && (
          <button
            className="theme-tab"
            onClick={() => setThemeOpen(!themeOpen)}
            title="设置文章主题色"
          >
            <span
              className="checker-color"
              style={{
                backgroundColor:
                  article.theme === "#ffb733" ? "#ffffff" : article.theme,
              }}
            />
            主题色
          </button>
        )}
      </aside>
      {themeOpen && (
        <div className="theme-popover">
          <header>
            <Palette size={18} />
            主题色
            <IconButton title="关闭主题色" onClick={() => setThemeOpen(false)}>
              <X />
            </IconButton>
          </header>
          <p>应用于支持换色的标题、边框和装饰</p>
          <div className="swatches">
            {colors.map((c) => (
              <button
                key={c}
                aria-label={`主题色 ${c}`}
                style={{ background: c }}
                onClick={() => setMeta("theme", c)}
              >
                {article.theme === c && <Check color="white" />}
              </button>
            ))}
          </div>
          <Field label="自定义颜色">
            <input
              type="color"
              value={article.theme}
              onChange={(e) => setMeta("theme", e.target.value)}
            />
            <code>{article.theme}</code>
          </Field>
        </div>
      )}
      <main className="workspace" ref={stage}>
        <div className="editor-stage">
          <section
            className="article-meta"
            style={{ width: article.width }}
            aria-label="文章信息"
          >
            <div className="meta-top">
              <button
                className="cover"
                title="上传文章封面"
                onClick={() => chooseUpload("cover")}
              >
                {article.cover ? (
                  <img src={article.cover} alt="文章封面" />
                ) : (
                  <>
                    <span className="cover-landscape" aria-hidden="true" />
                    <span>设置封面</span>
                  </>
                )}
              </button>
              <div>
                <input
                  aria-label="文章标题"
                  placeholder="请输入标题"
                  maxLength={100}
                  value={article.title}
                  onChange={(e) => setMeta("title", e.target.value)}
                />
                <textarea
                  aria-label="文章摘要"
                  placeholder="微信分享时的摘要，点击左侧图片改封面"
                  maxLength={500}
                  value={article.description}
                  onChange={(e) => setMeta("description", e.target.value)}
                />
              </div>
            </div>
            <div className="meta-extra">
              <input
                aria-label="作者"
                placeholder="请输入作者"
                value={article.author}
                maxLength={100}
                onChange={(e) => setMeta("author", e.target.value)}
              />
              <input
                aria-label="原文链接"
                placeholder="请输入原文链接"
                value={article.link}
                onChange={(e) => setMeta("link", e.target.value)}
                onBlur={() => {
                  if (article.link && !safeUrl(article.link))
                    notify("原文链接需以 http:// 或 https:// 开头");
                }}
              />
            </div>
            <div className="enhanced">
              <div className="segmented">
                <button
                  className={!article.enhanced ? "active" : ""}
                  onClick={() => setMeta("enhanced", false)}
                >
                  关闭
                </button>
                <button
                  className={article.enhanced ? "active" : ""}
                  onClick={() => setMeta("enhanced", true)}
                >
                  开启
                </button>
              </div>
              <span>开启音乐视频等增强模式</span>
              <button
                title="增强模式说明"
                onClick={() => {
                  setMediaType("audio");
                  setUrl("");
                  setModal("media");
                }}
              >
                <Question size={14} weight="fill" />
              </button>
            </div>
            {article.enhanced && (
              <div className="enhanced-options">
                <button
                  onClick={() => {
                    setMediaType("audio");
                    setModal("media");
                  }}
                >
                  <MusicNote size={13} />
                  添加音频
                </button>
                <button
                  onClick={() => {
                    setMediaType("video");
                    setModal("media");
                  }}
                >
                  <VideoCamera size={13} />
                  添加视频
                </button>
              </div>
            )}
            <button
              className="tag-button"
              onClick={() => {
                setTagText(article.tags.join("，"));
                setModal("tags");
              }}
            >
              {article.tags.length ? article.tags.join(" · ") : "设置标签"}
            </button>
          </section>
          <div
            className="toolbar-stack"
            hidden={!toolbarVisible || !activeBlock}
            onMouseDown={(e) => {
              if ((e.target as HTMLElement).closest("button"))
                e.preventDefault();
            }}
          >
            <div className="toolbar component-toolbar">
              <IconButton
                title="定位选中组件"
                onClick={() =>
                  selectedContent()?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
                }
              >
                <PushPin size={17} weight="fill" />
              </IconButton>
              <div className="copy-control">
                <button disabled={!activeBlock} onClick={() => copyBlock()}>
                  复制
                </button>
                <details className="toolbar-menu">
                  <summary aria-label="复制选项">
                    <CaretDown size={10} />
                  </summary>
                  <div>
                    <button disabled={!activeBlock} onClick={() => copyBlock()}>
                      <Copy />
                      复制组件
                    </button>
                    <button
                      disabled={!activeBlock || activeBlock.locked}
                      onClick={() => copyBlock(true)}
                    >
                      <Scissors />
                      剪切组件
                    </button>
                    <button
                      disabled={!activeBlock}
                      onClick={() => {
                        if (activeBlock)
                          setSelected(insert(activeBlock, selected!));
                      }}
                    >
                      <Plus />
                      创建副本
                    </button>
                    <button
                      disabled={!studio.clipboard.length}
                      onClick={() =>
                        setSelected(
                          insert(studio.clipboard[0], selected || undefined),
                        )
                      }
                    >
                      <ClipboardText />
                      粘贴组件
                    </button>
                  </div>
                </details>
              </div>
              <IconButton
                title="删除组件"
                disabled={!activeBlock}
                onClick={removeBlock}
              >
                <Trash size={21} />
              </IconButton>
              <button disabled={!activeBlock} onClick={favorite}>
                收藏
              </button>
              <details className="toolbar-menu">
                <summary>
                  变换组件
                  <CaretDown size={10} />
                </summary>
                <div>
                  {(["text", "heading", "card", "layout"] as BlockKind[]).map(
                    (k, i) => (
                      <button
                        key={k}
                        onClick={(e) => {
                          if (activeBlock && !activeBlock.locked) {
                            updateBlock(activeBlock.id, {
                              kind: k,
                              name: ["正文", "标题", "卡片", "布局"][i],
                              style: {
                                ...activeBlock.style,
                                fontSize: k === "heading" ? 24 : 16,
                                padding: k === "card" ? 24 : 16,
                                background:
                                  k === "card" ? "#f5f5f5" : "transparent",
                              },
                            });
                            (e.target as HTMLElement)
                              .closest("details")
                              ?.removeAttribute("open");
                          }
                        }}
                      >
                        {
                          [
                            "转换为正文",
                            "转换为标题",
                            "转换为卡片",
                            "转换为布局",
                          ][i]
                        }
                      </button>
                    ),
                  )}
                </div>
              </details>
              <button onClick={addText}>
                后插空行
                <CaretDown size={10} />
              </button>
              <IconButton
                title="拖动排序说明"
                onClick={() => {
                  setOutline(true);
                  notify("拖动组件左侧六点手柄，或在组件列表中上下移动");
                }}
              >
                <HandPointing size={20} />
              </IconButton>
              <details className="toolbar-menu">
                <summary aria-label="更多组件操作">
                  <DotsThree size={26} />
                </summary>
                <div>
                  <button
                    disabled={!activeBlock}
                    onClick={() => {
                      if (activeBlock)
                        setSelected(insert(activeBlock, selected!));
                    }}
                  >
                    <Copy />
                    创建副本
                  </button>
                  <button
                    disabled={!activeBlock}
                    onClick={() => copyBlock(true)}
                  >
                    <Scissors />
                    剪切组件
                  </button>
                  <button
                    disabled={!studio.clipboard.length}
                    onClick={() =>
                      setSelected(
                        insert(studio.clipboard[0], selected || undefined),
                      )
                    }
                  >
                    <ClipboardText />
                    粘贴组件
                  </button>
                  <button
                    disabled={!activeBlock}
                    onClick={() => {
                      if (activeBlock)
                        updateBlock(activeBlock.id, {
                          locked: !activeBlock.locked,
                        });
                    }}
                  >
                    {activeBlock?.locked ? <LockSimpleOpen /> : <LockSimple />}
                    {activeBlock?.locked ? "解锁组件" : "锁定组件"}
                  </button>
                  <button onClick={sourceOpen}>
                    <Code />
                    编辑 HTML
                  </button>
                </div>
              </details>
              <button onClick={() => setOutline(!outline)}>组件定位</button>
            </div>
            <div className="toolbar format-toolbar">
              <select
                aria-label="字体"
                className="font-family-select"
                title={pendingFont ? "正在加载字体…" : "仅使用已下载的四款字体，默认思源黑体"}
                aria-busy={!!pendingFont}
                value={pendingFont || activeFont}
                onPointerDown={saveRange}
                onFocus={saveRange}
                onChange={(e) => { void changeFont(e.target.value); }}
              >
                {activeFont === MIXED_FONT && <option value={MIXED_FONT} disabled>多种字体</option>}
                {FONT_OPTIONS.map((font) => <option key={font.id} value={font.value}>
                  {font.label}{font.value === SANS_FONT ? "（默认）" : ""}
                </option>)}
              </select>
              {pendingFont && <span className="font-loading" role="status">字体加载中…</span>}
              <select
                className="font-size"
                aria-label="字号"
                value={activeBlock?.style.fontSize || article.fontSize}
                onChange={(e) => inlineStyle("fontSize", e.target.value + "px")}
              >
                {[
                  10, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 28, 32, 36, 48,
                ].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
              <label className="color-tool" title="文字颜色">
                <input
                  aria-label="文字颜色"
                  type="color"
                  value={activeBlock?.style.color || "#444444"}
                  onChange={(e) => inlineStyle("color", e.target.value)}
                />
                <CaretDown size={9} />
              </label>
              <details className="toolbar-menu alignment">
                <summary title="段落对齐">
                  <TextAlignLeft size={19} />
                  <CaretDown size={9} />
                </summary>
                <div>
                  {[
                    { v: "left", name: "左对齐", icon: TextAlignLeft },
                    { v: "center", name: "居中", icon: TextAlignCenter },
                    { v: "right", name: "右对齐", icon: TextAlignRight },
                    { v: "justify", name: "两端对齐", icon: TextAlignJustify },
                  ].map(({ v, name, icon: Icon }) => (
                    <button
                      key={v}
                      onClick={(e) => {
                        styleBlock({ textAlign: v as BlockStyle["textAlign"] });
                        (e.target as HTMLElement)
                          .closest("details")
                          ?.removeAttribute("open");
                      }}
                    >
                      <Icon />
                      {name}
                    </button>
                  ))}
                </div>
              </details>
              {[
                { cmd: "bold", title: "加粗", icon: TextB },
                { cmd: "italic", title: "斜体", icon: TextItalic },
                { cmd: "underline", title: "下划线", icon: TextUnderline },
                {
                  cmd: "strikeThrough",
                  title: "删除线",
                  icon: TextStrikethrough,
                },
              ].map(({ cmd, title, icon: Icon }) => (
                <IconButton
                  key={cmd}
                  title={title}
                  className={activeFormat[cmd] ? "pressed" : ""}
                  onClick={() => command(cmd)}
                >
                  <Icon size={17} />
                </IconButton>
              ))}
              <details className="toolbar-menu">
                <summary title="段落与列表">
                  <Paragraph size={19} />
                  <CaretDown size={9} />
                </summary>
                <div>
                  <button onClick={() => command("insertUnorderedList")}>
                    <ListBullets />
                    无序列表
                  </button>
                  <button onClick={() => command("insertOrderedList")}>
                    <ListNumbers />
                    有序列表
                  </button>
                  <button onClick={() => command("indent")}>
                    <TextIndent />
                    增加缩进
                  </button>
                  <button onClick={() => command("outdent")}>
                    <TextOutdent />
                    减少缩进
                  </button>
                  <button onClick={openLink}>
                    <LinkIcon />
                    插入链接
                  </button>
                  <button onClick={() => command("unlink")}>
                    <Broom />
                    移除链接
                  </button>
                </div>
              </details>
              <IconButton
                title="清除文字格式"
                onClick={() => command("removeFormat")}
              >
                <Broom size={19} />
              </IconButton>
              <button onClick={() => setInspector(!inspector)}>格式</button>
              <button onClick={() => setInspector(!inspector)}>间距</button>
              <button disabled={activeBlock?.locked} onClick={() => openComposition()}>自由组合</button>
            </div>
          </div>
          <div
            className="paper-zone"
            style={{ width: article.width * canvasScale }}
          >
            <div className="zoom-container" style={{ zoom: canvasScale }}>
              <div
                ref={paper}
                className={`article-paper ${draggingImages ? "file-drop-active" : ""}`}
                style={{
                  width: article.width,
                  fontSize: article.fontSize,
                  lineHeight: article.lineHeight,
                  letterSpacing: article.letterSpacing,
                  background: article.background,
                }}
                onDragEnter={paperFileDrop.onDragEnter}
                onDragLeave={paperFileDrop.onDragLeave}
                onDragOver={(e) => {
                  paperFileDrop.onDragOver(e);
                  if (e.dataTransfer.types.includes("text/x-template") || e.dataTransfer.types.includes("text/x-studio-block")) e.preventDefault();
                }}
                onDrop={(e) => {
                  if (isFileDrag(e.dataTransfer)) {
                    paperFileDrop.onDrop(e);
                    return;
                  }
                  const tid = e.dataTransfer.getData("text/x-template");
                  if (tid) {
                    e.preventDefault();
                    e.stopPropagation();
                    dragId.current = "";
                    const t = templates.find((t) => t.id === tid);
                    const afterId = (e.target as HTMLElement).closest<HTMLElement>(".article-block")?.dataset.blockId;
                    if (t) addTemplate(t, afterId || article.blocks.at(-1)?.id);
                  } else if (e.dataTransfer.types.includes("text/x-studio-block")) {
                    e.preventDefault();
                    const last = article.blocks.at(-1);
                    if (last) dropBlock(last.id);
                  }
                }}
              >
                {draggingImages && <div className="file-drop-notice" data-editor-only role="status">松开上传图片，插入到当前组件后</div>}
                {article.blocks.map((b, i) => (
                  <EditableBlock
                    key={b.id}
                    block={b}
                    selected={selected === b.id}
                    index={i}
                    onSelect={select}
                    onChange={contentChanged}
                    onImage={openImageSettings}
                    onDrop={dropBlock}
                    onDrag={startBlockDrag}
                    onRange={saveRange}
                    onFrame={frameChanged}
                    onCompose={openComposition}
                  />
                ))}
                {!article.blocks.length && (
                  <div className="empty-paper" data-editor-only>
                    <Article size={48} weight="thin" />
                    <h3>从一段文字开始</h3>
                    <p>点击左侧模板，或把图片拖到这里</p>
                    <button onClick={addText}>
                      <Plus size={16} />
                      添加正文
                    </button>
                  </div>
                )}
                <button
                  className="add-block-line"
                  data-editor-only
                  onClick={addText}
                >
                  <Plus size={14} />
                  添加正文
                </button>
              </div>
            </div>
            <div className="paper-side-tools">
              <IconButton title="组件列表" onClick={() => setOutline(!outline)}>
                <SquaresFour size={23} weight="fill" />
              </IconButton>
              <IconButton
                title="主题颜色"
                onClick={() => setThemeOpen(!themeOpen)}
              >
                <Shapes size={23} weight="fill" />
              </IconButton>
              <IconButton
                title="文章统计"
                onClick={() =>
                  notify(
                    `文章共 ${article.blocks.length} 个组件、${textCount} 字、${paper.current?.querySelectorAll("img:not([data-decoration])").length || 0} 张图片`,
                  )
                }
              >
                <ChartBar size={23} weight="fill" />
              </IconButton>
              <IconButton title="预览文章" onClick={() => setModal("preview")}>
                <Eye size={23} weight="fill" />
              </IconButton>
            </div>
          </div>
          <footer className="paper-footer">
            基础格式：字号 {article.fontSize}，行间距 {article.lineHeight}
            ，字间距 {article.letterSpacing}，默认图文宽度 {article.width}
            <span>
              {article.blocks.length} 个组件 · {textCount} 字
            </span>
          </footer>
        </div>
      </main>
      <aside className="quick-actions">
        <button title="自由组合图层" disabled={activeBlock?.locked} onClick={() => openComposition()}><SquaresFour size={18} />图层</button>
        <button
          title="撤销 ⌘Z"
          disabled={!studio.canUndo}
          onClick={studio.undo}
        >
          <ArrowCounterClockwise size={18} weight="fill" />
          撤销
        </button>
        <button
          title="重做 ⇧⌘Z"
          disabled={!studio.canRedo}
          onClick={studio.redo}
        >
          <ArrowClockwise size={18} weight="fill" />
          重做
        </button>
        <button onClick={() => setModal("help")}>
          <Question size={17} weight="fill" />
          帮助
        </button>
        <button onClick={() => setModal("settings")}>
          <Gear size={17} weight="fill" />
          设置
        </button>
      </aside>
      <div className="zoom-tools">
        <IconButton
          title="缩小画布"
          onClick={() => setZoom((z) => Math.max(50, z - 10))}
        >
          <MagnifyingGlass size={15} />
          <Minus size={9} className="zoom-sign" />
        </IconButton>
        <button title="恢复100%" onClick={() => setZoom(100)}>
          {zoom}%
        </button>
        <IconButton
          title="放大画布"
          onClick={() => setZoom((z) => Math.min(150, z + 10))}
        >
          <MagnifyingGlass size={15} />
          <Plus size={9} className="zoom-sign" />
        </IconButton>
      </div>
      {outline && (
        <aside className="outline-panel">
          <header>
            组件定位
            <IconButton title="关闭组件列表" onClick={() => setOutline(false)}>
              <X />
            </IconButton>
          </header>
          <div className="outline-list">
            {article.blocks.map((b, i) => (
              <div className={selected === b.id ? "active" : ""} key={b.id}>
                <button
                  onClick={() => {
                    setSelected(b.id);
                    paper.current
                      ?.querySelector(`[data-block-id="${b.id}"]`)
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {b.name}
                  {b.locked && <LockSimple size={12} />}
                </button>
                <IconButton
                  title={`上移组件${i + 1}`}
                  disabled={i === 0}
                  onClick={() => move(b.id, -1)}
                >
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton
                  title={`下移组件${i + 1}`}
                  disabled={i === article.blocks.length - 1}
                  onClick={() => move(b.id, 1)}
                >
                  <ArrowDown size={14} />
                </IconButton>
              </div>
            ))}
          </div>
          <button className="outline-add" onClick={addText}>
            <Plus />
            添加正文组件
          </button>
        </aside>
      )}
      {inspector && (
        <aside className="inspector">
          <header>
            组件格式
            <IconButton
              title="关闭格式面板"
              onClick={() => setInspector(false)}
            >
              <X />
            </IconButton>
          </header>
          {activeBlock ? (
            <>
              <p className="inspector-name">
                {activeBlock.name}
                {activeBlock.locked && " · 已锁定"}
              </p>
              {[
                {
                  label: "字号",
                  key: "fontSize",
                  fallback: article.fontSize,
                  min: 10,
                  max: 72,
                  step: 1,
                },
                {
                  label: "行间距",
                  key: "lineHeight",
                  fallback: article.lineHeight,
                  min: 1,
                  max: 3,
                  step: 0.1,
                },
                {
                  label: "字间距",
                  key: "letterSpacing",
                  fallback: 0,
                  min: -2,
                  max: 12,
                  step: 0.5,
                },
                {
                  label: "内边距",
                  key: "padding",
                  fallback: 0,
                  min: 0,
                  max: 80,
                  step: 1,
                },
                {
                  label: "下间距",
                  key: "marginBottom",
                  fallback: 0,
                  min: 0,
                  max: 100,
                  step: 1,
                },
                {
                  label: "圆角",
                  key: "borderRadius",
                  fallback: 0,
                  min: 0,
                  max: 100,
                  step: 1,
                },
                {
                  label: "边框宽度",
                  key: "borderWidth",
                  fallback: 0,
                  min: 0,
                  max: 12,
                  step: 1,
                },
              ].map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    aria-label={f.label}
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={Number(
                      activeBlock.style[f.key as keyof BlockStyle] ??
                        f.fallback,
                    )}
                    onChange={(e) =>
                      styleBlock({
                        [f.key]: Math.min(
                          f.max,
                          Math.max(f.min, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </Field>
              ))}
              <Field label="背景色">
                <input
                  type="color"
                  value={
                    activeBlock.style.background?.startsWith("#")
                      ? activeBlock.style.background
                      : "#ffffff"
                  }
                  onChange={(e) => styleBlock({ background: e.target.value })}
                />
                <button
                  className="text-button"
                  onClick={() => styleBlock({ background: "transparent" })}
                >
                  透明
                </button>
              </Field>
              <Field label="边框色">
                <input
                  type="color"
                  value={activeBlock.style.borderColor || "#dddddd"}
                  onChange={(e) => styleBlock({ borderColor: e.target.value })}
                />
              </Field>
              <div className="inspector-buttons">
                <button onClick={openLink}>
                  <LinkIcon />
                  链接
                </button>
                <button onClick={sourceOpen}>
                  <Code />
                  源码
                </button>
                <button
                  onClick={() => {
                    setModal("table");
                  }}
                >
                  <Table />
                  表格
                </button>
              </div>
              {activeBlock.kind === "table" && (
                <div className="table-actions">
                  <button onClick={() => tableChange("row")}>增加行</button>
                  <button onClick={() => tableChange("col")}>增加列</button>
                  <button onClick={() => tableChange("removeRow")}>
                    删除末行
                  </button>
                  <button onClick={() => tableChange("removeCol")}>
                    删除末列
                  </button>
                </div>
              )}
              <button
                className="secondary full"
                onClick={() => {
                  if (!activeBlock.locked)
                    updateBlock(activeBlock.id, { style: {} });
                }}
              >
                重置组件格式
              </button>
            </>
          ) : (
            <p className="muted">请先点击正文组件</p>
          )}
        </aside>
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle size={18} />
          {toast}
          <button aria-label="关闭提示" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
      <input
        ref={imageInput}
        className="hidden"
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        multiple
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          void uploadImages(files, uploadTarget.current);
        }}
      />
      <input
        ref={importInput}
        className="hidden"
        type="file"
        accept=".docx,.xlsx,.csv,.md,.markdown,.json,.html,.htm,.txt"
        onChange={(e) => void importFile(e.target.files?.[0])}
      />
      <input
        ref={svgInput}
        className="hidden"
        type="file"
        accept=".svg"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) {
            if (f.size > 2 * 1024 * 1024) {
              notify("SVG 文件请小于 2 MB");
              return;
            }
            const html = sanitize(await f.text());
            if (!html.includes("<svg")) {
              notify("这不是有效的 SVG 文件");
              return;
            }
            setSelected(
              insert(makeBlock("svg", f.name, html), selected || undefined),
            );
            notify("SVG 已插入");
          }
          e.target.value = "";
        }}
      />
      <input
        ref={mediaInput}
        className="hidden"
        type="file"
        accept="audio/*,video/*"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            if (f.size > 30 * 1024 * 1024)
              throw new Error("音视频文件请小于 30 MB");
            const type = f.type.startsWith("audio/")
              ? "audio"
              : f.type.startsWith("video/")
                ? "video"
                : null;
            if (!type) throw new Error("请选择音频或视频文件");
            const src = await readData(f);
            const asset: Asset = { id: uid(), name: f.name, src, type, ...(uploadGroup.current ? { groupId: uploadGroup.current } : {}) };
            studio.setAssets((a) => [asset, ...a]);
            insertAsset(asset);
            setModal(null);
          } catch (error) {
            notify((error as Error).message);
          }
          e.target.value = "";
        }}
      />
      {modal === "open" && (
        <ModalWindow
          title="打开图文"
          onClose={closeModal}
          className="document-picker-modal"
        >
          <DocumentPicker
            documents={[
              article,
              ...studio.documents.filter((d) => d.id !== article.id),
            ]}
            currentId={article.id}
            onOpen={openArticle}
            onClose={closeModal}
            onNew={newDocument}
            onImport={() => setModal("import")}
          />
        </ModalWindow>
      )}
      {modal && modal in workflowTitles && (
        <ModalWindow
          title={workflowTitles[modal as Workflow]}
          onClose={closeModal}
          wide={["savedHistory", "autoLayout"].includes(modal)}
        >
          <WorkflowDialog
            key={modal}
            kind={modal as Workflow}
            studio={studio}
            onClose={closeModal}
            notify={notify}
            onOpen={openArticle}
            onCopy={() => exportAction("clipboard")}
            onSample={() => {
              setSide("图文模板");
              setTemplateTab("样刊模板");
              setCollapsed(false);
            }}
            onSticker={async () => {
              if (!paper.current) return;
              const next = await stickerArticle(article, paper.current);
              openArticle(next);
              notify("贴纸图文已生成，原图文已保留");
            }}
          />
        </ModalWindow>
      )}
      {modal === "preview" && (
        <ModalWindow title="图文预览" onClose={closeModal} wide>
          <div className="preview-controls">
            <button
              className={previewWidth === 375 ? "active" : ""}
              onClick={() => setPreviewWidth(375)}
            >
              <DeviceMobile />
              手机 375
            </button>
            <button
              className={previewWidth === 414 ? "active" : ""}
              onClick={() => setPreviewWidth(414)}
            >
              <DeviceMobile />
              大屏 414
            </button>
            <button
              className={previewWidth === 600 ? "active" : ""}
              onClick={() => setPreviewWidth(600)}
            >
              <Desktop />
              桌面
            </button>
            <span>预览宽度 {previewWidth}px</span>
          </div>
          <div className="preview-stage">
            <article
              className="preview-paper"
              style={{
                width: previewWidth,
                background: article.background,
                fontSize: article.fontSize,
                lineHeight: article.lineHeight,
                letterSpacing: article.letterSpacing,
              }}
            >
              <div className="preview-heading">
                <h1>{article.title || "未命名图文"}</h1>
                <p>
                  {article.author || "作者"}
                  <span>{new Date().toLocaleDateString("zh-CN")}</span>
                </p>
              </div>
              {article.blocks.map((b) => (
                <div
                  className="preview-block block-content"
                  key={b.id}
                  style={b.style}
                  dangerouslySetInnerHTML={{ __html: b.html }}
                />
              ))}
              {article.link && safeUrl(article.link) && (
                <a
                  className="read-original"
                  href={safeUrl(article.link)}
                  target="_blank"
                  rel="noreferrer"
                >
                  阅读原文
                  <ArrowSquareOut size={13} />
                </a>
              )}
            </article>
          </div>
        </ModalWindow>
      )}
      {modal === "copy" && paper.current && (
        <ModalWindow title="整篇图文复制" onClose={closeModal} wide className="copy-export-modal">
          <CopyExport article={article} paper={paper.current} onClose={closeModal} />
        </ModalWindow>
      )}
      {modal === "export" && (
        <ModalWindow title="导出图文" onClose={closeModal}>
          <div className="modal-body">
            <p className="muted">选择适合你的导出方式，继续分享与创作。</p>
            <div className="export-options">
              {[
                {
                  type: "clipboard",
                  icon: Copy,
                  title: "整篇复制（保留样式）",
                  desc: "一次复制全部文字和图片，粘贴到支持富文本的文档或编辑器",
                },
                {
                  type: "html",
                  icon: FileHtml,
                  title: "HTML 网页",
                  desc: "包含内嵌图片和排版，可离线打开",
                },
                {
                  type: "png",
                  icon: ImageIcon,
                  title: "高清长图 PNG",
                  desc: "以 2 倍画布宽度导出整篇文章",
                },
                {
                  type: "json",
                  icon: FileJs,
                  title: "可编辑工程 JSON",
                  desc: "完整保存内容、样式和图片，支持再次导入",
                },
                {
                  type: "text",
                  icon: FileText,
                  title: "纯文本 TXT",
                  desc: "导出文章文字，方便继续撰写",
                },
                {
                  type: "video",
                  icon: VideoCamera,
                  title: "滚动图文视频",
                  desc: "15 秒无声竖屏视频，720 × 1280，格式由浏览器决定",
                },
                {
                  type: "print",
                  icon: DownloadSimple,
                  title: "打印 / 保存 PDF",
                  desc: "打开系统打印窗口，保存为 PDF",
                },
              ].map((o) => (
                <button
                  key={o.type}
                  disabled={busy}
                  onClick={() =>
                    void exportAction(
                      o.type as Parameters<typeof exportAction>[0],
                    )
                  }
                >
                  <o.icon size={28} weight="light" />
                  <div>
                    <strong>{o.title}</strong>
                    <span>{o.desc}</span>
                  </div>
                  <CaretRight size={17} />
                </button>
              ))}
            </div>
            <p className="notice">
              <WarningCircle size={16} />
              公众号可能过滤部分
              SVG、音视频及复杂布局；本地图片需在公众号后台上传。当前未连接秀米云端或公众号账号。
            </p>
            {busy && (
              <p className="export-busy" role="status">
                {videoProgress === null
                  ? "正在准备导出，请稍候…"
                  : `正在生成视频 ${videoProgress}%`}
              </p>
            )}
            {videoProgress !== null && (
              <div className="video-progress">
                <progress value={videoProgress} max={100} />
                <button
                  className="secondary"
                  onClick={() => videoAbort.current?.abort()}
                >
                  取消生成
                </button>
              </div>
            )}
            {videoResult && (
              <div className="video-result">
                <video
                  src={videoResult.url}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label="生成的视频预览"
                />
                <a
                  className="secondary"
                  href={videoResult.url}
                  download={videoResult.filename}
                >
                  再次下载视频
                </a>
              </div>
            )}
            {exportError && (
              <p className="workflow-error" role="alert">
                {exportError}
              </p>
            )}
          </div>
        </ModalWindow>
      )}
      {modal === "settings" && (
        <ModalWindow title="图文设置" onClose={closeModal}>
          <div className="modal-body">
            <h3 className="section-label">基础排版</h3>
            <Field label="图文宽度">
              <input
                aria-label="图文宽度"
                type="number"
                min={320}
                max={750}
                value={article.width}
                onChange={(e) =>
                  setMeta(
                    "width",
                    Math.min(750, Math.max(320, Number(e.target.value))),
                  )
                }
              />
              <span>px</span>
            </Field>
            <Field label="默认字号">
              <input
                type="number"
                min={10}
                max={48}
                value={article.fontSize}
                onChange={(e) =>
                  setMeta(
                    "fontSize",
                    Math.min(48, Math.max(10, Number(e.target.value))),
                  )
                }
              />
              <span>px</span>
            </Field>
            <Field label="默认行间距">
              <input
                type="number"
                min={1}
                max={3}
                step={0.1}
                value={article.lineHeight}
                onChange={(e) =>
                  setMeta(
                    "lineHeight",
                    Math.min(3, Math.max(1, Number(e.target.value))),
                  )
                }
              />
            </Field>
            <Field label="默认字间距">
              <input
                type="number"
                min={-2}
                max={10}
                step={0.5}
                value={article.letterSpacing}
                onChange={(e) =>
                  setMeta(
                    "letterSpacing",
                    Math.min(10, Math.max(-2, Number(e.target.value))),
                  )
                }
              />
              <span>px</span>
            </Field>
            <Field label="画布背景">
              <input
                type="color"
                value={article.background}
                onChange={(e) => setMeta("background", e.target.value)}
              />
            </Field>
            <Field label="主题色">
              <input
                type="color"
                value={article.theme}
                onChange={(e) => setMeta("theme", e.target.value)}
              />
            </Field>
            <hr />
            <p className="muted">
              基础格式对未单独设置样式的组件生效。所有更改自动保存，也可通过撤销恢复。
            </p>
            <button className="primary full" onClick={closeModal}>
              完成
            </button>
          </div>
        </ModalWindow>
      )}
      {modal === "help" && (
        <ModalWindow title="使用帮助" onClose={closeModal} wide>
          <div className="modal-body help-content">
            <h3>熟悉的排版方式，把内容留在自己手里。</h3>
            <p>
              点击左侧模板插入文章；点击画布中的文字直接编辑。选中文字后使用工具条调整格式，点击图片可替换、裁切显示区域、修改圆角和链接。
            </p>
            <div className="help-columns">
              <section>
                <h4>常用操作</h4>
                <p>组件：插入、复制、剪切、收藏、锁定、拖动排序</p>
                <p>排版：字体、字号、颜色、对齐、行距、边距、边框</p>
                <p>仅使用已下载的思源黑体（默认）、思源宋体、阿里巴巴普惠体和 Noto Sans SC。</p>
                <p>字体许可及来源：{FONT_OPTIONS.map((font) => <a key={font.id} href={font.license} target="_blank" rel="noreferrer" style={{ marginRight: 12 }}>{font.label}</a>)}</p>
                <p>内容：图片、链接、列表、表格、SVG、音视频、HTML</p>
                <p>文件：多篇图文、本机自动保存、工程导入和 6 种导出</p>
              </section>
              <section>
                <h4>快捷键</h4>
                <p>
                  <kbd>⌘ / Ctrl + S</kbd>保存
                </p>
                <p>
                  <kbd>⌘ / Ctrl + Z</kbd>撤销
                </p>
                <p>
                  <kbd>⇧ + ⌘ + Z</kbd>重做
                </p>
                <p>
                  <kbd>⌘ / Ctrl + B / I / U</kbd>文字样式
                </p>
                <p>
                  <kbd>Delete</kbd>删除组件（非文字输入时）
                </p>
              </section>
            </div>
            <div className="help-boundary">
              <h4>关于这个本地版本</h4>
              <p>
                这是依据参考截图实现的独立编辑器，并非秀米官方产品。模板库为本项目内置模板，不包含秀米完整素材市场。
              </p>
              <p>
                秀米账号登录、会员购买、团队共享、云端图库及公众号授权同步，需要合法可用的服务端接口，目前未接入。复制到公众号后的样式和图片，需要在公众号中检查。
              </p>
            </div>
            <button className="primary" onClick={closeModal}>
              开始创作
            </button>
          </div>
        </ModalWindow>
      )}
      {modal === "source" && (
        <ModalWindow title="组件 HTML" onClose={closeModal} wide>
          <div className="modal-body">
            <p className="muted">
              编辑当前组件的 HTML。脚本、事件处理器及不安全链接会被移除。
            </p>
            <textarea
              aria-label="组件 HTML 源码"
              className="source-editor"
              spellCheck={false}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
            <div className="modal-actions">
              <button className="secondary" onClick={closeModal}>
                取消
              </button>
              <button
                className="primary"
                disabled={activeBlock?.locked}
                onClick={() => {
                  if (activeBlock) {
                    updateBlock(activeBlock.id, { html: sanitize(source) });
                    setModal(null);
                    notify("组件 HTML 已更新");
                  }
                }}
              >
                应用到组件
              </button>
            </div>
          </div>
        </ModalWindow>
      )}
      {modal === "link" && (
        <ModalWindow title="插入链接" onClose={closeModal}>
          <div className="modal-body">
            <Field label="链接文字">
              <input
                value={linkLabel}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="链接显示的文字"
              />
            </Field>
            <Field label="链接地址">
              <input
                aria-label="链接地址"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </Field>
            <button className="primary full" onClick={insertLink}>
              插入链接
            </button>
          </div>
        </ModalWindow>
      )}
      {modal === "media" && (
        <ModalWindow title="音视频与组件" onClose={closeModal}>
          <div className="modal-body">
            <div className="media-types">
              <button
                className={mediaType === "audio" ? "active" : ""}
                onClick={() => setMediaType("audio")}
              >
                <MusicNote />
                音频
              </button>
              <button
                className={mediaType === "video" ? "active" : ""}
                onClick={() => setMediaType("video")}
              >
                <VideoCamera />
                视频
              </button>
            </div>
            <Field label="媒体地址">
              <input
                aria-label="音视频地址"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={
                  mediaType === "audio"
                    ? "https://example.com/music.mp3"
                    : "https://example.com/video.mp4"
                }
              />
            </Field>
            <p className="muted">
              使用可直接播放的文件地址，不支持网页或视频分享链接。
            </p>
            <div className="modal-actions">
              <button
                className="secondary"
                onClick={() => mediaInput.current?.click()}
              >
                <UploadSimple />
                上传本地文件
              </button>
              <button className="primary" onClick={insertMedia}>
                插入{mediaType === "audio" ? "音频" : "视频"}
              </button>
            </div>
            <hr />
            <div className="extra-components">
              <button onClick={() => setModal("table")}>
                <Table />
                插入表格
              </button>
              <button onClick={() => svgInput.current?.click()}>
                <Shapes />
                导入 SVG
              </button>
            </div>
          </div>
        </ModalWindow>
      )}
      {modal === "table" && (
        <ModalWindow title="插入表格" onClose={closeModal}>
          <div className="modal-body">
            <Field label="行数">
              <input
                aria-label="表格行数"
                type="number"
                min={1}
                max={20}
                value={tableRows}
                onChange={(e) =>
                  setTableRows(
                    Math.min(20, Math.max(1, Number(e.target.value))),
                  )
                }
              />
            </Field>
            <Field label="列数">
              <input
                aria-label="表格列数"
                type="number"
                min={1}
                max={8}
                value={tableCols}
                onChange={(e) =>
                  setTableCols(Math.min(8, Math.max(1, Number(e.target.value))))
                }
              />
            </Field>
            <p className="muted">
              第一行为表头。插入后可直接编辑单元格，格式面板支持增减行列。
            </p>
            <button className="primary full" onClick={makeTable}>
              插入 {tableRows} × {tableCols} 表格
            </button>
          </div>
        </ModalWindow>
      )}
      {modal === "composition" && compositionSession && (
        <ModalWindow title="自由组合" onClose={closeModal} className="composition-modal">
          <CompositionEditor initial={compositionSession.initial} assets={studio.assets} onCancel={closeModal}
            onAssets={assets => studio.setAssets(current => [...assets, ...current])}
            onSave={canvas => {
              if (article.id !== compositionSession.articleId) { notify("文章已切换，请重新打开组合编辑"); return; }
              const block = article.blocks.find(b => b.id === compositionSession.blockId);
              if (compositionSession.blockId && (!block || block.locked)) { notify("原组件已删除或锁定，无法应用组合"); return; }
              const html = compositionHtml(canvas);
              if (block) updateBlock(block.id, { html, kind: 'layout', name: '自由组合', frame: undefined, style: { padding: 0, marginBottom: block.style.marginBottom || 0 } });
              else setSelected(insert(makeBlock('layout', '自由组合', html, { padding: 0 }), selected || undefined));
              closeModal(); notify("组合已保存，双击组合可继续编辑图层");
            }} />
        </ModalWindow>
      )}
      {modal === "image" && imageSelection && (
        <ModalWindow title="图片设置" onClose={closeModal} wide>
          <div className="image-composition-actions">
            <button className="secondary" onClick={() => openComposition(imageSelection.blockId, true)}>图片左侧加文字</button>
            <button className="secondary" onClick={() => openComposition(imageSelection.blockId)}>自由组合图层</button>
          </div>
          <div className="modal-body image-editor">
            <div className="image-edit-preview">
              <img
                src={imageSelection.src}
                alt={imageSelection.alt}
                onLoad={(event) => {
                  const aspectRatio = event.currentTarget.naturalWidth / event.currentTarget.naturalHeight || 1;
                  setImageSelection((current) => current && current.aspectRatio !== aspectRatio ? { ...current, aspectRatio } : current);
                }}
                style={{
                  ...imageAlignmentStyle(imageSelection.alignment),
                  width: imageSelection.width + "%",
                  height: imageSelection.height ? `${imageSelection.height / imageSelection.containerWidth * 100}cqw` : "auto",
                  objectFit: imageSelection.fit as CSSProperties["objectFit"],
                  borderRadius: imageSelection.radius,
                }}
              />
              <div>
                <button
                  className="secondary"
                  onClick={() => chooseUpload("replace")}
                >
                  <UploadSimple />
                  替换图片
                </button>
                <button
                  className="secondary"
                  onClick={() => setReplaceImage(!replaceImage)}
                >
                  <Images />
                  从图库选择
                </button>
              </div>
              {replaceImage && (
                <div className="replace-grid">
                  {studio.assets
                    .filter((a) => a.type === "image")
                    .map((a) => (
                      <button key={a.id} onClick={() => insertAsset(a)}>
                        <img src={a.src} alt={a.name} />
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="image-fields">
              <Field label="图片说明">
                <input
                  aria-label="图片说明"
                  value={imageSelection.alt}
                  onChange={(e) =>
                    setImageSelection({
                      ...imageSelection,
                      alt: e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="宽度 (%)">
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={visibleImageWidth(imageSelection)}
                  onChange={(e) =>
                    setImageSelection(resizeImage(imageSelection, Number(e.target.value)))
                  }
                />
              </Field>
              <input className="image-size-slider" type="range" aria-label="图片大小" min={1} max={100} step={1}
                value={visibleImageWidth(imageSelection)} onChange={(event) => setImageSelection(resizeImage(imageSelection, Number(event.target.value)))} />
              <div className="image-size-actions">
                <button className="secondary" disabled={visibleImageWidth(imageSelection) <= 1} onClick={() => setImageSelection(resizeImage(imageSelection, visibleImageWidth(imageSelection) - 10))}><Minus size={14} />缩小</button>
                <button className="secondary" disabled={visibleImageWidth(imageSelection) >= 100 && !imageSelection.height} onClick={() => setImageSelection(resizeImage(imageSelection, visibleImageWidth(imageSelection) + 10))}><Plus size={14} />放大</button>
                <button className="secondary" onClick={() => setImageSelection(resizeImage(imageSelection, 100))}>铺满宽度</button>
              </div>
              <p className="image-size-hint">放大、缩小按图片原比例调整，也可拖动滑杆。</p>
              <div className="image-alignment" role="group" aria-label="图片对齐">
                {(["left", "center", "right"] as const).map((alignment, index) => {
                  const Icon = [TextAlignLeft, TextAlignCenter, TextAlignRight][index];
                  const label = ["左对齐", "居中", "右对齐"][index];
                  return <button key={alignment} className="secondary" aria-label={`图片${label}`} aria-pressed={imageSelection.alignment === alignment}
                    onClick={() => setImageSelection({ ...imageSelection, alignment })}><Icon size={17} />{label}</button>;
                })}
              </div>
              <Field label="显示高度">
                <input
                  type="number"
                  min={0}
                  max={1500}
                  value={imageSelection.height}
                  onChange={(e) =>
                    setImageSelection({
                      ...imageSelection,
                      height: Math.min(
                        1500,
                        Math.max(0, Number(e.target.value)),
                      ),
                    })
                  }
                />
                <span>px</span>
              </Field>
              <small className="muted">
                0 表示自动高度，固定高度可裁切显示
              </small>
              <Field label="适配方式">
                <select
                  value={imageSelection.fit}
                  onChange={(e) =>
                    setImageSelection({
                      ...imageSelection,
                      fit: e.target.value,
                    })
                  }
                >
                  <option value="cover">填满并裁切</option>
                  <option value="contain">显示完整图片</option>
                  <option value="fill">拉伸填满</option>
                </select>
              </Field>
              <Field label="圆角 (px)">
                <input
                  type="number"
                  min={0}
                  max={200}
                  value={imageSelection.radius}
                  onChange={(e) =>
                    setImageSelection({
                      ...imageSelection,
                      radius: Math.min(
                        200,
                        Math.max(0, Number(e.target.value)),
                      ),
                    })
                  }
                />
              </Field>
              <Field label="跳转链接">
                <input
                  value={imageSelection.link}
                  onChange={(e) =>
                    setImageSelection({
                      ...imageSelection,
                      link: e.target.value,
                    })
                  }
                  placeholder="https://"
                />
              </Field>
              <button
                className="primary full"
                onClick={() => applyImage(imageSelection)}
              >
                应用图片设置
              </button>
            </div>
          </div>
        </ModalWindow>
      )}
      {modal === "find" && (
        <ModalWindow title="查找与替换" onClose={closeModal}>
          <div className="modal-body">
            <Field label="查找文字">
              <input
                aria-label="查找文字"
                value={find}
                onChange={(e) => setFind(e.target.value)}
              />
            </Field>
            <Field label="替换为">
              <input
                aria-label="替换为"
                value={replacement}
                onChange={(e) => setReplacement(e.target.value)}
              />
            </Field>
            <p className="muted">
              只替换文章正文文字，不修改图片地址或 HTML 属性。可使用撤销恢复。
            </p>
            <button className="primary full" onClick={replaceAll}>
              全部替换
            </button>
          </div>
        </ModalWindow>
      )}
      {modal === "tags" && (
        <ModalWindow title="设置标签" onClose={closeModal}>
          <div className="modal-body">
            <Field label="文章标签">
              <input
                aria-label="文章标签"
                value={tagText}
                onChange={(e) => setTagText(e.target.value)}
                placeholder="中秋，生活，艺术"
              />
            </Field>
            <p className="muted">用逗号分隔，最多 20 个标签。</p>
            <button
              className="primary full"
              onClick={() => {
                setMeta(
                  "tags",
                  tagText
                    .split(/[,，]/)
                    .map((s) => s.trim().slice(0, 30))
                    .filter(Boolean)
                    .slice(0, 20),
                );
                setModal(null);
              }}
            >
              保存标签
            </button>
          </div>
        </ModalWindow>
      )}
      {modal === "history" && (
        <ModalWindow title="编辑历史" onClose={closeModal}>
          <div className="modal-body">
            <p className="muted">
              当前编辑会话保留最近 100 次操作。恢复历史后仍可撤销。
            </p>
            <div className="history-list">
              {[...studio.history.past].reverse().map((a, i) => (
                <button
                  key={`${a.updatedAt}-${i}`}
                  onClick={() => {
                    change(clone(a));
                    setSelected(a.blocks[0]?.id || null);
                    setModal(null);
                    notify("已恢复该历史版本");
                  }}
                >
                  <ClockCounterClockwise size={18} />
                  <div>
                    <strong>
                      {a.title} · {a.blocks.length} 个组件
                    </strong>
                    <small>
                      {new Date(a.updatedAt).toLocaleTimeString("zh-CN")}
                    </small>
                  </div>
                  <span>恢复</span>
                </button>
              ))}
              {!studio.history.past.length && (
                <p className="empty-history">
                  开始编辑后，这里会出现历史记录。
                </p>
              )}
            </div>
          </div>
        </ModalWindow>
      )}
    </div>
  );
}
