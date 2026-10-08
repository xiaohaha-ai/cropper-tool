import { useState } from "react";
import {
  MagnifyingGlass,
  CaretRight,
  CaretLeft,
  Plus,
  UploadSimple,
  Users,
  FileText,
  Check,
} from "@phosphor-icons/react";
import type { Article } from "./model";
import { filterDocuments } from "./documentTools";

export function DocumentPicker({
  documents,
  currentId,
  onOpen,
  onClose,
  onNew,
  onImport,
}: {
  documents: Article[];
  currentId: string;
  onOpen: (a: Article) => void;
  onClose: () => void;
  onNew: () => void;
  onImport: () => void;
}) {
  const [scope, setScope] = useState("mine");
  const [query, setQuery] = useState("");
  const [fullText, setFullText] = useState(false);
  const [tag, setTag] = useState("");
  const [selection, setSelection] = useState(currentId);
  const [page, setPage] = useState(1);
  const tags = Array.from(new Set(documents.flatMap((d) => d.tags)));
  const filtered = filterDocuments(documents, query, tag, fullText);
  const pages = Math.max(1, Math.ceil(filtered.length / 15));
  const currentPage = Math.min(page, pages);
  const selected = filtered.find((d) => d.id === selection);
  return (
    <>
      <div className="document-browser">
        <nav className="document-scopes" aria-label="图文来源">
          <button
            className={scope === "mine" ? "active" : ""}
            onClick={() => setScope("mine")}
          >
            我的 <CaretRight weight="bold" />
          </button>
          <button
            className={scope === "team" ? "active" : ""}
            onClick={() => setScope("team")}
          >
            团队 <CaretRight weight="bold" />
          </button>
        </nav>
        <div className="document-results">
          {scope === "mine" ? (
            <>
              <div className="document-filterbar">
                <span className="document-pill">图文</span>
                <div className="document-search">
                  <MagnifyingGlass size={16} />
                  <input
                    autoFocus
                    aria-label="搜索图文"
                    placeholder="输入标题或描述"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={fullText}
                    onChange={(e) => {
                      setFullText(e.target.checked);
                      setPage(1);
                    }}
                  />
                  全文搜索
                </label>
              </div>
              <div className="document-tags">
                <span>我的标签：</span>
                <button
                  className={!tag ? "active" : ""}
                  onClick={() => {
                    setTag("");
                    setPage(1);
                  }}
                >
                  全部
                </button>
                {tags.map((t) => (
                  <button
                    key={t}
                    className={tag === t ? "active" : ""}
                    onClick={() => {
                      setTag(t);
                      setPage(1);
                    }}
                  >
                    {t}
                  </button>
                ))}
                {!tags.length && <span>暂无标签</span>}
              </div>
              <div className="document-result-scroll">
                <div className="document-list-grid">
                  {filtered
                    .slice((currentPage - 1) * 15, currentPage * 15)
                    .map((a) => (
                      <button
                        key={a.id}
                        aria-pressed={selection === a.id}
                        className={`document-row ${selection === a.id ? "selected" : ""}`}
                        onClick={() => setSelection(a.id)}
                        onDoubleClick={() => onOpen(a)}
                      >
                        <span className="document-row-cover">
                          {a.cover ? (
                            <img src={a.cover} alt="" />
                          ) : (
                            <FileText size={28} weight="thin" />
                          )}
                        </span>
                        <span className="document-row-copy">
                          <strong>{a.title || "未命名图文"}</strong>
                          <small>
                            {new Date(a.updatedAt).toLocaleString("zh-CN", {
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </span>
                        {selection === a.id && (
                          <Check
                            className="document-selected-mark"
                            size={14}
                            weight="bold"
                          />
                        )}
                        {a.id === currentId && (
                          <span className="document-editing">当前</span>
                        )}
                      </button>
                    ))}
                </div>
                {!filtered.length && (
                  <div className="workflow-empty">
                    <MagnifyingGlass size={36} weight="thin" />
                    <strong>没有找到图文</strong>
                    <span>试试其他关键词，或取消标签筛选。</span>
                    <button
                      className="secondary"
                      onClick={() => {
                        setQuery("");
                        setTag("");
                        setFullText(false);
                      }}
                    >
                      清除筛选
                    </button>
                  </div>
                )}
              </div>
              <div className="document-pagination">
                <span>共 {filtered.length} 篇</span>
                <button
                  aria-label="第一页"
                  disabled={currentPage === 1}
                  onClick={() => setPage(1)}
                >
                  «
                </button>
                <button
                  aria-label="上一页"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <CaretLeft />
                </button>
                <span className="page-number">
                  {currentPage} / {pages}
                </span>
                <button
                  aria-label="下一页"
                  disabled={currentPage === pages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <CaretRight />
                </button>
                <button
                  aria-label="最后一页"
                  disabled={currentPage === pages}
                  onClick={() => setPage(pages)}
                >
                  »
                </button>
              </div>
            </>
          ) : (
            <div className="workflow-empty team-empty">
              <Users size={52} weight="thin" />
              <strong>尚未连接团队工作区</strong>
              <span>
                团队图文需要账号和协作服务。你可以先导入其他人分享的工程，在本机继续编辑。
              </span>
              <button className="secondary" onClick={onImport}>
                <UploadSimple />
                导入共享工程
              </button>
            </div>
          )}
        </div>
      </div>
      <footer className="document-browser-footer">
        <div>
          <button className="secondary" onClick={onNew}>
            <Plus />
            新建图文
          </button>
          <button className="secondary" onClick={onImport}>
            <UploadSimple />
            导入
          </button>
        </div>
        <span>图文保存在当前浏览器</span>
        <div>
          <button
            className="confirm-green"
            disabled={scope !== "mine" || !selected}
            onClick={() => selected && onOpen(selected)}
          >
            打开
          </button>
          <button className="cancel-red" onClick={onClose}>
            取消
          </button>
        </div>
      </footer>
    </>
  );
}
