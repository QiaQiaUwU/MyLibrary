// ╔══ 70_mood.js —— Quill 情绪光点（v4.3 引入，v4.6.15 按最新反馈重做互动映射）══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。
// goo 滤镜让珠子分裂/合并时拉出液桥；三颗珠：主珠 a、副珠 b、小卫星 c（画液尾/雨滴/笑弧凹点用）。
// 编排：
//   开心＝粉红，先来几下急促的"喘气"式快速膨缩，再分裂两点拉成微笑弧、转一圈、合回弹一下
//   低落＝压扁下沉、像水珠一样左右晃两下、滴下一小滴再浮回（蓝）
//   惊讶＝光源扩大缩小来回果冻弹动（亮金）
//   害羞＝浅粉，慢慢地浮动几下（呼吸变缓，不是发抖快闪）
//   疑惑＝下点沉底做问号的点、上点转半圈拖出问号的钩（小卫星描尾迹）、歪头起伏两下合回（淡紫）
// 平时不表演：跟着连接状态走三态灯——接好=绿、待命=暗琥珀、出错=红（老规矩不变）。
// 情绪只来自真实互动（猜拳骰子赢/输/平、摸头授牌）；点一下光点＝害羞，连点几下（3秒内4次+）＝开心转圈。
// qMood 在 20_quill.js 里有老实现——按"后声明覆盖先声明"的拼接约定，本模块接管它，旧调用点零改动。

const QM_DUR={happy:2800,sad:2400,surprise:1600,shy:3900,confused:2800};
let _qmTaps=[];   // 彩蛋：3 秒窗口内的点按时间戳

function qmInit(){
  const dot=document.querySelector&&document.querySelector('.quill-dot');
  if(!dot||dot.classList.contains('qmood'))return dot;
  dot.classList.add('qmood');
  dot.innerHTML=
    '<svg viewBox="0 0 40 40" aria-hidden="true">'+
      '<defs><filter id="qm-goo" x="-60%" y="-60%" width="220%" height="220%">'+
      '<feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b"/>'+
      '<feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="g"/>'+
      '<feComposite in="SourceGraphic" in2="g" operator="atop"/></filter></defs>'+
      '<g class="qm-g" filter="url(#qm-goo)">'+
        '<circle class="qm-a" cx="20" cy="20" r="7"/>'+
        '<circle class="qm-b" cx="20" cy="20" r="5.2"/>'+
        '<circle class="qm-c" cx="20" cy="20" r="2.6"/>'+
      '</g>'+
    '</svg>';
  dot.title='Quill 的心情小灯 · 点点它试试';
  dot.addEventListener&&dot.addEventListener('click',qmTap);
  return dot;
}
function qmTap(e){
  if(e){e.stopPropagation&&e.stopPropagation();}
  const now=Date.now();
  _qmTaps=_qmTaps.filter(t=>now-t<3000);_qmTaps.push(now);
  if(_qmTaps.length>=4){_qmTaps=[];qmPlay('happy');}   // 戳多了：粉红开心，转一圈
  else qmPlay('shy');                                    // 戳一戳：浅粉害羞，慢慢浮动几下
}
// ── v4.6 · 情绪场感知（轻量本地启发式，不是训练过的模型）──
// 聊到偏沉重的内容时，戳它/猜拳赢了不该立刻蹦跳卖萌——先把这类"外部触发的欢快反应"压一压，
// 过一段时间自己回暖。判断方式是关键词命中，做不到真正的语义理解，够用但不精确，见更新日志说明。
const QM_SOMBER_KW=/难过|伤心|委屈|emo|崩溃|心累|好累|累死|压力好大|压力很大|烦死了|不想说话|失眠|吵架了|分手了|离婚|失业|裁员|挂了|生病|住院|抑郁|焦虑|想哭|哭了|好烦|难受|孤独|好孤单/;
const QM_SOMBER_MS=12*60000;   // 冷却窗口：12 分钟内不该立刻演开心/害羞这类"外部触发"的欢快反应
// v4.6.17：上一轮这里犯了个逻辑错——疑惑应该是 Quill 自己没弄明白，不是用户说自己没看懂。
// 用户说"看不懂"，那是用户的困惑，该触发的是 Quill 更耐心地解释（这属于回复内容本身该做的事，
// 不该反过来在光点上演"我也很疑惑"）。真正该让光点疑惑的时刻，是 Quill 自己的回复里带着
// 不确定/拿不准的措辞——这才是"Quill 自己没弄明白"这件事在对话里留下的真实痕迹。
const QM_PUZZLE_KW=/不太确定|不太清楚|不确定|拿不准|说不好|不太理解|没太明白|我也不知道|我也没弄懂|可能记错|印象里好像|不敢确定/;
function qmScanSentiment(userMsg,replyMsg){
  const text=(userMsg||'')+' '+(replyMsg||'');
  if(QM_SOMBER_KW.test(text)){
    try{localStorage.setItem('qmood_somber_until',String(Date.now()+QM_SOMBER_MS));}catch(e){}
  }
  // 疑惑是"这一刻"的反应，不像沉重话题要压一整段时间——Quill 说完这句带不确定措辞的话，
  // 光点跟着疑惑一下就好，不需要留一个长冷却窗口（那是"降级"用的，疑惑是直接触发，性质不一样）。
  if(replyMsg&&QM_PUZZLE_KW.test(replyMsg)&&typeof qmPlay==='function')qmPlay('confused');
}
function qmSomberActive(){
  try{const t=+localStorage.getItem('qmood_somber_until');return t&&Date.now()<t;}catch(e){return false;}
}

let _qmTimer=null,_qmLast='';
function qmLastMood(){return _qmLast;}
function qmPlay(mood){
  const dot=qmInit();if(!dot)return;
  // 情绪场里，外部触发（摸头/猜拳赢等）想演开心或害羞，先降成安静的"在意你"呼吸——不夸张地蹦跳
  if(qmSomberActive()&&(mood==='happy'||mood==='shy')){
    dot.classList.remove('qm-happy','qm-sad','qm-surprise','qm-shy','qm-confused');
    void (dot.offsetWidth||0);
    _qmLast='care';
    dot.classList.add('qm-care');
    if(_qmTimer){clearTimeout(_qmTimer);_qmTimer=null;}
    _qmTimer=setTimeout(()=>{dot.classList.remove('qm-care');_qmTimer=null;},1800);
    return;
  }
  _qmLast=mood;
  if(_qmTimer){clearTimeout(_qmTimer);_qmTimer=null;}
  dot.classList.remove('qm-happy','qm-sad','qm-surprise','qm-shy','qm-confused');
  void (dot.offsetWidth||0);
  dot.classList.add('qm-'+mood);
  _qmTimer=setTimeout(()=>{dot.classList.remove('qm-'+mood);_qmTimer=null;},QM_DUR[mood]||2000);
}
// ── 接管 qMood：老调用点传的是 win/lose/tie/shy，映射到情绪 ──
// 赢=开心(粉红) 输=低落(蓝) 平=惊讶(亮金) 摸头授牌=害羞(浅粉)
function qMood(kind){
  const map={win:'happy',lose:'sad',tie:'surprise',shy:'shy',
             happy:'happy',sad:'sad',surprise:'surprise',confused:'confused'};
  const m=map[kind];if(!m)return;
  qmPlay(m);
}
// 页面就绪后把小灯升级成光点（脚本在 body 末尾，此时头部已在；冒烟桩里 querySelector 为 null 时安静跳过）
try{qmInit();}catch(_){}

