import type { Article, Block } from './model.ts';

// HTML and image URLs are immutable strings. Copy the writable containers only.
export function copyBlock(block: Block): Block {
  return { ...block, style: { ...block.style }, ...(block.frame ? {
    frame: { ...block.frame, crop: { ...block.frame.crop } },
  } : {}) };
}

export function copyArticle(article: Article): Article {
  return { ...article, tags: [...article.tags], blocks: article.blocks.map(copyBlock) };
}

// Editor state contains only plain objects, arrays and primitive values.
// Reference checks avoid traversing or serializing unchanged image data.
export function sameState(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key =>
    Object.hasOwn(right, key) && sameState(left[key], right[key]));
}

export function sameArticle(a: Article, b: Article, ignoreTimestamp = false): boolean {
  return ignoreTimestamp
    ? sameState({ ...a, updatedAt: 0 }, { ...b, updatedAt: 0 })
    : sameState(a, b);
}

export function reuseArticleBlocks(previous: Article, next: Article): Article {
  const existing = new Map(previous.blocks.map(block => [block.id, block]));
  const blocks = next.blocks.map(block => {
    const old = existing.get(block.id);
    return old && sameState(old, block) ? old : block;
  });
  return { ...next, blocks: blocks.length === previous.blocks.length &&
    blocks.every((block, index) => block === previous.blocks[index]) ? previous.blocks : blocks };
}
