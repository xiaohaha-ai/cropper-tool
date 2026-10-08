(() => {
  const root = new URL('./', document.currentScript.src);
  const tools = [ ['cropper','裁切','cropper.html'], ['watermark','去水印','watermark.html'], ['fonts','免费字体库','fonts.html'], ['lego','积木拼搭','lego/'], ['layout','图文排版','layout/'] ];
  class ToolSwitcher extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) return;
      const current = this.getAttribute('current');
      const shadow = this.attachShadow({mode:'open'});
      shadow.innerHTML = `<style>
        :host{display:inline-block;position:relative;font:500 13px/1.5 system-ui,sans-serif;flex-shrink:0;color:var(--text,#171717)}
        *{box-sizing:border-box}details{position:relative}summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:10px;min-height:44px;padding:0 13px;border:1px solid var(--line,#d8d8d8);border-radius:6px;background:var(--ink-soft,#fff);white-space:nowrap}summary::-webkit-details-marker{display:none}summary::after{content:'⌄';font-size:16px}summary span{font-size:11px;color:var(--muted,#777)}
        summary:focus-visible,a:focus-visible{outline:2px solid var(--green,#171717);outline-offset:2px}nav{position:absolute;z-index:1000;top:calc(100% + 7px);left:0;width:190px;max-width:calc(100vw - 24px);padding:6px;border:1px solid var(--line,#ddd);border-radius:8px;background:var(--ink-soft,#fff);box-shadow:0 8px 28px #0002}nav a{display:flex;align-items:center;min-height:44px;padding:8px 12px;color:inherit;text-decoration:none;border-radius:4px}a:hover{background:var(--surface-selected,#eee)}a[aria-current]{font-weight:700;background:var(--surface-selected,#eee)}a[aria-current]::after{content:'✓';margin-left:auto}
        @media(max-width:450px){summary{gap:7px;padding:0 10px;font-size:12px}summary span{display:none}}
      </style><details><summary aria-label="切换工具"><strong></strong><span>切换工具</span></summary><nav aria-label="全部工具"></nav></details>`;
      shadow.querySelector('strong').textContent = tools.find(t=>t[0]===current)?.[1] || '切换工具';
      const nav = shadow.querySelector('nav');
      for(const [id,name,path] of tools){const a=document.createElement('a');a.href=new URL(path,root);a.textContent=name;if(id===current)a.setAttribute('aria-current','page');nav.append(a);}
      this.alignMenu=()=>{const right=this.getBoundingClientRect().left+190>innerWidth-12;nav.style.left=right?'auto':'0';nav.style.right=right?'0':'auto';};
      shadow.querySelector('summary').addEventListener('click',this.alignMenu);
      window.addEventListener('resize',this.alignMenu);
      this.alignMenu();
      this.closeOutside = event => {if(!event.composedPath().includes(this))shadow.querySelector('details').open=false;};
      this.closeEscape = event => {if(event.key==='Escape'&&shadow.querySelector('details').open){shadow.querySelector('details').open=false;shadow.querySelector('summary').focus();}};
      document.addEventListener('click',this.closeOutside);
      document.addEventListener('keydown',this.closeEscape);
    }
    disconnectedCallback(){window.removeEventListener('resize',this.alignMenu);document.removeEventListener('click',this.closeOutside);document.removeEventListener('keydown',this.closeEscape);}
  }
  customElements.define('tool-switcher',ToolSwitcher);
})();
