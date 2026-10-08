import { useEffect, useRef, useState } from "react";
import { Copy, Check, ArrowsClockwise, DownloadSimple } from "@phosphor-icons/react";
import { get, set } from "idb-keyval";
import type { Article } from "./model";
import { inlineArticle, plainText, png, download } from "./export";
import { copyRichContent, selectAllContent, setRichClipboard, type RichContent } from "./clipboard";
import { prepareYouzanArticle, resolveYouzanImages, verifyImageLinks, youzanImageZip, publicImageUrl, type YouzanExport, type ImageLinks } from "./youzanExport";

export function CopyExport({ article, paper, onClose }: {
  article: Article;
  paper: HTMLElement;
  onClose: () => void;
}) {
  const preview = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState<RichContent | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [destination, setDestination] = useState<"youzan" | "general">("youzan");
  const [prepared, setPrepared] = useState<YouzanExport | null>(null);
  const [links, setLinks] = useState<ImageLinks>({});
  const [validating, setValidating] = useState(false);
  const [imageError, setImageError] = useState("");
  const [imageHelp, setImageHelp] = useState(true);
  const operation = useRef(0);
  const contentVersion = useRef(0);
  useEffect(() => {
    let cancelled = false;
    operation.current++;
    contentVersion.current++;
    setContent(null);
    setPrepared(null);
    setError("");
    setImageError("");
    setCopied(false);
    const text = plainText(paper);
    const prepare = async () => {
      if (destination === "general") {
        const html = await inlineArticle(article, paper);
        if (!cancelled) setContent({ html, text });
      } else {
        const result = await prepareYouzanArticle(article, paper);
        const stored = await get<ImageLinks>("xiumi-youzan-image-links-v1").catch(() => ({}));
        if (cancelled) return;
        setPrepared(result);
        setLinks(stored || {});
        setImageHelp(true);
        if (!result.images.length) setContent({ html: result.html, text });
      }
    };
    void prepare().catch((e: Error) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [article, paper, attempt, destination]);

  useEffect(() => {
    if (!content || !preview.current) return;
    selectAllContent(preview.current);
    const root = preview.current;
    const modal = root.closest(".modal");
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest("input,textarea,select")) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a" &&
        modal?.contains(event.target as Node)) {
        event.preventDefault();
        selectAllContent(root);
      }
    };
    const copy = (event: ClipboardEvent) => {
      if (document.activeElement?.matches("input,textarea,select")) return;
      if (!event.defaultPrevented && event.clipboardData &&
        (modal?.contains(document.activeElement) || root.contains(window.getSelection()?.anchorNode || null))) {
        setRichClipboard(event.clipboardData, content);
        event.preventDefault();
        setCopied(true);
        setError("");
      }
    };
    document.addEventListener("keydown", key);
    document.addEventListener("copy", copy);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("copy", copy);
      if (root.contains(window.getSelection()?.anchorNode || null)) window.getSelection()?.removeAllRanges();
    };
  }, [content]);

  const copy = async () => {
    if (!content || !preview.current || busy) return;
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      await copyRichContent(content, preview.current);
      setCopied(true);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (!prepared || validating) return;
    const generation = operation.current;
    const version = contentVersion.current;
    setValidating(true);
    setImageError("");
    try {
      await verifyImageLinks(prepared, links);
      const html = resolveYouzanImages(prepared, links);
      if (generation !== operation.current || version !== contentVersion.current) return;
      const previous = await get<ImageLinks>("xiumi-youzan-image-links-v1").catch(() => ({}));
      await set("xiumi-youzan-image-links-v1", { ...previous, ...links }).catch(() => undefined);
      if (generation !== operation.current || version !== contentVersion.current) return;
      setContent({ html, text: plainText(paper) });
      setImageHelp(false);
    } catch (e) {
      if (generation === operation.current) setImageError((e as Error).message);
    } finally { setValidating(false); }
  };
  const downloadImages = async () => {
    if (!prepared) return;
    try { download("有赞图片素材.zip", await youzanImageZip(prepared)); }
    catch (e) { setImageError((e as Error).message); }
  };
  const downloadExact = async () => {
    setBusy(true);
    setImageError("");
    try {
      const data = await png(article, paper);
      download(`${article.title || "图文"}-保真长图.png`, await (await fetch(data)).blob());
    } catch (e) { setImageError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <div className="copy-export">
    <div className="copy-export-controls">
      <div className="copy-destination" role="group" aria-label="粘贴目标">
        <button aria-pressed={destination === "youzan"} onClick={() => setDestination("youzan")}>有赞页面编辑</button>
        <button aria-pressed={destination === "general"} onClick={() => setDestination("general")}>普通富文本</button>
      </div>
      <p>{destination === "youzan" ? "有赞兼容排版：正文保留文字，叠放图形转为图片。" : "整篇正文已全选，文字、图片和样式一起复制。"}</p>
      <div className="copy-export-actions">
        <button className="primary" disabled={!content || busy} onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />}{busy ? "正在复制…" : "复制全部内容"}
        </button>
        <button className="secondary" disabled={!content} onClick={() => preview.current && selectAllContent(preview.current)}>重新全选</button>
        <button className="secondary" onClick={onClose}>退出复制</button>
      </div>
      <p className="copy-export-status" role="status">
        {copied ? "已复制整篇图文，到目标文档粘贴即可。" : content ? "也可按 ⌘C / Ctrl+C，或在正文上右键复制。" : prepared ? `还有 ${prepared.images.length} 张图片需要有赞素材地址，补齐后才能复制。` : !error ? "正在准备正文和图片…" : "正文准备失败"}
      </p>
      <p className="copy-export-hint">{destination === "youzan" ? "有赞不接收正文中的内嵌图片。请先将下方素材上传到有赞素材库，填入图片直链；地址会记住并在下次复用。" : "此模式使用内嵌图片，不适合有赞。粘贴时选择“保留源格式”；纯文本文件不支持样式。"}</p>
      {destination === "youzan" && <button className="copy-exact-link" disabled={busy} onClick={() => void downloadExact()}><DownloadSimple size={14} />下载保真长图（文字转为图片，上传到有赞“图片广告”）</button>}
      {error && <p className="workflow-error" role="alert">{error}{!content && <button className="secondary" onClick={() => setAttempt((n) => n + 1)}><ArrowsClockwise />重试</button>}</p>}
    </div>
    <div className="copy-export-scroll">
      {destination === "youzan" && prepared && <div className="youzan-assets">
        {prepared.flattened > 0 && <p>已将 {prepared.flattened} 处叠放图形或装饰转成图片，避免平台拆散；原稿仍可编辑。</p>}
        {!!prepared.images.length && <>
          <div className="copy-export-actions">
            <button className="secondary" onClick={() => void downloadImages()}>下载图片素材包</button>
            <button className="secondary" onClick={() => setImageHelp((value) => !value)}>{imageHelp ? "收起图片地址" : "修改图片地址"}</button>
          </div>
          {imageHelp && prepared.images.map((asset, index) => <label className="youzan-image" key={asset.id}>
            <img src={asset.src} alt={asset.name} />
            <span><strong>{index + 1}. {asset.name}</strong><small>{asset.filename}</small>
              <input aria-label={`图片 ${index + 1} 的有赞地址`} type="url" placeholder="粘贴有赞素材的 https:// 图片地址" value={links[asset.id] || ""}
                onChange={(event) => { contentVersion.current++; setLinks((value) => ({ ...value, [asset.id]: event.target.value })); setContent(null); setCopied(false); }}
                onPaste={(event) => {
                  const html = event.clipboardData.getData("text/html");
                  const image = html && new DOMParser().parseFromString(html, "text/html").querySelector("img");
                  const url = image && publicImageUrl(image.src);
                  if (url) { event.preventDefault(); contentVersion.current++; setLinks((value) => ({ ...value, [asset.id]: url })); setContent(null); setCopied(false); }
                }} />
            </span>
          </label>)}
          {imageHelp && <button className="primary" disabled={validating || prepared.images.some((asset) => !publicImageUrl(links[asset.id] || ""))} onClick={() => void verify()}>{validating ? "正在检查图片…" : "验证图片地址并准备复制"}</button>}
        </>}
      </div>}
      {imageError && <p className="workflow-error" role="alert">{imageError}</p>}
      {content && <div ref={preview} className="copy-export-preview" tabIndex={0} role="document" aria-label="整篇图文复制预览"
        onClick={(e) => { if ((e.target as Element).closest("a")) e.preventDefault(); }}
        dangerouslySetInnerHTML={{ __html: content.html }} />}
      {!content && prepared && <div className="copy-export-preview youzan-unready" aria-label="有赞排版预览（图片地址待补齐）" onCopy={(event) => event.preventDefault()} onClick={(event) => event.preventDefault()} dangerouslySetInnerHTML={{ __html: prepared.html }} />}
    </div>
  </div>;
}
