
// ===== 版本标记：F12 控制台看到这行 = 加载的是新版翻页(v21 交叉淡入)；看不到就是在跑旧 exe 或浏览器缓存 =====
console.log('%c MyLibrary reader %c build 2026-06-27 · 翻页=交叉淡入(v21) ','background:#16a34a;color:#fff;border-radius:3px 0 0 3px;padding:2px 5px','background:#052e16;color:#bbf7d0;border-radius:0 3px 3px 0;padding:2px 7px');
window.__READER_BUILD='2026-06-27-flip-crossfade-v21';

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
  paper:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence baseFrequency=\'0.9\' numOctaves=\'2\'/%3E%3C/filter%3E%3Crect width=\'100\' height=\'100\' filter=\'url(%23n)\' opacity=\'0.04\'/%3E%3C/svg%3E")',
  linen:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'20\' height=\'20\'%3E%3Crect width=\'20\' height=\'20\' fill=\'none\'/%3E%3Cpath d=\'M0 10h20M10 0v20\' stroke=\'%23000\' stroke-width=\'0.3\' opacity=\'0.05\'/%3E%3C/svg%3E")',
  grain:'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\'%3E%3Cfilter id=\'g\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.6\' numOctaves=\'3\'/%3E%3C/filter%3E%3Crect width=\'60\' height=\'60\' filter=\'url(%23g)\' opacity=\'0.06\'/%3E%3C/svg%3E")',
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
async function loadPrefs(){
  try{PREFS=await (await fetch('/api/reading-prefs')).json();}catch(e){PREFS={};}
  if(PREFS.skin)applySkin(PREFS.skin);
  if(PREFS.fontsize)setFontSize(PREFS.fontsize,true);
  if(PREFS.lineheight)document.documentElement.style.setProperty('--lineheight',PREFS.lineheight);
  if(PREFS.font)document.documentElement.style.setProperty('--font',FONTS[PREFS.font]||FONTS.serif);
  if(PREFS.texture)document.documentElement.style.setProperty('--texture',TEXTURES[PREFS.texture]||'none');
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
async function savePref(k,v){PREFS[k]=v;try{await fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({[k]:v})});}catch(e){}}

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

// 翻页模式：用已有的 paginate()（按行边界测高分页）把整本切成"整页"，每页一个 .page-sec（视口可读高）。
// 整本一次性进同一条滚动容器 → ① 点左右 = 滚到上/下一整页(吸附)，是真·一页页翻；
//                              ② 划线划到页底、手指拖到屏幕下沿时，正文自动续滚到下一页，可接着划到合适位置（跨页划线）。
function sizePageSecs(){
  const sv=document.getElementById('scroll-view'); if(!sv)return;
  const cs=getComputedStyle(sv);
  const padT=parseFloat(cs.paddingTop)||0, padB=parseFloat(cs.paddingBottom)||0;
  const H=Math.max(240,(sv.clientHeight||window.innerHeight||600)-padT-padB);
  document.documentElement.style.setProperty('--pagesec-h', H+'px');  // 每页正好一屏可读高
  sv.style.scrollPaddingTop=padT+'px';                                // 吸附停靠点对齐到工具栏下沿
}
function renderPagedSections(){
  if(bookExt==='epub'||!bookText)return;   // epub 不分页
  paginate();                               // 复用按行测高分页：断点都在换行处，整页干净不切行
  sizePageSecs();
  const sc=document.getElementById('scroll-content');
  sc.innerHTML=(pages||[]).map(p=>`<section class="page-sec" data-off="${p[0]}">${renderParas(p[1],p[0],true)}</section>`).join('')
            ||'<section class="page-sec" data-off="0"></section>';
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
}

// ============ 翻页：分页 ============
function isNarrow(){return (window.innerWidth||999)<=600 || ('ontouchstart' in window && (window.innerWidth||999)<=820);}
function paginate(){
  if(!bookText){pages=[[0,'']];curPage=0;return;}
  const cs=getComputedStyle(document.documentElement);
  setAdaptivePageWidth();   // 先按屏幕定页宽（宽屏更宽、不再只占一半），再量尺寸分页
  const pwRaw=(cs.getPropertyValue('--pagewidth')||'680').trim();
  const fs=parseInt(cs.getPropertyValue('--fontsize'))||19;
  const lh=parseFloat(cs.getPropertyValue('--lineheight'))||2;
  const font=cs.getPropertyValue('--font')||'serif';
  // 真实页面盒子的可用宽高。#page-view 始终是满屏容器(100vh)、分页前就已布局好，最可靠。
  // .page-sheet 铺满它，只差内边距（窄屏 46/18/56，宽屏 54/28/64）。
  let availW, availH;
  const pv=document.getElementById('page-view');
  const narrow=(typeof isNarrow==='function')?isNarrow():(window.innerWidth<=600);
  let padT=narrow?46:54, padB=narrow?56:64, padL=narrow?18:28, padR=padL;
  const sheet=document.querySelector('.page-sheet');
  if(sheet){
    const scs=getComputedStyle(sheet);
    padT=parseFloat(scs.paddingTop)||padT; padB=parseFloat(scs.paddingBottom)||padB;
    padL=parseFloat(scs.paddingLeft)||padL; padR=parseFloat(scs.paddingRight)||padR;
  }
  const pr=pv?pv.getBoundingClientRect():null;
  const boxH=(pr&&pr.height>200)?pr.height:window.innerHeight;
  const fullW=(pr&&pr.width>120)?pr.width:window.innerWidth;
  // 实际页面盒子最宽就是 --pagewidth(默认680px)、居中；窄屏是 100% 即满宽不截断。
  // 宽屏上 page-view 是满窗的，必须按 pagewidth 截断，否则会以为每行能放更多字 → 排进去后超出真实页宽、底部被切。
  const pwPx = pwRaw.includes('%') ? fullW : (parseInt(pwRaw)||680);
  const boxW=Math.min(fullW, pwPx);
  availW=boxW-padL-padR;
  availH=boxH-padT-padB;
  // 卷曲翻页(StPageFlip)的 flip-book 现在也用满高(=窗口高)，内边距与 page-sheet 一致(54/64)，
  // 所以两条路高度一样，不再为了迁就翻页库而把每页压矮 → 修"页面底部空一大块"。
  const flipAvailH=boxH-padT-padB;
  if(flipAvailH>160)availH=Math.min(availH,flipAvailH);
  if(availW<120)availW=Math.max(120,window.innerWidth-44);
  if(availH<200)availH=Math.max(280,window.innerHeight-200);
  // 留一行页码的高度，宁可少放一点也不裁掉最后一行
  availH=Math.max(160,availH-fs*lh*1.1);
  // 隐藏探针：和正文一模一样的排版，用来量"放到第几个字会超出这一页的高度"
  let probe=document.getElementById('page-measure');
  if(!probe){probe=document.createElement('div');probe.id='page-measure';document.body.appendChild(probe);}
  probe.style.cssText=`position:absolute;left:-99999px;top:0;visibility:hidden;`+
    `width:${availW}px;font-size:${fs}px;line-height:${lh};font-family:${font};`+
    `white-space:pre-wrap;word-break:break-word;overflow-wrap:break-word;box-sizing:content-box;`;
  const N=bookText.length;
  const est=Math.max(160,Math.floor((availW/fs)*Math.floor(availH/(fs*lh))));
  pages=[];
  let i=0,guard=0;
  while(i<N && ++guard<20000){
    let end=Math.min(N,i+Math.ceil(est*1.35));
    probe.innerHTML=renderParas(bookText.slice(i,end),0,false);
    // 太高就往回收，优先收到一个换行处（不把句子/字切一半）
    while(end>i+24 && probe.scrollHeight>availH){
      let cut=end-Math.max(8,Math.ceil((end-i)*0.08));
      const nl=bookText.lastIndexOf('\n',end-1);
      if(nl>i+8 && nl<end-1 && nl>=cut-Math.ceil(est*0.5))cut=nl+1; // 附近有换行就断在换行
      end=Math.max(i+24,cut);
      probe.innerHTML=renderParas(bookText.slice(i,end),0,false);
    }
    // 没超高但还没到结尾：尝试再多塞到下一个换行，减少底部空白
    if(end<N && probe.scrollHeight<availH){
      let grow=bookText.indexOf('\n',end);
      if(grow>=0 && grow<end+est*0.5){
        probe.innerHTML=renderParas(bookText.slice(i,grow+1),0,false);
        if(probe.scrollHeight<=availH)end=grow+1;
      }
    }
    pages.push([i,bookText.slice(i,end)]);
    i=end;
  }
  if(pages.length===0)pages=[[0,'']];
  // 当前页定位到 curPos 所在的那一页（用真实页起点，不再按等分估）
  let cp=0; for(let k=0;k<pages.length;k++){if(pages[k][0]<=curPos)cp=k;else break;}
  curPage=cp;
}

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
function _initFlip_stpageflip_DISABLED(){
  const container=document.getElementById('flip-book');
  if(typeof St==='undefined'||!St.PageFlip||pages.length>FLIP_MAX_PAGES){
    container.style.display='none';
    document.getElementById('page-stack').style.display='block';
    setTapZonesForFlip(false);
    showPageSimple(curPage);
    return;
  }
  container.style.display='';
  document.getElementById('page-stack').style.display='none';

  const pv=document.getElementById('page-view');
  let w=Math.min(window.innerWidth,parseInt(getComputedStyle(document.documentElement).getPropertyValue('--pagewidth'))||680);
  let h=window.innerHeight-100;
  // 兜底：如果拿到的高度异常（容器还没布局好），用窗口高度
  if(h<200)h=Math.max(400,window.innerHeight-100);
  if(w<200)w=Math.min(680,window.innerWidth);
  // 关键：把书的容器限定成"单页宽、居中"，并把单页最小宽设得够大——这样容器里塞不下两页，
  // StPageFlip 就只能单页竖版，不会再在宽屏上摊成左右两页（那正是排版怪、没法往前翻的根源）。
  container.style.width=w+'px';
  container.style.maxWidth='100%';
  const minW=Math.max(280,Math.floor(w*0.72));  // 两页需 2*minW > 容器宽(w) → 必然单页

  // 生成所有页的 DOM（StPageFlip 内部做虚拟化，只渲染附近页）
  const pageEls=pages.map((p,i)=>{
    const div=document.createElement('div');
    div.className='flip-page';
    div.dataset.density=(i===0||i===pages.length-1)?'hard':'soft';
    div.innerHTML='<div class="flip-page-content" data-off="'+p[0]+'">'+applyHighlights(p[1],p[0])+'<div class="flip-pageno">'+(i+1)+'</div></div>';
    return div;
  });
  pageEls.forEach(el=>container.appendChild(el));

  pageFlip=new St.PageFlip(container,{
    width:Math.max(280,w),
    height:h,
    size:'stretch',
    minWidth:minW,maxWidth:Math.max(minW+1,w),minHeight:300,maxHeight:1500,
    maxShadowOpacity:0.5,
    showCover:false,
    usePortrait:true,
    mobileScrollSupport:false,
    drawShadow:true,
    flippingTime:650,
    swipeDistance:30,
    useMouseEvents:false,   // 关掉鼠标拖拽翻页：书页不再"跟着鼠标走"，文字可正常选中划重点
    clickEventForward:false,
    disableFlipByClick:true, // 点书页不自动翻（翻页交给左右点击区/按键，避免和选词冲突）
  });
  pageFlip.loadFromHTML(container.querySelectorAll('.flip-page'));
  // 跳到当前页
  try{pageFlip.turnToPage(curPage);}catch(e){}
  // StPageFlip 接管拖拽翻页：让侧边点击区不挡住拖动手势，只保留中间区呼出工具栏
  setTapZonesForFlip(true);
  // 翻页事件：同步进度
  pageFlip.on('flip',(e)=>{
    curPage=e.data;
    if(pages[curPage]){curPos=pages[curPage][0];saveProgress();recordDiary();}
    updatePageNum();
    playPageSound();
  });
  updatePageNum();
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
function showPage(n){
  // StPageFlip 在用就用它翻，否则简单翻页
  if(pageFlip){try{pageFlip.turnToPage(n);curPage=n;if(pages[n])curPos=pages[n][0];updatePageNum();return;}catch(e){}}
  showPageSimple(n);
}

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
function flipPage(dir){
  if(!pages.length)return;
  // StPageFlip 在用：交给它翻（带卷曲动画，音效由 flip 事件触发）。
  if(pageFlip){
    try{
      if(dir>0)pageFlip.flipNext();
      else if(dir<0)pageFlip.flipPrev();
    }catch(e){}
    return;   // 卷曲翻页在用时就到此为止——不要再走下面的内置回退，那条路写进的 page-stack 此刻是隐藏的，会"翻了却一片空白"。
  }
  // 没有库时回退到内置 CSS 3D 翻页：单页翻，前后都有立体翻折动画
  const next=curPage+dir;
  if(next<0||next>=pages.length)return;
  curPage=next;
  if(dir!==0)playPageSound();
  showPageSimple(next,dir);
}
// 翻页音效（设置里可关）
let pageSoundOn=true,_pageAudio=null,_pageAudioStop=null,pageVol=0.7;
function playPageSound(){
  if(!pageSoundOn)return;
  try{
    if(!_pageAudio){_pageAudio=new Audio('/api/sfx/pageturn');}
    _pageAudio.volume=pageVol;
    _pageAudio.currentTime=0;
    _pageAudio.play().catch(()=>{});
    // 让这段翻书声基本放完（之前 420ms 太短，几乎听不到）；最多 1.6s 防异常长音
    clearTimeout(_pageAudioStop);_pageAudioStop=setTimeout(()=>{try{_pageAudio.pause();}catch(e){}},1600);
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
// 滚动到某字符偏移所在的块（直接设 scrollTop：翻页模式 overflow:hidden 下 scrollIntoView 可能不滚，这样两种模式都可靠）
function scrollToOffset(pos){
  const sv=document.getElementById('scroll-view');
  const blocks=document.getElementById('scroll-content').children;
  if(!sv||!blocks.length||blocks[0].dataset.off===undefined)return;
  let lo=0,hi=blocks.length-1,ans=0;
  while(lo<=hi){const mid=(lo+hi)>>1;const o=parseInt(blocks[mid].dataset.off)||0;if(o<=pos){ans=mid;lo=mid+1;}else hi=mid-1;}
  const b=blocks[ans];
  const top=b.getBoundingClientRect().top - sv.getBoundingClientRect().top + sv.scrollTop;
  sv.scrollTop=Math.max(0,Math.min(top, Math.max(0,sv.scrollHeight-sv.clientHeight)));
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
function readerPointerMove(e){
  if(_tapDown && (Math.abs(e.clientX-_tapDown.x)>8||Math.abs(e.clientY-_tapDown.y)>8))_tapDown.moved=true;
  // 划线时拖到屏幕上/下边缘 → 自动滚动，让选择一直往下续 → 翻页模式也能跨页连续划线（两种模式现在都是滚动容器）
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
  if(_selDuringTap)return;
  const sel=window.getSelection();
  if(sel && sel.toString().trim())return;
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
function flashPageTurn(){
  const sc=document.getElementById('scroll-content'); if(!sc)return;
  sc.classList.remove('pgflip'); void sc.offsetWidth; sc.classList.add('pgflip');
}
function closeAll(){
  document.querySelectorAll('.panel,.ai-drawer,.list-drawer,.ambient-panel').forEach(e=>e.classList.remove('show'));
  document.getElementById('overlay').classList.remove('show');
}

// ============ 模式切换 ============
function toggleMode(){
  try{
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
// 字号/行距/字体改变后：必须"重排 + 重建翻页"。
// 之前是 paginate() 后 showPage(curPage) → 在按旧分页建好的卷曲实例上 turnToPage：
// 页子的字符切分还是旧的、而每页高度固定，字号一放大内容就溢出被裁 → "放大后字全没了"。
// 改成重排后用新分页重建。关键：重建必须等布局稳定(双 rAF)再做，和首次建翻页(loadBook 里)一样。
// 同步重建时 StPageFlip 会在容器刚被销毁、还没回流的瞬间量到 0 宽/0 高 → 整页空白(就是"放大后没字")。
// 字号是滑块 oninput 会连发，这里防抖到停手后再重建，避免每跳一格就销毁/重建一次卷曲实例。
let _repagTimer=null;
function rebuildFlipDeferred(){
  // 等两帧让布局落定再建，建完再核一眼当前页是不是真渲染出了文字，空了就再补建一次（兜底瞬时量错尺寸）
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    try{initFlip();}catch(e){}
    setTimeout(()=>{
      try{
        if(mode!=='page'||!pages.length)return;
        if(flipHasText())return;
        initFlip();   // 还空：再补建一次
        setTimeout(()=>{
          try{
            if(mode!=='page'||!pages.length||flipHasText())return;
            // 仍然空白——最后的保险：软刷新一次页面。阅读进度一直在存，重载后会自动回到当前位置；
            // 首次建翻页(loadBook)那条路是确定能正常显示的，所以重载后不会再空。
            // 用 sessionStorage 记一个时间戳防止反复重载成死循环（8 秒内只允许自动重载一次）。
            let last=0; try{last=parseInt(sessionStorage.getItem('mylib_reload_guard')||'0',10)||0;}catch(e){}
            if(Date.now()-last>8000){
              try{sessionStorage.setItem('mylib_reload_guard',String(Date.now()));}catch(e){}
              location.reload();
            }
          }catch(e){}
        },140);
      }catch(e){}
    },80);
  }));
}
// 当前是否真有正文渲染出来（卷曲页或回退的静态页都算）
function flipHasText(){
  try{
    const c=document.getElementById('flip-book');
    if(c && c.querySelector('.flip-page-content') && c.innerText && c.innerText.replace(/\s/g,'').length>0)return true;
    const s=document.getElementById('page-stack');
    if(s && s.style.display!=='none' && s.innerText && s.innerText.replace(/\s/g,'').length>0)return true;
  }catch(e){}
  return false;
}
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
    // 浮在选区旁边（不再固定停靠在屏幕底部）：默认放选区上方，离顶太近就放下方，避开系统“拷贝”菜单
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
  const toc=buildToc(bookText);
  body.innerHTML=toc.length
    ? toc.map(c=>`<div class="list-item" onclick="jumpTo(${c.pos})"><div class="li-title">${escapeHtml(c.title)}</div></div>`).join('')
    : '<div class="li-sub" style="padding:10px">这本书没有章节标记，也太短，无法生成目录。</div>';
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
  let html='<div class="note-add-bar"><button class="note-add-btn" onclick="openNoteEditor()">＋ 写笔记</button></div>';
  if(r.notes&&r.notes.length){
    html+='<div class="note-cards">'+r.notes.map(n=>{
      const img=n.image_path?`<img class="note-card-img" src="/api/notes/image/${n.image_path}" alt="">`:'';
      return `<div class="note-card"><span class="note-card-del" onclick="event.stopPropagation();delNote(${n.id})">×</span>${img}${n.title?`<div class="note-card-title">${escapeHtml(n.title)}</div>`:''}<div class="note-card-body" onclick="jumpTo(${n.position})">${escapeHtml(n.content||'')}</div></div>`;
    }).join('')+'</div>';
  }else{
    html+='<div class="li-sub" style="padding:10px">还没有笔记，点上面写一条，可以配图做成手账</div>';
  }
  body.innerHTML=html;
}
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
// 点正文里的划线弹出的小菜单：改颜色 / 写笔记 / 删除（参考 Moon+ 那种就地操作）
function closeHlMenu(){const m=document.getElementById('hl-menu');if(m)m.remove();}
function showHlMenu(id,x,y){
  closeHlMenu();
  const h=highlights.find(v=>v.id===id);if(!h)return;
  const m=document.createElement('div');m.className='hl-menu';m.id='hl-menu';
  const dots=HL_COLORS.map(([c,hex])=>`<span class="hlm-dot${h.color===c?' on':''}" style="background:${hex}" data-c="${c}"></span>`).join('');
  m.innerHTML=`<div class="hlm-colors">${dots}</div>`+
    `<div class="hlm-len"><span data-len="start-out">头扩</span><span data-len="start-in">头缩</span><span data-len="end-in">尾缩</span><span data-len="end-out">尾扩</span></div>`+
    `<div class="hlm-acts"><span data-act="note">笔记</span><span data-act="del">删除</span></div>`;
  document.body.appendChild(m);
  const mw=m.offsetWidth,mh=m.offsetHeight;
  const left=Math.max(8,Math.min((x||window.innerWidth/2)-mw/2, window.innerWidth-mw-8));
  let top=(y||120)-mh-14; if(top<8)top=(y||120)+18;
  m.style.left=left+'px'; m.style.top=top+'px';
  m.addEventListener('pointerdown',ev=>ev.stopPropagation());
  m.addEventListener('click',ev=>{
    const dot=ev.target.closest('.hlm-dot');
    if(dot){setHlColor(id,dot.dataset.c);closeHlMenu();return;}
    const lb=ev.target.closest('[data-len]');
    if(lb){const map={'start-out':['start',-1],'start-in':['start',1],'end-in':['end',-1],'end-out':['end',1]};const mv=map[lb.dataset.len];if(mv)adjustHl(id,mv[0],mv[1]);ev.stopPropagation();return;}
    const act=ev.target.closest('[data-act]');if(!act)return;
    if(act.dataset.act==='note'){closeHlMenu();editHlNote(id);}
    else if(act.dataset.act==='del'){closeHlMenu();fetch('/api/highlights/'+id,{method:'DELETE'});highlights=highlights.filter(v=>v.id!==id);repaintHighlights();}
  });
  setTimeout(()=>document.addEventListener('pointerdown',closeHlMenu,{once:true}),0);
}
// 调划线长度：按句读标点扩/缩某一端（头=起点，尾=终点）。比拖手柄稳，连点可连续调。
function adjustHl(id,edge,dir){
  const h=highlights.find(v=>v.id===id);if(!h)return;
  if(typeof bookText!=='string'||!bookText.length){toast&&toast('正文还没载入完');return;}
  const PUNC=/[。！？；…，、\n.!?;,]/;
  let start=h.start, end=(h.end!=null?h.end:h.start+((h.text&&h.text.length)||0));
  const fwd=(i)=>{while(i<bookText.length&&!PUNC.test(bookText[i]))i++;return Math.min(bookText.length,i+1);};
  const back=(i)=>{i-=1;while(i>0&&!PUNC.test(bookText[i-1]))i--;return Math.max(0,i);};
  if(edge==='end'){ if(dir>0)end=fwd(end); else end=Math.max(start+1,back(end-1)); }
  else            { if(dir<0)start=back(start); else start=Math.min(end-1,fwd(start)); }
  if(end<=start)return;
  h.start=start;h.position=start;h.end=end;h.text=bookText.slice(start,end);
  repaintHighlights();
  fetch('/api/highlights/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({position:start,text:h.text})}).catch(()=>{});
}

function jumpTo(pos){
  closeAll();
  if(bookExt==='epub'&&epubRend&&typeof pos==='string'){epubRend.display(pos);return;}
  curPos=pos;
  scrollToOffset(pos);   // 翻页/滚动都用同一条滚动容器，统一按字符偏移滚到位
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
    el.classList.toggle('failed',failed);
    addMsgActions(el,'bot');
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
  if(role==='bot')h+='<span class="msg-act" onclick="retryMsg(this)" title="用同样的问题重新发送">重试</span>';
  h+='<span class="msg-act" onclick="delMsg(this)" title="删除这条">删除</span>';
  acts.innerHTML=h;el.appendChild(acts);
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

// ============ 环境音（只用本地 _ambient 真实音频）============
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
function buildAmbientUI(){
  fetch('/api/ambient/list').then(r=>r.json()).then(d=>{
    const local=(d.sounds||[]).map(s=>({id:'local_'+s.id,name:s.name,nice:prettyAmbName(s.name),localFile:s.file}));
    window._allAmbients=local;
    const grid=document.getElementById('ambient-grid');
    if(local.length){
      grid.innerHTML=local.map(a=>`
        <div class="amb-item" data-row="${a.id}">
          <button class="amb-btn" data-amb="${a.id}" onclick="toggleAmb('${a.id}')" title="${a.name}">${a.nice}</button>
          <input class="amb-vol" type="range" min="0" max="100" value="50" oninput="setAmbItemVol('${a.id}',this.value)" disabled>
        </div>`).join('')
        +`<button class="amb-stopall" onclick="stopAllAmbient()">全部停止</button>`;
    }else{
      grid.innerHTML='<div style="font-size:13px;color:var(--ui-text);padding:10px;line-height:1.6">还没有环境音。把音频文件（mp3/ogg/m4a）放到项目的 <b>_ambient</b> 文件夹即可，文件名会作为显示名（建议改成「下雨.mp3」这种好认的名字）。</div>';
    }
  }).catch(()=>{
    document.getElementById('ambient-grid').innerHTML='<div style="font-size:13px;color:#999;padding:10px">环境音加载失败</div>';
  });
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
  if(willOpen) p.classList.add('show');              // 原本是关的才打开；原本开的→保持关闭（修复"关不了"）
}
function toggleAmb(id){
  const btn=document.querySelector(`[data-amb="${id}"]`);
  const row=document.querySelector(`[data-row="${id}"]`);
  const slider=row?row.querySelector('.amb-vol'):null;
  // 已在播 → 停掉（立刻删引用，避免快速点两下又开一个）
  if(ambientEls[id]){
    try{ambientEls[id].audio.pause();ambientEls[id].audio.src='';}catch(e){}
    delete ambientEls[id];
    if(btn)btn.classList.remove('on');
    if(slider)slider.disabled=true;
    return;
  }
  const conf=(window._allAmbients||[]).find(a=>a.id===id);
  if(!conf||!conf.localFile)return;
  const vol=slider?(slider.value/100):0.5;
  const audio=new Audio('/api/ambient/file/'+encodeURIComponent(conf.name));
  audio.loop=true;audio.volume=vol;
  // 关键修复：先登记再播，play() 是异步的，先登记才能再点一次就停
  ambientEls[id]={audio,vol};
  if(btn)btn.classList.add('on');
  if(slider)slider.disabled=false;
  audio.play().catch(()=>{
    // 播放失败（多半是浏览器拦自动播放）→ 撤销登记
    delete ambientEls[id];if(btn)btn.classList.remove('on');if(slider)slider.disabled=true;
    if(typeof toast==='function')toast('播放失败，点一下页面再试');
  });
}
function setAmbItemVol(id,v){
  const vol=Math.max(0,Math.min(1,v/100));
  if(ambientEls[id]){ambientEls[id].vol=vol;ambientEls[id].audio.volume=vol;}
}
function stopAllAmbient(){
  Object.keys(ambientEls).forEach(id=>{
    try{ambientEls[id].audio.pause();ambientEls[id].audio.src='';}catch(e){}
    const btn=document.querySelector(`[data-amb="${id}"]`);if(btn)btn.classList.remove('on');
    const row=document.querySelector(`[data-row="${id}"]`);if(row){const s=row.querySelector('.amb-vol');if(s)s.disabled=true;}
    delete ambientEls[id];
  });
}
// 兼容旧的全局音量调用（若别处还引用）

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
  }catch(e){}
}

// ============ 工具 ============
function escapeHtml(s){const d=document.createElement('div');d.textContent=s||'';return d.innerHTML;}
function toast(msg){
  let t=document.getElementById('_toast');
  if(!t){t=document.createElement('div');t.id='_toast';t.style.cssText='position:fixed;bottom:90px;left:50%;transform:translateX(-50%);background:rgba(42,34,24,.92);color:#f0e8d6;padding:10px 20px;border-radius:20px;font-size:13px;z-index:99;transition:opacity .3s';document.body.appendChild(t);}
  t.textContent=msg;t.style.opacity='1';
  clearTimeout(window._tt);window._tt=setTimeout(()=>t.style.opacity='0',1800);
}

// ====== 拖动：环境音小窗 + Quill 入口都能四处拖 ======
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
function setAdaptivePageWidth(){
  try{
    if((window.innerWidth||999)<=600){document.documentElement.style.removeProperty('--pagewidth');return;}
    const w=Math.round(Math.max(700,Math.min(1040,window.innerWidth*0.66)));
    document.documentElement.style.setProperty('--pagewidth',w+'px');
  }catch(e){}
}
