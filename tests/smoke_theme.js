// ── 迷你 DOM/环境桩 ──
const els={};
function mkEl(id){
  const _cls={_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,v){v===undefined?(this._s.has(c)?this._s.delete(c):this._s.add(c)):(v?this._s.add(c):this._s.delete(c))},contains(c){return this._s.has(c)}};
  const el={style:{},classList:_cls,dataset:{},value:'',options:[],children:[],parentEl:null,
    querySelector(){return null},querySelectorAll(sel){const c=String(sel).replace(/^\./,'');return this.children.filter(n=>String(n.className||'').includes(c));},
    appendChild(n){n.parentEl=this;this.children.push(n);},
    insertBefore(n){n.parentEl=this;this.children.unshift(n);},
    remove(){if(this.parentEl){const i=this.parentEl.children.indexOf(this);if(i>=0)this.parentEl.children.splice(i,1);this.parentEl=null;}},   // 之前是空实现——建好父子关系后这里改成真的从父节点里摘掉
    addEventListener(){},setPointerCapture(){},releasePointerCapture(){},getBoundingClientRect(){return{left:0,top:0,width:100,height:100}},clientWidth:100,clientHeight:100,firstChild:null,files:[],click(){}};
  let _cn='';
  Object.defineProperty(el,'className',{get(){return _cn;},set(v){_cn=v;_cls._s=new Set(String(v).split(/\s+/).filter(Boolean));}});   // 真 DOM 里 className 和 classList 是同一份数据的两个视图，桩之前完全没同步——大多数代码是靠 .className='a b' 赋类名，不同步就等于 classList.contains 永远查不到
  Object.defineProperty(el,'nextElementSibling',{get(){if(!this.parentEl)return null;const i=this.parentEl.children.indexOf(this);return i>=0&&i+1<this.parentEl.children.length?this.parentEl.children[i+1]:null;}});
  Object.defineProperty(el,'previousElementSibling',{get(){if(!this.parentEl)return null;const i=this.parentEl.children.indexOf(this);return i>0?this.parentEl.children[i-1]:null;}});
  let _html='',_text='';
  Object.defineProperty(el,'innerHTML',{get(){return _html;},set(v){_html=v;this.children.forEach(c=>{c.parentEl=null;});this.children=[];}});   // 真 DOM 里赋值 innerHTML 会连带清空 children，桩之前没模拟这一步
  Object.defineProperty(el,'textContent',{get(){return _text;},set(v){
    _text=String(v);
    _html=_text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');   // 真 DOM 里设 textContent 再读 innerHTML 会拿到转义后的文本——esc() 这个全站到处用的小工具就是靠这个特性；桩之前 textContent/innerHTML 是两块互不相通的内存，esc() 永远返回空字符串
    this.children.forEach(c=>{c.parentEl=null;});this.children=[];
  }});
  let _id=id;
  Object.defineProperty(el,'id',{get(){return _id;},set(v){_id=v;if(v)els[v]=el;}});   // 真实代码常是 createElement 后再赋 .id 再 append——之前只有 getElementById 查过的 id 才会注册进登记表，导致这样建出来的元素后续用 getElementById 永远查不到自己
  if(id)els[id]=el;
  return el;
}
global.document={
  getElementById(id){if(!els[id])els[id]=mkEl(id);return els[id];},
  querySelector(s){return null;},
  querySelectorAll(s){return [];},
  createElement(t){return mkEl('_'+t+Math.random());},
  body:Object.assign(mkEl('body'),{classList:mkEl('x').classList,setAttribute(){},getAttribute(){return null}}),
  documentElement:mkEl('html'),
  addEventListener(){},
};
document.body.appendChild=()=>{};
global.window=global; global.addEventListener=()=>{}; global.removeEventListener=()=>{}; global.location={reload(){}};
global.navigator={sendBeacon(){}};
const store={};
global.localStorage={getItem:k=>store[k]??null,setItem(k,v){store[k]=String(v);},removeItem(k){delete store[k];},key(i){return Object.keys(store)[i];},get length(){return Object.keys(store).length;}};
global.Storage=function(){}; Storage.prototype.setItem=function(k,v){store[k]=String(v);};
global.sessionStorage={getItem:()=>null,setItem(){},removeItem(){}};
let SLOTS={};
global.fetch=async(url,opt)=>{ 
  if(String(url).includes('/api/theme/list'))return {json:async()=>({slots:SLOTS})};
  if(String(url).includes('/api/reading-prefs'))return {json:async()=>({})};
  if(String(url).includes('/api/journey/garden'))return {json:async()=>({trees:[]})};
  if(String(url).includes('/api/theme/upload'))return {ok:true,json:async()=>({ok:true,url:'/api/theme/user/bg.jpg'})};
  return {ok:true,json:async()=>({})};
};
global.FormData=class{append(){}};
global.Image=class{set src(v){this.onload&&this.onload();}};
global.URL={createObjectURL:()=>'blob:x'};
global.toast=(m)=>console.log('  [toast]',m);
global.confirm=()=>true; global.prompt=()=>'x';
global.setInterval=()=>0; global.setTimeout=(f,t)=>{try{f&&f()}catch(e){console.log('  [timer异常]',e.message)}return 0;}; global.clearTimeout=()=>{};
global.innerWidth=1600; global.innerHeight=900;
// 载入真 home.js —— 与后端 frontend_loader 一致：优先 frontend/home/js/ 目录按文件名拼接
const _fs=require('fs');
let src;
if(_fs.existsSync('frontend/home/js')){
  const parts=_fs.readdirSync('frontend/home/js').filter(f=>f.endsWith('.js')).sort();
  src=parts.map(f=>_fs.readFileSync('frontend/home/js/'+f,'utf-8')).join('\n\n');
  console.log('· 拼接 '+parts.length+' 个模块: '+parts.join(' '));
}else{
  src=_fs.readFileSync('frontend/home/home.js','utf-8');
}
try{ require('vm').runInThisContext(src,{filename:'home.js'}); }catch(e){ console.log('❌ 顶层执行异常:',e.message); process.exit(1); }
console.log('✓ 顶层加载无异常');
// 场景驱动
(async()=>{
  const run=async(name,fn)=>{try{await fn();console.log('✓',name);}catch(e){console.log('❌',name,'→',e.message);process.exitCode=1;}};
  await run('loadSavedTheme(空状态)',()=>loadSavedTheme());
  await run('applyScheme(水彩·图方案)',()=>applyScheme({id:'watercolor',name:'水彩',img:'/api/theme/asset/bg_watercolor.jpg'}));
  await run('applyUserTheme(无上传)',()=>applyUserTheme());
  SLOTS={bg:'/api/theme/user/bg.jpg'};
  await run('上传主背景成功路径(uploadThemeFile)',()=>uploadThemeFile('bg',{type:'image/png'}));
  await run('applyUserTheme(有上传,source=upload)',()=>applyUserTheme());
  const bg=document.getElementById('theme-bg');
  console.log('   theme-bg.backgroundImage =',JSON.stringify(bg.style.backgroundImage));
  await run('openEditor(slot,bg)',()=>openEditor('slot','bg'));
  await run('setBgBlur(3)',()=>setBgBlur(3));
  console.log('   theme-bg.filter =',JSON.stringify(bg.style.filter),' transform=',JSON.stringify(bg.style.transform));
  await run('setColorTex(linen)+强度',()=>{setColorTex('linen');setColorTexInt(60);});
  const tex=document.getElementById('theme-tex');
  console.log('   theme-tex.opacity =',tex.style.opacity,' image=',JSON.stringify(tex.style.backgroundImage).slice(0,60));
  await run('applyScheme(纯净·色方案)',()=>applyScheme({id:'plain',name:'纯净',color:'#f4f1ea',tex:'none',texInt:0}));
  await run('纯色模式下上传主背景→图片顶上来',async()=>{
    await uploadThemeFile('bg',{type:'image/png'});
    if(getBgMode()==='color')throw new Error('还留在纯色模式');
    const bi=document.getElementById('theme-bg').style.backgroundImage||'';
    if(!bi.includes('/api/theme/user/bg.jpg'))throw new Error('背景没画上传图: '+bi);
  });
  await run('双栏面板:开编辑器+渲染调整组',()=>{openEditor('slot','bg');seRenderPanel();sePickGroup('bgx');sePickGroup('adj');});
  await run('模式开关:切纯色再切回图片',()=>{seModeColor();if(getBgMode()!=='color')throw 0;seModeImg();if(getBgMode()==='color')throw 1;});
  await run('回归护栏:缩放两轮后预览图还在(定框版)',()=>{
    openEditor('slot','bg');
    setBgZoom(130);seUpdatePreview();
    setBgZoom(160);seUpdatePreview();
    const im=document.getElementById('se-img');
    if(!im||!String(im.dataset&&im.dataset.src||'').includes('/api/theme/user/bg.jpg'))throw new Error('预览图层丢图: '+(im&&im.dataset&&im.dataset.src));
    if(im.style.display==='none')throw new Error('图层被隐藏');
  });
  await run('形状状态回放:心形渐变+异形点不打死背景',async()=>{
    localStorage.setItem('home_bg_gstops',JSON.stringify([{c:'#88aacc',a:90},{c:'#dd8899',a:80}]));
    localStorage.setItem('home_bg_gshape','heart');
    localStorage.setItem('home_bg_spots',JSON.stringify([{x:30,y:30,c:'#ffcc88',r:40,a:60,sh:'drop'},{x:70,y:60,c:'#88ccff',r:50,a:50,sh:'star5'}]));
    await applyUserTheme();
    const bi=document.getElementById('theme-bg').style.backgroundImage||'';
    if(!bi.includes('/api/theme/user/bg.jpg'))throw new Error('背景被打死: '+bi);
    const shapes=document.getElementById('theme-shapes');
    if(!(shapes.children&&shapes.children.length>=3))throw new Error('形状层空: '+(shapes.children&&shapes.children.length));
    openEditor('slot','bg');sePickGroup('bgx');
    localStorage.setItem('home_bg_gstops','[]');localStorage.setItem('home_bg_spots','[]');localStorage.setItem('home_bg_gshape','linear');
  });
  await run('Photos 调色:亮度/色温落到真背景',()=>{
    setBgBright(120);setBgTemp(25);
    const f=document.getElementById('theme-bg').style.filter||'';
    if(!f.includes('brightness(120%)')||!f.includes('sepia'))throw new Error('滤镜串不对: '+f);
    setBgBright(100);setBgTemp(0);
  });
  await run('setCoverPalette(icetea)',()=>{
    const vm=require('vm');
    vm.runInThisContext("DATA=[{t:'甲',c:''},{t:'乙',c:''}];render=function(){};");
    setCoverPalette('icetea');
    const c=vm.runInThisContext('DATA[0].c');
    if(!/^#/.test(c))throw new Error('重烤失败: '+c);
    console.log('   重烤后 DATA[0].c =',c);});
  // ── v4.1/v4.2 · Quill 陪伴细节 ──
  await run('v4 函数就位(盲盒/节气卡/悬浮换装)',()=>{
    for(const fn of ['quillBlind','showTermCard','quillSkinHoverIn','quillSkinHoverOut','maybeShowTermCard','celebrateFinish','toggleFinishCele'])
      if(typeof global[fn]!=='function')throw new Error(fn+' 不是函数');
    // v4.6.1 回归钉子：quillFabClick 绝不能按"悬浮换装中"这个状态改变行为——
    // mouseenter 永远先于 click 触发，一旦点击被这个状态拦截，鼠标点浮钮就再也开不了聊天面板了
    // （上一轮真出过这个 bug：只能点出节气卡，面板永远打不开）。
    const src=quillFabClick.toString();
    if(/_qSkinBusy|quillFabSkinActive|qf-skin-on/.test(src))
      throw new Error('quillFabClick 又在按悬浮换装状态改变点击行为了——鼠标点击会被"卡"在节气卡上');
  });
  await run('节气纹样一节气一款 + 候语 24 条',()=>{
    // 镜像 routes/quill.py 的 _JIEQI_MOTIF：24 键在前端必须一一有款（v4.5.1 起）
    const map=['bud','rainleaf','blossom','swallow','kite','peony','lotus','greenwheat','plumfruit','cicada','dragonfly','melon',
               'leaf','rice','reed','osmanthus','chrys','persimmon','camellia','snowman','pinesnow','narcissus','plum','nandina'];
    for(const k of map)if(!/^<svg/.test(SEASON_MOTIFS[k]||''))throw new Error('SEASON_MOTIFS 缺 '+k);
    if(Object.keys(QTERM_PHRASES).length!==24)throw new Error('QTERM_PHRASES='+Object.keys(QTERM_PHRASES).length);
    if(Object.keys(QTERM_ART).length!==11)throw new Error('QTERM_ART='+Object.keys(QTERM_ART).length);
    for(const k in QTERM_ART)if(!/^<svg/.test(QTERM_ART[k]))throw new Error('QTERM_ART.'+k+' 不是 svg');
  });
  await run('每日一签：后端给出结果时用后端的，接口挂了兜底不崩',async()=>{
    localStorage.removeItem('qdraw_date');localStorage.removeItem('qdraw_val');
    const realFetch=global.fetch;
    // ① 后端算出"中吉"：应该原样采用，不再自己瞎猜
    global.fetch=async(url)=>{
      if(String(url).includes('/api/quill/daily-fortune'))return{ok:true,json:async()=>({level:'中吉',personalized:true})};
      return realFetch(url);
    };
    const v1=await qdrawGetToday();
    if(v1!=='中吉')throw new Error('没有采用后端算出的结果，拿到的是:'+v1);
    localStorage.removeItem('qdraw_date');localStorage.removeItem('qdraw_val');
    // ② 接口挂了：兜底必须落在合法的签级别里，不能是 undefined/崩溃
    global.fetch=async()=>{throw new Error('网络挂了');};
    const v2=await qdrawGetToday();
    const legal=QDRAW_POOL.map(x=>x[0]);
    if(!legal.includes(v2))throw new Error('接口挂了之后兜底结果不合法:'+v2);
    global.fetch=realFetch;
    localStorage.removeItem('qdraw_date');localStorage.removeItem('qdraw_val');
  });
  await run('_qRender：表格/折叠渲染 + 塔罗正逆位高亮',()=>{
    const tblMd='|位置|牌名|正逆|关键含义|\n|---|---|---|---|\n|过去|愚者|正位|新的开始|\n|现在|死神|逆位|滞留·抗拒|';
    const html=_qRender(tblMd);
    if(!html.includes('<table class="q-tbl">'))throw new Error('markdown 表格没转成 <table>');
    if(!html.includes('<th>位置</th>'))throw new Error('表头没识别对');
    if(!html.includes('<span class="q-up">正位</span>'))throw new Error('正位没有高亮');
    if(!html.includes('<span class="q-rev">逆位</span>'))throw new Error('逆位没有高亮');
    const foldMd='[折叠:大运详情]一堆很长的明细[/折叠]';
    const html2=_qRender(foldMd);
    if(!html2.includes('<details class="q-fold">')||!html2.includes('<summary>大运详情</summary>'))
      throw new Error('折叠语法没转对');
  });
  await run('Quill 月相皮肤：新月/满月特判 + 上弦下弦正确镜像（不是同一个形状）',()=>{
    if(typeof moonSVG!=='function')throw new Error('moonSVG 不是函数');
    if(typeof moonPhase!=='function')throw new Error('moonPhase 不是函数');
    const _origPhase=moonPhase;
    const getShx=svg=>{const m=svg.match(/M(-?[\d.]+),12/);return m?+m[1]+8.6:null;};
    try{
      global.moonPhase=()=>0.001;
      if(moonSVG().length>110)throw new Error('新月附近应该只有圆环，没有月牙');
      global.moonPhase=()=>0.5;
      if(!moonSVG().includes('class="fl"'))throw new Error('满月应该有填充圆');
      global.moonPhase=()=>0.25;
      const shx25=getShx(moonSVG());
      global.moonPhase=()=>0.75;
      const shx75=getShx(moonSVG());
      if(shx25==null||shx75==null)throw new Error('阴影圆位置解析失败');
      if(Math.abs((shx25-12)+(shx75-12))>0.01)
        throw new Error('上弦(0.25)和下弦(0.75)阴影圆偏移方向应该镜像相反，实际:'+shx25+' vs '+shx75);
    }finally{global.moonPhase=_origPhase;}
  });
  await run('弹层滚动锁：开一个/叠两个/关一个/全关 body.overflow 都对',()=>{
    for(const fn of ['_qModalSync','_qModalVisible'])
      if(typeof global[fn]!=='function')throw new Error(fn+' 不是函数');
    const els={};
    for(const id of _qModalIds)els[id]={style:{display:'none'}};
    const _getById=document.getElementById,_gcs=global.getComputedStyle;
    document.getElementById=id=>els[id]||_getById(id);
    global.getComputedStyle=el=>({display:el.style.display});
    try{
      _qModalSync();
      if(document.body.style.overflow!=='')throw new Error('全部关闭时不该锁');
      els['qtarot'].style.display='block';_qModalSync();
      if(document.body.style.overflow!=='hidden')throw new Error('开一个弹层应该锁住背景');
      els['qterm'].style.display='block';_qModalSync();
      if(document.body.style.overflow!=='hidden')throw new Error('叠两个弹层还是该锁着');
      els['qterm'].style.display='none';_qModalSync();
      if(document.body.style.overflow!=='hidden')throw new Error('只关掉一个、还有一个开着，不该提前解锁');
      els['qtarot'].style.display='none';_qModalSync();
      if(document.body.style.overflow!=='')throw new Error('全部关闭后应该解锁');
    }finally{document.getElementById=_getById;global.getComputedStyle=_gcs;document.body.style.overflow='';}
  });
  await run('习惯热力图 HTML 生成',()=>{
    global._qhHeat={days:{},habits:0};
    const h=qhabitHeatHTML();
    if(!h.includes('qhm-grid')||!h.includes('qhm-cell'))throw new Error('热力图结构不对');
  });
  await run('qpToday 是本地日期串',()=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(qpToday()))throw new Error('qpToday='+qpToday());
  });
  // ── v4.3 · 塔罗抽牌 ──
  await run('塔罗背景乐：函数就位 + 没有 AudioContext 时安静跳过不崩',async()=>{
    for(const fn of ['ttBgmStart','ttBgmStop'])
      if(typeof global[fn]!=='function')throw new Error(fn+' 不是函数');
    // 桩环境没有 AudioContext/fetch 音频解码，应该走 catch 安静失败，不能把整个抽牌流程炸掉
    await ttBgmStart();
    ttBgmStop();
    ttBgmStop(true);
  });
  await run('塔罗：22 张大阿卡纳 + 四种牌阵 + 状态机就位',()=>{
    if(TAROT_ARCANA.length!==22)throw new Error('TAROT_ARCANA='+TAROT_ARCANA.length);
    for(const c of TAROT_ARCANA){if(!c.n||c.r==null||!c.up||!c.rev)throw new Error('牌缺字段:'+JSON.stringify(c).slice(0,60));
      if(!TAROT_ICON[c.n])throw new Error('缺图标:'+c.n);}
    const want={1:1,3:3,5:5,10:10};
    for(const k in want){const sp=TAROT_SPREADS[k];
      if(!sp||sp.pos.length!==want[k])throw new Error('牌阵 '+k+' 阵位='+(sp&&sp.pos.length));}
    for(const fn of ['openTarot','closeTarot','ttSetMode','ttBuildFan','ttShuffleFan','ttBuildSlots','ttLayout','ttSpin','ttSpringBack','ttDrawPulled','ttReveal','ttAgain','ttSend'])
      if(typeof global[fn]!=='function')throw new Error(fn+' 不是函数');
    // v4.6：抽之前就把牌阵坑位摆出来（"魔法阵"），坑位数必须和阵型阵位数一一对应
    // v4.6.4：凯尔特十字改成传统十字+纵列摆法，坑位嵌套在 #tt-cross/#tt-staff 两个子容器里，不再是 tt-result 的直接子元素
    for(const m of [1,3,5,10]){
      ttSetMode(m,true);
      const res=document.getElementById('tt-result');
      const n=(m===10)?(document.getElementById('tt-cross').children.length+document.getElementById('tt-staff').children.length):res.children.length;
      if(n!==TAROT_SPREADS[m].pos.length)throw new Error('牌阵 '+m+' 应有 '+TAROT_SPREADS[m].pos.length+' 个坑位，实际 '+n);
    }
    // 十字组 6 个 + 纵列组 4 个，位置要对得上（现状/挑战叠放在十字组，自身在纵列组）
    ttSetMode(10,true);
    if(document.getElementById('tt-cross').children.length!==6)throw new Error('十字组应有 6 个坑位（现状/挑战/目标/根基/过去/未来）');
    if(document.getElementById('tt-staff').children.length!==4)throw new Error('纵列组应有 4 个坑位（自身/环境/期盼/结局）');
    ttSetMode(5);   // 桩环境走一遍：假元素上重铺 5 张阵不该炸
    if(typeof ttNorm(370)!=='number')throw new Error('ttNorm 不对');
    // 洗牌：deck 是 0..21 的排列，且多次重开顺序会变（固定顺序=假随机，v4.5.1 修）
    const seen=new Set();let varies=false,first=null;
    for(let k=0;k<5;k++){ttSetMode(1,true);
      const d=ttDeck.slice();
      if(d.length!==22||new Set(d).size!==22||Math.min(...d)!==0||Math.max(...d)!==21)throw new Error('deck 不是 0..21 排列');
      const key=d.join(',');if(first===null)first=key;else if(key!==first)varies=true;seen.add(key);}
    if(!varies)throw new Error('五次重开顺序完全相同——没在洗牌');
    // 夹限：转不出扇的两端，扇是弧不是环
    if(ttClampRot(999)!==0)throw new Error('上限没夹住');
    if(ttClampRot(-9999)!==-(22-1)*10)throw new Error('下限没夹住');
    if(typeof ttHint!=='undefined')throw new Error('提示行应已删除');
  });
  // ── v4.3 · 情绪光点 ──
  await run('塔罗"发给 Quill 解读"：关窗口+填进输入框（不自动发送）+不再提八字黄历',()=>{
    ttSetMode(3,true);
    // 桩环境走不了真实拖拽，直接手填三张已抽结果，只验证发送链路本身
    ttPicks.length=0;
    ttPicks.push({card:TAROT_ARCANA[0],reversed:false,pos:'过去'});
    ttPicks.push({card:TAROT_ARCANA[5],reversed:true,pos:'现在'});
    ttPicks.push({card:TAROT_ARCANA[10],reversed:false,pos:'未来'});
    let closedCalled=false,filledMsg=null;
    const _close=global.closeTarot,_fill=global.quillFill;
    global.closeTarot=()=>{closedCalled=true;};
    global.quillFill=(m)=>{filledMsg=m;};
    try{
      ttSend();
      if(!closedCalled)throw new Error('没有关闭塔罗窗口');
      if(!filledMsg)throw new Error('没有调用 quillFill 把结果填进输入框');
      if(!filledMsg.includes(TAROT_ARCANA[0].n)||!filledMsg.includes(TAROT_ARCANA[5].n)||!filledMsg.includes(TAROT_ARCANA[10].n))
        throw new Error('填进去的消息里牌名不全:'+filledMsg);
      if(!filledMsg.includes('逆位'))throw new Error('逆位标记丢了');
      if(!filledMsg.includes('星座'))throw new Error('没有要求 Quill 结合星座解读');
      if(/黄历|八字|流日/.test(filledMsg))throw new Error('塔罗不该再提黄历/八字/流日——那是每日一签的范畴:'+filledMsg);
    }finally{global.closeTarot=_close;global.quillFill=_fill;}
  });
  await run('撤回/重新生成：DOM 联动对不对',async()=>{
    const box=document.getElementById('quill-msgs');
    box.innerHTML='';   // 清空上面几个测试可能留下的旧消息
    const u1=addQuillMsg('你好','user',101);
    const a1=addQuillMsg('你好呀','quill',102);
    const u2=addQuillMsg('推荐本书','user',103);
    const a2=addQuillMsg('推荐xxx','quill',104);
    if(box.children.length!==4)throw new Error('初始 4 条消息没建全，实际 '+box.children.length);

    // ① 撤回 u2：u2 和 a2 都该从界面上没了，u1/a1 不受影响，文字退回输入框
    const _fetch=global.fetch,_fill=global.quillFill;
    let fetchBody=null,filledText=null;
    global.fetch=async(url,opt)=>{if(String(url).includes('/api/quill/messages/truncate'))fetchBody=JSON.parse(opt.body);return{ok:true,json:async()=>({ok:true})};};
    global.quillFill=(t)=>{filledText=t;};
    quillSessionId='sess1';
    try{
      await quillRecall(u2);
      if(box.children.length!==2)throw new Error('撤回后应该只剩 2 条，实际 '+box.children.length);
      if(box.children[0]!==u1||box.children[1]!==a1)throw new Error('撤回撤错消息了');
      if(!fetchBody||fetchBody.from_message_id!==103)throw new Error('truncate 请求的起点 id 不对:'+JSON.stringify(fetchBody));
      if(filledText!=='推荐本书')throw new Error('撤回的原文没有退回输入框，拿到的是:'+filledText);
    }finally{global.fetch=_fetch;global.quillFill=_fill;}

    // ② 重新生成 a1：应该找到 u1，删掉 a1，拿 u1 的文字调用 quillSend 且带上 userEl 复用
    let sentArgs=null;
    const _send=global.quillSend;
    global.fetch=async(url,opt)=>{fetchBody=JSON.parse(opt.body);return{ok:true,json:async()=>({ok:true})};};
    global.quillSend=(text,opts)=>{sentArgs=[text,opts];};
    try{
      await quillRegenerate(a1);
      if(box.children.length!==1||box.children[0]!==u1)throw new Error('重新生成后应该只剩 u1 一条气泡（a1 先删掉，新回答由 quillSend 自己插）');
      if(!sentArgs||sentArgs[0]!=='你好')throw new Error('没有拿 u1 的原文重新问，拿到的是:'+(sentArgs&&sentArgs[0]));
      if(!sentArgs[1]||sentArgs[1].userEl!==u1)throw new Error('重新生成应该复用 u1 这个气泡，不能新插一条');
      if(!fetchBody||fetchBody.from_message_id!==101)throw new Error('重新生成应该从 u1(id=101) 开始清，实际:'+JSON.stringify(fetchBody));
    }finally{global.fetch=_fetch;global.quillSend=_send;}
    box.innerHTML='';
  });
  await run('情绪光点：疑惑是 Quill 自己没弄明白（扫的是 Quill 回复里的不确定措辞，不是用户说自己没看懂）',()=>{
    const played=[];
    const _orig=global.qmPlay;
    global.qmPlay=(m)=>played.push(m);
    try{
      // Quill 自己的回复带不确定措辞：该触发疑惑
      qmScanSentiment('这本书是谁写的','这个我不太确定，好像是好几个人合著的');
      if(!played.includes('confused'))throw new Error('Quill 回复里带"不太确定"应该触发疑惑，没触发');
      played.length=0;
      // 用户自己说看不懂：不该触发疑惑（那是用户的困惑，不是 Quill 的）
      qmScanSentiment('这段什么意思啊，我看不懂','（详细解释）');
      if(played.length!==0)throw new Error('用户说"看不懂"不该让 Quill 也演疑惑，实际触发了:'+played);
      played.length=0;
      // 普通对话：不该误触发
      qmScanSentiment('这本书好看吗','（推荐）');
      if(played.length!==0)throw new Error('普通提问不该误触发疑惑，实际触发了:'+played);
    }finally{global.qmPlay=_orig;}
  });
  await run('情绪光点："在意你"的颜色不再跟待机撞色',()=>{
    const html=require('fs').readFileSync(require('path').join(__dirname,'..','frontend','home','index.html'),'utf-8');
    const care=html.match(/\.quill-dot\.qmood\.qm-care\{color:(#[0-9a-fA-F]{6})\}/);
    const standby=html.match(/\.quill-dot\.standby\{background:(#[0-9a-fA-F]{6})/);
    if(!care||!standby)throw new Error('找不到 care 或 standby 的颜色定义');
    const hexToHue=hex=>{
      const r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
      const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
      if(d===0)return 0;
      let h;
      if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;
      h*=60;if(h<0)h+=360;
      return h;
    };
    const hCare=hexToHue(care[1]),hStandby=hexToHue(standby[1]);
    const diff=Math.min(Math.abs(hCare-hStandby),360-Math.abs(hCare-hStandby));
    if(diff<15)throw new Error(`care(${care[1]}, H=${hCare.toFixed(0)}) 和 standby(${standby[1]}, H=${hStandby.toFixed(0)}) 色相太接近(仅差${diff.toFixed(0)}°)，还是分不清`);
  });
  await run('情绪光点：单戳=害羞、连戳4+=开心转圈（这轮反复确认过的映射，钉一个回归测试）',()=>{
    const src=qmTap.toString();
    if(!/_qmTaps\.length>=4/.test(src))throw new Error('触发阈值不是 4 次了，映射改动了没同步测试');
    const m=src.match(/_qmTaps\.length>=4\)\{[^}]*qmPlay\('(\w+)'\)/);
    if(!m||m[1]!=='happy')throw new Error('连戳 4+ 次应该触发 happy，实际:'+(m&&m[1]));
    if(!/else qmPlay\('shy'\)/.test(src))throw new Error('单戳应该触发 shy，代码里没找到');
  });
  await run('情绪光点：六态映射 + 桩环境安静跳过',()=>{
    for(const fn of ['qMood','qmPlay','qmInit','qmTap','qmScanSentiment','qmSomberActive'])
      if(typeof global[fn]!=='function')throw new Error(fn+' 不是函数');
    for(const k of ['win','lose','tie','shy','happy','sad','surprise','confused'])qMood(k);   // querySelector=null → 不炸
    if(!QM_DUR.happy||!QM_DUR.confused)throw new Error('QM_DUR 缺时长');
    const src=qmInit.toString();
    for(const c of ['qm-a','qm-b','qm-c'])if(!src.includes(c))throw new Error('光点缺珠 '+c+'（液尾/雨滴/笑弧要用第三颗）');
    // v4.6：情绪场关键词启发式——中性内容不触发，命中关键词触发，窗口过期后自动解除
    localStorage.removeItem('qmood_somber_until');
    qmScanSentiment('今天天气不错，出去走走了','');
    if(qmSomberActive())throw new Error('中性内容不该触发情绪场压制');
    qmScanSentiment('今天好难过，和TA吵架了','');
    if(!qmSomberActive())throw new Error('命中关键词应该触发情绪场压制');
    localStorage.setItem('qmood_somber_until',String(Date.now()-1000));   // 手动过期
    if(qmSomberActive())throw new Error('窗口过期后应该自动解除');
  });
  // ── v4.3 · 节日彩蛋 ──
  await run('节日佩饰四款 + 节日→佩饰映射齐',()=>{
    for(const k of ['tree','pumpkin','firework','heart'])
      if(!/^<svg/.test(FEST_MOTIFS[k]||''))throw new Error('FEST_MOTIFS.'+k+' 不是 svg');
    for(const f of ['圣诞节','平安夜','万圣节','跨年夜','元旦','情人节']){
      const m=FEST_MOTIF_MAP[f];
      if(!m||!FEST_MOTIFS[m])throw new Error('节日 '+f+' 没有佩饰映射');}
  });
  // ── v4.4 · 24 张节气专属图 ──
  await run('QTERM_ART24：24 键对齐节气名 + 渐变 id 全局无冲突',()=>{
    const terms=Object.keys(QTERM_PHRASES);
    if(Object.keys(QTERM_ART24).length!==24)throw new Error('QTERM_ART24='+Object.keys(QTERM_ART24).length);
    for(const t of terms)if(!/^<svg/.test(QTERM_ART24[t]||''))throw new Error('缺图或不是 svg: '+t);
    const ids=[];
    for(const t of terms)for(const m of QTERM_ART24[t].matchAll(/id="([^"]+)"/g))ids.push(m[1]);
    const dup=ids.filter((v,i)=>ids.indexOf(v)!==i);
    if(dup.length)throw new Error('渐变 id 撞了: '+[...new Set(dup)].join(','));
  });
  await run('日历：月视图函数就位 + 月天数网格正确',()=>{
    for(const fn of ['qcalOpen','qcalClose','qcalNav','qcalLoad','qcalRenderGrid','qcalPick','qcalRenderDetail','qcalAddTodo','qcalTodoToggle','qcalHabitCheck'])
      if(typeof global[fn]!=='function')throw new Error(fn+' 不是函数');
    _qcalYM='2026-02';_qcalData={};   // 2026 年 2 月= 28 天，2 月 1 日是周日，边界值练手
    qcalRenderGrid();
    const grid=document.getElementById('qcal-grid');
    const dayCells=(grid.innerHTML.match(/class="qcal-d"/g)||[]).length;
    if(dayCells!==28)throw new Error('2026-02 应渲染 28 个日格，实际 '+dayCells);
    const blanks=(grid.innerHTML.match(/qcal-blank/g)||[]).length;
    if(blanks!==0)throw new Error('2026-02-01 是周日，月初不该有空白占位格，实际 '+blanks);
  });
})();

