// ╔══ 40_journey_misc.js —— 时段主题/PWA/后台任务条/阅读历程/花园草地/多选 ══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。

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
  if(getBgMode()==='color'){renderColorBg();applyUserTheme();return;}   // 纯色模式跨刷新还原（applyUserTheme 里会跳过主背景，只铺插画条/边角）
  const u=getBgImgUrl();
  if(u){
    const bg=document.getElementById('theme-bg');
    bg.style.backgroundImage=`url(${u})`;
    document.body.classList.add('has-bg');
  }
  applyUserTheme();  // 叠加用户上传的
  renderTexOverlay();   // 兜底：即便上面网络请求失败，质感叠加层也先恢复
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

  if(stage<=0){ // 幼苗（有自定义色时叶子跟色，苗也能染）
    const l1=color?shade(color,18):'#8fb07a', l2=color?shade(color,42):'#a6c28c';
    return wrap(
      `<rect x="${(cx-1.2).toFixed(1)}" y="54" width="2.4" height="16" rx="1.2" fill="#6f9460"/>`+
      `<ellipse cx="24.5" cy="53" rx="7.5" ry="4.2" fill="${l1}" fill-opacity=".8" transform="rotate(-20 24.5 53)"/>`+
      `<ellipse cx="35.5" cy="51" rx="8" ry="4.4" fill="${l2}" fill-opacity=".74" transform="rotate(18 35.5 51)"/>`);
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
      <div style="padding:0 18px 6px"><div style="font-size:12px;color:var(--ink-soft);font-family:var(--sans);margin-bottom:6px">从书脊色卡取色（点一下＝这棵树用这个色，树种不变）</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${resolvePalette(getCoverPalette()).map(c=>`<span class="cb-sw" style="background:${c};width:24px;height:24px" onclick="tpPalColor('${c}')"></span>`).join('')}</div></div>
      <div class="tp-foot"><button class="tp-read" onclick="openReader(${bid})">翻开这本书</button></div>
    </div></div>`;
  window._pickBid=bid;window._pickCur=cur;
  document.body.insertAdjacentHTML('beforeend',html);
}
function pickTreeCur(skin){pickTree(window._pickBid,skin);}
function tpPalColor(c){
  const sp=String(window._pickCur||'spruce').split('|')[0]||'spruce';
  pickTree(window._pickBid,sp+'|'+c);
}
// ===== 花园草地装扮：一个月(或一年)一块草地，各配底图/纯色/纹理/模糊/羽化；样式存服务端跨设备 =====
function setGardenGrain(g){localStorage.setItem('garden_grain',g);closeGroveEditor();loadJourney('overview');}
function fmtGKey(key,grain){if(!key)return '未记录时间';return grain==='year'?(key+' 年'):fmtMonth(key);}
let GARDEN_STYLE=null,_gardenSlots=null,_gsSaveT=null;
let _gTrees=null,_gKeys=[],_gLayout=null,_glSaveT=null;
async function loadGardenDecor(){
  try{const p=await (await fetch('/api/reading-prefs')).json();
    GARDEN_STYLE=JSON.parse(p.gardenStyle||'{}')||{};
    _gLayout=JSON.parse(p.gardenLayout||'{}')||{};
  }catch(e){GARDEN_STYLE=GARDEN_STYLE||{};_gLayout=_gLayout||{};}
  try{const r=await (await fetch('/api/theme/list')).json();_gardenSlots=r.slots||{};}catch(e){_gardenSlots=_gardenSlots||{};}
  try{
    const r=await (await fetch('/api/journey/garden')).json();
    _gTrees=r.trees||[];
    const grain=localStorage.getItem('garden_grain')||'month';
    const seen={};_gKeys=[];
    _gTrees.forEach(t=>{const k=((grain==='year')?((t.month||'').slice(0,4)):(t.month||''))||'none';if(!(k in seen)){seen[k]=1;_gKeys.push(k);}});
  }catch(e){_gTrees=_gTrees||[];}
}
function saveGardenLayout(){
  clearTimeout(_glSaveT);
  _glSaveT=setTimeout(()=>{fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gardenLayout:JSON.stringify(_gLayout||{})})}).catch(()=>{});},400);
}
function saveGardenStyle(){
  clearTimeout(_gsSaveT);
  _gsSaveT=setTimeout(()=>{fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gardenStyle:JSON.stringify(GARDEN_STYLE||{})})}).catch(()=>{});},400);
}
async function decorateGroves(){
  if(GARDEN_STYLE===null||_gardenSlots===null)await loadGardenDecor();
  document.querySelectorAll('.garden-grove[data-gkey]').forEach(el=>applyGroveDecor(el));
}
function applyGroveDecor(el){
  const gk=el.dataset.gkey;
  const lay=(_gLayout||{})[gk];
  if(lay&&Object.keys(lay).length){
    el.classList.add('freeform');
    el.querySelectorAll('.g-tree').forEach(t=>{const pos=lay[t.dataset.bid];if(pos){t.style.left=pos[0]+'%';t.style.top=pos[1]+'%';}});
  }else el.classList.remove('freeform');
  const bg=el.querySelector('.grove-bg'),tx=el.querySelector('.grove-tex');if(!bg)return;
  const own=(GARDEN_STYLE||{})[gk], ownImg=(_gardenSlots||{})['garden_'+gk];
  // 没单独装扮过的块 → 套主题面板里设的"所有草地默认"
  const useDefault=!own&&!ownImg;
  const st=(useDefault?(GARDEN_STYLE||{})['default']:own)||{};
  const img=ownImg||(useDefault?(_gardenSlots||{})['garden_default']:null);
  if(img){bg.style.backgroundImage=`url(${img}?v=${themeVer()})`;bg.style.backgroundColor='';}
  else if(st.color){bg.style.backgroundImage='';bg.style.backgroundColor=st.color;}
  else{bg.style.backgroundImage='';bg.style.backgroundColor='';}
  bg.style.filter=(st.blur>0)?`blur(${st.blur}px)`:'';
  if(st.feather>0){const m=`radial-gradient(ellipse 120% 120% at 50% 50%, #000 ${Math.max(0,100-st.feather)}%, transparent 100%)`;bg.style.webkitMaskImage=m;bg.style.maskImage=m;}
  else{bg.style.webkitMaskImage='';bg.style.maskImage='';}
  const t=BG_TEXTURES[st.tex];
  if(tx){
    if(t&&(st.texInt||0)>0){tx.style.backgroundImage=`url(${t.url})`;tx.style.backgroundSize=t.size;tx.style.opacity=Math.min(1,(st.texInt||0)/100);}
    else{tx.style.opacity=0;tx.style.backgroundImage='';}
  }
}
// 图片直接拖到某块草地上＝换这块的底图并打开编辑预览（拖树移栽不受影响：那是文本拖拽，不带 Files）
function groveDragOver(e){const ts=e.dataTransfer?[...e.dataTransfer.types]:[];if(ts.includes('Files')){e.preventDefault();e.currentTarget.classList.add('drag-over');}}
function groveDragLeave(e){e.currentTarget.classList.remove('drag-over');}
async function groveDrop(e,gk){
  e.currentTarget.classList.remove('drag-over');
  const ts=e.dataTransfer?[...e.dataTransfer.types]:[];
  if(!ts.includes('Files'))return;
  e.preventDefault();e.stopPropagation();
  const f=e.dataTransfer.files&&e.dataTransfer.files[0];if(!f)return;
  const ok=await uploadGroveImg(gk,f);
  if(ok)openGroveEditor(gk);
}
async function uploadGroveImg(gk,file){
  if(!/^image\//.test(file.type||'')){toast('请选图片文件');return false;}
  const fd=new FormData();fd.append('file',file);
  try{
    const r=await fetch('/api/theme/upload?slot=garden_'+encodeURIComponent(gk),{method:'POST',body:fd});
    if(!r.ok){toast('上传失败');return false;}
    localStorage.setItem('theme_ver',String(Date.now()));
    const j=await r.json();(_gardenSlots=_gardenSlots||{})['garden_'+gk]=j.url;
    _refreshGroves(gk);gpApplyDecor(gk);
    return true;
  }catch(e){toast('上传失败');return false;}
}
async function delGroveImg(gk){
  try{await fetch('/api/theme/user/garden_'+encodeURIComponent(gk),{method:'DELETE'});}catch(e){}
  if(_gardenSlots)delete _gardenSlots['garden_'+gk];
  localStorage.setItem('theme_ver',String(Date.now()));
  _refreshGroves(gk);gpApplyDecor(gk);
}
// 编辑预览模式：卡片浮在角落，动哪个控件，后面那块真草地实时变
function groveNav(d){
  let keys=(_gKeys&&_gKeys.length)?_gKeys:[...document.querySelectorAll('.garden-grove[data-gkey]')].map(e=>e.dataset.gkey);
  if(!keys.length){toast('还没有种过树');return;}
  const i=keys.indexOf(window._groveGk);
  const n=keys[((i<0?0:i)+d+keys.length)%keys.length];
  openGroveEditor(n);
  const el=document.querySelector(`.garden-grove[data-gkey="${n}"]`);
  if(el)el.scrollIntoView({block:'center',behavior:'smooth'});
}
async function geDyeTrees(){
  const gk=window._groveGk;if(!gk||gk==='default'){toast('翻到某一块再染');return;}
  const bids=[...document.querySelectorAll(`.garden-grove[data-gkey="${gk}"] .g-tree`)].map(e=>parseInt(e.dataset.bid)).filter(Boolean);
  if(!bids.length){toast('这一块没有树');return;}
  const sp=document.getElementById('ge-species').value,col=document.getElementById('ge-treecolor').value;
  try{
    const r=await fetch('/api/journey/trees/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_ids:bids,action:'skin',skin:sp+'|'+col})});
    if(!(await r.json()).ok)throw 0;
    toast('这一块的 '+bids.length+' 棵树换好了');
    loadJourney('overview');
  }catch(e){toast('没染上');}
}
function _refreshGroves(gk){
  if(gk==='default')document.querySelectorAll('.garden-grove[data-gkey]').forEach(applyGroveDecor);   // 默认样式=刷所有没单独装扮的块
  else document.querySelectorAll(`.garden-grove[data-gkey="${gk}"]`).forEach(applyGroveDecor);
}
function geSet(patch){
  const gk=window._groveGk;if(!gk)return;
  GARDEN_STYLE=GARDEN_STYLE||{};
  GARDEN_STYLE[gk]=Object.assign(GARDEN_STYLE[gk]||{},patch);
  _refreshGroves(gk);
  gpApplyDecor(gk);
  saveGardenStyle();
}
function geTex(t){geSet({tex:t});document.querySelectorAll('#se-body .cb-tex').forEach(b=>b.classList.toggle('on',b.dataset.tex===t));}
async function gePickImg(inp){const f=inp.files&&inp.files[0];inp.value='';if(!f)return;const ok=await uploadGroveImg(window._groveGk,f);if(ok){document.getElementById('ge-delimg').style.display='';toast('草地底图已换');}}
async function geDelImg(){await delGroveImg(window._groveGk);document.getElementById('ge-delimg').style.display='none';toast('已删掉图片，改用底色/纹理');}
async function geReset(){
  const gk=window._groveGk;
  if(GARDEN_STYLE)delete GARDEN_STYLE[gk];
  await delGroveImg(gk);
  saveGardenStyle();
  openGroveEditor(gk);
  toast('已恢复默认草地');
}

// 花园交互：点=换树种，长按=移除确认，拖到纸篓=移除。选择模式下点=勾选。
let gardenSelMode=false;
const gardenSel=new Set();
function bindGarden(){
  const trash=document.getElementById('garden-trash');
  document.querySelectorAll('.garden-grove .g-tree').forEach(el=>{
    if(el.dataset.hist){
      let t2=null;
      el.addEventListener('pointerdown',()=>{t2=setTimeout(()=>{t2=null;if(confirm('删除这棵往期的树？（只删这次留档，书不受影响）')){fetch('/api/journey/tree-history/'+el.dataset.bid.slice(1),{method:'DELETE'}).then(()=>loadJourney('overview'));}},600);});
      const c2=()=>{if(t2){clearTimeout(t2);t2=null;}};
      el.addEventListener('pointerup',c2);el.addEventListener('pointerleave',c2);
      el.addEventListener('click',()=>toast('往期读完的一轮 · 长按可删除留档'));
      return;
    }
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
