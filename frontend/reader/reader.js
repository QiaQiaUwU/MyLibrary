
// ===== 版本标记：F12 控制台看到这行 = 加载的是新版(v3.69.1：上限按模型自适应+音频空间感)；看不到就是旧 exe 或浏览器缓存 =====
// 版本规则：加功能升次版本(3.64→3.65)，修 bug 升补丁号(3.65.0→3.65.1)
console.log('%c MyLibrary reader %c build 2026-07-01 · v3.69.1 ','background:#16a34a;color:#fff;border-radius:3px 0 0 3px;padding:2px 5px','background:#052e16;color:#bbf7d0;border-radius:0 3px 3px 0;padding:2px 7px');
window.__READER_BUILD='2026-07-01-v3.69.1';

// ============ 全局状态 ============
const P = new URLSearchParams(location.search);
const bookId = parseInt(P.get('id')) || 0;
let bookText='', bookTitle='', bookAuthor='', bookExt='txt', totalChars=0;
let curPos=0, chatHistory=[], quillSessionId=null;
let mode='scroll';            // scroll | page
let pages=[], curPage=0;      // 翻页模式
let epubBook=null, epubRend=null;
let highlights=[], bookmarks=[];
let uiVisible=false;
let readStartTime=Date.now(), readStartPct=0;

// ============ 皮肤定义 ============
const SKINS=[
  {id:'paper',  name:'羊皮纸', paper:'#f4ecd8',ink:'#3a3226',ink2:'#6b5d48',accent:'#8a4b3a',ui:'#ece3cf',border:'#d3c5a6'},
  {id:'cream',  name:'米白',  paper:'#faf6ed',ink:'#4a4234',ink2:'#7a6e58',accent:'#9c6644',ui:'#f2ece0',border:'#ddd0b8'},
  {id:'green',  name:'豆沙绿',paper:'#c7d9c0',ink:'#33402d',ink2:'#566b4c',accent:'#5a7d4f',ui:'#bcd0b4',border:'#a3bb9b'},
  {id:'sepia',  name:'怀旧棕',paper:'#e4d5b7',ink:'#4a3826',ink2:'#7a6448',accent:'#8a5a2a',ui:'#dccaa8',border:'#c9b896'},
  {id:'dark',   name:'夜间',  paper:'#1a1a1a',ink:'#b8b0a0',ink2:'#888070',accent:'#a87850',ui:'#242420',border:'#3a3632'},
  {id:'darkblue',name:'深蓝', paper:'#15202b',ink:'#a8b0b8',ink2:'#788088',accent:'#5a8aaa',ui:'#1c2832',border:'#2a3640'},
  {id:'black',  name:'纯黑',  paper:'#000000',ink:'#999088',ink2:'#666058',accent:'#886644',ui:'#141414',border:'#2a2a2a'},
];
const TEXTURES={
  none:'none',
  paper:'url(/api/theme/asset/texture_paper.png)',
  linen:'url(/api/theme/asset/texture_linen.png)',
  twill:'url(/api/theme/asset/texture_twill.png)',
  canvas:'url(/api/theme/asset/texture_canvas.png)',
  grain:'url(/api/theme/asset/texture_grain.png)',
  dots:'url(/api/theme/asset/texture_dots.png)',
};
const FONTS={serif:"'Noto Serif SC','Songti SC',serif",kai:"'Kaiti SC','STKaiti',楷体,serif",hei:"'Noto Sans SC','PingFang SC',sans-serif",fangsong:"'FangSong','STFangsong',仿宋,serif"};

// ============ 初始化 ============
async function READER_INIT(){
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  // 卷曲翻页(StPageFlip)已停用，改用本地轻量翻页 → 不再轮询等待 CDN 库到货。
  // watchFlipLib();
  applySkin(localStorage_get('skin')||'paper');
  // 关键：先把交互和工具栏装好、显出来。这样即使正文还在加载/加载失败，
  // 顶栏、返回书房、菜单也都能用——不会再出现"整页空白、回不去"的情况。
  bindEvents();
  buildSkinUI();
  buildAmbientUI();
  uiVisible=true;
  document.getElementById('topbar').classList.add('show');
  document.getElementById('botbar').classList.add('show');
  document.body.classList.add('ui-on');
  setTimeout(()=>{if(uiVisible){uiVisible=false;document.getElementById('topbar').classList.remove('show');document.getElementById('botbar').classList.remove('show');document.body.classList.remove('ui-on');}},3500);
  // 先显个"正在载入"，让用户知道在动
  const sc=document.getElementById('scroll-content');
  if(sc)sc.innerHTML='<div class="reader-note">正在载入正文…<div class="rn-bar"><div class="rn-fill" id="load-fill"></div></div></div>';
  document.getElementById('scroll-view').classList.add('active');
  await loadPrefs();
  loadDesk();
  syncQuill();
  if(!pageSoundOn){document.getElementById('psound-on').classList.remove('sel');document.getElementById('psound-off').classList.add('sel');}
  await loadBook();
}

// 偏好读写（存DB而非localStorage）
let PREFS={};
function localStorage_get(k){return PREFS[k];}
function _syncOptRow(rowId,val){
  const row=document.getElementById(rowId);if(!row)return;
  const v=String(val);
  row.querySelectorAll('.opt').forEach(b=>b.classList.toggle('sel',b.dataset.v===v));
}
async function loadPrefs(){
  try{PREFS=await (await fetch('/api/reading-prefs')).json();}catch(e){PREFS={};console.warn('阅读偏好加载失败',e);}
  if(PREFS.skin)applySkin(PREFS.skin);
  if(PREFS.fontsize)setFontSize(PREFS.fontsize,true);
  if(PREFS.lineheight){
    document.documentElement.style.setProperty('--lineheight',PREFS.lineheight);
    _syncOptRow('lineheight-row',PREFS.lineheight);
  }
  if(PREFS.font){
    document.documentElement.style.setProperty('--font',FONTS[PREFS.font]||FONTS.serif);
    _syncOptRow('font-row',PREFS.font);
  }
  if(PREFS.texture){
    document.documentElement.style.setProperty('--texture',TEXTURES[PREFS.texture]||'none');
    _syncOptRow('texture-row',PREFS.texture);
  }
  if(PREFS.textureOp!==undefined&&PREFS.textureOp!==null&&PREFS.textureOp!==''){
    const op=Math.max(0,Math.min(100,parseInt(PREFS.textureOp)||70));
    document.documentElement.style.setProperty('--texture-op',op/100);
    const ts=document.getElementById('texop-slider');if(ts)ts.value=op;
  }
  if(PREFS.pageSound==='0'){pageSoundOn=false;}
  if(PREFS.pageVol!==undefined&&PREFS.pageVol!==null&&PREFS.pageVol!==''){
    pageVol=Math.max(0,Math.min(1,(parseInt(PREFS.pageVol)||70)/100));
    const ps=document.getElementById('pvol-slider');if(ps)ps.value=Math.round(pageVol*100);
  }
  if(PREFS.quillBall==='0'){
    const fab=document.getElementById('quill-fab');if(fab)fab.classList.add('hidden');
    const on=document.getElementById('quillball-on'),off=document.getElementById('quillball-off');
    if(on)on.classList.remove('sel');if(off)off.classList.add('sel');
  }
  if(PREFS.mode==='page'){mode='page';}
}
async function savePref(k,v){
  PREFS[k]=v;
  try{
    const r=await fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({[k]:v})});
    if(!r.ok)throw new Error('HTTP '+r.status);
  }catch(e){
    console.warn('阅读偏好保存失败：',k,v,e);
    if(typeof toast==='function')toast('设置没保存上（网络问题），刷新后可能会恢复默认');
  }
}

async function loadBook(){
  if(!bookId){showReaderError('缺少书籍 id');return;}
  let info;
  try{info=await (await fetch('/api/book?id='+bookId)).json();}
  catch(e){showReaderError('打不开这本书的信息，可能服务没在运行');return;}
  if(!info||!info.book){showReaderError('找不到这本书');return;}
  bookTitle=info.book.title||'未知';bookAuthor=info.book.author||'';
  bookExt=(info.book.file_ext||'txt').toLowerCase().replace('.','');
  document.getElementById('book-title').textContent=bookTitle+(bookAuthor?' · '+bookAuthor:'');
  document.title=bookTitle;
  totalChars=info.book.word_count||0;

  // 打开即自动标记为"在读"（放进书架顶部）
  try{fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bookId,reading_status:'reading'})});}catch(e){}

  // 加载高亮和书签（失败不影响读正文）
  try{highlights=(await (await fetch('/api/highlights/'+bookId)).json()).highlights||[];}catch(e){}
  try{bookmarks=(await (await fetch('/api/bookmarks/'+bookId)).json()).bookmarks||[];}catch(e){}

  if(bookExt==='epub'){await loadEpub();return;}
  if(bookExt==='pdf'){await loadPdf();return;}

  // 先把滚动视图亮出来并显示"正在加载"，别让用户对着白屏不知道发生了什么
  try{
    document.getElementById('scroll-view').classList.add('active');
    document.getElementById('page-view').classList.remove('active');
    document.getElementById('scroll-content').innerHTML='<div class="reader-loading" id="reader-loading">正在加载正文…</div>';
  }catch(e){}
  // 看门狗：30 秒还没出来就提示，不再无声卡白屏
  let _loaded=false;
  setTimeout(()=>{ if(!_loaded){const el=document.getElementById('reader-loading'); if(el)el.innerHTML='加载有点久…如果一直不出来，多半是这本文件很大或服务卡住了。可关掉阅读器窗口重开，或在书房里重新打开。';} }, 30000);

  // txt：分段拉取（每段 ~256KB），既能显进度，又不会一次性塞一个超大 JSON 把页面卡死
  try{
    bookText=await fetchBookTextChunked();
  }catch(e){
    showReaderError('正文加载失败：'+(e&&e.message?e.message:e));return;
  }
  _loaded=true;
  if(!bookText){showReaderError('这本书没有可显示的正文（文件可能是空的、损坏，或不是纯文本）');return;}
  bookText=bookText.replace(/\r\n?/g,'\n');   // 统一换行(\r\n/\r→\n)：让"原文字符偏移"和屏幕渲染严格一致，划线定位才不会漂
  totalChars=bookText.length;
  recoverHlOffsets();   // 开书时按划线文字在正文里重新定位每一条（修正历史版本算错的偏移）
  renderText();

  // 恢复进度（若从总览跳转带了 ?pos=，优先定位到该位置）
  const jumpPos=parseInt(P.get('pos'))||0;
  let prog={position:0};
  try{prog=await (await fetch('/api/book/'+bookId+'/progress')).json();}catch(e){}
  if(jumpPos>0){curPos=jumpPos;readStartPct=jumpPos/totalChars;setTimeout(()=>jumpTo(jumpPos),120);}
  else if(prog.position>0){curPos=prog.position;readStartPct=prog.position/totalChars;restorePos();}
  setTimeout(()=>updateReadProgress(curPos/Math.max(totalChars,1)),300);
}

// 分段把正文取回来（带进度条），避免一次性超大请求 + 超大 JSON 解析卡死浏览器
async function fetchBookTextChunked(){
  const STEP=262144;            // 每次约 256KB 文本
  let offset=0,parts=[],total=null,guard=0;
  const fill=document.getElementById('load-fill');
  while(true){
    const r=await (await fetch(`/api/book/${bookId}/content?offset=${offset}&limit=${STEP}`)).json();
    const t=r.text||'';
    parts.push(t);
    if(total==null)total=r.total_chars||0;
    offset+=t.length;
    const ld=document.getElementById('reader-loading');
    if(ld&&total)ld.textContent='正在加载正文… '+Math.min(100,Math.round(offset/total*100))+'%';
    if(fill&&total)fill.style.width=Math.min(100,Math.round(offset/total*100))+'%';
    if(!r.has_more||t.length===0)break;
    if(++guard>2000)break;       // 极端兜底，防御性
    // 让出主线程，避免长循环卡 UI
    if(guard%4===0)await new Promise(requestAnimationFrame);
  }
  return parts.join('');
}

function showReaderError(msg){
  const sc=document.getElementById('scroll-content');
  document.getElementById('scroll-view').classList.add('active');
  document.getElementById('page-view').classList.remove('active');
  if(sc)sc.innerHTML=`<div class="reader-note">${escapeHtml(msg)}<br><a class="rn-btn" href="/">返回书房</a></div>`;
}

function renderText(){
  if(bookExt==='epub'||!bookText){ document.body.classList.toggle('paged-read', mode==='page'); return; }   // epub 走自己那套，别用 bookText 重渲染
  // 翻页和滚动用同一套连续正文(.rblock)：划线/定位完全一致、切换零跳变。
  //  · 滚动 = 容器可自由上下滚；
  //  · 翻页 = CSS 禁掉手动滚动(overflow:hidden)，点左右用脚本把容器整屏换到上/下一页(交叉淡入，像翻页)；
  //          划线拖到屏幕下沿时计时器自动续滚，可跨页连续选到需要位置。
  destroyFlip();
  document.getElementById('page-view').classList.remove('active');
  document.getElementById('scroll-view').classList.add('active');
  document.getElementById('mode-label').textContent=(mode==='page')?'翻页':'滚动';
  document.body.classList.toggle('paged-read', mode==='page');
  renderScrollBlocks();
}




// 把长正文切成块，整本一次性进 DOM，但用 CSS content-visibility 让浏览器只渲染可视块。
// 这样十几 MB 的长篇也能秒开、不卡；进度/定位用"块的字符偏移"来算，准确。
let blockOffsets=[];   // 每个块的起始字符偏移
function splitBlocks(text,size){
  const blocks=[];let i=0,n=text.length;
  while(i<n){
    let end=Math.min(i+size,n);
    if(end<n){
      // 尽量在换行处断开，读起来不突兀
      const nl=text.lastIndexOf('\n',end);
      if(nl>i+size*0.5)end=nl+1;
    }
    blocks.push([i,text.slice(i,end)]);
    i=end;
  }
  if(blocks.length===0)blocks.push([0,'']);
  return blocks;
}
function renderScrollBlocks(){
  const sc=document.getElementById('scroll-content');
  const blocks=splitBlocks(bookText,4000);
  blockOffsets=blocks.map(b=>b[0]);
  // 一次性构建（节点数可控：4000字/块 → 1MB≈250块、10MB≈2500块），渲染由 content-visibility 兜住
  sc.innerHTML=blocks.map(b=>`<div class="rblock" data-off="${b[0]}">${renderParas(b[1],b[0],true)}</div>`).join('');
  // 实测首块真实高度，作为所有块的占位高度（contain-intrinsic-size）→ 占位≈真实，跳转/滚动时不再因占位太矮而大幅错位。
  // 首块在视口内、必被渲染；配合 CSS 的 auto 关键字，块渲染过一次后浏览器会记住各自真实高度、更准。
  requestAnimationFrame(()=>{
    const first=sc.querySelector('.rblock');
    if(first){const h=Math.round(first.getBoundingClientRect().height);if(h>200)sc.style.setProperty('--blk-ih',h+'px');}
  });
}

// ============ 翻页：分页 ============



// ============ StPageFlip 真实翻页 ============
let pageFlip=null;
function destroyFlip(){
  if(pageFlip){
    // 关键修复：page-flip 的 setHandlers() 总会 window.addEventListener('resize', onResize)，
    // 但它的 destroy() 只有在 useMouseEvents 为真时才调用 removeHandlers() 去摘这个监听。
    // 我们用的是 useMouseEvents:false → 那个 resize 监听【永远不被移除】，一路累积；窗口最大化时旧实例的 onResize
    // 仍会按"新的大容器 vs 旧的固定页尺寸"重算并把页面挪出可视区 → 整页空白（页码却没变）。
    // 这里在 destroy 前把 useMouseEvents 临时打开，逼库执行 removeHandlers() 把它自己注册的 resize 监听摘掉
    //（顺带要移除的鼠标/触摸监听本来就没注册，removeEventListener 对不存在的监听无害）。
    try{ const st=pageFlip.getSettings&&pageFlip.getSettings(); if(st)st.useMouseEvents=true; }catch(e){}
    try{pageFlip.destroy();}catch(e){}
    pageFlip=null;
  }
  // 彻底清空容器（destroy 可能留下 stf__parent 类、内联宽高等残骸，导致下次重建空白）
  const container=document.getElementById('flip-book');
  if(container){
    container.innerHTML='';
    container.className='';            // 去掉 StPageFlip 加的 stf__parent 等类
    container.removeAttribute('style'); // 清掉上次设的内联 width/height/display，下次重新设（CSS 里的 #flip-book 基样式还在）
  }
  if(typeof setTapZonesForFlip==='function')setTapZonesForFlip(false);
}
const FLIP_MAX_PAGES=1500;   // 普通小说都给真·卷曲翻页；只有超大整本(上千页)才退回内置 CSS 3D 翻页防卡
let _flipRetry=0;
// 翻页库可能从 CDN(jsdelivr/unpkg) 或本地异步加载，常常晚于初始化才到。
// 这里轮询等它到货：一旦 St.PageFlip 可用、且当前在翻页模式还没建卷曲翻页，就重建一次 → 升级成卷曲翻页。
let _flipLibWatch=false;
function watchFlipLib(){
  if(_flipLibWatch)return; _flipLibWatch=true;
  if(typeof St!=='undefined' && St.PageFlip)return;
  let n=0;
  const iv=setInterval(()=>{
    n++;
    if(typeof St!=='undefined' && St.PageFlip){
      clearInterval(iv);
      if(mode==='page' && pages && pages.length && !pageFlip){ try{initFlip();}catch(e){} }
    }else if(n>=30){ clearInterval(iv); }
  },200);
}
function initFlip(){
  // 用户这会儿可能已切回滚动模式（上一次的延迟回调才执行到这）——别在隐藏容器上建实例，否则留下空白
  if(mode!=='page'){return;}
  destroyFlip();
  const container=document.getElementById('flip-book');
  if(!container)return;
  // 容器还没完成布局（宽度≈0）就建 StPageFlip 会量到 0 → 空白。等一帧重试（最多几次，避免死循环）
  const cw=container.getBoundingClientRect().width || container.offsetWidth || 0;
  if(cw<60 && _flipRetry<8){_flipRetry++;requestAnimationFrame(()=>initFlip());return;}
  _flipRetry=0;
  container.innerHTML='';
  // 优先用 StPageFlip 的真·卷曲翻页（你早期喜欢的那个效果）。关键防线有两层，保证不会再变两页：
  //  1) 把书容器锁成"单页宽、居中"，单页最小宽=容器0.72 → 容器塞不下两页；
  //  2) 建好后再查一次朝向，万一仍是 landscape(两页) 就立刻销毁、退回内置单页翻折。
  // 拿不到库(离线没缓存到)时也退回内置单页翻折。两条路都是单列、前后能翻、不空白。
  const useStf = false;   // 卷曲翻页已停用：一律走下面的本地轻量翻页(showPageSimple)
  if(useStf && tryInitStPageFlip(container)){
    return;   // StPageFlip 起来了且是单页
  }
  // 退回内置单页 CSS 翻折
  pageFlip=null;
  container.style.display='none';
  const ps=document.getElementById('page-stack');
  if(ps)ps.style.display='block';
  setTapZonesForFlip(false);
  showPageSimple(curPage);
  return;
}
// 尝试用 StPageFlip 建单页翻页；成功且确实单页返回 true，否则清理并返回 false
function tryInitStPageFlip(container){
  try{
    container.style.display='';
    const ps=document.getElementById('page-stack'); if(ps)ps.style.display='none';
    let w=Math.min(window.innerWidth,parseInt(getComputedStyle(document.documentElement).getPropertyValue('--pagewidth'))||680);
    let h=window.innerHeight;
    if(h<200)h=Math.max(400,window.innerHeight);
    if(w<200)w=Math.min(680,window.innerWidth);
    container.style.width=w+'px'; container.style.maxWidth='100%';
    const minW=Math.max(280,Math.floor(w*0.72));
    const pageEls=pages.map((p,i)=>{
      const div=document.createElement('div');
      div.className='flip-page';
      div.dataset.density=(i===0||i===pages.length-1)?'hard':'soft';
      div.innerHTML='<div class="flip-page-content" data-off="'+p[0]+'">'+renderParas(p[1],p[0],true)+'<div class="flip-pageno">'+(i+1)+'</div></div>';
      return div;
    });
    pageEls.forEach(el=>container.appendChild(el));
    const _cur=Math.max(0,Math.min(pages.length-1,curPage|0));
    pageFlip=new St.PageFlip(container,{
      width:Math.max(280,w),height:h,size:'fixed',
      // 从当前页开建。库的 loadFromHTML 里 pages.show(startPage) 是同步的，但定稿布局的 ui.update() 走 setTimeout(0) 晚一拍：
      // 若不指定 startPage，它先按第 0 页摆位，我们随后的 turnToPage 又赶在布局定稿前执行 → 重建后当前页摆位错/被隐藏 → 整页空白(页码却还显示对)。
      startPage:_cur,
      maxShadowOpacity:0.5,showCover:false,usePortrait:true,mobileScrollSupport:false,
      drawShadow:true,flippingTime:650,swipeDistance:30,
      // disableFlipByClick 必须为 false。它为 true 时，库内部 flip() 会先做"落点是否在书角"的判断：
      // flipNext 用的合成落点在右下角（通过），flipPrev 用的落点 {x:10} 在左缘——竖排单页下它算出来不在书角，
      // 于是 flip() 直接 return，向前翻页就"点了没反应"（正是小窗只能往后、翻不回去的根因）。
      // 因为 useMouseEvents 已是 false（库不监听鼠标/触摸），关掉这个判断不会带来"点书页就乱翻"，只让我们自己调用的 flipPrev/flipNext 两个方向都生效。
      useMouseEvents:false,clickEventForward:false,disableFlipByClick:false,
    });
    pageFlip.loadFromHTML(container.querySelectorAll('.flip-page'));
    // usePortrait:true 已强制单页竖排，不再"一检测到 landscape 就销毁"——那条防线太敏感，
    // 会在布局还没稳时把本来正常的卷曲翻页误杀掉（这正是你说"短暂修好又被改坏"的元凶）。
    // 在库自己的延迟 init(setTimeout 0)之后、以及再下一帧，各补一次定位，确保当前页真的显示出来（治"放大后空白"）。
    const _showCur=()=>{ try{pageFlip&&pageFlip.turnToPage(Math.max(0,Math.min(pages.length-1,curPage|0)));}catch(e){} };
    _showCur();
    setTimeout(_showCur,0);
    requestAnimationFrame(()=>{ _showCur(); updatePageNum(); });
    setTapZonesForFlip(true);
    pageFlip.on('flip',(e)=>{
      curPage=e.data;
      if(pages[curPage]){curPos=pages[curPage][0];saveProgress();recordDiary();}
      updatePageNum();playPageSound();
    });
    updatePageNum();
    return true;
  }catch(e){ try{destroyFlip();}catch(_){}
    return false;
  }
}

// StPageFlip 在用时让出侧边手势区（否则拖不动书页），回退翻页时恢复
function setTapZonesForFlip(flipActive){
  const l=document.getElementById('tap-left'),r=document.getElementById('tap-right'),c=document.getElementById('tap-center');
  if(!l||!r||!c)return;
  if(flipActive){
    l.style.pointerEvents='none';r.style.pointerEvents='none';
    // 中间呼出工具栏的区域缩窄到正中，避免挡住书页两侧的拖拽起手
    c.style.left='42%';c.style.width='16%';
  }else{
    l.style.pointerEvents='';r.style.pointerEvents='';
    c.style.left='30%';c.style.width='40%';
  }
}
function updatePageNum(){
  document.getElementById('page-num').textContent=(curPage+1)+' / '+pages.length+'  ·  '+Math.round((curPage+1)/pages.length*100)+'%';
}

function pageHTML(n){
  if(n<0||n>=pages.length)return '';
  const [offset,content]=pages[n];
  return renderParas(content,offset,true);
}
// 简单翻页（StPageFlip 加载失败/长篇时的回退）—— 现在前后翻都有滑入动画
function renderPageStatic(n){
  if(n<0)n=0;if(n>=pages.length)n=pages.length-1;
  curPage=n;
  const [offset,content]=pages[n];
  curPos=offset;
  document.getElementById('page-stack').innerHTML=
    '<div class="page-sheet page-under" id="under-sheet"></div>'+
    '<div class="page-sheet page-top" id="cur-sheet" data-off="'+offset+'">'+renderParas(content,offset,true)+
      '<div class="page-shadow" id="page-shadow"></div></div>';
}
function showPageSimple(n,dir){
  if(n<0)n=0;if(n>=pages.length)n=pages.length-1;
  curPage=n;
  if(!dir){renderPageStatic(n);updatePageNum();saveProgress();recordDiary();return;}
  const stack=document.getElementById('page-stack');
  const [offset,content]=pages[n];
  curPos=offset;
  const oldIdx=n-dir;
  // 内置 CSS 3D 翻页：一张页面绕"书脊"（左缘）翻折，露出底下的另一页，像翻一页纸。
  if(dir>0){
    // 往后翻：新页(n)垫在底下不动；旧页(oldIdx)绕左缘往左翻走
    stack.innerHTML=
      '<div class="page-sheet page-under" data-off="'+offset+'">'+renderParas(content,offset,true)+'</div>'+
      '<div class="page-sheet page-fold" id="fold-sheet">'+(oldIdx>=0&&oldIdx<pages.length?pageHTML(oldIdx):'')+'<i class="fold-shade"></i></div>';
    const f=document.getElementById('fold-sheet');
    if(f){
      f.style.transition='none';f.style.transform='rotateY(0deg)';
      void f.offsetWidth;   // 强制回流，确保起始态生效，下面的 transition 才会真正动起来（双 rAF 在某些 webview 会被跳过 → 没动画）
      f.style.transition='transform .62s cubic-bezier(.37,.05,.26,1)';
      f.style.transform='rotateY(-168deg)';
      const sh=f.querySelector('.fold-shade');if(sh)sh.style.opacity='1';
    }
  }else{
    // 往前翻：旧页(oldIdx)垫在底下；新页(n)从左缘翻折进来盖上
    stack.innerHTML=
      '<div class="page-sheet page-under" data-off="'+(pages[oldIdx]?pages[oldIdx][0]:offset)+'">'+(oldIdx>=0&&oldIdx<pages.length?pageHTML(oldIdx):'')+'</div>'+
      '<div class="page-sheet page-fold" id="fold-sheet" data-off="'+offset+'">'+renderParas(content,offset,true)+'<i class="fold-shade"></i></div>';
    const f=document.getElementById('fold-sheet');
    if(f){
      f.style.transition='none';f.style.transform='rotateY(168deg)';
      void f.offsetWidth;
      f.style.transition='transform .62s cubic-bezier(.37,.05,.26,1)';
      f.style.transform='rotateY(0deg)';
      const sh=f.querySelector('.fold-shade');if(sh)sh.style.opacity='0';
    }
  }
  clearTimeout(_foldDone);
  _foldDone=setTimeout(()=>renderPageStatic(n),650);
  updatePageNum();
  saveProgress();
  recordDiary();
}
let _foldDone=null;


// ============ 卷纸翻页动画（跟手）============
let dragging=false,dragStartX=0,dragDir=0;
function bindEvents(){
  // 滚动模式进度追踪（用"可视块的字符偏移"计算，配合分块渲染才准）
  const sv=document.getElementById('scroll-view');
  sv.addEventListener('scroll',()=>{
    curPos=currentScrollOffset();   // 即时更新阅读位置：切换模式/改字号时能准确回到这里
    clearTimeout(window._st);window._st=setTimeout(()=>{saveProgress();recordDiary();},900);
  },{passive:true});

  // 翻页：用 pointerdown/pointerup 自己判断"轻点"（不依赖 click —— StPageFlip 会吞掉书页 click）。
  // 轻点（基本没移动、时间短、没选中文字）= 翻页/呼出工具栏；有明显移动 = 在选字，放过去不翻页。
  document.addEventListener('pointerdown',readerPointerDown,true);
  document.addEventListener('pointermove',readerPointerMove,true);
  document.addEventListener('pointerup',readerPointerUp,true);
  document.addEventListener('selectionchange',()=>{const s=window.getSelection();if(_tapDown&&s&&s.toString().trim())_selDuringTap=true;});
  // 卷纸跟手拖动（翻页模式）
  const pv=document.getElementById('page-view');
  pv.addEventListener('touchstart',onDragStart,{passive:true});
  pv.addEventListener('touchmove',onDragMove,{passive:false});
  pv.addEventListener('touchend',onDragEnd);
  pv.addEventListener('mousedown',onDragStart);
  pv.addEventListener('mousemove',onDragMove);
  pv.addEventListener('mouseup',onDragEnd);

  // 键盘
  document.addEventListener('keydown',e=>{
    if(mode==='page'){if(e.key==='ArrowLeft')pageScroll(-1);if(e.key==='ArrowRight')pageScroll(1);}
  });

  // 选中文字
  document.addEventListener('selectionchange',onSelection);
  document.addEventListener('mouseup',showSelMenu);
  document.addEventListener('touchend',showSelMenu);
  // 翻页音效：预解码 + 首次交互唤醒 AudioContext（浏览器自动播放策略要求用户手势后才出声）
  _preloadPageSound();
  const _wakeAudio=()=>{const c=_ensureAudioCtx();if(c&&c.state==='suspended'){try{c.resume();}catch(e){}}_preloadPageSound();};
  document.addEventListener('pointerdown',_wakeAudio,{once:true});
  document.addEventListener('touchstart',_wakeAudio,{once:true});
  document.addEventListener('keydown',_wakeAudio,{once:true});   // 有人第一下交互就是按方向键翻页，不一定先点/触过屏
  // 触摸设备兜底：手机选字常是用原生手柄拖出/调整的，document 上未必触发 touchend → 菜单弹不出来。
  // 用 selectionchange 防抖：选区稳定且非空时，自动把（停靠底部的）笔记菜单弹出来。
  document.addEventListener('selectionchange',scheduleSelMenuTouch);
  // 手指一碰菜单就锁住当前选区范围：避免“点笔记/划线”那一下把选区清掉、导致‘没接住选中的文字’
  const _selMenuEl=document.getElementById('sel-menu');
  if(_selMenuEl)_selMenuEl.addEventListener('pointerdown',()=>{const r=selectionCharRange();if(r){selCharRange=r;selText=r.text.trim();}},true);
}
let _selMenuTouchTimer=null;
function scheduleSelMenuTouch(){
  if(!IS_TOUCH)return;
  clearTimeout(_selMenuTouchTimer);
  _selMenuTouchTimer=setTimeout(()=>{
    const s=window.getSelection();
    if(s&&!s.isCollapsed&&s.toString().trim()){ onSelection(); showSelMenu(); }
    else { const m=document.getElementById('sel-menu'); if(m&&!(s&&s.toString().trim()))m.classList.remove('show'); }
  },320);
}

function getX(e){return e.touches?e.touches[0].clientX:e.clientX;}
function onDragStart(e){
  if(mode!=='page'||pageFlip)return;  // StPageFlip 在用时它自己处理拖动
  dragging=true;dragStartX=getX(e);
  const sheet=document.getElementById('cur-sheet');
  if(sheet)sheet.style.transition='';
}
function onDragMove(e){
  if(!dragging||mode!=='page'||pageFlip)return;
  const dx=getX(e)-dragStartX;
  const sheet=document.getElementById('cur-sheet');
  const under=document.getElementById('under-sheet');
  if(!sheet)return;
  if(Math.abs(dx)>5&&e.preventDefault)e.preventDefault();
  // 左滑=下一页（顶层往左卷走，露出底层下一页）
  // 右滑=上一页（需要先把上一页铺在底层）
  if(dx<0){
    // 下一页：底层显示 n+1
    if(under)under.innerHTML=pageHTML(curPage+1);
    const w=window.innerWidth;
    const ratio=Math.max(-1,dx/w);  // -1..0
    // 顶层向左位移并轻微卷曲（透视）
    sheet.style.transform=`translateX(${dx}px) rotateY(${-ratio*18}deg)`;
    sheet.style.transformOrigin='left center';
    const sh=document.getElementById('page-shadow');
    if(sh)sh.style.opacity=Math.min(0.5,Math.abs(dx)/w*1.2);
  }else if(dx>0){
    // 上一页：底层显示 n-1，顶层其实应是上一页盖下来，简化为当前页右移露出底层上一页
    if(under)under.innerHTML=pageHTML(curPage-1);
    const w=window.innerWidth;
    const ratio=Math.min(1,dx/w);
    sheet.style.transform=`translateX(${dx}px) rotateY(${ratio*18}deg)`;
    sheet.style.transformOrigin='right center';
    const sh=document.getElementById('page-shadow');
    if(sh)sh.style.opacity=Math.min(0.5,dx/w*1.2);
  }
}
function onDragEnd(e){
  if(!dragging||mode!=='page')return;dragging=false;
  const sheet=document.getElementById('cur-sheet');
  if(!sheet)return;
  const endX=e.changedTouches?e.changedTouches[0].clientX:getX(e);
  const dx=endX-dragStartX;
  sheet.style.transition='transform .32s cubic-bezier(.4,0,.2,1)';
  if(dx<-55&&curPage<pages.length-1){animateFlip(1);}
  else if(dx>55&&curPage>0){animateFlip(-1);}
  else{
    // 回弹
    sheet.style.transform='';
    const sh=document.getElementById('page-shadow');if(sh)sh.style.opacity='0';
    setTimeout(()=>sheet.style.transition='',320);
  }
}
function animateFlip(dir){
  const sheet=document.getElementById('cur-sheet');
  const w=window.innerWidth;
  if(dir>0){
    sheet.style.transform=`translateX(${-w}px) rotateY(28deg)`;
    sheet.style.transformOrigin='left center';
  }else{
    sheet.style.transform=`translateX(${w}px) rotateY(-28deg)`;
    sheet.style.transformOrigin='right center';
  }
  playPageSound();
  setTimeout(()=>{
    const t=Math.max(0,Math.min(pages.length-1,curPage+dir));
    renderPageStatic(t);updatePageNum();saveProgress();recordDiary();
  },280);
}

// 翻页音效：改用 Web Audio 预解码播放，几乎零延迟。
// （旧版用 HTML5 Audio + 每次 currentTime=0 再 play()，play() 有解码/缓冲延迟 → “翻完页半天才响”。Web Audio 播预解码的 buffer 是同步、可叠放的。）
let pageSoundOn=true,pageVol=0.7;
const PAGE_SFX_MAX=0.5;   // 单次翻页音最长秒数：文件再长也只放这一小段（收尾淡出），彻底避免"点一下一直翻"。想更长/更短改这里即可
let _actx=null,_pageBuf=null,_pageBufLoading=false,_pageAudio=null,_pageAudioStop=null,_pageStart=0;
function _ensureAudioCtx(){
  if(_actx)return _actx;
  try{const C=window.AudioContext||window.webkitAudioContext;if(C)_actx=new C();}catch(e){_actx=null;}
  return _actx;
}
// 找出音频开头第一个能听见的样本时间：跳过前导静音（万一自定义音效开头有空白，也能瞬间响）
function _audibleStart(buf){
  try{
    const d=buf.getChannelData(0);let peak=0;
    for(let i=0;i<d.length;i++){const v=Math.abs(d[i]);if(v>peak)peak=v;}
    const thr=peak*0.02;if(thr<=0)return 0;
    for(let i=0;i<d.length;i++){if(Math.abs(d[i])>thr)return Math.max(0,i/buf.sampleRate-0.003);}
  }catch(e){}
  return 0;
}
function _preloadPageSound(){
  const ctx=_ensureAudioCtx();
  if(!ctx||_pageBuf||_pageBufLoading)return;
  _pageBufLoading=true;
  fetch('/api/sfx/pageturn').then(r=>r.arrayBuffer()).then(buf=>ctx.decodeAudioData(buf))
    .then(dec=>{_pageBuf=dec;_pageStart=_audibleStart(dec);_pageBufLoading=false;}).catch(()=>{_pageBufLoading=false;});
}
function playPageSound(){
  if(!pageSoundOn)return;
  const ctx=_ensureAudioCtx();
  if(ctx&&ctx.state==='suspended'){try{ctx.resume();}catch(e){}}
  if(ctx&&_pageBuf){                       // 主路：Web Audio，零延迟、可叠放
    try{
      const src=ctx.createBufferSource();src.buffer=_pageBuf;
      const g=ctx.createGain();
      const now=ctx.currentTime, off=_pageStart||0;
      // 只播 PAGE_SFX_MAX 这一小段：翻页音文件哪怕有好几秒的"哗啦啦"，也只出"一下"
      const dur=Math.min(PAGE_SFX_MAX, Math.max(0.05,(_pageBuf.duration||PAGE_SFX_MAX)-off));
      g.gain.setValueAtTime(pageVol, now);
      g.gain.setValueAtTime(pageVol, now+Math.max(0,dur-0.06));
      g.gain.linearRampToValueAtTime(0, now+dur);        // 收尾淡出，硬切一段长音频不会"啪"地爆音
      src.connect(g);g.connect(ctx.destination);
      src.start(now, off, dur);                           // 第三个参数=时长，超出部分不播
      try{src.stop(now+dur+0.02);}catch(_){}
      return;
    }catch(e){}
  }
  if(!_pageBuf)_preloadPageSound();        // 还没解码好，顺手预热，下次就走主路
  try{                                     // 回退路：HTML5 Audio
    if(!_pageAudio){_pageAudio=new Audio('/api/sfx/pageturn');_pageAudio.preload='auto';}
    _pageAudio.volume=pageVol;_pageAudio.currentTime=_pageStart||0;_pageAudio.play().catch(()=>{});
    clearTimeout(_pageAudioStop);_pageAudioStop=setTimeout(()=>{try{_pageAudio.pause();}catch(e){}},PAGE_SFX_MAX*1000);
  }catch(e){}
}
function setPageVol(v){pageVol=Math.max(0,Math.min(1,v/100));savePref('pageVol',String(Math.round(pageVol*100)));if(_pageAudio)_pageAudio.volume=pageVol;}
function setPageSound(on,btn){
  pageSoundOn=on;
  savePref('pageSound',on?'1':'0');
  document.getElementById('psound-on').classList.toggle('sel',on);
  document.getElementById('psound-off').classList.toggle('sel',!on);
  if(on)playPageSound();  // 开时试听
}

// 当前滚动位置对应的字符偏移（二分找可视块，O(log n)）
function currentScrollOffset(){
  const sv=document.getElementById('scroll-view');
  const blocks=document.getElementById('scroll-content').children;
  if(!blocks.length||blocks[0].dataset.off===undefined)return curPos;
  const svTop=sv.getBoundingClientRect().top;
  let lo=0,hi=blocks.length-1,ans=0;
  while(lo<=hi){const mid=(lo+hi)>>1;const t=blocks[mid].getBoundingClientRect().top;if(t<=svTop+1){ans=mid;lo=mid+1;}else hi=mid-1;}
  const b=blocks[ans],r=b.getBoundingClientRect();
  const off=parseInt(b.dataset.off)||0;
  const frac=r.height?Math.min(1,Math.max(0,svTop-r.top)/r.height):0;
  const next=(ans+1<blocks.length)?(parseInt(blocks[ans+1].dataset.off)||totalChars):totalChars;
  return Math.min(totalChars,Math.floor(off+frac*(next-off)));
}
// 滚动到某字符偏移：两段式精确定位。
// 旧版只二分到 4000 字/块的“块顶”，块里有十几段，笔记落在块中下部时会差好几屏——这就是“笔记定位跳转不准”的根。
// 现在：① 先粗定位把所在块滚进视口（content-visibility 块被强制渲染，内部段落才有布局）；
//       ② 下一帧在块内找到精确的段落 .rp（每段都有自己的 data-off），再用 Range 落到 pos 那一行的像素位置。
// flashPos=true 时在落点做一次淡入淡出，跳转后一眼看到停在哪。
function scrollToOffset(pos, flashPos){
  const sv=document.getElementById('scroll-view');
  const sc=document.getElementById('scroll-content');
  if(!sv||!sc)return;
  const blocks=sc.children;
  if(!blocks.length||blocks[0].dataset.off===undefined)return;
  const headroom=Math.min(90,(sv.clientHeight||600)*0.2);   // 落点稍下移，不顶最上沿
  const clamp=(v)=>Math.max(0,Math.min(v, Math.max(0,sv.scrollHeight-sv.clientHeight)));

  // 找到 pos 对应的段落元素（.rp 各有精确 data-off；DOM 里即使块没渲染，节点也在）
  function findTarget(){
    let lo=0,hi=blocks.length-1,bi=0;
    while(lo<=hi){const mid=(lo+hi)>>1;const o=parseInt(blocks[mid].dataset.off)||0;if(o<=pos){bi=mid;lo=mid+1;}else hi=mid-1;}
    const block=blocks[bi];
    let target=block;
    const paras=block.querySelectorAll('.rp[data-off]');
    for(let i=0;i<paras.length;i++){const off=parseInt(paras[i].dataset.off,10)||0;if(off<=pos)target=paras[i];else break;}
    return target;
  }
  // 目标里 pos 所在【字符行】当前的视口相对顶部（段内字符级精度）
  function charViewTop(target){
    try{
      const paraOff=parseInt(target.dataset.off,10)||0, into=Math.max(0,pos-paraOff);
      const walk=document.createTreeWalker(target,NodeFilter.SHOW_TEXT,null);
      let node,acc=0,rng=document.createRange(),placed=false;
      while((node=walk.nextNode())){const len=node.nodeValue.length;if(acc+len>=into){const k=Math.max(0,Math.min(len,into-acc));rng.setStart(node,k);rng.setEnd(node,k);placed=true;break;}acc+=len;}
      if(!placed){rng.selectNodeContents(target);rng.collapse(false);}
      const r=rng.getBoundingClientRect();
      if(r&&(r.top||r.bottom))return r.top;
    }catch(e){}
    return target.getBoundingClientRect().top;
  }

  const target=findTarget();
  // ① 交给浏览器原生 scrollIntoView 把目标滚进视口：它会正确处理 content-visibility 的占位高度、
  //    强制目标块渲染、并配合浏览器的滚动锚定——比手算 scrollTop 可靠得多（手算在占位高度下会落偏）。
  try{ target.scrollIntoView({block:'start'}); }catch(e){ try{target.scrollIntoView();}catch(_){} }
  // ② 目标块已渲染、位置已稳定，做至多两次【小幅】微调：落到 headroom + 段内精确字符行。
  //    因为只在已渲染区域内小范围移动，目标始终在视口内 → 稳定收敛，不会像大跨度那样来回过冲。
  requestAnimationFrame(()=>{
    const d1=(charViewTop(target)-sv.getBoundingClientRect().top)-headroom;
    if(Math.abs(d1)>2) sv.scrollTop=clamp(sv.scrollTop+d1);
    requestAnimationFrame(()=>{
      const d2=(charViewTop(target)-sv.getBoundingClientRect().top)-headroom;   // 再稳一帧（锚定/字号导致的微偏）
      if(Math.abs(d2)>3) sv.scrollTop=clamp(sv.scrollTop+d2);
      if(flashPos)_flashEl(target);
    });
  });
}
// 跳转落点的淡入淡出：给元素挂个临时类，1.2s 后自动撤掉
function _flashEl(el){
  if(!el||!el.classList)return;
  try{
    // 优先闪“块/段里那条划线”，没有就闪整段
    const hl=el.querySelector?el.querySelector('.hl'):null;
    const t=hl||el;
    t.classList.add('jump-flash');
    setTimeout(()=>{try{t.classList.remove('jump-flash');}catch(_){}} ,1200);
  }catch(_){}
}
function restorePos(){
  setTimeout(()=>{try{scrollToOffset(curPos);}catch(e){}},60);   // 翻页/滚动都是滚动容器
}

// ============ UI 显隐 ============
let _tapDown=null,_selDuringTap=false;
function readerPointerDown(e){
  if(typeof e.button==='number' && e.button!==0){_tapDown=null;return;} // 只认主键/触摸
  _tapDown={x:e.clientX,y:e.clientY,t:Date.now(),moved:false};
  _selDuringTap=false;
}
// 是否触摸设备（手机/平板）：iOS Safari 自带长按选字 + 选字时的原生滚动，自定义续滚会和它打架（双重滚动、选不上、点不开菜单），所以触摸设备一律不插手
const IS_TOUCH = (navigator.maxTouchPoints>0) || ('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
function readerPointerMove(e){
  if(_tapDown && (Math.abs(e.clientX-_tapDown.x)>8||Math.abs(e.clientY-_tapDown.y)>8))_tapDown.moved=true;
  if(IS_TOUCH){ stopSelAutoScroll(); return; }   // 触摸设备：交给系统原生选字 + 原生滚动，别用自定义续滚
  // 桌面鼠标：划线时拖到屏幕上/下边缘 → 自动滚动，让选择一直往下续 → 翻页模式也能跨页连续划线（两种模式现在都是滚动容器）
  if(mode==='scroll'||mode==='page'){
    const sel=window.getSelection();
    if(sel && !sel.isCollapsed && sel.toString()){
      const vh=window.innerHeight, edge=90, y=e.clientY;
      if(y>vh-edge) _autoScrollDy=Math.min(26,(y-(vh-edge))/edge*26+6);
      else if(y<edge+44) _autoScrollDy=-Math.min(26,((edge+44)-y)/edge*26+6);
      else _autoScrollDy=0;
      if(_autoScrollDy!==0)startSelAutoScroll(); else stopSelAutoScroll();
    }else stopSelAutoScroll();
  }
}
let _autoScrollDy=0,_autoScrollTimer=null;
function startSelAutoScroll(){
  if(_autoScrollTimer)return;
  const sv=document.getElementById('scroll-view');
  if(sv)sv.classList.add('selecting');   // 划线拖动时关掉整页吸附，正文才能跨页自由续滚
  _autoScrollTimer=setInterval(()=>{ if(sv&&_autoScrollDy)sv.scrollTop+=_autoScrollDy; },16);
}
function stopSelAutoScroll(){ if(_autoScrollTimer){clearInterval(_autoScrollTimer);_autoScrollTimer=null;} _autoScrollDy=0; const sv=document.getElementById('scroll-view'); if(sv)sv.classList.remove('selecting'); }
function readerPointerUp(e){
  stopSelAutoScroll();
  const d=_tapDown; _tapDown=null;
  if(!d)return;
  // 任何"不是干净轻点"的情况都不翻页：移动过 / 长按(>450ms) / 这次触摸里选过字 / 当前有选区
  if(d.moved)return;
  if(Math.abs((e.clientX||d.x)-d.x)>8 || Math.abs((e.clientY||d.y)-d.y)>8)return;
  if(Date.now()-d.t>450)return;
  if(_selDuringTap)return;   // 这次触摸里刚选了字 → 不翻页也不开菜单
  const sel=window.getSelection();
  if(sel && sel.toString().trim()){
    // 之前划线留下的选区：这一下是干净轻点 → 清掉选区，然后照常开菜单/翻页（否则残留选区会一直把点击挡掉，手机上就“点不开菜单栏”）
    try{sel.removeAllRanges();}catch(_){}
  }
  if(e.target.closest && e.target.closest('.topbar,.botbar,.panel,.ai-drawer,.list-drawer,.ambient-panel,.fab-menu,.home-chip,.sel-menu,.note-editor,.hl-menu,a,button,input,textarea,select'))return;
  // 点到正文里的划线 → 弹小菜单（改颜色/写笔记/删除），不翻页
  const hlEl=e.target.closest && e.target.closest('.hl');
  if(hlEl && hlEl.dataset.hlid){ showHlMenu(parseInt(hlEl.dataset.hlid), e.clientX, e.clientY); return; }
  const x=e.clientX, w=window.innerWidth||document.documentElement.clientWidth;
  if(mode==='page'){
    // 滚动式翻页：点左 1/3 = 上一屏，点右 1/3 = 下一屏（平滑滚动），中间 = 呼出工具栏
    if(x < w*0.34){pageScroll(-1);return;}
    if(x > w*0.66){pageScroll(1);return;}
    toggleUI();return;
  }
  toggleUI();
}
function toggleUI(){
  uiVisible=!uiVisible;
  document.getElementById('topbar').classList.toggle('show',uiVisible);
  document.getElementById('botbar').classList.toggle('show',uiVisible);
  document.body.classList.toggle('ui-on',uiVisible);
}
// 一行的像素高（按当前字号×行距），翻页留重叠用
function lineHeightPx(){
  const cs=getComputedStyle(document.documentElement);
  const fs=parseFloat(cs.getPropertyValue('--fontsize'))||19;
  const lh=parseFloat(cs.getPropertyValue('--lineheight'))||2;
  return Math.max(20,fs*lh);
}
let _flipping=false;
// 翻页：把滚动容器整屏换到上/下一页。手动滚动已被 CSS(overflow:hidden)禁掉，这里用脚本设 scrollTop
// （overflow:hidden 不挡脚本滚动）→ 一定换得动；配很短的交叉淡入淡出遮住跳变 → 读着是“翻了一页”而非“在滚”。
function pageScroll(dir){
  const sv=document.getElementById('scroll-view');
  if(!sv)return;
  console.log('[翻页] 点击 dir='+dir+' 当前mode='+mode+(mode==='page'?' → 走交叉淡入换页':' → 滚动模式(平滑滚一屏)'));
  if(mode==='page'){
    if(_flipping)return;   // 上一次翻页没放完就忽略连点，避免错位
    const sc=document.getElementById('scroll-content');
    const cs=getComputedStyle(sv);
    const padT=parseFloat(cs.paddingTop)||0, padB=parseFloat(cs.paddingBottom)||0;
    const visibleH=Math.max(120,(sv.clientHeight||window.innerHeight||600)-padT-padB);  // 真正能看到正文的高度
    const pageH=Math.max(100, visibleH-lineHeightPx());   // 翻一屏正文、留一行重叠 → 不丢行/不切行
    const maxS=Math.max(0,sv.scrollHeight-sv.clientHeight);
    const tgt=Math.max(0,Math.min(maxS,sv.scrollTop+dir*pageH));
    if(Math.abs(tgt-sv.scrollTop)<1)return;   // 已到首/尾，不翻
    _flipping=true;
    if(sc)sc.classList.add('pg-fading');      // 淡出
    try{playPageSound();}catch(_){}
    setTimeout(()=>{
      sv.scrollTop=tgt;                        // 真正换页（瞬间，但被淡出遮住）
      curPos=(typeof currentScrollOffset==='function')?currentScrollOffset():curPos;
      if(typeof repaintHighlights==='function'){try{repaintHighlights();}catch(_){}}
      if(sc)sc.classList.remove('pg-fading');  // 淡回
      setTimeout(()=>{_flipping=false;},150);  // 淡回放完再允许下一次
    },140);
    return;
  }
  // 滚动模式：平滑滚约一屏（留 12% 重叠），保持原样
  const h=sv.clientHeight||window.innerHeight||600;
  const step=Math.max(160, h-Math.round(h*0.12));
  try{sv.scrollBy({top:dir*step,behavior:'smooth'});}catch(e){sv.scrollTop+=dir*step;}
  if(dir!==0 && typeof playPageSound==='function'){try{playPageSound();}catch(_){}}
}
// 翻页时给正文一个很短的淡入，读着像"翻了一页"而不是生硬跳变

function closeAll(){
  document.querySelectorAll('.panel,.ai-drawer,.list-drawer,.ambient-panel').forEach(e=>e.classList.remove('show'));
  document.getElementById('overlay').classList.remove('show');
  if(typeof closeHlMenu==='function')closeHlMenu();   // 跳转/关面板时一并清掉划线菜单和拖动手柄
}

// ============ 模式切换 ============
function toggleMode(){
  try{
    if(typeof closeHlMenu==='function')closeHlMenu();   // 切模式前收掉划线菜单/拖动手柄，避免残留在错位置
    // 两种模式共用同一套连续正文(DOM 完全一样)，切换只换“能否手动滚 + 点击是否换页”这个行为：
    // 不重渲染、不跳位 → 瞬间顺滑，正文停在原处。
    mode=(mode==='page')?'scroll':'page';
    savePref('mode',mode);
    document.body.classList.toggle('paged-read', mode==='page');
    const lbl=document.getElementById('mode-label'); if(lbl)lbl.textContent=(mode==='page')?'翻页':'滚动';
    updateModeBtn();
  }catch(e){ /* 出错也别卡死 */ }
}
function updateModeBtn(){
  const lbl=document.getElementById('mode-label');
  const ic=document.getElementById('mode-icon');
  if(lbl)lbl.textContent=(mode==='page')?'翻页':'滚动';
  // 图标：翻页模式给“滚动”图标提示可切回，反之亦然
  if(ic){
    ic.innerHTML=(mode==='page')
      ? '<path d="M3 4H21V6H3V4ZM3 11H21V13H3V11ZM3 18H21V20H3V18Z"></path>'      // 切到滚动
      : '<path d="M19 22H5C3.34315 22 2 20.6569 2 19V3C2 2.44772 2.44772 2 3 2H17C17.5523 2 18 2.44772 18 3V15H22V19C22 20.6569 20.6569 22 19 22Z"></path>'; // 切到翻页
  }
}

// ============ 外观设置 ============
function openPanel(name){closeAll();document.getElementById('panel-'+name).classList.add('show');document.getElementById('overlay').classList.add('show');}
function closePanel(){closeAll();}
function buildSkinUI(){
  const row=document.getElementById('skin-row');
  row.innerHTML=SKINS.map(s=>`<div class="skin" data-skin="${s.id}" style="background:${s.paper};border:2px solid ${PREFS.skin===s.id?s.accent:'transparent'}" onclick="applySkin('${s.id}',true)" title="${s.name}"></div>`).join('');
}
function applySkin(id,save){
  const s=SKINS.find(x=>x.id===id)||SKINS[0];
  const r=document.documentElement.style;
  r.setProperty('--paper',s.paper);r.setProperty('--ink',s.ink);r.setProperty('--ink2',s.ink2);
  r.setProperty('--accent',s.accent);r.setProperty('--ui-bg',s.ui);r.setProperty('--ui-border',s.border);r.setProperty('--ui-text',s.ink);
  document.querySelectorAll('.skin').forEach(e=>e.style.border='2px solid '+(e.dataset.skin===id?s.accent:'transparent'));
  if(save)savePref('skin',id);
}
// 字号/行距/字体改变后：滚动容器会自动重排，无需重新分页；防抖到停手后回到当前阅读位置即可。
let _repagTimer=null;

function repaginate(){
  // 翻页已是滚动容器：改字号/行距/字体会自动重排，无需分页；重排后回到当前阅读位置即可。
  clearTimeout(_repagTimer);
  _repagTimer=setTimeout(()=>{
    try{ const p=curPos; scrollToOffset(p); }catch(e){}
  },160);
}
function setFontSize(v,silent){document.documentElement.style.setProperty('--fontsize',v+'px');document.getElementById('fontsize-val').textContent=v+'px';document.getElementById('fontsize-slider').value=v;if(!silent){savePref('fontsize',v);repaginate();}}
function setLineHeight(v,btn){document.documentElement.style.setProperty('--lineheight',v);savePref('lineheight',v);document.querySelectorAll('#panel-skin .opt-row .opt').forEach(()=>{});btn.parentNode.querySelectorAll('.opt').forEach(e=>e.classList.remove('sel'));btn.classList.add('sel');repaginate();}
function setFont(f,btn){document.documentElement.style.setProperty('--font',FONTS[f]);savePref('font',f);document.querySelectorAll('#font-row .opt').forEach(e=>e.classList.remove('sel'));btn.classList.add('sel');repaginate();}
function setTexture(t,btn){document.documentElement.style.setProperty('--texture',TEXTURES[t]);savePref('texture',t);document.querySelectorAll('#texture-row .opt').forEach(e=>e.classList.remove('sel'));btn.classList.add('sel');}
function setTextureOp(v){const op=Math.max(0,Math.min(100,parseInt(v)||0));document.documentElement.style.setProperty('--texture-op',op/100);savePref('textureOp',op);}

// ============ 进度 & 日记 ============
function saveProgress(){
  const pct=curPos/Math.max(totalChars,1);   // 翻页/滚动都按字符偏移算
  updateReadProgress(pct);
  fetch('/api/book/'+bookId+'/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({position:curPos,percentage:Math.round(pct*100)})});
}
// 始终可见的阅读进度（顶部细条 + 右上角百分比），翻页/滚动两种模式都更新
function updateReadProgress(pct){
  pct=Math.max(0,Math.min(1,pct||0));
  const bar=document.getElementById('read-progress-fill');if(bar)bar.style.width=(pct*100).toFixed(1)+'%';
  const pill=document.getElementById('read-pct');
  if(pill){
    pill.textContent=Math.round(pct*100)+'%';
  }
}
// 直接拖进度条跳读：点一下或按住拖动到某个百分比松手即可跳过去
function seekToPct(pct){
  pct=Math.max(0,Math.min(1,pct));
  const off=Math.floor(pct*Math.max(totalChars,1));
  curPos=off;
  scrollToOffset(off);   // 翻页/滚动都用滚动定位
  updateReadProgress(pct);saveProgress();recordDiary();
}
function bindProgressSeek(){
  const bar=document.getElementById('read-progress');
  if(!bar||bar._seekBound)return; bar._seekBound=true;
  let dragging=false;
  const pctFromX=x=>{const r=bar.getBoundingClientRect();return Math.max(0,Math.min(1,(x-r.left)/Math.max(r.width,1)));};
  const preview=p=>{const f=document.getElementById('read-progress-fill');if(f)f.style.width=(p*100).toFixed(1)+'%';const pill=document.getElementById('read-pct');if(pill)pill.textContent=Math.round(p*100)+'%';};
  bar.addEventListener('pointerdown',e=>{dragging=true;bar.classList.add('seeking');try{bar.setPointerCapture(e.pointerId);}catch(_){}preview(pctFromX(e.clientX));e.preventDefault();});
  bar.addEventListener('pointermove',e=>{if(dragging)preview(pctFromX(e.clientX));});
  const end=e=>{if(!dragging)return;dragging=false;bar.classList.remove('seeking');seekToPct(pctFromX(e.clientX));};
  bar.addEventListener('pointerup',end);
  bar.addEventListener('pointercancel',()=>{dragging=false;bar.classList.remove('seeking');});
}
let lastDiaryRecord=0;
function recordDiary(){
  const now=Date.now();
  if(now-lastDiaryRecord<30000)return; // 每30秒最多记一次
  lastDiaryRecord=now;
  const minutes=Math.round((now-readStartTime)/60000);
  const curPct=curPos/Math.max(totalChars,1);
  fetch('/api/diary/record',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({book_id:bookId,chars_read:Math.abs(curPos-Math.floor(readStartPct*totalChars)),minutes_read:Math.max(minutes,1),start_pct:Math.round(readStartPct*100),end_pct:Math.round(curPct*100)})});
  readStartTime=now;readStartPct=curPct;
}

// ============ 书签 ============
async function addBookmark(){
  const pct=Math.round(curPos/Math.max(totalChars,1)*100);
  const label=bookText.slice(curPos,curPos+20).replace(/\n/g,'')||'位置 '+pct+'%';
  const r=await (await fetch('/api/bookmarks',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,position:curPos,percentage:pct,label})})).json();
  bookmarks.push({id:r.id,position:curPos,percentage:pct,label});
  toast('已添加书签');
  // 若“书签/划线/笔记”列表正开着，立刻刷新，新书签马上出现（否则会以为“加了找不到”）
  if(curListTab==='marks'){const b=document.getElementById('list-body');if(b)renderMarks(b);}
}

// ============ 高亮/划线 ============
// 划线全部用"在全书里的字符偏移"定位（h.start/h.end），不再靠文本 .replace：
//   · 跳转精准（同一句话出现多次也不会跳错）
//   · 跨段/长段也能划（按偏移在每个块里各画自己那段）
//   · 加划线后只就地重绘受影响的块，不再整篇重渲染→不再"跳到很后面"、不卡手
const HL_COLORS=[['sand','#c9b287'],['sage','#9ab094'],['mist','#94a8b8'],['rose','#c49e9e'],['lilac','#aaa0ba'],['clay','#c49480']];
let selText='',selCharRange=null,lastHlColor='sand';
// 计算当前选区在全书正文里的字符区间 {text,start,end}
function selectionCharRange(){
  const s=window.getSelection();
  if(!s||s.rangeCount===0)return null;
  const txt=s.toString();
  if(!txt||!txt.trim())return null;
  const range=s.getRangeAt(0);
  // 把 DOM 里的某个位置换算成“在全书原文里的字符偏移”。
  // 关键：以所在【段落 .rp】(其 data-off 即该段在原文的起点) 为基准来数——
  // 段落内部没有被跳过的空行，数出来的长度与原文一致；若按整块(.rblock)数，
  // 会把块内被跳过的空行漏掉 → 偏移整体偏小、划线/跳转差几行。
  const offsetOf=(node,nodeOffset)=>{
    let el=(node&&node.nodeType!==1)?node.parentElement:node;
    const para=(el&&el.closest)?el.closest('.rp'):null;
    const anchor=(para&&para.dataset&&para.dataset.off!=null)?para
                :((el&&el.closest)?el.closest('.rblock,.page-sec,.flip-page-content,.page-sheet'):null);
    if(!anchor||!anchor.dataset||anchor.dataset.off==null)return null;
    const base=parseInt(anchor.dataset.off,10)||0;
    let n=0;
    try{const pre=document.createRange();pre.selectNodeContents(anchor);pre.setEnd(node,nodeOffset);n=pre.toString().length;}catch(e){}
    return base+n;
  };
  const start=offsetOf(range.startContainer,range.startOffset);
  const end=offsetOf(range.endContainer,range.endOffset);
  if(start!=null&&end!=null&&end>start){
    return {text:txt, start:start, end:end};
  }
  // 兜底：没找到带 data-off 的段落/块时，别再用 curPos 乱猜——直接在正文里就近找这段选中文字。
  const probe=txt.trim();
  if(probe&&bookText){
    let idx=bookText.indexOf(probe,Math.max(0,(curPos|0)-3000));
    if(idx<0)idx=bookText.indexOf(probe);
    if(idx>=0)return {text:txt, start:idx, end:idx+probe.length};
  }
  return null;
}
function onSelection(){const r=selectionCharRange();if(r){selText=r.text.trim();selCharRange=r;}}
function showSelMenu(e){
  setTimeout(()=>{
    const s=window.getSelection();
    const menu=document.getElementById('sel-menu');
    if(!s||!s.toString().trim()){menu.classList.remove('show');return;}
    selCharRange=selectionCharRange();
    selText=s.toString().trim();
    menu.innerHTML=HL_COLORS.map(([c,hex])=>`<span class="color-dot" style="background:${hex}" onclick="addHighlight('${c}')"></span>`).join('')
      +'<button onclick="addHlNote()">笔记</button><button onclick="copyText()">复制</button>';
    if(IS_TOUCH){
      // 手机/平板：停靠屏幕底部正中（大按钮），避开系统紧贴选区的“拷贝/查询”原生菜单——浮在选区旁会被它盖住、点不到
      menu.classList.add('docked');
      menu.style.left='';menu.style.top='';menu.style.maxWidth='';
      menu.classList.add('show');
      return;
    }
    // 桌面：浮在选区旁边。默认放选区上方，离顶太近就放下方
    menu.classList.remove('docked');
    try{
      const rect=s.getRangeAt(0).getBoundingClientRect();
      const mw=Math.min(264,(window.innerWidth||360)-16);
      menu.style.maxWidth=mw+'px';
      let left=rect.left+rect.width/2-mw/2;
      left=Math.max(8,Math.min(left,(window.innerWidth||360)-mw-8));
      let top=rect.top-54;
      if(top<70)top=rect.bottom+12;
      menu.style.left=left+'px'; menu.style.top=top+'px';
      menu.classList.add('show');
    }catch(err){menu.classList.add('show');}
  },10);
}
async function addHighlight(color){
  const r=selCharRange||selectionCharRange();
  if(!r||!r.text){document.getElementById('sel-menu').classList.remove('show');toast('没接住选中的文字，请重新划一下');return;}
  lastHlColor=color;
  const res=await (await fetch('/api/highlights',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,position:r.start,text:r.text,color})})).json();
  highlights.push({id:res.id,position:r.start,start:r.start,end:r.end,text:r.text,color,note:''});
  document.getElementById('sel-menu').classList.remove('show');
  try{window.getSelection().removeAllRanges();}catch(e){}
  repaintHighlights();              // 就地重绘，不跳位、不卡
  toast('已划线');
}
async function addHlNote(){
  const r=selCharRange||selectionCharRange();
  if(!r||!r.text){document.getElementById('sel-menu').classList.remove('show');toast('没接住选中的文字，请重新划一下');return;}
  const color=lastHlColor||'sand';
  const res=await (await fetch('/api/highlights',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,position:r.start,text:r.text,color})})).json();
  highlights.push({id:res.id,position:r.start,start:r.start,end:r.end,text:r.text,color,note:''});
  document.getElementById('sel-menu').classList.remove('show');
  try{window.getSelection().removeAllRanges();}catch(e){}
  repaintHighlights();
  // 直接进编辑：打开列表抽屉、那条划线下面弹出会随输入变高的笔记框
  editingHlId=res.id;
  toggleDrawer('list');curListTab='marks';switchListTab('marks');
  setTimeout(()=>{const ta=document.getElementById('hl-note-'+res.id);if(ta){ta.focus();autoGrow(ta);}},60);
}
// 每条划线的列表项：默认只有「编辑/删除」+ 点正文跳转；点编辑才展开笔记框和改色
let editingHlId=null;
function hlItemHtml(h){
  const pos=(h.start!=null?h.start:h.position)||0;
  if(editingHlId===h.id){
    const colors=HL_COLORS.map(([c,hex])=>`<span class="li-cdot${h.color===c?' on':''}" style="background:${hex}" onclick="setHlColor(${h.id},'${c}')"></span>`).join('');
    return `<div class="list-item hl-item editing">
      <div class="li-title hl-${h.color}" onclick="jumpTo(${pos})">${escapeHtml(h.text)}</div>
      <textarea class="hl-note-input" id="hl-note-${h.id}" placeholder="写点笔记…（清空＝删掉笔记）" oninput="autoGrow(this)" onblur="saveHlNote(${h.id},this.value)">${escapeHtml(h.note||'')}</textarea>
      <div class="hl-edit-row"><div class="li-colors">${colors}</div><span class="hl-act done" onclick="saveHlNote(${h.id},document.getElementById('hl-note-${h.id}').value).then(finishEditHl)">完成</span></div>
    </div>`;
  }
  return `<div class="list-item hl-item">
    <div class="hl-actions"><span class="hl-act" onclick="event.stopPropagation();editHlNote(${h.id})">编辑</span><span class="li-del" onclick="event.stopPropagation();delHighlight(${h.id})">删除</span></div>
    <div class="li-title hl-${h.color}" onclick="jumpTo(${pos})">${escapeHtml(h.text)}</div>
    ${h.note?'<div class="li-note">'+escapeHtml(h.note)+'</div>':''}
  </div>`;
}
function autoGrow(ta){if(!ta)return;ta.style.height='auto';ta.style.height=Math.min(ta.scrollHeight,320)+'px';}
function editHlNote(id){
  editingHlId=id; switchListTab('marks');
  setTimeout(()=>{const ta=document.getElementById('hl-note-'+id);if(ta){ta.focus();autoGrow(ta);ta.setSelectionRange(ta.value.length,ta.value.length);}},30);
}
function finishEditHl(){editingHlId=null;if(curListTab==='marks')renderMarks(document.getElementById('list-body'));}
async function saveHlNote(id,note){
  const h=highlights.find(x=>x.id===id);if(!h)return;
  note=(note||'').trim();
  if(note===(h.note||''))return;
  await fetch('/api/highlights/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({note})});
  h.note=note;
}
// 直接换颜色（编辑中改色不会丢已输入的笔记）
async function setHlColor(id,color){
  const h=highlights.find(x=>x.id===id);if(!h)return;
  if(editingHlId===id){const ta=document.getElementById('hl-note-'+id);if(ta)h.note=ta.value;}
  h.color=color; lastHlColor=color;
  await fetch('/api/highlights/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({color})});
  repaintHighlights();
  if(curListTab==='marks')renderMarks(document.getElementById('list-body'));
}
function copyText(){navigator.clipboard&&navigator.clipboard.writeText(selText);document.getElementById('sel-menu').classList.remove('show');toast('已复制');}

// ============ 学习：知识点梳理（选一段 → AI 抓要点，每个点能跳回原文，可存为笔记）============
let _studyPoints=[], _studyTitle='知识点梳理';
// 学习功能归 Quill 面板内部：读取范围由 agent 自己控制（当前章节 / 当前位置附近），不再挂在划线菜单上。
let studyScope='chapter';
function setStudyScope(v){studyScope=v;}
function studyRangeText(){return studyScope==='chapter'?'当前章节':'当前位置附近';}
function studyRange(){
  const toc=(typeof buildToc==='function')?buildToc(bookText):[];
  if(studyScope==='chapter' && toc.length){
    let ci=0; for(let i=0;i<toc.length;i++){if(toc[i].pos<=curPos)ci=i;else break;}
    return {start:toc[ci].pos, end:(ci+1<toc.length)?toc[ci+1].pos:bookText.length};
  }
  return {start:Math.max(0,curPos-1500), end:Math.min((bookText||'').length,curPos+2500)};   // 当前位置附近 / 无章节兜底
}
async function studyOutline(start,end,mode){
  if(start==null){const r=studyRange();start=r.start;end=r.end;}
  if(!(end>start)){toast('读取范围为空');return;}
  mode=mode||'points';
  openStudyModal(true);   // 先显加载态
  document.getElementById('sm-body').innerHTML='<div class="sm-loading">'+(mode==='structure'?'正在分析知识架构…':'正在梳理知识点…')+'</div>';
  try{
    const data=await (await fetch('/api/study/outline',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,start,end,mode})})).json();
    if(data.error==='no_api_key'){renderStudyError('AI 还没配置——去设置页填一下 API key 就能用了');return;}
    if(data.error){renderStudyError(data.error);return;}
    _studyPoints=data.points||[]; _studyTitle=(mode==='structure'?'知识架构':'知识点梳理');
    renderStudyPoints();
  }catch(e){renderStudyError('生成失败，稍后再试');}
}
function openStudyModal(loading){
  let m=document.getElementById('study-modal');
  if(!m){
    m=document.createElement('div');m.className='study-modal';m.id='study-modal';
    m.innerHTML='<div class="sm-panel"><div class="sm-head"><span>知识点梳理</span><button onclick="closeStudyModal()">×</button></div><div class="sm-body" id="sm-body"></div><div class="sm-foot" id="sm-foot"></div></div>';
    m.addEventListener('click',ev=>{if(ev.target===m)closeStudyModal();});
    document.body.appendChild(m);
  }
  m.classList.add('show');
  if(loading){document.getElementById('sm-body').innerHTML='<div class="sm-loading">正在梳理这段的知识点…</div>';document.getElementById('sm-foot').innerHTML='';}
}
function closeStudyModal(){const m=document.getElementById('study-modal');if(m)m.classList.remove('show');}
function renderStudyError(msg){
  openStudyModal(false);
  document.getElementById('sm-body').innerHTML='<div class="sm-loading">'+escapeHtml(msg)+'</div>';
  document.getElementById('sm-foot').innerHTML='';
}
function renderStudyPoints(){
  openStudyModal(false);
  const head=document.querySelector('#study-modal .sm-head span'); if(head)head.textContent=(typeof _studyTitle==='string'&&_studyTitle)?_studyTitle:'知识点梳理';
  const body=document.getElementById('sm-body');
  if(!_studyPoints.length){body.innerHTML='<div class="sm-loading">这段没提炼出明显的知识点，换一段试试</div>';document.getElementById('sm-foot').innerHTML='';return;}
  body.innerHTML=_studyPoints.map((p,i)=>`
    <div class="sm-card">
      <div class="sm-title">${escapeHtml(p.title||'要点')}</div>
      <div class="sm-detail">${escapeHtml(p.detail||'')}</div>
      ${p.quote?`<div class="sm-quote">「${escapeHtml(p.quote)}」</div>`:''}
      <div class="sm-acts"><span class="sm-jump" onclick="studyJump(${i})">跳转原文</span><span class="sm-save" onclick="studySaveOne(${i},this)">存为笔记</span></div>
    </div>`).join('');
  document.getElementById('sm-foot').innerHTML='<button class="sm-saveall" onclick="studySaveAll(this)">全部存为笔记</button>';
}
function studyJump(i){const p=_studyPoints[i];if(!p)return;closeStudyModal();jumpTo(p.position||0);}
async function studySaveOne(i,el){
  const p=_studyPoints[i];if(!p)return;
  const title=(p.title||'知识点');
  const content=(p.detail||'')+(p.quote?('\n原文：'+p.quote):'');
  try{
    await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,position:p.position||0,title,content,source:'study'})});
    if(el){el.textContent='已存';el.classList.add('done');}
  }catch(e){toast('保存失败');}
}
async function studySaveAll(btn){
  if(btn)btn.disabled=true;
  for(let i=0;i<_studyPoints.length;i++){await studySaveOne(i,null);}
  toast('已全部存为笔记');
  if(btn){btn.textContent='已全部保存';}
}

// ============ 学习：自我检测（选一段 → AI 出单选题 → 判分 → 错题进错题本）============
let _quiz=[], _quizAnswers={};
async function studyQuiz(start,end){
  if(start==null){const r=studyRange();start=r.start;end=r.end;}
  if(!(end>start)){toast('读取范围为空');return;}
  openStudyModal(true);
  document.getElementById('sm-body').innerHTML='<div class="sm-loading">正在生成检测题…</div>';
  try{
    const data=await (await fetch('/api/study/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,start,end,n:4})})).json();
    if(data.error==='no_api_key'){renderStudyError('AI 还没配置——去设置页填一下 API key 就能生成检测题了');return;}
    if(data.error){renderStudyError(data.error);return;}
    _quiz=data.questions||[]; _quizAnswers={};
    if(!_quiz.length){renderStudyError('这段生成不了题，换一段试试');return;}
    renderQuiz();
  }catch(e){renderStudyError('生成失败，稍后再试');}
}
function renderQuiz(){
  openStudyModal(false);
  const head=document.querySelector('#study-modal .sm-head span'); if(head)head.textContent='自我检测';
  const body=document.getElementById('sm-body');
  body.innerHTML=_quiz.map((q,qi)=>`
    <div class="sm-card quiz-card" data-qi="${qi}">
      <div class="sm-title">${qi+1}. ${escapeHtml(q.question||'')}</div>
      <div class="quiz-opts">${(q.options||[]).map((o,oi)=>`<label class="quiz-opt"><input type="radio" name="q${qi}" value="${oi}" onchange="_quizAnswers[${qi}]=${oi}"><span>${escapeHtml(o)}</span></label>`).join('')}</div>
      <div class="quiz-feedback" id="qfb-${qi}"></div>
    </div>`).join('');
  document.getElementById('sm-foot').innerHTML='<button class="sm-saveall" onclick="submitQuiz(this)">提交答案</button>';
}
async function submitQuiz(btn){
  let right=0; const wrong=[];
  _quiz.forEach((q,qi)=>{
    const chosen=_quizAnswers[qi];
    const correct=(chosen!=null && chosen===q.answer);
    if(correct)right++; else wrong.push(qi);
    const card=document.querySelector('.quiz-card[data-qi="'+qi+'"]');
    if(card)card.querySelectorAll('.quiz-opt').forEach((lab,oi)=>{
      if(oi===q.answer)lab.classList.add('right');
      else if(oi===chosen)lab.classList.add('wrong');
      const inp=lab.querySelector('input'); if(inp)inp.disabled=true;
    });
    const fb=document.getElementById('qfb-'+qi);
    if(fb)fb.innerHTML=(correct?'<b class="qf-ok">答对了</b>':'<b class="qf-no">答错了</b>')+(q.explanation?' · '+escapeHtml(q.explanation):'')+` <span class="sm-jump" onclick="studyJumpQuiz(${qi})">跳到原文</span>`;
  });
  for(const qi of wrong){await saveWrong(_quiz[qi]);}
  document.getElementById('sm-foot').innerHTML=`<div class="quiz-score">得分 ${right} / ${_quiz.length}${wrong.length?'　·　'+wrong.length+' 道错题已存入错题本':'　·　全对！'}</div>`;
  if(btn)btn.disabled=true;
}
function studyJumpQuiz(qi){const q=_quiz[qi];if(!q)return;closeStudyModal();jumpTo(q.position||0);}
async function saveWrong(q){
  const opts=(q.options||[]).map((o,i)=>`${i===q.answer?'✓ ':'　'}${o}`).join('\n');
  const content='选项：\n'+opts+(q.explanation?('\n解析：'+q.explanation):'');
  try{await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,position:q.position||0,title:q.question||'错题',content,source:'quiz_wrong'})});}catch(e){}
}

// ============ 学习模式：选 Quill 读取范围（进度/章节/书签）→ 梳理/架构/出题 ============
let STUDY_CTX_CAP=16000;   // 单次可读上限，进入学习模式时按当前模型从后端取（不同 API 上下文不同，自动调整）
let _studyModeTab='progress', _studyToc=[];
async function _refreshStudyCap(){
  try{const d=await (await fetch('/api/study/limit')).json();if(d&&d.cap>0)STUDY_CTX_CAP=d.cap;}catch(e){}
}
function openStudyMode(){
  const m=document.getElementById('study-mode');if(!m)return;
  _refreshStudyCap().then(()=>studyModeRangeChanged());   // 拉取当前模型的可读上限，再刷新提示
  _studyToc=(typeof buildToc==='function'&&typeof bookText==='string')?buildToc(bookText):[];
  // 章节下拉
  const cs=document.getElementById('sm2-ch-start'), ce=document.getElementById('sm2-ch-end'), chint=document.getElementById('sm2-ch-hint');
  if(_studyToc.length>=2){
    const opts=_studyToc.map((c,i)=>`<option value="${i}">${escapeHtml((c.title||('第'+(i+1)+'节')).slice(0,24))}</option>`).join('');
    cs.innerHTML=opts; ce.innerHTML=opts;
    let ci=0;for(let i=0;i<_studyToc.length;i++){if(_studyToc[i].pos<=curPos)ci=i;else break;}
    cs.value=ci; ce.value=ci; if(chint)chint.textContent='';
  }else{
    cs.innerHTML='';ce.innerHTML=''; if(chint)chint.textContent='这本书分不出章节，请用「按进度」或「按书签」选范围。';
  }
  // 书签下拉
  const ms=document.getElementById('sm2-mk-start'), me=document.getElementById('sm2-mk-end'), mhint=document.getElementById('sm2-mk-hint');
  const bks=(bookmarks||[]).slice().sort((a,b)=>a.position-b.position);
  if(bks.length>=2){
    const opts=bks.map(b=>`<option value="${b.position}">${escapeHtml((b.label||('位置'+Math.round(b.position/Math.max(1,totalChars)*100)+'%')).slice(0,24))}</option>`).join('');
    ms.innerHTML=opts; me.innerHTML=opts; me.selectedIndex=bks.length-1; if(mhint)mhint.textContent='';
  }else{
    ms.innerHTML='';me.innerHTML=''; if(mhint)mhint.textContent='至少要有 2 个书签才能按书签选范围（在正文里点书签添加）。';
  }
  // 进度滑块默认取当前位置附近
  const st=document.getElementById('sm2-start'), en=document.getElementById('sm2-end');
  const cur=totalChars?Math.round(curPos/totalChars*1000):0;
  if(st)st.value=Math.max(0,cur-40); if(en)en.value=Math.min(1000,cur+120);
  m.classList.add('show');
  studyModeRangeChanged();
}
function closeStudyMode(){const m=document.getElementById('study-mode');if(m)m.classList.remove('show');}
function studyModeTab(t){
  _studyModeTab=t;
  document.querySelectorAll('#study-mode .sm2-tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t));
  ['progress','chapter','mark'].forEach(p=>{const el=document.getElementById('sm2-'+p);if(el)el.style.display=(p===t)?'':'none';});
  studyModeRangeChanged();
}
function studyModeRange(){
  const N=(bookText||'').length;
  if(_studyModeTab==='chapter' && _studyToc.length>=2){
    let a=parseInt(document.getElementById('sm2-ch-start').value)||0, b=parseInt(document.getElementById('sm2-ch-end').value)||0;
    if(a>b){const t=a;a=b;b=t;}
    const start=_studyToc[a].pos, end=(b+1<_studyToc.length)?_studyToc[b+1].pos:N;
    return {start,end};
  }
  if(_studyModeTab==='mark'){
    let a=parseInt(document.getElementById('sm2-mk-start').value), b=parseInt(document.getElementById('sm2-mk-end').value);
    if(isNaN(a)||isNaN(b))return {start:0,end:0};
    if(a>b){const t=a;a=b;b=t;} return {start:a,end:b};
  }
  // 进度
  let a=Math.round((parseInt(document.getElementById('sm2-start').value)||0)/1000*N);
  let b=Math.round((parseInt(document.getElementById('sm2-end').value)||0)/1000*N);
  if(a>b){const t=a;a=b;b=t;} return {start:a,end:b};
}
function studyModeRangeChanged(){
  const N=(bookText||'').length;
  // 进度预览 + 百分比
  if(_studyModeTab==='progress'){
    const sv=parseInt(document.getElementById('sm2-start').value)||0, ev=parseInt(document.getElementById('sm2-end').value)||0;
    const sp=Math.round(sv/10), ep=Math.round(ev/10);
    document.getElementById('sm2-start-pct').textContent=sp+'%';
    document.getElementById('sm2-end-pct').textContent=ep+'%';
    const at=(p)=>{const i=Math.round(p/1000*N);return escapeHtml((bookText||'').slice(i,i+42).replace(/\n/g,' ').trim())+'…';};
    document.getElementById('sm2-start-prev').textContent=at(sv);
    document.getElementById('sm2-end-prev').textContent=at(ev);
  }
  const r=studyModeRange();
  const len=Math.max(0,r.end-r.start);
  const cnt=document.getElementById('sm2-count');
  if(len<=0){cnt.innerHTML='<span class="sm2-warn">范围为空，请调整</span>';return;}
  if(len>STUDY_CTX_CAP){
    cnt.innerHTML=`已选约 ${len} 字 · <span class="sm2-warn">超过当前模型单次可读上限（约 ${STUDY_CTX_CAP} 字），只会读取前 ${STUDY_CTX_CAP} 字；想更完整可把范围选小、聚焦某个点</span>`;
  }else{
    cnt.innerHTML=`已选约 ${len} 字 · <span class="sm2-ok">在当前模型可读范围内</span>`;
  }
}
function studyModeRun(kind){
  const r=studyModeRange();
  if(!(r.end>r.start)){toast('范围为空，请先选范围');return;}
  closeStudyMode();
  if(kind==='quiz')studyQuiz(r.start,r.end);
  else studyOutline(r.start,r.end,kind);   // 'points' 或 'structure'
}



// 老划线（DB 里只有 position 没有 start/end 的）：按文本在正文里找回精确偏移
function recoverHlOffsets(){
  // 关键修复：不再只校正"没有 start 的老划线"。无论存的 start 对不对，
  // 一律以划线文字本身在正文里的实际位置为准重新定位 —— 这样历史版本里按错误偏移
  // 存下来的划线（哪怕带着错的 start）也会在开书时自动归位，不必删了重画。
  (highlights||[]).forEach(h=>{
    const t=(h.text||'').replace(/\r\n?/g,'\n');
    if(t){
      const guess=(h.start!=null?h.start:h.position)||0;
      const near=Math.max(0,guess-2000);
      let idx=bookText.indexOf(t,near);          // 先在原存位置附近找（避免重复短语跳到别处）
      if(idx<0)idx=bookText.indexOf(t);          // 附近没有再全文找
      if(idx>=0){h.start=idx;h.end=idx+t.length;h.text=t;return;}
    }
    if(h.start==null){h.start=h.position||0;h.end=h.start+t.length;}   // 实在找不到文字：退回原 position
  });
}
// 按字符偏移给一段文本加划线标记（blockStart=这段在全书里的起始偏移）
// 把一段文字按换行拆成"段落"，每段一个 <p class="rp">：段间留白 + 首行缩进（沿用源文本里的全角空格），
// 像 Moon+ 那种舒服的排版。字符偏移精确保留（换行符也计入偏移），划线照常工作。
// withHl=true 走 applyHighlights（带划线）；false 只转义（给分页测高的探针用，保证测高与真渲染一致）。
function splitParas(text){
  const out=[]; let start=0;
  for(let k=0;k<=text.length;k++){
    if(k===text.length||text[k]==='\n'){ out.push([start,text.slice(start,k)]); start=k+1; }
  }
  return out;
}
function renderParas(text,blockStart,withHl){
  blockStart=blockStart||0;
  let html='';
  for(const [off,p] of splitParas(text)){
    if(p===''||/^[\s\u3000]*$/.test(p))continue;   // 空段（连续换行）跳过 → 段间距统一
    const g=blockStart+off;
    html+=`<p class="rp" data-off="${g}">${withHl?applyHighlights(p,g):escapeHtml(p)}</p>`;
  }
  return html||'<p class="rp"></p>';
}
function applyHighlights(text,blockStart){
  blockStart=blockStart||0;
  if(!highlights||!highlights.length)return escapeHtml(text);
  const bEnd=blockStart+text.length, segs=[];
  highlights.forEach(h=>{
    if(h.start==null)return;
    const he=(h.end!=null)?h.end:h.start+((h.text&&h.text.length)||0);
    const s=Math.max(h.start,blockStart), e=Math.min(he,bEnd);
    if(e>s)segs.push({s:s-blockStart,e:e-blockStart,color:h.color||'sand',id:h.id});
  });
  if(!segs.length)return escapeHtml(text);
  segs.sort((a,b)=>a.s-b.s||b.e-a.e);
  let out='',pos=0;
  segs.forEach(seg=>{
    const ss=Math.max(seg.s,pos), ee=seg.e;
    if(ee<=ss)return;
    out+=escapeHtml(text.slice(pos,ss));
    out+=`<span class="hl hl-${seg.color}" data-hlid="${seg.id}">${escapeHtml(text.slice(ss,ee))}</span>`;
    pos=ee;
  });
  out+=escapeHtml(text.slice(pos));
  return out;
}
// 只重绘当前 DOM 里已有的块/页，不重排、不滚动、不重新分页 → 加划线后不再跳位
function repaintHighlights(){
  // 翻页/滚动都用同一条滚动容器，统一就地重绘受影响的块（不重排、不滚动 → 加划线后不跳位）
  const els=document.querySelectorAll('#scroll-content .rblock, #scroll-content .page-sec');
  els.forEach(el=>{
    const off=parseInt(el.dataset.off||'0',10)||0;
    const next=el.nextElementSibling;
    const end=next?(parseInt(next.dataset.off||'0',10)||bookText.length):bookText.length;
    el.innerHTML=renderParas(bookText.slice(off,end),off,true);
  });
}
// 只重绘与 [lo,hi) 字符区间相交的块（拖手柄调划线时用：长篇上千块，全量重绘会卡死，这里只动碰到的那几块）
function repaintHlRange(lo,hi){
  const els=document.querySelectorAll('#scroll-content .rblock, #scroll-content .page-sec');
  els.forEach(el=>{
    const off=parseInt(el.dataset.off||'0',10)||0;
    const next=el.nextElementSibling;
    const end=next?(parseInt(next.dataset.off||'0',10)||bookText.length):bookText.length;
    if(end<=lo||off>=hi)return;   // 不相交就跳过
    el.innerHTML=renderParas(bookText.slice(off,end),off,true);
  });
}

// ============ 列表抽屉 ============
let curListTab='toc';
// Quill 小窗：按住标题栏可拖着到处放（避开正文/进度条）
function bindAiDrag(){
  const dr=document.getElementById('ai-drawer'); if(!dr||dr._dragBound)return; dr._dragBound=true;
  const head=dr.querySelector('.ai-head'); if(!head)return;
  let sx=0,sy=0,ox=0,oy=0,drag=false;
  head.addEventListener('pointerdown',e=>{
    if(e.target.closest('.close,.ai-newchat'))return;   // 点按钮(关闭/历史/新对话)不算拖
    const r=dr.getBoundingClientRect();
    dr.style.left=r.left+'px'; dr.style.top=r.top+'px'; dr.style.right='auto'; dr.style.bottom='auto';
    sx=e.clientX; sy=e.clientY; ox=r.left; oy=r.top; drag=true;
    try{head.setPointerCapture(e.pointerId);}catch(_){}
    e.preventDefault();
  });
  head.addEventListener('pointermove',e=>{
    if(!drag)return;
    let nx=ox+(e.clientX-sx), ny=oy+(e.clientY-sy);
    nx=Math.max(6,Math.min(nx, window.innerWidth-dr.offsetWidth-6));
    ny=Math.max(6,Math.min(ny, window.innerHeight-dr.offsetHeight-6));
    dr.style.left=nx+'px'; dr.style.top=ny+'px';
  });
  const end=()=>{drag=false;};
  head.addEventListener('pointerup',end);
  head.addEventListener('pointercancel',end);
}
function toggleDrawer(which){
  closeAll();
  const d=document.getElementById(which==='ai'?'ai-drawer':'list-drawer');
  d.classList.add('show');
  document.getElementById('overlay').classList.add('show');
  if(which==='list')switchListTab(curListTab);
}
function switchListTab(tab){
  if(tab==='bookmark'||tab==='highlight')tab='marks';   // 书签/划线已合并
  curListTab=tab;
  document.querySelectorAll('.list-tab').forEach(e=>e.classList.toggle('sel',e.dataset.tab===tab));
  const body=document.getElementById('list-body');
  if(tab==='toc')renderToc(body);
  else if(tab==='marks')renderMarks(body);
  else if(tab==='note')renderNotes(body);
  else if(tab==='diary')renderDiary(body);
}
function renderMarks(body){
  // 书签 + 划线 + 笔记 合并成一个列表，按在书里的位置排序
  const items=[];
  (bookmarks||[]).forEach(b=>items.push({pos:b.position||0, html:
    `<div class="list-item" onclick="jumpTo(${b.position})"><span class="li-del" onclick="event.stopPropagation();delBookmark(${b.id})">删除</span><div class="li-title li-bm">${escapeHtml(b.label||'书签')}</div><div class="li-sub">${b.percentage}%</div></div>`}));
  (highlights||[]).forEach(h=>items.push({pos:(h.start!=null?h.start:h.position)||0, html: hlItemHtml(h)}));
  if(!items.length){body.innerHTML='<div class="li-sub" style="padding:10px">还没有书签或划线。正文里选中句子可划线、写笔记；点底部「书签」可加书签。</div>';return;}
  items.sort((a,b)=>a.pos-b.pos);
  body.innerHTML=items.map(i=>i.html).join('');
}
function renderToc(body){
  if(bookExt==='epub'&&epubBook){body.innerHTML='<div class="li-sub" style="padding:10px">epub 目录见下</div>';return;}
  if(bookExt==='pdf'){body.innerHTML='<div class="li-sub" style="padding:10px">PDF 用的是浏览器自带查看器，目录/书签暂时接不上，直接在上面翻页就好。</div>';return;}
  const toc=buildToc(bookText);
  if(!toc.length){body.innerHTML='<div class="li-sub" style="padding:10px">这本书没有章节标记，也太短，无法生成目录。</div>';return;}
  // 找当前正在读的章节：起点 pos 不超过当前阅读位置的最后一个
  let curIdx=-1;
  for(let i=0;i<toc.length;i++){ if(toc[i].pos<=curPos) curIdx=i; else break; }
  body.innerHTML=toc.map((c,i)=>{
    const cur=(i===curIdx);
    return `<div class="list-item${cur?' reading-chap':''}" onclick="jumpTo(${c.pos})"><div class="li-title">${escapeHtml(c.title)}</div>${cur?'<span class="li-now">在读</span>':''}</div>`;
  }).join('');
  // 打开目录时把当前章节滚到可视中间
  if(curIdx>=0)setTimeout(()=>{const items=body.querySelectorAll('.list-item');if(items[curIdx]&&items[curIdx].scrollIntoView)items[curIdx].scrollIntoView({block:'center'});},40);
}
// 统一生成目录：先按常见章节格式找，找不到就找"标题型短行"，再不行按长度等分兜底——保证任何书都能跳转
function buildToc(text){
  if(!text)return [];
  const lines=text.split('\n');
  const pats=[
    /^第\s*[零一二三四五六七八九十百千万两0-9]+\s*[章节回话卷部集篇]/,
    /^(序章|序言|序|楔子|引子|尾声|终章|后记|番外|外传|结局|完结|前言|附录|尾声)([\s:：].*)?$/,
    /^(Chapter|CHAPTER|Prologue|Epilogue)\b/i,
    /^卷[零一二三四五六七八九十百千万0-9]+/,
    /^\s*[（(][零一二三四五六七八九十百0-9]+[）)]\s*\S{0,30}$/,
    /^\s*[0-9]{1,4}\s*[、.．]\s*\S/,
  ];
  let toc=[], pos=0;
  for(const raw of lines){
    const t=raw.trim();
    if(t&&t.length<=40&&pats.some(p=>p.test(t)))toc.push({title:t,pos});
    pos+=raw.length+1;
    if(toc.length>800)break;
  }
  if(toc.length>=3)return toc;
  // 没找到标准章节标记 → 试"纯数字一行"当章节（这本《旧故新长》就是 1 2 3 这样分章的）
  {
    const numLine=/^\s*([0-9]{1,4})\s*[.．、]?\s*$/;
    const numToc=[]; let p2=0;
    for(const raw of lines){
      const m=raw.trim().match(numLine);
      if(m)numToc.push({title:'第 '+m[1]+' 章',pos:p2,num:parseInt(m[1],10)});
      p2+=raw.length+1;
      if(numToc.length>2000)break;
    }
    // 至少 3 个、且大体递增（像章节序号）才采用，避免把零散数字误当章节
    if(numToc.length>=3){
      let inc=0; for(let i=1;i<numToc.length;i++) if(numToc[i].num>=numToc[i-1].num) inc++;
      if(inc>=(numToc.length-1)*0.7) return numToc.map(c=>({title:c.title,pos:c.pos}));
    }
  }
  // 标题型短行：前后是空行、本行很短、不像正常句子（不以标点结尾）
  toc=[];pos=0;
  for(let i=0;i<lines.length;i++){
    const t=lines[i].trim();
    const prevBlank=i===0||lines[i-1].trim()==='';
    const nextBlank=i+1>=lines.length||lines[i+1].trim()==='';
    if(t&&t.length<=22&&prevBlank&&nextBlank&&!/[。！？，、；：,.!?；]$/.test(t))toc.push({title:t,pos});
    pos+=lines[i].length+1;
    if(toc.length>800)break;
  }
  if(toc.length>=5)return toc;
  // 兜底：按长度等分，保证总能跳转
  const total=text.length;
  if(total>4000){
    const n=Math.min(40,Math.max(6,Math.round(total/8000)));
    const seg=Math.floor(total/n);
    const out=[];
    for(let i=0;i<n;i++)out.push({title:`第 ${i+1} 段 · 约 ${Math.round(i*100/n)}%`,pos:i*seg});
    return out;
  }
  return [];
}
async function renderNotes(body){
  const r=await (await fetch('/api/notes/'+bookId)).json();
  const all=r.notes||[];
  const notes=all.filter(n=>n.source!=='quiz_wrong');   // 错题单独进错题本，不混在笔记里
  const wrongCount=all.length-notes.length;
  let html='<div class="note-add-bar"><button class="note-add-btn" onclick="openNoteEditor()">＋ 写笔记</button>'+
    (wrongCount?`<button class="note-add-btn wrong-entry" onclick="renderWrongBook(document.getElementById('list-body'))">错题本（${wrongCount}）</button>`:'')+'</div>';
  if(notes.length){
    html+='<div class="note-cards">'+notes.map(n=>{
      const img=n.image_path?`<img class="note-card-img" src="/api/notes/image/${n.image_path}" alt="">`:'';
      return `<div class="note-card"><span class="note-card-del" onclick="event.stopPropagation();delNote(${n.id})">×</span>${img}${n.title?`<div class="note-card-title">${escapeHtml(n.title)}</div>`:''}<div class="note-card-body" onclick="jumpTo(${n.position})">${escapeHtml(n.content||'')}</div></div>`;
    }).join('')+'</div>';
  }else{
    html+='<div class="li-sub" style="padding:10px">还没有笔记，点上面写一条，可以配图做成手账</div>';
  }
  body.innerHTML=html;
}
// 错题本：出题答错的题在这里回顾，可跳回原文、可移除
async function renderWrongBook(body){
  const r=await (await fetch('/api/notes/'+bookId)).json();
  const wrong=(r.notes||[]).filter(n=>n.source==='quiz_wrong');
  let html='<div class="note-add-bar"><button class="note-add-btn" onclick="switchListTab(\'note\')">← 返回笔记</button></div>';
  if(wrong.length){
    html+='<div class="note-cards">'+wrong.map(n=>`
      <div class="note-card"><span class="note-card-del" onclick="event.stopPropagation();delWrong(${n.id})">×</span>
        <div class="note-card-title">${escapeHtml(n.title||'错题')}</div>
        <div class="note-card-body" style="white-space:pre-wrap" onclick="jumpTo(${n.position})">${escapeHtml(n.content||'')}</div>
      </div>`).join('')+'</div>';
  }else{
    html+='<div class="li-sub" style="padding:10px">错题本是空的。选一段正文点「自测」，答错的会自动收进来</div>';
  }
  body.innerHTML=html;
}
function delWrong(id){if(!confirm('从错题本移除？'))return;fetch('/api/notes/'+id,{method:'DELETE'}).then(()=>renderWrongBook(document.getElementById('list-body')));}
function openNoteEditor(){
  const ed=document.getElementById('note-editor');
  if(ed){ed.classList.add('show');document.getElementById('ne-content').value='';document.getElementById('ne-title').value='';neImagePath='';document.getElementById('ne-img-prev').innerHTML='';return;}
}
function closeNoteEditor(){const ed=document.getElementById('note-editor');if(ed)ed.classList.remove('show');}
let neImagePath='';
async function neUploadImg(input){
  const file=input.files[0];if(!file)return;
  const fd=new FormData();fd.append('file',file);
  toast('上传图片中…');
  try{
    const r=await (await fetch('/api/notes/image?book_id='+bookId,{method:'POST',body:fd})).json();
    if(r.ok){neImagePath=r.image_path;document.getElementById('ne-img-prev').innerHTML=`<img src="${r.url}" alt="">`;toast('图片已添加');}
  }catch(e){toast('上传失败');}
}
async function saveNoteFromEditor(){
  const title=document.getElementById('ne-title').value.trim();
  const content=document.getElementById('ne-content').value.trim();
  if(!content&&!neImagePath){toast('写点什么吧');return;}
  await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,position:curPos,title,content,image_path:neImagePath,source:'manual'})});
  closeNoteEditor();toast('笔记已保存');switchListTab('note');
}
function delNote(id){if(!confirm('删除这条笔记？'))return;fetch('/api/notes/'+id,{method:'DELETE'}).then(()=>switchListTab('note'));}
async function renderDiary(body){
  const r=await (await fetch('/api/diary')).json();
  if(!r.diary||!r.diary.length){body.innerHTML='<div class="li-sub" style="padding:10px">还没有阅读记录</div>';return;}
  body.innerHTML=r.diary.map(day=>{
    const books=day.books.map(b=>`<div class="li-sub">· ${escapeHtml(b.book_title)} ${b.minutes_read}分钟 ${b.start_pct}%→${b.end_pct}%</div>`).join('');
    return `<div class="list-item"><div class="li-title">${day.date}</div>${books}</div>`;
  }).join('');
}
function delBookmark(id){fetch('/api/bookmarks/'+id,{method:'DELETE'});bookmarks=bookmarks.filter(b=>b.id!==id);switchListTab('bookmark');}
function delHighlight(id){fetch('/api/highlights/'+id,{method:'DELETE'});highlights=highlights.filter(h=>h.id!==id);switchListTab('marks');repaintHighlights();}
// 点正文里的划线弹出的小菜单：改颜色 / 写笔记 / 删除（参考 Moon+ 那种就地操作）。
// 长度调整不再用“头扩/尾缩”按钮，改成正文里直接拖起止两端的圆手柄（像系统选区那样自由拖）。
function closeHlMenu(){const m=document.getElementById('hl-menu');if(m)m.remove();removeHlHandles();}
function showHlMenu(id,x,y){
  closeHlMenu();
  const h=highlights.find(v=>v.id===id);if(!h)return;
  const m=document.createElement('div');m.className='hl-menu';m.id='hl-menu';
  const dots=HL_COLORS.map(([c,hex])=>`<span class="hlm-dot${h.color===c?' on':''}" style="background:${hex}" data-c="${c}"></span>`).join('');
  m.innerHTML=`<div class="hlm-colors">${dots}</div>`+
    `<div class="hlm-acts"><span data-act="note">笔记</span><span data-act="del">删除</span></div>`;
  document.body.appendChild(m);
  const mw=m.offsetWidth,mh=m.offsetHeight;
  const left=Math.max(8,Math.min((x||window.innerWidth/2)-mw/2, window.innerWidth-mw-8));
  let top=(y||120)-mh-14; if(top<8)top=(y||120)+18;
  m.style.left=left+'px'; m.style.top=top+'px';
  m.addEventListener('pointerdown',ev=>ev.stopPropagation());
  m.addEventListener('click',ev=>{
    const dot=ev.target.closest('.hlm-dot');
    if(dot){setHlColor(id,dot.dataset.c);positionHlHandles();return;}   // 改色后手柄留着，方便接着拖
    const act=ev.target.closest('[data-act]');if(!act)return;
    if(act.dataset.act==='note'){closeHlMenu();editHlNote(id);}
    else if(act.dataset.act==='del'){closeHlMenu();fetch('/api/highlights/'+id,{method:'DELETE'});highlights=highlights.filter(v=>v.id!==id);repaintHighlights();}
  });
  showHlHandles(id);                    // 显示可自由拖动的起止手柄
  setTimeout(()=>document.addEventListener('pointerdown',closeHlMenu,{once:true}),0);
}

// ===== 划线起止手柄：在正文里直接拖两端，自由调整划线范围 =====
let _hlHandles=null;   // {id, startEl, endEl, onScroll}
function removeHlHandles(){
  if(!_hlHandles)return;
  try{_hlHandles.startEl.remove();_hlHandles.endEl.remove();}catch(_){}
  const sv=document.getElementById('scroll-view');
  if(sv&&_hlHandles.onScroll)sv.removeEventListener('scroll',_hlHandles.onScroll);
  window.removeEventListener('resize',_hlHandles.onScroll);
  _hlHandles=null;
}
function showHlHandles(id){
  removeHlHandles();
  if(typeof bookText!=='string'||!bookText.length)return;
  const mk=(which)=>{
    const el=document.createElement('div');
    el.className='hl-handle hl-handle-'+which;el.dataset.which=which;
    el.addEventListener('pointerdown',ev=>startHandleDrag(ev,id,which));
    document.body.appendChild(el);return el;
  };
  const startEl=mk('start'), endEl=mk('end');
  const sv=document.getElementById('scroll-view');
  const onScroll=()=>positionHlHandles();
  _hlHandles={id,startEl,endEl,onScroll};
  if(sv)sv.addEventListener('scroll',onScroll,{passive:true});
  window.addEventListener('resize',onScroll);
  positionHlHandles();
}
function positionHlHandles(){
  if(!_hlHandles)return;
  const spans=Array.prototype.slice.call(document.querySelectorAll('.hl[data-hlid="'+_hlHandles.id+'"]'));
  if(!spans.length)return;
  const fRects=spans[0].getClientRects();
  const lRects=spans[spans.length-1].getClientRects();
  if(!fRects.length||!lRects.length)return;
  const fr=fRects[0], lr=lRects[lRects.length-1];
  const vh=window.innerHeight||document.documentElement.clientHeight;
  const place=(el,px,py)=>{ if(py<46||py>vh-8){el.style.display='none';return;} el.style.display='block';el.style.left=px+'px';el.style.top=py+'px'; };
  place(_hlHandles.startEl, fr.left,  fr.bottom);    // 起点：左下角
  place(_hlHandles.endEl,   lr.right, lr.bottom);    // 终点：右下角
}
function startHandleDrag(e,id,which){
  e.preventDefault(); e.stopPropagation();
  const h=highlights.find(v=>v.id===id);if(!h)return;
  try{e.target.setPointerCapture&&e.target.setPointerCapture(e.pointerId);}catch(_){}
  let raf=0;
  const apply=(x,y)=>{
    const off=caretOffsetFromPoint(x,y);
    if(off==null)return;
    const prevS=h.start, prevE=(h.end!=null?h.end:h.start+((h.text&&h.text.length)||0));
    let start=h.start, end=prevE;
    if(which==='start')start=Math.max(0,Math.min(off,end-1));
    else               end  =Math.max(start+1,Math.min(off,bookText.length));
    if(end<=start)return;
    h.start=start;h.position=start;h.end=end;h.text=bookText.slice(start,end);
    repaintHlRange(Math.min(prevS,start)-1, Math.max(prevE,end)+1);   // 只重绘划线碰到的那几块，长篇不卡
    positionHlHandles();          // 手柄跟到新两端
  };
  const move=(ev)=>{
    const x=(ev.clientX!=null)?ev.clientX:(ev.touches&&ev.touches[0]?ev.touches[0].clientX:0);
    const y=(ev.clientY!=null)?ev.clientY:(ev.touches&&ev.touches[0]?ev.touches[0].clientY:0);
    if(raf)cancelAnimationFrame(raf);
    raf=requestAnimationFrame(()=>apply(x,y));
    ev.preventDefault();
  };
  const up=()=>{
    document.removeEventListener('pointermove',move,true);
    document.removeEventListener('pointerup',up,true);
    document.removeEventListener('pointercancel',up,true);
    fetch('/api/highlights/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({position:h.start,text:h.text})}).catch(()=>{});
    // 拖完别让这次 pointerup 立刻触发“点外面关菜单”
    setTimeout(()=>document.addEventListener('pointerdown',closeHlMenu,{once:true}),0);
  };
  document.addEventListener('pointermove',move,true);
  document.addEventListener('pointerup',up,true);
  document.addEventListener('pointercancel',up,true);
}
// 屏幕坐标 → 全书字符偏移（拖手柄时把手指位置换算成正文里的字符位置）
function caretOffsetFromPoint(x,y){
  let node=null,off=0;
  if(document.caretRangeFromPoint){const r=document.caretRangeFromPoint(x,y);if(r){node=r.startContainer;off=r.startOffset;}}
  else if(document.caretPositionFromPoint){const p=document.caretPositionFromPoint(x,y);if(p){node=p.offsetNode;off=p.offset;}}
  if(!node)return null;
  return nodeToGlobalOffset(node,off);
}
// DOM 节点位置 → 全书字符偏移（以所在段落 .rp 的 data-off 为基准，和划线/选区算法一致）
function nodeToGlobalOffset(node,nodeOffset){
  let el=(node&&node.nodeType!==1)?node.parentElement:node;
  const para=(el&&el.closest)?el.closest('.rp'):null;
  const anchor=(para&&para.dataset&&para.dataset.off!=null)?para
              :((el&&el.closest)?el.closest('.rblock,.page-sec,.flip-page-content,.page-sheet'):null);
  if(!anchor||!anchor.dataset||anchor.dataset.off==null)return null;
  const base=parseInt(anchor.dataset.off,10)||0;
  let n=0;
  try{const pre=document.createRange();pre.selectNodeContents(anchor);pre.setEnd(node,nodeOffset);n=pre.toString().length;}catch(e){return null;}
  return base+n;
}


function jumpTo(pos){
  closeAll();
  if(bookExt==='epub'&&epubRend&&typeof pos==='string'){epubRend.display(pos);return;}
  curPos=pos;
  scrollToOffset(pos, true);   // 翻页/滚动同一条滚动容器；带落点闪烁，跳过去一眼看到停在哪
}

// ============ AI 助手 ============
async function sendAI(prefill){
  const inp=document.getElementById('ai-input');
  const msg=((typeof prefill==='string')?prefill:inp.value).trim();
  if(!msg)return;
  if(typeof prefill!=='string')inp.value='';
  appendMsg('user',msg);
  const lid=appendMsg('bot','思考中…',true);
  try{
    const data=await (await fetch('/api/ai/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:bookId,message:msg,position:curPos,history:chatHistory.slice(-10),session_id:quillSessionId})})).json();
    if(data.session_id)quillSessionId=data.session_id;
    const el=document.getElementById(lid);
    const failed=!!(data.error||!data.reply);
    let html=escapeHtml(data.reply||data.error||'无回复').replace(/\n/g,'<br>');
    if(data.tool_calls&&data.tool_calls.length)html+='<div class="meta">'+data.tool_calls.map(t=>t.name).join(', ')+'</div>';
    if(data.jump)html+=`<div class="meta"><a onclick="jumpTo(${typeof data.jump.position==='number'?data.jump.position:0})" style="color:var(--accent);cursor:pointer">跳转</a></div>`;
    el.querySelector('.msg-text').innerHTML=html;
    el.dataset.prompt=msg;                 // 记住这条对应的提问，供"重试"
    if(data.message_id)el.dataset.mid=data.message_id;   // 记住这条回复的库 id，供收藏
    el.classList.toggle('failed',failed);
    addMsgActions(el,'bot');
    bindMsgLongPress(el);                   // 长按收藏（触摸）
    if(!failed)chatHistory.push({role:'user',content:msg},{role:'assistant',content:data.reply||''});
    if(data.tool_calls)data.tool_calls.forEach(t=>{if(t.name==='save_reading_note')toast('已存笔记');});
  }catch(e){
    const el=document.getElementById(lid);
    el.querySelector('.msg-text').textContent='请求失败，可点"重试"再发一次';
    el.dataset.prompt=msg; el.classList.add('failed'); addMsgActions(el,'bot');
  }
  document.getElementById('ai-msgs').scrollTop=99999;
}
function appendMsg(role,text,loading){
  const id='m'+Date.now()+Math.random();
  const d=document.createElement('div');d.className='ai-msg '+role;d.id=id;
  const body=loading?'<em>'+escapeHtml(text)+'</em>':escapeHtml(text).replace(/\n/g,'<br>');
  d.innerHTML='<div class="msg-text">'+body+'</div>';
  if(!loading){d.dataset.prompt=(role==='user'?text:'');addMsgActions(d,role);}
  document.getElementById('ai-msgs').appendChild(d);d.scrollIntoView();return id;
}
function addMsgActions(el,role){
  if(el.querySelector('.msg-acts'))return;
  const acts=document.createElement('div');acts.className='msg-acts';
  let h='';
  if(role==='bot'){
    h+='<span class="msg-act" onclick="retryMsg(this)" title="用同样的问题重新发送">重试</span>';
    h+='<span class="msg-act msg-star" onclick="starMsg(this)" title="收藏这条（长按也可以）">收藏</span>';
  }
  h+='<span class="msg-act" onclick="delMsg(this)" title="删除这条">删除</span>';
  acts.innerHTML=h;el.appendChild(acts);
}
// 长按一条回复也能收藏（触摸友好）
function bindMsgLongPress(el){
  if(!el||el._lpBound)return; el._lpBound=true;
  let t=null;
  const start=()=>{t=setTimeout(()=>{const s=el.querySelector('.msg-star');if(s)starMsg(s);},550);};
  const cancel=()=>{if(t){clearTimeout(t);t=null;}};
  el.addEventListener('touchstart',start,{passive:true});
  el.addEventListener('touchend',cancel);el.addEventListener('touchmove',cancel);
}
async function starMsg(span){
  const el=span.closest('.ai-msg'); if(!el)return;
  const mid=el.dataset.mid;
  if(!mid){toast('这条还没同步好，稍等一下再收藏');return;}
  const starred=!el.classList.contains('starred');
  el.classList.toggle('starred',starred);
  const s=el.querySelector('.msg-star'); if(s)s.textContent=starred?'已藏':'收藏';
  try{await fetch('/api/quill/message/star',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message_id:parseInt(mid),starred})});}
  catch(e){el.classList.toggle('starred',!starred);if(s)s.textContent=!starred?'已藏':'收藏';toast('操作失败');}
  if(starred)toast('已收藏这条');
}
// 收藏夹：列出所有收藏的回复，点一条回填到对话里
let _starredItems=[];
async function showStarred(){
  const box=document.getElementById('ai-msgs');if(!box)return;
  box.innerHTML='<div class="qh-head">收藏夹<span class="qh-new" onclick="clearChat()">＋ 新对话</span></div><div class="qh-list">加载中…</div>';
  try{
    const r=await (await fetch('/api/quill/starred')).json();
    const list=box.querySelector('.qh-list');
    _starredItems=(r.starred||[]).filter(m=>m.content);
    if(!_starredItems.length){list.innerHTML='<div class="qh-empty">还没有收藏。对话里长按或点「收藏」保存值得记的回复</div>';return;}
    list.innerHTML=_starredItems.map((m,i)=>{
      const when=(m.created_at||'').replace('T',' ').slice(0,16);
      const txt=(m.content||'').slice(0,120);
      return `<div class="qh-item" onclick="fillStarred(${i})"><div class="qh-t">${escapeHtml(txt)}${(m.content||'').length>120?'…':''}</div><div class="qh-when">${escapeHtml((m.book_title||'')+' · '+when)}</div><span class="qh-del" onclick="event.stopPropagation();unstar(${m.id},this)">移除</span></div>`;
    }).join('');
  }catch(e){const l=box.querySelector('.qh-list');if(l)l.textContent='加载失败';}
}
function fillStarred(i){
  const m=_starredItems[i];if(!m)return;
  clearChat();
  appendMsg('bot',m.content||'');
}
async function unstar(id,el){
  try{await fetch('/api/quill/message/star',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message_id:id,starred:false})});}catch(e){}
  const item=el&&el.closest('.qh-item'); if(item)item.remove();
}
function retryMsg(span){
  const el=span.closest('.ai-msg');const prompt=el&&el.dataset.prompt;
  if(!prompt)return;
  // 把这条（失败/旧）回复连同它上面那条提问一起删掉，再用同样的问题重发
  const prev=el.previousElementSibling;
  if(prev&&prev.classList.contains('user'))prev.remove();
  el.remove();
  sendAI(prompt);
}
function delMsg(span){const el=span.closest('.ai-msg');if(el)el.remove();}
function clearChat(){
  const box=document.getElementById('ai-msgs');if(box)box.innerHTML='';
  chatHistory.length=0; quillSessionId=null;
}
// 历史对话：列出这本书以前和 Quill 的几段对话，点开继续/回看
async function loadQuillHistory(){
  const box=document.getElementById('ai-msgs');if(!box)return;
  box.innerHTML='<div class="qh-head">历史对话<span class="qh-new" onclick="clearChat()">＋ 新对话</span></div><div class="qh-list">加载中…</div>';
  try{
    const r=await (await fetch('/api/quill/sessions?book_id='+bookId)).json();
    const list=box.querySelector('.qh-list');
    if(!r.sessions||!r.sessions.length){list.innerHTML='<div class="qh-empty">还没有历史对话</div>';return;}
    list.innerHTML=r.sessions.map(s=>{
      const when=(s.updated_at||'').replace('T',' ').slice(0,16);
      return `<div class="qh-item" onclick="openQuillSession(${s.id})"><div class="qh-t">${escapeHtml(s.title||'对话')}</div><div class="qh-when">${escapeHtml(when)}</div><span class="qh-del" onclick="event.stopPropagation();delQuillSession(${s.id})">删除</span></div>`;
    }).join('');
  }catch(e){const l=box.querySelector('.qh-list');if(l)l.textContent='加载失败';}
}
async function openQuillSession(id){
  const box=document.getElementById('ai-msgs');if(!box)return;
  box.innerHTML=''; quillSessionId=id; chatHistory.length=0;
  try{
    const r=await (await fetch('/api/quill/session/'+id)).json();
    (r.messages||[]).forEach(m=>{
      appendMsg(m.role==='assistant'?'bot':'user', m.content||'');
      chatHistory.push({role:m.role,content:m.content||''});
    });
  }catch(e){}
  box.scrollTop=99999;
}
async function delQuillSession(id){
  try{await fetch('/api/quill/session/'+id,{method:'DELETE'});}catch(e){}
  if(quillSessionId===id)clearChat();
  loadQuillHistory();
}

// ============ 声音（只用本地 _ambient 真实音频）============
let ambientEls={};               // id -> {audio, vol}
// 把丑文件名洗成友好名字（去来源前缀/随机数字，关键词转中文）
function prettyAmbName(raw){
  let s=String(raw||'').replace(/\.[a-z0-9]+$/i,'');
  s=s.replace(/^(freesound_community|dragon-studio|soundsforyou|prem_adhikary|white_records|pixabay)[-_]/i,'');
  s=s.replace(/[-_]?\d{4,}$/,'').replace(/[-_]+/g,' ').trim();
  const map=[['ocean','海浪'],['waves','海浪'],['rain','雨'],['thunder','雷雨'],['storm','暴雨'],
    ['stream','溪流'],['river','河流'],['forest','森林'],['wind','风'],['cafe','咖啡馆'],
    ['fire','篝火'],['fireplace','壁炉'],['night','夜晚'],['bird','鸟鸣'],['summer','夏日'],
    ['calm','轻柔'],['gentle','轻柔'],['ambient','环境']];
  let zh=s.toLowerCase(), hit=[];
  map.forEach(([k,v])=>{if(zh.includes(k)&&!hit.includes(v))hit.push(v);});
  return hit.length?hit.join('·'):(s||raw);
}
let _ambGroups=null,_ambEdit=false,_ambSaveT=null,_ambDragId=null;
function _ambName(a){const nm=(_ambGroups&&_ambGroups.names)||{};return nm[a.id]||a.nice;}
function ambRename(id){
  const a=(window._allAmbients||[]).find(x=>x.id===id);if(!a)return;
  const name=prompt('名字：',_ambName(a));if(!name)return;
  (_ambGroups.names=_ambGroups.names||{})[id]=name;
  saveAmbGroups();renderAmbList();
}
function _ambRowHTML(a){
  return `
        <div class="amb-wrap" data-row="${a.id}">
          <div class="amb-item">
            ${_ambEdit?`<span class="amb-grip" title="拖动排序/入组">≡</span><span class="amb-updown"><button onclick="ambMove('${a.id}',-1)">▲</button><button onclick="ambMove('${a.id}',1)">▼</button></span>`:''}
            <button class="amb-btn" data-amb="${a.id}" onclick="toggleAmb('${a.id}')" title="${a.name}">${_ambName(a)}</button><span class="amb-eq"><i></i><i></i><i></i></span>${_ambEdit&&a.user?`<span class="amb-rename" onclick="ambRename('${a.id}')">✎</span>`:''}
            <input class="amb-vol" type="range" min="0" max="100" value="50" oninput="setAmbItemVol('${a.id}',this.value)" title="音量" disabled>
            <button class="amb-fold" onclick="ambRowFold('${a.id}',event)" title="展开 / 收起细调">▾</button>
            ${_ambEdit?`<select class="amb-gsel" onchange="ambSetGroup('${a.id}',this.value)">${[['','未分组']].concat((_ambGroups.groups||[]).map(g=>[g.id,g.name])).map(([v,n])=>`<option value="${v}" ${((_ambGroups.item||{})[a.id]||'')===v?'selected':''}>${n}</option>`).join('')}</select>`:''}
            ${a.user&&_ambEdit?`<button class="amb-del" title="删除（自己上传的）" onclick="delAmbient('${a.id}',event)">×</button>`:''}
          </div>
          <div class="amb-detail">
            <div class="amb-drow"><span class="amb-dlbl">快慢</span><input class="amb-rate" type="range" min="50" max="150" value="100" oninput="setAmbItemRate('${a.id}',this.value)"></div>
            <div class="amb-drow"><span class="amb-dlbl">远近</span><input class="amb-muffle" type="range" min="0" max="100" value="0" oninput="setAmbItemMuffle('${a.id}',this.value)"></div>
            <div class="amb-drow"><span class="amb-dlbl">空间</span><input class="amb-reverb" type="range" min="0" max="100" value="0" oninput="setAmbItemReverb('${a.id}',this.value)"></div>
          </div>
        </div>`;
}
function saveAmbGroups(){
  clearTimeout(_ambSaveT);
  _ambSaveT=setTimeout(()=>{fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ambientGroups:JSON.stringify(_ambGroups||{})})}).catch(()=>{});},400);
}
function ambEditToggle(){_ambEdit=!_ambEdit;const p2=document.querySelector('.ambient-panel');if(p2)p2.classList.toggle('editing',_ambEdit);renderAmbList();}
function ambNewGroup(){
  const name=prompt('分组名字：','雨天');if(!name)return;
  (_ambGroups.groups=_ambGroups.groups||[]).push({id:'g'+Date.now(),name});
  saveAmbGroups();renderAmbList();
}
function ambRenameGroup(gid){
  const g=(_ambGroups.groups||[]).find(x=>x.id===gid);if(!g)return;
  const name=prompt('改名：',g.name);if(!name)return;
  g.name=name;saveAmbGroups();renderAmbList();
}
function ambDelGroup(gid){
  if(!confirm('删除这个分组？组里的声音会回到未分组'))return;
  _ambGroups.groups=(_ambGroups.groups||[]).filter(x=>x.id!==gid);
  Object.keys(_ambGroups.item||{}).forEach(k=>{if(_ambGroups.item[k]===gid)delete _ambGroups.item[k];});
  saveAmbGroups();renderAmbList();
}
function ambSetGroup(id,gid){
  (_ambGroups.item=_ambGroups.item||{})[id]=gid||undefined;
  if(!gid)delete _ambGroups.item[id];
  saveAmbGroups();renderAmbList();
}
function ambMove(id,d){
  const gid=(_ambGroups.item||{})[id]||'';
  const list=(window._allAmbients||[]).filter(x=>(((_ambGroups.item||{})[x.id])||'')===gid).map(x=>x.id);
  const saved=((_ambGroups.order||{})[gid]||[]).filter(i=>list.includes(i));
  const ids=saved.concat(list.filter(i=>!saved.includes(i)));
  const i=ids.indexOf(id);if(i<0)return;
  const j=i+d;if(j<0||j>=ids.length)return;
  ids.splice(i,1);ids.splice(j,0,id);
  (_ambGroups.order=_ambGroups.order||{})[gid]=ids;
  saveAmbGroups();renderAmbList();
}
function ambFoldToggle(gid){
  let f={};try{f=JSON.parse(localStorage.getItem('amb_fold')||'{}');}catch(e){}
  f[gid]=!f[gid];localStorage.setItem('amb_fold',JSON.stringify(f));
  renderAmbList();
}
function renderAmbList(){
  const grid=document.getElementById('ambient-grid');
  const local=window._allAmbients||[];
  if(!grid)return;
  if(!local.length){grid.innerHTML='<div class="amb-empty">还没有声音——点上面「＋ 上传白噪音」。</div>';return;}
  _ambGroups=_ambGroups||{};_ambGroups.groups=_ambGroups.groups||[];_ambGroups.item=_ambGroups.item||{};_ambGroups.order=_ambGroups.order||{};
  let fold={};try{fold=JSON.parse(localStorage.getItem('amb_fold')||'{}');}catch(e){}
  const byId={};local.forEach(x=>byId[x.id]=x);
  const inGroup=id=>_ambGroups.item[id]||'';
  const orderOf=(gid,ids)=>{
    const saved=(_ambGroups.order[gid]||[]).filter(i=>ids.includes(i));
    return saved.concat(ids.filter(i=>!saved.includes(i)));
  };
  let h=`<div class="amb-toolrow"><span style="margin-right:auto"></span>
    ${_ambEdit?`<button class="amb-mini" onclick="ambNewGroup()">＋分组</button>`:''}
    <button class="amb-mini" onclick="ambEditToggle()">${_ambEdit?'完成':'编辑'}</button></div>`;
  _ambGroups.groups.forEach(g=>{
    const ids=orderOf(g.id,local.filter(x=>inGroup(x.id)===g.id).map(x=>x.id));
    const folded=!!fold[g.id];
    h+=`<div class="amb-ghead" data-gh="${g.id}" onclick="ambFoldToggle('${g.id}')">${folded?'▸':'▾'} ${g.name}<span class="amb-gn">${ids.length}</span>
      ${_ambEdit?`<span class="amb-gops"><a onclick="event.stopPropagation();ambRenameGroup('${g.id}')">改名</a><a onclick="event.stopPropagation();ambDelGroup('${g.id}')">删除</a></span>`:''}</div>`;
    if(!folded)h+=`<div class="amb-gbody" data-gbody="${g.id}">`+ids.map(i=>_ambRowHTML(byId[i])).join('')+`</div>`;
  });
  const looseIds=orderOf('',local.filter(x=>!inGroup(x.id)).map(x=>x.id));
  if(looseIds.length){
    if(_ambGroups.groups.length)h+=`<div class="amb-ghead amb-loose">未分组<span class="amb-gn">${looseIds.length}</span></div>`;
    h+=`<div class="amb-gbody" data-gbody="">`+looseIds.map(i=>_ambRowHTML(byId[i])).join('')+`</div>`;
  }
  h+=`<button class="amb-stopall" onclick="stopAllAmbient()">全部停止</button>`;
  grid.innerHTML=h;
  syncAmbUI&&syncAmbUI();
  // 长按=进编辑
  grid.querySelectorAll('.amb-wrap').forEach(el=>{
    let t=null,fired=false;
    el.addEventListener('pointerdown',e=>{
      if(_ambEdit||e.target.closest('input'))return;
      fired=false;t=setTimeout(()=>{t=null;fired=true;_ambEdit=true;renderAmbList();},550);
    });
    const c=()=>{if(t){clearTimeout(t);t=null;}};
    el.addEventListener('pointerup',c);el.addEventListener('pointerleave',c);
    el.addEventListener('click',e=>{if(fired){e.stopPropagation();e.preventDefault();fired=false;}},true);
  });
  const pn=document.querySelector('.ambient-panel');if(pn)pn.classList.toggle('editing',_ambEdit);
  if(_ambEdit){
    const inGroupOf=id=>(_ambGroups.item||{})[id]||'';
    grid.querySelectorAll('.amb-grip').forEach(gr=>{
      gr.addEventListener('pointerdown',e=>{
        e.preventDefault();e.stopPropagation();
        const row=gr.closest('.amb-wrap');if(!row)return;
        const id=row.dataset.row;
        row.classList.add('dragging');
        try{gr.setPointerCapture(e.pointerId);}catch(_){}
        let hover=null;
        const mv=ev=>{
          const el=document.elementFromPoint(ev.clientX,ev.clientY);
          const t=el&&(el.closest('.amb-wrap')||el.closest('.amb-ghead[data-gh]'));
          if(hover&&hover!==t)hover.classList.remove('drop-hint');
          hover=t;if(hover&&hover!==row)hover.classList.add('drop-hint');
        };
        const up=ev=>{
          gr.removeEventListener('pointermove',mv);
          gr.removeEventListener('pointerup',up);gr.removeEventListener('pointercancel',up);
          row.classList.remove('dragging');
          if(hover)hover.classList.remove('drop-hint');
          if(!hover||hover===row)return;
          if(hover.dataset&&hover.dataset.gh!==undefined&&!hover.classList.contains('amb-wrap')){
            ambSetGroup(id,hover.dataset.gh);return;
          }
          const tid=hover.dataset.row;
          const gid=inGroupOf(tid);
          _ambGroups.item=_ambGroups.item||{};
          if(gid)_ambGroups.item[id]=gid;else delete _ambGroups.item[id];
          const list=window._allAmbients||[];
          const idsAll=list.filter(x=>inGroupOf(x.id)===gid&&x.id!==id).map(x=>x.id);
          const saved=((_ambGroups.order||{})[gid]||[]).filter(i=>idsAll.includes(i));
          const ids=saved.concat(idsAll.filter(i=>!saved.includes(i)));
          ids.splice(Math.max(0,ids.indexOf(tid)),0,id);
          (_ambGroups.order=_ambGroups.order||{})[gid]=ids;
          saveAmbGroups();renderAmbList();
        };
        gr.addEventListener('pointermove',mv);
        gr.addEventListener('pointerup',up);gr.addEventListener('pointercancel',up);
      });
    });
  }
}
function buildAmbientUI(){
  Promise.all([
    fetch('/api/ambient/list').then(r=>r.json()),
    fetch('/api/reading-prefs').then(r=>r.json()).catch(()=>({}))
  ]).then(([d,pref])=>{
    window._allAmbients=(d.sounds||[]).map(x=>({id:'local_'+x.id,name:x.name,nice:prettyAmbName(x.name),localFile:x.file,user:!!x.user}));
    try{_ambGroups=JSON.parse(pref.ambientGroups||'{}');}catch(e){_ambGroups={};}
    renderAmbList();
  });
}
async function uploadAmbient(input){
  const f=input.files&&input.files[0];input.value='';
  if(!f)return;
  if(typeof toast==='function')toast('上传中…');
  try{
    const fd=new FormData();fd.append('file',f);
    const r=await (await fetch('/api/ambient/upload',{method:'POST',body:fd})).json();
    if(r.ok){buildAmbientUI();if(typeof toast==='function')toast('已添加「'+(r.name||'')+'」');}
    else if(typeof toast==='function')toast('上传失败'+(r.detail?('：'+r.detail):''));
  }catch(e){if(typeof toast==='function')toast('上传失败');}
}
async function delAmbient(id,ev){
  if(ev)ev.stopPropagation();
  if(!confirm('删除这个自己上传的声音？'))return;
  const stem=id.replace(/^local_/,'');
  if(ambientEls[id]){try{ambientEls[id].audio.pause();}catch(_){}delete ambientEls[id];}
  try{await fetch('/api/ambient/user/'+encodeURIComponent(stem),{method:'DELETE'});buildAmbientUI();}catch(e){}
}
function editReaderTitle(){
  if(!bookId)return;
  const nt=prompt('修改书名：', bookTitle);
  if(nt===null)return;
  const t=(nt||'').trim();
  const na=prompt('修改作者（没有可留空）：', bookAuthor||'');
  if(na===null)return;
  const a=(na||'').trim();
  const body={id:bookId};
  if(t && t!==bookTitle){body.title=t; bookTitle=t;}
  if(a!==bookAuthor){body.author=a; bookAuthor=a;}
  if(Object.keys(body).length<=1)return;
  document.getElementById('book-title').textContent=bookTitle+(bookAuthor?' · '+bookAuthor:'');
  document.title=bookTitle;
  fetch('/api/update',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}).catch(()=>{});
  if(typeof toast==='function')toast('已更新');
}
function toggleAmbient(){
  const p=document.getElementById('ambient-panel');
  const willOpen = !p.classList.contains('show');   // 先看原本是开还是关
  closeAll();                                        // 关掉其它面板（也会清掉本面板的 show）
  if(willOpen){ p.classList.add('show'); renderAmbPresets(); }   // 原本是关的才打开，并刷新"我的组合"
}
// 音量渐变：淡入/淡出，避免白噪音"突然炸出来"或被硬切。逐帧改 audio.volume；
// 就算走了 Web Audio 处理链(createMediaElementSource)，element.volume 依旧生效，所以这条对两种路径都管用。
// ===== 白噪音引擎 v2：整段解码进 WebAudio =====
// 为什么重写：手机上 <audio>+playbackRate<1 会一卡一卡、iOS 还锁 volume、循环有接缝；
// 改成 AudioBuffer→BufferSource 后，快慢是采样级平滑参数、循环无缝、音量/远近/空间全走增益节点，手机电脑一个样。
let _ambBufCache={};
function _ambParams(id){   // 读该行四个滑块（重渲染后由 syncAmbUI 回写，始终和真实声音一致）
  const wrap=document.querySelector(`[data-row="${id}"]`);
  const gv=(sel,def)=>{const el=wrap&&wrap.querySelector(sel);return el?(parseInt(el.value)||0):def;};
  return {vol:gv('.amb-vol',50),rate:gv('.amb-rate',100),muffle:gv('.amb-muffle',0),reverb:gv('.amb-reverb',0)};
}
function _ambCutoff(v){const t=Math.max(0,Math.min(1,(v||0)/100));return Math.round(20000*Math.pow(350/20000,t));}
async function _ambBuffer(ctx,conf){
  if(_ambBufCache[conf.id])return _ambBufCache[conf.id];
  const ab=await (await fetch('/api/ambient/file/'+encodeURIComponent(conf.name))).arrayBuffer();
  const buf=await new Promise((res,rej)=>{const pr=ctx.decodeAudioData(ab,res,rej);if(pr&&pr.then)pr.then(res,rej);});
  const out=_ambSeamless(ctx,buf);   // v4.5：循环接缝先处理掉再缓存
  _ambBufCache[conf.id]=out;return out;
}
function _ambSeamless(ctx,buf){
  // v4.5 循环"咔哒"根治：素材首尾波形对不上，loop 回卷那一下会蹦个瞬态。
  // 办法：解码后把结尾约 1 秒与开头做等功率交叉淡化（sin/cos 增益，响度不塌），
  // 新缓冲长度 = 原长 - 淡化段；开头 F 个采样 = 原开头×sin + 原结尾×cos，
  // 于是循环点被藏进淡化段里——接缝两侧本来就是同一段混合，听不出回卷。
  // 只对 >3s 的素材做；太短的（提示音之类）原样返回。
  try{
    const sr=buf.sampleRate,L=buf.length;
    if(L<sr*3)return buf;
    const F=Math.min(Math.floor(sr),Math.floor(L/3));
    const out=ctx.createBuffer(buf.numberOfChannels,L-F,sr);
    for(let ch=0;ch<buf.numberOfChannels;ch++){
      const s=buf.getChannelData(ch),d=out.getChannelData(ch),tail=L-F;
      for(let i=0;i<F;i++){
        const th=(i/F)*Math.PI/2;
        d[i]=s[i]*Math.sin(th)+s[tail+i]*Math.cos(th);
      }
      for(let i=F;i<tail;i++)d[i]=s[i];
    }
    return out;
  }catch(_){return buf;}
}
function syncAmbUI(){   // 列表任何一次重渲染（折叠分组/编辑/排序）后，把"正在播"的状态和滑块值写回界面
  Object.keys(ambientEls).forEach(id=>{
    const e=ambientEls[id];
    const btn=document.querySelector(`[data-amb="${id}"]`);if(btn)btn.classList.add('on');
    const wrap=document.querySelector(`[data-row="${id}"]`);if(!wrap)return;
    wrap.classList.add('playing');wrap.classList.toggle('open',e.open!==false);
    const set=(sel,v)=>{const el=wrap.querySelector(sel);if(el)el.value=v;};
    set('.amb-vol',e.p.vol);set('.amb-rate',e.p.rate);set('.amb-muffle',e.p.muffle);set('.amb-reverb',e.p.reverb);
    const s=wrap.querySelector('.amb-vol');if(s)s.disabled=false;
  });
}
function ambRowFold(id,ev){   // 播放归播放、展开归展开：随时可以把细调折起来，小均衡条仍然亮着
  if(ev){ev.stopPropagation();ev.preventDefault();}
  const wrap=document.querySelector(`[data-row="${id}"]`);if(!wrap)return;
  wrap.classList.toggle('open');
  if(ambientEls[id])ambientEls[id].open=wrap.classList.contains('open');
}
function toggleAmb(id){
  const btn=document.querySelector(`[data-amb="${id}"]`);
  const wrap=document.querySelector(`[data-row="${id}"]`);
  // 已在播 → 停掉（立刻删引用，避免快速点两下又开一个）
  if(ambientEls[id]){
    const e=ambientEls[id];
    delete ambientEls[id];
    if(btn)btn.classList.remove('on');
    if(wrap){wrap.classList.remove('playing','open');const s=wrap.querySelector('.amb-vol');if(s)s.disabled=true;}
    _ambStop(e);
    return;
  }
  const conf=(window._allAmbients||[]).find(a=>a.id===id);
  if(!conf||!conf.localFile)return;
  const p=_ambParams(id);
  const ctx=_ensureAudioCtx();
  const e={p,open:true,loading:true};
  ambientEls[id]=e;
  if(btn)btn.classList.add('on');
  if(wrap){wrap.classList.add('playing','open');const s=wrap.querySelector('.amb-vol');if(s)s.disabled=false;}
  if(!ctx){_ambLegacyPlay(id,conf,btn,wrap,e);return;}   // 极老浏览器兜底
  if(ctx.state==='suspended'){try{ctx.resume();}catch(_){}}
  _ambBuffer(ctx,conf).then(buf=>{
    if(ambientEls[id]!==e)return;                        // 解码期间被点掉了 → 不再起播
    e.loading=false;
    const src=ctx.createBufferSource();src.buffer=buf;src.loop=true;
    src.playbackRate.value=Math.max(0.5,Math.min(1.5,e.p.rate/100));
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=_ambCutoff(e.p.muffle);
    const dry=ctx.createGain(),wet=ctx.createGain(),master=ctx.createGain();
    const t=Math.max(0,Math.min(1,e.p.reverb/100));
    dry.gain.value=1-0.35*t;wet.gain.value=1.15*t;      // 空间感抬升时干声略退，手机小喇叭也能听出区别
    master.gain.value=0;                                 // 静音起步 → ~2.4s 缓缓浮上来（v4.5 放缓）
    src.connect(filter);filter.connect(dry);dry.connect(master);
    try{const conv=ctx.createConvolver();conv.buffer=_reverbIR(ctx);filter.connect(conv);conv.connect(wet);wet.connect(master);}catch(_){}
    master.connect(ctx.destination);
    Object.assign(e,{ctx,src,filter,dry,wet,master});
    src.start();
    master.gain.setTargetAtTime(Math.max(0,Math.min(1,e.p.vol/100)),ctx.currentTime,0.8);
  }).catch(()=>{
    if(ambientEls[id]!==e)return;                        // 个别编码解不动 → 退回 <audio> 直放（无特效）
    _ambLegacyPlay(id,conf,btn,wrap,e);
  });
}
function _ambStop(e){
  try{
    if(e&&e.master&&e.ctx){
      e.master.gain.setTargetAtTime(0,e.ctx.currentTime,0.33);   // ~1s 淡出后再真正停（v4.5 放缓）
      const s=e.src,m=e.master;
      setTimeout(()=>{try{s.stop();}catch(_){ }try{m.disconnect();}catch(_){ }},1100);
    }else if(e&&e.audio){
      const a=e.audio;
      const step=()=>{try{a.volume=Math.max(0,a.volume-0.09);}catch(_){ }
        if(a.volume>0.02)setTimeout(step,50);else{try{a.pause();a.src='';}catch(_){ }}};
      step();
    }
  }catch(_){}
}
function _ambLegacyPlay(id,conf,btn,wrap,e){
  const audio=new Audio('/api/ambient/file/'+encodeURIComponent(conf.name));
  audio.loop=true;audio.volume=0;
  try{audio.preservesPitch=false;audio.mozPreservesPitch=false;audio.webkitPreservesPitch=false;
      audio.playbackRate=Math.max(0.5,Math.min(1.5,e.p.rate/100));}catch(_){}
  e.audio=audio;e.legacy=true;e.loading=false;
  audio.play().then(()=>{
    const target=Math.max(0,Math.min(1,e.p.vol/100));
    const step=()=>{if(ambientEls[id]!==e)return;try{audio.volume=Math.min(target,audio.volume+0.06);}catch(_){return;}
      if(audio.volume<target-0.01)setTimeout(step,60);};
    step();
  }).catch(()=>{
    delete ambientEls[id];
    if(btn)btn.classList.remove('on');
    if(wrap){wrap.classList.remove('playing','open');const s=wrap.querySelector('.amb-vol');if(s)s.disabled=true;}
    if(typeof toast==='function')toast('播放失败，点一下页面再试');
  });
}
function setAmbItemVol(id,v){
  const e=ambientEls[id];if(!e)return;
  e.p.vol=parseInt(v)||0;
  const vol=Math.max(0,Math.min(1,v/100));
  if(e.master&&e.ctx)e.master.gain.setTargetAtTime(vol,e.ctx.currentTime,0.08);
  else if(e.audio){try{e.audio.volume=vol;}catch(_){}}
}
function setAmbItemRate(id,v){
  const e=ambientEls[id];if(!e)return;
  e.p.rate=parseInt(v)||100;
  const rate=Math.max(0.5,Math.min(1.5,(v||100)/100));
  if(e.src&&e.ctx)e.src.playbackRate.setTargetAtTime(rate,e.ctx.currentTime,0.06);   // 采样级平滑，慢速不再一卡一卡
  else if(e.audio){try{e.audio.playbackRate=rate;}catch(_){}}
}
function setAmbItemMuffle(id,v){
  const e=ambientEls[id];if(!e)return;
  e.p.muffle=parseInt(v)||0;
  if(e.filter&&e.ctx)e.filter.frequency.setTargetAtTime(_ambCutoff(v),e.ctx.currentTime,0.06);
}
function setAmbItemReverb(id,v){
  const e=ambientEls[id];if(!e)return;
  e.p.reverb=parseInt(v)||0;
  const t=Math.max(0,Math.min(1,(v||0)/100));
  if(e.ctx){
    if(e.wet)e.wet.gain.setTargetAtTime(1.15*t,e.ctx.currentTime,0.08);
    if(e.dry)e.dry.gain.setTargetAtTime(1-0.35*t,e.ctx.currentTime,0.08);
  }
}
let _reverbBuf=null;
function _reverbIR(ctx){
  // 合成一段衰减噪声作为混响脉冲响应（约 2.2s 尾音），生成一次后缓存复用
  if(_reverbBuf)return _reverbBuf;
  const rate=ctx.sampleRate, len=Math.floor(rate*2.2);
  const buf=ctx.createBuffer(2,len,rate);
  for(let ch=0;ch<2;ch++){
    const d=buf.getChannelData(ch);
    for(let i=0;i<len;i++){d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6);}
  }
  _reverbBuf=buf; return buf;
}
function stopAllAmbient(){
  Object.keys(ambientEls).forEach(id=>{
    const e=ambientEls[id];delete ambientEls[id];
    const btn=document.querySelector(`[data-amb="${id}"]`);if(btn)btn.classList.remove('on');
    const wrap=document.querySelector(`[data-row="${id}"]`);
    if(wrap){wrap.classList.remove('playing','open');const s=wrap.querySelector('.amb-vol');if(s)s.disabled=true;}
    _ambStop(e);
  });
}
// 兼容旧的全局音量调用（若别处还引用）

// ===== 白噪音「常用组合」：整套(哪些音+各自音量/快慢/远近/空间)存进 reading_prefs(服务端) =====
// 好处：能存多套一键切换；且因为存服务端，网页/平板/手机开同一个库时组合是同步的。
function escAmb(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function getAmbPresets(){try{return PREFS.ambientPresets?JSON.parse(PREFS.ambientPresets):[];}catch(e){return [];}}
function _saveAmbPresets(list){PREFS.ambientPresets=JSON.stringify(list);savePref('ambientPresets',PREFS.ambientPresets);}
function renderAmbPresets(){
  const box=document.getElementById('amb-presets');if(!box)return;
  const list=getAmbPresets();
  const chips=list.map((p,i)=>`<span class="amb-pchip" onclick="applyAmbPreset(${i})" title="点一下应用这套组合">${escAmb(p.name)}<button class="apc-del" onclick="event.stopPropagation();delAmbPreset(${i})" title="删除">×</button></span>`).join('');
  box.innerHTML=`<div class="amb-plabel">我的组合</div><div class="amb-prow">${chips}<button class="amb-psave" onclick="saveCurrentAmbPreset()" title="把当前播放的存成组合">＋</button></div>`;
}
function _snapshotAmb(){   // 抓当前在播的每个音 + 它四个滑块的值
  const out=[];
  Object.keys(ambientEls).forEach(id=>{
    const wrap=document.querySelector(`[data-row="${id}"]`);if(!wrap)return;
    const gv=(sel,def)=>{const el=wrap.querySelector(sel);return el?(parseInt(el.value)||0):def;};
    out.push({id,vol:gv('.amb-vol',50),rate:gv('.amb-rate',100),muffle:gv('.amb-muffle',0),reverb:gv('.amb-reverb',0)});
  });
  return out;
}
function saveCurrentAmbPreset(){
  const sounds=_snapshotAmb();
  if(!sounds.length){if(typeof toast==='function')toast('先开一两个声音再存');return;}
  const list=getAmbPresets();
  const name=prompt('给这套组合起个名字：','组合'+(list.length+1));
  if(name===null)return;
  list.push({name:(name.trim()||('组合'+(list.length+1))),sounds});
  _saveAmbPresets(list);renderAmbPresets();
  if(typeof toast==='function')toast('已存组合');
}
function delAmbPreset(i){
  const list=getAmbPresets();if(i<0||i>=list.length)return;
  list.splice(i,1);_saveAmbPresets(list);renderAmbPresets();
}
function applyAmbPreset(i){
  const p=getAmbPresets()[i];if(!p)return;
  stopAllAmbient();                                  // 先清场（会淡出，delete 同步生效）
  setTimeout(()=>{                                    // 隔一帧再逐个起，避开淡出尾巴
    (p.sounds||[]).forEach(s=>{
      const wrap=document.querySelector(`[data-row="${s.id}"]`);
      if(!wrap)return;                                // 该音频已不在（换了库/删了文件）→ 跳过
      const set=(sel,v)=>{const el=wrap.querySelector(sel);if(el)el.value=v;};
      set('.amb-vol',s.vol);set('.amb-rate',s.rate||100);set('.amb-muffle',s.muffle||0);set('.amb-reverb',s.reverb||0);
      if(!ambientEls[s.id])toggleAmb(s.id);           // 起播：toggleAmb 会读上面设好的滑块值
    });
  },60);
  if(typeof toast==='function')toast('已切到「'+p.name+'」');
}

// ============ epub ============
function ensureEpubLib(){
  return new Promise((resolve,reject)=>{
    if(typeof ePub!=='undefined')return resolve();
    const s=document.createElement('script');
    s.src='https://cdnjs.cloudflare.com/ajax/libs/epub.js/0.3.93/epub.min.js';
    s.onload=()=>resolve();
    s.onerror=()=>reject(new Error('epub.js 加载失败（需要联网）'));
    document.head.appendChild(s);
    setTimeout(()=>{if(typeof ePub==='undefined')reject(new Error('epub.js 加载超时'));},12000);
  });
}
async function loadEpub(){
  document.getElementById('scroll-view').style.display='none';
  const pv=document.getElementById('page-view');pv.classList.add('active');pv.style.display='block';
  pv.innerHTML='<div class="reader-note">正在准备 EPUB 阅读组件…</div>';
  try{await ensureEpubLib();}
  catch(e){pv.innerHTML=`<div class="reader-note">${escapeHtml(e.message)}<br>EPUB 需要联网加载渲染组件。<a class="rn-btn" href="/">返回书房</a></div>`;return;}
  pv.innerHTML='<div id="epub-area" style="height:100%"></div>';
  try{
    epubBook=ePub('/api/book/'+bookId+'/file');
    epubRend=epubBook.renderTo('epub-area',{width:'100%',height:'100%',flow:'paginated',spread:'none'});
    const skin=SKINS.find(s=>s.id===(PREFS.skin||'paper'))||SKINS[0];
    epubRend.themes.default({body:{'font-family':getComputedStyle(document.documentElement).getPropertyValue('--font'),'font-size':(PREFS.fontsize||19)+'px','line-height':PREFS.lineheight||'2','color':skin.ink,'background':skin.paper,'padding':'20px'}});
    const prog=await (await fetch('/api/book/'+bookId+'/progress')).json();
    if(prog.position&&typeof prog.position==='string'&&prog.position.startsWith('epubcfi'))await epubRend.display(prog.position);else await epubRend.display();
    epubRend.on('relocated',loc=>{curPos=loc.start.cfi;document.getElementById('page-num').textContent=Math.round((loc.start.percentage||0)*100)+'%';clearTimeout(window._st);window._st=setTimeout(()=>{fetch('/api/book/'+bookId+'/progress',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({position:loc.start.cfi,percentage:Math.round((loc.start.percentage||0)*100)})});recordDiary();},1200);});
    document.getElementById('tap-left').onclick=()=>epubRend.prev();
    document.getElementById('tap-right').onclick=()=>epubRend.next();
    document.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')epubRend.prev();if(e.key==='ArrowRight')epubRend.next();});
  }catch(e){pv.innerHTML='<div class="reader-note">epub 加载失败: '+escapeHtml(e.message||'')+'<br><a class="rn-btn" href="/">返回书房</a></div>';}
}
async function loadPdf(){
  document.getElementById('scroll-view').style.display='none';
  const pv=document.getElementById('page-view');pv.classList.add('active');pv.style.display='block';
  // v4.6.2：PDF 用浏览器自带的查看器渲染（iframe 嵌入原始文件）——不经过自定义分页/主题/划线系统，
  // 排版、翻页手势都是浏览器 PDF 阅读器自己的一套，读得进去，但换肤/划线/自动记进度这些接不上，
  // 是目前最省事、不用额外依赖、离线也能用的方案。想要更深的功能得接一个专门的 PDF 渲染库，先不做。
  pv.innerHTML='<iframe id="pdf-frame" title="'+escapeHtml(bookTitle)+'" src="/api/book/'+bookId+'/file" '+
    'style="width:100%;height:100%;border:none;background:#525659"></iframe>';
  const pn=document.getElementById('page-num');if(pn)pn.textContent='PDF';
  const tl=document.getElementById('tap-left'),tr=document.getElementById('tap-right');
  if(tl)tl.onclick=null;if(tr)tr.onclick=null;
}

// ============ Quill 形象（和书房选的同步）============
const QUILL_GLYPHS={
  feather:'<path d="M21 1.99669C6 1.99669 4 15.9967 3 21.9967C3.66667 21.9967 4.33275 21.9967 4.99824 21.9967C5.66421 18.6636 7.33146 16.8303 10 16.4967C14 15.9967 17 12.4967 18 9.49669L16.5 8.49669C16.8333 8.16336 17.1667 7.83002 17.5 7.49669C18.5 6.49669 19.5042 4.99669 21 1.99669Z"/>',
  sprout:'<path d="M20.998 3V5C20.998 8.86599 17.864 12 13.998 12H12.998V13H17.998V20C17.998 21.1046 17.1026 22 15.998 22H7.99805C6.89348 22 5.99805 21.1046 5.99805 20V13H10.998V10C10.998 6.13401 14.1321 3 17.998 3H20.998ZM5.49805 2C8.02667 2 10.263 3.25136 11.6216 5.1686C10.6026 6.51084 9.99805 8.18482 9.99805 10V11H9.49805C5.35591 11 1.99805 7.64214 1.99805 3.5V2H5.49805Z"/>',
  sparkle:'<path d="M17.0007 1.20825 18.3195 3.68108 20.7923 4.99992 18.3195 6.31876 17.0007 8.79159 15.6818 6.31876 13.209 4.99992 15.6818 3.68108 17.0007 1.20825ZM8.00065 4.33325 10.6673 9.33325 15.6673 11.9999 10.6673 14.6666 8.00065 19.6666 5.33398 14.6666.333984 11.9999 5.33398 9.33325 8.00065 4.33325ZM19.6673 16.3333 18.0007 13.2083 16.334 16.3333 13.209 17.9999 16.334 19.6666 18.0007 22.7916 19.6673 19.6666 22.7923 17.9999 19.6673 16.3333Z"/>',
  leaf:'<path d="M20.998 3V5C20.998 14.6274 15.6255 19 8.99805 19L7.0964 18.9999C7.3079 15.9876 8.24541 14.1648 10.6939 11.9989C11.8979 10.9338 11.7965 10.3189 11.2029 10.6721C7.1193 13.1016 5.09114 16.3862 5.00119 21.6302L4.99805 22H2.99805C2.99805 20.6373 3.11376 19.3997 3.34381 18.2682C3.1133 16.9741 2.99805 15.2176 2.99805 13C2.99805 7.47715 7.4752 3 12.998 3C14.998 3 16.998 4 20.998 3Z"/>',
  moon:'<path d="M11.3807 2.01886C9.91573 3.38768 9 5.3369 9 7.49999C9 11.6421 12.3579 15 16.5 15C18.6631 15 20.6123 14.0843 21.9811 12.6193C21.6613 17.8537 17.3149 22 12 22C6.47715 22 2 17.5228 2 12C2 6.68514 6.14629 2.33869 11.3807 2.01886Z"/>',
  clock:'<g fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 12 8.6 9.4M12 12 15.2 7.6"/></g>',
};
function syncQuill(){
  let av='feather';
  try{av=localStorage.getItem('quill_avatar')||'feather';}catch(e){}
  const g=QUILL_GLYPHS[av]||QUILL_GLYPHS.feather;
  const fab=document.getElementById('quill-fab-icon');if(fab)fab.innerHTML=g;
  try{
    document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(l=>l.href='/static/app-icon-192.png?avatar='+av);
    const f=document.querySelector('link[rel="icon"]');if(f)f.href='/static/app-icon.svg?avatar='+av;
  }catch(e){}
}
// Quill 悬浮球 显示/隐藏（外观设置里切）
function setQuillBall(show, btn){
  const fab=document.getElementById('quill-fab');
  if(fab)fab.classList.toggle('hidden', !show);
  savePref('quillBall', show?'1':'0');
  const on=document.getElementById('quillball-on'), off=document.getElementById('quillball-off');
  if(on)on.classList.toggle('sel', show);
  if(off)off.classList.toggle('sel', !show);
}

// ============ 书桌装扮 ============
async function loadDesk(){
  try{
    const r=await (await fetch('/api/theme/list')).json();
    const s=r.slots||{};
    const L=document.getElementById('desk-left'), R=document.getElementById('desk-right');
    if(s.desk_left){L.style.backgroundImage=`url(${s.desk_left})`;document.body.classList.add('has-desk-l');}
    else{L.style.backgroundImage='';document.body.classList.remove('has-desk-l');}
    if(s.desk_right){R.style.backgroundImage=`url(${s.desk_right})`;document.body.classList.add('has-desk-r');}
    else{R.style.backgroundImage='';document.body.classList.remove('has-desk-r');}
    applyDeskAdjust();
  }catch(e){}
}
// 书房「图片微调」里对书桌左/右调的 位置/缩放/旋转/模糊，存在 localStorage(home_slot_adj)，这里读出来应用
function applyDeskAdjust(){
  let all={};try{const o=JSON.parse(localStorage.getItem('home_slot_adj')||'{}');if(o&&typeof o==='object')all=o;}catch(e){}
  [['desk_left','desk-left','left center','90deg'],['desk_right','desk-right','right center','270deg']].forEach(([k,id,origin,dir])=>{
    const el=document.getElementById(id);if(!el)return;
    const a=Object.assign({x:50,y:50,zoom:100,rot:0,blur:0,feather:0},all[k]||{});
    el.style.backgroundPosition=a.x+'% '+a.y+'%';
    const z=Math.max(0.5,(a.zoom||100)/100);
    el.style.transformOrigin=origin;                       // 以各自贴的边为基准缩放，不往正文里挤
    el.style.transform=(z!==1||a.rot)?`scale(${z}) rotate(${a.rot}deg)`:'';
    const f=[];
    if(a.blur>0)f.push(`blur(${a.blur}px)`);
    if(a.bright!=null&&a.bright!==100)f.push(`brightness(${a.bright}%)`);
    if(a.contrast!=null&&a.contrast!==100)f.push(`contrast(${a.contrast}%)`);
    if(a.sat!=null&&a.sat!==100)f.push(`saturate(${a.sat}%)`);
    if(a.temp)f.push(a.temp>0?`sepia(${Math.min(60,a.temp)}%)`:`hue-rotate(${a.temp}deg)`);
    if(a.fade>0)f.push(`grayscale(${a.fade}%)`);
    el.style.filter=f.join(' ');
    if(a.feather>0){                                       // 羽化=把"向正文淡出"的起点往回收（0=默认从60%开始淡）
      const stop=Math.max(8,78-a.feather);
      const m=`linear-gradient(${dir},#000 ${stop}%,transparent)`;
      el.style.webkitMaskImage=m;el.style.maskImage=m;
    }else{el.style.webkitMaskImage='';el.style.maskImage='';}
  });
}
// 书房页那边一边拖一边调时，已打开的阅读页跟着实时变（storage 事件跨标签页广播）
window.addEventListener('storage',e=>{if(e&&e.key==='home_slot_adj')applyDeskAdjust();});

// ============ 工具 ============
function escapeHtml(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function toast(msg){
  let t=document.getElementById('_toast');
  if(!t){t=document.createElement('div');t.id='_toast';t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(42,34,24,.92);color:#f0e8d6;padding:10px 20px;border-radius:20px;font-size:13px;z-index:99;transition:opacity .3s';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(window._tt);window._tt=setTimeout(()=>t.style.opacity='0',1800);
}

// ====== 拖动：声音小窗 + Quill 入口都能四处拖 ======
function makeDraggable(el, handle, onTap){
  if(!el||!handle)return;
  let sx,sy,ox,oy,moved=false,dragging=false;
  const TH=5;
  function move(e){
    if(!dragging)return;
    const pt=e.touches?e.touches[0]:e;
    const dx=pt.clientX-sx, dy=pt.clientY-sy;
    if(Math.abs(dx)+Math.abs(dy)>TH)moved=true;
    if(moved){
      if(e.cancelable)e.preventDefault();
      const w=el.offsetWidth,h=el.offsetHeight;
      let nx=Math.max(4,Math.min(window.innerWidth-w-4, ox+dx));
      let ny=Math.max(4,Math.min(window.innerHeight-h-4, oy+dy));
      el.style.left=nx+'px';el.style.top=ny+'px';
    }
  }
  function up(){
    dragging=false;
    document.removeEventListener('mousemove',move);document.removeEventListener('mouseup',up);
    document.removeEventListener('touchmove',move);document.removeEventListener('touchend',up);
    if(!moved&&onTap)onTap();
  }
  function down(e){
    if(e.target.closest && e.target.closest('button:not(#quill-fab), .amb-close, .amb-mute, input, a, select'))return; // 点里面的按钮不拖
    const pt=e.touches?e.touches[0]:e;
    const r=el.getBoundingClientRect();
    sx=pt.clientX;sy=pt.clientY;ox=r.left;oy=r.top;moved=false;dragging=true;
    el.style.position='fixed';el.style.left=ox+'px';el.style.top=oy+'px';el.style.right='auto';el.style.bottom='auto';el.style.margin='0';
    document.addEventListener('mousemove',move);document.addEventListener('mouseup',up);
    document.addEventListener('touchmove',move,{passive:false});document.addEventListener('touchend',up);
  }
  handle.addEventListener('mousedown',down);
  handle.addEventListener('touchstart',down,{passive:true});
}
function initReaderDrag(){
  const amb=document.getElementById('ambient-panel'), ambH=document.getElementById('amb-head');
  if(amb&&ambH)makeDraggable(amb,ambH);
  const fab=document.getElementById('quill-fab');
  if(fab){
    makeDraggable(fab,fab,function(){toggleDrawer('ai');});
    fab.addEventListener('dblclick',function(e){e.preventDefault();e.stopPropagation();openModelSwitcher();}); // 双击 Quill：快速切模型
  }
  initProgressSeek();
}
function initProgressSeek(){
  const bar=document.getElementById('read-progress'), fill=document.getElementById('read-progress-fill');
  if(!bar||!fill)return;
  let seeking=false, pend=0;
  const fracOf=x=>Math.max(0,Math.min(1,x/(window.innerWidth||document.documentElement.clientWidth)));
  function preview(x){pend=fracOf(x);fill.style.transition='none';fill.style.width=(pend*100).toFixed(1)+'%';}
  bar.addEventListener('pointerdown',function(e){seeking=true;try{bar.setPointerCapture(e.pointerId);}catch(_){}preview(e.clientX);e.preventDefault();});
  bar.addEventListener('pointermove',function(e){if(seeking)preview(e.clientX);});
  bar.addEventListener('pointerup',function(e){if(!seeking)return;seeking=false;fill.style.transition='';const pos=Math.round(pend*(totalChars||0));if(typeof jumpTo==='function')jumpTo(pos);});
}
async function openModelSwitcher(){
  let prof=[];
  try{prof=((await (await fetch('/api/settings/ai-profiles')).json()).profiles)||[];}catch(e){}
  let host=document.getElementById('model-switch');
  if(!host){host=document.createElement('div');host.id='model-switch';host.className='model-switch';document.body.appendChild(host);}
  const foot='<div class="ms-foot"><button onclick="closeModelSwitch()">关闭</button></div>';
  if(!prof.length){
    host.innerHTML='<div class="ms-head">切换模型</div><div class="ms-empty">还没有配置档。去设置页测试并保存接口后，这里就能一键切换。</div>'+foot;
  }else{
    host.innerHTML='<div class="ms-head">切换模型</div>'+prof.map(p=>`<button class="ms-item${p.active?' on':''}" onclick="activateModel('${(p.name||'').replace(/'/g,"\\'")}')"><b>${escapeHtml(p.name||'')}</b><span>${escapeHtml(p.model||'')}</span>${p.active?'<i>当前</i>':''}</button>`).join('')+foot;
  }
  host.classList.add('show');
}
function closeModelSwitch(){const h=document.getElementById('model-switch');if(h)h.classList.remove('show');}
async function activateModel(name){
  try{await fetch('/api/settings/ai-profiles/activate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});if(typeof toast==='function')toast('已切到「'+name+'」');}catch(e){}
  closeModelSwitch();
}
if(document.readyState!=='loading'){initReaderDrag();bindProgressSeek();bindAiDrag();}else document.addEventListener('DOMContentLoaded',()=>{initReaderDrag();bindProgressSeek();bindAiDrag();});
// 屏幕尺寸/横竖屏变化 → 重新按新尺寸分页（翻页模式），避免切页错位、字被切
let _reflowTimer=null;
window.addEventListener('resize',()=>{
  if(!bookText)return;
  // 窗口尺寸变了：翻页按新尺寸重新分页并回到当前页；滚动随窗口自动重排，回到当前阅读位置即可。
  clearTimeout(_reflowTimer);
  _reflowTimer=setTimeout(()=>{
    try{ const p=curPos; scrollToOffset(p); }catch(e){}
  },200);
});
// 页宽随屏幕自适应：宽屏用窗口的 ~62%（夹在 680~960 之间，太长不利于阅读），窄屏交回 CSS 的 100%。
// 解决"页面只占屏幕一半、不适配大屏"。


// 心跳：让独立 exe 在浏览器全部关闭后自动退出进程、释放端口（dev 模式无此接口，fetch 失败被忽略，无害）。
// 切回前台立刻补一次，配合后端 90s 宽限，手机锁屏/切后台不会被误杀。
(function(){try{var hb=function(){fetch("/api/heartbeat").catch(function(){});};hb();setInterval(hb,20000);document.addEventListener("visibilitychange",function(){if(!document.hidden)hb();});}catch(e){}})();

