// ╔══ 30_theme.js —— 书房主题 · 背景方案/服务端镜像/色卡/槽位/定框编辑器 ══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。

// ===== 书房主题 =====

let curTheme=null;
const GE_SPECIES=[["spruce", "标准锥形"], ["slimfir", "细高尖塔"], ["cedar", "宽大平展"], ["pine", "稀疏高干"], ["poplar", "圆柱白杨"], ["round", "圆阔叶"], ["maple", "宽扁枫树·暖色"], ["willow", "下垂柳"], ["bush", "矮丛灌木"]];
// ===== 背景方案：内置默认 + 用户保存一套列表；长按或"编辑"删除。存服务端，更新/换设备不丢 =====
function getBgImgUrl(){return localStorage.getItem('home_bg_img')||'';}
const DEFAULT_SCHEMES=[
  {id:'plain',name:'纯净',color:'#f4f1ea',tex:'none',texInt:0},
];
let _schemes=null,_schemeEdit=false;
async function loadSchemes(){
  if(_schemes)return _schemes;
  try{const p=await (await fetch('/api/reading-prefs')).json();_schemes=JSON.parse(p.bgSchemes||'{}');}catch(e){_schemes={};}
  _schemes.user=_schemes.user||[];_schemes.hidden=_schemes.hidden||[];
  return _schemes;
}
function saveSchemes(){fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({bgSchemes:JSON.stringify(_schemes)})}).catch(()=>{});}
function _curSchemeId(){
  if(getBgMode()==='color')return 'c:'+getBgColor()+':'+getColorTex()+':'+getColorTexInt()+':'+(getBgGrad()?getBgColor2()+getBgGradAng():'')+':'+getBgMist()+':'+getBgSpots().length+':'+getCoverPalette();
  return 'i:'+getBgImgUrl();
}
function _schemeId(sc){return sc.img?('i:'+sc.img):('c:'+sc.color+':'+(sc.tex||'none')+':'+(sc.texInt||0)+':'+(sc.grad?(sc.color2||'')+(sc.ang==null?170:sc.ang):'')+':'+(sc.mist||0)+':'+((sc.spots||[]).length)+':'+(sc.pal||''));}
async function renderSchemes(){
  await loadSchemes();
  const box=document.getElementById('scheme-grid');if(!box)return;
  const cur=_curSchemeId();
  const all=DEFAULT_SCHEMES.filter(d=>!_schemes.hidden.includes(d.id)).concat(_schemes.user);
  box.className='scheme-grid'+(_schemeEdit?' editing':'');
  box.innerHTML=all.map((sc,i)=>{
    const sw=sc.img?`background-image:url(${sc.img})`:(sc.grad?`background:linear-gradient(${sc.ang==null?170:sc.ang}deg, ${sc.color}, ${sc.color2||sc.color})`:`background:${sc.color}`);
    return `<div class="scheme ${_schemeId(sc)===cur?'on':''}" data-i="${i}">
      <div class="scheme-sw" style="${sw}"></div><div class="scheme-name">${esc(sc.name||'')}</div>
      <span class="sw-x" onclick="delScheme(event,${i})">×</span></div>`;
  }).join('');
  box.querySelectorAll('.scheme').forEach(el=>{
    let t=null;
    el.addEventListener('pointerdown',()=>{t=setTimeout(()=>{t=null;_schemeEdit=true;renderSchemes();},550);});
    const cancel=()=>{if(t){clearTimeout(t);t=null;}};
    el.addEventListener('pointerup',cancel);el.addEventListener('pointerleave',cancel);
    el.addEventListener('click',e=>{if(_schemeEdit||e.target.classList.contains('sw-x'))return;applyScheme(all[parseInt(el.dataset.i)]);});
  });
}
function toggleSchemeEdit(){_schemeEdit=!_schemeEdit;renderSchemes();}
function delScheme(ev,i){
  ev.stopPropagation();
  const all=DEFAULT_SCHEMES.filter(d=>!_schemes.hidden.includes(d.id)).concat(_schemes.user);
  const sc=all[i];if(!sc)return;
  if(sc.id)_schemes.hidden.push(sc.id);
  else{const j=_schemes.user.indexOf(sc);if(j>=0)_schemes.user.splice(j,1);}
  saveSchemes();renderSchemes();
}
function saveCurrentScheme(){
  const name=prompt('给这个方案起个名：','我的背景');
  if(!name)return;
  const sc=(getBgMode()==='color')
    ?{name,color:getBgColor(),ang:getBgGradAng(),mist:getBgMist(),spots:getBgSpots(),gstops:getGStops(),gspan:getGSpan(),gshape:getGShape(),veil:getVeil(),pal:getCoverPalette(),tex:getColorTex(),texInt:getColorTexInt()}
    :((((window._themeSlots||{}).bg)||getBgImgUrl())?{name,img:(((window._themeSlots||{}).bg)||getBgImgUrl()),veil:getVeil(),pal:getCoverPalette(),tex:getColorTex(),texInt:getColorTexInt(),gstops:getGStops(),gspan:getGSpan(),gshape:getGShape(),ang:getBgGradAng(),spots:getBgSpots(),mist:getBgMist()}:null);
  if(!sc){toast('当前是上传的背景图；先选方案或调纯色再存');return;}
  _schemes.user.push(sc);saveSchemes();renderSchemes();toast('已存为方案');
}
function applyScheme(sc){
  if(!sc)return;
  if(sc.img){
    setBgMode('');localStorage.setItem('home_bg_img',sc.img);
    localStorage.setItem('home_bg_gstops',JSON.stringify(sc.gstops||[]));
    localStorage.setItem('home_bg_gspan',String(sc.gspan==null?100:sc.gspan));
    localStorage.setItem('home_bg_gshape',sc.gshape||'linear');
    localStorage.setItem('home_bg_spots',JSON.stringify(sc.spots||[]));
    localStorage.setItem('home_bg_mist',String(sc.mist==null?0:sc.mist));
    localStorage.setItem('home_bg_source','scheme');   // 点了方案=方案在上（就算之前传过主背景图）
    localStorage.setItem('home_bg_texture',sc.tex||'none');
    localStorage.setItem('home_bg_tex_int',String(sc.texInt==null?0:sc.texInt));
    applyUserTheme();
    if(getVeil()>70){setVeil(55);const vr=document.getElementById('veil-range');if(vr)vr.value=55;}
  }else{
    localStorage.setItem('home_bg_img','');
    localStorage.setItem('home_bg_texture',sc.tex||'none');
    localStorage.setItem('home_bg_tex_int',String(sc.texInt==null?35:sc.texInt));
    localStorage.setItem('home_bg_grad',sc.grad?'1':'');
    if(sc.color2)localStorage.setItem('home_bg_color2',sc.color2);
    localStorage.setItem('home_bg_grad_ang',String(sc.ang==null?170:sc.ang));
    localStorage.setItem('home_bg_mist',String(sc.mist==null?0:sc.mist));
    localStorage.setItem('home_bg_spots',JSON.stringify(sc.spots||[]));
    localStorage.setItem('home_bg_gstops',JSON.stringify(sc.gstops||[]));
    localStorage.setItem('home_bg_gspan',String(sc.gspan==null?100:sc.gspan));
    localStorage.setItem('home_bg_gshape',sc.gshape||'linear');
    applyColorBg(sc.color);
  }
  if(sc.veil!=null){setVeil(sc.veil);const vr=document.getElementById('veil-range');if(vr)vr.value=sc.veil;}
  if(sc.pal)setCoverPalette(sc.pal);
  renderSchemes();renderColorUI();
}
// ===== 服务端镜像：书房本地设置写进 library.db，更新版本/换浏览器不再丢（收藏作者也在内） =====
const _HL_KEEP=k=>k!=='home_local_ts'&&/^(home_|feat_|tree_skin$|fav_authors$|cover_palette$|journey_grain$|garden_grain$|theme_ver$)/.test(k);
(function(){
  const orig=Storage.prototype.setItem;let t=null;
  function push(){
    const snap={};
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(_HL_KEEP(k))snap[k]=localStorage.getItem(k);}
    const ts=Date.now();orig.call(localStorage,'home_local_ts',String(ts));
    fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({homeLocal:JSON.stringify(snap),homeLocalTs:ts})}).catch(()=>{});
  }
  Storage.prototype.setItem=function(k,v){orig.call(this,k,v);if(this===localStorage&&_HL_KEEP(k)){clearTimeout(t);t=setTimeout(push,800);}};
  window._flushHomeLocal=function(){
    clearTimeout(t);
    const snap={};
    for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(_HL_KEEP(k))snap[k]=localStorage.getItem(k);}
    const ts=Date.now();orig.call(localStorage,'home_local_ts',String(ts));
    return fetch('/api/reading-prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({homeLocal:JSON.stringify(snap),homeLocalTs:ts})}).catch(()=>{});
  };
  window.addEventListener('beforeunload',()=>{   // 关页兜底：把最新本地设置拍进服务端
    try{
      const snap={};
      for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(_HL_KEEP(k))snap[k]=localStorage.getItem(k);}
      navigator.sendBeacon&&navigator.sendBeacon('/api/reading-prefs',new Blob([JSON.stringify({homeLocal:JSON.stringify(snap),homeLocalTs:Date.now()})],{type:'application/json'}));
    }catch(e){}
  });
})();
async function saveThemeAndReload(btn){
  window._themeSaved=true;
  if(btn){btn.disabled=true;btn.textContent='保存中…';}
  try{
    const d=window._treeDraft||{};
    for(const id of Object.keys(d)){
      await fetch('/api/book/tree-skin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:parseInt(id),skin:d[id]})});
    }
  }catch(e){}
  (window._flushHomeLocal?window._flushHomeLocal():Promise.resolve()).finally(()=>location.reload());
}
async function hydrateLocalFromServer(){
  try{
    const p=await (await fetch('/api/reading-prefs')).json();
    if(p.homeLocal){
      const ts=parseInt(p.homeLocalTs||'0'),local=parseInt(localStorage.getItem('home_local_ts')||'0');
      if(ts>local){
        Object.entries(JSON.parse(p.homeLocal)).forEach(([k,v])=>{try{localStorage.setItem(k,v);}catch(e){}});
        localStorage.setItem('home_local_ts',String(ts));
      }
    }else{
      // 服务端还没有镜像 → 把本地现有的（含置顶作者）先推上去，防止"更新后清空"
      let has=false;for(let i=0;i<localStorage.length;i++){if(_HL_KEEP(localStorage.key(i))){has=true;break;}}
      if(has&&window._flushHomeLocal)window._flushHomeLocal();
    }
  }catch(e){}
  const legacy=localStorage.getItem('home_theme');   // 旧预设 id → 新方案（跑一次）
  if(legacy){
    const map={};
    const sc=map[legacy];
    if(sc){if(sc.img)localStorage.setItem('home_bg_img',sc.img);else{localStorage.setItem('home_bg_color',sc.color);localStorage.setItem('home_bg_texture',sc.tex);localStorage.setItem('home_bg_tex_int',String(sc.texInt));localStorage.setItem('home_bg_mode','color');}}
    localStorage.removeItem('home_theme');
  }
  try{
    const olds=JSON.parse(localStorage.getItem('home_saved_colors')||'[]');   // 旧存色 → 用户方案
    if(olds.length){await loadSchemes();olds.forEach((c,i)=>_schemes.user.push({name:'自定色'+(i+1),color:c,tex:'none',texInt:0}));saveSchemes();localStorage.removeItem('home_saved_colors');}
  }catch(e){}
}
function _live(){const m=document.getElementById('theme-modal');return !(m&&m.classList.contains('show'));}
function themeSnapshot(){
  window._treeDraft={};
  const snap={};
  for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(_HL_KEEP(k)&&k!=='fav_authors')snap[k]=localStorage.getItem(k);}
  window._themeSnap=snap;window._themeSaved=false;
}
function openTheme(){
  document.getElementById('theme-modal').classList.add('show');
  themeSnapshot();
  renderSchemes();
  renderCoverPalettes();
  renderColorUI();      // 纯色背景：调色盘/存的色/质感 状态回显
  loadThemeUploads();
  initThemeDrop();      // 拖图进方块上传 + 高亮
  initSlotDrags();      // 每个方块都能按住拖动＝挪图（主背景=裁切，其它=位置）
  highlightTimeTheme();
}
async function renderCoverPalettes(){
  await loadBookPalettes();
  const cur=getCoverPalette();
  const box=document.getElementById('cover-palettes');
  if(!box)return;
  box.innerHTML=allPalettes().map(p=>{
    const sw=(p.cols||[]).slice(0,5).map(c=>`<span style="background:${c}"></span>`).join('');
    return `<div class="cpal ${p.id===cur?'on':''}${_palEdit?' editing':''}" data-pid="${p.id}"><div class="cpal-swatches">${sw}</div><div class="cpal-name">${esc(p.name)}</div><span class="sw-x" onclick="delPalette(event,'${p.id}')">×</span></div>`;
  }).join('');
  box.querySelectorAll('.cpal').forEach(el=>{
    let t=null;
    el.addEventListener('pointerdown',()=>{t=setTimeout(()=>{t=null;_palEdit=true;renderCoverPalettes();},550);});
    const cancel=()=>{if(t){clearTimeout(t);t=null;}};
    el.addEventListener('pointerup',cancel);el.addEventListener('pointerleave',cancel);
    el.addEventListener('click',e=>{if(_palEdit||e.target.classList.contains('sw-x'))return;setCoverPalette(el.dataset.pid);});
  });
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
function closeTheme(){
  document.getElementById('theme-modal').classList.remove('show');
  closeSlotEditor();closeGroveEditor();
  if(window._themeSnap&&!window._themeSaved){   // 主题=保存才生效:没点「保存并刷新」就关面板→整体还原
    const cur={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(_HL_KEEP(k)&&k!=='fav_authors')cur[k]=1;}
    Object.keys(cur).forEach(k=>{if(!(k in window._themeSnap))localStorage.removeItem(k);});
    Object.entries(window._themeSnap).forEach(([k,v])=>localStorage.setItem(k,v));
    try{if(typeof DATA!=='undefined'&&DATA&&DATA.length)DATA.forEach(b=>{b.c=coverColor(b.t);});render();}catch(e){}
    applyUserTheme();applyBgAdjust();applyVeil();renderTexOverlay();applyVign();
    THEME_SLOTS.forEach(applySlotAdjust);
    toast('没保存，已还原进来时的样子');
  }
  window._treeDraft={};
  window._themeSnap=null;
}


const THEME_SLOTS=['bg','strip','strip_bottom','corner','desk_left','desk_right','side_r','journey_banner','journey_bg','settings_bg','admin_bg'];
async function uploadThemeFile(slot,file){
  if(!file)return;
  if(!/^image\//.test(file.type||'')){toast('请拖入图片文件');return;}
  const fd=new FormData();fd.append('file',file);
  toast('上传中…');
  try{
    const r=await (await fetch('/api/theme/upload?slot='+slot,{method:'POST',body:fd})).json();
    if(r.ok){
      if(slot==='bg'){setBgMode('');localStorage.setItem('home_bg_source','upload');}
      localStorage.setItem('theme_ver',String(Date.now()));
      toast('已上传');
      await applyUserTheme();      // 等真背景/槽位缓存都刷新完
      await loadThemeUploads();
      openSlotEditor(slot);        // 再开编辑器：预览一定是新图
    }
    else toast('上传失败');
  }catch(e){toast('上传失败');}
}
async function uploadTheme(slot,input){const f=input.files&&input.files[0];if(input)input.value='';if(f)uploadThemeFile(slot,f);}
// 把图片直接拖进方块上传，并且拖到哪个块哪个块高亮
let _themeDropInit=false;
function initThemeDrop(){
  if(_themeDropInit)return;_themeDropInit=true;
  THEME_SLOTS.forEach(slot=>{
    const el=document.getElementById('tu-prev-'+slot);if(!el)return;
    el.addEventListener('dragover',e=>{e.preventDefault();e.stopPropagation();el.classList.add('drag-over');try{e.dataTransfer.dropEffect='copy';}catch(_){}});
    el.addEventListener('dragleave',e=>{if(!el.contains(e.relatedTarget))el.classList.remove('drag-over');});
    el.addEventListener('drop',e=>{
      e.preventDefault();e.stopPropagation();el.classList.remove('drag-over');
      const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
      if(f)uploadThemeFile(slot,f);
    });
  });
}
// 所有方块通用：设好图后按住拖动来挪图。主背景/插画条/书桌=挪裁切窗口（拖右→看图更左边），
// 边角=直接平移贴图（拖右→图往右）。点一下（没拖）仍是选图上传。
function initSlotDrags(){
  THEME_SLOTS.forEach(slot=>{
    const el=document.getElementById('tu-prev-'+slot);if(!el||el._dragInit)return;el._dragInit=true;
    let down=false,moved=false,sx=0,sy=0,x0=50,y0=50;
    el.addEventListener('pointerdown',e=>{
      if(!el.classList.contains('filled'))return;   // 没设图 → 当普通点击(选图)
      down=true;moved=false;sx=e.clientX;sy=e.clientY;
      if(slot==='bg'){x0=getBgPosX();y0=getBgPosY();}
      else{const a=getSlotAdj(slot);x0=a.x;y0=a.y;}
      try{el.setPointerCapture(e.pointerId);}catch(_){}
    });
    el.addEventListener('pointermove',e=>{
      if(!down)return;
      const dx=e.clientX-sx,dy=e.clientY-sy;
      if(!moved&&(Math.abs(dx)+Math.abs(dy))>4){moved=true;el.style.cursor='grabbing';}
      if(!moved)return;
      const sgn=(slot==='corner')?1:-1;             // 裁切窗与图的运动方向相反；边角是平移所以同向
      const nx=Math.max(0,Math.min(100,x0+sgn*dx/Math.max(1,el.clientWidth)*100));
      const ny=Math.max(0,Math.min(100,y0+sgn*dy/Math.max(1,el.clientHeight)*100));
      if(slot==='bg'){
        setBgPosX(nx);setBgPosY(ny);                // 写存储 + applyBgAdjust → 真背景实时跟着动
        const xr=document.getElementById('bgposx-range');if(xr)xr.value=Math.round(nx);
        const yr=document.getElementById('bgposy-range');if(yr)yr.value=Math.round(ny);
      }else{
        setSlotAdj(slot,{x:Math.round(nx),y:Math.round(ny)});   // 写存储 + applySlotAdjust → 真实元素实时动
      }
      el.style.backgroundPosition=nx+'% '+ny+'%';   // 方块预览同步
    });
    const up=e=>{if(!down)return;down=false;el.style.cursor='';try{el.releasePointerCapture(e.pointerId);}catch(_){}};
    el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
    el.addEventListener('click',e=>{if(moved){e.preventDefault();e.stopPropagation();moved=false;}},true);  // 拖过就别再弹选图
  });
}
async function clearTheme(slot){
  try{await fetch('/api/theme/user/'+slot,{method:'DELETE'});localStorage.setItem('theme_ver',String(Date.now()));toast('已清除');loadThemeUploads();applyUserTheme();}catch(e){}
}
// 主题资源版本号：上传/清除时更新 → 图片 URL 带上它，浏览器缓存才会失效、显示新图
function themeVer(){return localStorage.getItem('theme_ver')||'0';}
async function loadThemeUploads(){
  try{
    const r=await (await fetch('/api/theme/list')).json();
    const slots=r.slots||{};
    window._themeSlots=slots;                    // 记录哪些槽位已有图（方块点击分流、编辑卡片都用它）
    THEME_SLOTS.forEach(s=>{
      const prev=document.getElementById('tu-prev-'+s);
      if(!prev)return;
      if(slots[s]){
        prev.style.backgroundImage=`url(${slots[s]}?v=${themeVer()})`;
        if(s==='bg')prev.style.backgroundPosition=getBgPosX()+'% '+getBgPosY()+'%';   // 预览裁切位置跟存的一致
        else{const a=getSlotAdj(s);prev.style.backgroundPosition=a.x+'% '+a.y+'%';}
        const sp=prev.querySelector('span');if(sp)sp.style.display='none';
        prev.classList.add('filled');            // 有图 → 高亮描边，表示这块已设置
      }else{
        prev.style.backgroundImage='';
        prev.style.backgroundPosition='';
        const sp=prev.querySelector('span');if(sp)sp.style.display='';
        prev.classList.remove('filled');
      }
    });
    const vr=document.getElementById('veil-range');if(vr)vr.value=getVeil();
    const br=document.getElementById('bgblur-range');if(br)br.value=getBgBlur();
    const fr=document.getElementById('bgfeather-range');if(fr)fr.value=getBgFeather();
    const xr=document.getElementById('bgposx-range');if(xr)xr.value=getBgPosX();
    const yr=document.getElementById('bgposy-range');if(yr)yr.value=getBgPosY();
    const zr=document.getElementById('bgzoom-range');if(zr)zr.value=getBgZoom();
  }catch(e){}
}
// 背景浓淡（纸色蒙层透明度）
function getVeil(){const v=parseInt(localStorage.getItem('home_veil'));return isNaN(v)?55:v;}
function setVeil(v){
  v=parseInt(v);if(isNaN(v))v=55;
  localStorage.setItem('home_veil',v);
  applyVeil();
}
function applyVeil(){
  if(!_live())return;   // 面板开着=草稿态：页面冻结，「保存并刷新」才生效
  const veil=document.getElementById('theme-veil');if(!veil)return;
  if(getBgMode()==='color'){veil.style.opacity=0;return;}   // 纯色模式：蒙层会把你调的颜色洗成纸色，强制关掉
  if(document.body.classList.contains('has-bg'))veil.style.opacity=(getVeil()/100);
  else veil.style.opacity='';
}
// 背景整体模糊 + 边缘羽化 + 裁切位置 + 缩放（自己框想要显示的部分）
function getBgBlur(){const v=parseInt(localStorage.getItem('home_bg_blur'));return isNaN(v)?0:v;}
function getBgFeather(){const v=parseInt(localStorage.getItem('home_bg_feather'));return isNaN(v)?0:v;}
function getBgPosX(){const v=parseInt(localStorage.getItem('home_bg_posx'));return isNaN(v)?50:v;}
function getBgPosY(){const v=parseInt(localStorage.getItem('home_bg_posy'));return isNaN(v)?50:v;}
function getBgZoom(){const v=parseInt(localStorage.getItem('home_bg_zoom'));return isNaN(v)?100:v;}
function setBgBlur(v){localStorage.setItem('home_bg_blur',String(parseInt(v)||0));applyBgAdjust();}
function setBgFeather(v){localStorage.setItem('home_bg_feather',String(parseInt(v)||0));applyBgAdjust();}
function setBgPosX(v){localStorage.setItem('home_bg_posx',String(parseInt(v)));applyBgAdjust();}
function setBgPosY(v){localStorage.setItem('home_bg_posy',String(parseInt(v)));applyBgAdjust();}
function setBgZoom(v){localStorage.setItem('home_bg_zoom',String(parseInt(v)||100));applyBgAdjust();}
function applyBgAdjust(){
  if(!_live())return;   // 面板开着=草稿态：页面冻结，「保存并刷新」才生效
  const bg=document.getElementById('theme-bg');if(!bg)return;
  if(getBgMode()==='color')return;               // 纯色模式：主背景交给 renderColorBg，这些滑块不参与
  const blur=getBgBlur(), feather=getBgFeather(), px=getBgPosX(), py=getBgPosY(), zoom=(getBgZoom()||100)/100, rot=getBgRot();
  const tiled=bg.classList.contains('tiled');
  if(tiled){
    // 平铺纹理（宣纸/抹茶等）：保持小图重复平铺，别拉伸铺满，否则纸纹就糊成一片看不出来了
    bg.style.backgroundSize='340px';
    bg.style.backgroundPosition='center';
    bg.style.backgroundRepeat='repeat';
    bg.style.transform='';bg.style.transformOrigin='';
  }else{
    bg.style.backgroundSize='cover';
    bg.style.backgroundRepeat='';
    bg.style.backgroundPosition=px+'% '+py+'%';                 // 裁切位置：图的哪个部分对齐到屏幕
    let scale=Math.max(1,zoom)+(blur>0?0.08:0);                // 缩放（放大裁得更紧）；模糊时再多放一点藏掉边缘透明晕
    if(rot){                                                    // 旋转后按精确包围盒自动补缩放，四角不露白
      const th=Math.abs(rot)*Math.PI/180, c=Math.abs(Math.cos(th)), s=Math.abs(Math.sin(th));
      const W=Math.max(1,window.innerWidth), H=Math.max(1,window.innerHeight);
      scale*=Math.max((W*c+H*s)/W,(W*s+H*c)/H);
    }
    bg.style.transform=(scale!==1||rot)?`rotate(${rot}deg) scale(${scale})`:'';
    bg.style.transformOrigin=rot?'50% 50%':(px+'% '+py+'%');    // 旋转时以中心为轴（补缩放公式对中心才精确）；不旋转仍以裁切焦点为中心缩放
  }
  bg.style.filter=bgFilterStr();
  if(feather>0){const m=`radial-gradient(ellipse 118% 118% at ${px}% ${py}%, #000 ${Math.max(0,100-feather)}%, transparent 100%)`;bg.style.webkitMaskImage=m;bg.style.maskImage=m;}
  else{bg.style.webkitMaskImage='';bg.style.maskImage='';}
}
// ===== 纯色背景：调色盘 + 可保存色卡 + 质感叠加（给不想放背景图的同学准备的） =====
function getBgMode(){return localStorage.getItem('home_bg_mode')||'';}
function setBgMode(m){localStorage.setItem('home_bg_mode',m||'');}
function getBgColor(){return localStorage.getItem('home_bg_color')||'#e9e2d3';}
function getColorTex(){return localStorage.getItem('home_bg_texture')||'none';}
function getColorTexInt(){const v=parseInt(localStorage.getItem('home_bg_tex_int'));return isNaN(v)?35:v;}
function getBgColor2(){return localStorage.getItem('home_bg_color2')||'#b8ccd6';}
function getBgGrad(){return localStorage.getItem('home_bg_grad')==='1';}
function getBgGradAng(){const v=parseInt(localStorage.getItem('home_bg_grad_ang'));return isNaN(v)?170:v;}
function getBgMist(){const v=parseInt(localStorage.getItem('home_bg_mist'));return isNaN(v)?0:v;}
function setBgColor2(c){localStorage.setItem('home_bg_color2',c);if(getBgMode()==='color')renderColorBg();}
function setBgGrad(on){localStorage.setItem('home_bg_grad',on?'1':'');if(getBgMode()==='color'){renderColorBg();renderColorUI();}}
function setBgGradAng(v){localStorage.setItem('home_bg_grad_ang',String(parseInt(v)||0));if(getBgMode()==='color')renderColorBg();}
function _rgba(hex,a){const [r,g,b]=_rgb(hex);return `rgba(${r},${g},${b},${(a==null?0.6:a/100).toFixed(2)})`;}
function getGStops(){try{const a=JSON.parse(localStorage.getItem('home_bg_gstops')||'[]');if(Array.isArray(a)&&a.length)return a;}catch(e){}
  if(getBgGrad())return [{c:getBgColor(),a:100},{c:getBgColor2(),a:85}];
  return [{c:getBgColor(),a:100}];}
function setGStops(a){a=(a&&a.length)?a:[{c:'#f4f1ea',a:100}];localStorage.setItem('home_bg_gstops',JSON.stringify(a));localStorage.setItem('home_bg_color',a[0].c);if(getBgMode()==='color')renderColorBg();seUpdatePreview&&seUpdatePreview();}  renderShapeOverlay();
const SHAPE_CLIP={
  diamond:'polygon(50% 0,100% 50%,50% 100%,0 50%)',
  star4:'polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)',
  star5:'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
};
SHAPE_CLIP.triangle='polygon(50% 6%,94% 92%,6% 92%)';
SHAPE_CLIP.square='polygon(8% 8%,92% 8%,92% 92%,8% 92%)';
SHAPE_CLIP.hexagon='polygon(50% 3%,93% 27%,93% 73%,50% 97%,7% 73%,7% 27%)';
const DROP_MASK='url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 2.5c3.6 5 6.2 8.3 6.2 11.6a6.2 6.2 0 1 1-12.4 0C5.8 10.8 8.4 7.5 12 2.5z%22/></svg>")';
const FLOWER_MASK='url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 2a4.2 4.2 0 0 1 4.2 4.2c2.4-.9 5 .6 5.6 3.1.6 2.4-.9 4.9-3.4 5.4a4.2 4.2 0 0 1-6.4 5.1 4.2 4.2 0 0 1-6.4-5.1C3.1 14.2 1.6 11.7 2.2 9.3c.6-2.5 3.2-4 5.6-3.1A4.2 4.2 0 0 1 12 2z%22/></svg>")';
const CRESCENT_MASK='url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M15 2.6A9.8 9.8 0 1 0 21.4 15 8 8 0 0 1 15 2.6z%22/></svg>")';
const HEART_MASK='url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22><path fill=%22black%22 d=%22M12 21s-7.5-4.9-9.7-9C.9 8.7 2.6 5.5 5.8 5.1c1.9-.2 3.7.7 4.7 2.3.2.3.7.3.9 0 1-1.6 2.8-2.5 4.7-2.3 3.2.4 4.9 3.6 3.5 6.9C19.5 16.1 12 21 12 21z%22/></svg>")';
const _MASKS={heart:1,drop:1,flower4:1,crescent:1};
function _isShaped(sh){return !!(SHAPE_CLIP[sh]||_MASKS[sh]);}
function _shapeStyle(el,sh){
  const M={heart:HEART_MASK,drop:DROP_MASK,flower4:FLOWER_MASK,crescent:CRESCENT_MASK}[sh];
  if(M){el.style.webkitMaskImage=M;el.style.maskImage=M;el.style.webkitMaskSize='100% 100%';el.style.maskSize='100% 100%';el.style.webkitMaskRepeat='no-repeat';el.style.maskRepeat='no-repeat';}
  else el.style.clipPath=SHAPE_CLIP[sh]||'';
}
function getGRatio(){const v=parseInt(localStorage.getItem('home_bg_gratio'));return isNaN(v)?100:v;}
function setGRatio(v){localStorage.setItem('home_bg_gratio',String(Math.max(40,Math.min(250,parseInt(v)||100))));renderShapeOverlay();seUpdatePreview&&seUpdatePreview();}
function seSpotRatio(v){const a=getBgSpots();if(_spotSel>=0&&a[_spotSel]){a[_spotSel].ratio=Math.max(40,Math.min(250,parseInt(v)||100));setBgSpots(a);}}
function renderShapeOverlay(){
  try{
  if(!_live())return;
  const box=document.getElementById('theme-shapes');if(!box)return;
  box.innerHTML='';
  const vmin=Math.min(innerWidth,innerHeight);
  const st=getGStops();
  if(st.length>=2&&_isShaped(getGShape())){
    const d=document.createElement('div');
    const base=vmin*getGSpan()/100*1.2, hh=base*getGRatio()/100;
    const n=st.length,parts=st.map((x,i)=>`${_rgba(x.c,x.a==null?85:x.a)} ${Math.round(i/(n-1)*100)}%`);
    d.style.cssText=`left:50%;top:45%;width:${base}px;height:${hh}px;background:linear-gradient(${getBgGradAng()}deg, ${parts.join(', ')});filter:blur(${(base*0.05).toFixed(0)}px)`;
    _shapeStyle(d,getGShape());
    box.appendChild(d);
  }
  getBgSpots().forEach(sp=>{
    if(!_isShaped(sp.sh))return;
    const d=document.createElement('div');
    const sz=vmin*(sp.r||45)/100*0.95, hh=sz*((sp.ratio||100)/100);
    const A=_rgba(sp.c,sp.a==null?60:sp.a);
    d.style.cssText=`left:${sp.x}%;top:${sp.y}%;width:${sz}px;height:${hh}px;background:radial-gradient(circle, ${A} 0%, ${A} 55%, transparent 80%);filter:blur(${(sz*0.05).toFixed(0)}px)`;
    _shapeStyle(d,sp.sh);
    box.appendChild(d);
  });
  }catch(e){console.error('shape',e);}
}
function getGShape(){return localStorage.getItem('home_bg_gshape')||'linear';}
function setGShape(v){localStorage.setItem('home_bg_gshape',v);renderShapeOverlay();if(getBgMode()==='color')renderColorBg();seUpdatePreview&&seUpdatePreview();seRenderPanel&&seRenderPanel();}
function getGSpan(){const v=parseInt(localStorage.getItem('home_bg_gspan'));return isNaN(v)?100:v;}
function setGSpan(v){localStorage.setItem('home_bg_gspan',String(Math.max(20,Math.min(100,parseInt(v)||100))));if(getBgMode()==='color')renderColorBg();seUpdatePreview&&seUpdatePreview();}
function gradLayer(){try{const st=getGStops();if(st.length<2||_isShaped(getGShape()))return [];const span=getGSpan(),sh=getGShape();
  const n=st.length,parts=st.map((x,i)=>`${_rgba(x.c,x.a==null?85:x.a)} ${Math.round(i/(n-1)*span)}%`);
  if(span<100)parts.push(`transparent ${Math.min(100,span+8)}%`);
  if(sh==='radial')return [`radial-gradient(ellipse 110% 95% at 50% 42%, ${parts.join(', ')})`];
  if(sh==='rays'){const w=Math.max(4,Math.min(14,Math.round(span/10)));return [`repeating-conic-gradient(from ${getBgGradAng()}deg at 50% 45%, ${_rgba(st[0].c,st[0].a==null?85:st[0].a)} 0 ${w}deg, transparent ${w}deg ${w*4}deg)`];}
  return [`linear-gradient(${getBgGradAng()}deg, ${parts.join(', ')})`];}catch(e){console.error('grad',e);return [];}}
function spotLayers(){try{return getBgSpots().filter(sp=>!_isShaped(sp.sh)).map(sp=>{
  const r=sp.r||45,A=_rgba(sp.c,sp.a==null?60:sp.a),sh=sp.sh||'circle';
  if(sh==='ellipse')return `radial-gradient(${r}% ${Math.round(r*0.55)}% at ${sp.x}% ${sp.y}%, ${A}, transparent 72%)`;
  if(sh==='ring')return `radial-gradient(${r}% ${r}% at ${sp.x}% ${sp.y}%, transparent 42%, ${A} 66%, transparent 92%)`;
  if(sh==='rays')return `repeating-conic-gradient(from 0deg at ${sp.x}% ${sp.y}%, ${A} 0 6deg, transparent 6deg 42deg)`;
  return `radial-gradient(${r}% ${r}% at ${sp.x}% ${sp.y}%, ${A}, transparent 72%)`;
});}catch(e){console.error('spots',e);return [];}}
function applyMist(){if(!_live())return;const el=document.getElementById('theme-mist');if(!el)return;const k=getBgMist()/100;if(k<=0){el.style.opacity=0;el.style.background='';el.style.backdropFilter='';el.style.webkitBackdropFilter='';return;}el.style.background=`rgba(255,255,255,${(k*0.42).toFixed(2)})`;el.style.backdropFilter=`blur(${(k*7).toFixed(1)}px)`;el.style.webkitBackdropFilter=el.style.backdropFilter;el.style.opacity=1;}
function getBgSpots(){try{const a=JSON.parse(localStorage.getItem('home_bg_spots')||'[]');return Array.isArray(a)?a:[];}catch(e){return [];}}
function setBgSpots(a){localStorage.setItem('home_bg_spots',JSON.stringify(a||[]));if(getBgMode()==='color'){renderColorBg();}seUpdatePreview&&seUpdatePreview();}  renderShapeOverlay();
let _spotSel=-1;
function seAddSpot(){const a=getBgSpots();if(a.length>=6){toast('最多 6 个点');return;}a.push({x:30+Math.random()*40,y:30+Math.random()*40,c:resolvePalette(getCoverPalette())[0]||'#b8ccd6',r:45,a:60});seRenderPanel();_spotSel=a.length-1;setBgSpots(a);}
function seClearSpots(){_spotSel=-1;setBgSpots([]);}
function seSpotColor(c){const a=getBgSpots();if(_spotSel>=0&&a[_spotSel]){a[_spotSel].c=c;setBgSpots(a);}}
function seSpotSize(v){const a=getBgSpots();if(_spotSel>=0&&a[_spotSel]){a[_spotSel].r=parseInt(v)||45;setBgSpots(a);}}
function seSpotAlpha(v){const a=getBgSpots();if(_spotSel>=0&&a[_spotSel]){a[_spotSel].a=Math.max(5,Math.min(100,parseInt(v)||60));setBgSpots(a);}}
function setSpotShape(sh){const a=getBgSpots();if(_spotSel>=0&&a[_spotSel]){a[_spotSel].sh=sh;setBgSpots(a);seRenderPanel();}}
function selColorInput(c){
  if(_selT&&_selT.t==='g'){const st=getGStops();if(st[_selT.i]){st[_selT.i].c=c;setGStops(st);if(_selT.i===0)applyColorBg&&(getBgMode()==='color')&&renderColorBg();seRenderPanel();return;}}
  if(_spotSel>=0){const a=getBgSpots();if(a[_spotSel]){a[_spotSel].c=c;setBgSpots(a);seRenderPanel();}}
}
function setBgMist(v){localStorage.setItem('home_bg_mist',String(Math.max(0,Math.min(100,parseInt(v)||0))));applyMist();}
// 质感贴图（无缝平铺）：url + 各自合适的平铺尺寸（尺寸不同也是区分度的一部分）
const BG_TEXTURES={
  paper:{url:'/api/theme/asset/texture_paper.png',size:'380px'},   // 宣纸：云絮+纤维
  linen:{url:'/api/theme/asset/texture_linen.png',size:'200px'},   // 亚麻：经纬交织
  twill:{url:'/api/theme/asset/texture_twill.png',size:'190px'},   // 斜纹：45°织纹
  grain:{url:'/api/theme/asset/texture_grain.png',size:'240px'},   // 颗粒：砂粒
  canvas:{url:'/api/theme/asset/texture_canvas.png',size:'210px'},
  dots:{url:'/api/theme/asset/texture_dots.png',size:'170px'},     // 细点：错排点阵
};
// 质感叠加层：multiply 压在当前背景上——纯色 / 预设 / 上传图 全都能叠，强度=不透明度
function renderTexOverlay(){
  if(!_live())return;   // 面板开着=草稿态：页面冻结，「保存并刷新」才生效
  const el=document.getElementById('theme-tex');if(!el)return;
  const tex=getColorTex(), k=Math.max(0,Math.min(1,getColorTexInt()/100));
  const t=BG_TEXTURES[tex];
  if(!t||k<=0){el.style.opacity=0;el.style.backgroundImage='';return;}
  el.style.backgroundImage=`url(${t.url})`;
  el.style.backgroundSize=t.size;
  el.style.opacity=k;
}
function renderColorBg(){
  if(!_live())return;   // 面板开着=草稿态：页面冻结，「保存并刷新」才生效
  const bg=document.getElementById('theme-bg');if(!bg)return;
  bg.classList.remove('tiled');
  const _gs=getGStops();
  bg.style.backgroundColor=_gs[0].c;
  const layers=[];
  spotLayers().forEach(l=>layers.push(l));
  gradLayer().forEach(l=>layers.push(l));
  bg.style.backgroundImage=layers.join(', ');
  bg.style.backgroundSize='';bg.style.backgroundRepeat='';
  bg.style.transform='';bg.style.transformOrigin='';bg.style.filter='';
  bg.style.webkitMaskImage='';bg.style.maskImage='';
  document.body.classList.add('has-bg');
  applyVeil();
  renderTexOverlay();
}
function applyColorBg(c){
  if(c)localStorage.setItem('home_bg_color',c);
  setBgMode('color');
  renderColorBg();
  renderColorUI();
}
function setColorTex(t){
  localStorage.setItem('home_bg_texture',t);
  renderTexOverlay();                 // 叠加层直接生效，不切换背景模式（图片背景也能叠）
  renderColorUI();
}
function setColorTexInt(v){
  localStorage.setItem('home_bg_tex_int',String(Math.max(0,Math.min(100,parseInt(v)||0))));
  renderTexOverlay();
}
function clearColorBg(){
  if(getBgMode()!=='color'){toast('当前就是图片背景');return;}
  setBgMode('');
  applyUserTheme();          // 回到 图片背景（上传的优先，其次预设）
  renderColorUI();
  toast('已切回图片背景');
}
function renderColorUI(){
  const pick=document.getElementById('se-bgcolor');if(pick)pick.value=getBgColor();
  const tex=getColorTex();
  document.querySelectorAll('.cb-tex').forEach(b=>b.classList.toggle('on',b.dataset.tex===tex));
  const ir=document.getElementById('cbtex-int');if(ir)ir.value=getColorTexInt();
  const c2=document.getElementById('se-bgcolor2');if(c2)c2.value=getBgColor2();
  const g=document.getElementById('se-grad');if(g)g.classList.toggle('on',getBgGrad());
  const ga=document.getElementById('se-gradang');if(ga)ga.value=getBgGradAng();
  const mi=document.getElementById('se-mist');if(mi)mi.value=getBgMist();
}

// ===== 槽位调整存取：主背景/插画条/边角/书桌左右，各自独立的 位置/缩放/旋转/模糊/羽化（编辑卡片驱动） =====
const SLOT_ADJ_DEF={x:50,y:50,zoom:100,rot:0,blur:0,feather:0,op:100};
const SLOT_NAMES={bg:'主背景',strip:'顶部插画条',strip_bottom:'底部横幅',corner:'左侧装饰',side_r:'右侧装饰',desk_left:'左书桌',desk_right:'右书桌',journey_banner:'阅读记录·横幅',journey_bg:'阅读记录·背景',settings_bg:'设置页·背景',admin_bg:'管理页·背景'};
function _slotAdjAll(){try{const o=JSON.parse(localStorage.getItem('home_slot_adj')||'{}');return (o&&typeof o==='object')?o:{};}catch(e){return {};}}
function getSlotAdj(slot){return Object.assign({},SLOT_ADJ_DEF,_slotAdjAll()[slot]||{});}
function setSlotAdj(slot,patch){
  const all=_slotAdjAll();all[slot]=Object.assign({},getSlotAdj(slot),patch);
  localStorage.setItem('home_slot_adj',JSON.stringify(all));   // 书桌俩槽位阅读页会读这份存储
  applySlotAdjust(slot);
}
function getBgRot(){const v=parseInt(localStorage.getItem('home_bg_rot'));return isNaN(v)?0:v;}
function setBgRot(v){localStorage.setItem('home_bg_rot',String(parseInt(v)||0));applyBgAdjust();}
function applySlotAdjust(slot){
  if(!_live())return;   // 面板开着=草稿态：页面冻结，「保存并刷新」才生效
  const a=getSlotAdj(slot);
  if(slot==='bg'){applyBgAdjust();return;}       // 主背景走原有那套滑块（旋转也并进去了）
  if(slot==='strip'||slot==='strip_bottom'){
    const img=document.querySelector(slot==='strip'?'#theme-strip img':'#theme-strip-bottom img');if(!img)return;
    img.style.objectPosition=a.x+'% '+a.y+'%';   // 位置=挪裁切窗（条是 cover 裁的）
    const z=Math.max(0.5,a.zoom/100);
    img.style.transform=(z!==1||a.rot)?`scale(${z}) rotate(${a.rot}deg)`:'';
    img.style.filter=slotFilterStr(a);
    img.style.opacity=(a.op==null?100:a.op)/100;
    if(a.feather>0){const m=`radial-gradient(ellipse 115% 115% at 50% 50%, #000 ${Math.max(0,100-a.feather)}%, transparent 100%)`;img.style.webkitMaskImage=m;img.style.maskImage=m;}
    else{img.style.webkitMaskImage='';img.style.maskImage='';}
    return;
  }
  if(slot==='corner'||slot==='side_r'){
    const el=document.getElementById(slot==='corner'?'side-l':'side-r');if(!el)return;
    const mir='';
    el.style.backgroundPosition=a.x+'% '+a.y+'%';
    const z=Math.max(0.5,a.zoom/100);
    el.style.transform=(z!==1||a.rot||mir)?`${mir}scale(${z}) rotate(${a.rot}deg)`:'';
    el.style.filter=slotFilterStr(a);
    el.style.opacity=(a.op==null?95:a.op)/100;
    const stop=Math.max(10,80-(a.feather||0));
    const dir=(slot==='corner')?'to right':'to left';
    el.style.webkitMaskImage=`linear-gradient(${dir},#000 ${stop}%,transparent)`;
    el.style.maskImage=el.style.webkitMaskImage;
    return;
  }
  if(slot==='journey_bg'){
    const el=document.getElementById('journey-bg');if(!el)return;
    el.style.backgroundPosition=a.x+'% '+a.y+'%';
    const z=Math.max(1,a.zoom/100);
    el.style.transformOrigin='50% 50%';
    el.style.transform=(z!==1||a.rot)?`scale(${z}) rotate(${a.rot}deg)`:'';
    el.style.filter=slotFilterStr(a);
    if(a.feather>0){const m=`radial-gradient(ellipse 118% 118% at 50% 50%, #000 ${Math.max(0,100-a.feather)}%, transparent 100%)`;el.style.webkitMaskImage=m;el.style.maskImage=m;}
    else{el.style.webkitMaskImage='';el.style.maskImage='';}
    return;
  }
  if(slot==='journey_banner'){
    const el=document.getElementById('journey-banner');if(!el)return;
    el.style.backgroundPosition=a.x+'% '+a.y+'%';
    const z=Math.max(0.5,a.zoom/100);
    el.style.transform=(z!==1||a.rot)?`scale(${z}) rotate(${a.rot}deg)`:'';
    el.style.filter=slotFilterStr(a);
    if(a.feather>0){const m=`radial-gradient(ellipse 115% 130% at 50% 40%, #000 ${Math.max(0,100-a.feather)}%, transparent 100%)`;el.style.webkitMaskImage=m;el.style.maskImage=m;}
    else{el.style.webkitMaskImage='';el.style.maskImage='';}
    return;
  }
  // desk_left / desk_right 阅读页读取；settings_bg 设置页读取
}
// ===== 通用编辑卡片：每个背景位一张卡，改哪儿真实界面实时变（和草地那张是同一套交互） =====
// ===== 图标工具栏编辑器（Remix 风小图标；范围/位置用裁剪框和滚轮手调，不用拉条） =====
// ===== 编辑器 2.0：Remix 规范 24 网格线稿图标 · 变换(裁剪+旋转合一) · Photos 式调色 · 预览按真实比例 =====
const SE_ICONS={
  img:'<svg viewBox="0 0 24 24"><path d="M4.5 5.5h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1z"/><circle cx="9" cy="10" r="1.7"/><path d="M4.5 16.5l4.5-4 3.5 3 3-2.5 4 3.5"/></svg>',
  del:'<svg viewBox="0 0 24 24"><path d="M4.5 6.5h15M9.5 6.5v-2h5v2M6.5 6.5l.9 12.3a1 1 0 0 0 1 .9h7.2a1 1 0 0 0 1-.9l.9-12.3M10 10.5v6M14 10.5v6"/></svg>',
  move:'<svg viewBox="0 0 24 24"><path d="M8 3.5v13.5a1 1 0 0 0 1 1h11.5M3.5 8h13.5a1 1 0 0 1 1 1v11.5"/><path d="M18.5 4a5 5 0 0 0-4-2" opacity=".85"/><path d="M18.5 1.5V4H16"/></svg>',
  blur:'<svg viewBox="0 0 24 24"><path d="M12 3.5c3.4 4 5.8 6.9 5.8 9.6a5.8 5.8 0 0 1-11.6 0c0-2.7 2.4-5.6 5.8-9.6z"/><path d="M12 17.5a4 4 0 0 1-4-4" opacity=".7"/></svg>',
  feather:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.4" stroke-dasharray="2.6 3.4"/></svg>',
  veil:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/><path d="M12 3.8a8.2 8.2 0 0 1 0 16.4z" fill="currentColor" stroke="none" opacity=".5"/></svg>',
  tex:'<svg viewBox="0 0 24 24"><path d="M4 9l5-5M4 15l11-11M4 21L21 4M10 21l11-11M16 21l5-5"/></svg>',
  grad:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 20V4M12 20V4M16 20V4" opacity=".45"/></svg>',
  mist:'<svg viewBox="0 0 24 24"><path d="M4 8.5h8.5M6.5 12.5h13M4 16.5h10.5M17.5 8.5h2.5"/></svg>',
  spot:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.2"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/><path d="M12 2.2v2.6M12 19.2v2.6M2.2 12h2.6M19.2 12h2.6"/></svg>',
  color:'<svg viewBox="0 0 24 24"><path d="M13.5 3.2l6.3 6.3a1 1 0 0 1 0 1.4L14 16.7a3.4 3.4 0 0 1-4.8 0L5 12.5a3.4 3.4 0 0 1 0-4.8l4.2-4.2M4 20.5h11"/><path d="M19.5 14.5c1 1.3 1.7 2.3 1.7 3.2a1.7 1.7 0 1 1-3.4 0c0-.9.7-1.9 1.7-3.2z" fill="currentColor" stroke="none"/></svg>',
  bright:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8"/></svg>',
  contrast:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2"/><path d="M12 3.8v16.4A8.2 8.2 0 0 0 12 3.8z" fill="currentColor" stroke="none"/></svg>',
  sat:'<svg viewBox="0 0 24 24"><path d="M12 3.5c3.4 4 5.8 6.9 5.8 9.6a5.8 5.8 0 0 1-11.6 0c0-2.7 2.4-5.6 5.8-9.6z"/><path d="M6.6 13.1c1.8 1.1 3.6 1.1 5.4 0s3.6-1.1 5.4 0" opacity=".8"/></svg>',
  temp:'<svg viewBox="0 0 24 24"><path d="M10.5 4a1.5 1.5 0 0 1 3 0v9.3a4 4 0 1 1-3 0z"/><circle cx="12" cy="17" r="1.6" fill="currentColor" stroke="none"/><path d="M12 17v-7" /></svg>',
  fade:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 4l16 16" /><path d="M13 6.5h4.5M15 9.5h2.5" opacity=".55"/></svg>',
  eye:'<svg viewBox="0 0 24 24"><path d="M2.5 12s3.6-6.2 9.5-6.2S21.5 12 21.5 12s-3.6 6.2-9.5 6.2S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.7"/></svg>',
  undo:'<svg viewBox="0 0 24 24"><path d="M7.5 5.5L4 9l3.5 3.5M4 9h10a6 6 0 0 1 0 12h-4"/></svg>',
};
let _seTool='',_seSnap=null;
function _ico(t,title){return `<button class="se-ico" id="se-ico-${t}" title="${title}" onclick="seSelectTool('${t}')">${SE_ICONS[t]}</button>`;}
function _slotAspect(slot){
  if(slot==='strip'||slot==='strip_bottom'||slot==='journey_banner')return {w:'100%',ar:(Math.max(1,innerWidth)/120).toFixed(2)};
  if(slot==='desk_left'||slot==='desk_right')return {w:'160px',ar:(0.32).toFixed(2)};
  if(slot==='corner')return {w:'46%',ar:'1'};
  return {w:'100%',ar:(Math.max(1,innerWidth)/Math.max(1,innerHeight)).toFixed(2)};   // 整页类：按真实屏幕比例
}
function seModeImg(){setBgMode('');localStorage.setItem('home_bg_source',(window._themeSlots||{}).bg?'upload':'scheme');applyUserTheme();openSlotEditor('bg');}
function seModeColor(){applyColorBg(getBgColor());openSlotEditor('bg');}
function sePeek(on){
  ['slot-editor','theme-modal'].forEach(id=>{const el=document.getElementById(id);if(el){el.style.opacity=on?'0':'';el.style.pointerEvents=on?'none':'';}});
}
let _seSnapStore=null;
function seSnapshot(slot){
  const KEYS=['home_bg_veil','home_bg_blur','home_bg_feather','home_bg_zoom','home_bg_rot','home_bg_posx','home_bg_posy','home_bg_mode','home_bg_color','home_bg_color2','home_bg_grad','home_bg_grad_ang','home_bg_mist','home_bg_spots','home_bg_texture','home_bg_tex_int','home_bg_img','home_bg_source','home_bg_bright','home_bg_contrast','home_bg_sat','home_bg_temp','home_bg_fade','home_slot_adj'];
  const snap={};KEYS.forEach(k=>snap[k]=localStorage.getItem(k));
  _seSnap={slot,snap};
}
function seRestore(){
  if(!_seSnap)return;
  Object.entries(_seSnap.snap).forEach(([k,v])=>{if(v==null)localStorage.removeItem(k);else localStorage.setItem(k,v);});
  applyUserTheme();applyBgAdjust();applyVeil();renderTexOverlay();applyVign();applyMist();renderShapeOverlay();
  THEME_SLOTS.forEach(applySlotAdjust);
  openSlotEditor(_seSnap.slot);
  toast('已还原到打开编辑器时的样子');
}
function _bgNum(k,d){const v=parseInt(localStorage.getItem(k));return isNaN(v)?d:v;}
function getBgBright(){return _bgNum('home_bg_bright',100);}   function setBgBright(v){localStorage.setItem('home_bg_bright',String(v));applyBgAdjust();}
function getBgContrast(){return _bgNum('home_bg_contrast',100);}function setBgContrast(v){localStorage.setItem('home_bg_contrast',String(v));applyBgAdjust();}
function getBgSat(){return _bgNum('home_bg_sat',100);}          function setBgSat(v){localStorage.setItem('home_bg_sat',String(v));applyBgAdjust();}
function getBgTemp(){return _bgNum('home_bg_temp',0);}          function setBgTemp(v){localStorage.setItem('home_bg_temp',String(v));applyBgAdjust();}
function getBgFade(){return _bgNum('home_bg_fade',0);}
function getBgVign(){return _bgNum('home_bg_vign',0);}
function setBgVign(v){localStorage.setItem('home_bg_vign',String(v));applyVign();}
function applyVign(){
  if(!_live())return;   // 面板开着=草稿态：页面冻结，「保存并刷新」才生效
  const el=document.getElementById('theme-vign');if(!el)return;
  const k=getBgVign()/100;
  if(k<=0){el.style.opacity=0;el.style.backgroundImage='';return;}
  el.style.backgroundImage=`radial-gradient(ellipse 130% 120% at 50% 46%, transparent 55%, rgba(20,16,10,${(k*0.85).toFixed(2)}))`;
  el.style.opacity=1;
}          function setBgFade(v){localStorage.setItem('home_bg_fade',String(v));applyBgAdjust();}
function filterStr(blur,bright,contrast,sat,temp,fade){
  const f=[];
  if(blur>0)f.push(`blur(${blur}px)`);
  if(bright!==100)f.push(`brightness(${bright}%)`);
  if(contrast!==100)f.push(`contrast(${contrast}%)`);
  if(sat!==100)f.push(`saturate(${sat}%)`);
  if(temp)f.push(temp>0?`sepia(${Math.min(60,temp)}%)`:`hue-rotate(${temp}deg)`);
  if(fade>0)f.push(`grayscale(${fade}%)`);
  return f.join(' ');
}
function bgFilterStr(){return filterStr(getBgBlur(),getBgBright(),getBgContrast(),getBgSat(),getBgTemp(),getBgFade());}
function slotFilterStr(a){return filterStr(a.blur||0,a.bright==null?100:a.bright,a.contrast==null?100:a.contrast,a.sat==null?100:a.sat,a.temp||0,a.fade||0);}
function seToolbarHTML(slot){
  const hasImg=!!((window._themeSlots||{})[slot]);
  let h='<div class="se-toolbar">';
  h+=`<button class="se-ico" title="${hasImg?'换图':'选图'}" onclick="document.getElementById('tu-file-${slot}').click()">${SE_ICONS.img}</button>`;
  h+=`<button class="se-ico" id="se-ico-del" title="删除图片" style="${hasImg?'':'display:none'}" onclick="seDelImg('${slot}')">${SE_ICONS.del}</button>`;
  if(slot==='bg')h+=`<span class="se-mode" style="margin-left:6px"><button class="cb-tex ${getBgMode()==='color'?'':'on'}" onclick="seModeImg()">图片</button><button class="cb-tex ${getBgMode()==='color'?'on':''}" onclick="seModeColor()">纯色</button></span>`;
  h+='</div>';
  return h;
}
let _seGroup='adj';
function seSelectTool(t){   // 现在只承担「变换」开关
  _seTool=(_seTool===t)?'':t;
  const btn=document.getElementById('se-ico-move');
  if(btn)btn.classList.toggle('on',_seTool==='move');
  seSetCrop(_seTool==='move');
}
function _prow(label,id,min,max,val,setter,unit){
  return `<div class="se-prow"><div class="pl"><span>${label}</span><b id="${id}-v">${val}${unit||''}</b></div>
  <input type="range" id="${id}" min="${min}" max="${max}" value="${val}" oninput="${setter};document.getElementById('${id}-v').textContent=this.value+'${unit||''}';seUpdatePreview()"></div>`;
}
function seRenderPanel(){
  const slot=window._seSlot,box=document.getElementById('se-panel');if(!box||!slot)return;
  const isBg=slot==='bg', a=isBg?null:getSlotAdj(slot);
  const tabs=document.getElementById('se-gtabs');
  if(tabs)tabs.style.display=isBg?'':'none';
  if(!isBg)_seGroup='adj';
  document.querySelectorAll('.se-gtab').forEach(b=>b.classList.toggle('on',b.dataset.g===_seGroup));
  let h='';
  if(_seGroup==='adj'){
    if(isBg)h+=_prow('浓淡（纸色蒙层）','veil-range',0,95,getVeil(),'setVeil(this.value)');
    h+=_prow('亮度','se-t-br',50,150,isBg?getBgBright():(a.bright==null?100:a.bright),isBg?'setBgBright(this.value)':`setSlotAdj('${slot}',{bright:parseInt(this.value)})`);
    h+=_prow('对比度','se-t-ct',50,150,isBg?getBgContrast():(a.contrast==null?100:a.contrast),isBg?'setBgContrast(this.value)':`setSlotAdj('${slot}',{contrast:parseInt(this.value)})`);
    h+=_prow('饱和度','se-t-sa',0,200,isBg?getBgSat():(a.sat==null?100:a.sat),isBg?'setBgSat(this.value)':`setSlotAdj('${slot}',{sat:parseInt(this.value)})`);
    h+=_prow('色温（左冷右暖）','se-t-tp',-40,60,isBg?getBgTemp():(a.temp||0),isBg?'setBgTemp(this.value)':`setSlotAdj('${slot}',{temp:parseInt(this.value)})`);
    h+=_prow('褪色','se-t-fd',0,100,isBg?getBgFade():(a.fade||0),isBg?'setBgFade(this.value)':`setSlotAdj('${slot}',{fade:parseInt(this.value)})`);
    h+=_prow('模糊','se-t-blur',0,isBg?24:10,isBg?getBgBlur():a.blur,isBg?'setBgBlur(this.value)':`setSlotAdj('${slot}',{blur:parseInt(this.value)})`);
    h+=_prow('边缘羽化','se-t-fe',0,isBg?60:70,isBg?getBgFeather():(a.feather||0),isBg?'setBgFeather(this.value)':`setSlotAdj('${slot}',{feather:parseInt(this.value)})`);
    h+=_prow('旋转','se-t-rot',-180,180,isBg?getBgRot():a.rot,isBg?'setBgRot(this.value)':`setSlotAdj('${slot}',{rot:parseInt(this.value)})`,'°');
    if(isBg)h+=_prow('晕影','se-t-vg',0,80,getBgVign(),'setBgVign(this.value)');
    else h+=_prow('不透明度','se-t-op',20,100,(a.op==null?100:a.op),`setSlotAdj('${slot}',{op:parseInt(this.value)})`,'%');
  }else{
    const _cols=resolvePalette(getCoverPalette());
    const _pals=allPalettes();
    h+=`<div class="se-prow"><div class="pl"><span>色卡</span><a class="tp-link" onclick="bgPalToggleEdit()">${window._bgPalEdit?'完成':'编辑'}</a></div>
      <div class="prowline"><select onchange="setCoverPalette(this.value);seRenderPanel()" style="font-family:var(--sans);font-size:12px;padding:4px 6px;border:1px solid var(--line-solid);border-radius:7px;background:var(--paper);color:var(--ink)">${_pals.map(p2=>`<option value="${p2.id}" ${p2.id===getCoverPalette()?'selected':''}>${esc(p2.name)}</option>`).join('')}</select>
      <button class="cb-btn" onclick="bgPalSaveAs()">另存</button></div></div>`;
    h+=`<div class="se-prow"><div class="prowline" id="bgpal-row">${_cols.map((c,i)=>window._bgPalEdit
        ?`<span class="pe-sw"><input type="color" value="${c}" oninput="bgPalSet(${i},this.value)"><span class="sw-x" onclick="bgPalDel(${i})">×</span></span>`
        :`<span class="cb-sw" style="background:${c};width:22px;height:22px" onclick="bgAssign('${c}')"></span>`).join('')}
      ${window._bgPalEdit?'<button class="cb-btn" onclick="bgPalAdd()">＋</button>':''}</div></div>`;
    const _st=getGStops(),_sp=getBgSpots();
    const _selG=(_selT&&_selT.t==='g')?_selT.i:-1;
    h+=`<div class="se-prow"><div class="pl"><span>底色</span></div><div class="prowline">${_st.map((x,i)=>`<span class="gstop ${_selG===i?'on':''}" onclick="selG(${i})"><span class="cb-sw" style="background:${x.c}"></span>${_st.length>1?`<span class="sw-x" onclick="event.stopPropagation();delG(${i})">×</span>`:''}</span>`).join('')}<button class="cb-btn" onclick="addG()">＋</button></div></div>`;
    if(_selG>=0&&_st[_selG]){
      h+=`<div class="se-prow"><div class="pl"><span>颜色</span></div><div class="prowline"><input type="color" value="${_st[_selG].c}" oninput="selColorInput(this.value)"></div></div>`;
      h+=_prow('深浅','se-t-ga',5,100,_st[_selG].a==null?100:_st[_selG].a,'setGA(this.value)');
    }
    if(_st.length>1){
      h+=`<div class="se-prow"><div class="pl"><span>渐变形状</span></div><div class="prowline">${[['linear','线性'],['radial','径向'],['rays','星芒'],['diamond','方片'],['triangle','三角'],['drop','水滴'],['star4','四芒'],['star5','五角'],['heart','心形']].map(x=>`<button class="cb-tex ${getGShape()===x[0]?'on':''}" onclick="setGShape('${x[0]}')">${x[1]}</button>`).join('')}</div></div>`;
      h+=_prow('渐变·角度','se-t-ang',0,360,getBgGradAng(),'setBgGradAng(this.value)','°');
      h+=_prow('渐变·范围','se-t-span',20,100,getGSpan(),'setGSpan(this.value)','%');
      if(_isShaped(getGShape()))h+=_prow('渐变·比例','se-t-gr',40,250,getGRatio(),'setGRatio(this.value)','%');
    }
    const _selS=_spotSel;
    h+=`<div class="se-prow"><div class="pl"><span>点晕染</span></div><div class="prowline">${_sp.map((x,i)=>`<span class="gstop ${_selS===i?'on':''}" onclick="selSpot(${i})"><span class="cb-sw" style="background:${x.c};border-radius:50%"></span><span class="sw-x" onclick="event.stopPropagation();delSpot(${i})">×</span></span>`).join('')}<button class="cb-btn" onclick="seAddSpot()">＋</button></div></div>`;
    if(_selS>=0&&_sp[_selS]){
      h+=`<div class="se-prow"><div class="pl"><span>颜色</span></div><div class="prowline"><input type="color" value="${_sp[_selS].c}" oninput="selColorInput(this.value)"></div></div>`;
      h+=_prow('晕开','se-spotr',15,90,_sp[_selS].r==null?45:_sp[_selS].r,'seSpotSize(this.value)');
      h+=_prow('浓淡','se-spota',5,100,_sp[_selS].a==null?60:_sp[_selS].a,'seSpotAlpha(this.value)');
      h+=_prow('比例','se-spotk',40,250,_sp[_selS].ratio==null?100:_sp[_selS].ratio,'seSpotRatio(this.value)','%');
      h+=`<div class="se-prow"><div class="pl"><span>晕染形状</span></div><div class="prowline">${[['circle','圆'],['ellipse','椭圆'],['ring','环'],['rays','星芒'],['diamond','方片'],['square','方形'],['triangle','三角'],['hexagon','六角'],['drop','水滴'],['flower4','四瓣花'],['crescent','月牙'],['star4','四芒'],['star5','五角'],['heart','心形']].map(x=>`<button class="cb-tex ${(_sp[_selS].sh||'circle')===x[0]?'on':''}" onclick="setSpotShape('${x[0]}')">${x[1]}</button>`).join('')}</div></div>`;
    }
    h+=_prow('雾感','se-t-mist',0,100,getBgMist(),'setBgMist(this.value)');
    h+=`<div class="se-prow"><div class="pl"><span>纹理</span></div><div class="prowline"><span class="cb-texes">${['none:无','paper:宣纸','linen:亚麻','twill:斜纹','grain:颗粒','canvas:帆布','dots:细点'].map(x=>{const p2=x.split(':');return `<button class="cb-tex" data-tex="${p2[0]}" onclick="setColorTex('${p2[0]}');seUpdatePreview()">${p2[1]}</button>`;}).join('')}</span></div></div>`;
    h+=_prow('纹理强度','cbtex-int',0,100,getColorTexInt(),'setColorTexInt(this.value)');
  }
  h+=`<div style="text-align:center;margin-top:12px"><button class="cb-btn" style="padding:8px 20px" onclick="saveThemeAndReload(this)">保存并刷新</button></div>`;
  box.innerHTML=h;
  if(_seGroup==='bgx')renderColorUI();
}
let _selT=null;
function bgAssign(c){
  if(_selT&&_selT.t==='g'){const st=getGStops();if(st[_selT.i]){st[_selT.i].c=c;setGStops(st);seRenderPanel();return;}}
  if(_spotSel>=0){const a=getBgSpots();if(a[_spotSel]){a[_spotSel].c=c;setBgSpots(a);seRenderPanel();return;}}
  toast('先点一个渐变色块或晕染点');
}
function selG(i){_selT={t:'g',i};_spotSel=-1;seRenderPanel();}
function selSpot(i){_spotSel=i;_selT={t:'spot',i};seRenderPanel();seUpdatePreview();}
function delSpot(i){const a=getBgSpots();a.splice(i,1);if(_spotSel>=a.length)_spotSel=a.length-1;setBgSpots(a);seRenderPanel();}
function addG(){const st=getGStops();st.push({c:resolvePalette(getCoverPalette())[Math.min(st.length,resolvePalette(getCoverPalette()).length-1)]||'#b8ccd6',a:85});_selT={t:'g',i:st.length-1};setGStops(st);seRenderPanel();}
function delG(i){const st=getGStops();st.splice(i,1);_selT=null;setGStops(st);seRenderPanel();}
function setGA(v){const st=getGStops();if(_selT&&_selT.t==='g'&&st[_selT.i]){st[_selT.i].a=Math.max(5,Math.min(100,parseInt(v)||85));setGStops(st);}}
async function bgPalSaveAs(){
  const name=prompt('色卡名字：','我的色卡');if(!name)return;
  await loadBookPalettes();
  const pal={id:'u'+Date.now(),name,cols:resolvePalette(getCoverPalette()).slice()};
  _bpal.user.push(pal);saveBookPalettes();setCoverPalette(pal.id);seRenderPanel();
}
function bgPalToggleEdit(){window._bgPalEdit=!window._bgPalEdit;seRenderPanel();}
async function _bgEditablePal(){
  await loadBookPalettes();
  let id=getCoverPalette();
  if(BUILTIN_PALETTES.some(x=>x.id===id)){   // 内置的先克隆成"我的"再编辑
    const b=BUILTIN_PALETTES.find(x=>x.id===id);
    const pal={id:'u'+Date.now(),name:b.name+'·改',cols:b.cols.slice()};
    _bpal.user.push(pal);saveBookPalettes();setCoverPalette(pal.id);
    return pal;
  }
  return _bpal.user.find(x=>x.id===id);
}
async function bgPalSet(i,c){const p=await _bgEditablePal();if(!p)return;p.cols[i]=c;saveBookPalettes();seRenderPanel();}
async function bgPalDel(i){const p=await _bgEditablePal();if(!p)return;p.cols.splice(i,1);saveBookPalettes();seRenderPanel();}
async function bgPalAdd(){const p=await _bgEditablePal();if(!p)return;p.cols.push(window._armedBgCol||'#8a8a7a');saveBookPalettes();seRenderPanel();}
function sePickGroup(g){_seGroup=g;seRenderPanel();}

// —— 裁剪框：框哪块看哪块（换算成 缩放+位置） ——
let _crop=null;
function seSetCrop(on){
  const el=document.getElementById('se-preview');if(!el)return;
  const old=document.getElementById('se-crop');if(old)old.remove();
  if(!on){_crop=null;return;}
  const c=document.createElement('div');c.id='se-crop';
  c.innerHTML='<span class="ch tl"></span><span class="ch tr"></span><span class="ch bl"></span><span class="ch br"></span><span class="rh" title="拖这里旋转"></span>';
  const W=el.clientWidth,H=el.clientHeight;
  _crop={x:W*0.15,y:H*0.15,w:W*0.7,h:H*0.7};
  const sync=()=>{c.style.left=_crop.x+'px';c.style.top=_crop.y+'px';c.style.width=_crop.w+'px';c.style.height=_crop.h+'px';};
  sync();
  let mode=null,sx=0,sy=0,st=null;
  const down=(e,m)=>{mode=m;sx=e.clientX;sy=e.clientY;st={..._crop};c.setPointerCapture&&c.setPointerCapture(e.pointerId);e.stopPropagation();e.preventDefault();};
  c.addEventListener('pointerdown',e=>down(e,e.target.classList.contains('rh')?'rot':(e.target.classList.contains('ch')?[...e.target.classList].find(x=>x!=='ch'):'move')));
  c.addEventListener('pointermove',e=>{
    if(!mode)return;
    const dx=e.clientX-sx,dy=e.clientY-sy,W2=el.clientWidth,H2=el.clientHeight,MIN=40;
    let{x,y,w,h}=st;
    if(mode==='rot'){   // 拖框顶圆点＝旋转
      const slot2=window._seSlot,isBg2=slot2==='bg';
      const nr=Math.max(-180,Math.min(180,(isBg2?getBgRot():getSlotAdj(slot2).rot||0)+Math.round(dx/2)));
      sx=e.clientX;
      if(isBg2)setBgRot(nr);else setSlotAdj(slot2,{rot:nr});
      const rr=document.getElementById('se-t-rot');if(rr)rr.value=nr;
      seUpdatePreview();return;
    }
    if(mode==='move'){x=Math.max(0,Math.min(W2-w,x+dx));y=Math.max(0,Math.min(H2-h,y+dy));}
    else{
      if(mode.includes('l')){const nx=Math.max(0,Math.min(x+w-MIN,x+dx));w+=x-nx;x=nx;}
      if(mode.includes('r')){w=Math.max(MIN,Math.min(W2-x,w+dx));}
      if(mode.includes('t')){const ny=Math.max(0,Math.min(y+h-MIN,y+dy));h+=y-ny;y=ny;}
      if(mode.includes('b')){h=Math.max(MIN,Math.min(H2-y,h+dy));}
    }
    _crop={x,y,w,h};sync();
  });
  const up=()=>{
    if(!mode)return;
    if(mode==='rot'){mode=null;return;}
    mode=null;
    const W2=el.clientWidth,H2=el.clientHeight;
    const slot=window._seSlot,isBg=slot==='bg';
    // 框中心 → 位置；框大小 → 缩放（框越小放越大）
    const cx=(_crop.x+_crop.w/2)/W2*100, cy=(_crop.y+_crop.h/2)/H2*100;
    const z=Math.max(100,Math.min(isBg?250:200, Math.round(100*Math.min(W2/_crop.w,H2/_crop.h))));
    if(isBg){setBgPosX(cx);setBgPosY(cy);setBgZoom(z);}
    else setSlotAdj(slot,{x:Math.round(cx),y:Math.round(cy),zoom:z});
    seUpdatePreview();seSetCrop(true);   // 重置框继续微调
  };
  c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
  el.appendChild(c);
}
// —— 滚轮缩放 / 旋转工具下横拖旋转 ——

function slotSquareClick(slot){openSlotEditor(slot);}   // 一律进编辑页（选图/换图都在里面）
function closeSlotEditor(){const m=document.getElementById('slot-editor');if(m)m.classList.remove('show');}
function _seRow(lbl,inner){return `<div class="ge-row"><span class="ge-lbl">${lbl}</span>${inner}</div>`;}
function _seRange(id,min,max,val,oninput){return `<input type="range" id="${id}" min="${min}" max="${max}" value="${val}" oninput="${oninput};seUpdatePreview&&seUpdatePreview()">`;}
function openSlotEditor(slot){openEditor('slot',slot);}
async function openGroveEditor(gk){
  if(GARDEN_STYLE===null||_gardenSlots===null)await loadGardenDecor();
  openEditor('grove',gk);
}
function closeGroveEditor(){closeSlotEditor();}
function openEditor(kind,key){
  const m=document.getElementById('slot-editor'),body=document.getElementById('se-body');if(!m||!body)return;
  window._seKind=kind;
  const nav=kind==='grove'&&key!=='default';
  ['se-prev','se-next'].forEach(id=>{const b2=document.getElementById(id);if(b2)b2.style.visibility=nav?'visible':'hidden';});
  let h='';
  if(kind==='grove'){
    window._groveGk=key;window._seSlot=null;
    GARDEN_STYLE=GARDEN_STYLE||{};
    const st=GARDEN_STYLE[key]||{};
    document.getElementById('se-title').textContent='草地 · '+(key==='default'?'全部默认':(key==='none'?'未记录':(/^\d{4}$/.test(key)?key+' 年':fmtMonth(key))));
    const hasImg=!!(_gardenSlots&&_gardenSlots['garden_'+key]);
    h+=`<div class="ge-row">
      <button class="cb-btn" onclick="document.getElementById('ge-file').click()">${hasImg?'换图':'选图'}</button>
      <button class="cb-btn" id="ge-delimg" style="${hasImg?'':'display:none'}" onclick="geDelImg()">删除图片</button>
      <span class="ge-lbl" style="margin-left:auto">底色</span><input type="color" id="ge-color" value="${st.color||'#dfe8d8'}" oninput="geSet({color:this.value})">
    </div>`;
    h+=_seRow('模糊',_seRange('ge-blur',0,12,st.blur||0,"geSet({blur:parseInt(this.value)})"));
    h+=_seRow('边缘羽化',_seRange('ge-feather',0,70,st.feather||0,"geSet({feather:parseInt(this.value)})"));
    h+=`<div class="ge-row"><span class="ge-lbl">纹理</span><div class="cb-texes" id="ge-texes">`+
       ['none:无','paper:宣纸','linen:亚麻','twill:斜纹','grain:颗粒','canvas:帆布','dots:细点'].map(x=>{const p2=x.split(':');return `<button class="cb-tex ${(st.tex||'none')===p2[0]?'on':''}" data-tex="${p2[0]}" onclick="geTex('${p2[0]}')">${p2[1]}</button>`;}).join('')+`</div></div>`;
    h+=_seRow('纹理强度',_seRange('ge-texint',0,100,(st.texInt==null?35:st.texInt),"geSet({texInt:parseInt(this.value)})"));
    if(key!=='default'){
      const pals=allPalettes(),cur=getCoverPalette();
      h+=`<div class="ge-row"><span class="ge-lbl">树色</span>
        <select id="ge-pal" onchange="geRenderSwatches()" style="font-family:var(--sans);font-size:12px;padding:4px 6px;border:1px solid var(--line-solid);border-radius:7px;background:var(--paper);color:var(--ink)">${pals.map(p2=>`<option value="${p2.id}" ${p2.id===cur?'selected':''}>${esc(p2.name)}</option>`).join('')}</select>
        <button class="cb-btn" onclick="geDyePalette()">应用色卡</button></div>`;
      h+=`<div class="ge-row" id="ge-swatches" style="gap:6px"></div>`;
      h+=`<div class="ge-row">
        <select id="ge-species" style="font-family:var(--sans);font-size:12px;padding:4px 6px;border:1px solid var(--line-solid);border-radius:7px;background:var(--paper);color:var(--ink)">${GE_SPECIES.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('')}</select>
        <input type="color" id="ge-treecolor" value="#5c8a63" style="width:38px;height:28px;border:1px solid var(--line-solid);border-radius:7px;background:none;padding:2px;cursor:pointer">
        <button class="cb-btn" onclick="geDyeTrees()">同色染整块</button></div>`;
      h+=`<div class="ge-row ge-foot"><span class="ge-tip">‹ › 翻块 · 拖图到草地＝换底图 · 点色块选色→点小树单棵上色 · 重读判定：读完的书再次打开＝旧轮存成\"往期树\"，新一轮重新长</span><button class="cb-btn" onclick="geReset()">恢复默认</button></div>`;
    }else{
      h+=`<div class="ge-row ge-foot"><span class="ge-tip">所有没单独装扮过的草地都用这套</span><button class="cb-btn" onclick="geReset()">恢复默认</button></div>`;
    }
    if(key!=='default'){
      h=`<div class="ge-preview" id="ge-preview"><div class="gp-bg" id="gp-bg"></div><div class="gp-tex" id="gp-tex"></div></div>`+h;
    }
    body.innerHTML=h;
    m.classList.toggle('ge-wide',key!=='default');m.classList.remove('ge-big');
    if(key!=='default'){gpRender(key);geRenderSwatches();}
    else m.classList.remove('ge-wide');
    m.classList.add('show');
    return;
  }
  m.classList.remove('ge-wide');
  m.classList.remove('ge-big');
  const slot=key;window._seSlot=slot;window._groveGk=null;
  _seTool='';
  if(!_seSnap||_seSnap.slot!==slot)seSnapshot(slot);
  document.getElementById('se-title').textContent='编辑 · '+(SLOT_NAMES[slot]||slot);
  h+='<div class="se-wrap"><div class="se-left">'+seToolbarHTML(slot);
  h+=`<div class="ge-preview sm" id="se-preview" ondragover="event.preventDefault();this.classList.add('drag-over')" ondragleave="this.classList.remove('drag-over')" ondrop="seDropImg(event)"></div>`;
  h+='<div class="ge-tip" style="margin-top:6px">滚轮＝缩放 · 按住图拖＝挪位置 · 「变换」拖框选范围/转角旋转</div></div>';
  h+=`<div class="se-right"><div class="se-gtabs" id="se-gtabs"><button class="se-gtab on" data-g="adj" onclick="sePickGroup('adj')">效果</button><button class="se-gtab" data-g="bgx" onclick="sePickGroup('bgx')">质感</button></div><div id="se-panel"></div></div></div>`;
  body.innerHTML=h;
  _seGroup='adj';
  seRenderPanel();
  m.classList.add('ge-big');
  renderColorUI();
  seUpdatePreview();
  seBindPreviewDrag();
  m.classList.add('show');
}
async function seDropImg(e){
  e.preventDefault();e.currentTarget.classList.remove('drag-over');
  const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
  if(f&&window._seSlot)await uploadThemeFile(window._seSlot,f);
}
// 编辑卡顶部的实时预览：当前这个位置的图（或纯色）+ 你调的效果；按住拖＝挪位置
// ===== 定框编辑器:裁剪框(=槽位真实比例)常驻不动,图片在框下拖动/滚轮缩放/拖顶点旋转 =====
const _imgDim={};
function _slotRatio(slot){
  if(slot==='strip'||slot==='strip_bottom'||slot==='journey_banner')return Math.max(1,innerWidth)/120;
  if(slot==='desk_left'||slot==='desk_right')return 0.32;
  if(slot==='corner'||slot==='side_r')return 170/Math.max(1,innerHeight);
  return Math.max(1,innerWidth)/Math.max(1,innerHeight);
}
function seFrameRect(el,slot){
  const W=el.clientWidth||600,H=el.clientHeight||340,ar=_slotRatio(slot);
  let fw=W*0.88,fh=fw/ar;
  if(fh>H*0.8){fh=H*0.8;fw=fh*ar;}
  return {fx:(W-fw)/2,fy:(H-fh)/2,fw,fh,W,H};
}
function seUpdatePreview(){
  if(window._seKind!=='slot')return;
  const el=document.getElementById('se-preview'),slot=window._seSlot;if(!el||!slot)return;
  el.style.height=(slot==='bg'||slot==='settings_bg'||slot==='admin_bg'||slot==='journey_bg')?'400px':'340px';
  const R=seFrameRect(el,slot);
  let fr=document.getElementById('se-frame');
  if(!fr){fr=document.createElement('div');fr.id='se-frame';fr.innerHTML='<span class="rh" title="拖这里旋转"></span>';el.appendChild(fr);seBindRotate(fr);}
  fr.style.left=R.fx+'px';fr.style.top=R.fy+'px';fr.style.width=R.fw+'px';fr.style.height=R.fh+'px';
  const isBg=slot==='bg';
  const a=isBg?null:getSlotAdj(slot);
  const x=isBg?getBgPosX():a.x, y=isBg?getBgPosY():a.y;
  const z=(isBg?(getBgZoom()||100):(a.zoom||100))/100;
  const rot=isBg?getBgRot():(a.rot||0);
  const fstr=isBg?bgFilterStr():slotFilterStr(a||{});
  const feather=isBg?getBgFeather():((a&&a.feather)||0);
  const img=(window._themeSlots||{})[slot];
  // 纯色模式(仅主背景):框内画渐变/雾/点
  el.querySelectorAll('.se-cvl').forEach(n=>n.remove());
  const imEl=(function(){let n=document.getElementById('se-img');if(!n){n=document.createElement('img');n.id='se-img';n.draggable=false;el.insertBefore(n,fr);}return n;})();
  if(isBg&&getBgMode()==='color'){
    imEl.style.display='none';
    const cv=document.createElement('div');cv.className='se-cvl';
    cv.style.cssText=`left:${R.fx}px;top:${R.fy}px;width:${R.fw}px;height:${R.fh}px;background-color:${getBgColor()}`;
    const parts=[];
    getBgSpots().forEach(sp=>parts.push(`radial-gradient(${sp.r||45}% ${sp.r||45}% at ${sp.x}% ${sp.y}%, ${sp.c}, transparent 72%)`));
    if(getBgMist()>0){const k=getBgMist()/100;parts.push(`radial-gradient(60% 52% at 24% 20%, rgba(255,255,255,${(k*0.7).toFixed(2)}), transparent 72%)`);}
    if(getBgGrad())parts.push(`linear-gradient(${getBgGradAng()}deg, ${getBgColor()}, ${getBgColor2()})`);
    cv.style.backgroundImage=parts.join(', ');
    el.insertBefore(cv,fr);
    seRenderSpots(el,R);
    return;
  }
  const url=img?`${img}?v=${themeVer()}`:(isBg?getBgImgUrl():'');
  if(!url){imEl.style.display='none';return;}
  imEl.style.display='';
  if(imEl.dataset.src!==url){
    imEl.dataset.src=url;
    imEl.onload=()=>{_imgDim[url]=[imEl.naturalWidth,imEl.naturalHeight];seUpdatePreview();};
    imEl.src=url;
    if(imEl.complete&&imEl.naturalWidth){_imgDim[url]=[imEl.naturalWidth,imEl.naturalHeight];}
    requestAnimationFrame(()=>seUpdatePreview());
  }
  const dim=_imgDim[url];
  if(!dim){imEl.style.left=R.fx+'px';imEl.style.top=R.fy+'px';imEl.style.width=R.fw+'px';imEl.style.height=R.fh+'px';imEl.style.transform='';return;}
  const [nw,nh]=dim;
  const cover=Math.max(R.fw/nw,R.fh/nh);
  const S=cover*Math.max(0.5,z);
  const dw=nw*S,dh=nh*S;
  const left=R.fx+(R.fw-dw)*(x/100), top=R.fy+(R.fh-dh)*(y/100);
  imEl.style.left=left+'px';imEl.style.top=top+'px';imEl.style.width=dw+'px';imEl.style.height=dh+'px';
  const ocx=(R.fx+R.fw/2-left), ocy=(R.fy+R.fh/2-top);
  imEl.style.transformOrigin=ocx+'px '+ocy+'px';
  imEl.style.transform=rot?`rotate(${rot}deg)`:'';
  imEl.style.filter=fstr||'';
  imEl.style.opacity=(!isBg&&a&&a.op!=null)?(a.op/100):'';
  if(feather>0){
    const r1=Math.min(R.fw,R.fh)/2*(1.15-feather/120), r2=r1+Math.min(R.fw,R.fh)*0.55;
    const mk=`radial-gradient(circle at ${ocx}px ${ocy}px, #000 ${Math.max(8,r1)}px, transparent ${r2}px)`;
    imEl.style.webkitMaskImage=mk;imEl.style.maskImage=mk;
  }else{imEl.style.webkitMaskImage='';imEl.style.maskImage='';}
  // 图片上叠 点位/雾感/质感(和纯色同一张画布的逻辑)
  el.querySelectorAll('.se-ovl,.se-texpv').forEach(nv=>nv.remove());
  if(isBg){
    const ov=spotLayers().concat(gradLayer());
    if(getBgMist()>0){
      const md=document.createElement('div');md.className='se-ovl';
      const k=getBgMist()/100;
      md.style.cssText=`position:absolute;left:${R.fx}px;top:${R.fy}px;width:${R.fw}px;height:${R.fh}px;pointer-events:none;z-index:1;background:rgba(255,255,255,${(k*0.42).toFixed(2)});backdrop-filter:blur(${(k*7).toFixed(1)}px);-webkit-backdrop-filter:blur(${(k*7).toFixed(1)}px)`;
      el.insertBefore(md,fr);
    }
    const st2=getGStops();
    if(st2.length>=2&&_isShaped(getGShape())){
      const d=document.createElement('div');d.className='se-ovl se-shape';
      const base=Math.min(R.fw,R.fh)*getGSpan()/100*1.2, hh=base*getGRatio()/100;
      const n2=st2.length,parts=st2.map((x,i)=>`${_rgba(x.c,x.a==null?85:x.a)} ${Math.round(i/(n2-1)*100)}%`);
      d.style.cssText=`left:${(R.fx+R.fw*0.5).toFixed(0)}px;top:${(R.fy+R.fh*0.45).toFixed(0)}px;width:${base}px;height:${hh}px;background:linear-gradient(${getBgGradAng()}deg, ${parts.join(', ')});filter:blur(${(base*0.05).toFixed(0)}px);pointer-events:none;z-index:1`;
      _shapeStyle(d,getGShape());
      el.insertBefore(d,fr);
    }
    getBgSpots().forEach(sp=>{
      if(!_isShaped(sp.sh))return;
      const d=document.createElement('div');d.className='se-ovl se-shape';
      const sz=Math.min(R.fw,R.fh)*(sp.r||45)/100*0.95, hh=sz*((sp.ratio||100)/100);
      const A=_rgba(sp.c,sp.a==null?60:sp.a);
      d.style.cssText=`left:${(R.fx+sp.x/100*R.fw).toFixed(0)}px;top:${(R.fy+sp.y/100*R.fh).toFixed(0)}px;width:${sz}px;height:${hh}px;background:radial-gradient(circle, ${A} 0%, ${A} 55%, transparent 80%);filter:blur(${(sz*0.05).toFixed(0)}px);pointer-events:none;z-index:1`;
      _shapeStyle(d,sp.sh);
      el.insertBefore(d,fr);
    });
    if(ov.length){
      const od=document.createElement('div');od.className='se-ovl';
      od.style.cssText=`position:absolute;left:${R.fx}px;top:${R.fy}px;width:${R.fw}px;height:${R.fh}px;pointer-events:none;z-index:1;background-image:${ov.join(', ')}`;
      el.insertBefore(od,fr);
    }
    const tk=BG_TEXTURES[getColorTex()];
    if(tk&&getColorTexInt()>0){
      const td=document.createElement('div');td.className='se-texpv';
      td.style.cssText=`position:absolute;left:${R.fx}px;top:${R.fy}px;width:${R.fw}px;height:${R.fh}px;pointer-events:none;z-index:1;mix-blend-mode:multiply;background-image:url(${tk.url});background-size:${tk.size};opacity:${Math.min(1,getColorTexInt()/100)}`;
      el.insertBefore(td,fr);
    }
    seRenderSpots(el,R);
  }
  el.querySelectorAll('.se-veilpv').forEach(nv=>nv.remove());
  if(isBg&&getVeil()>0){
    const vp=document.createElement('div');vp.className='se-veilpv';
    vp.style.cssText=`position:absolute;left:${R.fx}px;top:${R.fy}px;width:${R.fw}px;height:${R.fh}px;background:#f4f1ea;opacity:${getVeil()/100};pointer-events:none;z-index:2`;
    el.insertBefore(vp,fr);
  }
}
function seRenderSpots(el,R){
  el.querySelectorAll('.gspot').forEach(n=>n.remove());
  getBgSpots().forEach((sp,i)=>{
    const g=document.createElement('div');g.className='gspot'+(i===_spotSel?' on':'');
    g.style.left=(R.fx+sp.x/100*R.fw)+'px';g.style.top=(R.fy+sp.y/100*R.fh)+'px';g.style.background=sp.c;g.style.zIndex=5;
    let down=false;
    g.addEventListener('pointerdown',ev=>{ev.stopPropagation();down=true;_spotSel=i;_selT={t:'spot',i};seRenderPanel();
      const sc2=document.getElementById('se-spotc');if(sc2)sc2.value=sp.c;
      const sr=document.getElementById('se-spotr');if(sr)sr.value=sp.r||45;
      const sa=document.getElementById('se-spota');if(sa){sa.value=sp.a==null?60:sp.a;const v=document.getElementById('se-spota-v');if(v)v.textContent=sa.value;}
      try{g.setPointerCapture(ev.pointerId);}catch(_){ }
      el.querySelectorAll('.gspot').forEach(q=>q.classList.remove('on'));g.classList.add('on');});
    g.addEventListener('pointermove',ev=>{if(!down)return;
      const b=el.getBoundingClientRect();
      sp.x=Math.max(0,Math.min(100,((ev.clientX-b.left)-R.fx)/R.fw*100));
      sp.y=Math.max(0,Math.min(100,((ev.clientY-b.top)-R.fy)/R.fh*100));
      g.style.left=(R.fx+sp.x/100*R.fw)+'px';g.style.top=(R.fy+sp.y/100*R.fh)+'px';});
    const up=ev=>{if(!down)return;down=false;try{g.releasePointerCapture(ev.pointerId);}catch(_){ }
      const arr=getBgSpots();arr[i]=sp;setBgSpots(arr);};
    g.addEventListener('pointerup',up);g.addEventListener('pointercancel',up);
    el.appendChild(g);
  });
}
function seBindRotate(fr){
  const rh=fr.querySelector('.rh');if(!rh)return;
  let down=false,sx=0;
  rh.addEventListener('pointerdown',e=>{down=true;sx=e.clientX;try{rh.setPointerCapture(e.pointerId);}catch(_){}e.stopPropagation();e.preventDefault();});
  rh.addEventListener('pointermove',e=>{
    if(!down)return;
    const slot=window._seSlot,isBg=slot==='bg';
    const d=Math.round((e.clientX-sx)/2);sx=e.clientX;
    const nr=Math.max(-180,Math.min(180,(isBg?getBgRot():getSlotAdj(slot).rot||0)+d));
    if(isBg)setBgRot(nr);else setSlotAdj(slot,{rot:nr});
    const rr=document.getElementById('se-t-rot');if(rr){rr.value=nr;const v=document.getElementById('se-t-rot-v');if(v)v.textContent=nr+'°';}
    seUpdatePreview();
  });
  const up=()=>{down=false;};
  rh.addEventListener('pointerup',up);rh.addEventListener('pointercancel',up);
}
function seBindPreviewDrag(){
  const el=document.getElementById('se-preview');if(!el||el._drag)return;el._drag=1;
  let down=false,sx=0,sy=0,x0=50,y0=50;
  el.addEventListener('pointerdown',e=>{
    const slot=window._seSlot;if(window._seKind!=='slot'||!slot)return;
    if(e.target.closest&&(e.target.closest('.gspot')||e.target.closest('.rh')))return;
    down=true;sx=e.clientX;sy=e.clientY;
    if(slot==='bg'){x0=getBgPosX();y0=getBgPosY();}else{const a=getSlotAdj(slot);x0=a.x;y0=a.y;}
    try{el.setPointerCapture(e.pointerId);}catch(_){ }
    e.preventDefault();
  });
  el.addEventListener('pointermove',e=>{
    if(!down)return;
    const slot=window._seSlot,isBg=slot==='bg';
    const R=seFrameRect(el,slot);
    const url=((window._themeSlots||{})[slot])?`${(window._themeSlots||{})[slot]}?v=${themeVer()}`:(isBg?getBgImgUrl():'');
    const dim=_imgDim[url];
    const z=(isBg?(getBgZoom()||100):(getSlotAdj(slot).zoom||100))/100;
    let rx=1,ry=1;
    if(dim){const cover=Math.max(R.fw/dim[0],R.fh/dim[1]);const dw=dim[0]*cover*z,dh=dim[1]*cover*z;
      rx=(dw>R.fw)?100/(dw-R.fw):0; ry=(dh>R.fh)?100/(dh-R.fh):0;}
    const nx=Math.max(0,Math.min(100,x0-(e.clientX-sx)*rx));
    const ny=Math.max(0,Math.min(100,y0-(e.clientY-sy)*ry));
    if(isBg){setBgPosX(nx);setBgPosY(ny);}else setSlotAdj(slot,{x:Math.round(nx*10)/10,y:Math.round(ny*10)/10});
    seUpdatePreview();
  });
  const up=e=>{if(!down)return;down=false;try{el.releasePointerCapture(e.pointerId);}catch(_){ }};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  el.addEventListener('wheel',e=>{
    const slot=window._seSlot;if(!slot)return;e.preventDefault();
    const d=e.deltaY>0?-8:8;
    if(slot==='bg')setBgZoom(Math.max(100,Math.min(250,(getBgZoom()||100)+d)));
    else{const a=getSlotAdj(slot);setSlotAdj(slot,{zoom:Math.max(50,Math.min(220,(a.zoom||100)+d))});}
    seUpdatePreview();
  },{passive:false});
}
async function seDropImg(e){
  e.preventDefault();e.currentTarget.classList.remove('drag-over');
  const f=e.dataTransfer&&e.dataTransfer.files&&e.dataTransfer.files[0];
  if(f&&window._seSlot)await uploadThemeFile(window._seSlot,f);
}
// 编辑卡顶部的实时预览：当前这个位置的图（或纯色）+ 你调的效果；按住拖＝挪位置
// 相册页：这一块的背景 + 树 一起看；树按住直接拖摆图案，松手自动存
function gpRender(gk){
  const _dft=window._treeDraft||{};
  const box=document.getElementById('ge-preview');if(!box)return;
  gpApplyDecor(gk);
  const grain=localStorage.getItem('garden_grain')||'month';
  const list=(_gTrees||[]).filter(t=>((((grain==='year')?((t.month||'').slice(0,4)):(t.month||''))||'none')===gk));
  const lay=((_gLayout||{})[gk])||{};
  box.querySelectorAll('.gp-tree').forEach(e=>e.remove());
  list.forEach((t,i)=>{
    const d=document.createElement('div');d.className='gp-tree'+(t.hist?' hist':'');d.dataset.bid=String(t.id);
    const pos=lay[t.id]||[8+(i%6)*15.5, 30+Math.floor(i/6)*34];
    d.style.left=pos[0]+'%';d.style.top=pos[1]+'%';
    if(_dft[t.id])t.skin=_dft[t.id];
    const stage=t.finished?5:growthStage(t.progress);
    const when=t.month?('读于 '+t.month):(t.lo?('最近翻看 '+t.lo):'');
    d.title=`${t.title}${t.author?' · '+t.author:''}（${t.hist?'往期读完':(t.finished?'已读完':(t.progress||0)+'%')}${when?' · '+when:''}）`;
    d.innerHTML=`<div class="gp-art">${treeSVG(stage,t.skin)}</div><div class="gp-name">${esc(t.title.length>4?t.title.slice(0,4)+'…':t.title)}</div>`;
    let down=false,moved=false;
    d.addEventListener('pointerdown',e=>{down=true;moved=false;d.setPointerCapture&&d.setPointerCapture(e.pointerId);e.preventDefault();});
    d.addEventListener('pointermove',e=>{
      if(!down)return;moved=true;
      const r=box.getBoundingClientRect();
      const x=Math.max(2,Math.min(96,(e.clientX-r.left)/r.width*100));
      const y=Math.max(12,Math.min(96,(e.clientY-r.top)/r.height*100));
      d.style.left=x+'%';d.style.top=y+'%';
      (_gLayout=_gLayout||{});(_gLayout[gk]=_gLayout[gk]||{})[t.id]=[Math.round(x*10)/10,Math.round(y*10)/10];
    });
    const up=()=>{if(!down)return;down=false;if(moved){saveGardenLayout();document.querySelectorAll(`.garden-grove[data-gkey="${gk}"]`).forEach(applyGroveDecor);}};
    d.addEventListener('pointerup',up);d.addEventListener('pointercancel',up);
    d.addEventListener('click',e=>{if(moved){e.stopPropagation();return;}if(t.hist)return;if(_armedCol){geDyeOne(t,d);}else openTreePicker(parseInt(t.id),t.skin);});
    box.appendChild(d);
  });
}
function gpApplyDecor(gk){
  const bg=document.getElementById('gp-bg'),tx=document.getElementById('gp-tex');if(!bg)return;
  const own=(GARDEN_STYLE||{})[gk],ownImg=(_gardenSlots||{})['garden_'+gk];
  const useDefault=!own&&!ownImg;
  const st=(useDefault?(GARDEN_STYLE||{})['default']:own)||{};
  const img=ownImg||(useDefault?(_gardenSlots||{})['garden_default']:null);
  if(img){bg.style.backgroundImage=`url(${img}?v=${themeVer()})`;bg.style.backgroundColor='';}
  else{bg.style.backgroundImage='';bg.style.backgroundColor=st.color||'';}
  bg.style.filter=(st.blur>0)?`blur(${st.blur}px)`:'';
  if(st.feather>0){const mk=`radial-gradient(ellipse 120% 120% at 50% 50%, #000 ${Math.max(0,100-st.feather)}%, transparent 100%)`;bg.style.webkitMaskImage=mk;bg.style.maskImage=mk;}
  else{bg.style.webkitMaskImage='';bg.style.maskImage='';}
  const t2=BG_TEXTURES[st.tex];
  if(tx){if(t2&&(st.texInt||0)>0){tx.style.backgroundImage=`url(${t2.url})`;tx.style.backgroundSize=t2.size;tx.style.opacity=Math.min(1,(st.texInt||0)/100);}else{tx.style.opacity=0;tx.style.backgroundImage='';}}
}
async function openGardenAlbum(){
  if(GARDEN_STYLE===null||_gardenSlots===null||_gTrees===null)await loadGardenDecor();
  openEditor('grove',(_gKeys&&_gKeys[0])||'none');
}
let _armedCol=null;
function geRenderSwatches(){
  const box=document.getElementById('ge-swatches');if(!box)return;
  const cols=resolvePalette((document.getElementById('ge-pal')||{}).value||getCoverPalette());
  box.innerHTML=cols.map(c=>`<span class="cb-sw ${c===_armedCol?'on':''}" style="background:${c};width:24px;height:24px" title="点一下上膛，再点预览里的小树给它上这个色" onclick="geArm('${c}')"></span>`).join('');
}
function geArm(c){
  _armedCol=(_armedCol===c)?null:c;
  const t=document.getElementById('ge-treecolor');if(t)t.value=c;
  geRenderSwatches();
  toast(_armedCol?('已选色 '+c+'，点预览里的小树上色'):'已取消选色');
}
async function geDyeOne(t,el){
  const sp=String(t.skin||'spruce').split('|')[0]||'spruce';
  try{
    t.skin=sp+'|'+_armedCol;
    if(_live())await fetch('/api/book/tree-skin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:t.id,skin:t.skin})});
    else (window._treeDraft=window._treeDraft||{})[t.id]=t.skin;
    const art=el.querySelector('.gp-art');if(art)art.innerHTML=treeSVG(t.finished?5:growthStage(t.progress),t.skin);
    toast('这棵换好了');
  }catch(e){toast('没染上');}
}
// 按色卡整块染：每棵树保留自己的树种，颜色按色卡轮着来
async function geDyePalette(){
  const gk=window._groveGk;if(!gk||gk==='default')return;
  const cols=resolvePalette((document.getElementById('ge-pal')||{}).value||getCoverPalette());
  try{
    const r=await (await fetch('/api/journey/garden')).json();
    const grain=localStorage.getItem('garden_grain')||'month';
    const list=(r.trees||[]).filter(t=>{const k=(grain==='year')?((t.month||'').slice(0,4)):(t.month||'');return (k||'none')===gk;});
    if(!list.length){toast('这一块没有树');return;}
    for(let i=0;i<list.length;i++){
      const t=list[i];
      const sp=String(t.skin||'spruce').split('|')[0]||'spruce';
      t.skin=sp+'|'+cols[Math.floor(Math.random()*cols.length)];
      if(!_live()){(window._treeDraft=window._treeDraft||{})[t.id]=t.skin;continue;}
      await fetch('/api/book/tree-skin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({book_id:t.id,skin:t.skin})});
    }
    list.forEach(t2=>{const g=(_gTrees||[]).find(q=>q.id===t2.id);if(g)g.skin=t2.skin;});
    gpRender(gk);
    toast('已按色卡随机上色 '+list.length+' 棵，不满意再点一次');
    const jp=document.getElementById('journey-page');
    if(jp&&jp.style.display&&jp.style.display!=='none')loadJourney('overview');
  }catch(e){toast('没染上：'+(e&&e.message||e));}
}

async function seDelImg(slot){
  try{await fetch('/api/theme/user/'+slot,{method:'DELETE'});}catch(e){}
  if(slot==='bg')localStorage.setItem('home_bg_source',getBgImgUrl()?'scheme':'');
  localStorage.setItem('theme_ver',String(Date.now()));
  if(window._themeSlots)delete window._themeSlots[slot];
  loadThemeUploads();await applyUserTheme();
  openSlotEditor(slot);   // 留在卡片里：主背景删图后可直接点"底色"调纯色
  toast(slot==='bg'?'图片已删，想用纯色就点卡片里的「底色」':'图片已删');
}

// 应用用户上传的背景/插画条/边角
async function applyUserTheme(){
  if(!_live())return;   // 面板开着=草稿态：页面冻结，「保存并刷新」才生效
  try{
    const r=await (await fetch('/api/theme/list')).json();
    const slots=r.slots||{};
    window._themeSlots=slots;
    // 主背景（纯色模式 > 用户上传 > 预设）
    const bg=document.getElementById('theme-bg');
    if(getBgMode()==='color'){
      renderColorBg();                            // 纯色接管主背景；上传的图还留着，「用回图片背景」随时切回
    }else{
      bg.style.backgroundColor='';
      const preferScheme=(localStorage.getItem('home_bg_source')==='scheme')&&getBgImgUrl();
      const _ov=spotLayers().concat(gradLayer());
      const _mk=u=>(_ov.length?_ov.join(', ')+', ':'')+`url(${u})`;
      if(slots.bg&&!preferScheme){
        // 关键：带版本号 → 重传同名图（bg.jpg）时 URL 变化，浏览器才会取新图，不再永远显示第一张
        bg.style.backgroundImage=_mk(`${slots.bg}?v=${themeVer()}`);bg.classList.remove('tiled');
        document.body.classList.add('has-bg');
      }else{
        // 没有上传图时回落到方案里选的图（例如水彩/雾蓝）
        const u=getBgImgUrl();
        if(u){bg.style.backgroundImage=_mk(u);bg.classList.remove('tiled');document.body.classList.add('has-bg');}
        else{bg.style.backgroundImage='';bg.classList.remove('tiled');document.body.classList.remove('has-bg');}
      }
      applyBgAdjust();      // 应用模糊 / 边缘羽化
      applyVeil();
      renderTexOverlay();applyVign();applyMist();renderShapeOverlay();
    }
    // 顶部插画条
    const strip=document.getElementById('theme-strip');
    if(slots.strip&&featOn('deco')){strip.innerHTML=`<img src="${slots.strip}?v=${themeVer()}" alt="">`;strip.classList.add('show');}
    else{strip.classList.remove('show');strip.innerHTML='';}
    // 底部横幅（对称于顶部插画条，贴页面底边）
    const bstrip=document.getElementById('theme-strip-bottom');
    if(bstrip){
      if(slots.strip_bottom&&featOn('deco')){bstrip.innerHTML=`<img src="${slots.strip_bottom}?v=${themeVer()}" alt="">`;bstrip.classList.add('show');}
      else{bstrip.classList.remove('show');bstrip.innerHTML='';}
    }
    // 书架两侧装饰竖条(同一张图,右侧镜像)
    const sdl=document.getElementById('side-l'),sdr=document.getElementById('side-r');
    if(sdl)sdl.style.backgroundImage=slots.corner?`url(${slots.corner}?v=${themeVer()})`:'';
    if(sdr)sdr.style.backgroundImage=slots.side_r?`url(${slots.side_r}?v=${themeVer()})`:'';
    const jb=document.getElementById('journey-bg');
    if(jb)jb.style.backgroundImage=slots.journey_bg?`url(${slots.journey_bg}?v=${themeVer()})`:'';
    const jn=document.getElementById('journey-banner');
    if(jn){if(slots.journey_banner){jn.style.backgroundImage=`url(${slots.journey_banner}?v=${themeVer()})`;jn.style.display='';}else{jn.style.display='none';jn.style.backgroundImage='';}}
    applySlotAdjust('strip');applySlotAdjust('strip_bottom');applySlotAdjust('corner');applySlotAdjust('side_r');applySlotAdjust('journey_bg');applySlotAdjust('journey_banner');
  }catch(e){}
}

