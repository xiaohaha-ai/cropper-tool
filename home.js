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
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
