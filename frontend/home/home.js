
// ===== 状态 =====
let DATA=[],GENRES={},view='author',editing=false,selected=new Set(),cart=new Set();
let tagInclude=new Set(),tagExclude=new Set(),TAG_TAXO=null,filterOpen=false;
let room='library';  // library=书房(全部) | shelf=书架(收藏+在读)
function switchRoom(r){
  room=r;
  document.querySelectorAll('.room').forEach(b=>b.classList.toggle('on',b.dataset.room===r));
  // 书房显示视图切换，书架隐藏（书架是固定的收藏+在读分区）
  document.getElementById('view-seg').style.display=(r==='library')?'flex':'none';
  if(editing)toggleEdit();
  searchKw='';const si=document.getElementById('search');if(si)si.value='';
  updateFilterSummary();render();
  window.scrollTo({top:0});
}
let searchKw='',history=[],SEARCH_RESULTS=null;
function findBook(bid){return DATA.find(x=>x.id===bid)||(SEARCH_RESULTS&&SEARCH_RESULTS.find(x=>x.id===bid))||null;}
const COVER_PALETTES={
  classic:['#7d5a4f','#4a5d6e','#5a6e4f','#6e4f5d','#4f6e6e','#6e5d4a','#544a6e','#7d6e4a'],
  morandi:['#a89687','#8fa0a8','#9aab93','#ab93a0','#93aba8','#aba893','#a0939c','#b0a890'],
  ink:['#5c4a42','#42505c','#4a5c46','#5c4250','#42565c','#5c5142','#494256','#574a52'],
  forest:['#5f7a52','#6a8458','#557048','#7a8a5e','#4e6b4a','#6b7a4e','#52704a','#797a4e'],
};
function getCoverPalette(){return localStorage.getItem('cover_palette')||'classic';}
function setCoverPalette(p){localStorage.setItem('cover_palette',p);if(typeof render==='function')render();renderCoverPalettes&&renderCoverPalettes();}
const COVERS=COVER_PALETTES.classic;
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function coverColor(t){const pal=COVER_PALETTES[getCoverPalette()]||COVER_PALETTES.classic;let h=0;for(let i=0;i<(t||'').length;i++)h=(h*31+t.charCodeAt(i))%pal.length;return pal[h];}
// 每本书在新标签页打开，主页功能可并行使用（看一本书的同时还能在主页找别的）
function openReader(bid,pos){
  // 打开就把这本标记为「在读」，自动进书架的在读分区（已读的不降级回在读）
  try{
    const b=findBook(bid);
    if(!b||(b.rstatus!=='finished')){
      fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:bid,reading_status:'reading'})}).catch(()=>{});
      if(b){b.rstatus='reading';b.reading=true;}
    }
  }catch(e){}
  const url='/reader?id='+bid+(pos?('&pos='+pos):'');
  // 独立窗口打开（popup=yes → 没有标签页/地址栏，像个单独的小软件），不是浏览器新标签页
  const w=Math.min((screen.availWidth||1280)-80,1200), h=Math.min((screen.availHeight||900)-60,1000);
  const dx=Math.max(0,((screen.availWidth||1280)-w)/2), dy=Math.max(0,((screen.availHeight||900)-h)/2);
  const feats=`popup=yes,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(dx)},top=${Math.round(dy)},resizable=yes,scrollbars=yes`;
  try{const win=window.open(url,'mylib_reader_'+bid,feats);if(!win){location.href=url;return;}win.focus();}catch(e){location.href=url;}
}
// 灵活的小窗弹出：居中、可缩放、带滚动条；被拦截就退回整页跳转
function popout(url,name,w,h){
  w=w||560;h=h||Math.min((screen.availHeight||900)-60,800);
  const dx=Math.max(0,((screen.availWidth||1280)-w)/2+(screen.availLeft||0));
  const dy=Math.max(0,((screen.availHeight||800)-h)/2+(screen.availTop||0));
  const feats=`popup=yes,width=${Math.round(w)},height=${Math.round(h)},left=${Math.round(dx)},top=${Math.round(dy)},resizable=yes,scrollbars=yes`;
  try{const win=window.open(url,name||'_blank',feats);if(!win){location.href=url;return null;}win.focus();return win;}catch(e){location.href=url;return null;}
}
// 收藏作者：把喜欢的作者置顶 + 标记，这样在书房（按作者）一眼就能看到
function getFavAuthors(){try{return new Set(JSON.parse(localStorage.getItem('fav_authors')||'[]'));}catch(e){return new Set();}}
function isFavAuthor(a){return getFavAuthors().has(a);}
function toggleFavAuthor(a,ev){if(ev){ev.stopPropagation();ev.preventDefault();}const s=getFavAuthors();if(s.has(a)){s.delete(a);toast('已取消收藏作者');}else{s.add(a);toast('已收藏作者 · 置顶');}localStorage.setItem('fav_authors',JSON.stringify([...s]));render();}
// 双击作者名 → 作者主页：把这位作者的全部作品（全库范围，不只已加载的）堆一起
function gotoAuthorPage(a,ev){
  if(ev){ev.stopPropagation();ev.preventDefault();}
  a=(a||'').trim(); if(!a||a==='佚名'||a==='未知')return;
  // 切回完整书库 + 按作者分组 + 清掉收藏/题材筛选，再按作者全库搜索 → 真正"她的全部作品"
  try{if(typeof switchRoom==='function')switchRoom('library');}catch(e){}
  view='author';
  try{document.querySelectorAll('#view-seg button').forEach(b=>b.classList.toggle('on',b.dataset.v==='author'));}catch(e){}
  try{tagInclude.clear();tagExclude.clear();if(typeof buildFilterPanel==='function')buildFilterPanel();if(typeof updateFilterSummary==='function')updateFilterSummary();}catch(e){}
  const si=document.getElementById('search'); if(si)si.value=a;
  searchKw=a; if(typeof runSearch==='function')runSearch(); else render();
  try{window.scrollTo(0,0);}catch(e){}
  toast('「'+a+'」的全部作品');
}

async function HOME_INIT(){
  loadSavedTheme();
  loadHistory();
  loadMyTags();
  loadHiddenTags();
  loadTaxoOverride();
  updateFabAvatar();
  // 独立小窗的"阅读历程"：不加载书架，直接开历程页（轻量，秒开）
  if(new URLSearchParams(location.search).get('journey')==='1'){
    document.documentElement.classList.add('journey-only');
    dismissBootSplash();
    registerPWA();
    try{openJourney();}catch(e){}
    return;
  }
  initQuillDrag();
  loadQuillFabPref();
  setTimeout(applyFeats,100);
  startBgTaskPoll();
  registerPWA();
  dismissBootSplash();
  const stage=document.getElementById('stage');
  // 先看 sessionStorage 缓存（从设置/阅读器返回时不重新加载，秒开）
  try{
    const cached=sessionStorage.getItem('shelf_cache');
    const cachedAt=parseInt(sessionStorage.getItem('shelf_cache_at')||'0');
    if(cached&&(Date.now()-cachedAt<600000)){  // 10分钟内
      DATA=JSON.parse(cached);
      loadCart();render();updateCart();bindGlobal();blBindControls();updateFilterSummary();
      // 后台静默刷新
      refreshShelfSilent();
      return;
    }
  }catch(e){}
  stage.innerHTML='<div class="loading"><div class="load-bar"><i id="load-fill"></i></div><div id="load-txt">正在打开书房…</div></div>';
  // 桌面端也走"先取第一页秒开、其余后台再取"：13 万本一次性拉全会把首屏卡很久（升级后强刷清了缓存就明显），分页后立刻能用。
  {
    try{
      const resp1=await fetch('/api/shelf?offset=0&limit=1200');
      if(resp1.status===503){showNoLib(stage);return;}
      const r1=await resp1.json();
      if(r1&&r1.error){stage.innerHTML='<div class="empty" style="line-height:1.7">加载失败<br><span style="font-size:13px;color:var(--ink-soft)">'+esc(r1.error)+'</span></div>';return;}
      DATA=mapShelfBooks(r1.books);
      loadCart();render();updateCart();bindGlobal();blBindControls();updateFilterSummary();
      const total=r1.total||DATA.length;
      if(total>DATA.length){
        toast('已先载入 '+DATA.length+' 本，其余后台加载中…',2000);
        loadRestOfShelf(DATA.length);
      }else{
        try{sessionStorage.setItem('shelf_cache',JSON.stringify(DATA));sessionStorage.setItem('shelf_cache_at',''+Date.now());}catch(e){}
      }
      return;
    }catch(e){ /* 分页失败就回退到下面的整页加载 */ }
  }
  try{
    const resp=await fetch('/api/shelf');
    if(resp.status===503){showNoLib(stage);return;}
    document.getElementById('load-fill').style.width='55%';
    document.getElementById('load-txt').textContent='整理书架…';
    const r=await resp.json();
    if(r&&r.error){stage.innerHTML='<div class="empty" style="line-height:1.7">加载失败<br><span style="font-size:13px;color:var(--ink-soft)">'+esc(r.error)+'</span></div>';return;}
    document.getElementById('load-fill').style.width='80%';
    DATA=mapShelfBooks(r.books);
    document.getElementById('load-fill').style.width='100%';
    try{sessionStorage.setItem('shelf_cache',JSON.stringify(DATA));sessionStorage.setItem('shelf_cache_at',''+Date.now());}catch(e){}
  }catch(e){stage.innerHTML='<div class="empty">加载失败，请检查服务</div>';return;}
  loadCart();render();updateCart();bindGlobal();blBindControls();updateFilterSummary();
  const total=DATA.length;
  setTimeout(()=>toast(`共 ${total.toLocaleString()} 本 · 长按封面可多选`,2600),500);
}
function showNoLib(stage){
  stage.innerHTML='<div class="empty">还没设置书库位置<br><span style="font-size:13px">点右上角「设置 → 图书馆」，填写你存书的文件夹（里面有 library.db 的那个），保存后回来刷新即可</span><br><a href="/settings" style="display:inline-block;margin-top:16px;padding:9px 20px;background:var(--accent);color:#fff;border-radius:8px;text-decoration:none">去设置</a></div>';
}
function mapShelfBooks(arr){
  return (arr||[]).map(b=>({
    id:b.id,t:b.t||'未命名',a:b.a||'佚名',
    fav:b.f===1,reading:b.rs==='reading',rstatus:b.rs||'',
    genres:b.g||[],g:(b.g&&b.g[0])||'未分类',
    wc:b.wc?(b.wc/10000).toFixed(0):0,rating:b.rt||0,
    progress:b.rs==='reading'?Math.min(99,Math.max(1,Math.round((b.rms||0)/3600000*8)||30)):0,
    c:coverColor(b.t),notes:b.nc||0,cover:b.cv===1,finished:b.fin===1,ongoing:b.fin===0,chapters:b.ch||0,extras:b.ex||0,
    lo:b.lo||'',
  }));
}
// 后台把剩余的书取回来并入（手机首屏分页用）。取完重渲染但尽量不打扰：搜索中/已滚动就不动，等下次操作自然纳入。
async function loadRestOfShelf(offset){
  try{
    const r=await (await fetch('/api/shelf?offset='+offset+'&limit=1000000')).json();
    if(r.books&&r.books.length){
      DATA=DATA.concat(mapShelfBooks(r.books));
      try{sessionStorage.setItem('shelf_cache',JSON.stringify(DATA));sessionStorage.setItem('shelf_cache_at',''+Date.now());}catch(e){}
      // 后台补齐后【总是】重排，保证全部书都出现（之前在书架页/已滚动时会漏掉→"加载不全"）；
      // 保留滚动位置、不在你正打字搜索时打断。
      const typing=document.activeElement&&document.activeElement.id==='search';
      if(!typing){const y=window.scrollY||0;render();window.scrollTo(0,y);}
    }
  }catch(e){}
}
// 后台静默刷新书架（用缓存秒开后，悄悄更新数据）
async function refreshShelfSilent(){
  try{
    const r=await (await fetch('/api/shelf')).json();
    DATA=mapShelfBooks(r.books);
    try{sessionStorage.setItem('shelf_cache',JSON.stringify(DATA));sessionStorage.setItem('shelf_cache_at',''+Date.now());}catch(e){}
  }catch(e){}
}

function sortFavFirst(books){
  // 完结的排前面，其次收藏的，让书架更整齐
  return[...books].sort((a,b)=>{
    const fa=a.finished?1:0, fb=b.finished?1:0;
    if(fb!==fa)return fb-fa;          // 完结优先
    const va=a.fav?1:0, vb=b.fav?1:0;
    return vb-va;                      // 再按收藏
  });
}
function filtered(){
  let list=(searchKw && SEARCH_RESULTS) ? SEARCH_RESULTS : DATA;
  if(searchKw){const k=searchKw.toLowerCase();list=list.filter(b=>(b.t+b.a).toLowerCase().includes(k));}
  if(tagInclude.size||tagExclude.size){
    list=list.filter(b=>{
      const gs=b.genres||[];
      for(const t of tagInclude)if(!gs.includes(t))return false;   // 必含
      for(const t of tagExclude)if(gs.includes(t))return false;    // 排除（排雷）
      return true;
    });
  }
  return list;
}
// 标签词库（分维度），首次拉一次
let TAXO_OVERRIDE={};
function loadTaxoOverride(){try{TAXO_OVERRIDE=JSON.parse(localStorage.getItem('mylib_taxo_override')||'{}')||{};}catch(e){TAXO_OVERRIDE={};}}
function saveTaxoOverride(){try{localStorage.setItem('mylib_taxo_override',JSON.stringify(TAXO_OVERRIDE||{}));}catch(e){}}
async function loadTaxo(){
  if(TAG_TAXO)return TAG_TAXO;
  try{const r=await (await fetch('/api/tags/taxonomy')).json();TAG_TAXO=r.groups||{};}catch(e){TAG_TAXO={};}
  return TAG_TAXO;
}
function tagState(t){return tagInclude.has(t)?'inc':(tagExclude.has(t)?'exc':'');}
// 点一下循环：不选 → 包含(+) → 排除(−) → 不选（仿晋江）
function cycleTag(t){
  if(tagInclude.has(t)){tagInclude.delete(t);tagExclude.add(t);}
  else if(tagExclude.has(t)){tagExclude.delete(t);}
  else{tagInclude.add(t);}
  buildFilterPanel();updateFilterSummary();render();
}
function clearTags(){tagInclude.clear();tagExclude.clear();buildFilterPanel();updateFilterSummary();render();}
function openFilter(){filterOpen=true;document.getElementById('tag-filter').classList.add('open');const fb=document.getElementById('filter-btn');if(fb)fb.classList.add('open');buildFilterPanel();}
function closeFilter(){filterOpen=false;document.getElementById('tag-filter').classList.remove('open');const fb=document.getElementById('filter-btn');if(fb)fb.classList.remove('open');}
function toggleFilter(){filterOpen?closeFilter():openFilter();}
// 顶部搜索框旁的“筛选”小结：显示已选了几个
function updateFilterSummary(){
  const el=document.getElementById('filter-sum');if(!el)return;
  const n=tagInclude.size+tagExclude.size;
  el.textContent=n?('已筛 '+n):'';
  el.style.display=n?'inline-flex':'none';
  const fb=document.getElementById('filter-btn');if(fb)fb.classList.toggle('on',n>0);
}
// 分类标签筛选面板（藏在搜索框里，点开才出现；按维度分组，不堆一起；两种分类下都能用）
async function buildFilterPanel(){
  const panel=document.getElementById('tag-filter');if(!panel)return;
  await loadTaxo();
  // 库里实际存在的标签 + 计数
  const cnt={};DATA.forEach(b=>(b.genres||[]).forEach(g=>{if(g&&g!=='未分类')cnt[g]=(cnt[g]||0)+1;}));
  const present=new Set(Object.keys(cnt));
  if(!present.size){panel.innerHTML='<div class="fp-empty">还没有标签。去管理页 AI 打标签，或在书详情里手动加标签。</div>';return;}
  // 按维度分组，只显示库里有的；其余归“其他”
  const used=new Set();
  let rows='';
  window._fpOpen=window._fpOpen||new Set();
  const rowHTML=(cat,chipsHTML,count)=>{
    const open=window._fpOpen.has(cat);
    const ce=cat.replace(/'/g,"\\'");
    return `<div class="fp-row${open?'':' collapsed'}" data-cat="${esc(cat)}" ondragover="fpDragOver(event)" ondragleave="fpDragLeave(event)" ondrop="fpDrop(event,'${ce}')">
      <div class="fp-cat" onclick="toggleFpRow('${ce}')">${esc(cat)}<span class="fp-cat-n">${count}</span>
        <svg class="fp-chev" viewBox="0 0 24 24"><path d="M12 13.172l4.95-4.95 1.414 1.414L12 16 5.636 9.636 7.05 8.222z"></path></svg></div>
      <div class="fp-chips">${chipsHTML}</div></div>`;
  };
  // 每个标签所属维度：服务端维度 + 用户拖动覆盖
  const dimOf={};
  for(const [cat,tags] of Object.entries(TAG_TAXO||{}))(tags||[]).forEach(t=>{dimOf[t]=cat;});
  Object.keys(TAXO_OVERRIDE||{}).forEach(t=>{dimOf[t]=TAXO_OVERRIDE[t];});
  const dims=Object.keys(TAG_TAXO||{});
  const valid=new Set(dims.concat(['其他']));
  const buckets={};
  [...present].forEach(t=>{const c=(dimOf[t]&&valid.has(dimOf[t]))?dimOf[t]:'其他';(buckets[c]=buckets[c]||[]).push(t);});
  for(const cat of dims.concat(['其他'])){
    const here=(buckets[cat]||[]).sort((a,b)=>cnt[b]-cnt[a]);
    if(!here.length)continue;
    rows+=rowHTML(cat, here.map(t=>fpChip(t,cnt[t])).join(''), here.length);
  }
  const n=tagInclude.size+tagExclude.size;
  const allCollapsed=window._fpPanelCollapsed?' fp-panel-collapsed':'';
  panel.className='filter-panel'+allCollapsed;
  panel.innerHTML=`<div class="fp-head">
      <button class="fp-fold" onclick="togglePanelFold()" title="整个收起/展开"><svg viewBox="0 0 24 24" class="fp-fold-chev"><path d="M12 13.172l4.95-4.95 1.414 1.414L12 16 5.636 9.636 7.05 8.222z"></path></svg></button>
      <b onclick="togglePanelFold()" style="cursor:pointer" title="点这里收起/展开筛选">按标签筛选</b><span class="fp-tip">点维度名展开/收起 · 点标签：必含→排雷→取消 · 拖标签可换维度</span>
      <span style="margin-left:auto"></span>
      <button class="fp-clear" onclick="fpToggleAll()">展开/收起各项</button>
      ${n?`<button class="fp-clear" onclick="clearTags()">清除(${n})</button>`:''}
      <button class="fp-done" onclick="closeFilter()">完成</button></div>
    <div class="fp-body">${rows}</div>`;
}
function togglePanelFold(){
  window._fpPanelCollapsed=!window._fpPanelCollapsed;
  const p=document.getElementById('tag-filter');
  if(p)p.classList.toggle('fp-panel-collapsed',window._fpPanelCollapsed);
}
function toggleFpRow(cat){
  window._fpOpen=window._fpOpen||new Set();
  if(window._fpOpen.has(cat))window._fpOpen.delete(cat);else window._fpOpen.add(cat);
  const row=document.querySelector('.fp-row[data-cat="'+cat.replace(/"/g,'\\"')+'"]');
  if(row)row.classList.toggle('collapsed');
}
function fpToggleAll(){
  window._fpOpen=window._fpOpen||new Set();
  const rows=[...document.querySelectorAll('.fp-row')];
  const anyClosed=rows.some(r=>r.classList.contains('collapsed'));
  rows.forEach(r=>{const cat=r.dataset.cat;r.classList.toggle('collapsed',!anyClosed);if(anyClosed)window._fpOpen.add(cat);else window._fpOpen.delete(cat);});
}
function fpChip(t,n){
  const st=tagState(t);
  const sign=st==='inc'?'＋':(st==='exc'?'－':'');
  const ta=t.replace(/'/g,"\\'");
  return `<span class="fp-chip ${st}" draggable="true" ondragstart="fpDragStart(event,'${ta}')" onclick="cycleTag('${ta}')">${sign?`<b>${sign}</b>`:''}${esc(t)}<i>${n}</i></span>`;
}
// 拖标签到别的维度，重新归类（覆盖存本机浏览器）
function fpDragStart(ev,tag){try{ev.dataTransfer.setData('text/plain',tag);ev.dataTransfer.effectAllowed='move';}catch(e){}window._fpDragTag=tag;}
function fpDragOver(ev){ev.preventDefault();const r=ev.currentTarget;if(r)r.classList.add('fp-drop');try{ev.dataTransfer.dropEffect='move';}catch(e){}}
function fpDragLeave(ev){const r=ev.currentTarget;if(r)r.classList.remove('fp-drop');}
function fpDrop(ev,cat){
  ev.preventDefault();
  const r=ev.currentTarget;if(r)r.classList.remove('fp-drop');
  let tag='';try{tag=ev.dataTransfer.getData('text/plain');}catch(e){}
  tag=tag||window._fpDragTag||'';window._fpDragTag=null;
  if(!tag)return;
  TAXO_OVERRIDE[tag]=cat;saveTaxoOverride();
  window._fpOpen=window._fpOpen||new Set();window._fpOpen.add(cat);   // 展开目标维度看到刚拖进去的标签
  buildFilterPanel();
}
function bookHTML(b){
  const sel=selected.has(b.id)?' sel':'';
  // hover 信息行
  const infoRows=[];
  infoRows.push(`<div class="bi-title">${esc(b.t)}</div>`);
  infoRows.push(`<div class="bi-author">${esc(b.a)}</div>`);
  const meta=[];
  if(b.chapters)meta.push(`${b.chapters}章`);
  if(b.extras)meta.push(`${b.extras}番外`);
  if(b.wc&&b.wc!=='0')meta.push(`${b.wc}万字`);
  if(meta.length)infoRows.push(`<div class="bi-meta">${meta.join(' · ')}</div>`);
  if(b.finished)infoRows.push(`<div class="bi-tag fin">完结</div>`);
  else if(b.ongoing)infoRows.push(`<div class="bi-tag ong">连载中</div>`);
  if(b.rating)infoRows.push(`<div class="bi-stars">${'★'.repeat(b.rating)}${'☆'.repeat(5-b.rating)}</div>`);
  if(b.rstatus==='finished')infoRows.push(`<div class="bi-reading fin">读完</div>`);
  else if(b.reading)infoRows.push(`<div class="bi-reading">在读 ${b.progress}%</div>`);
  if(b.notes)infoRows.push(`<div class="bi-notes">${b.notes} 条笔记</div>`);

  const coverInner=b.cover
    ? `<img class="bc-img" src="/api/cover/${b.id}" alt="" loading="lazy">${b.reading?`<div class="bc-progress"><i style="width:${b.progress}%"></i></div>`:''}`
    : `<div class="bc-title">${esc(b.t)}</div><div class="bc-author">${esc(b.a)}</div>${b.reading?`<div class="bc-progress"><i style="width:${b.progress}%"></i></div>`:''}`;
  const tg=(b.genres||[]).filter(x=>x&&x!=='未分类');
  const titleAttr=tg.length?`${esc(b.t)} · ${tg.join('、')}`:esc(b.t);
  return `<div class="book${sel}" data-id="${b.id}" title="${titleAttr.replace(/"/g,'&quot;')}">
    <div class="check"><svg viewBox="0 0 24 24" class="ic"><path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z"></path></svg></div>
    ${b.fav?'<div class="badge fav"><svg viewBox="0 0 24 24" class="ic"><path d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2Z"></path></svg></div>':''}
    <div class="book-cover${b.cover?' has-img':''}" style="background:${b.c}">
      ${coverInner}
      <div class="book-info">${infoRows.join('')}</div>
    </div>
  </div>`;
}
function shelfUnit(books){return `<div class="shelf-wrap"><div class="shelf-scroll"><div class="shelf-track">${books.map(bookHTML).join('')}</div></div><div class="shelf-rail"><div class="shelf-grip"></div></div></div>`;}

let _renderGroups=[],_renderIdx=0,_renderMode='',_gridList=[],_gridIdx=0;
const _NARROW=(window.innerWidth||999)<600;       // 手机窄屏：更小的批量/每组上限，首屏更轻
const BATCH_GROUPS=_NARROW?12:25, BATCH_BOOKS=_NARROW?120:200;
const PER_GROUP_CAP=_NARROW?48:120;                // 每个作者/题材最多先画这么多本

function authorHead(a,books){const show=books.length>PER_GROUP_CAP?books.slice(0,PER_GROUP_CAP):books;const more=books.length>PER_GROUP_CAP?`<span class="shelf-count" style="color:var(--ink-faint)">（显示前${PER_GROUP_CAP}/${books.length}本，用搜索找更多）</span>`:'';const fav=isFavAuthor(a);const aEsc=esc(a).replace(/'/g,"\\'");const star=`<button class="author-star${fav?' on':''}" title="${fav?'取消收藏作者':'收藏这位作者（置顶）'}" onclick="toggleFavAuthor('${aEsc}',event)"><svg viewBox="0 0 24 24"><path d="M12 18.26l-7.053 3.948 1.575-7.928L.587 8.792l8.027-.952L12 .5l3.386 7.34 8.027.952-5.935 5.488 1.575 7.928z"></path></svg></button>`;return `<div class="shelf${fav?' shelf-fav':''}" data-author="${esc(a)}"><div class="shelf-head">${star}<span class="shelf-author" ondblclick="gotoAuthorPage('${aEsc}',event)" title="双击看 ${aEsc} 的全部作品" style="cursor:pointer">${esc(a)}</span><span class="shelf-count">${books.length} 本</span>${more}<button class="shelf-select" onclick="selectGroup('a','${aEsc}')"><svg viewBox="0 0 24 24" class="ic"><path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z"></path></svg>全选这一排</button></div>${shelfUnit(sortFavFirst(show))}</div>`;}
function genreHead(g,books){const show=books.length>PER_GROUP_CAP?books.slice(0,PER_GROUP_CAP):books;const more=books.length>PER_GROUP_CAP?`<span class="genre-count" style="color:var(--ink-faint)">（显示前${PER_GROUP_CAP}/${books.length}本）</span>`:'';return `<div class="genre-section"><div class="genre-head"><span class="genre-name">${esc(g)}</span><span class="genre-count">${books.length} 本 · 收藏优先</span>${more}<button class="shelf-select" onclick="selectGroup('g','${esc(g).replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" class="ic"><path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z"></path></svg>全选</button></div>${shelfUnit(sortFavFirst(show))}</div>`;}

function render(){
  const stage=document.getElementById('stage');
  // ── 书架模式：收藏 + 在读 分区 ──
  if(room==='shelf'){
    renderShelfRoom();
    return;
  }
  const list=filtered();
  if(!list.length){stage.innerHTML='<div class="empty">没有找到书</div>';return;}
  _renderIdx=0;_gridIdx=0;
  if(view==='author'){
    const byA={};list.forEach(b=>{(byA[b.a]=byA[b.a]||[]).push(b);});
    const favA=getFavAuthors();
    _renderGroups=Object.entries(byA).sort((a,b)=>{
      const fa=favA.has(a[0])?1:0, fb=favA.has(b[0])?1:0;
      if(fb!==fa)return fb-fa;            // 收藏的作者置顶
      return b[1].length-a[1].length;     // 其次按藏书量
    });
    _renderMode='author';
    stage.innerHTML='';renderMoreGroups();
  }else if(view==='genre'){
    const byG={};list.forEach(b=>{(byG[b.g]=byG[b.g]||[]).push(b);});
    _renderGroups=Object.entries(byG).sort((a,b)=>b[1].length-a[1].length);
    _renderMode='genre';
    stage.innerHTML='';renderMoreGroups();
  }else{
    let l=list;
    if(view==='fav')l=list.filter(b=>b.fav);else if(view==='reading')l=list.filter(b=>b.reading);
    if(!l.length){stage.innerHTML='<div class="empty">'+(view==='fav'?'还没有收藏的书':view==='reading'?'没有在读的书':'这里还没有书')+'</div>';return;}
    _gridList=sortFavFirst(l);_renderMode='grid';
    stage.innerHTML='<div class="grid-wrap"><div class="grid" id="grid-box"></div></div>';
    renderMoreGrid();
  }
  setupLazyLoad();
}
function renderShelfRoom(){
  const stage=document.getElementById('stage');
  let list=DATA;
  if(searchKw){const k=searchKw.toLowerCase();list=list.filter(b=>(b.t+b.a).toLowerCase().includes(k));}
  const byRecent=(a,b)=>((b.lo||'')<(a.lo||'')?-1:((b.lo||'')>(a.lo||'')?1:0));
  const reading=list.filter(b=>b.reading).sort(byRecent);
  const readDone=list.filter(b=>b.rstatus==='finished').sort(byRecent);
  const fav=list.filter(b=>b.fav);
  if(!reading.length&&!fav.length&&!readDone.length){
    stage.innerHTML='<div class="empty">书架还空着<br><span style="font-size:13px">在书房里长按书 → 拖到收藏，或在阅读器打开自动进"在读"</span></div>';
    return;
  }
  let html='';
  // 在读区：一整排不分类
  if(reading.length){
    html+=`<div class="shelf-room-section"><div class="srs-head"><svg viewBox="0 0 24 24" class="ic"><path d="M4 3C3.44772 3 3 3.44772 3 4V20C3 20.5523 3.44772 21 4 21H14C14.5523 21 15 20.5523 15 20V10.6973L17.0215 20.2076C17.1363 20.7479 17.6673 21.0927 18.2075 20.9779L21.142 20.3541C21.6822 20.2393 22.027 19.7083 21.9122 19.1681L19.0015 5.47402C18.8866 4.9338 18.3556 4.58896 17.8154 4.70378L15 5.30221V5C15 4.44772 14.5523 4 14 4H9C9 3.44772 8.55228 3 8 3H4ZM9 6H13V14H9V6ZM13 16V19H9V16H13ZM7 17V19H5V17H7ZM18.7699 18.8137L18.3541 16.8577L19.3323 16.6498L19.748 18.6058L18.7699 18.8137Z"></path></svg><span class="srs-title">在读</span><span class="srs-count">${reading.length}</span></div>${shelfUnit(reading)}</div>`;
  }
  // 已读区：一整排不分类
  if(readDone.length){
    html+=`<div class="shelf-room-section"><div class="srs-head srs-divider"><svg viewBox="0 0 24 24" class="ic"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM11.0026 16L6.75999 11.7574L8.17421 10.3431L11.0026 13.1716L16.6595 7.51472L18.0737 8.92893L11.0026 16Z"></path></svg><span class="srs-title">已读</span><span class="srs-count">${readDone.length}</span></div>${shelfUnit(readDone)}</div>`;
  }
  // 收藏区：按作者分组，每个有收藏书的作者一排
  if(fav.length){
    html+=`<div class="srs-head srs-divider"><svg viewBox="0 0 24 24" class="ic"><path d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2Z"></path></svg><span class="srs-title">收藏</span><span class="srs-count">${fav.length}</span></div>`;
    const byA={};fav.forEach(b=>{(byA[b.a]=byA[b.a]||[]).push(b);});
    // 作者按收藏书数排序
    const sorted=Object.entries(byA).sort((a,b)=>b[1].length-a[1].length);
    html+=sorted.map(([a,books])=>`<div class="shelf"><div class="shelf-head"><span class="shelf-author" ondblclick="gotoAuthorPage('${esc(a).replace(/'/g,"\\'")}',event)" title="双击看全部作品" style="cursor:pointer">${esc(a)}</span><span class="shelf-count">${books.length} 本收藏</span><button class="shelf-select" onclick="selectGroup('a','${esc(a).replace(/'/g,"\\'")}')"><svg viewBox="0 0 24 24" class="ic"><path d="M9.9997 15.1709L19.1921 5.97852L20.6063 7.39273L9.9997 17.9993L3.63574 11.6354L5.04996 10.2212L9.9997 15.1709Z"></path></svg>全选这一排</button></div>${shelfUnit(sortFavFirst(books))}</div>`).join('');
  }
  stage.innerHTML=html;
  bindBooks();bindScroll();
}
function renderMoreGroups(){
  const stage=document.getElementById('stage');
  const slice=_renderGroups.slice(_renderIdx,_renderIdx+BATCH_GROUPS);
  if(!slice.length)return;
  const html=slice.map(([k,books])=>_renderMode==='author'?authorHead(k,books):genreHead(k,books)).join('');
  stage.insertAdjacentHTML('beforeend',html);
  _renderIdx+=slice.length;
  bindBooks();bindScroll();bindAuthorDrop();
}
function renderMoreGrid(){
  const box=document.getElementById('grid-box');if(!box)return;
  const slice=_gridList.slice(_gridIdx,_gridIdx+BATCH_BOOKS);
  if(!slice.length)return;
  box.insertAdjacentHTML('beforeend',slice.map(bookHTML).join(''));
  _gridIdx+=slice.length;
  bindBooks();
}
let _lazyObserver=null;
function setupLazyLoad(){
  if(_lazyObserver)_lazyObserver.disconnect();
  // 用滚动监听底部，加载下一批
  const sentinelId='lazy-sentinel';
  let s=document.getElementById(sentinelId);
  if(s)s.remove();
  s=document.createElement('div');s.id=sentinelId;s.style.height='1px';
  document.getElementById('stage').appendChild(s);
  _lazyObserver=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting){
      if(_renderMode==='grid')renderMoreGrid();else renderMoreGroups();
      // 把哨兵移到末尾
      const st=document.getElementById('stage');st.appendChild(s);
    }
  },{rootMargin:'400px'});
  _lazyObserver.observe(s);
}

function bindScroll(){
  document.querySelectorAll('.shelf-wrap').forEach(wrap=>{
    const sc=wrap.querySelector('.shelf-scroll');
    const rail=wrap.querySelector('.shelf-rail');
    const grip=wrap.querySelector('.shelf-grip');
    if(!sc||!rail||!grip)return;

    // 计算滑块尺寸/位置
    function sync(){
      const vis=sc.clientWidth, total=sc.scrollWidth;
      if(total<=vis+2){rail.classList.add('full');return;}
      rail.classList.remove('full');
      const railW=rail.clientWidth;
      const gripW=Math.max(40,railW*vis/total);
      const maxScroll=total-vis;
      const maxGrip=railW-gripW;
      const left=maxScroll>0?(sc.scrollLeft/maxScroll)*maxGrip:0;
      grip.style.width=gripW+'px';
      grip.style.left=left+'px';
    }
    sync();
    // 书架滚动时更新滑块（滚轮/触摸）
    sc.addEventListener('scroll',sync,{passive:true});
    window.addEventListener('resize',sync);

    // 拖动滑块 → 滚书架
    let gripDown=false,gripStartX=0,gripStartLeft=0;
    grip.addEventListener('mousedown',e=>{e.preventDefault();e.stopPropagation();gripDown=true;gripStartX=e.pageX;gripStartLeft=parseFloat(grip.style.left)||0;grip.classList.add('grabbing');});
    grip.addEventListener('touchstart',e=>{gripDown=true;gripStartX=e.touches[0].pageX;gripStartLeft=parseFloat(grip.style.left)||0;grip.classList.add('grabbing');},{passive:true});
    function gripMove(e){
      if(!gripDown)return;
      const px=e.touches?e.touches[0].pageX:e.pageX;
      const railW=rail.clientWidth,gripW=grip.clientWidth;
      const maxGrip=railW-gripW;
      let nl=Math.max(0,Math.min(maxGrip,gripStartLeft+(px-gripStartX)));
      grip.style.left=nl+'px';
      const maxScroll=sc.scrollWidth-sc.clientWidth;
      sc.scrollLeft=maxGrip>0?(nl/maxGrip)*maxScroll:0;
    }
    document.addEventListener('mousemove',gripMove);
    document.addEventListener('touchmove',gripMove,{passive:true});
    const gripEnd=()=>{if(gripDown){gripDown=false;grip.classList.remove('grabbing');}};
    document.addEventListener('mouseup',gripEnd);document.addEventListener('touchend',gripEnd);

    // 在书区直接按住左右拖（保留），同时同步滑块
    let down=false,startX,startScroll,moved=false;
    sc.addEventListener('mousedown',e=>{if(editing)return;down=true;moved=false;startX=e.pageX;startScroll=sc.scrollLeft;});
    sc.addEventListener('mousemove',e=>{if(!down)return;const dx=e.pageX-startX;if(Math.abs(dx)>5){moved=true;sc.classList.add('dragging');}sc.scrollLeft=startScroll-dx;});
    const end=()=>{down=false;setTimeout(()=>sc.classList.remove('dragging'),50);};
    sc.addEventListener('mouseup',end);sc.addEventListener('mouseleave',end);
    sc.addEventListener('click',e=>{if(moved){e.stopPropagation();e.preventDefault();}},true);
  });
}

let pressTimer=null,pressStartX=0,pressStartY=0;
function bindBooks(){
  document.querySelectorAll('.book').forEach(el=>{
    const bid=parseInt(el.dataset.id);
    el.addEventListener('mousedown',e=>startPress(bid,e));el.addEventListener('touchstart',e=>startPress(bid,e),{passive:true});
    el.addEventListener('mousemove',checkPressMove);el.addEventListener('touchmove',checkPressMove,{passive:true});
    el.addEventListener('mouseup',cancelPress);el.addEventListener('mouseleave',cancelPress);el.addEventListener('touchend',cancelPress);
    el.addEventListener('click',e=>{if(editing){e.preventDefault();toggleSel(bid);}else openBook(bid);});
    el.setAttribute('draggable',editing?'true':'false');el.addEventListener('dragstart',e=>onDragStart(bid,e));
  });
}
function startPress(bid,e){if(editing)return;const x=e.touches?e.touches[0].pageX:e.pageX;const y=e.touches?e.touches[0].pageY:e.pageY;pressStartX=x;pressStartY=y;pressTimer=setTimeout(()=>{enterEdit();toggleSel(bid);if(navigator.vibrate)navigator.vibrate(40);},480);}
function checkPressMove(e){if(!pressTimer)return;const x=e.touches?e.touches[0].pageX:e.pageX;const y=e.touches?e.touches[0].pageY:e.pageY;if(Math.abs(x-pressStartX)>8||Math.abs(y-pressStartY)>8)clearTimeout(pressTimer);}
function cancelPress(){clearTimeout(pressTimer);}
function enterEdit(){editing=true;document.body.classList.add('edit');render();}
function toggleEdit(){editing=!editing;document.body.classList.toggle('edit',editing);if(!editing)selected.clear();updateSel();buildTagDropRow();render();}
function toggleSel(bid){selected.has(bid)?selected.delete(bid):selected.add(bid);updateSel();}
function selectGroup(type,val){const list=filtered();const books=list.filter(b=>type==='a'?b.a===val:b.g===val);const allSel=books.every(b=>selected.has(b.id));if(allSel)books.forEach(b=>selected.delete(b.id));else books.forEach(b=>selected.add(b.id));updateSel();render();}
function currentList(){
  let l=filtered();
  if(room==='shelf'){return l.filter(b=>b.reading||b.fav);}
  if(view==='fav')return l.filter(b=>b.fav);if(view==='reading')return l.filter(b=>b.reading);return l;
}
function toggleAll(){const list=currentList();const allSel=list.length&&list.every(b=>selected.has(b.id));if(allSel)list.forEach(b=>selected.delete(b.id));else list.forEach(b=>selected.add(b.id));updateSel();render();}
function updateSel(){document.getElementById('eb-n').textContent=selected.size;const list=currentList();const allSel=list.length&&list.every(b=>selected.has(b.id));document.getElementById('eb-all').classList.toggle('on',allSel);document.querySelectorAll('.book').forEach(el=>el.classList.toggle('sel',selected.has(parseInt(el.dataset.id))));}

function onDragStart(bid,e){if(!editing){e.preventDefault();return;}if(!selected.has(bid)){selected.add(bid);updateSel();}const g=document.getElementById('ghost');g.textContent='移动 '+selected.size+' 本';g.style.display='flex';e.dataTransfer.setData('text','b');e.dataTransfer.effectAllowed='move';const img=new Image();img.src='data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';e.dataTransfer.setDragImage(img,0,0);}
function bindGlobal(){
  if(!window._filterOutsideBound){
    window._filterOutsideBound=true;
    document.addEventListener('click',e=>{
      if(!filterOpen)return;
      if(e.target.closest('#tag-filter')||e.target.closest('.filter-row'))return;
      closeFilter();
    });
  }
  if(!window._bookHoverBound){
    window._bookHoverBound=true;
    const card=()=>document.getElementById('bookhover');
    document.addEventListener('mouseover',e=>{
      const bk=e.target.closest && e.target.closest('.book'); if(!bk||editing)return;
      const id=+bk.dataset.id; const b=DATA.find(x=>x.id===id); if(!b)return;
      const c=card(); if(!c)return;
      const tg=(b.genres||[]).filter(x=>x&&x!=='未分类');
      if(!tg.length){const c0=card();if(c0)c0.style.display='none';return;}  // 没标签就不弹（书名作者封面上已有，别重复）
      c.innerHTML=`<div class="bh-tags">${tg.map(g=>`<span>${esc(g)}</span>`).join('')}</div>`;
      c.style.display='block';
      const r=bk.getBoundingClientRect(), cw=c.offsetWidth, ch=c.offsetHeight;
      let left=r.left+r.width/2-cw/2; left=Math.max(8,Math.min(left,(window.innerWidth||1200)-cw-8));
      let top=r.top-ch-10; if(top<8)top=r.bottom+10;
      c.style.left=left+'px'; c.style.top=top+'px';
    });
    document.addEventListener('mouseout',e=>{
      const bk=e.target.closest && e.target.closest('.book'); if(!bk)return;
      const c=card(); if(c)c.style.display='none';
    });
  }
  if(!window._fileImportBound){
    window._fileImportBound=true;
    const ov=()=>document.getElementById('import-overlay');
    window.addEventListener('dragover',e=>{
      if(e.dataTransfer&&[...(e.dataTransfer.types||[])].includes('Files')){e.preventDefault();const o=ov();if(o)o.classList.add('show');}
    });
    window.addEventListener('dragleave',e=>{if(e.relatedTarget===null||e.clientX<=0||e.clientY<=0){const o=ov();if(o)o.classList.remove('show');}});
    window.addEventListener('drop',async e=>{
      if(e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files.length){
        e.preventDefault();const o=ov();if(o)o.classList.remove('show');
        await importFiles(e.dataTransfer.files);
      }
    });
  }
  document.addEventListener('dragover',e=>{e.preventDefault();const g=document.getElementById('ghost');if(g.style.display==='flex'){g.style.left=(e.clientX+14)+'px';g.style.top=(e.clientY+10)+'px';}});
  document.addEventListener('dragend',()=>document.getElementById('ghost').style.display='none');
  document.querySelectorAll('.drop-zone').forEach(z=>{
    z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('over');});
    z.addEventListener('dragleave',()=>z.classList.remove('over'));
    z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('over');dropTo(z.dataset.zone);});
  });
  document.querySelectorAll('#view-seg button').forEach(btn=>btn.addEventListener('click',()=>{document.querySelectorAll('#view-seg button').forEach(b=>b.classList.remove('on'));btn.classList.add('on');view=btn.dataset.v;updateFilterSummary();if(editing)updateSel();render();}));
}
// 同一本书在 DATA 和（搜索状态下的）SEARCH_RESULTS 里是两份不同对象。
// 改属性时必须两份都改：否则在搜索状态下改了 DATA、而界面是用 SEARCH_RESULTS 渲染的，
// 拖完"完全没变化"就是这么来的（拖确实生效了，只是改的那份没被画出来）。
function updateBook(bid,fn){
  const apply=arr=>{ if(!arr)return; const b=arr.find(x=>x.id===bid); if(b){ (typeof fn==='function')?fn(b):Object.assign(b,fn); } };
  apply(DATA); apply(SEARCH_RESULTS);
}
// 拖书到某位作者那一排 → 把选中书的作者改成那一排的作者（编辑模式·按作者视图）
function bindAuthorDrop(){
  if(!editing||_renderMode!=='author')return;
  document.querySelectorAll('.shelf[data-author]').forEach(sh=>{
    if(sh._adbound)return; sh._adbound=true;
    sh.addEventListener('dragover',e=>{e.preventDefault();sh.classList.add('author-drop-over');});
    sh.addEventListener('dragleave',e=>{if(!sh.contains(e.relatedTarget))sh.classList.remove('author-drop-over');});
    sh.addEventListener('drop',e=>{e.preventDefault();sh.classList.remove('author-drop-over');dropToAuthor(sh.dataset.author);});
  });
}
async function dropToAuthor(author){
  document.getElementById('ghost').style.display='none';
  author=(author||'').trim();if(!author)return;
  const ids=[...selected];if(!ids.length){toast('先选几本书再拖');return;}
  toast('移动中…');
  // 本地先改作者（DATA 和搜索结果两份都改 → 搜索状态下也立刻看到移动），保持原有排序
  ids.forEach(bid=>updateBook(bid,{a:author}));
  try{saveShelfCache();}catch(e){}
  selected.clear();updateSel();render();
  // 真正写回服务器，等全部写完再给“完成”提示（保证下次刷新拿到的是新归属）
  try{
    await Promise.all(ids.map(bid=>fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,author})})));
    toast(ids.length+' 本已归到「'+author+'」');
  }catch(e){toast('已在本机更新，但写回服务器失败，刷新后可能恢复');}
  // 自动滚到目标作者那一排、整排亮一下 —— 明确告诉你“移过来了”（书仍按原排序，可能在这排靠后）
  requestAnimationFrame(()=>{
    let target=null;
    document.querySelectorAll('.shelf[data-author]').forEach(sh=>{ if(sh.dataset.author===author)target=sh; });
    if(target){
      try{target.scrollIntoView({behavior:'smooth',block:'center'});}catch(e){target.scrollIntoView();}
      target.classList.add('shelf-flash'); setTimeout(()=>target.classList.remove('shelf-flash'),1600);
    }
  });
}
async function dropTo(zone){
  if(zone&&zone.startsWith('tag:')){await batchApplyTag(zone.slice(4));return;}
  const ids=[...selected];const n=ids.length;
  document.getElementById('ghost').style.display='none';
  if(zone==='fav'){
    for(const bid of ids){updateBook(bid,{fav:true});fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,is_favorite:1})});}
    try{saveShelfCache();}catch(e){}
    toast(n+' 本已收藏');
    selected.clear();updateSel();updateFilterSummary();render();
    return;
  }else{
    ids.forEach(bid=>cart.add(bid));saveCart();
    toast(n+' 本已加入下载篮');
  }
  updateCart();render();
}
// ===== 批量操作（编辑模式）=====
async function batchApplyTag(name){
  document.getElementById('ghost').style.display='none';
  name=(name||'').trim();if(!name)return;
  const ids=[...selected];if(!ids.length){toast('先选几本书');return;}
  ids.forEach(bid=>updateBook(bid,b=>{b.genres=b.genres||[];if(!b.genres.includes(name)){b.genres.push(name);b.g=b.genres[0];}}));
  saveShelfCache();render();buildTagDropRow();updateFilterSummary();
  try{await fetch('/api/books/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,action:'tag',name})});}catch(e){}
  toast(ids.length+' 本已打标签「'+name+'」');
}
function batchTag(){
  if(!selected.size){toast('先选几本书');return;}
  const name=prompt('给选中的 '+selected.size+' 本书打一个题材标签（会进题材筛选）：');
  if(name)batchApplyTag(name);
}
function batchPinAuthors(){
  if(!selected.size){toast('先选几本书');return;}
  const s=getFavAuthors();let add=0;
  selected.forEach(bid=>{const b=DATA.find(x=>x.id===bid);if(b&&b.a&&!s.has(b.a)){s.add(b.a);add++;}});
  localStorage.setItem('fav_authors',JSON.stringify([...s]));
  toast(add?('已置顶 '+add+' 位作者'):'这些作者都已置顶');
  render();
}
async function batchStatus(rs){
  if(!selected.size){toast('先选几本书');return;}
  const ids=[...selected];
  const label=rs==='finished'?'已读':rs==='reading'?'在读':'未读';
  try{
    const r=await (await fetch('/api/books/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,action:'status',status:rs})})).json();
    if(r.ok){
      const now=new Date().toISOString();
      ids.forEach(id=>{const b=DATA.find(x=>x.id===id);if(b){b.rstatus=rs;b.reading=(rs==='reading');if(rs==='finished'){b.is_read=1;b.read=true;}if(rs!=='unread')b.lo=now;}});
      selected.clear();saveShelfCache&&saveShelfCache();toast('已标为「'+label+'」'+(r.done||ids.length)+' 本');updateSel();render();
    }else toast('操作失败');
  }catch(e){toast('操作失败');}
}
async function batchDelete(){
  if(!selected.size){toast('先选几本书');return;}
  const ids=[...selected];
  if(!confirm('删除选中的 '+ids.length+' 本书？\n（文件移到书库下的 _recycle 回收文件夹，不直接抹；划线/笔记一并清除，可找回）'))return;
  try{
    const r=await (await fetch('/api/books/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,action:'delete'})})).json();
    if(r.ok){DATA=DATA.filter(x=>!selected.has(x.id));selected.clear();saveShelfCache();toast('已删除 '+(r.done||ids.length)+' 本（在 _recycle 里可找回）');updateSel();buildTagDropRow();updateFilterSummary();render();}
    else toast('删除失败');
  }catch(e){toast('删除失败');}
}
// 拖拽导入书籍（基础版）
async function importFiles(fileList){
  const files=[...fileList].filter(f=>/\.(txt|epub|md|html?|mobi|azw3)$/i.test(f.name));
  if(!files.length){toast('支持 txt / epub / md / html 等电子书文件');return;}
  toast('导入中… '+files.length+' 个文件');
  const fd=new FormData();files.forEach(f=>fd.append('files',f));
  try{
    const r=await (await fetch('/api/import/files',{method:'POST',body:fd})).json();
    if(r&&r.ok){
      toast('已导入 '+r.added+' 本'+(r.skipped?('，跳过 '+r.skipped):''));
      try{sessionStorage.removeItem('shelf_cache');sessionStorage.removeItem('shelf_cache_at');}catch(e){}
      setTimeout(()=>location.reload(),900);
    }else toast('导入失败');
  }catch(e){toast('导入失败');}
}
// 拖动归类：编辑模式下顶部一排“题材放置目标”，拖书过去高亮放大、松手批量打标签
function buildTagDropRow(){
  const row=document.getElementById('tag-drop-row');if(!row)return;
  if(!editing){row.innerHTML='';return;}
  const cnt={};DATA.forEach(b=>(b.genres||[]).forEach(g=>{if(g&&g!=='未分类')cnt[g]=(cnt[g]||0)+1;}));
  const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,16);
  row.innerHTML='<span class="tdr-lead">把选中的书拖到题材上 →</span>'
    + top.map(([t,n])=>`<span class="tdr-target" data-tag="${t.replace(/"/g,'&quot;')}">${esc(t)}<i>${n}</i></span>`).join('')
    + `<span class="tdr-target add" onclick="batchTag()">＋ 新标签</span>`;
  row.querySelectorAll('.tdr-target[data-tag]').forEach(z=>{
    z.addEventListener('dragover',e=>{e.preventDefault();z.classList.add('over');});
    z.addEventListener('dragleave',()=>z.classList.remove('over'));
    z.addEventListener('drop',e=>{e.preventDefault();z.classList.remove('over');dropTo('tag:'+z.dataset.tag);});
  });
}
let searchTimer=null;
function onSearch(){searchKw=document.getElementById('search').value.trim();clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,250);renderSearchHistory();}
function runSearch(){
  if(!searchKw){SEARCH_RESULTS=null;render();return;}
  // 整库搜索（服务端按书名/作者匹配），不只搜前端已加载的那部分——13万本也能搜到
  const kw=searchKw;
  fetch('/api/shelf?q='+encodeURIComponent(kw)+'&limit=600')
    .then(r=>r.json())
    .then(d=>{
      if((document.getElementById('search').value||'').trim()!==kw)return; // 输入已变，丢弃旧结果
      SEARCH_RESULTS=mapShelfBooks(d.books||[]);
      pushHistory(kw);
      render();
    })
    .catch(()=>{SEARCH_RESULTS=null;render();}); // 失败就退回本地过滤
}
// ===== 搜索历史（存在浏览器本地，可逐条删 / 清空）=====
function loadHistory(){try{history=JSON.parse(localStorage.getItem('mylib_search_hist')||'[]');}catch(e){history=[];}}
function saveHistory(){try{localStorage.setItem('mylib_search_hist',JSON.stringify((history||[]).slice(0,12)));}catch(e){}}
function pushHistory(kw){kw=(kw||'').trim();if(!kw)return;history=(history||[]).filter(h=>h!==kw);history.unshift(kw);if(history.length>12)history=history.slice(0,12);saveHistory();}
function delHistory(kw,ev){if(ev){ev.stopPropagation();}history=(history||[]).filter(h=>h!==kw);saveHistory();renderSearchHistory();}
function clearHistory(){history=[];saveHistory();renderSearchHistory();}
function useHistory(kw){const si=document.getElementById('search');si.value=kw;searchKw=kw;runSearch();const box=document.getElementById('search-history');if(box)box.style.display='none';}
function renderSearchHistory(){
  const box=document.getElementById('search-history');if(!box)return;
  const si=document.getElementById('search');
  const empty=!(si&&si.value.trim());
  if(!empty||!(history&&history.length)){box.style.display='none';box.innerHTML='';return;}
  box.style.display='flex';
  box.innerHTML='<span class="sh-label">最近搜索</span>'+history.map(h=>{
    const he=esc(h),ha=he.replace(/'/g,"\\'");
    return `<span class="sh-chip" onclick="useHistory('${ha}')">${he}<i class="sh-x" onclick="delHistory('${ha}',event)">×</i></span>`;
  }).join('')+'<span class="sh-clear" onclick="clearHistory()">清空</span>';
}
function onSearchFocus(){renderSearchHistory();}
// ===== 详情弹窗 =====
function cycleStatus(bid){
  const b=findBook(bid);if(!b)return;
  const cur=b.rstatus||(b.reading?'reading':'');
  const next={'':'reading','reading':'finished','finished':''}[cur];
  b.rstatus=next; b.reading=(next==='reading');
  try{saveShelfCache();}catch(e){}
  fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({id:bid,reading_status:next,is_read:next==='finished'?1:0})}).catch(()=>{});
  openBook(bid);                 // 重渲染弹窗显示新状态
  render();                      // 书架/书房都实时刷新分区（在读/已读/收藏），不用再手动刷新
}
async function openBook(bid){
  const b=findBook(bid);if(!b)return;
  const mb=document.getElementById('modal-bg');
  mb.classList.add('show');
  const firstChar=esc((b.t||'书')[0]);
  // 阅读状态映射（未读 → 在读 → 已读，点一下切换）
  const statusMap={reading:{t:'在读',c:'var(--green)'},finished:{t:'已读',c:'var(--gold)'},'':{t:'未读',c:'var(--ink-faint)'}};
  const curRs=b.rstatus||(b.reading?'reading':'');
  const st=statusMap[curRs]||statusMap[''];
  const aEsc=esc(b.a).replace(/'/g,"\\'");
  const genreChips=b.genres.length?b.genres.map(g=>`<span class="tag-chip">${esc(g)}</span>`).join(''):'<span style="color:var(--ink-faint);font-size:13px">未分类</span>';

  document.getElementById('modal').innerHTML=`
    <div class="modal-cover${b.cover?' has-img':''}" style="background:linear-gradient(135deg, ${b.c}, ${shade(b.c,-20)})">
      ${b.cover?`<img class="mc-img" src="/api/cover/${bid}?t=${Date.now()}" alt="">`:''}
      <button class="mc-close" onclick="closeModal()">×</button>
      ${b.cover?'':`<div class="mc-spine">${firstChar}</div>`}
      <div class="mc-title" ondblclick="editBookField(${bid},'title')" title="双击改标题">${esc(b.t)}</div>
      <button class="mc-cover-btn" onclick="document.getElementById('cover-file-${bid}').click()" title="${b.cover?'换封面':'上传封面'}">
        <svg viewBox="0 0 24 24" class="ic"><path d="M9 3H15L17 5H21C21.5523 5 22 5.44772 22 6V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V6C2 5.44772 2.44772 5 3 5H7L9 3ZM12 19C15.3137 19 18 16.3137 18 13C18 9.68629 15.3137 7 12 7C8.68629 7 6 9.68629 6 13C6 16.3137 8.68629 19 12 19ZM12 17C9.79086 17 8 15.2091 8 13C8 10.7909 9.79086 9 12 9C14.2091 9 16 10.7909 16 13C16 15.2091 14.2091 17 12 17Z"></path></svg>
      </button>
      <input type="file" id="cover-file-${bid}" accept="image/*" style="display:none" onchange="uploadCover(${bid},this)">
    </div>
    <div class="modal-body">
      <div class="field-row"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M20 22H4V20C4 17.2386 6.23858 15 9 15H15C17.7614 15 20 17.2386 20 20V22ZM12 13C8.68629 13 6 10.3137 6 7C6 3.68629 8.68629 1 12 1C15.3137 1 18 3.68629 18 7C18 10.3137 15.3137 13 12 13Z"></path></svg>作者</span><span class="field-val author-jump" ondblclick="closeModal();gotoAuthorPage('${aEsc}')" title="双击看 ${aEsc} 的全部作品" style="cursor:pointer;border-bottom:1px dashed var(--ink-faint)">${esc(b.a)}</span></div>
      <div class="field-row"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM13 12V7H11V14H17V12H13Z"></path></svg>状态</span><span class="field-val"><button class="status-cycle" onclick="cycleStatus(${bid})" title="点一下切换：未读 → 在读 → 已读"><span class="status-dot" style="background:${st.c}"></span>${st.t}${curRs==='reading'?' · '+b.progress+'%':''}</button></span></div>
      <div class="field-row"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM17.4571 9.45711L11 15.9142L6.79289 11.7071L8.20711 10.2929L11 13.0858L16.0429 8.04289L17.4571 9.45711Z"></path></svg>连载</span><span class="field-val" id="modal-fin">${finBadge(bid,b)} <span class="check-ch" onclick="parseChapters(${bid})">理清章节</span> <span class="check-ch" onclick="checkChapters(${bid})">查缺章</span></span></div>
      <div class="field-row" id="modal-ch-result" style="display:none"><span class="field-label"></span><span class="field-val" id="modal-ch-text" style="font-size:13px"></span></div>
      <div class="field-row"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M11 4H21V6H11V4ZM11 8H17V10H11V8ZM11 14H21V16H11V14ZM11 18H17V20H11V18ZM3 4H9V10H3V4ZM5 6V8H7V6H5ZM3 14H9V20H3V14ZM5 16V18H7V16H5Z"></path></svg>体裁</span><span class="field-val">${genreChips}</span></div>
      <div class="field-row"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2Z"></path></svg>评分</span><span class="field-val stars" id="modal-stars">${ratingStars(bid,b.rating)}</span></div>
      <div class="field-row review-row"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M10 3v2H5v14h14v-5h2v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6zm10.5.7 1.4 1.4L13 14H11.6v-1.4L20.5 3.7z"></path></svg>总评</span><span class="field-val bi-review" id="modal-review" onclick="editReview(${bid})">${(b.un&&b.un.trim())?esc(b.un):'<span class="rv-ph">写点这本书的总评 / 简评 / 备注…</span>'}</span></div>
      <div class="field-row"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M21 18H6C5.44772 18 5 18.4477 5 19C5 19.5523 5.44772 20 6 20H21V22H6C4.34315 22 3 20.6569 3 19V4C3 2.89543 3.89543 2 5 2H21V18ZM16 9V7H8V9H16Z"></path></svg>字数</span><span class="field-val">${b.wc} 万字</span></div>
      ${b.reading?`<div class="field-row"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M3 12H7V21H3V12ZM17 8H21V21H17V8ZM10 2H14V21H10V2Z"></path></svg>进度</span><span class="field-val" style="display:flex;align-items:center;gap:10px"><span class="modal-progress"><i style="width:${b.progress}%"></i></span><span style="font-family:var(--sans);font-size:12px;color:var(--green)">${b.progress}%</span></span></div>`:''}
      <div class="field-row" id="modal-notes-row" style="display:none;cursor:pointer" onclick="closeModal();openCollection(${bid})" title="在手账本里看这本书的全部笔记"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M15 14L14.8834 14.0067C14.4243 14.0601 14.0601 14.4243 14.0067 14.8834L14 15V21H3.99826C3.44694 21 3 20.5551 3 20.0066V3.9934C3 3.44476 3.44495 3 3.9934 3H20.0066C20.5552 3 21 3.44749 21 3.9985V14H15ZM21 16L16 20.997V16H21Z"></path></svg>笔记</span><span class="field-val" id="modal-notes"></span></div>
      <div class="field-row" id="modal-reads-row" style="display:none"><span class="field-label"><svg viewBox="0 0 24 24" class="ic"><path d="M12 8V12L14.5 14.5M7.5 3.5A9 9 0 1 0 12 3a9 9 0 0 0-4.5.5Z" fill="none" stroke="currentColor" stroke-width="2"></path></svg>阅读回顾</span><span class="field-val" id="modal-reads" style="cursor:pointer"></span></div>
    </div>
    <div class="modal-actions">
      <button class="ma-btn primary" onclick="openReader(${bid})"><svg viewBox="0 0 24 24" class="ic"><path d="M21 21H13V6C13 4.34315 14.3431 3 16 3H21C21.5523 3 22 3.44772 22 4V20C22 20.5523 21.5523 21 21 21ZM11 21H3C2.44772 21 2 20.5523 2 20V4C2 3.44772 2.44772 3 3 3H8C9.65685 3 11 4.34315 11 6V21ZM11 21H13V23H11V21Z"></path></svg>阅读</button>
      <button class="ma-btn${b.fav?' on':''}" id="modal-fav" onclick="toggleFav(${bid})"><svg viewBox="0 0 24 24" class="ic"><path d="M5 2H19C19.5523 2 20 2.44772 20 3V22.1433C20 22.4194 19.7761 22.6434 19.5 22.6434C19.4061 22.6434 19.314 22.6168 19.2344 22.5669L12 18.0313L4.76559 22.5669C4.53163 22.7136 4.22306 22.6429 4.07637 22.4089C4.02647 22.3293 4 22.2373 4 22.1433V3C4 2.44772 4.44772 2 5 2Z"></path></svg>${b.fav?'已收藏':'收藏'}</button>
      <button class="ma-btn" onclick="cart.add(${bid});saveCart();updateCart();toast('已加入下载篮')"><svg viewBox="0 0 24 24" class="ic"><path d="M6.50488 2H17.5049C17.8196 2 18.116 2.14819 18.3049 2.4L21.0049 6V21C21.0049 21.5523 20.5572 22 20.0049 22H4.00488C3.4526 22 3.00488 21.5523 3.00488 21V6L5.70488 2.4C5.89374 2.14819 6.19013 2 6.50488 2ZM18.5049 6L17.0049 4H7.00488L5.50488 6H18.5049ZM9.00488 10H7.00488V12C7.00488 14.7614 9.24346 17 12.0049 17C14.7663 17 17.0049 14.7614 17.0049 12V10H15.0049V12C15.0049 13.6569 13.6617 15 12.0049 15C10.348 15 9.00488 13.6569 9.00488 12V10Z"></path></svg>下载</button>
      <button class="ma-btn" onclick="editBook(${bid})"><svg viewBox="0 0 24 24" class="ic"><path d="M6.41421 15.89L16.5563 5.74786L15.1421 4.33365L5 14.4758V15.89H6.41421ZM7.24264 17.89H3V13.6473L14.435 2.21233C14.8256 1.8218 15.4587 1.8218 15.8492 2.21233L18.6777 5.04075C19.0682 5.43128 19.0682 6.06444 18.6777 6.45497L7.24264 17.89ZM3 19.89H21V21.89H3V19.89Z"></path></svg>编辑</button>
      <button class="ma-btn danger" onclick="deleteBook(${bid})"><svg viewBox="0 0 24 24" class="ic"><path d="M7 4V2H17V4H22V6H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V6H2V4H7ZM6 6V20H18V6H6ZM9 9H11V17H9V9ZM13 9H15V17H13V9Z"></path></svg>删除</button>
    </div>`;
  // 异步取笔记预览
  if(b.notes>0){
    try{
      const r=await (await fetch('/api/notes/'+bid)).json();
      if(r.notes&&r.notes.length){
        const preview=r.notes.slice(0,2).map(n=>esc((n.content||n.title||'').slice(0,50))).join(' / ');
        document.getElementById('modal-notes').innerHTML=esc(preview)+` <span class="notes-more">…共${r.notes.length}条 · 看全部 ›</span>`;
        document.getElementById('modal-notes-row').style.display='flex';
      }
    }catch(e){}
  }
  // 用服务端权威记录刷新总评/评分/状态——修复"从搜索打开看不到、之前写的简评丢失"：
  // 这些值一直存在库里，只是搜索结果没带回来；这里拉回来显示＝把你之前的简评找回来。
  try{
    const det=await (await fetch('/api/book?id='+bid)).json();
    if(det&&det.book){
      b.un=det.book.user_notes||'';
      b.rating=det.book.rating||0;
      if(det.book.reading_status)b.rstatus=det.book.reading_status;
      const rv=document.getElementById('modal-review');
      if(rv&&!rv.querySelector('textarea'))rv.innerHTML=(b.un&&b.un.trim())?esc(b.un):'<span class="rv-ph">写点这本书的总评 / 简评 / 备注…</span>';
      const stc=document.getElementById('modal-stars');
      if(stc)stc.innerHTML=ratingStars(bid,b.rating);
    }
  }catch(e){}
  // 阅读回顾：你哪些天读过、估算读了几遍（来自每日阅读记录）
  try{
    const rd=await (await fetch('/api/book/'+bid+'/reads')).json();
    if(rd&&rd.day_count>0){
      const row=document.getElementById('modal-reads-row');
      const cell=document.getElementById('modal-reads');
      if(row&&cell){
        const fmt=s=>(s||'').replace(/-/g,'/').slice(5);
        let summary=`读过 <b>${rd.day_count}</b> 天`;
        if(rd.passes>1)summary+=` · 约 <b>${rd.passes}</b> 遍`;
        if(rd.last)summary+=` · 最近 ${fmt(rd.last)}`;
        cell.innerHTML=summary+` <span class="notes-more">看时间线 ›</span>`;
        cell.onclick=()=>showReadTimeline(rd);
        row.style.display='flex';
      }
    }
  }catch(e){}
}
// 阅读时间线弹窗：列出每次（第几遍·日期·读了多少）
function showReadTimeline(rd){
  const fmt=s=>(s||'').replace(/-/g,'/');
  const starts=new Set(rd.pass_starts||[]);
  let pass=rd.passes||0;
  const rows=(rd.days||[]).map(d=>{
    const isStart=starts.has(d.date);
    const tag=isStart?`<span class="rt-pass">第 ${pass--} 遍开始</span>`:'';
    const mins=d.minutes?` · ${d.minutes} 分钟`:'';
    const pct=(d.end!=null)?` · 读到 ${Math.round((d.end||0)*100)}%`:'';
    return `<div class="rt-row"><span class="rt-date">${fmt(d.date)}</span><span class="rt-meta">${tag}${mins}${pct}</span></div>`;
  }).join('');
  const h=`<div class="rt-modal-inner"><div class="rt-head">阅读回顾<span class="rt-sum">共 ${rd.day_count} 天 · 约 ${rd.passes} 遍 · ${Math.round((rd.total_minutes||0)/60*10)/10} 小时</span></div><div class="rt-list">${rows||'还没有阅读记录'}</div><button class="rt-close" onclick="closeReadTimeline()">关闭</button></div>`;
  let bg=document.getElementById('rt-modal');
  if(!bg){bg=document.createElement('div');bg.id='rt-modal';bg.className='rt-modal';bg.onclick=e=>{if(e.target===bg)closeReadTimeline();};document.body.appendChild(bg);}
  bg.innerHTML=h;bg.classList.add('show');
}
function closeReadTimeline(){const bg=document.getElementById('rt-modal');if(bg)bg.classList.remove('show');}
// 编辑书籍信息（书名/作者/标签）。标签用 genre 类，存好后能在题材筛选里出现。
const TAG_SUGGEST=['耽美','纯爱','言情','百合','无CP','强强','年下','现代','古代','校园','星际','末世','虫族','兽世','仙侠','玄幻','娱乐圈','电竞','重生','穿越','穿书','快穿','系统','种田','异能','ABO','哨向','马甲','万人迷','美强惨','病娇','团宠','救赎','暗恋','双向奔赴','破镜重圆','先婚后爱','甜文','虐文','爽文','沙雕','治愈','正剧','悬疑','HE','BE'];
let MY_TAGS=[],HIDDEN_TAGS=[];
function loadMyTags(){try{MY_TAGS=JSON.parse(localStorage.getItem('mylib_my_tags')||'[]');}catch(e){MY_TAGS=[];}}
function saveMyTags(){try{localStorage.setItem('mylib_my_tags',JSON.stringify((MY_TAGS||[]).slice(0,300)));}catch(e){}}
function loadHiddenTags(){try{HIDDEN_TAGS=JSON.parse(localStorage.getItem('mylib_hidden_tags')||'[]');}catch(e){HIDDEN_TAGS=[];}}
function saveHiddenTags(){try{localStorage.setItem('mylib_hidden_tags',JSON.stringify((HIDDEN_TAGS||[]).slice(0,500)));}catch(e){}}
function rememberTag(name){name=(name||'').trim();if(!name)return;HIDDEN_TAGS=(HIDDEN_TAGS||[]).filter(t=>t!==name);saveHiddenTags();if(TAG_SUGGEST.includes(name)||MY_TAGS.includes(name))return;MY_TAGS.unshift(name);saveMyTags();}
function tagSuggestList(){const hid=new Set(HIDDEN_TAGS||[]);return (MY_TAGS||[]).concat(TAG_SUGGEST.filter(t=>!(MY_TAGS||[]).includes(t))).filter(t=>!hid.has(t));}
// 从标签库里删一个建议词：自定义的直接删，内置的记进"隐藏表"以后不再出现（都存本机浏览器）
function removeSuggestTag(name,bid,ev){
  if(ev){ev.stopPropagation();}
  if((MY_TAGS||[]).includes(name)){MY_TAGS=MY_TAGS.filter(t=>t!==name);saveMyTags();}
  else{if(!(HIDDEN_TAGS||[]).includes(name)){HIDDEN_TAGS.push(name);saveHiddenTags();}}
  const box=document.getElementById('eb-suggest');if(box)box.innerHTML=renderEbSuggestInner(bid);
}
function renderEbSuggestInner(bid){
  return tagSuggestList().map(t=>{const ta=esc(t).replace(/'/g,"\\'");
    return `<span class="eb-sg"><span class="eb-sg-add" onclick="addBookTag(${bid},'${ta}')">${esc(t)}</span><i class="eb-sg-x" title="从标签库删除" onclick="removeSuggestTag('${ta}',${bid},event)">×</i></span>`;}).join('');
}
function editBookField(bid, field){
  const b=findBook(bid); if(!b)return;
  const isTitle = field==='title';
  const cur = isTitle ? (b.t||'') : (b.a||'');
  const v = prompt('修改'+(isTitle?'标题':'作者')+'：', cur);
  if(v===null) return;
  const nv=v.trim(); if(!nv || nv===cur) return;
  if(isTitle) b.t=nv; else b.a=nv;
  const body={id:bid}; body[field]=nv;
  fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(()=>{});
  try{const mt=document.querySelector('#modal .mc-title'); if(mt&&isTitle)mt.textContent=nv;}catch(e){}
  openBook(bid);          // 重渲染详情，标题/作者立即更新
  render();               // 书架也跟着更新
  toast((isTitle?'标题':'作者')+'已更新');
}
function editBook(bid){
  const b=findBook(bid);if(!b)return;
  document.getElementById('modal').innerHTML=`
    <div class="modal-body" style="padding-top:18px">
      <div class="eb-head"><b>编辑书籍信息</b><button class="mc-close" style="position:static" onclick="openBook(${bid})">×</button></div>
      <label class="eb-l">书名</label>
      <input class="eb-in" id="eb-title" value="${esc(b.t).replace(/"/g,'&quot;')}">
      <label class="eb-l">作者</label>
      <input class="eb-in" id="eb-author" value="${esc(b.a).replace(/"/g,'&quot;')}">
      <label class="eb-l">标签（题材）<span style="color:var(--ink-faint);font-weight:400">这本书的标签点 × 删；下面是标签库，点词加进来、点词上的 × 从库里删</span></label>
      <div class="eb-tags" id="eb-tags">${renderEbTags(b)}</div>
      <input class="eb-in" id="eb-newtag" placeholder="输入标签回车添加…" onkeydown="if(event.key==='Enter'){addBookTag(${bid},this.value);this.value='';}">
      <div class="eb-suggest" id="eb-suggest">${renderEbSuggestInner(bid)}</div>
      <div class="eb-actions">
        <button class="ma-btn primary" onclick="saveBookEdit(${bid})"><svg viewBox="0 0 24 24" class="ic"><path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM17.4571 9.45711L11 15.9142L6.79289 11.7071L8.20711 10.2929L11 13.0858L16.0429 8.04289L17.4571 9.45711Z"></path></svg>保存</button>
        <button class="ma-btn" onclick="openBook(${bid})">取消</button>
        <button class="ma-btn danger" onclick="deleteBook(${bid})"><svg viewBox="0 0 24 24" class="ic"><path d="M7 4V2H17V4H22V6H20V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V6H2V4H7ZM6 6V20H18V6H6ZM9 9H11V17H9V9ZM13 9H15V17H13V9Z"></path></svg>删除</button>
      </div>
    </div>`;
}
function renderEbTags(b){
  const gs=b.genres||[];
  if(!gs.length)return '<span style="color:var(--ink-faint);font-size:13px">还没有标签</span>';
  return gs.map(g=>`<span class="tag-chip">${esc(g)}<span class="ebx" onclick="removeBookTag(${b.id},'${g.replace(/'/g,"\\'")}')">×</span></span>`).join('');
}
async function addBookTag(bid,name){
  name=(name||'').trim();if(!name)return;
  rememberTag(name);                       // 自定义标签进入标签库，下次作为建议出现
  const b=findBook(bid);if(!b)return;b.genres=b.genres||[];
  if(b.genres.includes(name)){toast('已有这个标签');return;}
  b.genres.push(name);b.g=b.genres[0];
  document.getElementById('eb-tags').innerHTML=renderEbTags(b);
  try{await fetch('/api/tag',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,action:'add',name,kind:'genre'})});}catch(e){}
  saveShelfCache();
}
async function removeBookTag(bid,name){
  const b=findBook(bid);if(!b)return;
  b.genres=(b.genres||[]).filter(g=>g!==name);b.g=b.genres[0]||'未分类';
  document.getElementById('eb-tags').innerHTML=renderEbTags(b);
  try{await fetch('/api/tag',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,action:'remove',name})});}catch(e){}
  saveShelfCache();
}
async function saveBookEdit(bid){
  const b=findBook(bid);if(!b)return;
  const t=document.getElementById('eb-title').value.trim(), a=document.getElementById('eb-author').value.trim();
  if(t)b.t=t; if(a)b.a=a;
  try{await fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,title:b.t,author:b.a})});}catch(e){}
  saveShelfCache();toast('已保存');updateFilterSummary();render();openBook(bid);
}
async function deleteBook(bid){
  const b=DATA.find(x=>x.id===bid);if(!b)return;
  if(!confirm('删除《'+b.t+'》？\n（从书库移除，文件会移到书库下的 _recycle 回收文件夹，不会直接抹掉；划线/笔记一并清除）'))return;
  try{
    const r=await (await fetch('/api/book/'+bid,{method:'DELETE'})).json();
    if(r.ok){DATA=DATA.filter(x=>x.id!==bid);saveShelfCache();toast('已删除（在 _recycle 里可找回）');closeModal();updateFilterSummary();render();}
    else toast('删除失败：'+(r.error||''));
  }catch(e){toast('删除失败');}
}
function saveShelfCache(){try{sessionStorage.setItem('shelf_cache',JSON.stringify(DATA));sessionStorage.setItem('shelf_cache_at',''+Date.now());}catch(e){}}
// 手动理清章节：解析并存回库（给没有明确目录的书用）
async function parseChapters(bid){
  const tx=document.getElementById('modal-ch-text');
  const row=document.getElementById('modal-ch-result');row.style.display='flex';tx.textContent='理清中…（长篇要数一会儿）';
  try{
    const r=await (await fetch('/api/book/parse-chapters',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid})})).json();
    if(!r.ok){tx.textContent=r.error||'理清失败';return;}
    const b=findBook(bid);if(b){b.chapters=r.chapters;b.extras=r.extras;}
    let s=`<span style="color:var(--green)">已理清并保存：正文 ${r.chapters} 章`;
    if(r.extras)s+=` · 番外 ${r.extras}`;
    if(r.volumes)s+=` · 卷 ${r.volumes}`;
    s+='</span>';
    if(!r.has_structure)s+=`<br><span style="color:var(--ink-faint);font-size:12px">没认出明确的章节标记（可能是无目录的合集/单章）</span>`;
    else if(r.samples&&r.samples.length)s+=`<br><span style="color:var(--ink-faint);font-size:12px">例：${r.samples.slice(0,3).map(esc).join(' / ')}</span>`;
    tx.innerHTML=s;
    toast('章节已理清并保存');
  }catch(e){tx.textContent='理清失败，请检查服务';}
}
// 查缺章
async function checkChapters(bid){
  const tx=document.getElementById('modal-ch-text');
  const row=document.getElementById('modal-ch-result');row.style.display='flex';tx.textContent='检测中…';
  try{
    const r=await (await fetch('/api/book/check-chapters?id='+bid)).json();
    if(!r.ok){tx.textContent=r.error||'无法检测';return;}
    if(r.note){tx.textContent=r.note;return;}
    if(r.continuous){
      tx.innerHTML=`<span style="color:var(--green)">章节连续，共 ${r.detected} 章（第${r.range[0]}–${r.range[1]}章）</span>`;
    }else{
      const miss=r.missing.slice(0,15).map(n=>'第'+n+'章').join('、');
      tx.innerHTML=`<span style="color:var(--accent)">可能缺 ${r.missing_count} 章：${miss}${r.missing_count>15?' 等':''}</span>`;
    }
    if(r.duplicates&&r.duplicates.length){
      tx.innerHTML+=`<br><span style="color:var(--ink-faint);font-size:12px">有重复编号：${r.duplicates.slice(0,10).map(n=>'第'+n+'章').join('、')}</span>`;
    }
  }catch(e){tx.textContent='检测失败';}
}
// 颜色加深（封面渐变用）
function shade(hex,pct){const n=parseInt(hex.slice(1),16);let r=(n>>16)+pct,g=((n>>8)&255)+pct,b=(n&255)+pct;r=Math.max(0,Math.min(255,r));g=Math.max(0,Math.min(255,g));b=Math.max(0,Math.min(255,b));return '#'+((r<<16)|(g<<8)|b).toString(16).padStart(6,'0');}
// 可点击评分
function ratingStars(bid,rating){let h='';for(let i=1;i<=5;i++){h+=`<span onclick="setRating(${bid},${i})" style="cursor:pointer">${i<=rating?'★':'☆'}</span>`;}return h;}
function setRating(bid,r){const b=DATA.find(x=>x.id===bid);if(!b)return;b.rating=r;fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,rating:r})});document.getElementById('modal-stars').innerHTML=ratingStars(bid,r);toast('评分已更新');}
// 总评/简评：点一下变成输入框，失焦保存（存在 user_notes）
function editReview(bid){
  const cell=document.getElementById('modal-review');if(!cell||cell.querySelector('textarea'))return;
  const b=findBook(bid);
  const cur=(b&&b.un)?b.un:'';
  cell.innerHTML=`<textarea class="rv-edit" id="rv-edit" placeholder="写点这本书的总评 / 简评 / 备注…（朋友圈书单会用到）" onblur="saveReview(${bid},this.value)">${esc(cur)}</textarea>`;
  const ta=document.getElementById('rv-edit');ta.focus();ta.setSelectionRange(cur.length,cur.length);
}
async function saveReview(bid,val){
  val=(val||'').trim();
  const b=findBook(bid);if(b)b.un=val;
  let ok=false;
  try{const r=await fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,user_notes:val})});ok=r.ok;}catch(e){}
  const cell=document.getElementById('modal-review');
  if(cell&&!cell.querySelector('textarea'))cell.innerHTML=val?esc(val):'<span class="rv-ph">写点这本书的总评 / 简评 / 备注…</span>';
  if(!ok)toast('总评没保存成功，请检查服务后重试');else toast('总评已保存');
}
// 完结状态徽章（可点切换：完结/连载/未知）
function finBadge(bid,b){
  const cur=b.finished?'完结':b.ongoing?'连载中':'未知';
  return `<span class="fin-toggle" onclick="cycleFin(${bid})" style="cursor:pointer">${cur} <span style="color:var(--ink-faint);font-size:11px">点击切换</span></span>`;
}
function cycleFin(bid){
  const b=DATA.find(x=>x.id===bid);if(!b)return;
  // 未知 → 完结 → 连载 → 未知
  let next;
  if(b.finished){b.finished=false;b.ongoing=true;next=0;}
  else if(b.ongoing){b.finished=false;b.ongoing=false;next=null;}
  else{b.finished=true;b.ongoing=false;next=1;}
  fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,is_finished:next})});
  document.getElementById('modal-fin').innerHTML=finBadge(bid,b);
  render();
}
async function uploadCover(bid,input){
  const file=input.files[0];if(!file)return;
  toast('上传封面中…');
  const form=new FormData();form.append('file',file);
  try{
    const r=await (await fetch('/api/cover/upload?book_id='+bid,{method:'POST',body:form})).json();
    if(r.ok){
      const b=DATA.find(x=>x.id===bid);if(b)b.cover=true;
      toast('封面已更新');
      openBook(bid);  // 重开详情卡刷新封面
      render();       // 刷新书架
    }else{toast('上传失败');}
  }catch(e){toast('上传出错');}
}
function closeModal(){
  // 关弹窗前若总评还在编辑，先存一次，避免没失焦就关掉导致丢失
  const ta=document.getElementById('rv-edit');
  if(ta&&ta.dataset.bid)saveReview(parseInt(ta.dataset.bid),ta.value);
  document.getElementById('modal-bg').classList.remove('show');
}
function toggleFav(bid){const b=DATA.find(x=>x.id===bid);if(!b)return;b.fav=!b.fav;fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bid,is_favorite:b.fav?1:0})});const btn=document.getElementById('modal-fav');btn.classList.toggle('on',b.fav);btn.innerHTML=btn.innerHTML.replace(/收藏|已收藏/,b.fav?'已收藏':'收藏');render();}
// 书架：把书移出"在读"（不删书）

// ===== 下载篮（localStorage 不可用，存内存+服务端可扩展）=====
function loadCart(){try{const s=sessionStorage.getItem('mylib_cart');if(s)cart=new Set(JSON.parse(s));}catch(e){}try{const h=sessionStorage.getItem('mylib_history');if(h)history=JSON.parse(h);}catch(e){}}
function saveCart(){try{sessionStorage.setItem('mylib_cart',JSON.stringify([...cart]));}catch(e){}}
function updateCart(){const n=cart.size;const el=document.getElementById('cart-n');el.textContent=n;el.style.display=n?'flex':'none';document.getElementById('cart-foot-n').textContent=n;}
let cartView='cart';
function openCart(){document.getElementById('cart-drawer').classList.add('show');cartTab('cart');}
function closeCart(){document.getElementById('cart-drawer').classList.remove('show');}
function cartTab(t){cartView=t;document.querySelectorAll('.cart-tab').forEach(e=>e.classList.toggle('on',e.dataset.t===t));renderCart();}
function renderCart(){
  const body=document.getElementById('cart-body'),foot=document.getElementById('cart-foot');
  if(cartView==='cart'){
    foot.style.display='block';
    const items=[...cart].map(id=>DATA.find(b=>b.id===id)).filter(Boolean);
    body.innerHTML=items.length?items.map(b=>`<div class="cart-item"><div class="ci-cov" style="background:${b.c}"></div><div class="ci-info"><div class="ci-t">${esc(b.t)}</div><div class="ci-s">${esc(b.a)} · ${b.wc}万字</div></div><button class="ci-x" onclick="rmCart(${b.id})">×</button></div>`).join(''):'<div class="empty" style="padding:40px">下载篮是空的<br><span style="font-size:12px">选书后拖到「加入下载篮」</span></div>';
  }else{
    foot.style.display='none';
    body.innerHTML=history.length?history.map(h=>`<div class="dl-record"><svg viewBox="0 0 24 24" class="ic"><path d="M4 19H20V12H22V20C22 20.5523 21.5523 21 21 21H3C2.44772 21 2 20.5523 2 20V12H4V19ZM14 9H19L12 16L5 9H10V3H14V9Z"></path></svg><b>${h.date}</b> 下载了 ${h.n} 本</div>`).join(''):'<div class="empty" style="padding:40px">还没有下载记录</div>';
  }
}
function rmCart(id){cart.delete(id);saveCart();updateCart();renderCart();}
async function doDownload(){
  if(!cart.size){toast('下载篮是空的');return;}
  const ids=[...cart],n=ids.length;
  toast('正在打包 '+n+' 本…');
  try{
    const resp=await fetch('/api/download/pack',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_ids:ids})});
    if(resp.ok){
      const blob=await resp.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mylib_books_'+new Date().toISOString().slice(0,10)+'.zip';a.click();URL.revokeObjectURL(url);
      history.unshift({date:new Date().toISOString().slice(0,10),n});try{sessionStorage.setItem('mylib_history',JSON.stringify(history));}catch(e){}
      cart.clear();saveCart();updateCart();renderCart();toast('已下载 '+n+' 本');
    }else{toast('打包失败');}
  }catch(e){toast('下载出错: '+e.message);}
}
// ===== 书单导出 =====
let blFmt='text',blTheme='paper',blContent='',blMime='',_blIds=null;
// 从阅读记录生成书单：用读过/在读的书（不依赖多选）
async function openBooklistFromJourney(){
  let ids=[];
  try{
    const r=await (await fetch('/api/journey/booklist')).json();
    ids=(r.books||[]).map(b=>b.id).filter(x=>x);
  }catch(e){}
  if(!ids.length){
    // 退回到本地 DATA 里读过/在读的
    ids=(DATA||[]).filter(b=>b.reading||b.rstatus==='finished').map(b=>b.id);
  }
  if(!ids.length){toast('还没有读过的书');return;}
  _blIds=ids;
  document.getElementById('bl-bg').classList.add('show');
  document.getElementById('bl-title').value='我读过的书单';
  refreshBooklist();
}
function closeBooklist(){document.getElementById('bl-bg').classList.remove('show');}
async function refreshBooklist(){
  const title=document.getElementById('bl-title').value||'我的书单';
  const useAi=document.getElementById('bl-ai').checked;
  const ids=(_blIds&&_blIds.length)?_blIds:[...selected];
  const prev=document.getElementById('bl-preview');
  prev.innerHTML='<div style="color:var(--ink-faint);font-family:var(--sans);padding:40px">生成中…</div>';
  try{
    const resp=await fetch('/api/booklist/export',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({book_ids:ids,title,format:blFmt,theme:blTheme,use_ai:useAi})});
    const data=await resp.json();
    blContent=data.content;blMime=data.mime;
    if(blFmt==='svg'){prev.innerHTML=blContent;}
    else{prev.innerHTML='<pre>'+esc(blContent)+'</pre>';}
  }catch(e){prev.innerHTML='<div style="color:var(--accent);padding:40px">生成失败</div>';}
}
document.addEventListener('DOMContentLoaded',()=>{});
function blBindControls(){
  document.querySelectorAll('#bl-fmt button').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#bl-fmt button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    blFmt=b.dataset.f;
    document.getElementById('bl-theme').style.display=blFmt==='svg'?'flex':'none';
    refreshBooklist();
  }));
  document.querySelectorAll('#bl-theme button').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#bl-theme button').forEach(x=>x.classList.remove('on'));b.classList.add('on');
    blTheme=b.dataset.t;refreshBooklist();
  }));
  document.getElementById('bl-title').addEventListener('input',()=>{clearTimeout(window._blt);window._blt=setTimeout(refreshBooklist,400);});
  document.getElementById('bl-ai').addEventListener('change',refreshBooklist);
}
function copyBooklist(){
  if(blFmt==='svg'){toast('图片请用下载');return;}
  navigator.clipboard&&navigator.clipboard.writeText(blContent);toast('已复制，可贴到备忘录/微博');
}
function downloadBooklist(){
  if(!blContent){toast('还没生成');return;}
  let blob,fn;const title=document.getElementById('bl-title').value||'书单';
  if(blFmt==='svg'){blob=new Blob([blContent],{type:'image/svg+xml'});fn=title+'.svg';}
  else if(blFmt==='markdown'){blob=new Blob([blContent],{type:'text/markdown'});fn=title+'.md';}
  else{blob=new Blob([blContent],{type:'text/plain'});fn=title+'.txt';}
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=fn;a.click();URL.revokeObjectURL(url);
  toast('已下载 '+fn);
}

// ===== 二维码连接 =====
async function openQR(){
  const bg=document.getElementById('qr-bg');bg.classList.add('show');
  const urlEl=document.getElementById('qr-url');const canvas=document.getElementById('qr-canvas');
  urlEl.textContent='获取地址…';canvas.innerHTML='';
  try{
    const info=await (await fetch('/api/serverinfo')).json();
    const url=info.lan_url||location.origin+'/';
    urlEl.textContent=url;
    // 用 qrserver 在线生成（最稳，二维码图片）；离线时降级显示文字地址
    const img=new Image();
    img.onerror=()=>{canvas.innerHTML='<div style="padding:40px;font-size:13px;color:var(--ink-soft)">二维码需联网生成<br>请手动输入上方地址</div>';};
    img.src='https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data='+encodeURIComponent(url);
    canvas.appendChild(img);
  }catch(e){urlEl.textContent='获取失败';}
}
function closeQR(){document.getElementById('qr-bg').classList.remove('show');}

// ===== Quill 书库精灵 =====
// 入口形象（化身）——用 Lucide 开源图标，简洁优雅。Quill 始终是 Quill，这只是它显示的样子。
// 都是无机/静物，点击有微互动
const QUILL_AVATARS={
  feather:{name:'羽毛笔',svg:'<svg viewBox=\"0 0 24 24\"><path d=\"M21 1.99669C6 1.99669 4 15.9967 3 21.9967C3.66667 21.9967 4.33275 21.9967 4.99824 21.9967C5.66421 18.6636 7.33146 16.8303 10 16.4967C14 15.9967 17 12.4967 18 9.49669L16.5 8.49669C16.8333 8.16336 17.1667 7.83002 17.5 7.49669C18.5 6.49669 19.5042 4.99669 21 1.99669Z\"></path></svg>'},
  clock:{name:'小钟表',svg:'clock'},
  sprout:{name:'小草',svg:'<svg viewBox=\"0 0 24 24\"><path d=\"M20.998 3V5C20.998 8.86599 17.864 12 13.998 12H12.998V13H17.998V20C17.998 21.1046 17.1026 22 15.998 22H7.99805C6.89348 22 5.99805 21.1046 5.99805 20V13H10.998V10C10.998 6.13401 14.1321 3 17.998 3H20.998ZM5.49805 2C8.02667 2 10.263 3.25136 11.6216 5.1686C10.6026 6.51084 9.99805 8.18482 9.99805 10V11H9.49805C5.35591 11 1.99805 7.64214 1.99805 3.5V2H5.49805Z\"></path></svg>'},
  sparkle:{name:'萤火',svg:'<svg viewBox=\"0 0 24 24\"><path d=\"M17.0007 1.20825 18.3195 3.68108 20.7923 4.99992 18.3195 6.31876 17.0007 8.79159 15.6818 6.31876 13.209 4.99992 15.6818 3.68108 17.0007 1.20825ZM8.00065 4.33325 10.6673 9.33325 15.6673 11.9999 10.6673 14.6666 8.00065 19.6666 5.33398 14.6666.333984 11.9999 5.33398 9.33325 8.00065 4.33325ZM19.6673 16.3333 18.0007 13.2083 16.334 16.3333 13.209 17.9999 16.334 19.6666 18.0007 22.7916 19.6673 19.6666 22.7923 17.9999 19.6673 16.3333Z\"></path></svg>'},
  moon:{name:'月相',svg:'moon'},  // 特殊：显示当前月相
  leaf:{name:'叶子',svg:'<svg viewBox=\"0 0 24 24\"><path d=\"M20.998 3V5C20.998 14.6274 15.6255 19 8.99805 19L7.0964 18.9999C7.3079 15.9876 8.24541 14.1648 10.6939 11.9989C11.8979 10.9338 11.7965 10.3189 11.2029 10.6721C7.1193 13.1016 5.09114 16.3862 5.00119 21.6302L4.99805 22H2.99805C2.99805 20.6373 3.11376 19.3997 3.34381 18.2682C3.1133 16.9741 2.99805 15.2176 2.99805 13C2.99805 7.47715 7.4752 3 12.998 3C14.998 3 16.998 4 20.998 3Z\"></path></svg>'},
};
// 月相计算：返回 0-1 的月相（0=新月，0.5=满月）
function moonPhase(){
  const now=new Date();
  // 已知2000-01-06 18:14 UTC为新月，朔望月周期29.530588853天
  const known=new Date(Date.UTC(2000,0,6,18,14)).getTime();
  const synodic=29.530588853*86400000;
  let phase=((now.getTime()-known)%synodic)/synodic;
  if(phase<0)phase+=1;
  return phase;
}
// 画月相 SVG：用两个圆的遮罩做出月牙
function moonSVG(){
  const p=moonPhase();
  // 光照比例：0=全暗 0.5=半 1=全亮
  // 用椭圆终结线模拟明暗边界
  const r=8.5;
  // illum: 0..1 被照亮的比例
  const illum=(1-Math.cos(2*Math.PI*p))/2;
  // 终结线椭圆的横向半轴（带符号决定凸向）
  const waxing=p<0.5;  // 上半月（右侧亮）
  const ex=r*Math.abs(Math.cos(2*Math.PI*p));
  const leftFlat=waxing;  // 上弦右亮
  // 用 path 画亮面
  let d;
  const cx=12,cy=12;
  if(Math.abs(p-0.5)<0.02){
    // 满月
    d=`M${cx} ${cy-r} A${r} ${r} 0 1 1 ${cx} ${cy+r} A${r} ${r} 0 1 1 ${cx} ${cy-r}`;
  }else if(p<0.02||p>0.98){
    // 新月：只画轮廓
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="12" cy="12" r="${r}" opacity="0.35"/></svg>`;
  }else{
    // 外弧（亮面外缘）
    const sweepOuter=waxing?1:0;
    // 内弧（终结线，椭圆）
    const sweepInner=(illum<0.5)?(waxing?1:0):(waxing?0:1);
    const rx=ex;
    d=`M${cx} ${cy-r} A${r} ${r} 0 0 ${sweepOuter} ${cx} ${cy+r} A${rx} ${r} 0 0 ${sweepInner} ${cx} ${cy-r} Z`;
  }
  return `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="${r}" fill="none" stroke="currentColor" stroke-width="1.1" opacity="0.3"/><path d="${d}" fill="currentColor"/></svg>`;
}
// 萤火：界面零星浮现荧光点，有间隔
let fireflyTimer=null;
function toggleFireflies(on){
  if(fireflyTimer){clearInterval(fireflyTimer);fireflyTimer=null;}
  document.querySelectorAll('.firefly-dot').forEach(e=>e.remove());
  if(!on)return;
  const spawn=()=>{
    // 一次飘 2-4 个，随机位置
    const n=2+Math.floor(Math.random()*3);
    for(let i=0;i<n;i++){
      setTimeout(()=>{
        const f=document.createElement('div');f.className='firefly-dot';
        f.style.left=(10+Math.random()*80)+'vw';
        f.style.top=(15+Math.random()*70)+'vh';
        f.style.animationDuration=(3+Math.random()*2)+'s';
        document.body.appendChild(f);
        setTimeout(()=>f.remove(),5000);
      },i*600);
    }
  };
  spawn();
  // 每隔 6-10 秒来一波（有间隔）
  fireflyTimer=setInterval(spawn,7000);
}
let quillSessionId=null,quillGreeted=false,quillClockTimer=null;
function getQuillAvatar(){return localStorage.getItem('quill_avatar')||'feather';}
// 点击浮钮：先播放对应形象的微互动，再开面板
const AVATAR_ACT={feather:'act-swing',clock:'act-swing',sprout:'act-bounce',sparkle:'act-glow',moon:'act-float',leaf:'act-bounce'};
function quillFabClick(){
  if(window._quillDragged){window._quillDragged=false;return;}  // 拖动后不触发点击
  const fab=document.getElementById('quill-fab');
  const act=AVATAR_ACT[getQuillAvatar()]||'act-bounce';
  fab.classList.remove('act-float','act-swing','act-bounce','act-glow');
  void fab.offsetWidth;
  fab.classList.add(act);
  setTimeout(()=>openQuill(),260);
}
// 浮钮可拖动换位置
function initQuillDrag(){
  const fab=document.getElementById('quill-fab');if(!fab)return;
  // 恢复保存的位置
  const pos=localStorage.getItem('quill_fab_pos');
  if(pos){try{const p=JSON.parse(pos);fab.style.left=p.x+'px';fab.style.top=p.y+'px';fab.style.right='auto';fab.style.bottom='auto';}catch(e){}}
  let dragging=false,sx,sy,ox,oy,moved=false;
  const start=(e)=>{
    dragging=true;moved=false;
    const t=e.touches?e.touches[0]:e;
    sx=t.clientX;sy=t.clientY;
    const r=fab.getBoundingClientRect();ox=r.left;oy=r.top;
    fab.style.transition='none';
  };
  const move=(e)=>{
    if(!dragging)return;
    const t=e.touches?e.touches[0]:e;
    const dx=t.clientX-sx,dy=t.clientY-sy;
    if(Math.abs(dx)>5||Math.abs(dy)>5)moved=true;
    if(moved){
      if(e.cancelable)e.preventDefault();
      let nx=ox+dx,ny=oy+dy;
      nx=Math.max(4,Math.min(window.innerWidth-60,nx));
      ny=Math.max(4,Math.min(window.innerHeight-60,ny));
      fab.style.left=nx+'px';fab.style.top=ny+'px';fab.style.right='auto';fab.style.bottom='auto';
    }
  };
  const end=()=>{
    if(!dragging)return;dragging=false;fab.style.transition='';
    if(moved){
      window._quillDragged=true;
      const r=fab.getBoundingClientRect();
      localStorage.setItem('quill_fab_pos',JSON.stringify({x:r.left,y:r.top}));
    }
  };
  fab.addEventListener('mousedown',start);
  document.addEventListener('mousemove',move);
  document.addEventListener('mouseup',end);
  fab.addEventListener('touchstart',start,{passive:true});
  document.addEventListener('touchmove',move,{passive:false});
  document.addEventListener('touchend',end);
}
function avatarInner(k,v){
  if(v.svg==='clock')return clockSVG();
  if(v.svg==='moon')return moonSVG();
  return v.svg;
}
function renderQuillAvatars(){
  const cur=getQuillAvatar();
  document.getElementById('quill-avatars').innerHTML=Object.entries(QUILL_AVATARS).map(([k,v])=>{
    return `<div class="qav ${k===cur?'on':''}" title="${v.name}" onclick="setQuillAvatar('${k}')">${avatarInner(k,v)}</div>`;
  }).join('');
}
function setQuillAvatar(k){
  localStorage.setItem('quill_avatar',k);renderQuillAvatars();updateFabAvatar();syncAppIcons();
  // 记到服务器，让“安装到桌面/主屏”的图标也跟着这个形象
  try{fetch('/api/quill-avatar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({avatar:k})});}catch(e){}
}
// 让浏览器标签页图标 + 苹果主屏图标 跟随当前 Quill 形象
function syncAppIcons(){
  try{
    const av=getQuillAvatar();
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(l=>l.href='/static/app-icon-192.png?avatar='+av);
    let fav=document.querySelector('link[rel="icon"]');
    if(!fav){fav=document.createElement('link');fav.rel='icon';document.head.appendChild(fav);}
    fav.type='image/svg+xml';fav.href='/static/app-icon.svg?avatar='+av;
  }catch(e){}
}
// 显示/隐藏悬浮入口
function toggleQuillFab(show){
  localStorage.setItem('quill_fab_show',show?'1':'0');
  const fab=document.getElementById('quill-fab');
  if(show){if(!document.getElementById('quill-panel').classList.contains('show'))fab.style.display='flex';}
  else{fab.style.display='none';closeQuill();}
}
function loadQuillFabPref(){
  const show=localStorage.getItem('quill_fab_show');
  const cb=document.getElementById('quill-show-fab');
  if(show==='0'){
    if(cb)cb.checked=false;
    const fab=document.getElementById('quill-fab');if(fab)fab.style.display='none';
  }
}
// 实时钟表 SVG（指针按当前时间）
function clockSVG(){
  const now=new Date();const h=now.getHours()%12,m=now.getMinutes();
  const ha=(h*30+m*0.5-90)*Math.PI/180,ma=(m*6-90)*Math.PI/180;
  const hx=12+4*Math.cos(ha),hy=12+4*Math.sin(ha),mx=12+6.5*Math.cos(ma),my=12+6.5*Math.sin(ma);
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="12" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}"/><line x1="12" y1="12" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}"/></svg>`;
}
function updateFabAvatar(){
  const fab=document.getElementById('quill-fab');if(!fab)return;
  const k=getQuillAvatar();const v=QUILL_AVATARS[k];
  fab.innerHTML=avatarInner(k,v);
  if(quillClockTimer){clearInterval(quillClockTimer);quillClockTimer=null;}
  if(k==='clock'){quillClockTimer=setInterval(()=>{if(document.getElementById('quill-fab'))document.getElementById('quill-fab').innerHTML=clockSVG();},30000);}
  // 萤火形象：启动界面荧光
  toggleFireflies(k==='sparkle');
}
function openQuill(){
  document.getElementById('quill-fab').style.display='none';
  document.getElementById('quill-panel').classList.add('show');
  loadQuillCfg();
  renderQuillAvatars();
  if(!quillGreeted){
    quillGreeted=true;
    if(!document.getElementById('quill-msgs').children.length)
      addQuillMsg('我是 Quill。想聊聊正在读的书，或者让我帮你找点什么、记点什么，都可以。','quill');
  }
  setTimeout(()=>document.getElementById('quill-text').focus(),100);
}
function closeQuill(){
  document.getElementById('quill-panel').classList.remove('show');
  document.getElementById('quill-fab').style.display='flex';
}
function toggleQuillSettings(){document.getElementById('quill-settings').classList.toggle('show');document.getElementById('quill-sessions').classList.remove('show');}
// 会话记录
async function toggleQuillSessions(){
  const panel=document.getElementById('quill-sessions');
  document.getElementById('quill-settings').classList.remove('show');
  if(panel.classList.contains('show')){panel.classList.remove('show');return;}
  panel.classList.add('show');
  await loadQuillSessions();
}
async function loadQuillSessions(){
  try{
    const r=await (await fetch('/api/quill/sessions')).json();
    const list=document.getElementById('qsess-list');
    if(!r.sessions||!r.sessions.length){list.innerHTML='<div style="padding:14px;color:var(--ink-faint);font-size:12px;text-align:center">还没有对话记录</div>';return;}
    list.innerHTML=r.sessions.map(s=>{
      const date=(s.updated_at||'').slice(5,10);
      return `<div class="qsess-item ${s.id===quillSessionId?'active':''}" onclick="loadQuillSession(${s.id})">
        <div class="qsess-info"><div class="qsess-title">${esc(s.title||'对话')}</div><div class="qsess-meta">${s.book_title?esc(s.book_title)+' · ':''}${date}</div></div>
        <span class="qsess-del" onclick="event.stopPropagation();delQuillSession(${s.id})">×</span>
      </div>`;
    }).join('');
  }catch(e){}
}
async function loadQuillSession(sid){
  quillSessionId=sid;
  try{
    const r=await (await fetch('/api/quill/session/'+sid)).json();
    const box=document.getElementById('quill-msgs');box.innerHTML='';
    (r.messages||[]).forEach(m=>addQuillMsg(m.content,m.role==='user'?'user':'quill',m.id,m.starred));
    document.getElementById('quill-sessions').classList.remove('show');
    quillGreeted=true;
  }catch(e){}
}
async function newQuillSession(){
  quillSessionId=null;
  document.getElementById('quill-msgs').innerHTML='';
  addQuillMsg('新的一页～想聊点什么？','quill');
  document.getElementById('quill-sessions').classList.remove('show');
  document.getElementById('quill-text').focus();
}
async function delQuillSession(sid){
  try{await fetch('/api/quill/session/'+sid,{method:'DELETE'});
    if(sid===quillSessionId){quillSessionId=null;document.getElementById('quill-msgs').innerHTML='';}
    loadQuillSessions();
  }catch(e){}
}
function loadQuillCfg(){
  try{
    const t=localStorage.getItem('quill_tone');if(t)document.getElementById('quill-tone').value=t;
    const p=localStorage.getItem('quill_persona');if(p)document.getElementById('quill-persona').value=p;
  }catch(e){}
  updateGrowHint();
}
function updateGrowHint(){
  const h=document.getElementById('quill-grow-hint');
  if(h)h.style.display=document.getElementById('quill-tone').value==='auto'?'block':'none';
}
function saveQuillCfg(){
  try{
    localStorage.setItem('quill_tone',document.getElementById('quill-tone').value);
    localStorage.setItem('quill_persona',document.getElementById('quill-persona').value);
  }catch(e){}
  updateGrowHint();
}
function addQuillMsg(text,who,msgId,starred){
  const box=document.getElementById('quill-msgs');
  const d=document.createElement('div');d.className='qm '+who;d.textContent=text;
  // Quill 的话可收藏
  if(who==='quill'&&msgId){
    const star=document.createElement('span');star.className='qm-star'+(starred?' on':'');star.textContent='★';
    star.title='记下这句话';
    star.onclick=()=>{toggleStar(msgId,star);};
    d.appendChild(star);
  }
  box.appendChild(d);box.scrollTop=box.scrollHeight;
  return d;
}
async function toggleStar(msgId,el){
  const on=!el.classList.contains('on');
  el.classList.toggle('on',on);
  try{await fetch('/api/quill/message/star',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message_id:msgId,starred:on})});
    toast(on?'已记下这句话':'已取消');
  }catch(e){}
}
// 把 prompt 模板填入输入栏，不发送，让用户自己改
function quillFill(template){
  openQuill();
  const inp=document.getElementById('quill-text');
  inp.value=template;
  inp.focus();
  // 光标移到末尾
  setTimeout(()=>{inp.selectionStart=inp.selectionEnd=inp.value.length;},50);
}
async function quillSend(){
  const inp=document.getElementById('quill-text');
  const msg=inp.value.trim();if(!msg)return;
  inp.value='';
  addQuillMsg(msg,'user');
  const thinking=addQuillMsg('Quill 正在翻书…','quill thinking');
  try{
    const tone=document.getElementById('quill-tone').value;
    const persona=document.getElementById('quill-persona').value;
    const r=await (await fetch('/api/quill/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({message:msg,tone,custom_persona:persona,session_id:quillSessionId,interaction_style:detectStyle(msg)})})).json();
    thinking.remove();
    quillSessionId=r.session_id||quillSessionId;
    const reply=r.reply||'（Quill 没说话）';
    addQuillMsg(reply,'quill',r.reply_id);
    if(r.timer&&r.timer.minutes)setQuillTimer(r.timer.minutes,r.timer.message);
    render();updateCart();
  }catch(e){thinking.remove();addQuillMsg('（Quill 走神了，再问一次试试）','quill');}
}
function detectStyle(msg){
  if(/哈哈|嘻嘻|呀|啦|嘿|~|～|😂|🤣/.test(msg))return 'playful';
  if(msg.length<8)return 'brief';
  if(/请|谢谢|麻烦|您/.test(msg))return 'gentle';
  return '';
}
// 快捷统计（本地，不花token）
async function quillQuick(kind){
  openQuill();
  const label={overview:'书库概览',author_ranking:'作者排行',genre_ranking:'题材分布'}[kind]||kind;
  addQuillMsg(label,'user');
  const thinking=addQuillMsg('Quill 正在数…','quill thinking');
  try{
    const r=await (await fetch('/api/quill/quickstat?kind='+kind)).json();
    thinking.remove();
    let txt='';
    if(kind==='overview'){
      txt=`你的书库现在有 ${(r.total||0).toLocaleString()} 本书，来自 ${r.authors||0} 位作者。\n收藏 ${r.favorite||0} 本，在读 ${r.reading||0} 本`;
      if(r.finished)txt+=`，已识别完结 ${r.finished} 本`;
      txt+='。';
    }else if(kind==='author_ranking'){
      const list=r.top_authors||[];
      txt='藏书最多的作者：\n'+list.map((a,i)=>`${i+1}. ${a.author} · ${a.count}本`).join('\n');
    }else if(kind==='genre_ranking'){
      const list=r.top_genres||[];
      txt=list.length?'题材分布：\n'+list.map((g,i)=>`${i+1}. ${g.genre} · ${g.count}本`).join('\n'):'还没给书打过题材标签，去管理页用 AI 打标签试试～';
    }
    addQuillMsg(txt,'quill');
  }catch(e){thinking.remove();addQuillMsg('（数到一半被打断了）','quill');}
}
// 计时提醒
function setQuillTimer(minutes,message){
  addQuillMsg(`好，${minutes} 分钟后我会提醒你：${message}`,'quill');
  setTimeout(()=>{
    toast('Quill 提醒你：'+message,5000);
    if(document.getElementById('quill-panel').classList.contains('show'))
      addQuillMsg(message,'quill');
  },minutes*60*1000);
}

// ===== 书房主题 =====
const THEME_PRESETS=[
  {id:'none',name:'纯净',bg:null},
  {id:'rice',name:'宣纸',bg:'/api/theme/asset/tile_rice.jpg',tiled:true},
  {id:'green',name:'抹茶',bg:'/api/theme/asset/tile_green.jpg',tiled:true},
  {id:'watercolor',name:'水彩',bg:'/api/theme/asset/bg_watercolor.jpg',tiled:false},
  {id:'blue',name:'雾蓝',bg:'/api/theme/asset/bg_blue.jpg',tiled:false},
];
let curTheme=null;
function openTheme(){
  document.getElementById('theme-modal').classList.add('show');
  renderThemePresets();
  renderCoverPalettes();
  loadThemeUploads();
  highlightTimeTheme();
}
function renderCoverPalettes(){
  const cur=getCoverPalette();
  const names={classic:'典雅',morandi:'莫兰迪',ink:'墨色',forest:'林绿'};
  const box=document.getElementById('cover-palettes');
  if(!box)return;
  box.innerHTML=Object.entries(COVER_PALETTES).map(([k,cols])=>{
    const sw=cols.slice(0,5).map(c=>`<span style="background:${c}"></span>`).join('');
    return `<div class="cpal ${k===cur?'on':''}" onclick="setCoverPalette('${k}')"><div class="cpal-swatches">${sw}</div><div class="cpal-name">${names[k]||k}</div></div>`;
  }).join('');
}
function highlightTimeTheme(){
  const mode=localStorage.getItem('tt_mode')||'auto';
  document.querySelectorAll('.tt-opt').forEach(b=>b.classList.toggle('on',b.dataset.tt===mode));
  // 同步功能开关状态
  document.querySelectorAll('[data-feat]').forEach(cb=>{
    const f=cb.dataset.feat;
    cb.checked=localStorage.getItem('feat_'+f)!=='0';
  });
}
function toggleFeat(feat,on){
  localStorage.setItem('feat_'+feat,on?'1':'0');
  applyFeats();
  toast(on?'已开启':'已关闭');
}
function applyFeats(){
  // Quill 浮钮
  const fabOn=localStorage.getItem('feat_fab')!=='0';
  const fab=document.getElementById('quill-fab');
  if(fab&&localStorage.getItem('quill_fab_show')!=='0')fab.style.display=fabOn?'flex':'none';
  if(!fabOn&&fab)fab.style.display='none';
  // 花园（总览里）——重新加载历程时生效
  // 装饰条/边角
  const decoOn=localStorage.getItem('feat_deco')!=='0';
  const strip=document.getElementById('theme-strip');
  if(strip&&!decoOn){strip.classList.remove('show');}
  document.querySelectorAll('.theme-corner').forEach(e=>{e.style.display=decoOn?'':'none';});
}
function featOn(feat){return localStorage.getItem('feat_'+feat)!=='0';}
function pickTimeTheme(mode){
  setTimeTheme(mode);
  highlightTimeTheme();
}
function closeTheme(){document.getElementById('theme-modal').classList.remove('show');}
function renderThemePresets(){
  const saved=localStorage.getItem('home_theme')||'none';
  document.getElementById('theme-presets').innerHTML=THEME_PRESETS.map(t=>{
    const style=t.bg?`background-image:url(${t.bg})`:'background:linear-gradient(135deg,#f3eee3,#e8e0d0)';
    return `<div class="theme-preset ${t.id===saved?'on':''}" style="${style}" onclick="applyTheme('${t.id}')"><span class="tp-name">${t.name}</span></div>`;
  }).join('');
}
function applyTheme(id){
  const t=THEME_PRESETS.find(x=>x.id===id);if(!t)return;
  localStorage.setItem('home_theme',id);
  const bg=document.getElementById('theme-bg');
  if(t.bg){
    bg.style.backgroundImage=`url(${t.bg})`;
    bg.classList.toggle('tiled',!!t.tiled);
    document.body.classList.add('has-bg');
  }else{
    bg.style.backgroundImage='';
    document.body.classList.remove('has-bg');
  }
  renderThemePresets();
  toast('主题已应用');
}
async function uploadTheme(slot,input){
  const file=input.files[0];if(!file)return;
  const fd=new FormData();fd.append('file',file);
  toast('上传中…');
  try{
    const r=await (await fetch('/api/theme/upload?slot='+slot,{method:'POST',body:fd})).json();
    if(r.ok){toast('已上传');loadThemeUploads();applyUserTheme();}
  }catch(e){toast('上传失败');}
}
async function clearTheme(slot){
  try{await fetch('/api/theme/user/'+slot,{method:'DELETE'});toast('已清除');loadThemeUploads();applyUserTheme();}catch(e){}
}
async function loadThemeUploads(){
  try{
    const r=await (await fetch('/api/theme/list')).json();
    const slots=r.slots||{};
    ['bg','strip','corner','desk_left','desk_right'].forEach(s=>{
      const prev=document.getElementById('tu-prev-'+s);
      if(!prev)return;
      if(slots[s]){prev.style.backgroundImage=`url(${slots[s]})`;const sp=prev.querySelector('span');if(sp)sp.style.display='none';}
      else{prev.style.backgroundImage='';const sp=prev.querySelector('span');if(sp)sp.style.display='';}
    });
    const vr=document.getElementById('veil-range');if(vr)vr.value=getVeil();
  }catch(e){}
}
// 背景浓淡（纸色蒙层透明度）
function getVeil(){const v=parseInt(localStorage.getItem('home_veil'));return isNaN(v)?82:v;}
function setVeil(v){
  v=parseInt(v);if(isNaN(v))v=82;
  localStorage.setItem('home_veil',v);
  applyVeil();
}
function applyVeil(){
  const veil=document.getElementById('theme-veil');
  if(veil&&document.body.classList.contains('has-bg'))veil.style.opacity=(getVeil()/100);
}
// 应用用户上传的背景/插画条/边角
async function applyUserTheme(){
  try{
    const r=await (await fetch('/api/theme/list')).json();
    const slots=r.slots||{};
    // 主背景（用户上传的优先于预设）
    if(slots.bg){
      const bg=document.getElementById('theme-bg');
      bg.style.backgroundImage=`url(${slots.bg})`;bg.classList.remove('tiled');
      document.body.classList.add('has-bg');
    }
    applyVeil();
    // 顶部插画条
    const strip=document.getElementById('theme-strip');
    if(slots.strip&&featOn('deco')){strip.innerHTML=`<img src="${slots.strip}" alt="">`;strip.classList.add('show');}
    else{strip.classList.remove('show');strip.innerHTML='';}
    // 四角装饰
    document.querySelectorAll('.theme-corner').forEach(e=>e.remove());
    if(slots.corner){
      ['tl','tr','bl','br'].forEach(pos=>{
        const img=document.createElement('img');img.className='theme-corner '+pos;img.src=slots.corner;
        document.body.appendChild(img);
      });
    }
  }catch(e){}
}
// ===== 日间/夜间时段主题 =====
function timeThemeByHour(){
  const h=new Date().getHours();
  if(h>=5&&h<9)return 'dawn';
  if(h>=9&&h<17)return 'day';
  if(h>=17&&h<20)return 'dusk';
  return 'night';
}
function applyTimeTheme(){
  const mode=localStorage.getItem('tt_mode')||'auto';  // auto/dawn/day/dusk/night
  const tt=(mode==='auto')?timeThemeByHour():mode;
  document.body.setAttribute('data-tt',tt);
  // 自动模式下每 10 分钟检查一次时段
  if(mode==='auto'){
    if(window._ttTimer)clearInterval(window._ttTimer);
    window._ttTimer=setInterval(()=>{document.body.setAttribute('data-tt',timeThemeByHour());},600000);
  }
}
function setTimeTheme(mode){
  localStorage.setItem('tt_mode',mode);
  applyTimeTheme();
  toast(mode==='auto'?'已设为随时间自动':'主题已切换');
}

function loadSavedTheme(){
  applyTimeTheme();
  const saved=localStorage.getItem('home_theme')||'none';
  const t=THEME_PRESETS.find(x=>x.id===saved);
  if(t&&t.bg){
    const bg=document.getElementById('theme-bg');
    bg.style.backgroundImage=`url(${t.bg})`;
    bg.classList.toggle('tiled',!!t.tiled);
    document.body.classList.add('has-bg');
  }
  applyUserTheme();  // 叠加用户上传的
}

function toast(msg,dur){const h=document.getElementById('hint');h.textContent=msg;h.classList.add('show');clearTimeout(window._t);window._t=setTimeout(()=>h.classList.remove('show'),dur||1800);}

// ===== PWA：安装到桌面/主屏 + 启动动画 =====
let _deferredInstall=null;
function registerPWA(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  }
  // 安装入口：只在"真能安装"时显示——手机浏览器(加到主屏)或桌面浏览器弹了安装提示时。
  // 已经是独立窗口/桌面应用本身（你现在双击打开的这个）就不显示，免得多余。
  const ua=navigator.userAgent||'';
  let standalone=false;
  try{standalone=window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone||false;}catch(e){}
  const isMobile=/iPhone|iPad|iPod|Android/i.test(ua);
  const b=document.getElementById('install-btn');
  // iOS 不会弹 beforeinstallprompt，但能"添加到主屏幕"，所以手机端先显示；桌面端等浏览器弹提示再显示
  if(b&&isMobile&&!standalone)b.style.display='';
  window.addEventListener('beforeinstallprompt',e=>{
    e.preventDefault();_deferredInstall=e;
    if(b&&!standalone)b.style.display='';
  });
  window.addEventListener('appinstalled',()=>{
    _deferredInstall=null;if(b)b.style.display='none';toast('已添加到桌面/主屏');
  });
  syncAppIcons();
}
async function installPWA(){
  if(_deferredInstall){
    _deferredInstall.prompt();
    try{await _deferredInstall.userChoice;}catch(e){}
    _deferredInstall=null;
    const b=document.getElementById('install-btn');if(b)b.style.display='none';
    return;
  }
  // 浏览器没给一键安装：按平台给清楚的"添加到主屏/桌面"指引
  const ua=navigator.userAgent||'';
  let tip;
  if(/iPhone|iPad|iPod/i.test(ua))tip='iOS：点底部「分享」→「添加到主屏幕」，桌面就会出现这个应用图标';
  else if(/Android/i.test(ua))tip='安卓：点浏览器右上角菜单「⋮」→「添加到主屏幕 / 安装应用」';
  else tip='电脑：点地址栏右侧的「安装」图标，或浏览器菜单里选「安装此应用」，桌面就会有快捷方式';
  toast(tip,4200);
}
function dismissBootSplash(){
  const sp=document.getElementById('boot-splash');
  if(!sp)return;
  // 内容就绪后稍候淡出，让动画走完一拍
  setTimeout(()=>{sp.classList.add('gone');setTimeout(()=>sp.remove(),700);},900);
}

// ===== 后台任务指示条（管理任务运行时显示，可折叠到边上）=====
function toggleBgTask(){
  const bar=document.getElementById('bgtask-bar');if(!bar)return;
  const mini=!bar.classList.contains('mini');
  bar.classList.toggle('mini',mini);
  try{localStorage.setItem('bgtask_mini',mini?'1':'0');}catch(e){}
}
function startBgTaskPoll(){
  const bar=document.getElementById('bgtask-bar');
  let collapsed=false; try{collapsed=localStorage.getItem('bgtask_mini')==='1';}catch(e){}
  if(bar&&collapsed)bar.classList.add('mini');
  // 折叠态下整条可点开
  if(bar)bar.addEventListener('click',e=>{if(bar.classList.contains('mini')&&!e.target.closest('a,button')){toggleBgTask();}});
  async function poll(){
    try{
      const r=await(await fetch('/api/admin/active')).json();
      if(!bar)return;
      if(r.active){
        bar.style.display='block';
        document.getElementById('bgtask-name').textContent=r.name+(bar.classList.contains('mini')?(' '+(r.progress||0)+'%'):'');
        document.getElementById('bgtask-fill').style.width=(r.progress||0)+'%';
        document.getElementById('bgtask-msg').textContent=r.message||'处理中…';
      }else{bar.style.display='none';}
    }catch(e){}
  }
  setInterval(poll,2000);poll();
}

// ===== 阅读历程 =====
let journeyTab='overview';
// 在独立小窗里打开历程（和 管理/设置 一样开小窗）；弹窗被拦就退回当前页打开
function openJourneyWin(){ popout('/?journey=1','mylib_journey',1120,840); }
function openJourney(){document.getElementById('journey-page').classList.add('show');journeyTab='overview';loadJourney('overview');}
function closeJourney(){
  // 独立小窗模式：返回＝关掉这个小窗（关不掉就回主页）
  if(document.documentElement.classList.contains('journey-only')){try{window.close();}catch(e){} location.href='/'; return;}
  document.getElementById('journey-page').classList.remove('show');
}
// 历程分享卡片
let cardSkin='sage';
function openJourneyCard(){document.getElementById('jcard-modal').classList.add('show');refreshCard();}
function closeJourneyCard(){document.getElementById('jcard-modal').classList.remove('show');}
function pickCardSkin(skin,btn){cardSkin=skin;document.querySelectorAll('.jcsk').forEach(b=>b.classList.remove('on'));btn.classList.add('on');refreshCard();}
function refreshCard(){
  document.getElementById('jcard-preview').innerHTML=`<img src="/api/journey/card?theme=${cardSkin}&t=${Date.now()}" alt="阅读历程卡片">`;
}
function downloadJourneyCard(){
  const a=document.createElement('a');a.href=`/api/journey/card?theme=${cardSkin}`;a.download='我的阅读历程.svg';a.click();
  toast('卡片已下载');
}
// 标记：点击进书 + 长按删除
function bindMarkActions(){
  document.querySelectorAll('.jn-mark').forEach(el=>{
    let timer=null,longPressed=false;
    const bid=el.dataset.bid;
    const start=()=>{longPressed=false;timer=setTimeout(()=>{longPressed=true;el.classList.add('show-del');if(navigator.vibrate)navigator.vibrate(15);},500);};
    const cancel=()=>{clearTimeout(timer);};
    el.addEventListener('click',(e)=>{
      if(longPressed||e.target.classList.contains('jn-mark-del'))return;
      if(bid)openReader(bid);
    });
    el.addEventListener('mousedown',start);el.addEventListener('mouseup',cancel);el.addEventListener('mouseleave',cancel);
    el.addEventListener('touchstart',start,{passive:true});el.addEventListener('touchend',cancel);
  });
}
async function delMark(type,id,btn){
  const ep=type==='note'?'/api/notes/':'/api/highlights/';
  try{
    await fetch(ep+id,{method:'DELETE'});
    btn.closest('.jn-mark').remove();
    toast('已删除');
  }catch(e){toast('删除失败');}
}
function switchJourney(tab,btn){
  if(typeof exitGardenSelect==='function')exitGardenSelect();  // 离开总览时退出树的编辑态，别把选择条带到别的页
  journeyTab=tab;
  document.querySelectorAll('.jn-tab').forEach(t=>t.classList.remove('on'));
  btn.classList.add('on');
  loadJourney(tab);
}
// 树的生长阶段（0-5）：更细腻
// 月份归类显示：'2026-06' → '2026 年 6 月'；空 → '未记录时间'
function fmtMonth(key){
  if(!key)return '未记录时间';
  const m=/^(\d{4})-(\d{2})$/.exec(key);
  return m?(m[1]+' 年 '+parseInt(m[2],10)+' 月'):key;
}
function growthStage(progress){
  if(!progress||progress<2)return 0;
  if(progress<20)return 1;
  if(progress<45)return 2;
  if(progress<70)return 3;
  if(progress<95)return 4;
  return 5;
}
// 树皮肤（参照优雅的松树/杉树剪影）
function getTreeSkin(){return localStorage.getItem('tree_skin')||'spruce';}
// 树/植物 SVG —— 极简平面几何风：半透明重叠的几何色块、翠绿茎，叠出微妙渐变。
// 颗粒感（丝网/手工纸质感）由 CSS 给 .g-tree-art 叠一层细噪点。按 stage 0-5 生长。
function treeSVG(stage,skin){
  skin=skin||getTreeSkin();
  // 皮肤格式："species" 或 "species|#hex"（每种树都能自定义颜色）；兼容旧的 custom:#hex
  let species=skin, color=null;
  const bar=skin.indexOf('|');
  if(bar>0){species=skin.slice(0,bar);color=skin.slice(bar+1);}
  else if(skin.indexOf('custom:')===0){species='sakura';color=skin.slice(7);}
  const g=Math.max(0,Math.min(1,(stage||0)/5));
  const W=60,H=78,cx=30,baseY=70;
  const wrap=inner=>`<svg viewBox="0 0 ${W} ${H}">${inner}</svg>`;
  const stemH=20+24*g, stemTop=baseY-stemH, sw=2.2+1.7*g;
  const stem=
    `<rect x="${(cx-sw/2).toFixed(1)}" y="${stemTop.toFixed(1)}" width="${sw.toFixed(1)}" height="${(baseY-stemTop).toFixed(1)}" rx="${(sw/2).toFixed(1)}" fill="#6f9460"/>`+
    `<rect x="${(cx-sw/2+0.6).toFixed(1)}" y="${stemTop.toFixed(1)}" width="${Math.max(0.8,sw*0.4).toFixed(1)}" height="${(baseY-stemTop).toFixed(1)}" rx="0.6" fill="#a6c98a" fill-opacity=".7"/>`;

  if(stage<=0){ // 幼苗
    return wrap(
      `<rect x="${(cx-1.2).toFixed(1)}" y="54" width="2.4" height="16" rx="1.2" fill="#6f9460"/>`+
      `<ellipse cx="24.5" cy="53" rx="7.5" ry="4.2" fill="#8fb07a" fill-opacity=".72" transform="rotate(-20 24.5 53)"/>`+
      `<ellipse cx="35.5" cy="51" rx="8" ry="4.4" fill="#a6c28c" fill-opacity=".66" transform="rotate(18 35.5 51)"/>`);
  }
  // 有自定义色就从该色推导一套同系色，否则用该树种的默认配色
  const c3=base=> color?[color,shade(color,28),shade(color,52)]:base;
  const c5=base=> color?[shade(color,-8),shade(color,16),shade(color,40),shade(color,-22),shade(color,28)]:base;

  // 针叶：可调宽窄/高度/层数/疏密 —— 用来把云杉·尖杉·雪松·松树拉开区分
  function conifer(cols,halfBase,topRise,tierMul,sparse){
    const topY=baseY-(28+topRise*g), span=baseY-topY, half=halfBase*(0.6+0.55*g);
    const tiers=Math.max(2,Math.round((tierMul||1)*(3+2*g)));let s='';
    for(let i=0;i<tiers;i++){const t=i/(tiers-1||1);const w=half*(0.30+0.70*t);
      const yT=topY+span*t*(sparse?0.80:0.60), yB=yT+span*(sparse?0.30:0.46);
      s+=`<path d="M${cx} ${yT.toFixed(1)} L${(cx+w).toFixed(1)} ${yB.toFixed(1)} L${(cx-w).toFixed(1)} ${yB.toFixed(1)} Z" fill="${cols[i%cols.length]}" fill-opacity="0.62"/>`;}
    return wrap(stem+s);
  }
  // 白杨：又高又窄的圆柱形树冠
  function columnar(cols){
    const topY=baseY-(34+16*g), h=baseY-topY-2, hw=3.4+2.2*g;
    let s=`<ellipse cx="${cx}" cy="${(topY+h/2).toFixed(1)}" rx="${hw.toFixed(1)}" ry="${(h/2).toFixed(1)}" fill="${cols[0]}" fill-opacity="0.5"/>`;
    const n=4+Math.round(2*g);
    for(let i=0;i<n;i++){const y=topY+h*(i+0.5)/n;
      s+=`<circle cx="${(cx+(i%2?1.3:-1.3)).toFixed(1)}" cy="${y.toFixed(1)}" r="${(hw*0.95).toFixed(1)}" fill="${cols[(i+1)%cols.length]}" fill-opacity="0.5"/>`;}
    return wrap(stem+s);
  }
  // 阔叶/枫：饱满圆冠（flat=true 时压扁更宽，给枫树）
  function broad(cols,rmul,flat){
    const r=(9+11*g)*(rmul||1), cy=baseY-stemH*0.55-r*0.2;
    const fy=flat?0.7:1;
    const layout=[[0,-r*0.28*fy,1.0],[-r*0.62,r*0.04,0.76],[r*0.62,r*0.04,0.76],[-r*0.3,r*0.46*fy,0.62],[r*0.32,r*0.42*fy,0.62]];
    const body=layout.map(([dx,dy,sc],i)=>`<ellipse cx="${(cx+dx).toFixed(1)}" cy="${(cy+dy).toFixed(1)}" rx="${(r*sc).toFixed(1)}" ry="${(r*sc*(flat?0.82:1)).toFixed(1)}" fill="${cols[i%cols.length]}" fill-opacity="0.6"/>`).join('');
    return wrap(stem+body);
  }
  // 柳：圆顶 + 下垂柳条
  function willowTree(cols){
    const cy=baseY-stemH*0.78-4, r=7.5+7*g;
    let s=`<ellipse cx="${cx}" cy="${cy.toFixed(1)}" rx="${(r*1.35).toFixed(1)}" ry="${(r*0.62).toFixed(1)}" fill="${cols[0]}" fill-opacity="0.55"/>`;
    const strands=7;
    for(let i=0;i<strands;i++){const t=i/(strands-1);const x=cx-r*1.25+r*2.5*t;
      const len=(9+11*g)*(0.55+0.45*Math.sin(t*Math.PI));const sw2=(i%2?1.5:-1.5);
      s+=`<path d="M${x.toFixed(1)} ${cy.toFixed(1)} q ${sw2} ${(len*0.55).toFixed(1)} ${(sw2*0.5).toFixed(1)} ${len.toFixed(1)}" stroke="${cols[(i+1)%cols.length]}" stroke-width="1.7" fill="none" stroke-opacity="0.55" stroke-linecap="round"/>`;}
    return wrap(stem+s);
  }
  // 灌木：很矮的短茎 + 一丛低矮圆球
  function bushTree(cols){
    const cy=baseY-6-7*g, r=5.5+6*g;
    const shortStem=`<rect x="${(cx-1).toFixed(1)}" y="${(baseY-7).toFixed(1)}" width="2" height="7" rx="1" fill="#6f9460"/>`;
    const layout=[[-7,2,0.95],[7,2,0.95],[0,-3.5,1.15],[-3.2,4.5,0.72],[3.4,4.2,0.72]];
    const body=layout.map(([dx,dy,sc],i)=>`<circle cx="${(cx+dx*(0.8+0.45*g)).toFixed(1)}" cy="${(cy+dy).toFixed(1)}" r="${(r*sc).toFixed(1)}" fill="${cols[i%cols.length]}" fill-opacity="0.6"/>`).join('');
    return wrap(shortStem+body);
  }
  function flower(cols,heart){
    const R=8+9*g, cy=baseY-stemH*0.62-R*0.1;let pet='';const n=6;
    for(let i=0;i<n;i++){const a=(i/n)*Math.PI*2-Math.PI/2;const px=cx+Math.cos(a)*R*0.5,py=cy+Math.sin(a)*R*0.5;
      pet+=`<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(R*0.62).toFixed(1)}" ry="${(R*0.34).toFixed(1)}" fill="${cols[i%cols.length]}" fill-opacity="0.56" transform="rotate(${(a*180/Math.PI+90).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;}
    return wrap(stem+pet+`<circle cx="${cx}" cy="${cy.toFixed(1)}" r="${(R*0.3).toFixed(1)}" fill="${heart}" fill-opacity="0.9"/>`);
  }

  switch(species){
    case 'spruce':  return conifer(c3(['#3f6b4a','#5c8a63','#83ad7a']),12,36,1,false);          // 标准锥形
    case 'slimfir': return conifer(c3(['#5e7d5a','#86a079','#aac197']),5.5,48,1.5,false);        // 细高尖塔
    case 'cedar':   return conifer(c3(['#3d6b63','#5f9088','#8fb3aa']),19,24,0.7,false);          // 宽大平展
    case 'pine':    return conifer(c3(['#6b7440','#8a9356','#b4bd80']),11,22,0.55,true);          // 稀疏高干
    case 'poplar':  return columnar(c3(['#5a7f3f','#7fa257','#a9c585']));                          // 圆柱白杨
    case 'round':   return broad(c5(['#577a48','#79a05b','#a6c282','#6f9750','#8fb46f']),1,false); // 圆阔叶
    case 'maple':   return broad(c5(['#b5532a','#d07a36','#e0a23a','#9c3b22','#c8702f']),1.15,true); // 宽扁枫树·暖色
    case 'willow':  return willowTree(c3(['#7d9444','#9bb059','#bcc97f']));                         // 下垂柳
    case 'bush':    return bushTree(c5(['#4f6e3f','#6b8a4c','#8aa86a','#5d7a45','#7c9a5c']));       // 矮丛灌木
    case 'sakura':  return flower(c3(['#cf8aa6','#dcaec3','#e7c4d4']), color?shade(color,-45):'#e8c66a');
    default:        return color?flower([color,shade(color,28),shade(color,52)], shade(color,-45))
                                : conifer(['#3f6b4a','#5c8a63','#83ad7a'],12,36,1,false);
  }
}
let journalPage=0;
// 回顾条目长按删除
function bindDiarySwipe(){
  document.querySelectorAll('.jn-book-row[data-bid]').forEach(el=>{
    let sx=0, sy=0, dragging=false, swiped=false;
    const onStart=(x,y)=>{sx=x;sy=y;dragging=true;swiped=false;};
    const onMove=(x,y)=>{
      if(!dragging)return;
      const dx=x-sx, dy=y-sy;
      if(Math.abs(dy)>Math.abs(dx))return;  // 垂直滚动不处理
      if(dx<-24){el.classList.add('show-del');swiped=true;}
      else if(dx>24){el.classList.remove('show-del');swiped=true;}
    };
    const onEnd=()=>{dragging=false;};
    el.addEventListener('touchstart',e=>onStart(e.touches[0].pageX,e.touches[0].pageY),{passive:true});
    el.addEventListener('touchmove',e=>onMove(e.touches[0].pageX,e.touches[0].pageY),{passive:true});
    el.addEventListener('touchend',onEnd);
    // 桌面：鼠标按住横拖也能划出删除
    el.addEventListener('mousedown',e=>onStart(e.pageX,e.pageY));
    el.addEventListener('mousemove',e=>{if(e.buttons===1)onMove(e.pageX,e.pageY);});
    el.addEventListener('mouseup',onEnd);
    // 阻止划动后误触进入阅读
    el.querySelector('.jbr-main')?.addEventListener('click',e=>{if(swiped){e.preventDefault();e.stopPropagation();swiped=false;}});
  });
}
async function delDiaryEntry(bid,date,btn){
  if(!bid){btn.closest('.jn-book-row').remove();return;}
  try{
    await fetch(`/api/diary/entry?book_id=${bid}&date=${date}`,{method:'DELETE'});
    btn.closest('.jn-book-row').remove();toast('已删除');
  }catch(e){toast('删除失败');}
}
// 给某本书选树种
const TREE_SKINS=[['spruce','云杉'],['slimfir','尖杉'],['cedar','雪松'],['pine','松树'],['poplar','白杨'],['round','阔叶'],['maple','枫树'],['willow','柳树'],['bush','灌木'],['sakura','樱树']];
function skinParts(s){const bar=(s||'').indexOf('|');if(bar>0)return{species:s.slice(0,bar),color:s.slice(bar+1)};if((s||'').indexOf('custom:')===0)return{species:'sakura',color:s.slice(7)};return{species:s||'spruce',color:null};}
// 树种网格 + 一个颜色选择器（每种树都能自定义颜色，不再有"自定义颜色"这种树）
function skinTilesHTML(pickFn,cur){
  const {species:curSp,color:curColor}=skinParts(cur);
  const tiles=TREE_SKINS.map(([k,n])=>{
    const sel=(k===curSp);
    const preview=(sel&&curColor)?(k+'|'+curColor):k;            // 选中的那种用当前色预览
    const arg=(sel&&curColor)?(k+'|'+curColor):k;
    return `<div class="tp-opt ${sel?'on':''}" onclick="${pickFn}('${arg}')"><div class="tp-art">${treeSVG(5,preview)}</div><span>${n}</span></div>`;
  }).join('');
  const cc=curColor||'#8aa86a';
  const colorRow=`<div class="tp-colorrow">
    <span class="tp-cl">颜色</span>
    <label class="tp-colorpick" title="给「${(TREE_SKINS.find(s=>s[0]===curSp)||['',curSp])[1]}」选个颜色"><span class="tp-swatch" style="background:${cc}"></span>自定义
      <input type="color" value="${cc}" oninput="${pickFn}('${curSp}|'+this.value)"></label>
    ${curColor?`<button class="tp-colorclear" onclick="${pickFn}('${curSp}')">恢复默认色</button>`:''}
  </div>`;
  return `<div class="tp-grid">${tiles}</div>${colorRow}`;
}
function openTreePicker(bid,cur){
  const html=`<div class="tp-mask" id="tp-mask" onclick="if(event.target===this)closeTreePicker()">
    <div class="tp-panel">
      <div class="tp-head">给这本书选一种树<button onclick="closeTreePicker()">×</button></div>
      ${skinTilesHTML('pickTreeCur',cur)}
      <div class="tp-foot"><button class="tp-read" onclick="openReader(${bid})">翻开这本书</button></div>
    </div></div>`;
  window._pickBid=bid;
  document.body.insertAdjacentHTML('beforeend',html);
}
function pickTreeCur(skin){pickTree(window._pickBid,skin);}
// 花园交互：点=换树种，长按=移除确认，拖到纸篓=移除。选择模式下点=勾选。
let gardenSelMode=false;
const gardenSel=new Set();
function bindGarden(){
  const trash=document.getElementById('garden-trash');
  document.querySelectorAll('.garden-grove .g-tree').forEach(el=>{
    const bid=parseInt(el.dataset.bid), skin=el.dataset.skin;
    if(gardenSel.has(bid))el.classList.add('tsel');
    let timer=null, longFired=false, moved=false, sx=0, sy=0;
    const clearTimer=()=>{if(timer){clearTimeout(timer);timer=null;}};
    const start=(x,y)=>{if(gardenSelMode)return;moved=false;longFired=false;sx=x;sy=y;timer=setTimeout(()=>{longFired=true;if(navigator.vibrate)navigator.vibrate(18);enterGardenSelect();toggleTreeSel(bid,el);},600);};
    const move=(x,y)=>{if(Math.abs(x-sx)>8||Math.abs(y-sy)>8){moved=true;clearTimer();}};
    el.addEventListener('mousedown',e=>start(e.pageX,e.pageY));
    el.addEventListener('mousemove',e=>move(e.pageX,e.pageY));
    el.addEventListener('mouseup',clearTimer);
    el.addEventListener('mouseleave',clearTimer);
    el.addEventListener('touchstart',e=>start(e.touches[0].pageX,e.touches[0].pageY),{passive:true});
    el.addEventListener('touchmove',e=>move(e.touches[0].pageX,e.touches[0].pageY),{passive:true});
    el.addEventListener('touchend',clearTimer);
    el.addEventListener('click',e=>{if(gardenSelMode){toggleTreeSel(bid,el);return;}if(longFired||moved){e.preventDefault();return;}openTreePicker(bid,skin);});
    el.addEventListener('dragstart',e=>{if(gardenSelMode){e.preventDefault();return;}clearTimer();e.dataTransfer.setData('text/plain',String(bid));el.classList.add('dragging');if(trash)trash.classList.add('ready');});
    el.addEventListener('dragend',()=>{el.classList.remove('dragging');if(trash)trash.classList.remove('ready','over');});
  });
  if(trash){
    trash.addEventListener('dragover',e=>{e.preventDefault();trash.classList.add('over');});
    trash.addEventListener('dragleave',()=>trash.classList.remove('over'));
    trash.addEventListener('drop',e=>{e.preventDefault();trash.classList.remove('over','ready');const bid=parseInt(e.dataTransfer.getData('text/plain'));if(bid)removeTree(bid);});
  }
}
// ── 多选模式 ──
function enterGardenSelect(){gardenSelMode=true;gardenSel.clear();renderSelBar();document.querySelectorAll('.garden-grove .g-tree').forEach(el=>el.classList.add('selecting'));}
function exitGardenSelect(){gardenSelMode=false;gardenSel.clear();const b=document.getElementById('garden-sel-bar');if(b)b.remove();document.querySelectorAll('.garden-grove .g-tree').forEach(el=>el.classList.remove('selecting','tsel'));}
function toggleTreeSel(bid,el){if(gardenSel.has(bid)){gardenSel.delete(bid);el.classList.remove('tsel');}else{gardenSel.add(bid);el.classList.add('tsel');}renderSelBar();}
function gardenSelectAll(){const els=[...document.querySelectorAll('.garden-grove .g-tree')];const all=els.every(e=>gardenSel.has(parseInt(e.dataset.bid)));els.forEach(e=>{const bid=parseInt(e.dataset.bid);if(all){gardenSel.delete(bid);e.classList.remove('tsel');}else{gardenSel.add(bid);e.classList.add('tsel');}});renderSelBar();}
function renderSelBar(){
  let b=document.getElementById('garden-sel-bar');
  if(!b){b=document.createElement('div');b.id='garden-sel-bar';b.className='sel-bar';document.body.appendChild(b);}
  const n=gardenSel.size;
  b.innerHTML=`<span class="sb-count">已选 ${n} 棵</span>
    <button onclick="gardenSelectAll()">全选</button>
    <button ${n?'':'disabled'} onclick="openBatchSkin()">改树种/色</button>
    <button ${n?'':'disabled'} class="warn" onclick="batchRemoveSel()">移除</button>
    <button class="done" onclick="exitGardenSelect()">完成</button>`;
}
function openBatchSkin(){
  if(!gardenSel.size)return;
  const html=`<div class="tp-mask" id="tp-mask" onclick="if(event.target===this)closeTreePicker()">
    <div class="tp-panel">
      <div class="tp-head">把选中的 ${gardenSel.size} 棵换成<button onclick="closeTreePicker()">×</button></div>
      ${skinTilesHTML('applyBatchSkin','')}
    </div></div>`;
  document.body.insertAdjacentHTML('beforeend',html);
}
async function applyBatchSkin(skin){
  const ids=[...gardenSel];
  try{await fetch('/api/journey/trees/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_ids:ids,action:'skin',skin})});
    closeTreePicker();toast('已更新 '+ids.length+' 棵');exitGardenSelect();loadJourney('overview');}
  catch(e){toast('操作失败');}
}
async function batchRemoveSel(){
  const ids=[...gardenSel];if(!ids.length)return;
  if(!confirm('把选中的 '+ids.length+' 棵从花园移除？（只清这些书的阅读记录/进度，不删书、不动划线笔记）'))return;
  try{await fetch('/api/journey/trees/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_ids:ids,action:'remove'})});
    toast('已移除 '+ids.length+' 棵');exitGardenSelect();loadJourney('overview');}
  catch(e){toast('移除失败');}
}
async function removeTree(bid){
  try{await fetch('/api/journey/tree/'+bid,{method:'DELETE'});toast('已从花园移除');loadJourney('overview');}
  catch(e){toast('移除失败');}
}
async function removeAllTrees(){
  if(!confirm('清空花园里所有的树？\n（只清掉这些书的阅读记录/进度/完结标记，不删书本身，也不动你的划线、笔记、书签）'))return;
  try{const r=await (await fetch('/api/journey/trees',{method:'DELETE'})).json();toast('已清空 '+(r.cleared||0)+' 棵');loadJourney('overview');}
  catch(e){toast('清空失败');}
}
function closeTreePicker(){const m=document.getElementById('tp-mask');if(m)m.remove();}
async function pickTree(bid,skin){
  try{
    await fetch('/api/book/tree-skin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bid,skin})});
    closeTreePicker();loadJourney('overview');toast('已换树种');
  }catch(e){toast('换树种失败');}
}
function setJourneyGrain(g){localStorage.setItem('journey_grain',g);loadJourney('timeline');}
// 按粒度（日/周/月/年）聚合渲染列表
function renderTimelineList(timeline,grain){
  if(grain==='day'){
    const out=timeline.map(d=>{
      const books=d.books.map(b=>{
        const tm=(b.time||'').slice(11,16);  // HH:MM
        return `<div class="jn-book-row" data-bid="${b.id||''}" data-date="${d.date}">
          <div class="jbr-main"${b.id?` onclick="openReader(${b.id})"`:''}>
            <span class="jbr-name">${esc(b.title)}</span>
            <span class="jn-meta">${tm?tm+' · ':''}${b.minutes?b.minutes+'分钟':''}${b.chars?' · '+Math.round(b.chars/1000)+'千字':''}</span>
          </div>
          <button class="jbr-del" onclick="event.stopPropagation();delDiaryEntry(${b.id||0},'${d.date}',this)" title="删除"><svg viewBox="0 0 24 24"><path d="M7 6V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3h4v2h-2v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8H3V6h4zm2 0h6V4H9v2zm-2 2v12h10V8H7z"></path></svg></button>
        </div>`;
      }).join('');
      const marks=d.marks.map(mk=>`<div class="jn-mark-row">${esc(mk.text||'').slice(0,60)}${mk.book?'（'+esc(mk.book)+'）':''}</div>`).join('');
      return `<div class="jn-day"><div class="jn-date">${d.date}${d.minutes?' · '+d.minutes+' 分钟':''}</div><div class="jn-day-books">${books}${marks}</div></div>`;
    }).join('');
    setTimeout(bindDiarySwipe,50);
    return out;
  }
  // 周/月/年：聚合
  const groups={};
  timeline.forEach(d=>{
    const dt=new Date(d.date);if(isNaN(dt))return;
    let key,label;
    if(grain==='week'){
      const onejan=new Date(dt.getFullYear(),0,1);
      const wk=Math.ceil((((dt-onejan)/86400000)+onejan.getDay()+1)/7);
      key=dt.getFullYear()+'-W'+String(wk).padStart(2,'0');label=dt.getFullYear()+'年 第'+wk+'周';
    }else if(grain==='month'){
      key=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0');label=dt.getFullYear()+'年'+(dt.getMonth()+1)+'月';
    }else{
      key=''+dt.getFullYear();label=dt.getFullYear()+'年';
    }
    groups[key]=groups[key]||{key,label,minutes:0,books:{},markCount:0};
    groups[key].minutes+=d.minutes||0;
    d.books.forEach(b=>{if(b.title)groups[key].books[b.title]=b.id;});
    groups[key].markCount+=d.marks.length;
  });
  const sorted=Object.values(groups).sort((a,b)=>b.key.localeCompare(a.key));
  return sorted.map(g=>{
    const bookList=Object.entries(g.books).map(([t,id])=>`<span class="jbk" ${id?`onclick="openReader(${id})"`:''}>${esc(t)}</span>`).join('');
    const hrs=Math.floor(g.minutes/60),mins=g.minutes%60;
    return `<div class="jn-period"><div class="jn-period-head"><span class="jnp-label">${g.label}</span><span class="jnp-stat">${hrs>0?hrs+'时':''}${mins}分 · ${Object.keys(g.books).length}本${g.markCount?' · '+g.markCount+'标记':''}</span></div><div class="jn-period-books">${bookList||'<span class="jd-empty">这段时间没有阅读记录</span>'}</div></div>`;
  }).join('');
}
// ===== 收藏翻阅模式 =====
let _coll=[], _collBooks=[], _collPage=0, _collReading={}, _collReviews={};
async function openCollection(targetBid){
  document.getElementById('collview').classList.add('show');
  _collPage=0;
  document.getElementById('cv-page').innerHTML='<div class="cv-empty">正在整理…</div>';
  try{
    const r=await (await fetch('/api/journey/collection')).json();
    _coll=r.items||[];
    _collReading=r.reading||{};
    // 取每本书的总评，显示在这本收藏的最上面（不再放在总览）
    _collReviews={};
    try{const rv=(await (await fetch('/api/journey/reviews')).json()).reviews||[];rv.forEach(v=>{if(v.id)_collReviews[v.id]={review:v.review||'',rating:v.rating||0};});}catch(e){}
    _collBooks=groupCollByBookTime(_coll);
    document.getElementById('cv-count').textContent=_collBooks.length?(_collBooks.length+' 本'):'';
    if(targetBid){const i=_collBooks.findIndex(g=>g.bid===targetBid);if(i>=0)_collPage=i;}
    renderCollPage();
    bindCollSwipe();
  }catch(e){document.getElementById('cv-page').innerHTML='<div class="cv-empty">加载失败</div>';}
}
function closeCollection(){document.getElementById('collview').classList.remove('show');}
function fmtTime(t){return (t||'').slice(0,16).replace('T',' ');}
// 按书分组，再按"最近阅读/记录时间"排序（最近的在前）
function groupCollByBookTime(items){
  const groups={},order=[];
  const keyOf=it=> it.book_id?('id'+it.book_id):((it.book||it.title)?('nm'+(it.book||it.title)):'__other');
  items.forEach(it=>{
    const k=keyOf(it);
    if(!groups[k]){groups[k]={bid:it.book_id||0,title:it.book||it.title||'未归类',author:'',items:[],last:''};order.push(k);}
    if(it.kind==='book'){groups[k].title=it.title||groups[k].title;if(it.author)groups[k].author=it.author;}
    groups[k].items.push(it);
    if(it.time&&it.time>groups[k].last)groups[k].last=it.time;
  });
  const arr=order.map(k=>groups[k]);
  arr.sort((a,b)=>(b.last||'').localeCompare(a.last||''));
  return arr;
}
const _CVSVG={quote:'<path d="M4 18h16v3H4zM6.6 15l4.4-11h2l4.4 11h-2.2l-1-2.6H9.8L8.8 15z"/>',note:'<path d="M4 4h16v11H9l-5 4z"/>',quill:'<path d="M21 2C6 2 4 16 3 22h2c.7-3.3 2.3-5.2 5-5.5 4-.5 7-4 8-7l-1.5-1L18.5 5z"/>',bm:'<path d="M6 2h12v20l-6-4-6 4z"/>'};
function _secHTML(title,svg,entries){return `<div class="jb-sec"><div class="jb-sec-h"><svg viewBox="0 0 24 24">${svg}</svg>${esc(title)}</div>${entries.join('')}</div>`;}
function _entryHTML(quote,note,time,bid,pos){
  const dbl = bid?` ondblclick="gotoSource(${bid},${pos||0})" title="双击跳到原文这句"`:'';
  let h='<div class="jb-entry"'+dbl+(bid?' style="cursor:pointer"':'')+'>';
  if(quote)h+=`<div class="jb-q">${quote}</div>`;
  if(note)h+=`<div class="jb-note">${note}</div>`;
  h+=`<div class="jb-time">${fmtTime(time)}${bid?`<button class="jb-goto" onclick="gotoSource(${bid},${pos||0})">读原文</button>`:''}</div></div>`;
  return h;
}
function renderCollPage(){
  const page=document.getElementById('cv-page');
  if(!_collBooks.length){
    page.innerHTML='<div class="cv-empty">这里还是空的<br><span style="font-size:13px">读书时划线、写笔记、收藏书，和 Quill 聊天点星标，都会记到这里</span></div>';
    document.getElementById('cv-pageno').textContent='0 / 0';return;
  }
  if(_collPage<0)_collPage=0; if(_collPage>=_collBooks.length)_collPage=_collBooks.length-1;
  const g=_collBooks[_collPage];
  const byPos=(a,b)=>((a.position||0)-(b.position||0));   // 按在书里的先后顺序，像纸质书一样固定
  const hi=g.items.filter(x=>x.kind==='highlight').sort(byPos),
        nt=g.items.filter(x=>x.kind==='note').sort(byPos),
        ql=g.items.filter(x=>x.kind==='quill'),
        bm=g.items.filter(x=>x.kind==='bookmark').sort(byPos);
  let h=`<div class="jb-book-head" ${g.bid?`onclick="gotoSource(${g.bid},0)"`:''}><span class="jb-t">${esc(g.title)}</span>${g.author?`<span class="jb-a">${esc(g.author)}</span>`:''}</div>`;
  // 阅读里程：只标"开始读"和（读完的）"读完"日期；读完的不再显示"读到X%"，也不显示"最近"
  const rd=_collReading[g.bid];
  const _bk=(typeof findBook==='function')?findBook(g.bid):null;
  const _fin=!!(_bk && _bk.rstatus==='finished');
  // 这本书的总评放最上面（就在这一本里，不是总览）——用真实总评数据，不再依赖书架里没有的字段
  const _rvObj=_collReviews[g.bid];
  const _rv=(_rvObj&&_rvObj.review&&_rvObj.review.trim())?_rvObj.review.trim():'';
  const _rvStars=(_rvObj&&_rvObj.rating)?('★'.repeat(_rvObj.rating)+'☆'.repeat(5-_rvObj.rating)):'';
  if(_rv)h+=`<div class="jb-review"><div class="jb-review-label">我的总评${_rvStars?'<span class="jb-rv-stars">'+_rvStars+'</span>':''}</div><div class="jb-review-body">${esc(_rv)}</div></div>`;
  if(rd){
    const parts=[];
    if(rd.start)parts.push(rd.start.slice(5).replace('-','/')+' 开始读');
    if(_fin){
      parts.push((rd.last?rd.last.slice(5).replace('-','/')+' ':'')+'读完');
    }else if(rd.pct){
      parts.push('读到 '+rd.pct+'%');
    }
    if(rd.minutes)parts.push('共 '+(rd.minutes>=60?(Math.round(rd.minutes/6)/10+' 小时'):(rd.minutes+' 分钟')));
    if(parts.length)h+=`<div class="jb-journey">${parts.join('　·　')}</div>`;
  }
  const bits=[];if(hi.length)bits.push('划线 '+hi.length);if(nt.length)bits.push('笔记 '+nt.length);if(ql.length)bits.push('Quill '+ql.length);if(bm.length)bits.push('书签 '+bm.length);
  h+=`<div class="jb-stat">${bits.join(' · ')||'已收藏'}</div>`;
  if(hi.length)h+=_secHTML('收藏的句子',_CVSVG.quote,hi.map(x=>_entryHTML('「'+esc(x.text||'')+'」', x.note?esc(x.note):'', x.time, g.bid, x.position)));
  if(nt.length)h+=_secHTML('笔记',_CVSVG.note,nt.map(x=>_entryHTML(x.quote?('「'+esc(x.quote)+'」'):'', esc(x.text||''), x.time, g.bid, x.position)));
  if(ql.length)h+=_secHTML('和 Quill 的讨论',_CVSVG.quill,ql.map(x=>_entryHTML('', esc(x.text||''), x.time, 0, 0)));
  if(bm.length)h+=_secHTML('书签',_CVSVG.bm,bm.map(x=>_entryHTML(esc(x.text||'书签')+(x.pct?(' · 读到'+x.pct+'%'):''), '', x.time, g.bid, x.position)));
  page.innerHTML=h;
  page.scrollTop=0;
  document.getElementById('cv-pageno').textContent=(_collPage+1)+' / '+_collBooks.length;
}
function collFlip(dir){
  const next=_collPage+dir;
  if(next<0||next>=_collBooks.length)return;
  const page=document.getElementById('cv-page');
  if(!page)return;
  if(page._cvAnim)return;            // 动画进行中先不接新翻页，避免抖
  page._cvAnim=true;
  const W=page.offsetWidth||420;
  // 柔和翻页：当前页贴着左侧"书脊"轻轻抬起、往外侧滑并淡出；换好内容后新页从另一侧柔和滑入落定。
  // 不再用 rotateY(±90°) 那种立起来看不见的硬翻（生硬、像卡片对折），换成小角度+位移+淡入淡出，像顺手翻过一页纸。
  const outX = dir>0 ? -Math.round(W*0.16) : Math.round(W*0.16);
  const rot  = dir>0 ? -9 : 9;
  page.style.transformOrigin='left center';
  page.style.transition='transform .24s cubic-bezier(.4,0,.55,1), opacity .24s ease';
  page.style.transform=`perspective(1500px) translateX(${outX}px) rotateY(${rot}deg)`;
  page.style.opacity='0';
  setTimeout(()=>{
    _collPage=next; renderCollPage(); try{page.scrollTop=0;}catch(e){}
    // 新页起始落在另一侧、略微反向倾斜，再缓动归位
    page.style.transition='none';
    page.style.transform=`perspective(1500px) translateX(${-outX}px) rotateY(${-rot}deg)`;
    page.style.opacity='0';
    void page.offsetWidth;           // 强制回流，下一段过渡才会真正动起来
    page.style.transition='transform .34s cubic-bezier(.16,.84,.44,1), opacity .3s ease';
    page.style.transform='perspective(1500px) translateX(0) rotateY(0deg)';
    page.style.opacity='1';
    setTimeout(()=>{ page.style.transition=''; page.style.transform=''; page.style.opacity=''; page._cvAnim=false; },360);
  },240);
}
// 收藏也能像阅读器那样滑动翻页（左右滑/拖），不用只点箭头
let _cvSwipeBound=false;
function bindCollSwipe(){
  if(_cvSwipeBound)return; _cvSwipeBound=true;
  const stage=document.getElementById('cv-stage'); if(!stage)return;
  let sx=0,sy=0,active=false;
  stage.addEventListener('pointerdown',e=>{
    if(e.target.closest&&e.target.closest('a,button,.cv-arrow,input,textarea'))return;
    sx=e.clientX;sy=e.clientY;active=true;
  });
  stage.addEventListener('pointerup',e=>{
    if(!active)return; active=false;
    const dx=e.clientX-sx, dy=e.clientY-sy;
    // 横向滑动够大、且明显比纵向多（纵向是在滚正文）→ 翻页
    if(Math.abs(dx)>55 && Math.abs(dx)>Math.abs(dy)*1.4) collFlip(dx<0?1:-1);
  });
  stage.addEventListener('pointercancel',()=>{active=false;});
}
// 收藏里搜一下，跳到匹配的那一本（书多时快速定位）
function cvSearch(kw){
  kw=(kw||'').trim().toLowerCase();
  if(!kw)return;
  const i=_collBooks.findIndex(g=>((g.title||'')+' '+(g.author||'')).toLowerCase().includes(kw));
  if(i>=0 && i!==_collPage){_collPage=i;renderCollPage();}
}

// ===== 分享书单 =====
let _blBooks=[], _blOpts={stars:true,review:true,author:'',tag:'',time:'all',theme:'paper',title:'我读过的书',bg:'',dense:false,tdx:0,tdy:0};
let _blDrag=null;
function blDragStart(ev){
  ev.preventDefault();
  const p=ev.touches?ev.touches[0]:ev;
  _blDrag={sx:p.clientX,sy:p.clientY,ox:_blOpts.tdx||0,oy:_blOpts.tdy||0};
  document.addEventListener('pointermove',blDragMove);
  document.addEventListener('pointerup',blDragEnd);
}
function blDragMove(ev){
  if(!_blDrag)return;
  _blOpts.tdx=Math.round(_blDrag.ox+(ev.clientX-_blDrag.sx));
  _blOpts.tdy=Math.round(_blDrag.oy+(ev.clientY-_blDrag.sy));
  const head=document.querySelector('#bl-card .blc-head');
  if(head)head.style.transform=`translate(${_blOpts.tdx}px,${_blOpts.tdy}px)`;
}
function blDragEnd(){_blDrag=null;document.removeEventListener('pointermove',blDragMove);document.removeEventListener('pointerup',blDragEnd);}
function blResetLayout(){_blOpts.tdx=0;_blOpts.tdy=0;renderBlCard();}
async function openBookShare(){
  document.getElementById('booklist-view').classList.add('show');
  document.getElementById('bl-card').innerHTML='<div class="blc-empty">正在整理书单…</div>';
  try{const r=await (await fetch('/api/journey/booklist')).json();_blBooks=r.books||[];}
  catch(e){_blBooks=[];}
  renderBlControls();renderBlCard();
}
function closeBookShare(){document.getElementById('booklist-view').classList.remove('show');}
function _blTrunc(s,n){s=String(s||'');return s.length>n?s.slice(0,n-1)+'…':s;}
function blFiltered(){
  let bs=_blBooks.slice();
  if(_blOpts.author)bs=bs.filter(b=>b.author===_blOpts.author);
  if(_blOpts.tag)bs=bs.filter(b=>(b.tags||[]).includes(_blOpts.tag));
  if(_blOpts.time==='year'){const y=''+new Date().getFullYear();bs=bs.filter(b=>(b.time||'').startsWith(y));}
  return bs;
}
function renderBlControls(){
  const authors=[...new Set(_blBooks.map(b=>b.author).filter(Boolean))].sort();
  const tags=[...new Set(_blBooks.flatMap(b=>b.tags||[]))].sort();
  const opt=(v,sel,lab)=>`<option value="${esc(v)}" ${v===sel?'selected':''}>${esc(lab||v)}</option>`;
  document.getElementById('bl-controls').innerHTML=`
    <input class="bl-in" value="${esc(_blOpts.title)}" oninput="_blOpts.title=this.value;renderBlCard()" placeholder="书单标题">
    <select class="bl-sel" onchange="_blOpts.author=this.value;renderBlCard()"><option value="">全部作者</option>${authors.map(a=>opt(a,_blOpts.author)).join('')}</select>
    <select class="bl-sel" onchange="_blOpts.tag=this.value;renderBlCard()"><option value="">全部标签</option>${tags.map(t=>opt(t,_blOpts.tag)).join('')}</select>
    <select class="bl-sel" onchange="_blOpts.time=this.value;renderBlCard()">${opt('all',_blOpts.time,'所有时间')}${opt('year',_blOpts.time,'今年')}</select>
    <label class="bl-chk"><input type="checkbox" ${_blOpts.stars?'checked':''} onchange="_blOpts.stars=this.checked;renderBlCard()">星级</label>
    <label class="bl-chk"><input type="checkbox" ${_blOpts.review?'checked':''} onchange="_blOpts.review=this.checked;renderBlCard()">简评</label>
    <select class="bl-sel" onchange="_blOpts.theme=this.value;renderBlCard()">${opt('paper',_blOpts.theme,'纸色')}${opt('dark',_blOpts.theme,'夜墨')}${opt('sage',_blOpts.theme,'青竹')}</select>
    <select class="bl-sel" onchange="_blOpts.dense=(this.value==='1');renderBlCard()">${opt('0',_blOpts.dense?'0z':'0','宽松')}${opt('1',_blOpts.dense?'1':'1z','紧凑')}</select>
    <label class="bl-up">背景图<input type="file" accept="image/*" style="display:none" onchange="blPickBg(this)"></label>
    ${_blOpts.bg?'<button class="bl-clear" onclick="_blOpts.bg=\'\';renderBlControls();renderBlCard()">清除背景</button>':''}
    ${(_blOpts.tdx||_blOpts.tdy)?'<button class="bl-clear" onclick="blResetLayout()">重置标题位置</button>':''}`;
}
function blPickBg(input){
  const f=input.files&&input.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=e=>{_blOpts.bg=e.target.result;renderBlControls();renderBlCard();toast('背景已应用（导出会一起带上）');};
  rd.readAsDataURL(f);
}
function renderBlCard(){
  const bs=blFiltered();
  document.getElementById('bl-count').textContent=bs.length+' 本';
  const card=document.getElementById('bl-card');
  card.className='bl-card bl-'+_blOpts.theme+(_blOpts.bg?' bl-has-bg':'')+(_blOpts.dense?' bl-dense':'');
  card.style.backgroundImage=_blOpts.bg?`url("${_blOpts.bg}")`:'';
  let h=`<div class="blc-inner"><div class="blc-head" style="touch-action:none;cursor:move;transform:translate(${_blOpts.tdx||0}px,${_blOpts.tdy||0}px)" onpointerdown="blDragStart(event)" title="拖动可移动标题位置"><div class="blc-title">${esc(_blOpts.title||'我读过的书')}</div><div class="blc-sub">共 ${bs.length} 本 · ${new Date().toLocaleDateString('zh-CN')}</div></div>`;
  h+=bs.map(b=>{
    const stars=(_blOpts.stars&&b.rating)?`<span class="blc-stars">${'★'.repeat(b.rating)}${'☆'.repeat(5-b.rating)}</span>`:'';
    const rv=(_blOpts.review&&b.review)?`<div class="blc-rv">${esc(b.review)}</div>`:'';
    return `<div class="blc-item"><div class="blc-line"><span class="blc-bt">${esc(b.title)}</span>${b.author?`<span class="blc-ba">${esc(b.author)}</span>`:''}${stars}</div>${rv}</div>`;
  }).join('')||'<div class="blc-empty">这个筛选下还没有书</div>';
  h+=`<div class="blc-foot">— MyLibrary 书房 —</div></div>`;
  card.innerHTML=h;
}
function downloadBookShare(){
  const bs=blFiltered();
  const TH={paper:{bg:'#f3ead9',card:'#fbf6ea',ink:'#3a322a',sub:'#9a8d79',star:'#d8a838',line:'#e6dcc8',ac:'#8c6f4a'},
            dark:{bg:'#23211e',card:'#2c2924',ink:'#ece4d6',sub:'#9a8d79',star:'#e0b94e',line:'#3a352d',ac:'#cdab74'},
            sage:{bg:'#e7ede2',card:'#f4f7ef',ink:'#33402f',sub:'#7d8a72',star:'#c8a838',line:'#d7e0cf',ac:'#5d7a4a'}}[_blOpts.theme];
  const dense=_blOpts.dense;
  const W=560, PAD=dense?28:34, lineH=(_blOpts.review?54:34)-(dense?10:0), headH=dense?80:96, footH=46;
  const H=PAD*2+headH+footH+bs.length*lineH+8;
  const e2=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  let y=PAD+headH, items='';
  bs.forEach(b=>{
    const stars=(_blOpts.stars&&b.rating)?('★'.repeat(b.rating)+'☆'.repeat(5-b.rating)):'';
    items+=`<text x="${PAD}" y="${y}" font-size="17" font-weight="600" fill="${TH.ink}">${e2(_blTrunc(b.title,18))}</text>`;
    if(b.author)items+=`<text x="${W-PAD}" y="${y}" font-size="12.5" fill="${TH.sub}" text-anchor="end">${e2(_blTrunc(b.author,12))}</text>`;
    if(stars)items+=`<text x="${PAD}" y="${y+20}" font-size="13" fill="${TH.star}" letter-spacing="1.5">${stars}</text>`;
    if(_blOpts.review&&b.review)items+=`<text x="${stars?PAD+100:PAD}" y="${y+20}" font-size="12.5" font-style="italic" fill="${TH.sub}">${e2(_blTrunc(b.review,_blOpts.stars&&b.rating?22:34))}</text>`;
    items+=`<line x1="${PAD}" y1="${y+lineH-16}" x2="${W-PAD}" y2="${y+lineH-16}" stroke="${TH.line}" stroke-width="1"/>`;
    y+=lineH;
  });
  // 背景图：整张铺满，再压一层半透明卡片色，保证文字可读
  const bgLayer=_blOpts.bg
    ? `<image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice" href="${_blOpts.bg}"/><rect x="14" y="14" width="${W-28}" height="${H-28}" rx="18" fill="${TH.card}" opacity="0.82"/>`
    : `<rect width="${W}" height="${H}" fill="${TH.bg}"/><rect x="14" y="14" width="${W-28}" height="${H-28}" rx="18" fill="${TH.card}"/>`;
  const tx=_blOpts.tdx||0, ty=_blOpts.tdy||0;   // 标题拖动的偏移
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">
${bgLayer}
<text x="${PAD+tx}" y="${PAD+36+ty}" font-size="27" font-weight="700" fill="${TH.ink}" font-family="Georgia,'Songti SC',serif">${e2(_blOpts.title||'我读过的书')}</text>
<text x="${PAD+tx}" y="${PAD+62+ty}" font-size="13" fill="${TH.sub}">共 ${bs.length} 本 · ${new Date().toLocaleDateString('zh-CN')}</text>
<line x1="${PAD+tx}" y1="${PAD+76+ty}" x2="${PAD+56+tx}" y2="${PAD+76+ty}" stroke="${TH.ac}" stroke-width="3"/>
${items}
<text x="${W/2}" y="${H-26}" font-size="12" fill="${TH.sub}" text-anchor="middle" letter-spacing="3">— MyLibrary 书房 —</text>
</svg>`;
  const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(_blOpts.title||'我的书单')+'.svg';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  toast('已下载书单图片（SVG），可直接发图或截图');
}
function gotoSource(bid,pos){
  openReader(bid,pos);
}
// 键盘左右翻页
document.addEventListener('keydown',e=>{
  if(!document.getElementById('collview')||!document.getElementById('collview').classList.contains('show'))return;
  if(e.key==='ArrowLeft')collFlip(-1);
  else if(e.key==='ArrowRight')collFlip(1);
  else if(e.key==='Escape')closeCollection();
});

function renderJournalSpread(){
  const weeks=window._journalWeeks||[];
  if(!weeks.length)return '<div class="jn-empty">还没有记录</div>';
  const w=weeks[journalPage];if(!w)return '';
  const dayMap={};w.days.forEach(d=>dayMap[d.date]=d);
  const wkNames=['日','一','二','三','四','五','六'];
  const sample=new Date(w.days[0].date);
  const monday=new Date(sample);monday.setDate(sample.getDate()-((sample.getDay()+6)%7));
  let leftRows='';
  for(let i=0;i<7;i++){
    const dd=new Date(monday);dd.setDate(monday.getDate()+i);
    const ds=dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'-'+String(dd.getDate()).padStart(2,'0');
    const dat=dayMap[ds];
    const items=dat?dat.books.map(b=>`<span class="jbk" ${b.id?`onclick="openReader(${b.id})"`:''}>${esc(b.title)}</span>`).join('')+dat.marks.map(m=>`<span class="jmk">${esc((m.text||'').slice(0,18))}</span>`).join(''):'';
    leftRows+=`<div class="journal-day"><div class="jd-num">${dd.getDate()}<span class="jd-wk">${wkNames[dd.getDay()]}</span></div><div class="jd-content">${items||'<span class="jd-empty">·</span>'}</div></div>`;
  }
  const totalMin=w.days.reduce((s,d)=>s+(d.minutes||0),0);
  return `
    <div class="journal-book">
      <div class="journal-pageL">
        <div class="journal-mhead"><b>${w.year}</b><span>第 ${w.week} 周</span></div>
        ${leftRows}
      </div>
      <div class="journal-pageR">
        <div class="journal-rhead">本周小结</div>
        <div class="journal-summary"><div class="js-big">${Math.floor(totalMin/60)}<span>时</span> ${totalMin%60}<span>分</span></div><div class="js-lbl">阅读时长</div></div>
        <div class="journal-summary"><div class="js-big">${w.days.length}<span>天</span></div><div class="js-lbl">有阅读</div></div>
      </div>
    </div>
    <div class="journal-nav">
      <button onclick="journalFlip(1)" ${journalPage>=weeks.length-1?'disabled':''}>← 更早</button>
      <span>${journalPage+1} / ${weeks.length}</span>
      <button onclick="journalFlip(-1)" ${journalPage<=0?'disabled':''}>更近 →</button>
    </div>`;
}
function journalFlip(dir){
  const weeks=window._journalWeeks||[];
  const next=journalPage+dir;
  if(next<0||next>=weeks.length)return;
  journalPage=next;
  const wrap=document.getElementById('journal-wrap');
  wrap.style.opacity='0';
  setTimeout(()=>{wrap.innerHTML=renderJournalSpread();wrap.style.opacity='1';},150);
}
async function loadJourney(tab){
  const body=document.getElementById('journey-body');
  body.innerHTML='<div class="jn-empty">加载中…</div>';
  try{
    if(tab==='overview'){
      const r=await (await fetch('/api/journey/overview')).json();
      const garden=await (await fetch('/api/journey/garden')).json();
      const h=Math.floor(r.total_minutes/60),m=r.total_minutes%60;
      let html='';
      html+=`<div class="jn-stats">
        <div class="jn-stat"><div class="jn-num">${h}<span class="jn-unit">小时</span>${m>0?' '+m+'<span class="jn-unit">分</span>':''}</div><div class="jn-lbl">累计阅读</div></div>
        <div class="jn-stat"><div class="jn-num">${r.books_read||0}<span class="jn-unit">本</span></div><div class="jn-lbl">读过的书${r.reading_now?'（在读 '+r.reading_now+'）':''}</div></div>
        <div class="jn-stat"><div class="jn-num">${r.days||0}<span class="jn-unit">天</span></div><div class="jn-lbl">阅读天数</div></div>
        <div class="jn-stat"><div class="jn-num">${r.marks_total||0}<span class="jn-unit">处</span></div><div class="jn-lbl">标记</div></div>
        <div class="jn-stat"><div class="jn-num">${r.quill_starred||0}<span class="jn-unit">句</span></div><div class="jn-lbl">记下的话</div></div>
      </div>`;
      // 收藏翻阅入口：把所有留下来的东西汇成一本可翻阅的册子
      html+=`<button class="cv-entry" onclick="openCollection()">
        <span class="cv-entry-ic"><svg viewBox="0 0 24 24"><path d="M21 4H3a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Zm-1 14H4V6h16v12ZM6 9h12v2H6V9Zm0 4h8v2H6v-2Z"/></svg></span>
        <span class="cv-entry-txt"><b>收藏</b><span>按每本书、或按日期，回看你划的句子、写的笔记、和 Quill 的讨论，什么时候读的都在</span></span>
      </button>`;
      // 生成书单：放在阅读记录里（不再挤在多选栏），用读过/在读的书排成可分享的书单
      html+=`<button class="cv-entry" onclick="openBooklistFromJourney()">
        <span class="cv-entry-ic"><svg viewBox="0 0 24 24"><path d="M21 18H6a1 1 0 0 0 0 2h15v2H6a3 3 0 0 1-3-3V4a2 2 0 0 1 2-2h16v16ZM8 9h8v2H8V9Z"/></svg></span>
        <span class="cv-entry-txt"><b>生成书单</b><span>把读过/在读的书排成一份可保存、可分享的书单（带简评，可选文字或图片）</span></span>
      </button>`;
      // 读书统计（在总览里，可在设置关闭）。按时间（完成月份）分组，不再堆成一片。
      const trees=garden.trees||[];
      const hasGarden=featOn('garden')&&trees.length;
      if(hasGarden){
        html+=`<div class="jn-garden-bar"><span class="jn-section-title" style="margin:24px 0 0">读书统计</span><span class="garden-hint"><a onclick="enterGardenSelect()" style="color:var(--accent);cursor:pointer">编辑</a></span></div>`;
        // 按月份归组（后端已按月份倒序给出）；没记录时间的归到最后"未记录时间"
        const groups=[];const idx={};
        trees.forEach(t=>{
          const key=t.month||'';
          if(!(key in idx)){idx[key]=groups.length;groups.push([key,[]]);}
          groups[idx[key]][1].push(t);
        });
        const treeCard=t=>{
          const stage=t.finished?5:growthStage(t.progress);
          return `<div class="g-tree" data-bid="${t.id}" data-skin="${t.skin}" draggable="true" title="${esc(t.title)}${t.author?' · '+esc(t.author):''}（${t.finished?'已读完':t.progress+'%'}）">
            <div class="g-tree-art">${treeSVG(stage,t.skin)}</div>
            <div class="g-tree-name">${esc(t.title.length>6?t.title.slice(0,6)+'…':t.title)}</div>
            <div class="g-tree-prog">${t.finished?'读完':(t.progress||0)+'%'}</div>
          </div>`;
        };
        groups.forEach(([key,list])=>{
          html+=`<div class="garden-month">${fmtMonth(key)} <span class="garden-month-n">${list.length}</span></div>`;
          html+='<div class="garden-grove">'+list.map(treeCard).join('')+'</div>';
        });
        html+=`<div class="garden-foot">共 <b>${trees.length}</b> 棵，其中 <b>${garden.finished_count||0}</b> 棵已长成</div>`;
        html+=`<div class="garden-trash" id="garden-trash"><svg viewBox="0 0 24 24"><path d="M7 6V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3h4v2h-2v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8H3V6h4zm2 0h6V4H9v2zm-2 2v12h10V8H7zm3 2h2v8h-2v-8zm4 0h2v8h-2v-8z"></path></svg><span>拖到这里移除这棵树</span></div>`;
      }else if(featOn('garden')){
        html+='<div class="jn-empty" style="padding:40px 20px">读起来，这里会长出你的花园<br><span style="font-size:13px">每读一本书就种一棵树，按进度生长，可以给每本书选不同的树种</span></div>';
      }
      body.innerHTML=html;
      setTimeout(bindGarden,50);
    }else if(tab==='timeline'){
      const r=await (await fetch('/api/journey/timeline')).json();
      if(!r.timeline||!r.timeline.length){body.innerHTML='<div class="jn-empty">还没有阅读记录<br><span style="font-size:13px">打开一本书读起来，这里会像日记一样记下你的足迹</span></div>';return;}
      window._timelineData=r.timeline;
      const grain=localStorage.getItem('journey_grain')||'day';
      let html=`<div class="jn-view-switch">
        <div class="jn-grain">${['day','week','month','year'].map(g=>`<button class="jgr ${grain===g?'on':''}" onclick="setJourneyGrain('${g}')">${({day:'日',week:'周',month:'月',year:'年'})[g]}</button>`).join('')}</div>
        <button class="bl-share-btn" onclick="openBookShare()" title="把读过的书排成卡片分享"><svg viewBox="0 0 24 24" class="ic"><path d="M13.12 17.023l-4.199-2.29a4 4 0 1 1 0-5.465l4.2-2.29a4 4 0 1 1 .959 1.755l-4.2 2.29a4.008 4.008 0 0 1 0 1.954l4.2 2.29a4 4 0 1 1-.96 1.755z"></path></svg>分享书单</button>
      </div>`;
      html+='<div class="jn-list">'+renderTimelineList(r.timeline,grain)+'</div>';
      body.innerHTML=html;
    }else if(tab==='marks'){
      const r=await (await fetch('/api/journey/marks')).json();
      if(!r.marks||!r.marks.length){body.innerHTML='<div class="jn-empty">还没有标记<br><span style="font-size:13px">在阅读器里划线、写笔记，都会收集到这里</span></div>';return;}
      body.innerHTML='<div class="jn-marks-tip">点击进入阅读，长按可删除</div>'+r.marks.map(mk=>{
        const typeName={note:'笔记',highlight:'划线',bookmark:'书签'}[mk.type]||'标记';
        return `<div class="jn-mark" data-mid="${mk.mark_id}" data-mtype="${mk.type}" ${mk.book_id?`data-bid="${mk.book_id}"`:''}><div class="jn-mark-head"><span class="jn-mark-type">${typeName}</span><span>${esc(mk.book)} · ${(mk.time||'').slice(0,10)}</span></div>
        ${mk.quote?`<div class="jn-mark-quote">${esc(mk.quote)}</div>`:''}
        ${mk.text?`<div class="jn-mark-text">${esc(mk.text)}</div>`:''}<span class="jn-mark-del" onclick="event.stopPropagation();delMark('${mk.type}',${mk.mark_id},this)">删除</span></div>`;
      }).join('');
      bindMarkActions();
    }else if(tab==='quill'){
      const r=await (await fetch('/api/journey/quill-notes')).json();
      if(!r.notes||!r.notes.length){body.innerHTML='<div class="jn-empty">还没有摘录<br><span style="font-size:13px">和 Quill 聊天时点星标，值得记的话会留在这里</span></div>';return;}
      body.innerHTML=r.notes.map(n=>`<div class="jn-quill-note"><div class="jq-text">${esc(n.content)}</div><div class="jq-meta">Quill${n.book_title?' · 《'+esc(n.book_title)+'》':''} · ${(n.created_at||'').slice(0,10)}</div></div>`).join('');
    }
  }catch(e){body.innerHTML='<div class="jn-empty">加载失败</div>';}
}
