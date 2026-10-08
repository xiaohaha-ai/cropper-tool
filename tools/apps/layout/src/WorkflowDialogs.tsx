import { useState, useRef } from "react";
import { normalizeArticleFonts } from "./fonts";
import {
  UploadSimple,
  FileText,
  Check,
  ClockCounterClockwise,
  CloudArrowUp,
  DownloadSimple,
  Copy,
  Image,
  SpinnerGap,
} from "@phosphor-icons/react";
import {
  type Article,
  clone,
  sanitize,
  escapeHtml,
  uid,
  safeUrl,
} from "./model";
import { useStudio } from "./useStudio";
import {
  articleFromHtml,
  importDocument,
  duplicateArticle,
  applyLayout,
  layoutPresets,
} from "./documentTools";
import { download, portableArticle } from "./export";

export type Workflow =
  | "import"
  | "importHtml"
  | "importWechat"
  | "saveAs"
  | "share"
  | "savedHistory"
  | "autoLayout"
  | "sample"
  | "sync"
  | "multiSync"
  | "sticker";
export const workflowTitles: Record<Workflow, string> = {
  import: "导入 Word / Excel / Markdown",
  importHtml: "导入 HTML 代码",
  importWechat: "导入公众号文章",
  saveAs: "另存一个图文",
  share: "另存图文给其他用户",
  savedHistory: "图文的历史记录",
  autoLayout: "一键排版",
  sample: "将本图文设置为样刊",
  sync: "同步到公众号",
  multiSync: "同步多图文",
  sticker: "生成贴纸图文",
};
type Props = {
  kind: Workflow;
  studio: ReturnType<typeof useStudio>;
  onClose: () => void;
  notify: (s: string) => void;
  onOpen: (a: Article) => void;
  onCopy: () => Promise<void>;
  onSticker: () => Promise<void>;
  onSample: () => void;
};

function ArticlePreview({ article }: { article: Article }) {
  return (
    <div
      className="workflow-preview"
      style={{
        background: article.background,
        fontSize: article.fontSize,
        lineHeight: article.lineHeight,
        letterSpacing: article.letterSpacing,
      }}
    >
      {article.blocks.map((b) => (
        <div
          key={b.id}
          className="block-content"
          style={b.style}
          dangerouslySetInnerHTML={{ __html: b.html }}
        />
      ))}
    </div>
  );
}

export function WorkflowDialog(props: Props) {
  const { kind, studio, onClose, notify, onOpen, onCopy, onSticker, onSample } =
    props;
  const { article } = studio;
  const [title, setTitle] = useState(
    kind === "saveAs"
      ? `${article.title} - 拷贝`
      : ["import", "importHtml", "importWechat"].includes(kind)
        ? ""
        : article.title,
  );
  const [html, setHtml] = useState("");
  const [link, setLink] = useState("");
  const [draft, setDraft] = useState<Article | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [placement, setPlacement] = useState("new");
  const [preset, setPreset] = useState("clean");
  const [revisionId, setRevisionId] = useState("");
  const [historyTab, setHistoryTab] = useState("saved");
  const [chosen, setChosen] = useState<string[]>([article.id]);
  const input = useRef<HTMLInputElement>(null);
  const run = async (action: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    await run(async () => {
      setDraft(null);
      const result = await importDocument(file);
      setDraft(result.article);
      setTitle(result.article.title);
      setNote(result.note);
    });
    if (input.current) input.current.value = "";
  };
  const parseHtml = () => {
    try {
      setError("");
      setDraft(articleFromHtml(html, title, link));
    } catch (e) {
      setDraft(null);
      setError((e as Error).message);
    }
  };
  const confirmImport = () => {
    if (!draft) return;
    if (link && !safeUrl(link)) {
      setError("请输入有效的 http 或 https 原文链接");
      return;
    }
    const next = {
      ...draft,
      title: title.trim() || draft.title,
      link: safeUrl(link) || draft.link,
    };
    if (placement === "append") {
      if (article.blocks.length + next.blocks.length > 500) {
        setError("合并后超过 500 个组件，请选择新建图文");
        return;
      }
      studio.change((a) => ({
        ...a,
        blocks: [...a.blocks, ...next.blocks.map((b) => ({ ...b, id: uid() }))],
      }));
      onClose();
    } else onOpen(next);
    notify(
      placement === "append"
        ? "内容已添加到文末，可撤销"
        : note || "图文已导入，原图文已保留",
    );
  };
  const documents = [
    article,
    ...studio.documents.filter((a) => a.id !== article.id),
  ];
  const revisions =
    historyTab === "saved"
      ? (studio.revisions[article.id] || []).map((r) => ({
          id: r.id,
          label: r.label,
          time: r.savedAt,
          article: r.article,
        }))
      : [...studio.history.past]
          .reverse()
          .map((a, i) => ({
            id: `session-${i}`,
            label: "编辑操作",
            time: a.updatedAt,
            article: a,
          }));
  const revision = revisions.find((r) => r.id === revisionId);
  const layout = kind === "autoLayout" ? applyLayout(article, preset) : article;

  return (
    <div className="modal-body workflow-body">
      {["import", "importHtml", "importWechat"].includes(kind) && (
        <>
          {kind === "import" ? (
            <>
              <button
                className="import-dropzone"
                disabled={busy}
                onClick={() => input.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void importFile(e.dataTransfer.files[0]);
                }}
              >
                <UploadSimple size={32} weight="light" />
                <strong>
                  {busy ? "正在解析文件…" : "选择文件，或拖到这里"}
                </strong>
                <span>DOCX · XLSX · CSV · Markdown · HTML · TXT · JSON</span>
                <small>最大 50 MB；旧版 DOC / XLS 请先另存为新版格式</small>
              </button>
              <input
                ref={input}
                aria-label="选择导入文件"
                className="hidden"
                type="file"
                accept=".docx,.xlsx,.csv,.md,.markdown,.html,.htm,.txt,.json"
                onChange={(e) => void importFile(e.target.files?.[0])}
              />
            </>
          ) : (
            <>
              {kind === "importWechat" && (
                <>
                  <p className="muted">
                    打开公众号文章，复制正文后粘贴到下方。当前支持复制内容导入，暂不支持仅凭文章链接抓取。
                  </p>
                  <label className="workflow-field">
                    原文链接（可选）
                    <input
                      value={link}
                      onChange={(e) => {
                        setLink(e.target.value);
                        setDraft(null);
                      }}
                      placeholder="https://mp.weixin.qq.com/s/…"
                    />
                  </label>
                </>
              )}
              <label className="workflow-field">
                {kind === "importHtml" ? "HTML 代码" : "粘贴公众号正文"}
                <textarea
                  className={kind === "importHtml" ? "code-area" : ""}
                  aria-label={
                    kind === "importHtml" ? "导入 HTML 代码" : "公众号正文"
                  }
                  placeholder={
                    kind === "importHtml"
                      ? "<h2>文章标题</h2>\n<p>在这里粘贴正文 HTML…</p>"
                      : "从公众号复制图文，然后在这里粘贴（会读取剪贴板中的图文格式）"
                  }
                  value={html}
                  onChange={(e) => {
                    setHtml(e.target.value);
                    setDraft(null);
                  }}
                  onPaste={(e) => {
                    if (kind !== "importWechat") return;
                    const content = e.clipboardData.getData("text/html");
                    if (content) {
                      e.preventDefault();
                      const clean = sanitize(content);
                      setHtml(clean);
                      setDraft(null);
                    } else {
                      e.preventDefault();
                      setHtml(
                        `<p>${escapeHtml(e.clipboardData.getData("text/plain")).replace(/\n/g, "<br>")}</p>`,
                      );
                      setDraft(null);
                    }
                  }}
                />
              </label>
              <button
                className="secondary"
                disabled={!html.trim()}
                onClick={parseHtml}
              >
                预览内容
              </button>
            </>
          )}
          <label className="workflow-field">
            图文标题
            <input
              aria-label="导入图文标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="使用文件名，或输入标题"
            />
          </label>
          {draft && (
            <>
              <div className="workflow-caption">
                <span>导入预览 · {draft.blocks.length} 个组件</span>
                <span>{note}</span>
              </div>
              <ArticlePreview article={draft} />
            </>
          )}
          <div className="import-placement">
            <label>
              <input
                type="radio"
                name="placement"
                checked={placement === "new"}
                onChange={() => setPlacement("new")}
              />{" "}
              新建图文
            </label>
            <label>
              <input
                type="radio"
                name="placement"
                checked={placement === "append"}
                onChange={() => setPlacement("append")}
              />{" "}
              添加到当前图文末尾
            </label>
          </div>
          <div className="workflow-actions">
            <button className="secondary" onClick={onClose}>
              取消
            </button>
            <button
              className="confirm-green"
              disabled={!draft || busy}
              onClick={confirmImport}
            >
              确认导入
            </button>
          </div>
        </>
      )}

      {(kind === "saveAs" || kind === "share" || kind === "sample") && (
        <>
          <div className="workflow-document-summary">
            {article.cover ? (
              <img src={article.cover} alt="封面" />
            ) : (
              <FileText size={38} weight="thin" />
            )}
            <div>
              <strong>{article.title || "未命名图文"}</strong>
              <span>
                {article.blocks.length} 个组件 ·{" "}
                {article.tags.join(" / ") || "无标签"}
              </span>
            </div>
          </div>
          <label className="workflow-field">
            {kind === "sample" ? "样刊名称" : "图文名称"}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
            />
          </label>
          <p className="muted">
            {kind === "share"
              ? "下载可编辑的工程文件后，通过你常用的方式发给对方。对方使用本编辑器导入即可继续编辑；目前不支持直接发送到秀米账号。"
              : kind === "sample"
                ? "保存一份当前图文的快照，可在「图文模板 → 样刊模板」中重复使用。"
                : "新建一份独立副本，继续编辑副本，原图文保留在「打开」列表中。"}
          </p>
          <div className="workflow-actions">
            <button className="secondary" onClick={onClose}>
              取消
            </button>
            <button
              className="confirm-green"
              disabled={!title.trim() || busy}
              onClick={() => {
                if (kind === "saveAs") {
                  onOpen(duplicateArticle(article, title.trim()));
                  notify("已另存为独立图文");
                } else if (kind === "sample") {
                  studio.setSamples((s) => [
                    duplicateArticle(article, title.trim()),
                    ...s,
                  ]);
                  onSample();
                  notify("已保存到样刊模板");
                  onClose();
                } else
                  void run(async () => {
                    download(
                      `${title.replace(/[\\/:*?"<>|]/g, "_")}.json`,
                      JSON.stringify(
                        await portableArticle({
                          ...article,
                          title: title.trim(),
                        }),
                        null,
                        2,
                      ),
                      "application/json",
                    );
                    notify("共享工程已下载，可发送给对方");
                  });
              }}
            >
              {busy
                ? "正在准备…"
                : kind === "share"
                  ? "下载共享工程"
                  : kind === "sample"
                    ? "保存样刊"
                    : "另存并打开"}
            </button>
          </div>
        </>
      )}

      {kind === "savedHistory" && (
        <>
          <div className="workflow-tabs">
            <button
              className={historyTab === "saved" ? "active" : ""}
              onClick={() => {
                setHistoryTab("saved");
                setRevisionId("");
              }}
            >
              已保存版本
            </button>
            <button
              className={historyTab === "session" ? "active" : ""}
              onClick={() => {
                setHistoryTab("session");
                setRevisionId("");
              }}
            >
              本次编辑记录
            </button>
          </div>
          <p className="muted">
            每篇图文保留最近 30
            个保存版本，关闭页面后仍可查看。连续自动保存按分钟合并；恢复前会保存当前版本，恢复后可撤销。
          </p>
          <div className="revision-layout">
            <div className="revision-list">
              {revisions.map((r) => (
                <button
                  key={r.id}
                  className={revisionId === r.id ? "active" : ""}
                  onClick={() => setRevisionId(r.id)}
                >
                  <ClockCounterClockwise />
                  <span>
                    <strong>
                      {r.label} · {r.article.blocks.length} 个组件
                    </strong>
                    <small>{new Date(r.time).toLocaleString("zh-CN")}</small>
                  </span>
                </button>
              ))}
              {!revisions.length && (
                <p className="muted">暂无记录，保存或编辑图文后可查看。</p>
              )}
            </div>
            <div>
              {revision ? (
                <ArticlePreview article={normalizeArticleFonts(revision.article)} />
              ) : (
                <div className="workflow-empty">
                  <ClockCounterClockwise size={32} weight="thin" />
                  <span>选择版本查看内容</span>
                </div>
              )}
            </div>
          </div>
          <div className="workflow-actions">
            <button className="secondary" onClick={onClose}>
              取消
            </button>
            <button
              className="confirm-green"
              disabled={!revision}
              onClick={() => {
                if (!revision) return;
                studio.checkpoint(article, "恢复历史前");
                studio.change(normalizeArticleFonts({ ...clone(revision.article), id: article.id }));
                onClose();
                notify("已恢复所选版本，可撤销");
              }}
            >
              恢复此版本
            </button>
          </div>
        </>
      )}

      {kind === "autoLayout" && (
        <>
          <p className="muted">
            统一正文与标题的字号、行距和留白；锁定组件、图片与装饰卡片保留原样。应用后可一键撤销。
          </p>
          <div className="layout-presets">
            {layoutPresets.map((p) => (
              <button
                className={preset === p.id ? "active" : ""}
                key={p.id}
                onClick={() => setPreset(p.id)}
              >
                <span style={{ color: p.accent }}>Aa</span>
                <strong>{p.name}</strong>
                <small>
                  {p.fontSize}px · {p.lineHeight} 倍行距
                </small>
                {preset === p.id && <Check size={15} />}
              </button>
            ))}
          </div>
          <div className="workflow-caption">排版预览</div>
          <ArticlePreview article={layout} />
          <div className="workflow-actions">
            <button className="secondary" onClick={onClose}>
              取消
            </button>
            <button
              className="confirm-green"
              onClick={() => {
                studio.change(layout);
                onClose();
                notify("一键排版已应用，可撤销");
              }}
            >
              应用排版
            </button>
          </div>
        </>
      )}

      {(kind === "sync" || kind === "multiSync") && (
        <>
          <div className="connection-status">
            <CloudArrowUp size={30} weight="light" />
            <div>
              <strong>公众号尚未连接</strong>
              <span>
                自动同步需要公众号授权和服务端，目前可以复制图文或下载工程。
              </span>
            </div>
            <span>未连接</span>
          </div>
          {kind === "sync" ? (
            <>
              <ol className="sync-steps">
                <li>复制当前图文</li>
                <li>在公众号后台新建图文，粘贴正文</li>
                <li>在公众号后台上传本地图片，检查排版后保存</li>
              </ol>
              <button
                className="confirm-green full"
                disabled={busy}
                onClick={() => void run(onCopy)}
              >
                <Copy size={16} />
                复制当前图文
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                选择 1–8 篇图文，下载打包工程。此操作不会上传到公众号。
              </p>
              <div className="multi-documents">
                {documents.map((a) => (
                  <label key={a.id}>
                    <input
                      type="checkbox"
                      checked={chosen.includes(a.id)}
                      disabled={!chosen.includes(a.id) && chosen.length >= 8}
                      onChange={(e) =>
                        setChosen((ids) =>
                          e.target.checked
                            ? [...ids, a.id]
                            : ids.filter((id) => id !== a.id),
                        )
                      }
                    />
                    <span>{a.title || "未命名图文"}</span>
                    <small>{a.blocks.length} 个组件</small>
                  </label>
                ))}
              </div>
              <button
                className="confirm-green full"
                disabled={!chosen.length || busy}
                onClick={() =>
                  void run(async () => {
                    const { zipSync, strToU8 } = await import("fflate");
                    const files: Record<string, Uint8Array> = {};
                    for (const [i, id] of chosen.entries()) {
                      const a = documents.find((d) => d.id === id)!;
                      files[
                        `${i + 1}-${(a.title || "图文").replace(/[\\/:*?"<>|]/g, "_")}.json`
                      ] = strToU8(
                        JSON.stringify(await portableArticle(a), null, 2),
                      );
                    }
                    const zip = zipSync(files);
                    download(
                      "多图文工程.zip",
                      new Blob([new Uint8Array(zip)], {
                        type: "application/zip",
                      }),
                    );
                    notify(`已打包 ${chosen.length} 篇图文，未执行公众号同步`);
                  })
                }
              >
                <DownloadSimple size={16} />
                {busy ? "正在打包…" : `下载所选工程（${chosen.length}）`}
              </button>
            </>
          )}
        </>
      )}

      {kind === "sticker" && (
        <>
          <div className="workflow-empty sticker-intro">
            <Image size={44} weight="thin" />
            <strong>把排版转换为图片图文</strong>
            <span>
              将正文渲染为高清图片，按高度分段，生成一份新的图文。新图文中的文字成为图片，原来的可编辑图文会保留。
            </span>
          </div>
          <button
            className="confirm-green full"
            disabled={busy}
            onClick={() => void run(onSticker)}
          >
            {busy ? (
              <>
                <SpinnerGap className="spin" />
                正在生成贴纸…
              </>
            ) : (
              "生成并打开贴纸图文"
            )}
          </button>
        </>
      )}
      {error && (
        <p className="workflow-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
