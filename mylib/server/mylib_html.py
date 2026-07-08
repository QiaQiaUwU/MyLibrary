# -*- coding: utf-8 -*-
"""前端 HTML — 独立文件方便维护"""

HTML = r'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MyLibrary · 我的图书馆</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
  :root {
    --paper: #f4ede0;
    --paper-deep: #ebe0cc;
    --paper-light: #faf5e8;
    --ink: #2a2118;
    --ink-soft: #5a4a36;
    --accent: #8b2a2a;
    --accent-soft: #b85c5c;
    --gold: #b8893d;
    --border: #c9b896;
    --shadow: rgba(60, 40, 20, 0.15);
    --green: #5a7d4f;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: var(--paper); color: var(--ink); }
  body {
    font-family: "Noto Serif SC", "Songti SC", "宋体", serif;
    font-size: 15px; line-height: 1.6;
    background-image:
      radial-gradient(circle at 20% 20%, rgba(184, 137, 61, 0.04) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(139, 42, 42, 0.03) 0%, transparent 50%);
    min-height: 100vh;
  }
  button, input, select { font-family: inherit; }

  header {
    padding: 32px 40px 24px;
    border-bottom: 1px double var(--border);
    background: linear-gradient(180deg, var(--paper-deep) 0%, var(--paper) 100%);
    position: relative;
  }
  header::after {
    content: ""; position: absolute; bottom: -1px; left: 0; right: 0; height: 3px;
    background: repeating-linear-gradient(90deg, var(--gold) 0, var(--gold) 8px, transparent 8px, transparent 16px);
    opacity: 0.3;
  }
  .header-inner { max-width: 1500px; margin: 0 auto; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 16px; }
  h1 {
    font-family: "Cormorant Garamond", "Noto Serif SC", serif;
    font-size: 42px; font-weight: 600; letter-spacing: -0.5px;
  }
  h1 .zh { font-family: "Noto Serif SC", serif; font-size: 28px; margin-left: 12px; color: var(--accent); font-weight: 500; }
  .stats-strip {
    display: flex; gap: 24px; font-family: "JetBrains Mono", monospace; font-size: 12px;
  }
  .stats-strip .stat .num { font-size: 22px; color: var(--accent); font-family: "Cormorant Garamond", serif; font-weight: 600; }
  .stats-strip .stat .lbl { color: var(--ink-soft); text-transform: uppercase; letter-spacing: 1px; }

  main { max-width: 1500px; margin: 0 auto; padding: 24px 40px 60px; display: grid; grid-template-columns: 260px 1fr; gap: 28px; }

  /* === LEFT SIDEBAR === */
  aside { position: sticky; top: 16px; align-self: start; max-height: calc(100vh - 32px); overflow-y: auto; padding-right: 6px; }
  aside::-webkit-scrollbar { width: 6px; }
  aside::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  .filter-group { margin-bottom: 22px; }
  .filter-title {
    font-family: "Cormorant Garamond", serif; font-style: italic; font-size: 13px;
    color: var(--gold); text-transform: uppercase; letter-spacing: 2px;
    border-bottom: 1px solid var(--border); padding-bottom: 5px; margin-bottom: 8px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .filter-title .toggle { font-size: 14px; cursor: pointer; color: var(--ink-soft); }
  .filter-list { list-style: none; max-height: 280px; overflow-y: auto; }
  .filter-list::-webkit-scrollbar { width: 4px; }
  .filter-list::-webkit-scrollbar-thumb { background: var(--border); }
  .filter-item {
    padding: 3px 8px; cursor: pointer; font-size: 13px; color: var(--ink-soft);
    display: flex; justify-content: space-between; align-items: center;
    border-left: 2px solid transparent; transition: all 0.12s;
  }
  .filter-item:hover { color: var(--ink); background: var(--paper-deep); }
  .filter-item.active { color: var(--accent); border-left-color: var(--accent); font-weight: 500; background: var(--paper-deep); }
  .filter-item .cnt { font-family: "JetBrains Mono", monospace; font-size: 10px; color: var(--ink-soft); }

  .quick-filters { display: flex; flex-direction: column; gap: 4px; margin-bottom: 4px; }
  .quick-filter {
    padding: 6px 10px; background: var(--paper-light); border: 1px solid var(--border);
    color: var(--ink); cursor: pointer; font-size: 13px; text-align: left;
  }
  .quick-filter.active { background: var(--accent); color: white; border-color: var(--accent); }
  .quick-filter .c { font-family: monospace; font-size: 11px; opacity: .7; float: right; }

  .clear-filters {
    width: 100%; padding: 6px; font-size: 12px; background: none;
    border: 1px dashed var(--border); color: var(--ink-soft); cursor: pointer; margin-top: 8px;
  }
  .clear-filters:hover { color: var(--accent); border-color: var(--accent); }

  /* === MAIN CONTENT === */
  .controls { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; flex-wrap: wrap; }
  .search-wrap { flex: 1; min-width: 240px; position: relative; }
  .search-wrap::before {
    content: "❦"; position: absolute; left: 14px; top: 50%; transform: translateY(-50%);
    color: var(--gold); font-size: 16px;
  }
  .search {
    width: 100%; padding: 10px 14px 10px 38px; font-size: 14px;
    background: var(--paper-light); border: 1px solid var(--border); color: var(--ink);
  }
  .search:focus { outline: none; border-color: var(--accent); }

  select {
    padding: 8px 12px; font-size: 13px; background: var(--paper-light);
    border: 1px solid var(--border); color: var(--ink);
  }

  .view-toggle { display: flex; border: 1px solid var(--border); }
  .view-toggle button {
    padding: 8px 14px; background: var(--paper-light); border: none;
    color: var(--ink-soft); cursor: pointer; font-size: 13px;
  }
  .view-toggle button.active { background: var(--accent); color: white; }

  .selected-tags {
    margin-bottom: 12px; display: flex; flex-wrap: wrap; gap: 6px;
    min-height: 28px; align-items: center;
  }
  .selected-tag {
    padding: 3px 10px 3px 12px; background: var(--accent); color: white;
    font-size: 12px; font-family: "JetBrains Mono", monospace; cursor: pointer;
  }
  .selected-tag::after { content: " ×"; margin-left: 6px; opacity: .7; }
  .selected-tag:hover::after { opacity: 1; }

  .result-count {
    font-family: "JetBrains Mono", monospace; font-size: 12px;
    color: var(--gold); margin-left: auto;
  }

  /* === GRID VIEW === */
  .book-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px;
  }
  .book-card {
    background: var(--paper-light); border: 1px solid var(--border); padding: 14px 16px;
    cursor: pointer; position: relative; transition: all 0.15s;
    box-shadow: 1px 1px 0 rgba(60, 40, 20, 0.04);
  }
  .book-card:hover {
    transform: translate(-1px, -1px); box-shadow: 3px 3px 0 rgba(60, 40, 20, 0.08);
    border-color: var(--accent-soft);
  }
  .book-card.fav::before {
    content: "❀"; position: absolute; top: 6px; right: 8px; color: var(--accent); font-size: 14px;
  }
  .book-card.read::after {
    content: "✓"; position: absolute; bottom: 8px; right: 10px; font-size: 12px;
    color: var(--green); font-weight: bold;
  }
  .book-title { font-size: 15px; font-weight: 500; margin-bottom: 4px; padding-right: 20px; line-height: 1.35; }
  .book-author { font-size: 12px; color: var(--accent); font-style: italic; margin-bottom: 6px; }
  .book-author::before { content: "— "; color: var(--gold); }
  .book-tags { display: flex; flex-wrap: wrap; gap: 3px; }
  .book-tag {
    font-size: 10px; padding: 1px 5px; background: var(--paper-deep);
    color: var(--ink-soft); font-family: "JetBrains Mono", monospace;
  }
  .book-meta { font-size: 10px; color: var(--ink-soft); margin-top: 6px; font-family: monospace; }

  /* === TABLE VIEW === */
  .book-table { width: 100%; border-collapse: collapse; font-size: 13px; background: var(--paper-light); }
  .book-table th {
    text-align: left; padding: 10px 12px; background: var(--paper-deep);
    font-weight: 500; border-bottom: 2px solid var(--ink); cursor: pointer;
  }
  .book-table td { padding: 8px 12px; border-bottom: 1px solid var(--border); }
  .book-table tr:hover { background: var(--paper-deep); cursor: pointer; }
  .book-table .ti { color: var(--ink); font-weight: 500; }
  .book-table .au { color: var(--accent); font-style: italic; }
  .book-table .tg { font-size: 11px; color: var(--ink-soft); }
  .book-table .mt { font-family: monospace; font-size: 11px; color: var(--ink-soft); }

  /* === MODAL === */
  .modal-bg {
    display: none; position: fixed; inset: 0; background: rgba(20, 14, 8, 0.55);
    z-index: 100; align-items: center; justify-content: center; padding: 20px;
    backdrop-filter: blur(3px);
  }
  .modal-bg.show { display: flex; }
  .modal {
    background: var(--paper); max-width: 720px; width: 100%; max-height: 88vh; overflow-y: auto;
    padding: 32px 36px; box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    border: 1px solid var(--border); position: relative;
  }
  .modal::before {
    content: ""; position: absolute; top: 8px; left: 8px; right: 8px; bottom: 8px;
    border: 1px solid var(--border); pointer-events: none;
  }
  .close {
    position: absolute; top: 12px; right: 16px; background: none; border: none;
    font-size: 26px; cursor: pointer; color: var(--ink-soft); z-index: 2;
  }
  .modal h2 {
    font-family: "Cormorant Garamond", "Noto Serif SC", serif; font-size: 26px;
    font-weight: 600; color: var(--accent); margin-bottom: 4px; padding-right: 30px;
  }
  .modal .raw-title { font-size: 12px; color: var(--ink-soft); font-style: italic; margin-bottom: 18px; }

  .modal-actions { display: flex; gap: 8px; margin: 14px 0 18px; flex-wrap: wrap; }
  .modal-actions button {
    padding: 8px 16px; font-size: 13px; background: var(--paper-light);
    border: 1px solid var(--border); color: var(--ink); cursor: pointer;
  }
  .modal-actions button:hover { background: var(--accent); color: white; border-color: var(--accent); }
  .modal-actions button.primary { background: var(--accent); color: white; border-color: var(--accent); }
  .modal-actions button.primary:hover { background: var(--ink); border-color: var(--ink); }
  .modal-actions button.toggle.on { background: var(--gold); color: white; border-color: var(--gold); }

  .modal-row { display: flex; gap: 12px; padding: 6px 0; font-size: 13px; }
  .modal-row .k { font-weight: 500; color: var(--gold); min-width: 80px; }
  .modal-row .v { color: var(--ink); flex: 1; word-break: break-all; }

  .modal-section { margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--border); }
  .modal-section h3 {
    font-size: 12px; color: var(--gold); text-transform: uppercase;
    letter-spacing: 1.5px; margin-bottom: 10px; font-weight: 500;
  }

  .tag-edit { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag-pill {
    padding: 3px 10px; background: var(--paper-deep); border: 1px solid var(--border);
    font-size: 12px; font-family: monospace; cursor: pointer;
  }
  .tag-pill::after { content: " ×"; opacity: .5; }
  .tag-pill:hover::after { opacity: 1; color: var(--accent); }
  .tag-pill.genre { background: var(--accent); color: white; border-color: var(--accent); }
  .tag-pill.shelf { background: var(--gold); color: white; border-color: var(--gold); }
  .tag-input {
    padding: 3px 8px; font-size: 12px; background: var(--paper-light);
    border: 1px solid var(--border); width: 100px;
  }

  .note-card {
    background: var(--paper-deep); padding: 12px 14px; margin-bottom: 8px;
    border-left: 3px solid var(--accent); font-size: 13px; line-height: 1.7;
  }
  .note-card .meta { font-family: monospace; font-size: 10px; color: var(--ink-soft); margin-bottom: 6px; }
  .note-card .original { color: var(--ink); white-space: pre-wrap; }
  .note-card .my-note { margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border); color: var(--accent); }

  .user-notes-input {
    width: 100%; min-height: 80px; padding: 10px 12px; font-family: inherit; font-size: 13px;
    background: var(--paper-light); border: 1px solid var(--border); color: var(--ink); resize: vertical;
  }

  .load-more {
    width: 100%; padding: 14px; margin: 24px 0; border: 1px dashed var(--border);
    background: none; color: var(--ink-soft); cursor: pointer; font-family: inherit; font-size: 14px;
  }
  .load-more:hover { color: var(--accent); border-color: var(--accent); }

  .loading { text-align: center; padding: 60px; color: var(--ink-soft); font-style: italic; }

  @media (max-width: 900px) {
    main { grid-template-columns: 1fr; padding: 16px 20px; }
    aside { position: static; max-height: none; }
    .filter-list { max-height: 180px; }
    header { padding: 24px 20px 16px; }
    h1 { font-size: 32px; }
  }
</style>
</head>
<body>

<header>
  <div class="header-inner">
    <div>
      <h1>Bibliotheca <span class="zh">我的图书馆</span></h1>
    </div>
    <div class="stats-strip" id="stats-strip"></div>
  </div>
</header>

<main>
  <aside>
    <div class="filter-group">
      <div class="filter-title">快速筛选</div>
      <div class="quick-filters" id="quick-filters">
        <button class="quick-filter" data-q="all">全部 <span class="c" id="qc-all">0</span></button>
        <button class="quick-filter" data-q="fav">★ 收藏 <span class="c" id="qc-fav">0</span></button>
        <button class="quick-filter" data-q="read">✓ 已读 <span class="c" id="qc-read">0</span></button>
        <button class="quick-filter" data-q="unread">○ 未读 <span class="c" id="qc-unread">0</span></button>
        <button class="quick-filter" data-q="notes">✎ 有笔记 <span class="c" id="qc-notes">0</span></button>
      </div>
    </div>

    <div class="filter-group" id="fg-genre">
      <div class="filter-title">体裁 Genre</div>
      <ul class="filter-list" id="list-genre"></ul>
    </div>

    <div class="filter-group" id="fg-shelf">
      <div class="filter-title">收藏书架 Shelf</div>
      <ul class="filter-list" id="list-shelf"></ul>
    </div>

    <div class="filter-group" id="fg-author">
      <div class="filter-title">作者 (Top 80)</div>
      <ul class="filter-list" id="list-author"></ul>
    </div>

    <div class="filter-group" id="fg-tag">
      <div class="filter-title">其他标签</div>
      <ul class="filter-list" id="list-tag"></ul>
    </div>

    <button class="clear-filters" id="clear-all" style="display:none">✕ 清除所有筛选</button>
  </aside>

  <section>
    <div class="controls">
      <div class="search-wrap">
        <input type="text" class="search" id="search" placeholder="搜索书名 · 作者 · 标签 · 文件名…">
      </div>
      <select id="sort">
        <option value="import_desc">导入时间 ↓</option>
        <option value="title">书名</option>
        <option value="author">作者</option>
        <option value="size_desc">大小 ↓</option>
        <option value="words_desc">字数 ↓</option>
        <option value="read_time">阅读时长 ↓</option>
      </select>
      <div class="view-toggle">
        <button class="active" data-view="grid">卡片</button>
        <button data-view="table">表格</button>
      </div>
    </div>

    <div class="selected-tags" id="selected-tags">
      <span class="result-count" id="result-count"></span>
    </div>

    <div id="content"><div class="loading">加载中...</div></div>
  </section>
</main>

<div class="modal-bg" id="modal-bg">
  <div class="modal" id="modal-content"></div>
</div>

<script>
// ============================================================
// 状态
// ============================================================
let DATA = { books: [], tags: [] };
let TAG_INDEX = {};
let state = {
  view: 'grid',
  search: '',
  sort: 'import_desc',
  quickFilter: null,
  selectedTags: new Set(),  // 'kind:name' 格式
  page: 1,
  pageSize: 60,
  expand: { genre: true, shelf: true, author: false, tag: false },
};

// ============================================================
// 工具
// ============================================================
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

function fmtSize(n) {
  if (n < 1024) return n + 'B';
  if (n < 1024*1024) return (n/1024).toFixed(0) + 'KB';
  return (n/1024/1024).toFixed(1) + 'MB';
}

function fmtTime(ms) {
  if (!ms) return '';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h) return `${h}h${m}m`;
  return `${m}m`;
}

// ============================================================
// 加载数据
// ============================================================
async function loadData() {
  const res = await fetch('/api/library');
  DATA = await res.json();
  // 建标签索引
  TAG_INDEX = { genre: {}, shelf: {}, author: {}, tag: {} };
  DATA.tags.forEach(t => {
    if (!TAG_INDEX[t.k]) TAG_INDEX[t.k] = {};
    TAG_INDEX[t.k][t.n] = t.c;
  });
  // 作者也算一种隐式标签 (从 books 直接拉)
  TAG_INDEX.author = {};
  DATA.books.forEach(b => {
    if (b.a) TAG_INDEX.author[b.a] = (TAG_INDEX.author[b.a] || 0) + 1;
  });
  render();
}

// ============================================================
// 筛选 + 排序
// ============================================================
function filterBooks() {
  const q = state.search.toLowerCase().trim();
  return DATA.books.filter(b => {
    // quick filter
    if (state.quickFilter === 'fav' && !b.f) return false;
    if (state.quickFilter === 'read' && !b.r) return false;
    if (state.quickFilter === 'unread' && b.r) return false;
    if (state.quickFilter === 'notes' && !b.nc) return false;
    // selected tags (AND 逻辑)
    for (const sel of state.selectedTags) {
      const [kind, name] = sel.split(':');
      if (kind === 'author') {
        if (b.a !== name) return false;
      } else {
        const hasTag = b.tags.some(t => t.k === kind && t.n === name);
        if (!hasTag) return false;
      }
    }
    // search
    if (q) {
      const hay = (b.t + ' ' + (b.a||'') + ' ' + b.fp + ' ' +
                   b.tags.map(t => t.n).join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function sortBooks(arr) {
  const c = [...arr];
  const s = state.sort;
  switch (s) {
    case 'import_desc': return c.sort((a,b) => (b.it||'').localeCompare(a.it||''));
    case 'title': return c.sort((a,b) => a.t.localeCompare(b.t, 'zh'));
    case 'author': return c.sort((a,b) => (a.a||'~').localeCompare(b.a||'~', 'zh'));
    case 'size_desc': return c.sort((a,b) => b.s - a.s);
    case 'words_desc': return c.sort((a,b) => (b.wc||0) - (a.wc||0));
    case 'read_time': return c.sort((a,b) => (b.rms||0) - (a.rms||0));
  }
  return c;
}

// ============================================================
// 渲染
// ============================================================
function renderStats() {
  const total = DATA.books.length;
  const favs = DATA.books.filter(b => b.f).length;
  const read = DATA.books.filter(b => b.r).length;
  const notes = DATA.books.filter(b => b.nc).length;
  const tot_size = DATA.books.reduce((s,b) => s+b.s, 0);
  document.getElementById('stats-strip').innerHTML = `
    <div class="stat"><div class="num">${total}</div><div class="lbl">书目</div></div>
    <div class="stat"><div class="num">${Object.keys(TAG_INDEX.author).length}</div><div class="lbl">作者</div></div>
    <div class="stat"><div class="num">${favs}</div><div class="lbl">收藏</div></div>
    <div class="stat"><div class="num">${read}</div><div class="lbl">已读</div></div>
    <div class="stat"><div class="num">${notes}</div><div class="lbl">有笔记</div></div>
    <div class="stat"><div class="num">${(tot_size/1024/1024/1024).toFixed(1)}G</div><div class="lbl">大小</div></div>
  `;
  document.getElementById('qc-all').textContent = total;
  document.getElementById('qc-fav').textContent = favs;
  document.getElementById('qc-read').textContent = read;
  document.getElementById('qc-unread').textContent = total - read;
  document.getElementById('qc-notes').textContent = notes;
}

function renderFilterList(elId, kind, limit) {
  const ul = document.getElementById(elId);
  const items = Object.entries(TAG_INDEX[kind] || {})
    .sort((a,b) => b[1] - a[1]);
  const shown = limit ? items.slice(0, limit) : items;
  ul.innerHTML = shown.map(([name, count]) => {
    const sel = state.selectedTags.has(`${kind}:${name}`);
    return `<li class="filter-item ${sel?'active':''}" data-kind="${kind}" data-name="${esc(name)}">
      <span>${esc(name)}</span><span class="cnt">${count}</span>
    </li>`;
  }).join('') || `<li style="color:var(--ink-soft);font-size:12px;padding:4px 8px">— 暂无 —</li>`;
  ul.querySelectorAll('[data-kind]').forEach(el => {
    el.onclick = () => toggleTag(el.dataset.kind, el.dataset.name);
  });
}

function renderFilters() {
  renderFilterList('list-genre', 'genre');
  renderFilterList('list-shelf', 'shelf');
  renderFilterList('list-author', 'author', 80);
  renderFilterList('list-tag', 'tag');
  document.getElementById('clear-all').style.display =
    (state.selectedTags.size || state.quickFilter || state.search) ? 'block' : 'none';
}

function renderSelectedTags() {
  const container = document.getElementById('selected-tags');
  const tags = [...state.selectedTags].map(s => {
    const [k, n] = s.split(':');
    return `<span class="selected-tag" data-tag="${s}">${esc(n)}</span>`;
  }).join('');
  container.innerHTML = tags + `<span class="result-count" id="result-count"></span>`;
  container.querySelectorAll('[data-tag]').forEach(el => {
    el.onclick = () => {
      state.selectedTags.delete(el.dataset.tag);
      state.page = 1; render();
    };
  });
}

function renderContent() {
  const filtered = sortBooks(filterBooks());
  document.getElementById('result-count').textContent = `${filtered.length} / ${DATA.books.length}`;
  const c = document.getElementById('content');
  const slice = filtered.slice(0, state.page * state.pageSize);
  if (state.view === 'grid') {
    c.innerHTML = `<div class="book-grid">${slice.map(renderCard).join('')}</div>` +
      (slice.length < filtered.length ? `<button class="load-more" id="lm">展示更多 (${filtered.length - slice.length} 本)</button>` : '');
  } else {
    c.innerHTML = renderTable(slice) +
      (slice.length < filtered.length ? `<button class="load-more" id="lm">展示更多 (${filtered.length - slice.length} 本)</button>` : '');
  }
  c.querySelectorAll('[data-bid]').forEach(el => el.onclick = (e) => {
    // 表格中点链接不打开 modal
    if (e.target.tagName === 'A') return;
    openBook(parseInt(el.dataset.bid));
  });
  const lm = document.getElementById('lm');
  if (lm) lm.onclick = () => { state.page++; render(); };
}

function renderCard(b) {
  const tagsHtml = b.tags.slice(0, 4).map(t =>
    `<span class="book-tag">${esc(t.n)}</span>`).join('');
  const readMark = b.rms ? ` · 读过${fmtTime(b.rms)}` : '';
  return `<div class="book-card ${b.f?'fav':''} ${b.r?'read':''}" data-bid="${b.id}">
    <div class="book-title">${esc(b.t || '(无书名)')}</div>
    ${b.a ? `<div class="book-author">${esc(b.a)}</div>` : ''}
    <div class="book-tags">${tagsHtml}</div>
    <div class="book-meta">${fmtSize(b.s)} · .${b.e}${readMark}${b.nc ? ` · ${b.nc}笔记` : ''}</div>
  </div>`;
}

function renderTable(arr) {
  return `<table class="book-table"><thead>
    <tr><th>书名</th><th>作者</th><th>标签</th><th>大小</th><th>字数</th><th>状态</th></tr>
  </thead><tbody>${arr.map(b => `
    <tr data-bid="${b.id}">
      <td class="ti">${b.f?'★ ':''}${esc(b.t)}</td>
      <td class="au">${esc(b.a||'')}</td>
      <td class="tg">${b.tags.slice(0,3).map(t=>esc(t.n)).join(', ')}</td>
      <td class="mt">${fmtSize(b.s)}</td>
      <td class="mt">${(b.wc||0).toLocaleString()}</td>
      <td class="mt">${b.r?'✓':''}${b.nc?` ✎${b.nc}`:''}</td>
    </tr>`).join('')}</tbody></table>`;
}

function render() {
  renderStats();
  renderFilters();
  renderSelectedTags();
  renderContent();
}

// ============================================================
// 交互
// ============================================================
function toggleTag(kind, name) {
  const key = `${kind}:${name}`;
  if (state.selectedTags.has(key)) state.selectedTags.delete(key);
  else state.selectedTags.add(key);
  state.page = 1;
  render();
}

document.getElementById('search').oninput = (e) => {
  state.search = e.target.value; state.page = 1; render();
};
document.getElementById('sort').onchange = (e) => { state.sort = e.target.value; render(); };
document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => {
  document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  state.view = b.dataset.view; render();
});
document.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
  const q = b.dataset.q === 'all' ? null : b.dataset.q;
  state.quickFilter = state.quickFilter === q ? null : q;
  document.querySelectorAll('[data-q]').forEach(x => x.classList.remove('active'));
  if (state.quickFilter) b.classList.add('active');
  state.page = 1; render();
});
document.getElementById('clear-all').onclick = () => {
  state.selectedTags.clear();
  state.quickFilter = null;
  state.search = '';
  document.getElementById('search').value = '';
  document.querySelectorAll('[data-q]').forEach(x => x.classList.remove('active'));
  state.page = 1; render();
};

// ============================================================
// 详情 Modal
// ============================================================
async function openBook(id) {
  const res = await fetch(`/api/book?id=${id}`);
  const d = await res.json();
  if (d.error) { alert(d.error); return; }
  const b = d.book;
  const tagsHtml = d.tags.map(t =>
    `<span class="tag-pill ${t.kind}" data-name="${esc(t.name)}">${esc(t.name)}</span>`).join('');
  const notesHtml = d.notes.map(n => `
    <div class="note-card">
      <div class="meta">${n.note_time || ''} · 第${n.chapter}章 · ${n.source}</div>
      ${n.original ? `<div class="original">${esc(n.original)}</div>` : ''}
      ${n.my_note ? `<div class="my-note">${esc(n.my_note)}</div>` : ''}
      ${n.bookmark ? `<div class="my-note">书签: ${esc(n.bookmark)}</div>` : ''}
    </div>`).join('');
  const dupsHtml = d.duplicates.length ? `
    <div class="modal-section">
      <h3>历史副本 (${d.duplicates.length}) — 在隔离区 _quarantine</h3>
      ${d.duplicates.map(x => `
        <div style="font-size:12px;color:var(--ink-soft);margin-bottom:6px;font-family:monospace;">
          [${x.reason}] ${esc(x.original_path)} (${fmtSize(x.dup_size||0)})
        </div>`).join('')}
    </div>` : '';

  document.getElementById('modal-content').innerHTML = `
    <button class="close" onclick="closeModal()">×</button>
    <h2>${esc(b.title)}</h2>
    ${b.raw_title && b.raw_title !== b.title ? `<div class="raw-title">原: ${esc(b.raw_title)}</div>` : ''}

    <div class="modal-actions">
      <button class="primary" id="btn-open">📖 打开</button>
      <button id="btn-reveal">📁 显示文件</button>
      <button class="toggle ${b.is_read?'on':''}" id="btn-read">${b.is_read?'✓ 已读':'○ 未读'}</button>
      <button class="toggle ${b.is_favorite?'on':''}" id="btn-fav">${b.is_favorite?'★ 已收藏':'☆ 收藏'}</button>
    </div>

    <div class="modal-row"><span class="k">作者</span><span class="v">${esc(b.author || '未知')}</span></div>
    <div class="modal-row"><span class="k">文件</span><span class="v" style="font-family:monospace;font-size:11px">${esc(b.file_path)}</span></div>
    <div class="modal-row"><span class="k">大小</span><span class="v">${fmtSize(b.file_size)} (${b.word_count.toLocaleString()} 字)</span></div>
    <div class="modal-row"><span class="k">质量分</span><span class="v">${b.quality_score} (大值=更完整)</span></div>
    <div class="modal-row"><span class="k">编码</span><span class="v">${b.encoding}</span></div>
    <div class="modal-row"><span class="k">导入</span><span class="v">${b.import_time} · 来源: ${esc(b.source||'?')}</span></div>
    ${b.mrpro_used_ms ? `<div class="modal-row"><span class="k">备份阅读</span><span class="v">${fmtTime(b.mrpro_used_ms)} · ${b.mrpro_words.toLocaleString()}字 · ${b.mrpro_days}天</span></div>` : ''}

    <div class="modal-section">
      <h3>标签</h3>
      <div class="tag-edit" id="tag-edit">
        ${tagsHtml}
        <input class="tag-input" id="new-tag" placeholder="+ 添加标签">
      </div>
    </div>

    <div class="modal-section">
      <h3>我的笔记</h3>
      <textarea class="user-notes-input" id="user-notes" placeholder="写点什么…">${esc(b.user_notes||'')}</textarea>
    </div>

    ${d.notes.length ? `<div class="modal-section"><h3>阅读笔记/书签 (${d.notes.length})</h3>${notesHtml}</div>` : ''}
    ${dupsHtml}
  `;
  document.getElementById('modal-bg').classList.add('show');

  // 绑定
  document.getElementById('btn-open').onclick = () => fetch(`/api/open?id=${id}`).then(r=>r.json()).then(x => {
    if (x.error) alert('打开失败: ' + x.error);
  });
  document.getElementById('btn-reveal').onclick = () => fetch(`/api/reveal?id=${id}`).then(r=>r.json()).then(x => {
    if (x.error) alert(x.error);
  });
  document.getElementById('btn-read').onclick = async () => {
    await fetch('/api/update', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({id, is_read: b.is_read ? 0 : 1})});
    b.is_read = b.is_read ? 0 : 1;
    const bk = DATA.books.find(x => x.id === id); if (bk) bk.r = b.is_read;
    openBook(id); render();
  };
  document.getElementById('btn-fav').onclick = async () => {
    await fetch('/api/update', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({id, is_favorite: b.is_favorite ? 0 : 1})});
    b.is_favorite = b.is_favorite ? 0 : 1;
    const bk = DATA.books.find(x => x.id === id); if (bk) bk.f = b.is_favorite;
    openBook(id); render();
  };

  // 笔记自动保存 (失焦时)
  const noteInput = document.getElementById('user-notes');
  noteInput.onblur = async () => {
    if (noteInput.value !== b.user_notes) {
      await fetch('/api/update', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({id, user_notes: noteInput.value})});
      b.user_notes = noteInput.value;
      const bk = DATA.books.find(x => x.id === id); if (bk) bk.un = noteInput.value;
    }
  };

  // 标签删除
  document.querySelectorAll('#tag-edit .tag-pill').forEach(p => p.onclick = async () => {
    if (!confirm(`删除标签 "${p.dataset.name}"?`)) return;
    await fetch('/api/tag', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({id, action: 'remove', name: p.dataset.name})});
    await loadData(); openBook(id);
  });
  // 标签添加 (回车)
  document.getElementById('new-tag').onkeydown = async (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      await fetch('/api/tag', {method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({id, action: 'add', name: e.target.value.trim()})});
      e.target.value = '';
      await loadData(); openBook(id);
    }
  };
}

function closeModal() {
  document.getElementById('modal-bg').classList.remove('show');
}

document.getElementById('modal-bg').onclick = (e) => {
  if (e.target.id === 'modal-bg') closeModal();
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// 启动
loadData();
</script>
</body>
</html>
'''


