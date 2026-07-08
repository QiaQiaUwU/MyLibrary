// ╔══ 20_quill.js —— Quill 书库精灵 · 面板/对话/贴图/记忆/播报/待办/习惯/玄学 ══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。

// ===== Quill 书库精灵 =====
// 入口形象（化身）——用 Lucide 开源图标，简洁优雅。Quill 始终是 Quill，这只是它显示的样子。
// 都是无机/静物，点击有微互动
const QUILL_AVATARS={
  feather:{name:'羽毛笔',svg:'<svg viewBox=\"0 0 24 24\"><path d=\"M21 1.99669C6 1.99669 4 15.9967 3 21.9967C3.66667 21.9967 4.33275 21.9967 4.99824 21.9967C5.66421 18.6636 7.33146 16.8303 10 16.4967C14 15.9967 17 12.4967 18 9.49669L16.5 8.49669C16.8333 8.16336 17.1667 7.83002 17.5 7.49669C18.5 6.49669 19.5042 4.99669 21 1.99669Z\"></path></svg>'},
  clock:{name:'小钟表',svg:'clock'},
  sparkle:{name:'萤火',svg:'<svg viewBox=\"0 0 24 24\"><path d=\"M17.0007 1.20825 18.3195 3.68108 20.7923 4.99992 18.3195 6.31876 17.0007 8.79159 15.6818 6.31876 13.209 4.99992 15.6818 3.68108 17.0007 1.20825ZM8.00065 4.33325 10.6673 9.33325 15.6673 11.9999 10.6673 14.6666 8.00065 19.6666 5.33398 14.6666.333984 11.9999 5.33398 9.33325 8.00065 4.33325ZM19.6673 16.3333 18.0007 13.2083 16.334 16.3333 13.209 17.9999 16.334 19.6666 18.0007 22.7916 19.6673 19.6666 22.7923 17.9999 19.6673 16.3333Z\"></path></svg>'},
  moon:{name:'月相',svg:'moon'},  // 特殊：显示当前月相
  leaf:{name:'叶子',svg:'<svg viewBox=\"0 0 24 24\"><path d=\"M20.998 3V5C20.998 14.6274 15.6255 19 8.99805 19L7.0964 18.9999C7.3079 15.9876 8.24541 14.1648 10.6939 11.9989C11.8979 10.9338 11.7965 10.3189 11.2029 10.6721C7.1193 13.1016 5.09114 16.3862 5.00119 21.6302L4.99805 22H2.99805C2.99805 20.6373 3.11376 19.3997 3.34381 18.2682C3.1133 16.9741 2.99805 15.2176 2.99805 13C2.99805 7.47715 7.4752 3 12.998 3C14.998 3 16.998 4 20.998 3Z\"></path></svg>'},
};
// 月相计算：返回 0-1 的月相（0=新月，0.5=满月）
let _sproutP=null;
async function sproutProgress(){
  if(_sproutP!=null)return _sproutP;
  try{
    const r=await (await fetch('/api/journey/garden')).json();
    const reading=(r.trees||[]).filter(t=>!t.finished&&!t.hist);
    _sproutP=reading.length?Math.max(...reading.map(t=>t.progress||0)):0;
  }catch(e){_sproutP=0;}
  const fab=document.getElementById('quill-fab');
  if(fab&&getQuillAvatar()==='sprout'){const a=fabAv();if(a)a.innerHTML=sproutSVG();}
  return _sproutP;
}
function sproutSVG(){
  const p=Math.max(0,Math.min(100,_sproutP||0));
  const stemH=4+p/100*9.5, top=18.5-stemH;
  let leaves=`<path d="M12 ${(top+2.8).toFixed(1)} C 9.8 ${(top+2).toFixed(1)} 8.7 ${(top+3.3).toFixed(1)} 8.3 ${(top+4.9).toFixed(1)} C 10.4 ${(top+5.1).toFixed(1)} 11.6 ${(top+4.3).toFixed(1)} 12 ${(top+2.8).toFixed(1)}Z"/>`;
  if(p>=35)leaves+=`<path d="M12 ${(top+1.4).toFixed(1)} C 14.2 ${(top+0.6).toFixed(1)} 15.3 ${(top+1.9).toFixed(1)} 15.7 ${(top+3.5).toFixed(1)} C 13.6 ${(top+3.7).toFixed(1)} 12.4 ${(top+2.9).toFixed(1)} 12 ${(top+1.4).toFixed(1)}Z"/>`;
  if(p>=75)leaves+=`<circle cx="12" cy="${(top-0.8).toFixed(1)}" r="1.4"/>`;
  return `<svg viewBox="0 0 24 24" fill="currentColor" fill-opacity=".28" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20.5h10" fill="none" opacity=".6"/><path d="M12 19 L12 ${top.toFixed(1)}" fill="none"/>${leaves}</svg>`;
}
function moonPhase(){
  const now=new Date();
  // 已知2000-01-06 18:14 UTC为新月，朔望月周期29.530588853天
  const known=new Date(Date.UTC(2000,0,6,18,14)).getTime();
  const synodic=29.530588853*86400000;
  let phase=((now.getTime()-known)%synodic)/synodic;
  if(phase<0)phase+=1;
  return phase;
}
// 画月相 SVG：圆 A（月轮）减去偏移的圆 B（阴影）——用一个"大矩形挖掉圆 B"的反向裁剪区裁 A，
// 落地就是"A 里但不在 B 里"的部分，天然是干净的月牙/凸月轮廓，不需要画阴影色、不用愁圆弧扫描方向对不对。
function moonSVG(){
  const p=moonPhase(),r=8.6,cx=12,cy=12;
  const f=(1-Math.cos(2*Math.PI*p))/2;
  const ring=`<circle class="ln" cx="${cx}" cy="${cy}" r="${r}" stroke-width="1.5"/>`;
  if(f<0.04)return `<svg class="q-dyn" viewBox="0 0 24 24">${ring}</svg>`;
  if(f>0.96)return `<svg class="q-dyn" viewBox="0 0 24 24">${ring}<circle class="fl" cx="${cx}" cy="${cy}" r="${(r-2.4).toFixed(1)}" opacity=".5"/></svg>`;
  const dMag=r*(1-Math.cos(2*Math.PI*p));   // 偏移量大小：新月0 → 满月2r
  const d=(p<0.5)?-dMag:dMag;               // 上弦（增）阴影在左、下弦（亏）阴影在右——月牙方向左右镜像，不能用同一个符号
  const shx=(cx+d).toFixed(2);
  const uid='qmc'+Math.floor(Math.random()*1e6);
  const notShadow=`M-20,-20 H44 V44 H-20 Z M${(+shx-r).toFixed(2)},${cy} A${r},${r} 0 1,0 ${(+shx+r).toFixed(2)},${cy} A${r},${r} 0 1,0 ${(+shx-r).toFixed(2)},${cy} Z`;
  return `<svg class="q-dyn" viewBox="0 0 24 24"><defs><clipPath id="${uid}"><path fill-rule="evenodd" d="${notShadow}"/></clipPath></defs>`
    +`${ring}<circle class="fl" cx="${cx}" cy="${cy}" r="${r}" opacity=".55" clip-path="url(#${uid})"/></svg>`;
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
window.addEventListener('error',(()=>{let last=0;return e=>{const now=Date.now();if(now-last<5000)return;last=now;try{toast('脚本出错：'+(e.message||'').slice(0,80));}catch(_){}};})());
let quillSessionId=null,quillGreeted=false,quillClockTimer=null;
document.addEventListener('dblclick',e=>{
  const lk=e.target.closest&&e.target.closest('.q-lk');
  if(!lk)return;
  const q=lk.dataset.q||lk.textContent;
  const inp=document.getElementById('search');
  if(inp){inp.value=q;inp.dispatchEvent(new Event('input'));inp.focus();window.scrollTo({top:0,behavior:'smooth'});}
});
function getQuillAvatar(){const k=localStorage.getItem('quill_avatar')||'feather';return QUILL_AVATARS[k]?k:'feather';}
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
  let dragging=false,sx,sy,ox,oy,moved=false,patT=null;
  const start=(e)=>{
    dragging=true;moved=false;
    const t=e.touches?e.touches[0]:e;
    sx=t.clientX;sy=t.clientY;
    const r=fab.getBoundingClientRect();ox=r.left;oy=r.top;
    fab.style.transition='none';
    // 按住不动 550ms = 摸头（一旦移动就取消，变成拖动）
    if(patT)clearTimeout(patT);
    patT=setTimeout(()=>{patT=null;window._quillDragged=true;doQuillPat();},550);
  };
  const move=(e)=>{
    if(!dragging)return;
    const t=e.touches?e.touches[0]:e;
    const dx=t.clientX-sx,dy=t.clientY-sy;
    if(Math.abs(dx)>5||Math.abs(dy)>5){moved=true;if(patT){clearTimeout(patT);patT=null;}}
    if(moved){
      if(e.cancelable)e.preventDefault();
      let nx=ox+dx,ny=oy+dy;
      nx=Math.max(4,Math.min(window.innerWidth-60,nx));
      ny=Math.max(4,Math.min(window.innerHeight-60,ny));
      fab.style.left=nx+'px';fab.style.top=ny+'px';fab.style.right='auto';fab.style.bottom='auto';
    }
  };
  const end=()=>{
    if(patT){clearTimeout(patT);patT=null;}
    if(!dragging)return;dragging=false;fab.style.transition='';
    if(moved){
      window._quillDragged=true;
      const r=fab.getBoundingClientRect();
      localStorage.setItem('quill_fab_pos',JSON.stringify({x:r.left,y:r.top}));
    }
    // v4.5.1：松手后无论有没有后续 click，这个标志都要归零。
    // 之前只靠 quillFabClick 消费——触屏拖动/摸头后常常根本不来 click，
    // 标志卡在 true，悬浮火苗彩蛋的门就永远关着（"火花没反应"的真凶）。
    setTimeout(()=>{window._quillDragged=false;},320);
  };
  fab.addEventListener('contextmenu',e=>e.preventDefault());  // 手机长按摸头时不弹系统菜单
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
  const d=new Date(),h=d.getHours()%12,mi=d.getMinutes();
  const ha=((h+mi/60)*30-90)*Math.PI/180, ma=(mi*6-90)*Math.PI/180;
  const hx=(12+4.3*Math.cos(ha)).toFixed(1), hy=(12+4.3*Math.sin(ha)).toFixed(1);
  const mx=(12+6.3*Math.cos(ma)).toFixed(1), my=(12+6.3*Math.sin(ma)).toFixed(1);
  return `<svg class="q-dyn" viewBox="0 0 24 24"><circle class="ln" cx="12" cy="12" r="9" stroke-width="1.6"/><path class="ln" d="M12 12L${hx} ${hy}" stroke-width="1.8" stroke-linecap="round"/><path class="ln" d="M12 12L${mx} ${my}" stroke-width="1.2" stroke-linecap="round"/><circle class="fl" cx="12" cy="12" r="1"/></svg>`;
}
function fabAv(){
  // 化身只画在 .qf-av 内层，火苗/节气小佩饰贴在外层，互不覆盖
  const fab=document.getElementById('quill-fab');if(!fab)return null;
  let av=fab.querySelector('.qf-av');
  if(!av){av=document.createElement('span');av.className='qf-av';fab.prepend(av);}
  return av;
}
function updateFabAvatar(){
  const fab=document.getElementById('quill-fab');if(!fab)return;
  const k=getQuillAvatar();const v=QUILL_AVATARS[k];
  const av=fabAv();if(av)av.innerHTML=avatarInner(k,v);
  if(quillClockTimer){clearInterval(quillClockTimer);quillClockTimer=null;}
  if(k==='clock'){quillClockTimer=setInterval(()=>{const a=fabAv();if(a)a.innerHTML=clockSVG();},30000);}
  // 萤火形象：启动界面荧光
  toggleFireflies(k==='sparkle');
  renderFabBadges();
}
function openQuill(){
  document.getElementById('quill-fab').style.display='none';
  document.getElementById('quill-panel').classList.add('show');
  loadQuillCfg();
  fetch('/api/settings').then(r=>r.json()).then(j=>{window._quillCfgOk=!!(j&&j.ai&&j.ai.api_key);setQuillDot();}).catch(()=>{});
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
async function loadQuillStickers(){
  try{
    const r=await (await fetch('/api/quill/stickers')).json();
    const box=document.getElementById('q-stk-row');if(!box)return;
    box.innerHTML=(r.stickers||[]).map(x=>`<span class="it"><img src="/api/quill/sticker/${encodeURIComponent(x.name)}" title="${x.name}"><span class="x" onclick="delQuillSticker('${x.name}')">×</span></span>`).join('')||'<span style="font-size:12px;color:var(--ink-faint)">还没有——上传几张，Quill 聊天时会用</span>';
  }catch(e){}
}
function openStkImport(){document.getElementById('stk-import').style.display='block';}
async function runStkImport(btn){
  const ta=document.getElementById('stk-imp-ta');
  const lines=(ta.value||'').split('\n').map(x=>x.trim()).filter(Boolean);
  if(!lines.length)return;
  const items=[];
  lines.forEach((ln,i)=>{
    const m2=ln.match(/https?:\/\/\S+/);if(!m2)return;
    const url=m2[0];
    const name=ln.replace(url,'').replace(/[:：]/g,' ').trim().slice(0,16)||('贴图'+(i+1));
    items.push({name,url});
  });
  if(!items.length){toast('没识别到 URL');return;}
  btn.disabled=true;btn.textContent='导入中…';
  try{
    const r=await (await fetch('/api/quill/sticker-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})})).json();
    toast(`导入完成：成功 ${r.ok_count||0}，失败 ${r.fail_count||0}`);
  }catch(e){toast('导入出错');}
  btn.disabled=false;btn.textContent='开始导入';
  document.getElementById('stk-import').style.display='none';
  loadQuillStickers();
}
async function uploadQuillSticker(input){
  const f=input.files&&input.files[0];input.value='';
  if(!f)return;
  const fd=new FormData();fd.append('file',f);
  await fetch('/api/quill/sticker-upload',{method:'POST',body:fd}).catch(()=>{});
  loadQuillStickers();
}
async function delQuillSticker(n){
  await fetch('/api/quill/sticker/'+encodeURIComponent(n),{method:'DELETE'}).catch(()=>{});
  loadQuillStickers();
}
function toggleQuillSettings(){loadQuillStickers();qmemLoad();qpLoadUI();qtodoLoad();qhabitLoad();
  setTimeout(()=>{const b=document.querySelector('#quill-panel .quill-body');if(b)b.scrollTop=0;const c=document.getElementById('quill-settings');if(c)c.scrollTop=0;const pn=document.getElementById('quill-panel');if(pn)pn.scrollTop=0;},0);const _s=document.getElementById('quill-settings');_s.classList.toggle('show');document.getElementById('quill-panel').classList.toggle('settings-open',_s.classList.contains('show'));document.getElementById('quill-sessions').classList.remove('show');}
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
function setQuillDot(){
  const d=document.querySelector('.quill-dot');if(!d)return;
  d.classList.remove('standby');
  if(window._quillCfgOk===false)d.classList.add('standby');
}
function loadQuillCfg(){
  try{
    const t=localStorage.getItem('quill_tone');if(t)document.getElementById('quill-tone').value=t;
    const p=localStorage.getItem('quill_persona');if(p)document.getElementById('quill-persona').value=p;
    const sw=document.getElementById('qf-season-sw');if(sw)sw.checked=localStorage.getItem('qf_season')!=='0';
    const fw=document.getElementById('qf-finish-sw');if(fw)fw.checked=localStorage.getItem('qf_finish')!=='0';
  }catch(e){}
  updateGrowHint();
}
function toggleFinishCele(on){localStorage.setItem('qf_finish',on?'1':'0');}
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
window._qImg='';
function qPickImg(input){
  const f=input.files&&input.files[0];input.value='';
  if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{window._qImg=rd.result;qImgChip();};
  rd.readAsDataURL(f);
}
function qImgChip(){
  const box=document.getElementById('q-img-chip');if(!box)return;
  box.innerHTML=window._qImg?`<img src="${window._qImg}"><span onclick="window._qImg='';qImgChip()">×</span>`:'';
}
function _qRender(text){
  let html=esc(text);
  html=html.replace(/\[贴图[:：]([^\]\s]{1,24})\]/g,(m,n)=>`<img class="q-stk" src="/api/quill/sticker/${encodeURIComponent(n)}" alt="${n}">`);
  html=html.replace(/\[图片[:：](https?:[^\]\s]+)\]/g,(m,u)=>`<img class="q-img" src="${u}">`);
  html=html.replace(/\[折叠[:：]([^\]]{1,30})\]([\s\S]*?)\[\/折叠\]/g,(m,t,body)=>`<details class="q-fold"><summary>${t}</summary>${body}</details>`);
  html=html.replace(/\*\*([^*\n]{1,60})\*\*/g,'<b>$1</b>');
  // markdown 表格：连续以 | 开头的行
  html=html.replace(/((?:^\|.*\|\s*$\n?){2,})/gm,block=>{
    const rows=block.trim().split('\n').map(r=>r.replace(/^\||\|$/g,'').split('|').map(c=>c.trim()));
    const body=rows.filter(r=>!r.every(c=>/^[-: ]+$/.test(c)));
    if(!body.length)return block;
    const tr=body.map((r,i)=>`<tr>${r.map(c=>{
      const styled=c.replace(/正位/g,'<span class="q-up">正位</span>').replace(/逆位/g,'<span class="q-rev">逆位</span>');
      return i===0?`<th>${styled}</th>`:`<td>${styled}</td>`;
    }).join('')}</tr>`).join('');
    return `<table class="q-tbl">${tr}</table>`;
  });
  return _qLinkify(html);
}
function _qLinkify(html){
  html=html.replace(/《([^《》<]{1,40})》/g,(m,t)=>`《<span class="q-lk" data-q="${t.replace(/"/g,'&quot;')}">${t}</span>》`);
  html=html.replace(/（作者[:：]\s*([^）<]{1,20})）/g,(m,a)=>`（作者：<span class="q-lk" data-q="${a.trim().replace(/"/g,'&quot;')}">${a.trim()}</span>）`);
  return html;
}
function addQuillMsg(text,who,msgId,starred){
  const box=document.getElementById('quill-msgs');
  const d=document.createElement('div');d.className='qm '+who;
  if(who==='quill')d.innerHTML=_qRender(text);else d.textContent=text;
  d.dataset.raw=text;
  if(msgId)d.dataset.msgId=msgId;
  // "翻书中…"这条占位气泡马上会被替换掉，不挂操作图标
  if(!/thinking/.test(who)){
    const act=document.createElement('span');act.className='qm-act';
    if(who==='quill'){
      if(msgId){
        const star=document.createElement('span');star.className='qm-star'+(starred?' on':'');star.textContent='★';
        star.title='记下这句话';
        star.onclick=()=>{toggleStar(msgId,star);};
        act.appendChild(star);
      }
      const redo=document.createElement('span');redo.className='qm-redo';redo.textContent='↻';redo.title='不满意？重新生成';
      redo.onclick=()=>{quillRegenerate(d);};
      act.appendChild(redo);
    }else if(who==='user'){
      const recall=document.createElement('span');recall.className='qm-recall';recall.textContent='↺';recall.title='撤回到输入框重新编辑';
      recall.onclick=()=>{quillRecall(d);};
      act.appendChild(recall);
    }
    if(act.children.length)d.appendChild(act);
  }
  box.appendChild(d);box.scrollTop=box.scrollHeight;
  return d;
}
// 撤回：把这条用户消息连同它引出的回复一起从服务端和界面上撤掉，原文退回输入框接着改
async function quillRecall(el){
  const raw=el.dataset.raw||el.textContent;
  const msgId=el.dataset.msgId;
  if(msgId&&quillSessionId){
    try{
      await fetch('/api/quill/messages/truncate',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({session_id:quillSessionId,from_message_id:msgId})});
    }catch(e){}
  }
  let node=el;
  while(node){const next=node.nextElementSibling;node.remove();node=next;}   // 自己和之后的回复一并从界面撤掉
  quillFill(raw);
}
// 重新生成：清掉旧的一问一答，用同一句话再问一遍
async function quillRegenerate(el){
  const userEl=el.previousElementSibling;
  if(!userEl||!userEl.classList.contains('user')){if(typeof toast==='function')toast('找不到对应的提问，没法重新生成');return;}
  const userText=userEl.dataset.raw||userEl.textContent;
  const truncFrom=userEl.dataset.msgId||el.dataset.msgId;
  if(truncFrom&&quillSessionId){
    try{
      await fetch('/api/quill/messages/truncate',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({session_id:quillSessionId,from_message_id:truncFrom})});
    }catch(e){}
  }
  el.remove();
  quillSend(userText,{userEl});
}
async function toggleStar(msgId,el){
  const on=!el.classList.contains('on');
  el.classList.toggle('on',on);
  try{await fetch('/api/quill/message/star',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message_id:msgId,starred:on})});
    toast(on?'已记下这句话':'已取消');
  }catch(e){}
}
// 把 prompt 模板填入输入栏，不发送，让用户自己改
function qpCfg(){try{return JSON.parse(localStorage.getItem('home_quill_push')||'{}');}catch(e){return {};}}
function qpSave(){
  const subs={};
  document.querySelectorAll('#qp-subs input[data-sub]').forEach(x=>subs[x.dataset.sub]=x.checked);
  const rssPre=[];
  document.querySelectorAll('#qp-rss-pre input[data-rssp]').forEach(x=>{if(x.checked)rssPre.push(x.dataset.rssp);});
  let time=(document.getElementById('qp-time')||{}).value||'';
  if(!time&&Object.values(subs).some(Boolean)){
    time='08:00';  // 默认早上八点
    const t=document.getElementById('qp-time');if(t)t.value=time;
  }
  const c={time,
           city:((document.getElementById('qp-city')||{}).value||'').trim(),
           rss:((document.getElementById('qp-rss')||{}).value||'').trim(),
           rssPre,
           note:((document.getElementById('qp-note')||{}).value||'').trim(),
           subs};
  localStorage.setItem('home_quill_push',JSON.stringify(c));
  if(Object.values(subs).some(Boolean)&&('Notification' in window)&&Notification.permission==='default')Notification.requestPermission();
}
function qpLoadUI(){
  const c=qpCfg();
  const t=document.getElementById('qp-time');if(t)t.value=c.time||'';
  const ci=document.getElementById('qp-city');if(ci)ci.value=c.city||'';
  const r=document.getElementById('qp-rss');if(r)r.value=c.rss||'';
  const n=document.getElementById('qp-note');if(n)n.value=c.note||'';
  document.querySelectorAll('#qp-subs input[data-sub]').forEach(x=>{x.checked=!!(c.subs||{})[x.dataset.sub];});
  qpRenderPresets();
  const pre=new Set(c.rssPre||[]);
  document.querySelectorAll('#qp-rss-pre input[data-rssp]').forEach(x=>{x.checked=pre.has(x.dataset.rssp);});
}
function qpToday(){  // 本地日期（原 toISOString 是 UTC，中国时区早上八点前会算成昨天，导致重复/漏推）
  const d=new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
async function qpFire(c){
  const today=qpToday();
  const sub=c.subs||{};
  const parts=[];
  if(sub.draw){
    const val=await qdrawGetToday();
    parts.push('每日一签：今天抽到「'+val+'」，给一句签语。');
  }
  if(sub.weather)parts.push('天气：查'+(c.city||'我常在的城市')+'，给几点起降雨/降雪及概率、温度区间、风力。');
  if(sub.fortune)parts.push('运势·宜忌：用今日黄历(paipan_today)结合我的八字流日(有生辰记忆则 paipan_yunshi)，给宜/忌各两条和一句提醒。');
  if(sub.tarot)parts.push('每日塔罗：draw_tarot 抽一张并两句解读。');
  if(sub.english)parts.push('英文美文：一段80词内英文短文+中文翻译。');
  if(sub.poem)parts.push('每日古诗：一首短诗原文+一句白话点睛。');
  if(sub.history)parts.push('历史上的今天：2-3条+各一句话。');
  if(sub.news){
    const own=(c.rss||'').split('\n').map(x=>x.trim()).filter(Boolean);
    const urls=[...new Set([...(c.rssPre||[]),...own])].slice(0,6);
    if(urls.length)parts.push('新闻订阅：对下列每个源用 fetch_rss 各取2-3条，每条配一句话；抓不到的源直接跳过，不必道歉：'+urls.join(' ; '));
  }
  if(c.note)parts.push('自定义抓取：'+c.note);
  if(!parts.length)return false;
  const msg='推送任务·'+today+'：请分板块播报，句式每天要换。\n'+parts.map((x,i)=>(i+1)+'. '+x).join('\n');
  try{
    const sidKey='qpush_sid_'+today;
    const body={message:msg,tone:localStorage.getItem('quill_tone')||'warm',book_title:'每日播报 '+today};
    const sid=localStorage.getItem(sidKey);if(sid)body.session_id=sid;
    const r=await (await fetch('/api/quill/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
    if(r.session_id)localStorage.setItem(sidKey,r.session_id);
    if(!r||r.error||!r.reply)return false;  // API 没额度/出错 → 交给外层每 15 分钟自动重试
    const bodyTxt=(r.reply||'').replace(/\[[^\]]*\]/g,'').replace(/[|#*]/g,'').slice(0,180)||'（没拿到内容）';
    if(('Notification' in window)&&Notification.permission==='granted'){
      const n=new Notification('Quill · 今日播报',{body:bodyTxt});
      n.onclick=()=>{window.focus();openQuill&&openQuill();};
    }else toast('今日播报：'+bodyTxt.slice(0,60));
    return true;
  }catch(e){return false;}
}
async function qtodoTick(){
  try{
    const r=await (await fetch('/api/quill/todos')).json();
    const now=Date.now();
    let seen={};try{seen=JSON.parse(localStorage.getItem('qtodo_seen')||'{}');}catch(e){}
    (r.todos||[]).forEach(t=>{
      if(t.done||!t.due||seen[t.id])return;
      const due=new Date(t.due.replace(' ','T')).getTime();
      if(isNaN(due))return;
      const diff=due-now;
      if(diff>0&&diff<=30*60000){
        seen[t.id]=1;localStorage.setItem('qtodo_seen',JSON.stringify(seen));
        if(('Notification' in window)&&Notification.permission==='granted'){
          const n=new Notification('Quill · 待办快到点',{body:t.text+'（'+t.due+'）'});
          n.onclick=()=>{window.focus();openQuill&&openQuill();};
        }else toast('待办快到点：'+t.text);
      }
    });
  }catch(e){}
}
async function qtodoLoad(){
  try{
    const r=await (await fetch('/api/quill/todos')).json();
    const box=document.getElementById('qtodo-list');if(!box)return;
    const rows=(r.todos||[]);
    box.innerHTML=rows.length?rows.map(t=>'<div style="display:flex;gap:8px;align-items:center;margin:3px 0;'+(t.done?'opacity:.45;text-decoration:line-through':'')+'"><span style="flex:1">'+esc(t.text)+(t.due?' <span style="color:var(--ink-faint)">'+esc(t.due)+'</span>':'')+'</span>'+(t.done?'':'<a style="color:var(--accent);cursor:pointer" onclick="qtodoDone('+t.id+')">✓</a>')+'<a style="color:#b3563f;cursor:pointer" onclick="qtodoDel('+t.id+')">×</a></div>').join(''):'<span style="color:var(--ink-faint)">还没有——对 Quill 说"提醒我周五交报告"试试</span>';
  }catch(e){}
}
async function qtodoDone(id){await fetch('/api/quill/todos/'+id+'/done',{method:'POST'});qtodoLoad();}
async function qtodoDel(id){await fetch('/api/quill/todos/'+id,{method:'DELETE'});qtodoLoad();}
setInterval(()=>{
  qtodoTick();
  qhabitTick();
  const c=qpCfg();
  if(!Object.values(c.subs||{}).some(Boolean))return;
  const today=qpToday();
  if(localStorage.getItem('qpush_date')===today)return;         // 今天已推成功
  const now=new Date();
  const hm=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  if(hm<(c.time||'08:00'))return;                               // 没到点（默认早八）；过了点没推成会一直补
  const lastTry=parseInt(localStorage.getItem('qpush_try_ts')||'0');
  if(Date.now()-lastTry<14.5*60000)return;                      // 失败后每 15 分钟重试一次，等 API 有额度
  localStorage.setItem('qpush_try_ts',String(Date.now()));
  qpFire(c).then(ok=>{
    if(ok){localStorage.setItem('qpush_date',today);maybeShowTermCard();return;}
    const fk='qpush_failnote_'+today;
    if(!localStorage.getItem(fk)){localStorage.setItem(fk,'1');toast('今日播报暂时没发出去（接口额度/网络），会每 15 分钟自动重试');}
  });
},60000);
const _RPS=['✊','✋','✌'];
const _DICE_FACE=['⚀','⚁','⚂','⚃','⚄','⚅'];   // 真骰子点数脸，不再是纯数字
const _QG_LINES={
  win:['嘿嘿，让你一回都不行！','这局是我的！尾巴翘起来了~','赢啦！今晚加读一章庆祝。','哼哼，羽毛都得意得竖起来了。'],
  lose:['呜……让你赢一次啦。','好吧好吧，你厉害。','输了，我去角落画圈圈（假装）。','下次一定扳回来！'],
  tie:['平局！心有灵犀嘛。','再来再来，不分胜负怎么行。','嗯？我们想到一块去了。','势均力敌，握爪！']
};
function qMood(kind){
  const d=document.querySelector('.quill-dot');if(!d)return;
  d.classList.remove('mood-win','mood-lose','mood-tie','mood-shy');void d.offsetWidth;
  d.classList.add('mood-'+kind);
  setTimeout(()=>d.classList.remove('mood-'+kind),2100);
}
function qGame(kind){
  const g=document.getElementById('qgame'),you=document.getElementById('qg-you'),me=document.getElementById('qg-me'),
        pick=document.getElementById('qg-pick'),res=document.getElementById('qg-res'),title=document.getElementById('qg-title');
  g.style.display='block';res.textContent='';
  if(kind==='rps'){
    title.textContent='猜拳';you.textContent='✊';me.textContent='✊';
    pick.innerHTML=_RPS.map((h,i)=>'<button onclick="qgRps('+i+')">'+h+'</button>').join('');
    g.classList.add('rolling');
  }else{
    title.textContent='掷骰子 · 比大小';pick.innerHTML='';
    you.textContent=_DICE_FACE[0];me.textContent=_DICE_FACE[0];g.classList.add('dice-tumble');
    let n=0;
    const iv=setInterval(()=>{
      you.textContent=_DICE_FACE[Math.floor(Math.random()*6)];
      me.textContent=_DICE_FACE[Math.floor(Math.random()*6)];
      if(++n>=14){
        clearInterval(iv);
        const a=1+Math.floor(Math.random()*6),b=1+Math.floor(Math.random()*6);
        you.textContent=_DICE_FACE[a-1];me.textContent=_DICE_FACE[b-1];
        g.classList.remove('dice-tumble');g.classList.add('dice-settle');
        setTimeout(()=>g.classList.remove('dice-settle'),420);
        qgFinish(a>b?'lose':a<b?'win':'tie',{kind:'dice',you:a,me:b});
      }
    },90);
  }
}
function qgRps(i){
  const g=document.getElementById('qgame'),you=document.getElementById('qg-you'),me=document.getElementById('qg-me');
  document.getElementById('qg-pick').innerHTML='';
  let n=0;
  const iv=setInterval(()=>{
    me.textContent=_RPS[Math.floor(Math.random()*3)];
    if(++n>=10){
      clearInterval(iv);g.classList.remove('rolling');
      you.textContent=_RPS[i];
      const q=Math.floor(Math.random()*3);me.textContent=_RPS[q];
      const d=(i-q+3)%3;   // 0平 1我赢 2quill赢
      qgFinish(d===0?'tie':d===1?'lose':'win',{kind:'rps',you:_RPS[i],me:_RPS[q]});
    }
  },110);
}
const _RPS_NAME={'✊':'石头','✋':'布','✌':'剪刀'};
function qgFinish(quillOutcome,info){
  const res=document.getElementById('qg-res');
  const pool=_QG_LINES[quillOutcome];
  const line=pool[Math.floor(Math.random()*pool.length)];
  res.textContent=(quillOutcome==='win'?'Quill 赢了 · ':quillOutcome==='lose'?'你赢啦 · ':'平局 · ')+line;
  qMood(quillOutcome);
  if(quillOutcome==='lose')qdConfetti();
  if(info)qgRemember(quillOutcome,info);
}
// 把小游戏结果悄悄记进 Quill 的记忆（不调用 AI、不花 token）——
// 这样下次聊天时它上下文里就有这件事，你问"刚才谁赢了"它答得上来，而不是一问三不知。
function qgRemember(outcome,info){
  let text;
  if(info.kind==='dice')text='刚和你掷骰子比大小：你 '+info.you+' 点，Quill '+info.me+' 点，'+(outcome==='lose'?'你赢了':outcome==='win'?'Quill 赢了':'平局');
  else text='刚和你猜拳：你出'+_RPS_NAME[info.you]+'，Quill 出'+_RPS_NAME[info.me]+'，'+(outcome==='lose'?'你赢了':outcome==='win'?'Quill 赢了':'平局');
  fetch('/api/quill/memories',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({key:'_last_game',value:text})}).catch(()=>{});
}
const QDRAW_POOL=[['大吉',18],['中吉',26],['小吉',30],['吉',16],['末吉',10]];
// 每日一签：有生辰记忆就找后端按八字流日真算一个（quill_agent.daily_fortune_level），
// 没有生辰或网络出问题就照老逻辑加权随机兜底——quillDraw 和推送播报共用这一份，不再各存一份随机逻辑。
async function qdrawGetToday(){
  const today=qpToday();
  const cached=localStorage.getItem('qdraw_date')===today?localStorage.getItem('qdraw_val'):null;
  if(cached)return cached;
  let val='小吉';
  try{
    const r=await (await fetch('/api/quill/daily-fortune')).json();
    if(r&&r.level)val=r.level;else throw new Error('empty');
  }catch(e){
    let r2=Math.random()*100;
    for(const it of QDRAW_POOL){if((r2-=it[1])<=0){val=it[0];break;}}
  }
  localStorage.setItem('qdraw_date',today);localStorage.setItem('qdraw_val',val);
  return val;
}
async function quillDraw(){
  const today=qpToday();
  const box=document.getElementById('qdraw'),stick=document.getElementById('qd-stick'),tip=document.getElementById('qd-tip');
  const prev=localStorage.getItem('qdraw_date')===today?localStorage.getItem('qdraw_val'):null;
  box.style.display='block';box.classList.remove('revealed');
  if(prev){stick.textContent=prev;box.classList.add('revealed');tip.textContent='今天已经抽过啦 · 点空白处关闭';return;}
  tip.textContent='签筒摇动中…';box.classList.add('shaking');
  // 签的结果和摇晃动画并行进行：不管接口快慢，摇筒至少晃够 1.15s 才开签，手感不受网络影响
  const [val]=await Promise.all([qdrawGetToday(), new Promise(res=>setTimeout(res,1150))]);
  box.classList.remove('shaking');
  stick.textContent=val;box.classList.add('revealed');
  tip.textContent='点空白处关闭';
  qdConfetti();
  const fab=document.getElementById('quill-fab');
  if(fab){fab.classList.remove('celebrate');void fab.offsetWidth;fab.classList.add('celebrate');setTimeout(()=>fab.classList.remove('celebrate'),2300);}
  setTimeout(()=>{box.style.display='none';
    quillFill('我今天抽到了「'+val+'」签，结合我的八字流日和今天的黄历，帮我解读一下今天宜做什么、不宜做什么，再用两三句打打气');
  },1500);
}
function qdConfetti(n){
  const cols=['#e8a0b4','#f2d38a','#9fc7e8','#a8d8b0','#d9b3e6','#f0a884'];
  for(let i=0;i<(n||42);i++){
    const c=document.createElement('div');c.className='qd-conf';
    c.style.left=(Math.random()*100)+'vw';
    c.style.background=cols[i%cols.length];
    c.style.animationDuration=(1.4+Math.random()*1.4)+'s';
    c.style.animationDelay=(Math.random()*0.5)+'s';
    document.body.appendChild(c);
    setTimeout(()=>c.remove(),3400);
  }
}
async function qmemLoad(){
  try{
    const r=await (await fetch('/api/quill/memories')).json();
    const box=document.getElementById('qmem-list');if(!box)return;
    const rows=(r.memories||[]).filter(x=>!x.key.startsWith('_'));   // _ 前缀＝内部即时事件（如"刚玩了游戏"），不进用户可编辑列表
    box.innerHTML=rows.length?('<table>'+rows.map(x=>'<tr><td>'+esc(x.key)+'</td><td>'+esc(x.value)+'<a onclick="qmemEdit(\''+esc(x.key)+'\')">改</a><a onclick="qmemDel(\''+esc(x.key)+'\')">删</a></td></tr>').join('')+'</table>'):'<span style="color:var(--ink-faint)">还没有——聊天里说到生日、城市、喜好时会自动记下</span>';
  }catch(e){}
}
async function qmemEdit(k){
  const r=await (await fetch('/api/quill/memories')).json();
  const hit=(r.memories||[]).find(x=>x.key===k)||{};
  const v=prompt('改「'+k+'」：',hit.value||'');if(v==null)return;
  await fetch('/api/quill/memories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
  qmemLoad();
}
async function qmemDel(k){
  if(!confirm('删除记忆「'+k+'」？'))return;
  await fetch('/api/quill/memories/'+encodeURIComponent(k),{method:'DELETE'});
  qmemLoad();
}
async function qmemAdd(){
  const k=prompt('记忆名（如：闺蜜生日）');if(!k)return;
  const v=prompt('内容');if(v==null)return;
  await fetch('/api/quill/memories',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:k,value:v})});
  qmemLoad();
}
function quillFill(template){
  openQuill();
  const inp=document.getElementById('quill-text');
  inp.value=template;
  inp.focus();
  // 光标移到末尾
  setTimeout(()=>{inp.selectionStart=inp.selectionEnd=inp.value.length;},50);
}
async function quillSend(preset,opts){
  opts=opts||{};
  // v4.3.0 修复：过去这里从不接收传入文本，quillSend('…') 全被静默吞掉——
  // 每日一签抽完的解签消息其实一直没发出去过。现在带参优先用参数，不带参照旧读输入框。
  const inp=document.getElementById('quill-text');
  const fromPreset=(typeof preset==='string'&&preset.trim());
  const msg=fromPreset?preset.trim():inp.value.trim();if(!msg)return;
  if(!fromPreset)inp.value='';
  const userEl=opts.userEl||addQuillMsg(msg,'user');   // 重新生成时复用已有气泡，不再多插一条
  const thinking=addQuillMsg('Quill 正在翻书…','quill thinking');
  try{
    const tone=document.getElementById('quill-tone').value;
    const persona=document.getElementById('quill-persona').value;
    const _dot=document.querySelector('.quill-dot');
    if(_dot){const lm=(typeof qmLastMood==='function'&&qmLastMood())||'';_dot.classList.add('thinking');if(lm)_dot.classList.add('think-'+lm);}
    // 同类静默 bug 一并治：原来先把 window._qImg 清空、随后 body 里又去读它——图片永远发不出去
    const _sentImg=window._qImg||'';window._qImg='';qImgChip&&qImgChip();
    const r=await (await fetch('/api/quill/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({image:_sentImg,message:msg,tone,custom_persona:persona,session_id:quillSessionId,interaction_style:detectStyle(msg)})})).json();
    thinking.remove();
    quillSessionId=r.session_id||quillSessionId;
    if(_dot){_dot.classList.remove('thinking');['happy','sad','surprise','shy','confused'].forEach(m=>_dot.classList.remove('think-'+m));}
    if(r.error==='no_api_key'){window._quillCfgOk=false;setQuillDot();}
    else if(r.reply){window._quillCfgOk=true;setQuillDot();}
    if(r.error&&r.error!=='no_api_key'&&!r.reply)throw new Error(String(r.error).slice(0,180));
    if(userEl&&r.user_msg_id)userEl.dataset.msgId=r.user_msg_id;   // 补上真实 id，撤回/重新生成要靠它定位
    const reply=r.reply||'（Quill 没说话）';
    addQuillMsg(reply,'quill',r.reply_id);
    if(typeof qmScanSentiment==='function')qmScanSentiment(msg,reply);
    if(r.timer&&r.timer.minutes)setQuillTimer(r.timer.minutes,r.timer.message);
    render();updateCart();
  }catch(e){const _d2=document.querySelector('.quill-dot');if(_d2){_d2.classList.remove('thinking');['happy','sad','surprise','shy','confused'].forEach(m=>_d2.classList.remove('think-'+m));_d2.classList.add('err');setTimeout(()=>{_d2.classList.remove('err');setQuillDot();},1200);}thinking.remove();addQuillMsg('（Quill 出错了：'+((e&&e.message)||'网络问题')+'）','quill');}
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

