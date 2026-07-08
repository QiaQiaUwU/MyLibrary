// ╔══ 10_shelf.js —— 书架 · 数据/搜索/详情/批量/下载篮/书单导出/二维码 ══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。


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
const BUILTIN_PALETTES=[
  {id:'classic', name:'典雅', cols:['#7d5a4f','#4a5d6e','#5a6e4f','#6e4f5d','#4f6e6e','#6e5d4a','#544a6e','#7d6e4a']},
  {id:'morandi', name:'莫兰迪', cols:['#a89687','#8fa0a8','#9aab93','#ab93a0','#93aba8','#aba893','#a0939c','#b0a890']},
  {id:'icetea',  name:'冰茶',   cols:['#c2707f','#b08691','#8fa6c0','#7c93ae','#c08f79','#9c8296','#8aa39d','#b58a6e']},
  {id:'soda',    name:'汽水',   cols:['#d97e55','#c98f57','#5ba39b','#cf8760','#4f9898','#c9705d','#c9945a','#6fa085']},
  {id:'gelato',  name:'雪糕',   cols:['#5f9bc4','#6fa8c9','#7aa3bf','#b8ac6f','#5b8fb8','#88a8c0','#94a8b8','#a8a06a']},
  {id:'mucha',   name:'穆夏',   cols:['#d9a04f','#b9a455','#c98f6a','#8f9b52','#b5825a','#a89552','#c4934f','#7f8f5f']},
  {id:'rose',    name:'玫瑰',   cols:['#a8879a','#c9a86a','#b5744c','#c98f96','#a8a06a','#c9848a','#9b7f94','#b5915f']},
  {id:'twilight',name:'暮雪',   cols:['#4a3f5c','#6b5a70','#7f7c94','#8093ad','#8f3a44','#6f2a35','#5c5470','#9b5560']},
  {id:'moss',    name:'苔原',   cols:['#3a5c40','#7a5a2a','#8f9a6a','#5f7048','#4a6350','#8a8a5f','#6b7a4a','#9a8548']},
  {id:'retro',   name:'复古',   cols:['#3a4a48','#984a35','#5f8582','#a8905f','#4a5a58','#8a4030','#6f9490','#96835a']},
];
let _bpal=null,_palEdit=false;
async function loadBookPalettes(){
  if(_bpal)return _bpal;
  try{const p=await (await fetch('/api/reading-prefs')).json();_bpal=JSON.parse(p.bookPalettes||'{}');}catch(e){_bpal={};}
  _bpal.user=_bpal.user||[];_bpal.hidden=_bpal.hidden||[];
  return _bpal;
}
async function saveBookPalettes(){
  try{
    const r=await fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookPalettes:JSON.stringify(_bpal)})});
    if(!r.ok)throw new Error('HTTP '+r.status);
  }catch(e){
    console.warn('色卡保存失败：',e);
    if(typeof toast==='function')toast('色卡没保存上（网络问题），刷新后可能会丢');
  }
}
function allPalettes(){
  const bp=_bpal||{user:[],hidden:[]};
  return BUILTIN_PALETTES.filter(x=>!(bp.hidden||[]).includes(x.id)).concat(bp.user||[]);
}
function resolvePalette(id){
  const hit=allPalettes().find(x=>x.id===id)||BUILTIN_PALETTES.find(x=>x.id===id);
  return (hit&&hit.cols&&hit.cols.length)?hit.cols:BUILTIN_PALETTES[0].cols;
}
function getCoverPalette(){return localStorage.getItem('cover_palette')||'classic';}
function setCoverPalette(p){localStorage.setItem('cover_palette',p);try{if(typeof DATA!=='undefined'&&DATA&&DATA.length)DATA.forEach(b=>{b.c=coverColor(b.t);});}catch(e){}try{if(typeof render==='function')render();}catch(e){}try{renderCoverPalettes&&renderCoverPalettes();}catch(e){}}
const COVERS=BUILTIN_PALETTES[0].cols;
function esc(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function coverColor(t){const pal=resolvePalette(getCoverPalette());let h=0;for(let i=0;i<(t||'').length;i++)h=(h*31+t.charCodeAt(i))%pal.length;return pal[h];}
// 导入/取色出来的颜色收进书脊可读区间（太浅书名会看不清），色相尽量保留
function _rgb(hex){const h=hex.replace('#','');const f=h.length===3?h.split('').map(c=>c+c).join(''):h;const n=parseInt(f,16)||0;return [(n>>16)&255,(n>>8)&255,n&255];}
function _hex(r,g,b){return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');}
function normalizeSpine(cols){
  const out=[];
  cols.forEach(c=>{
    let [r,g,b]=_rgb(c);
    let mx=Math.max(r,g,b)/255,mn=Math.min(r,g,b)/255,L=(mx+mn)/2;
    if(L>0.62){const k=0.55/L;r*=k;g*=k;b*=k;}
    else if(L<0.26){const k=0.30/Math.max(0.02,L);r=Math.min(255,r*k);g=Math.min(255,g*k);b=Math.min(255,b*k);}
    const hx=_hex(r,g,b);
    if(!out.some(o=>{const [r2,g2,b2]=_rgb(o);return Math.abs(r2-r)+Math.abs(g2-g)+Math.abs(b2-b)<40;}))out.push(hx);
  });
  while(out.length<4&&out.length)out.push(_hex(..._rgb(out[out.length%out.length]).map(v=>v*0.8)));
  return out.slice(0,16);
}
function togglePalEdit(){_palEdit=!_palEdit;renderCoverPalettes();}
async function delPalette(ev,id){
  ev.stopPropagation();
  await loadBookPalettes();
  if(BUILTIN_PALETTES.some(x=>x.id===id))_bpal.hidden.push(id);
  else _bpal.user=_bpal.user.filter(x=>x.id!==id);
  saveBookPalettes();
  if(getCoverPalette()===id)setCoverPalette('classic');
  renderCoverPalettes();
}
async function importPalette(){
  const raw=prompt('把颜色代码粘进来（多个，#可省，空格/逗号/换行分隔）：','');if(!raw)return;
  const cols=(raw.match(/#?[0-9a-fA-F]{6}|#?[0-9a-fA-F]{3}(?![0-9a-fA-F])/g)||[]).map(x=>x[0]==='#'?x:'#'+x);
  if(cols.length<3){toast('至少要 3 个颜色');return;}
  const name='我的色卡';
  openPalEditor(name,cols);
}
let _palDraft=null;
function openPalEditor(name,cols){
  _palDraft={name:name||'我的色卡',cols:cols.slice()};
  const m=document.getElementById('pal-editor');if(!m)return;
  renderPalEditor();
  m.classList.add('show');
}
function renderPalEditor(){
  const box=document.getElementById('pe-body');if(!box||!_palDraft)return;
  box.innerHTML=`<div class="ge-row"><span class="ge-lbl">名字</span><input id="pe-name" value="${esc(_palDraft.name)}" style="flex:1;padding:5px 8px;border:1px solid var(--line-solid);border-radius:7px;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:13px"></div>
  <div class="ge-row" style="gap:8px;flex-wrap:wrap">${_palDraft.cols.map((c,i)=>`<span class="pe-sw"><input type="color" value="${c}" oninput="_palDraft.cols[${i}]=this.value"><span class="sw-x" onclick="_palDraft.cols.splice(${i},1);renderPalEditor()">×</span></span>`).join('')}
    <button class="cb-btn" onclick="_palDraft.cols.push('#8a8a7a');renderPalEditor()">＋加一色</button></div>
  <div class="ge-row ge-foot"><span class="ge-tip">点色块改色 · ×删 · 太浅的存时会压深</span>
    <button class="cb-btn" onclick="closePalEditor()">取消</button><button class="cb-btn" onclick="savePalEditor()">保存</button></div>`;
}
function closePalEditor(){const m=document.getElementById('pal-editor');if(m)m.classList.remove('show');_palDraft=null;}
function clampSpine(cols){   // 忠实保留用户确认的每个颜色，只把极端明度轻轻夹回可读区
  return cols.map(c=>{
    let [r,g,b]=_rgb(c);
    const mx=Math.max(r,g,b)/255,mn=Math.min(r,g,b)/255,L=(mx+mn)/2;
    if(L>0.74){const k=0.66/L;r*=k;g*=k;b*=k;}
    else if(L<0.18){const k=0.22/Math.max(0.02,L);r=Math.min(255,r*k);g=Math.min(255,g*k);b=Math.min(255,b*k);}
    return _hex(r,g,b);
  });
}
async function savePalEditor(){
  if(!_palDraft)return;
  const name=(document.getElementById('pe-name')||{}).value||_palDraft.name;
  const cols=clampSpine(_palDraft.cols);
  if(cols.length<3){toast('至少 3 个颜色');return;}
  await loadBookPalettes();
  const pal={id:'u'+Date.now(),name,cols};
  _bpal.user.push(pal);saveBookPalettes();
  setCoverPalette(pal.id);
  closePalEditor();
  toast('色卡「'+name+'」已保存并应用');
}
async function extractPaletteFromImage(inp){
  const f=inp.files&&inp.files[0];inp.value='';if(!f)return;
  const img=new Image();
  img.onload=async()=>{
    const S=72,cv=document.createElement('canvas');cv.width=S;cv.height=S;
    const ctx=cv.getContext('2d');ctx.drawImage(img,0,0,S,S);
    const d=ctx.getImageData(0,0,S,S).data,pts=[];
    for(let i=0;i<d.length;i+=4){if(d[i+3]>200)pts.push([d[i],d[i+1],d[i+2]]);}
    // k-means 取 7 簇：远距播种 + 10 轮
    const K=16,cs=[pts[0]];
    while(cs.length<K){let best=null,bd=-1;for(let i=0;i<pts.length;i+=7){const p=pts[i];let m=1e9;cs.forEach(c=>{const dd=(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2;if(dd<m)m=dd;});if(m>bd){bd=m;best=p;}}cs.push(best.slice());}
    for(let it=0;it<10;it++){
      const sum=cs.map(()=>[0,0,0,0]);
      pts.forEach(p=>{let bi=0,bd=1e9;cs.forEach((c,i)=>{const dd=(p[0]-c[0])**2+(p[1]-c[1])**2+(p[2]-c[2])**2;if(dd<bd){bd=dd;bi=i;}});const t=sum[bi];t[0]+=p[0];t[1]+=p[1];t[2]+=p[2];t[3]++;});
      sum.forEach((t,i)=>{if(t[3])cs[i]=[t[0]/t[3],t[1]/t[3],t[2]/t[3],t[3]];});
    }
    cs.sort((a,b2)=>(b2[3]||0)-(a[3]||0));
    // 尽量把有区分度的颜色都留下：按出现量排序后，跟已选颜色差别够大的才收，最多 10 个
    const picked=[];
    cs.forEach(c=>{
      if(picked.length>=16)return;
      const hx=[c[0],c[1],c[2]];
      if(!picked.some(o=>Math.abs(o[0]-hx[0])+Math.abs(o[1]-hx[1])+Math.abs(o[2]-hx[2])<42))picked.push(hx);
    });
    const cols=picked.map(c=>_hex(c[0],c[1],c[2]));
    if(cols.length<3){toast('这张图取不出足够的颜色');return;}
    openPalEditor((f.name||'图片色卡').replace(/\.[^.]+$/,''),cols);
  };
  img.onerror=()=>toast('图片读不了');
  img.src=URL.createObjectURL(f);
}
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
  (async()=>{await hydrateLocalFromServer();await loadBookPalettes();loadSavedTheme();if(typeof render==='function'&&typeof DATA!=='undefined'&&DATA&&DATA.length)render();})();
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
      try{DATA.forEach(b=>{b.c=coverColor(b.t);});}catch(e){}
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
    progress:b.rs==='reading'?Math.min(99,Math.max(0,Math.round(b.pc||0))):0,
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
      <b onclick="togglePanelFold()" style="cursor:pointer" title="点这里收起/展开筛选">按标签筛选</b><span class="fp-tip">点维度名展开/收起 · 点标签：必含→排雷→取消 · 拖标签可换维度 · 编辑标签＝删除不要的</span>
      <span style="margin-left:auto"></span>
      <button class="fp-clear" onclick="fpToggleAll()">展开/收起各项</button>
      <button class="fp-clear${window._fpEditMode?' fp-edit-on':''}" onclick="toggleTagEdit()">${window._fpEditMode?'完成编辑':'编辑标签'}</button>
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
  if(window._fpEditMode){
    return `<span class="fp-chip editing">${esc(t)}<i>${n}</i><span class="fp-x" title="从所有书上删除这个标签" onclick="delTagAll('${ta}')">×</span></span>`;
  }
  return `<span class="fp-chip ${st}" draggable="true" ondragstart="fpDragStart(event,'${ta}')" onclick="cycleTag('${ta}')">${sign?`<b>${sign}</b>`:''}${esc(t)}<i>${n}</i></span>`;
}
function toggleTagEdit(){window._fpEditMode=!window._fpEditMode;buildFilterPanel();}
// 整库删除一个标签：书还在，只是身上不再挂这个标签
async function delTagAll(t){
  const n=DATA.filter(b=>(b.genres||[]).includes(t)).length;
  if(!confirm('删除标签「'+t+'」？\n会从 '+n+' 本书上移除（书不受影响），不可撤销。'))return;
  try{
    const r=await fetch('/api/tag?name='+encodeURIComponent(t),{method:'DELETE'});
    if(!r.ok)throw 0;
    DATA.forEach(b=>{if(b.genres)b.genres=b.genres.filter(g=>g!==t);});
    tagInclude.delete(t);tagExclude.delete(t);
    try{sessionStorage.removeItem('shelf_cache');sessionStorage.removeItem('shelf_cache_at');}catch(e){}
    buildFilterPanel();updateFilterSummary();render();
    toast('已删除标签「'+t+'」');
  }catch(e){toast('删除失败');}
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
  if(next==='finished')setTimeout(()=>{try{celebrateFinish(bid);}catch(e){}},150);
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
      ${b.cover?`<button class="mc-cover-del" onclick="deleteCover(${bid})" title="删除封面">×封面</button>`:''}
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
        if(rd.passes>=1)summary+=` · 读完 <b>${rd.passes}</b> 遍`;          // v4.5：进度 0→100 才算一遍
        if(rd.in_pass&&rd.current_pct>0)summary+=` · 本遍读到 ${rd.current_pct}%`;
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
  // v4.5：遍数新口径——「第 N 遍读完」打在到达 100%（≥97）的那一天；百分比后端已归一到 0~100，不再 ×100
  const marks={};(rd.pass_marks||[]).forEach(m=>{marks[m.date]='第 '+m.n+' 遍读完';});
  const rows=(rd.days||[]).map(d=>{
    const tag=marks[d.date]?`<span class="rt-pass">${marks[d.date]}</span>`:'';
    const mins=d.minutes?` · ${d.minutes} 分钟`:'';
    const pct=(d.end!=null)?` · 读到 ${Math.round(d.end||0)}%`:'';
    return `<div class="rt-row"><span class="rt-date">${fmt(d.date)}</span><span class="rt-meta">${tag}${mins}${pct}</span></div>`;
  }).join('');
  const sumPass=rd.passes>=1?` · 读完 ${rd.passes} 遍`:'';
  const sumCur=(rd.in_pass&&rd.current_pct>0)?` · 本遍读到 ${rd.current_pct}%`:'';
  const h=`<div class="rt-modal-inner"><div class="rt-head">阅读回顾<span class="rt-sum">共 ${rd.day_count} 天${sumPass}${sumCur} · ${Math.round((rd.total_minutes||0)/60*10)/10} 小时</span></div><div class="rt-list">${rows||'还没有阅读记录'}</div><button class="rt-close" onclick="closeReadTimeline()">关闭</button></div>`;
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
async function deleteCover(bid){
  if(!confirm('删除这本书的封面？（恢复成书名色块）'))return;
  try{
    const r=await fetch('/api/cover/'+bid,{method:'DELETE'});
    if(r.ok){
      const b=DATA.find(x=>x.id===bid);if(b)b.cover=false;
      toast('封面已删除');
      openBook(bid);  // 重开详情卡
      render();       // 刷新书架
    }else{toast('删除失败');}
  }catch(e){toast('删除出错');}
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

