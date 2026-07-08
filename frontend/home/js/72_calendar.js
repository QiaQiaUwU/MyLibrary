// ╔══ 72_calendar.js —— 待办/习惯统一日历（v4.6 新增）══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。
// 纯粹是"数据库同一批待办/习惯数据"的另一种看法——不新增提醒机制：
// 到点提醒仍走 qtodoTick（浏览器通知）和习惯的每日到点提示，日历只负责"看清楚 + 点开改"。

let _qcalYM='', _qcalData=null, _qcalSel='';
function qcalOpen(){
  const box=document.getElementById('qcal');if(!box)return;
  const t=new Date();
  _qcalYM=_qcalYM||(t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0'));
  _qcalSel=qpToday();
  box.style.display='block';requestAnimationFrame(()=>box.classList.add('on'));
  qcalLoad();
}
function qcalClose(){
  const box=document.getElementById('qcal');if(!box)return;
  box.classList.remove('on');setTimeout(()=>{box.style.display='none';},260);
}
function qcalNav(delta){
  let [y,m]=_qcalYM.split('-').map(Number);
  m+=delta;if(m<1){m=12;y--;}else if(m>12){m=1;y++;}
  _qcalYM=y+'-'+String(m).padStart(2,'0');
  qcalLoad();
}
async function qcalLoad(){
  const grid=document.getElementById('qcal-grid');if(grid)grid.innerHTML='<div class="qcal-loading">翻页中…</div>';
  try{
    const r=await (await fetch('/api/quill/calendar?month='+_qcalYM)).json();
    _qcalData=r.days||{};
  }catch(e){_qcalData={};}
  qcalRenderHead();
  qcalRenderGrid();
  qcalRenderDetail();
}
function qcalRenderHead(){
  const h=document.getElementById('qcal-ym');if(h){const [y,m]=_qcalYM.split('-');h.textContent=y+'年'+parseInt(m,10)+'月';}
}
function qcalWeekMode(){return localStorage.getItem('qcal_week')==='1';}
function qcalToggleWeek(on){localStorage.setItem('qcal_week',on?'1':'0');qcalRenderGrid();}
function qcalRenderGrid(){
  const grid=document.getElementById('qcal-grid');if(!grid||!_qcalData)return;
  const [y,m]=_qcalYM.split('-').map(Number);
  const first=new Date(y,m-1,1), startDow=first.getDay();
  const daysInMonth=new Date(y,m,0).getDate();
  const today=qpToday();
  let cells=[];
  if(qcalWeekMode()){
    // 周视图：以当前选中日期所在的那一周为准（跨月边界只显示本月已加载到的那几天，是已知的小局限）
    const sel=_qcalSel&&_qcalSel.slice(0,7)===_qcalYM?new Date(_qcalSel):first;
    const wStart=new Date(sel);wStart.setDate(sel.getDate()-sel.getDay());
    for(let i=0;i<7;i++){
      const d=new Date(wStart);d.setDate(wStart.getDate()+i);
      const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      cells.push({key,label:d.getDate(),inMonth:key.slice(0,7)===_qcalYM});
    }
  }else{
    for(let i=0;i<startDow;i++)cells.push(null);
    for(let d=1;d<=daysInMonth;d++){
      const key=_qcalYM+'-'+String(d).padStart(2,'0');
      cells.push({key,label:d,inMonth:true});
    }
  }
  const dow=['日','一','二','三','四','五','六'];
  let html='<div class="qcal-dow">'+dow.map(x=>'<span>'+x+'</span>').join('')+'</div><div class="qcal-cells'+(qcalWeekMode()?' qcal-week':'')+'">';
  html+=cells.map(c=>{
    if(!c)return '<div class="qcal-cell qcal-blank"></div>';
    const info=_qcalData[c.key]||{todos:[],habits_total:0,habits_done:0};
    const nOpen=(info.todos||[]).filter(t=>!t.done).length;
    const hasHabit=info.habits_total>0;
    const full=hasHabit&&info.habits_done>=info.habits_total;
    const cls=['qcal-cell'];
    if(c.key===today)cls.push('today');
    if(c.key===_qcalSel)cls.push('sel');
    if(!c.inMonth)cls.push('dim');
    return '<div class="'+cls.join(' ')+'" onclick="qcalPick(\''+c.key+'\')">'+
      '<span class="qcal-d">'+c.label+'</span>'+
      (nOpen?'<span class="qcal-dot todo">'+Math.min(nOpen,9)+'</span>':'')+
      (hasHabit?'<span class="qcal-dot habit'+(full?' full':'')+'">'+info.habits_done+'/'+info.habits_total+'</span>':'')+
    '</div>';
  }).join('');
  html+='</div>';
  grid.innerHTML=html;
}
function qcalPick(key){_qcalSel=key;qcalRenderGrid();qcalRenderDetail();}
function qcalRenderDetail(){
  const box=document.getElementById('qcal-detail');if(!box)return;
  const info=(_qcalData&&_qcalData[_qcalSel])||{todos:[],habits:[],habits_total:0};
  const d=new Date(_qcalSel+'T00:00:00');
  const label=(d.getMonth()+1)+'月'+d.getDate()+'日'+['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  let html='<div class="qcal-dhead">'+label+(_qcalSel===qpToday()?' · 今天':'')+
    ' <a class="tp-link" onclick="qcalAddTodo()">＋待办</a></div>';
  const todos=info.todos||[];
  html+=todos.length?todos.map(t=>
    '<div class="qcal-item'+(t.done?' done':'')+'">'+
      '<a onclick="qcalTodoToggle('+t.id+','+(!t.done)+')">'+(t.done?'✓':'○')+'</a>'+
      '<span class="qcal-txt" onclick="qcalTodoEdit('+t.id+',\''+esc(t.text).replace(/'/g,'&#39;')+'\')">'+esc(t.text)+
      (t.due&&t.due.length>10?' <i>'+esc(t.due.slice(11))+'</i>':'')+'</span>'+
      '<a class="qcal-del" onclick="qcalTodoDel('+t.id+')">×</a>'+
    '</div>').join(''):'<div class="qcal-empty">这天没有待办</div>';
  if(info.habits_total>0){
    html+='<div class="qcal-dsub">习惯打卡</div>';
    html+=(info.habits||[]).map(h=>
      '<div class="qcal-item'+(h.done?' done':'')+'">'+
        '<a'+(_qcalSel===qpToday()?' onclick="qcalHabitCheck('+h.id+')"':'')+'>'+(h.done?'✓':'○')+'</a>'+
        '<span class="qcal-txt">'+esc(h.name)+'</span>'+
      '</div>').join('');
  }
  box.innerHTML=html;
}
async function qcalAddTodo(){
  const text=(prompt('待办内容：')||'').trim();if(!text)return;
  await fetch('/api/quill/todos/quick',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text,due:_qcalSel})});
  qcalLoad();qtodoLoad&&qtodoLoad();
}
async function qcalTodoToggle(id,done){
  await fetch('/api/quill/todos/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({done})});
  qcalLoad();qtodoLoad&&qtodoLoad();
}
async function qcalTodoEdit(id,oldText){
  const v=prompt('改这条待办：',oldText);if(v==null||!v.trim())return;
  await fetch('/api/quill/todos/'+id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:v.trim()})});
  qcalLoad();qtodoLoad&&qtodoLoad();
}
async function qcalTodoDel(id){
  if(!confirm('删除这条待办？'))return;
  await fetch('/api/quill/todos/'+id,{method:'DELETE'});
  qcalLoad();qtodoLoad&&qtodoLoad();
}
async function qcalHabitCheck(hid){
  await fetch('/api/quill/habits/'+hid+'/checkin',{method:'POST'});
  qcalLoad();qhabitLoad&&qhabitLoad();
}

// ── v4.6.10：弹层开着的时候，背后书架页面不该还能滚——之前没有任何代码管这件事，
// 弹层一开，背景页面自己的滚动条照常在，看着就像"弹层里那个多余的拉动条删不掉"，
// 其实是背景页面的，跟弹层本身的布局无关。这里统一用 MutationObserver 盯着几个弹层容器的
// 显示状态，只要还有任意一个开着，就把 body 锁住不让滚；全关掉了才放开。
// 用观察者而不是挨个在每个 open/close 函数里加两行——这样以后新增弹层，容器 id 加进列表就行，
// 不会出现"这个函数忘了加锁"的遗漏。
const _qModalIds=['qtarot','qterm','qcal','qmedal','stk-import','qgame','qdraw'];
function _qModalVisible(id){
  const el=document.getElementById(id);
  if(!el)return false;
  const cs=(typeof getComputedStyle==='function')?getComputedStyle(el):null;
  return cs?cs.display!=='none':false;
}
function _qModalSync(){
  const anyOpen=_qModalIds.some(_qModalVisible);
  document.body.style.overflow=anyOpen?'hidden':'';
}
(function(){
  if(typeof MutationObserver==='function'){
    const observer=new MutationObserver(_qModalSync);
    _qModalIds.forEach(id=>{
      const el=document.getElementById(id);
      if(el)observer.observe(el,{attributes:true,attributeFilter:['style','class']});
    });
  }
  _qModalSync();
})();

