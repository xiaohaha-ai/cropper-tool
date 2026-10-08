import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { docxFixture, xlsxFixture } from "./document-fixtures.mjs";
const dom = new JSDOM("");
globalThis.window = dom.window;
globalThis.DOMParser = dom.window.DOMParser;
const { newArticle, makeBlock } = await import("../src/model.ts");
const {
  duplicateArticle,
  rememberRevision,
  filterDocuments,
  articleFromHtml,
  csvToHtml,
  importDocument,
  collectImages,
  applyLayout,
} = await import("../src/documentTools.ts");

test("另存图文具有独立的文稿和组件标识，编辑副本不影响原稿", () => {
  const source = newArticle();
  const before = JSON.stringify(source);
  const copy = duplicateArticle(source, "副本");
  copy.blocks[0].html = "已修改";
  copy.tags.push("新标签");
  assert.notEqual(copy.id, source.id);
  assert.notEqual(copy.blocks[0].id, source.blocks[0].id);
  assert.equal(copy.title, "副本");
  assert.equal(JSON.stringify(source), before);
});
test("搜索支持标题、描述、标签与正文，按更新时间排序且不匹配 HTML 标签", () => {
  const a = {
    ...newArticle(),
    title: "展商 Alpha",
    description: "秋季",
    tags: ["展览"],
    updatedAt: 1,
    blocks: [makeBlock("text", "正文", "<p>陶瓷</p>")],
  };
  const b = {
    ...newArticle(),
    title: "展商 Beta",
    description: "",
    tags: [],
    updatedAt: 2,
    blocks: [],
  };
  assert.deepEqual(
    filterDocuments([a, b], "展商", "", false).map((x) => x.id),
    [b.id, a.id],
  );
  assert.equal(filterDocuments([a, b], "陶瓷", "", false).length, 0);
  assert.equal(filterDocuments([a, b], "陶瓷", "展览", true)[0].id, a.id);
  assert.equal(filterDocuments([a, b], "<p>", "", true).length, 0);
  assert.equal(filterDocuments([a, b], "alpha 秋季", "", false)[0].id, a.id);
});
test("HTML 导入拆分标题、正文、表格并剔除脚本，同时读取公众号延迟图片", () => {
  const a = articleFromHtml(
    '<title>测试</title><div id="js_content"><h2>标题</h2><p onclick="bad()">正文<img data-src="https://example.com/a.jpg"></p><table><tr><td>单元格</td></tr></table><script>bad()</script></div>',
    "图文",
    "javascript:bad()",
  );
  assert.deepEqual(
    a.blocks.map((b) => b.kind),
    ["heading", "text", "table"],
  );
  assert.match(a.blocks[1].html, /src="https:\/\/example.com\/a.jpg"/);
  assert.equal(a.link, "");
  assert.doesNotMatch(a.blocks.map((b) => b.html).join(""), /onclick|<script/);
  assert.throws(() => articleFromHtml("<script>x</script>", "空"));
});
test("Markdown 导入保留标题、粗体与表格并清洗危险链接", async () => {
  const { article: a } = await importDocument(
    new File(
      [
        "# 测试标题\n\n**正文**\n\n|列 A|列 B|\n|-|-|\n|甲|乙|\n\n<script>bad()</script>",
      ],
      "稿件.MD",
    ),
  );
  const html = a.blocks.map((b) => b.html).join("");
  assert.equal(a.title, "稿件");
  assert.match(html, /<h1>测试标题/);
  assert.match(html, /<strong>正文/);
  assert.match(html, /<table>/);
  assert.doesNotMatch(html, /<script/);
});
test("真实 DOCX 压缩包可解析为粗体和表格内容", async () => {
  const { article: a } = await importDocument(
    new File([docxFixture()], "验收.docx"),
  );
  const html = a.blocks.map((b) => b.html).join("");
  assert.match(html, /Word 导入验收/);
  assert.match(html, /<strong>这是粗体内容/);
  assert.match(html, /<table>/);
  assert.match(html, /表格单元格/);
});
test("真实 XLSX 压缩包完整导入多个工作表及数字", async () => {
  const { article: a, note } = await importDocument(
    new File([xlsxFixture()], "工作表.xlsx"),
  );
  const html = a.blocks.map((b) => b.html).join("");
  assert.match(html, /活动安排/);
  assert.match(html, /签到/);
  assert.match(html, /费用/);
  assert.match(html, /1200/);
  assert.match(note, /2 张/);
});
test("CSV 保留引号内的逗号与换行并转义内容", () => {
  const html = csvToHtml(
    '名称,说明\r\n"A,B","第一行\n第二行"\r\n"<img>","双""引号"',
  );
  assert.match(html, /A,B/);
  assert.match(html, /第一行<br>第二行/);
  assert.match(html, /&lt;img&gt;/);
  assert.match(html, /双&quot;引号/);
  assert.throws(() => csvToHtml('"未闭合'));
});
test("收集图片去重并排除装饰元素，已有图库保持不变", () => {
  const a = newArticle();
  a.blocks = [
    makeBlock(
      "image",
      "图",
      '<img src="https://example.com/a.png" alt="封面"><img src="https://example.com/a.png"><img data-decoration="true" src="https://example.com/deco.png"><img src="https://example.com/b.png">',
    ),
  ];
  const existing = [
    {
      id: "old",
      src: "https://example.com/b.png",
      name: "已有",
      type: "image",
    },
  ];
  const result = collectImages(a, existing);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "封面");
  assert.equal(existing.length, 1);
});
test("一键排版不修改锁定组件、图片、原稿和已有撤销快照", () => {
  const a = newArticle();
  a.blocks[0].locked = true;
  const text = makeBlock(
    "text",
    "可修改",
    '<p style="font-size:36px;color:red">正文<strong>强调</strong></p>',
  );
  a.blocks.push(text);
  const before = JSON.stringify(a);
  const next = applyLayout(a, "editorial");
  assert.deepEqual(next.blocks[0], a.blocks[0]);
  assert.deepEqual(next.blocks[1], a.blocks[1]);
  assert.equal(next.blocks[2].style.fontSize, 15);
  assert.doesNotMatch(next.blocks[2].html, /36px/);
  assert.match(next.blocks[2].html, /<strong>强调/);
  assert.equal(next.fontSize, a.fontSize);
  assert.equal(JSON.stringify(a), before);
});
test("历史按文章隔离，重复内容不增版本，自动保存按自然分钟合并并保留初始版本", () => {
  const originalNow = Date.now;
  let now = 1_800_000;
  Date.now = () => now;
  try {
    const a = newArticle();
    let store = rememberRevision({}, a);
    const initial = store[a.id][0];
    assert.equal(rememberRevision(store, { ...a, updatedAt: 99 }), store);
    now += 1000;
    store = rememberRevision(store, { ...a, title: "第二稿" });
    now += 1000;
    store = rememberRevision(store, { ...a, title: "第三稿" });
    assert.equal(store[a.id].length, 2);
    assert.equal(store[a.id][1].id, initial.id);
    now += 60000;
    store = rememberRevision(store, { ...a, title: "第四稿" });
    assert.equal(store[a.id].length, 3);
    const b = newArticle();
    store = rememberRevision(store, b, "手动保存");
    assert.equal(store[b.id].length, 1);
    assert.equal(store[a.id].length, 3);
    for (let i = 0; i < 40; i++)
      store = rememberRevision(store, { ...a, title: `稿件${i}` }, "手动保存");
    assert.equal(store[a.id].length, 30);
    assert.equal(store[a.id][0].article.title, "稿件39");
  } finally {
    Date.now = originalNow;
  }
});
test("拒绝不支持格式和无效工程，避免把二进制误当正文", async () => {
  await assert.rejects(
    () => importDocument(new File(["binary"], "旧版.doc")),
    /DOCX/,
  );
  await assert.rejects(() => importDocument(new File(["{}"], "损坏.json")));
});

test("恢复历史前会固定当前自动保存版本，后续自动保存不会覆盖它", () => {
  const a = newArticle();
  let store = rememberRevision({}, a);
  store = rememberRevision(store, { ...a, title: "当前工作" });
  store = rememberRevision(store, { ...a, title: "当前工作" }, "恢复历史前");
  store = rememberRevision(store, a);
  assert.ok(
    store[a.id].some(
      (r) => r.label === "恢复历史前" && r.article.title === "当前工作",
    ),
  );
});
