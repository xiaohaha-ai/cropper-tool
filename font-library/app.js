(() => {
  'use strict';
  const catalog = window.FONT_CATALOG;
  const $ = (id) => document.getElementById(id);
  if (!catalog?.families?.length) {
    $('fontName').textContent = '字体库未找到';
    $('fontDescription').textContent = '字体库暂时无法加载，请刷新页面重试。';
    return;
  }
  const families = catalog.families;
  const byId = new Map(families.map((family) => [family.id, family]));
  const storageKey = 'ziyang-font-lab-v1';
  const samples = {
    art: '从展馆，走向城市。\n让生活，有一点艺术。\nMake room for good things.',
    poem: '山有木兮木有枝，\n心悦君兮君不知。\nBeyond the mountains, another sky.',
    brand: '把日子，过成喜欢的样子。\n秋日好物 · 焕新生活\nGood things. Made for you.',
    english: '中文与英文，一起看看。\nABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789  ¥  $  &  @'
  };
  const defaults = {text:samples.art, family:families[0].id, variant:'', size:innerWidth <= 760 ? 44 : 64, spacing:0, line:1.5, color:'#253b32', background:'#ffffff', align:'left', favorites:[], axes:{}};
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch {}
  const state = {...defaults, ...saved};
  if (!byId.has(state.family)) state.family = defaults.family;
  if (typeof state.text !== 'string') state.text = defaults.text;
  state.text = state.text.slice(0, 20000);
  // Migrate the previous separate drafts once, keeping both user-written texts.
  if (saved.textMode !== 'bilingual') {
    const drafts = [saved.textByLanguage?.chinese, saved.textByLanguage?.english, state.text];
    state.text = [...new Set(drafts.filter(text => typeof text === 'string' && text.trim()))].join('\n');
    if (!/\p{Script=Han}/u.test(state.text)) state.text = '让生活，有一点艺术。\n' + state.text;
    if (!/[a-z]/i.test(state.text)) state.text += '\nMake room for good things.';
  }
  state.textMode = 'bilingual';
  delete state.textByLanguage;
  state.favorites = Array.isArray(state.favorites) ? state.favorites.filter(id => byId.has(id)) : [];
  state.axes = state.axes && typeof state.axes === 'object' ? state.axes : {};
  for (const [key, min, max] of [['size',16,160],['spacing',-2,20],['line',1,2.5]]) state[key] = Number.isFinite(Number(state[key])) ? Math.max(min,Math.min(max,Number(state[key]))) : defaults[key];
  for (const key of ['color','background']) if (!/^#[0-9a-f]{6}$/i.test(state[key])) state[key] = defaults[key];
  if (!['left','center','right'].includes(state.align)) state.align = 'left';
  let category = '全部', favoritesOnly = false, search = '', activeVariant = null, activeCoverage = null, activeFace = null;
  let generation = 0, saveTimer, loadTimer, noticeTimer, toastTimer;
  const cache = new Map(), pending = new Map();
  const previewCoverage = unpackCoverage(catalog.previewCoveragePacked);
  const diskCache = window.caches ? caches.open('cropper-font-previews-v1').catch(() => null) : Promise.resolve(null);

  function unpackCoverage(packed) {
    const bytes = atob(packed), ranges = [];
    let previous = 0, value = 0, shift = 0, start = null;
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes.charCodeAt(i); value += (byte & 127) * 2 ** shift;
      if (byte & 128) { shift += 7; continue; }
      if (start === null) start = previous + value;
      else { ranges.push([start, start + value]); previous = start + value + 1; start = null; }
      value = 0; shift = 0;
    }
    return ranges;
  }
  function coverage(v) { return v.coverage ||= unpackCoverage(catalog.coverages[v.coverageIndex]); }
  function includesCode(ranges, code) {
    let lo = 0, hi = ranges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1, range = ranges[mid];
      if (code < range[0]) hi = mid - 1;
      else if (code > range[1]) lo = mid + 1;
      else return true;
    }
    return false;
  }
  function needsFullFont(v) {
    return v.preview && [...state.text].some(c => includesCode(coverage(v), c.codePointAt(0)) && !includesCode(previewCoverage, c.codePointAt(0)));
  }
  function cancelUnused(v) {
    const full = needsFullFont(v);
    for (const [key, request] of pending) {
      if (key === v.id + ':preview' || (full || !v.preview) && key === v.id + ':full') continue;
      request.controller.abort(); pending.delete(key);
    }
  }
  const preview = $('previewText');
  preview.value = state.text;

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch {} }, 160);
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(() => $('toast').hidden = true, 2200);
  }
  function family() { return byId.get(state.family); }
  function chosenVariant(f = family()) {
    return f.variants.find(v => v.id === state.variant) || f.variants.find(v => v.weight === 400 && !v.label.includes('斜体')) || f.variants[0];
  }
  function renderCategories() {
    $('categories').replaceChildren();
    for (const name of ['全部','黑体','宋体','标题','圆体','手写','书法','英文']) {
      const b = document.createElement('button'); b.textContent = name;
      b.classList.toggle('active', category === name); b.setAttribute('aria-pressed', String(category === name));
      b.onclick = () => { category = name; renderCategories(); renderList(); };
      $('categories').append(b);
    }
  }
  function renderList() {
    const selected = families.filter(f => (category === '全部' || f.category === category) && (!favoritesOnly || state.favorites.includes(f.id)) && (!search || `${f.name} ${f.publisher} ${f.category}`.toLowerCase().includes(search)));
    $('fontList').replaceChildren();
    for (const f of selected) {
      const button = document.createElement('button'); button.className = 'font-option'; button.dataset.family = f.id;
      button.classList.toggle('active', f.id === state.family); button.setAttribute('aria-current', f.id === state.family ? 'true' : 'false'); button.setAttribute('aria-label', f.name);
      const words = document.createElement('span'), name = document.createElement('span'), meta = document.createElement('span'), arrow = document.createElement('span');
      name.className = 'font-option-name'; name.textContent = f.name;
      meta.className = 'font-option-meta'; meta.textContent = `${f.category} · ${f.variants.length > 1 ? f.variants.length+' 种样式' : f.variants[0].axes.length ? '可变字体' : '单字重'}${state.favorites.includes(f.id) ? ' · 已收藏' : ''}`;
      arrow.className = 'font-option-arrow'; arrow.textContent = '↗'; arrow.setAttribute('aria-hidden','true');
      words.append(name,meta); button.append(words,arrow);
      button.onclick = () => { if (state.family !== f.id) { state.family = f.id; state.variant = ''; updateListSelection(); updateSelection(); } };
      $('fontList').append(button);
    }
    $('resultCount').textContent = `${selected.length} 款字体`;
    $('emptyState').hidden = selected.length > 0;
    $('favoriteCount').textContent = state.favorites.length;
  }
  function updateListSelection() {
    // Keep the clicked button, keyboard focus and list scroll position intact.
    for (const button of $('fontList').children) {
      const selected = button.dataset.family === state.family;
      if (button.getAttribute('aria-current') === String(selected)) continue;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-current', selected ? 'true' : 'false');
    }
  }
  function readyEntry(v) {
    const key = cache.has(v.id + ':full') ? v.id + ':full' : !needsFullFont(v) ? v.id + ':preview' : null;
    const entry = cache.get(key);
    if (entry) { cache.delete(key); cache.set(key, entry); }
    return entry;
  }
  function finishActivation() {
    $('loadError').hidden = true;
    $('loadStatus').textContent = '字形已就绪'; preview.setAttribute('aria-busy','false');
    pruneCache();
  }
  function updateSelection() {
    const f = family(), v = chosenVariant(f); state.variant = v.id;
    preview.placeholder = '输入中英文，预览字体 / Type here to preview…';
    $('fontName').textContent = f.name;
    $('fontCategory').textContent = f.english ? '英文与数字 / LATIN TYPE' : `${f.category} / 中文字体`;
    $('fontDescription').textContent = `${f.variants.length} 种样式 · ${f.english ? '英文使用当前字体，中文由系统字体补齐' : '中英文一起预览 · 点击下方文字，直接编辑'}${f.name.includes('阿里妈妈') ? ' · 版权所有人阿里妈妈' : ''}`;
    $('variantSelect').replaceChildren();
    for (const item of f.variants) { const option = new Option(item.label,item.id); option.selected = item.id === v.id; $('variantSelect').add(option); }
    $('variantSelect').disabled = f.variants.length === 1;
    updateFavorite(); renderAxes(v);
    const token = ++generation;
    cancelUnused(v);
    $('loadError').hidden = true;
    clearTimeout(loadTimer); clearTimeout(noticeTimer);
    const entry = readyEntry(v);
    if (entry) {
      showFace(v, entry); finishActivation();
    } else {
      $('loadStatus').textContent = '正在加载字形…';
      preview.setAttribute('aria-busy','true');
      // Debounce only uncached downloads when users quickly browse the list.
      loadTimer = setTimeout(() => activate(v, token), 60);
    }
    persist();
  }
  function updateFavorite() {
    const on = state.favorites.includes(state.family);
    $('favoriteButton').setAttribute('aria-pressed',String(on)); $('favoriteButton').textContent = on ? '已收藏' : '收藏字体';
  }
  function renderAxes(v) {
    $('variableControls').replaceChildren(); $('variableControls').hidden = !v.axes.length;
    for (const axis of v.axes) {
      const label = document.createElement('label'), range = document.createElement('input'), output = document.createElement('output');
      const alias = {wght:'字重',wdth:'字宽',slnt:'倾斜',ital:'斜体',BEVL:'圆角',bevl:'圆角',BVEL:'圆角'};
      label.append(document.createTextNode(alias[axis.tag] || axis.name)); range.type = 'range'; range.min = axis.min; range.max = axis.max; range.step = (axis.max-axis.min) <= 2 ? .01 : 1;
      range.setAttribute('aria-label',`可变字体${alias[axis.tag] || axis.name}`);
      const key = `${v.id}:${axis.tag}`;
      range.value = Number.isFinite(Number(state.axes[key])) ? Math.max(axis.min,Math.min(axis.max,Number(state.axes[key]))) : (axis.tag === 'wght' ? Math.max(axis.min,Math.min(axis.max,500)) : axis.default);
      state.axes[key] = Number(range.value); output.textContent = range.value;
      range.oninput = () => { state.axes[key] = Number(range.value); output.textContent = range.value; applyAxes(); persist(); };
      label.append(range,output); $('variableControls').append(label);
    }
  }
  function applyAxes() {
    // Apply only to the loaded face; a slower previous request must never restyle the current face.
    const v = activeVariant;
    preview.style.fontVariationSettings = v?.axes.length ? v.axes.map(a => `"${a.tag}" ${state.axes[`${v.id}:${a.tag}`] ?? a.default}`).join(', ') : 'normal';
  }
  function loadFont(v, full = false) {
    const asset = !full && v.preview ? v.preview : v;
    const key = v.id + (asset === v ? ':full' : ':preview');
    if (cache.has(key)) {
      const entry = cache.get(key); cache.delete(key); cache.set(key, entry);
      return Promise.resolve(entry);
    }
    if (pending.has(key)) return pending.get(key).promise;
    const controller = new AbortController();
    const request = {controller};
    request.promise = (async () => {
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const disk = asset === v.preview ? await diskCache : null;
        let response = await disk?.match(asset.url).catch(() => null);
        if (!response) {
          response = await fetch(asset.url, {signal:controller.signal});
          if (!response.ok) throw new Error('字体下载失败');
          if (disk) {
            // Font filenames are immutable; a denied/full browser cache is non-fatal.
            disk.put(asset.url, response.clone()).catch(() => {});
          }
        }
        const bytes = await response.arrayBuffer();
        controller.signal.throwIfAborted();
        const face = new FontFace(`preview-${v.id}-${asset === v ? 'full' : 'common'}`, bytes, {style:'normal',weight:'400'});
        await face.load(); controller.signal.throwIfAborted(); document.fonts.add(face);
        const entry = {face, bytes:bytes.byteLength, variantId:v.id}; cache.set(key,entry);
        return entry;
      } finally {
        clearTimeout(timeout);
        if (pending.get(key) === request) pending.delete(key);
      }
    })();
    pending.set(key,request);
    return request.promise;
  }
  function showFace(v, entry) {
    activeVariant = v; activeCoverage = coverage(v); activeFace = entry.face;
    preview.style.fontFamily = `"${entry.face.family}", "PingFang SC", "Microsoft YaHei", sans-serif`;
    preview.dataset.fontId = v.id; applyAxes();
    $('paperFontName').textContent = `${family().name} / ${v.label}`;
    updateMissingGlyphs();
  }
  async function activate(v, token) {
    if (token !== generation) return;
    try {
      // Reuse a full face if already loaded, otherwise show common glyphs first.
      const cachedFull = cache.get(v.id + ':full');
      let entry = cachedFull || await loadFont(v);
      if (token !== generation) { pruneCache(); return; }
      showFace(v, entry);
      if (!cachedFull && needsFullFont(v)) {
        $('loadStatus').textContent = '常用字已显示，正在补全字形…';
        entry = await loadFont(v, true);
        if (token !== generation) { pruneCache(); return; }
        showFace(v, entry);
      }
      finishActivation();
    } catch {
      if (token !== generation) return;
      preview.setAttribute('aria-busy','false'); $('loadStatus').textContent = '加载失败';
      $('paperFontName').textContent = activeVariant?.id === v.id ? '部分字形暂未加载' : activeVariant ? '暂时保留上一个字体' : '暂时显示系统字体';
      $('loadError').querySelector('span').textContent = '这款字体暂时无法完整加载，请检查网络后重试，或尝试其他字重。'; $('loadError').hidden = false;
    }
  }
  function pruneCache() {
    let bytes = [...cache.values()].reduce((sum, entry) => sum + entry.bytes, 0);
    for (const [key,entry] of cache) {
      if (bytes <= 64 * 1024 * 1024) break;
      if (entry.variantId === activeVariant?.id || entry.variantId === state.variant) continue;
      document.fonts.delete(entry.face); cache.delete(key); bytes -= entry.bytes;
    }
  }
  function supported(code) { return includesCode(activeCoverage, code); }
  function updateMissingGlyphs() {
    if (!activeCoverage || activeVariant?.id !== state.variant) return;
    const missing = [...new Set([...state.text].filter(c => !/\s/u.test(c) && !/[\u200c\u200d\ufe0e\ufe0f]/u.test(c) && !supported(c.codePointAt(0))))];
    $('glyphNotice').hidden = missing.length === 0;
    if (missing.length) $('glyphNotice').textContent = `${family().english ? '这款字体主要支持英文和数字。' : ''}以下字符将由系统字体补齐，不属于当前字体字形：${missing.slice(0,18).join(' ')}${missing.length>18 ? ` 等 ${missing.length} 个字符` : ''}`;
  }
  function applyStyle() {
    for (const [id,key] of [['fontSize','size'],['letterSpacing','spacing'],['lineHeight','line']]) { $(id).value=state[key]; $(id+'Value').textContent=state[key]; }
    $('textColor').value=state.color; $('backgroundColor').value=state.background;
    Object.assign(preview.style,{fontSize:state.size+'px',letterSpacing:state.spacing+'px',lineHeight:state.line,color:state.color,textAlign:state.align});
    $('paper').style.backgroundColor = state.background;
    // Keep canvas helper labels legible on a dark user-selected background.
    const rgb = state.background.slice(1).match(/../g).map(s=>parseInt(s,16));
    const dark = rgb[0]*.299+rgb[1]*.587+rgb[2]*.114 < 128;
    for (const el of [$('paper').querySelector('.paper-caption'),$('paper').querySelector('.paper-bottom'),$('loadStatus')]) el.style.color = dark ? '#c3cbbf' : '';
    document.querySelectorAll('[data-align]').forEach(b=>{ const on=b.dataset.align===state.align; b.classList.toggle('active',on); b.setAttribute('aria-pressed',String(on)); });
  }
  function textChanged() {
    state.text=preview.value;
    $('characterCount').textContent = `${[...state.text].filter(c=>c!=='\n').length} 个字符`;
    clearTimeout(noticeTimer);
    const v = chosenVariant(), token = ++generation;
    cancelUnused(v); clearTimeout(loadTimer);
    const entry = readyEntry(v);
    if (entry) {
      if (activeVariant?.id !== v.id || activeFace !== entry.face) showFace(v, entry);
      else updateMissingGlyphs();
      finishActivation();
    } else {
      preview.setAttribute('aria-busy','true'); $('loadError').hidden = true;
      $('loadStatus').textContent = '正在加载字形…';
      noticeTimer = setTimeout(() => activate(v, token), 120);
    }
    persist();
  }
  $('fontSearch').oninput = e => { search=e.target.value.trim().toLowerCase(); renderList(); };
  function setScope(onlyFavorites) { favoritesOnly=onlyFavorites; for(const [id,on] of [['allTab',!onlyFavorites],['favoritesTab',onlyFavorites]]) { $(id).classList.toggle('active',on); $(id).setAttribute('aria-pressed',String(on)); } renderList(); }
  $('allTab').onclick=()=>setScope(false); $('favoritesTab').onclick=()=>setScope(true);
  $('clearFilters').onclick=()=>{category='全部';search='';$('fontSearch').value='';setScope(false);renderCategories();};
  $('favoriteButton').onclick=()=>{const id=state.family;state.favorites=state.favorites.includes(id)?state.favorites.filter(v=>v!==id):[...state.favorites,id];updateFavorite();renderList();persist();};
  $('variantSelect').onchange=e=>{state.variant=e.target.value;updateSelection();};
  $('retryFont').onclick=updateSelection;
  preview.addEventListener('input',textChanged);
  for (const [id,key] of [['fontSize','size'],['letterSpacing','spacing'],['lineHeight','line']]) $(id).oninput=e=>{state[key]=Number(e.target.value);applyStyle();persist();};
  for (const [id,key] of [['textColor','color'],['backgroundColor','background']]) $(id).oninput=e=>{state[key]=e.target.value;applyStyle();persist();};
  document.querySelectorAll('[data-align]').forEach(b=>b.onclick=()=>{state.align=b.dataset.align;applyStyle();persist();});
  $('resetStyle').onclick=()=>{for(const key of ['size','spacing','line','color','background','align'])state[key]=defaults[key];state.axes={};renderAxes(chosenVariant());applyAxes();applyStyle();persist();toast('排版样式已重置');};
  document.querySelectorAll('[data-sample]').forEach(b=>b.onclick=()=>{preview.value=samples[b.dataset.sample];textChanged();});
  $('clearText').onclick=()=>{preview.value='';textChanged();preview.focus();};
  function formattedText() {
    const v = activeVariant;
    // Export real installed-font names, never this page's temporary preview ID.
    const quoteFamily = name => '"' + name.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n\f]/g, ' ') + '"';
    const block = document.createElement('div');
    const axisValue = tag => v.axes.some(a => a.tag === tag) ? state.axes[`${v.id}:${tag}`] : undefined;
    Object.assign(block.style, {
      fontFamily: [...(v.fontFamilies || [family().name]), 'PingFang SC', 'Microsoft YaHei'].map(quoteFamily).join(', ') + ', sans-serif',
      fontSize: state.size+'px', fontWeight: String(axisValue('wght') ?? v.fontWeight ?? v.weight),
      fontStyle: v.fontItalic ? 'italic' : 'normal', fontVariationSettings: preview.style.fontVariationSettings,
      letterSpacing: state.spacing+'px', lineHeight: String(state.line),
      color: state.color, backgroundColor: state.background, textAlign: state.align,
      whiteSpace: 'pre-wrap', margin: '0'
    });
    if (axisValue('wdth') !== undefined) block.style.fontStretch = axisValue('wdth')+'%';
    preview.value.split('\n').forEach((line, index) => {
      if (index) block.append(document.createElement('br'));
      block.append(document.createTextNode(line));
    });
    return block.outerHTML;
  }
  function copyFormattedFallback(html, plain) {
    const active = document.activeElement;
    const start = preview.selectionStart, end = preview.selectionEnd;
    const selection = window.getSelection();
    const ranges = Array.from({length: selection.rangeCount}, (_, i) => selection.getRangeAt(i).cloneRange());
    const helper = document.createElement('div');
    helper.contentEditable = 'true'; helper.tabIndex = -1;
    Object.assign(helper.style, {position:'fixed',left:'-10000px',top:'0'});
    helper.innerHTML = html; document.body.append(helper);
    let supplied = false;
    const onCopy = event => {
      if (!event.clipboardData) return;
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', plain);
      event.preventDefault(); supplied = true;
    };
    document.addEventListener('copy', onCopy);
    try {
      helper.focus({preventScroll:true});
      const range = document.createRange(); range.selectNodeContents(helper);
      selection.removeAllRanges(); selection.addRange(range);
      return document.execCommand('copy') && supplied;
    } finally {
      document.removeEventListener('copy', onCopy); helper.remove();
      selection.removeAllRanges(); ranges.forEach(range => selection.addRange(range));
      active?.focus({preventScroll:true}); preview.setSelectionRange(start,end);
    }
  }
  $('copyButton').onclick=async()=>{
    if(!preview.value) {toast('先输入一点文字吧');return;}
    if (preview.getAttribute('aria-busy') === 'true' || activeVariant?.id !== state.variant || !$('loadError').hidden) {
      toast('请等当前字体加载成功后再复制'); return;
    }
    const html = formattedText(), plain = preview.value;
    $('copyButton').disabled = true;
    try {
      let copied = false;
      if (navigator.clipboard?.write && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([new ClipboardItem({
            'text/html': new Blob([html], {type:'text/html'}),
            'text/plain': new Blob([plain], {type:'text/plain'})
          })]);
          copied = true;
        } catch { /* Older browsers and local-file contexts can use the copy event. */ }
      }
      if (!copied) copied = copyFormattedFallback(html, plain);
      toast(copied ? '已复制带格式文字，请在目标软件中保留源格式粘贴' : '复制失败，请允许浏览器访问剪贴板后重试');
    } catch { toast('复制失败，请允许浏览器访问剪贴板后重试'); }
    finally { $('copyButton').disabled = false; }
  };
  $('helpButton').onclick=()=>$('helpDialog').showModal(); $('closeHelp').onclick=()=>$('helpDialog').close();
  $('helpDialog').onclick=e=>{if(e.target===$('helpDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}};
  addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('fontSearch').focus();}});
  $('familyCount').textContent=families.length; $('styleCount').textContent=`${catalog.variantCount} 种字形样式`;
  renderCategories();renderList();applyStyle();textChanged();updateSelection();
})();
