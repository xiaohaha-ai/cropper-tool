(() => {
  'use strict';
  window.lucide?.createIcons();
  const toggle = document.getElementById('homeThemeToggle');
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const label = dark ? '切换至亮色主题' : '切换至暗色主题';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-pressed', String(dark));
    toggle.title = label;
  }
  toggle.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('image-cropper-theme', theme); } catch {}
    updateThemeButton();
  });
  updateThemeButton();
  function updateRecent() {
    const list = document.getElementById('recentLinks');
    list.replaceChildren();
    const entries = [];
    for (const [id, name, href] of [['lego', '积木拼搭', 'lego/'], ['layout', '图文排版', 'layout/']]) {
      try {
        const item = JSON.parse(localStorage.getItem('creative-tool-recent:' + id));
        if (item && typeof item.title === 'string' && Number.isFinite(item.updatedAt)) entries.push({...item, name, href});
      } catch {}
    }
    for (const item of entries.sort((a,b)=>b.updatedAt-a.updatedAt)) {
      const a=document.createElement('a'),title=document.createElement('strong'),meta=document.createElement('span');
      a.href=item.href; title.textContent=item.title || '未命名作品';
      meta.textContent=item.name + ' · ' + new Date(item.updatedAt).toLocaleString('zh-CN',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
      a.append(title,meta);list.append(a);
    }
    document.getElementById('recentWork').hidden=!entries.length;
  }
  updateRecent();
  window.addEventListener('pageshow',updateRecent);
  window.addEventListener('storage',updateRecent);
  if ('serviceWorker'  in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
