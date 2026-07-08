// ╔══ 50_share.js —— 收藏翻阅模式 / 分享书单 ══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。

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
        const ggrain=localStorage.getItem('garden_grain')||'month';
        html+=`<div class="jn-garden-bar"><span class="jn-section-title" style="margin:24px 0 0">读书统计</span>
          <span class="g-grain">${[['month','按月'],['year','按年']].map(([g,l])=>`<button class="jgr ${ggrain===g?'on':''}" onclick="setGardenGrain('${g}')">${l}</button>`).join('')}</span>
          <span class="garden-hint"><a onclick="enterGardenSelect()" style="color:var(--accent);cursor:pointer">编辑</a></span></div>`;
        // 按月(或年)归组成一块块草地；没记录时间的归到"未记录时间"
        const groups=[];const idx={};
        trees.forEach(t=>{
          const key=(ggrain==='year')?((t.month||'').slice(0,4)):(t.month||'');
          if(!(key in idx)){idx[key]=groups.length;groups.push([key,[]]);}
          groups[idx[key]][1].push(t);
        });
        const treeCard=t=>{
          const stage=t.finished?5:growthStage(t.progress);
          const when=t.month?('读于 '+t.month):(t.lo?('最近翻看 '+t.lo):'');
          const tip=`${esc(t.title)}${t.author?' · '+esc(t.author):''}（${t.hist?'往期读完':(t.finished?'已读完':t.progress+'%')}${when?' · '+when:''}）`;
          return `<div class="g-tree${t.hist?' hist':''}" data-bid="${t.id}" ${t.hist?'data-hist="1"':''} data-skin="${t.skin}" draggable="${t.hist?'false':'true'}" title="${tip}">
            <div class="g-tree-art">${treeSVG(stage,t.skin)}</div>
            <div class="g-tree-name">${esc(t.title.length>6?t.title.slice(0,6)+'…':t.title)}</div>
            <div class="g-tree-prog">${t.finished?'读完':(t.progress||0)+'%'}</div>
          </div>`;
        };
        groups.forEach(([key,list])=>{
          const gk=key||'none';
          html+=`<div class="garden-month">${fmtGKey(key,ggrain)} <span class="garden-month-n">${list.length}</span></div>`;
          html+=`<div class="garden-grove" data-gkey="${gk}" ondragover="groveDragOver(event)" ondragleave="groveDragLeave(event)" ondrop="groveDrop(event,'${gk}')"><div class="grove-bg"></div><div class="grove-tex"></div>`
              +list.map(treeCard).join('')
              +`<button class="grove-dress" title="装扮这块草地：换底图 / 纯色 / 纹理" onclick="openGroveEditor('${gk}')">装扮</button></div>`;
        });
        html+=`<div class="garden-foot">共 <b>${trees.length}</b> 棵，其中 <b>${garden.finished_count||0}</b> 棵已长成</div>`;
        html+=`<div class="garden-trash" id="garden-trash"><svg viewBox="0 0 24 24"><path d="M7 6V3a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v3h4v2h-2v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8H3V6h4zm2 0h6V4H9v2zm-2 2v12h10V8H7zm3 2h2v8h-2v-8zm4 0h2v8h-2v-8z"></path></svg><span>拖到这里移除这棵树</span></div>`;
      }else if(featOn('garden')){
        html+='<div class="jn-empty" style="padding:40px 20px">读起来，这里会长出你的花园<br><span style="font-size:13px">每读一本书就种一棵树，按进度生长，可以给每本书选不同的树种</span></div>';
      }
      body.innerHTML=html;
      setTimeout(bindGarden,50);
      decorateGroves();   // 给每块草地铺上各自的底图/底色/纹理
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

// 心跳：让独立 exe 在浏览器全部关闭后自动退出进程、释放端口（dev 模式无此接口，fetch 失败被忽略，无害）。
// 切回前台立刻补一次，配合后端 90s 宽限，手机锁屏/切后台不会被误杀。
(function(){try{var hb=function(){fetch("/api/heartbeat").catch(function(){});};hb();setInterval(hb,20000);document.addEventListener("visibilitychange",function(){if(!document.hidden)hb();});}catch(e){}})();



