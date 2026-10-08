import { useState, useEffect, useRef, useCallback, type SetStateAction } from "react";
import { get, set } from "idb-keyval";
import {
  type Article,
  type Block,
  type Asset,
  newArticle,
  upgradeBundledArticle,
  uid,
} from "./model";
import { rememberRevision, type RevisionStore } from "./documentTools";
import { copyArticle, copyBlock, reuseArticleBlocks, sameArticle } from "./articleState";
import { normalizeArticleFonts, normalizeBlockFonts } from "./fonts";
import { validAssetGroups, type AssetGroup, type AssetLibraryState } from "./assetLibraryState";
type Vault = {
  activeId: string;
  documents: Article[];
  favorites: Block[];
  assets: Asset[];
  assetGroups?: AssetGroup[];
  clipboard: Block[];
  recent: string[];
  revisions?: RevisionStore;
  samples?: Article[];
};
export function useStudio() {
  const [article, setArticle] = useState<Article>(() => newArticle());
  const [documents, setDocuments] = useState<Article[]>([]);
  const [favorites, setFavorites] = useState<Block[]>([]);
  const [assetLibrary, setAssetLibrary] = useState<AssetLibraryState>({ groups: [], assets: [
    {
      id: "sample",
      name: "中秋月饼.jpg",
      src: "/assets/festival-photo.png",
      type: "image",
    },
  ] });
  const { assets, groups: assetGroups } = assetLibrary;
  const setAssets = useCallback((update: SetStateAction<Asset[]>) => {
    setAssetLibrary((current) => ({ ...current, assets: validAssetGroups(
      typeof update === "function" ? update(current.assets) : update, current.groups,
    ) }));
  }, []);
  const [clipboard, setClipboard] = useState<Block[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
  const [samples, setSamples] = useState<Article[]>([]);
  const [revisions, setRevisions] = useState<RevisionStore>({});
  const revisionsRef = useRef<RevisionStore>({});
  const [ready, setReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState("正在读取");
  const [history, setHistory] = useState<{
    past: Article[];
    future: Article[];
  }>({ past: [], future: [] });
  const current = useRef(article);
  current.current = article;
  const historyRef = useRef(history);
  historyRef.current = history;
  const writeHistory = (next: typeof history) => {
    historyRef.current = next;
    setHistory(next);
  };
  const typing = useRef({ key: "", time: 0 });
  const vault = useRef<Vault | undefined>(undefined);
  const saving = useRef<Promise<unknown>>(Promise.resolve());
  useEffect(() => {
    let active = true;
    get<Vault>("xiumi-studio-v1")
      .then((v) => {
        if (!active) return;
        if (v) {
          const a = v.documents.find((d) => d.id === v.activeId);
          if (a) {
            const upgraded = normalizeArticleFonts(upgradeBundledArticle(a));
            setArticle(upgraded);
            current.current = upgraded;
          }
          setDocuments(v.documents.map((doc) => normalizeArticleFonts(upgradeBundledArticle(doc))));
          setFavorites((v.favorites || []).map(normalizeBlockFonts));
          const groups = v.assetGroups || [];
          setAssetLibrary({ groups, assets: validAssetGroups(
            (v.assets || []).map((asset) =>
              asset.id === "sample" && asset.src === "/assets/mooncake.jpg"
                ? { ...asset, src: "/assets/festival-photo.png" }
                : asset,
            ), groups,
          ) });
          setClipboard((v.clipboard || []).map(normalizeBlockFonts));
          setRecent(v.recent || []);
          setSamples((v.samples || []).map(normalizeArticleFonts));
          revisionsRef.current = v.revisions || {};
          setRevisions(revisionsRef.current);
        }
        setSaveStatus("已保存在本机");
      })
      .catch(() => setSaveStatus("无法读取本地存储，请导出备份"))
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);
  const change = useCallback(
    (update: Article | ((a: Article) => Article), key = "") => {
      const previous = current.current;
      const next = reuseArticleBlocks(previous,
        typeof update === "function" ? update(copyArticle(previous)) : update);
      if (sameArticle(previous, next)) return;
      const now = Date.now();
      const grouped =
        !!key && typing.current.key === key && now - typing.current.time < 800;
      if (!grouped)
        writeHistory({
          past: [...historyRef.current.past, copyArticle(previous)].slice(-100),
          future: [],
        });
      typing.current = { key, time: now };
      const result = { ...next, updatedAt: now };
      current.current = result;
      setArticle(result);
      setSaveStatus("正在保存…");
    },
    [],
  );
  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.past.length) return;
    const previous = current.current;
    const next = reuseArticleBlocks(previous, copyArticle(h.past[h.past.length - 1]));
    current.current = next;
    setArticle(next);
    typing.current = { key: "", time: 0 };
    writeHistory({
      past: h.past.slice(0, -1),
      future: [previous, ...h.future],
    });
  }, []);
  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.future.length) return;
    const previous = current.current;
    const next = reuseArticleBlocks(previous, copyArticle(h.future[0]));
    current.current = next;
    setArticle(next);
    typing.current = { key: "", time: 0 };
    writeHistory({ past: [...h.past, previous], future: h.future.slice(1) });
  }, []);
  const checkpoint = useCallback((a: Article, label: string) => {
    const next = rememberRevision(revisionsRef.current, a, label);
    revisionsRef.current = next;
    setRevisions(next);
    return next;
  }, []);
  const persist = useCallback(
    async (manual = false) => {
      if (!vault.current) return;
      // State updates are immutable; IndexedDB makes the durable copy itself.
      const snapshot = { ...vault.current };
      snapshot.revisions = checkpoint(
        snapshot.documents[0],
        manual ? "手动保存" : "自动保存",
      );
      setSaveStatus("正在保存…");
      const job = saving.current
        .catch(() => {})
        .then(() => set("xiumi-studio-v1", snapshot));
      saving.current = job;
      try {
        await job;
        try {
          localStorage.setItem("creative-tool-recent:layout", JSON.stringify({
            title: snapshot.documents[0].title || "未命名图文", updatedAt: Date.now(),
          }));
        } catch { /* The article itself is already saved in IndexedDB. */ }
        setSaveStatus("已保存在本机");
      } catch {
        setSaveStatus("保存失败，请立即导出工程备份");
        throw new Error("浏览器存储不足或被禁用，请导出工程备份");
      }
    },
    [checkpoint],
  );
  vault.current = {
    activeId: article.id,
    documents: [article, ...documents.filter((d) => d.id !== article.id)],
    favorites,
    assets,
    assetGroups,
    clipboard,
    recent,
    revisions,
    samples,
  };
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      void persist().catch(() => {});
    }, 600);
    return () => clearTimeout(t);
  }, [
    article,
    documents,
    favorites,
    assets,
    assetGroups,
    clipboard,
    recent,
    samples,
    ready,
    persist,
  ]);
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === "hidden" && ready)
        void persist().catch(() => {});
    };
    document.addEventListener("visibilitychange", flush);
    return () => document.removeEventListener("visibilitychange", flush);
  }, [ready, persist]);
  useEffect(() => {
    const leaveTool = (event: MouseEvent) => {
      if (!ready || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const path = event.composedPath();
      const link = path.find(node => node instanceof HTMLAnchorElement) as HTMLAnchorElement | undefined;
      const isToolLink = path.some(node => node instanceof Element && node.localName === "tool-switcher");
      if (!link || (!isToolLink && !link.classList.contains("tool-home-link")) || link.target === "_blank") return;
      event.preventDefault();
      void persist().then(() => { window.location.assign(link.href); }).catch(() => {
        // persist already exposes the failure; keep the unsaved document open.
      });
    };
    document.addEventListener("click", leaveTool, true);
    return () => document.removeEventListener("click", leaveTool, true);
  }, [ready, persist]);
  const open = useCallback(
    (a: Article) => {
      const previous = copyArticle(current.current);
      checkpoint(previous, "切换图文前");
      setDocuments((ds) => [
        previous,
        ...ds.filter((d) => d.id !== previous.id),
      ]);
      const next = normalizeArticleFonts(copyArticle(a));
      current.current = next;
      setArticle(next);
      writeHistory({ past: [], future: [] });
      typing.current = { key: "", time: 0 };
    },
    [checkpoint],
  );
  const updateBlock = useCallback(
    (id: string, patch: Partial<Block>, key = "") =>
      change(
        {
          ...current.current,
          blocks: current.current.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
        },
        key,
      ),
    [change],
  );
  const insert = useCallback(
    (block: Block, after?: string) => {
      const b = { ...copyBlock(block), id: uid(), locked: false };
      change((a) => {
        const index = after
          ? a.blocks.findIndex((b) => b.id === after)
          : a.blocks.length - 1;
        const blocks = [...a.blocks];
        blocks.splice(index + 1, 0, b);
        return { ...a, blocks };
      });
      return b.id;
    },
    [change],
  );
  return {
    article,
    documents,
    favorites,
    setFavorites,
    assets,
    setAssets,
    assetLibrary,
    setAssetLibrary,
    assetGroups,
    clipboard,
    setClipboard,
    recent,
    setRecent,
    samples,
    setSamples,
    revisions,
    checkpoint,
    ready,
    saveStatus,
    change,
    undo,
    redo,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    history,
    open,
    persist,
    updateBlock,
    insert,
  };
}
