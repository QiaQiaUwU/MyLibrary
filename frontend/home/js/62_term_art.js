// ╔══ 62_term_art.js —— 24 张节气专属图（v4.4.0）══╗
// 本文件是 /static/home.js 的一段：后端按文件名顺序拼接后整体下发，无构建步。
// 风格对齐验收过的荷花/枫叶海报版：半透明色块叠色、柔和渐变、无硬线（唯一例外：
// 水仙这类白色主体，瓣缘加一圈很轻的暖灰描边 + 花后淡绿衬底 + 花下深绿叶丛，三层办法保对比）。
// 每张 viewBox 140×170，轻动效沿用 index.html 里现成的 qt* 关键帧；渐变 id 全部带 g01~g24 前缀防冲突。

const QTERM_ART24=(function(){
  const svg=(defs,body)=>'<svg viewBox="0 0 140 170"><defs>'+defs+'</defs>'+body+'</svg>';
  const lin=(id,x1,y1,x2,y2,stops)=>'<linearGradient id="'+id+'" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'">'+stops+'</linearGradient>';
  const rad=(id,stops,cx,cy,r)=>'<radialGradient id="'+id+'"'+(cx!=null?' cx="'+cx+'" cy="'+cy+'" r="'+r+'"':'')+'>'+stops+'</radialGradient>';
  const st=(o,c,op)=>'<stop offset="'+o+'" stop-color="'+c+'"'+(op!=null?' stop-opacity="'+op+'"':'')+'/>';
  const A={};

  // ── 立春 · 柳芽：一枝垂柳，嫩芽初绽 ──
  A['立春']=svg(
    lin('g01a','0','0','0','1',st(0,'#c9b894')+st(1,'#a08a68'))+
    lin('g01b','0','0','0','1',st(0,'#d8ecc0')+st(1,'#8fbf7a')),
    '<g style="transform-origin:52px 40px;animation:qtSway 4.2s ease-in-out infinite">'+
    '<path d="M44 24C50 56 52 90 54 124C53.2 124 52.4 124 51.6 124C49.4 90 47.4 56 41 25Z" fill="url(#g01a)" opacity=".9"/>'+
    '<path d="M50 52C66 56 84 64 100 78C99.5 78.6 99 79.2 98.5 79.8C82 66 65 58.5 49.3 54.8Z" fill="url(#g01a)" opacity=".82"/>'+
    '<path d="M52 86C64 90 76 98 86 110C85.4 110.5 84.8 111 84.2 111.5C74 100 62.5 92.5 51.2 88.8Z" fill="url(#g01a)" opacity=".78"/>'+
    [[46,38,-24],[58,66,-8],[50,96,-20],[56,118,12],[72,60,26],[86,68,34],[98,74,44],[70,94,20],[84,106,32]].map(p=>
      '<path d="M0 0C7 2 11 8 10 17C3 14 -1 7 0 0Z" fill="url(#g01b)" opacity=".88" transform="translate('+p[0]+','+p[1]+') rotate('+p[2]+')"/>').join('')+
    '<ellipse cx="44" cy="27" rx="4.5" ry="7" fill="url(#g01b)" opacity=".92" transform="rotate(-18 44 27)"/>'+
    '<ellipse cx="102" cy="80" rx="3.6" ry="5.6" fill="url(#g01b)" opacity=".9" transform="rotate(48 102 80)"/>'+
    '</g>');

  // ── 雨水 · 雨滴新叶：新芽两叶，细雨轻落 ──
  A['雨水']=svg(
    lin('g02a','0','0','0','1',st(0,'#cfe6b0')+st(1,'#7fae6a'))+
    lin('g02b','0','0','0','1',st(0,'#cfe2f0')+st(1,'#8fb0d0')),
    [0,1,2].map(i=>'<path d="M0 0C4.2 5.6 4.2 10.4 0 13.2C-4.2 10.4 -4.2 5.6 0 0Z" fill="url(#g02b)" opacity=".8" style="animation:qtDrop 2.3s '+(i*0.7)+'s ease-in infinite" transform="translate('+(46+i*24)+',30)"/>').join('')+
    '<path d="M70 142C69 118 69 100 70 86C71 100 71 118 70 142Z" fill="#7fae6a" opacity=".9"/>'+
    '<path d="M69 96C50 92 38 78 36 58C58 62 69 76 69 96Z" fill="url(#g02a)" opacity=".9"/>'+
    '<path d="M71 88C90 84 102 70 104 50C82 54 71 68 71 88Z" fill="url(#g02a)" opacity=".82"/>'+
    '<path d="M69 96C56 90 47 79 43 63C57 70 65 81 69 96Z" fill="#5f8f52" opacity=".35"/>'+
    '<ellipse cx="90" cy="66" rx="4" ry="5" fill="url(#g02b)" opacity=".85" style="animation:qtGlisten 2.6s ease-in-out infinite"/>');

  // ── 惊蛰 · 桃花：春雷后第一树桃夭 ──
  A['惊蛰']=svg(
    rad('g03a',st(0,'#fbe0e8')+st(.6,'#f6b8cc')+st(1,'#ec8fae'))+
    rad('g03b',st(0,'#f3a8c0')+st(1,'#e07898')),
    '<g style="transform-origin:70px 82px;animation:qtBreathe 3.8s ease-in-out infinite">'+
    [0,72,144,216,288].map(a=>'<path d="M70 82C61 70 60 56 70 46C80 56 79 70 70 82Z" fill="url(#g03a)" opacity=".88" transform="rotate('+a+' 70 82)"/>').join('')+
    '<circle cx="70" cy="82" r="8" fill="url(#g03b)" opacity=".95"/>'+
    [0,60,120,180,240,300].map(a=>'<circle cx="70" cy="72.5" r="1.7" fill="#f2d38a" transform="rotate('+a+' 70 82)"/>').join('')+
    '</g>'+
    '<path d="M92 118C98 122 102 128 103 136C96 133 92 127 92 118Z" fill="url(#g03b)" opacity=".8"/>'+
    '<ellipse cx="104" cy="140" rx="5" ry="6.5" fill="url(#g03b)" opacity=".88" style="transform-origin:104px 140px;animation:qtPulse 3s 1s ease-in-out infinite"/>');

  // ── 春分 · 燕子：昼夜平分，玄鸟至 ──
  A['春分']=svg(
    lin('g04a','0','0','1','1',st(0,'#5f7a9a')+st(1,'#2f4560'))+
    lin('g04b','0','0','0','1',st(0,'#fbf7ec')+st(1,'#e8e0cc')),
    '<g style="animation:qtBob 3.4s ease-in-out infinite">'+
    '<path d="M30 96C48 72 66 62 84 62C82 74 74 84 60 92C74 90 88 92 100 100C84 104 68 104 54 100C46 108 38 112 30 112C34 106 34 101 30 96Z" fill="url(#g04a)" opacity=".55"/>'+
    '<path d="M40 78C58 62 76 56 92 60C104 63 110 70 112 78C104 74 96 74 88 78C96 84 100 92 100 102C100 102 92 94 82 90C74 106 60 118 40 124C50 112 55 102 55 92C46 92 40 88 36 82C38 80 39 79 40 78Z" fill="url(#g04a)"/>'+
    '<path d="M55 92C64 86 74 84 84 87C78 96 68 101 55 101C55 98 55 95 55 92Z" fill="url(#g04b)" opacity=".95"/>'+
    '<path d="M100 102C106 108 110 116 112 126C106 120 102 114 98 108ZM100 102C104 110 105 119 103 129C100 122 98 115 97 108Z" fill="url(#g04a)"/>'+
    '<circle cx="99" cy="68" r="2" fill="#2a3a4e"/>'+
    '<ellipse cx="93" cy="74" rx="4.5" ry="3.5" fill="#cf6a4a" opacity=".9"/>'+
    '</g>');

  // ── 清明 · 纸鸢：天清气明，风筝入云 ──
  A['清明']=svg(
    lin('g05a','0','0','1','1',st(0,'#f2b592')+st(1,'#dd8562'))+
    lin('g05b','0','0','1','1',st(0,'#fbeed6')+st(1,'#f2d8ac')),
    '<g style="transform-origin:70px 70px;animation:qtRock 3.6s ease-in-out infinite">'+
    '<path d="M70 22L112 70L70 96L28 70Z" fill="url(#g05b)" opacity=".92"/>'+
    '<path d="M70 22L112 70L70 70Z" fill="url(#g05a)" opacity=".82"/>'+
    '<path d="M70 70L70 96L28 70Z" fill="url(#g05a)" opacity=".82"/>'+
    '<path d="M69.3 22h1.4V96h-1.4Z M28.4 69.3L111.6 69.3v1.4L28.4 70.7Z" fill="#b98a5f" opacity=".4"/>'+
    '</g>'+
    '<path d="M70 96C66 112 56 124 42 136C56 126 64 114 68.6 96.4Z" fill="#b98a5f" opacity=".5"/>'+
    [[56,112],[46,126]].map(p=>'<path d="M-6 0C-2 -3 2 -3 6 0C2 3 -2 3 -6 0Z" fill="url(#g05a)" opacity=".85" transform="translate('+p[0]+','+p[1]+') rotate(-32)"/>').join(''));

  // ── 谷雨 · 牡丹：雨生百谷，花开时节动京城 ──
  A['谷雨']=svg(
    rad('g06a',st(0,'#f8d0dc')+st(1,'#e893ae'))+
    rad('g06b',st(0,'#f0a8c0')+st(1,'#d8748f')),
    '<g style="transform-origin:70px 86px;animation:qtBreathe 4s ease-in-out infinite">'+
    [0,60,120,180,240,300].map(a=>'<path d="M70 86C54 78 48 62 56 46C62 52 66 52 70 46C74 52 78 52 84 46C92 62 86 78 70 86Z" fill="url(#g06a)" opacity=".8" transform="rotate('+a+' 70 86)"/>').join('')+
    [36,108,180,252,324].map(a=>'<path d="M70 86C60 80 57 69 62 59C66 63 69 63 70 59C71 63 74 63 78 59C83 69 80 80 70 86Z" fill="url(#g06b)" opacity=".85" transform="rotate('+a+' 70 86)"/>').join('')+
    '<circle cx="70" cy="86" r="7.5" fill="#f2c95f" opacity=".95"/>'+
    [0,72,144,216,288].map(a=>'<circle cx="70" cy="80.5" r="1.6" fill="#e0a03a" transform="rotate('+a+' 70 86)"/>').join('')+
    '</g>');

  // ── 立夏 · 荷花：万物并秀（验收定稿的那朵）──
  A['立夏']=svg(
    lin('g07a','0','0','0','1',st(0,'#f9d4e0')+st(1,'#efa8c2'))+
    lin('g07b','0','0','0','1',st(0,'#9fc490')+st(1,'#6d9a59')),
    '<path d="M69 158C68 130 68 112 69.2 96C70.4 112 70.6 130 70.6 158Z" fill="url(#g07b)"/>'+
    '<g style="transform-origin:70px 84px;animation:qtBob 3.6s ease-in-out infinite">'+
    [0,45,90,135,180,225,270,315].map(a=>'<path d="M70 82C64 68 64 50 70 36C76 50 76 68 70 82Z" fill="url(#g07a)" opacity=".82" transform="rotate('+a+' 70 82)"/>').join('')+
    [22,67,112,157,202,247,292,337].map(a=>'<path d="M70 82C66 72 66 58 70 48C74 58 74 72 70 82Z" fill="#f2b8ce" opacity=".55" transform="rotate('+a+' 70 82)"/>').join('')+
    [0,30,60,90,120,150,180,210,240,270,300,330].map(a=>'<rect x="69.3" y="66" width="1.4" height="5" rx=".7" fill="#e8b23f" opacity=".9" transform="rotate('+a+' 70 82)"/>').join('')+
    '<path d="M60 74C60 68 64 64 70 64C76 64 80 68 80 74C80 78 76 81 70 81C64 81 60 78 60 74Z" fill="url(#g07b)"/>'+
    [[65,70],[70,68.5],[75,70],[67.5,74],[72.5,74]].map(p=>'<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.5" fill="#3f6a3a" opacity=".85"/>').join('')+
    '</g>');

  // ── 小满 · 青麦：物至于此，小得盈满 ──
  A['小满']=(function(){
    const ear=(dx,dl)=>'<g style="transform-origin:'+(70+dx)+'px 150px;animation:qtSway 3s '+dl+'s ease-in-out infinite" transform="translate('+dx+',0)">'+
      '<path d="M69.2 150C68.6 118 68.8 92 70 66C71.2 92 71.4 118 70.8 150Z" fill="#8fb95f" opacity=".9"/>'+
      [0,1,2,3].map(i=>{const y=68+i*14;return '<path d="M70 '+(y+10)+'C61 '+(y+7)+' 56 '+(y-1)+' 56 '+(y-9)+'C65 '+(y-6)+' 70 '+(y+1)+' 70 '+(y+10)+'Z" fill="url(#g08a)" opacity=".88"/>'+
        '<path d="M70 '+(y+10)+'C79 '+(y+7)+' 84 '+(y-1)+' 84 '+(y-9)+'C75 '+(y-6)+' 70 '+(y+1)+' 70 '+(y+10)+'Z" fill="url(#g08a)" opacity=".88"/>';}).join('')+
      [-8,-3,3,8].map((x,i)=>'<path d="M'+(70+x)+' 66C'+(70+x*1.6)+' 52 '+(70+x*2)+' 40 '+(70+x*2.4)+' 30C'+(70+x*2.1)+' 41 '+(70+x*1.7)+' 53 '+(70+x+0.9)+' 66Z" fill="#a9c98f" opacity=".55"/>').join('')+
      '</g>';
    return svg(lin('g08a','0','0','0','1',st(0,'#cfe4a8')+st(1,'#8fb95f')),ear(-22,0)+ear(0,.5)+ear(22,1));
  })();

  // ── 芒种 · 青梅：煮酒论时节 ──
  A['芒种']=svg(
    rad('g09a',st(0,'#dff0b8')+st(.5,'#b8d888')+st(1,'#84ad55'),'.35','.3','.9')+
    lin('g09b','0','0','0','1',st(0,'#9fbf7a')+st(1,'#6d9a59')),
    '<path d="M118 30C98 38 82 50 72 66C71.2 65.5 70.4 65 69.6 64.5C80 47 96 35 116 27Z" fill="#8a7355" opacity=".85"/>'+
    '<path d="M86 54C82 62 80 70 80 78C79.3 78 78.6 78 77.9 78C78 69 80 61 84 53Z" fill="#8a7355" opacity=".7"/>'+
    '<g style="transform-origin:76px 60px;animation:qtSway 4.4s ease-in-out infinite">'+
    '<path d="M96 50C108 54 116 62 118 74C106 72 98 64 96 50Z" fill="url(#g09b)" opacity=".85"/>'+
    '<path d="M58 62C50 70 46 80 47 92C57 86 62 76 58 62Z" fill="url(#g09b)" opacity=".78"/>'+
    '<circle cx="66" cy="98" r="17" fill="url(#g09a)" opacity=".95"/>'+
    '<circle cx="92" cy="106" r="14" fill="url(#g09a)" opacity=".88"/>'+
    '<path d="M60 88a17 17 0 0 0 -1 10" fill="none"/>'+
    '</g>');

  // ── 夏至 · 蝉：一阴始生，蝉始鸣 ──
  A['夏至']=svg(
    lin('g10a','0','0','0','1',st(0,'#d0a468')+st(1,'#8a5f3a'))+
    lin('g10b','0','0','0','1',st(0,'#f4efdd',.72)+st(1,'#ddd4ba',.5)),
    '<g style="transform-origin:70px 70px;animation:qtShimmer 3.2s ease-in-out infinite">'+
    '<path d="M64 58C46 74 38 96 40 122C52 112 60 94 64 70Z" fill="url(#g10b)"/>'+
    '<path d="M76 58C94 74 102 96 100 122C88 112 80 94 76 70Z" fill="url(#g10b)"/>'+
    '<path d="M62 64C52 76 47 90 46 106C52 96 57 82 61 66Z" fill="#fbf8ee" opacity=".5"/>'+
    '<path d="M78 64C88 76 93 90 94 106C88 96 83 82 79 66Z" fill="#fbf8ee" opacity=".5"/>'+
    '</g>'+
    '<ellipse cx="70" cy="52" rx="13" ry="10" fill="url(#g10a)"/>'+
    '<circle cx="59" cy="49" r="3.4" fill="#5f402a"/><circle cx="81" cy="49" r="3.4" fill="#5f402a"/>'+
    '<path d="M70 58C79 58 84 66 84 78C84 96 78 110 70 118C62 110 56 96 56 78C56 66 61 58 70 58Z" fill="url(#g10a)"/>'+
    [72,82,92,101].map(y=>'<path d="M58 '+y+'C66 '+(y+3)+' 74 '+(y+3)+' 82 '+y+'C74 '+(y+5)+' 66 '+(y+5)+' 58 '+y+'Z" fill="#f2dab0" opacity=".45"/>').join(''));

  // ── 小暑 · 蜻蜓小荷：小荷才露尖尖角，早有蜻蜓立上头 ──
  A['小暑']=svg(
    lin('g11a','0','0','0','1',st(0,'#efa8c2')+st(.5,'#c9c08a')+st(1,'#7fae6a'))+
    lin('g11b','1','0','0','0',st(0,'#e88a5f')+st(1,'#c9583a'))+
    lin('g11c','0','0','1','0',st(0,'#dfe8f0',.62)+st(1,'#b8ccd8',.4)),
    '<path d="M69.2 158C68.6 128 68.8 106 70 84C71.2 106 71.4 128 70.8 158Z" fill="#6d9a59" opacity=".9"/>'+
    '<g style="transform-origin:70px 84px;animation:qtBob 3.4s ease-in-out infinite">'+
    '<path d="M70 34C78 48 80 66 76 84C73 85.5 67 85.5 64 84C60 66 62 48 70 34Z" fill="url(#g11a)" opacity=".92"/>'+
    '<path d="M70 40C74 52 75 66 73 80C71.6 80.8 68.4 80.8 67 80C65 66 66 52 70 40Z" fill="#f6c9d8" opacity=".45"/>'+
    '<g style="transform-origin:88px 34px;animation:qtShimmer 2.6s ease-in-out infinite">'+
    '<path d="M84 34C68 26 54 24 40 26C54 32 68 35 83 36Z" fill="url(#g11c)"/>'+
    '<path d="M86 30C74 20 62 15 48 14C60 22 72 28 85 32Z" fill="url(#g11c)"/>'+
    '<path d="M92 36C104 30 116 28 128 30C116 36 104 39 93 38Z" fill="url(#g11c)"/>'+
    '<path d="M92 32C102 24 113 20 126 20C115 27 104 32 93 34Z" fill="url(#g11c)"/>'+
    '</g>'+
    '<path d="M86 32C96 32 106 34 116 40C106 42 96 40 87 36Z" fill="url(#g11b)"/>'+
    '<circle cx="84" cy="33" r="4.5" fill="#c9583a"/><circle cx="81" cy="31" r="1.4" fill="#5f2f20"/>'+
    '</g>');

  // ── 大暑 · 西瓜：土润溽暑，浮瓜沉李 ──
  A['大暑']=svg(
    rad('g12a',st(0,'#f6969c')+st(1,'#e05a62'),'.5','.15','1')+
    lin('g12b','0','0','0','1',st(0,'#a9cba0')+st(1,'#5f8f5a')),
    '<g style="transform-origin:70px 108px;animation:qtRock 4.2s ease-in-out infinite">'+
    '<g transform="rotate(-14 70 96)">'+
    '<path d="M16 96A54 54 0 0 0 124 96Z" fill="url(#g12b)"/>'+
    '<path d="M22 96A48 48 0 0 0 118 96Z" fill="#f4efdd"/>'+
    '<path d="M26 96A44 44 0 0 0 114 96Z" fill="url(#g12a)"/>'+
    '<path d="M18 95.2h104v1.6H18Z" fill="#4f7a4a" opacity=".35"/>'+
    '<path d="M36 108A40 40 0 0 0 58 132C48 128 40 120 36 108Z" fill="#fbd0d4" opacity=".4"/>'+
    [[52,112,18],[70,126,0],[88,112,-18],[60,104,10],[80,104,-10]].map(p=>
      '<path d="M0 0C2.4 2.6 2.4 5.4 0 7.4C-2.4 5.4 -2.4 2.6 0 0Z" fill="#4a3428" opacity=".9" transform="translate('+p[0]+','+p[1]+') rotate('+p[2]+')"/>').join('')+
    '</g>'+
    '<path d="M0 0C2.4 2.6 2.4 5.4 0 7.4C-2.4 5.4 -2.4 2.6 0 0Z" fill="#4a3428" opacity=".85" transform="translate(98,66) rotate(24)"/>'+
    '</g>');

  // ── 立秋 · 枫叶：一叶知秋（验收定稿的那片）──
  A['立秋']=svg(
    lin('g13a','0','0','0','1',st(0,'#f2b558')+st(1,'#dd7a42'))+
    lin('g13b','0','0','1','1',st(0,'#e8935a')+st(1,'#cf5f38')),
    '<g style="transform-origin:70px 78px;animation:qtSway 4.4s ease-in-out infinite">'+
    '<path d="M70 24L78 46L96 32L92 56L118 52L100 74L120 86L94 90L102 112L78 98L70 122L62 98L38 112L46 90L20 86L40 74L22 52L48 56L44 32L62 46Z" fill="url(#g13a)" opacity=".9"/>'+
    '<path d="M70 40L76 56L90 46L86 64L106 62L92 76L106 86L86 88L92 104L74 92L70 108L66 92L48 104L54 88L34 86L48 76L34 62L54 64L50 46L64 56Z" fill="url(#g13b)" opacity=".62"/>'+
    [[70,26,70,96],[26,58,70,88],[114,58,70,88],[42,104,70,90],[98,104,70,90]].map(p=>
      '<path d="M'+p[0]+' '+p[1]+'C'+((p[0]+p[2])/2+2)+' '+((p[1]+p[3])/2)+' '+((p[0]+p[2])/2-2)+' '+((p[1]+p[3])/2)+' '+p[2]+' '+p[3]+'Z" fill="#b0562e" opacity=".35"/>').join('')+
    '<path d="M69.2 118C68 132 66 142 62 152C63 152.6 64 153.2 65 153.8C69 143 71 132 70.9 118.3Z" fill="#b0562e" opacity=".8"/>'+
    '</g>');

  // ── 处暑 · 稻穗：禾乃登，暑气渐止 ──
  A['处暑']=svg(
    lin('g14a','0','0','0','1',st(0,'#f4dfa8')+st(1,'#d0a850')),
    '<g style="transform-origin:60px 150px;animation:qtSway 3.4s ease-in-out infinite">'+
    '<path d="M59.2 150C58 122 58 98 62 76C66 58 76 46 92 40C93 41 93 42 93 43C79 50 71 61 68 78C64 98 64 122 60.8 150Z" fill="#c0a05f" opacity=".85"/>'+
    [[92,42,-6],[97,48,10],[100,56,24],[101,65,38],[99,74,54],[95,82,68]].map((p,i)=>
      '<g transform="translate('+p[0]+','+p[1]+') rotate('+p[2]+')">'+
      '<ellipse cx="-5" cy="0" rx="5.2" ry="3.4" fill="url(#g14a)" opacity=".92"/>'+
      '<ellipse cx="5" cy="1.5" rx="5.2" ry="3.4" fill="url(#g14a)" opacity=".85"/></g>').join('')+
    '<path d="M66 92C58 78 56 64 60 50C61 50.4 62 50.8 63 51.2C60 64 62 77 68.6 90.4Z" fill="#c0a05f" opacity=".6"/>'+
    [[60,52,-18],[63,60,-6],[64,69,8],[66,78,20],[66,86,32]].map(p=>
      '<g transform="translate('+p[0]+','+p[1]+') rotate('+p[2]+')"><ellipse cx="-3.8" cy="0" rx="4" ry="2.7" fill="url(#g14a)" opacity=".8"/><ellipse cx="3.8" cy="1" rx="4" ry="2.7" fill="url(#g14a)" opacity=".72"/></g>').join('')+
    '</g>');

  // ── 白露 · 芦苇：蒹葭苍苍，白露为霜 ──
  A['白露']=svg(
    lin('g15a','0','0','0','1',st(0,'#efe3c4')+st(1,'#c9ac80'))+
    lin('g15b','0','0','0','1',st(0,'#cfe2f0')+st(1,'#8fb0d0')),
    '<g style="transform-origin:50px 152px;animation:qtSway 3.8s ease-in-out infinite">'+
    '<path d="M49.2 152C48 118 48 88 50 58C50.9 58 51.8 58 52.7 58C51 88 51 118 50.8 152Z" fill="#b09a6f" opacity=".9"/>'+
    [[51,56,0],[47,44,-10],[55,44,12],[50,32,2],[44,52,-20],[58,54,22]].map(p=>
      '<path d="M0 0C5 6 6 15 3 26C-1 16 -2 7 0 0Z" fill="url(#g15a)" opacity=".85" transform="translate('+p[0]+','+p[1]+') rotate('+p[2]+')"/>').join('')+
    '<path d="M50 92C70 86 92 90 112 104C111.5 104.7 111 105.4 110.5 106.1C91 93 70 89.5 50.6 94.8Z" fill="#c9b488" opacity=".7"/>'+
    '</g>'+
    '<g style="transform-origin:98px 150px;animation:qtSway 3.8s .8s ease-in-out infinite">'+
    '<path d="M97.4 150C96.6 122 96.8 98 99 74C99.8 74.1 100.6 74.2 101.4 74.3C99 98 99 122 99 150Z" fill="#b09a6f" opacity=".8"/>'+
    [[100,72,4],[96,62,-8],[104,62,14],[99,51,0],[93,70,-18],[107,72,20]].map(p=>
      '<path d="M0 0C4 5 5 12 2.5 21C-1 13 -1.6 6 0 0Z" fill="url(#g15a)" opacity=".8" transform="translate('+p[0]+','+p[1]+') rotate('+p[2]+')"/>').join('')+
    '<path d="M99 108C88 106 78 108 68 116C78 120 89 118 99.4 111Z" fill="#c9b488" opacity=".6"/>'+
    '</g>'+
    '<path d="M0 0C3.4 4.3 3.4 8 0 10.6C-3.4 8 -3.4 4.3 0 0Z" fill="url(#g15b)" opacity=".85" style="animation:qtDrip 3s ease-in infinite" transform="translate(92,102)"/>');

  // ── 秋分 · 桂花：昼夜均长，满树浮金 ──
  A['秋分']=svg(
    lin('g16a','0','0','0','1',st(0,'#6f9a68')+st(1,'#3f6a4a'))+
    rad('g16b',st(0,'#f8dc8f')+st(1,'#e8b04a')),
    '<path d="M74 34C60 52 54 74 56 100C57 100 58 100 59 100C60 76 66 55 78 37Z" fill="#7a6448" opacity=".8"/>'+
    [[52,74,-34],[86,60,28],[58,112,-16],[92,96,40],[70,128,10]].map(p=>
      '<path d="M0 0C10 -4 20 -3 28 4C20 11 10 12 0 8C-1 5 -1 2 0 0Z" fill="url(#g16a)" opacity=".85" transform="translate('+p[0]+','+p[1]+') rotate('+p[2]+')"/>').join('')+
    '<g style="animation:qtShimmer 3s ease-in-out infinite">'+
    [[74,52],[84,44],[92,54],[82,60],[48,92],[40,100],[50,104],[58,96],[96,116],[104,108],[108,120],[98,126]].map(p=>
      [0,90,180,270].map(a=>'<ellipse cx="'+p[0]+'" cy="'+(p[1]-3.6)+'" rx="2.2" ry="3.2" fill="url(#g16b)" opacity=".92" transform="rotate('+a+' '+p[0]+' '+p[1]+')"/>').join('')+
      '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="1.3" fill="#c98a2e"/>').join('')+
    '</g>');

  // ── 寒露 · 菊花：露气寒冷，此花开尽更无花 ──
  A['寒露']=svg(
    lin('g17a','0','0','0','1',st(0,'#f6d078')+st(1,'#e0913e'))+
    lin('g17b','0','0','0','1',st(0,'#f2b85f')+st(1,'#d0782e')),
    '<g style="transform-origin:70px 84px;animation:qtBreathe 4.2s ease-in-out infinite">'+
    Array.from({length:16},(_,i)=>i*22.5).map(a=>'<path d="M70 84C64 70 64 54 71 40C76 54 76 70 70 84Z" fill="url(#g17a)" opacity=".78" transform="rotate('+a+' 70 84)"/>').join('')+
    Array.from({length:11},(_,i)=>i*32.7+16).map(a=>'<path d="M70 84C66 74 66 62 71 52C75 62 74 74 70 84Z" fill="url(#g17b)" opacity=".85" transform="rotate('+a+' 70 84)"/>').join('')+
    '<circle cx="70" cy="84" r="8.5" fill="#c9862e" opacity=".95"/>'+
    '<circle cx="70" cy="84" r="4.5" fill="#a8641f" opacity=".8"/>'+
    '</g>');

  // ── 霜降 · 柿子：柿柿如意，霜打更甜 ──
  A['霜降']=svg(
    rad('g18a',st(0,'#f6bd6a')+st(.55,'#ee9040')+st(1,'#dd6f30'),'.35','.28','.95')+
    lin('g18b','0','0','0','1',st(0,'#9fbf7a')+st(1,'#5f8a52')),
    '<path d="M96 26C86 32 78 40 74 50C73.2 49.6 72.4 49.2 71.6 48.8C76 38 84 29 94 23Z" fill="#8a7355" opacity=".85"/>'+
    '<g style="transform-origin:92px 74px;animation:qtPulse 3.6s 1.2s ease-in-out infinite">'+
    '<circle cx="96" cy="72" r="19" fill="url(#g18a)" opacity=".9"/>'+
    [0,90,180,270].map(a=>'<path d="M96 60C93 55 93 50 96 46C99 50 99 55 96 60Z" fill="url(#g18b)" opacity=".9" transform="rotate('+(a+45)+' 96 58)"/>').join('')+
    '</g>'+
    '<g style="transform-origin:58px 102px;animation:qtPulse 3.6s ease-in-out infinite">'+
    '<circle cx="58" cy="104" r="26" fill="url(#g18a)"/>'+
    '<path d="M58 82C66 86 70 92 70 100C64 96 60 90 58 82Z" fill="#fbe0b0" opacity=".4"/>'+
    [0,90,180,270].map(a=>'<path d="M58 86C54.5 80 54.5 74 58 69C61.5 74 61.5 80 58 86Z" fill="url(#g18b)" transform="rotate('+(a+45)+' 58 84)"/>').join('')+
    '<path d="M57 70h2v-8h-2Z" fill="#7a6448"/>'+
    '</g>');

  // ── 立冬 · 山茶：水始冰，茶花正艳 ──
  A['立冬']=svg(
    rad('g19a',st(0,'#f0929a')+st(1,'#cf4f58'))+
    rad('g19b',st(0,'#e56a74')+st(1,'#b83a44'))+
    lin('g19c','0','0','0','1',st(0,'#4f7f5a')+st(1,'#2f5a40')),
    '<path d="M46 118C34 114 26 106 24 94C38 96 46 104 48 116Z" fill="url(#g19c)" opacity=".9"/>'+
    '<path d="M94 118C106 112 118 112 128 118C120 126 108 128 96 122Z" fill="url(#g19c)" opacity=".85"/>'+
    '<path d="M44 112C36 108 31 102 29 95C30 96 40 102 46 110Z" fill="#8fbf9a" opacity=".4"/>'+
    '<g style="transform-origin:70px 84px;animation:qtBreathe 4s ease-in-out infinite">'+
    [0,60,120,180,240,300].map(a=>'<path d="M70 86C58 82 52 70 56 56C64 58 70 66 70 78C70 66 76 58 84 56C88 70 82 82 70 86Z" fill="url(#g19a)" opacity=".82" transform="rotate('+a+' 70 84)"/>').join('')+
    [30,150,270].map(a=>'<path d="M70 84C62 78 60 68 65 59C70 64 72 72 70 84C68 72 70 64 75 59C80 68 78 78 70 84Z" fill="url(#g19b)" opacity=".85" transform="rotate('+a+' 70 84)"/>').join('')+
    [0,45,90,135,180,225,270,315].map(a=>'<circle cx="70" cy="77" r="1.8" fill="#f2c95f" transform="rotate('+a+' 70 84)"/>').join('')+
    '<circle cx="70" cy="84" r="3.4" fill="#e8b23f"/>'+
    '</g>');

  // ── 小雪 · 雪人：虹藏不见，团一个冬天 ──
  A['小雪']=svg(
    rad('g20a',st(0,'#ffffff')+st(.7,'#f6f4ec')+st(1,'#e8e4d6'),'.4','.32','.85'),
    [[30,26,3],[108,40,2.4],[44,58,2]].map((p,i)=>'<circle r="'+p[2]+'" fill="#dce6ee" opacity=".9" style="animation:qtSnowFall '+(4.6+i)+'s '+(i*1.3)+'s ease-in infinite" transform="translate('+p[0]+','+p[1]+')"/>').join('')+
    '<ellipse cx="74" cy="122" rx="34" ry="30" fill="#d8e0e8" opacity=".55"/>'+
    '<ellipse cx="73" cy="66" rx="22" ry="20" fill="#d8e0e8" opacity=".5"/>'+
    '<ellipse cx="70" cy="120" rx="32" ry="29" fill="url(#g20a)"/>'+
    '<path d="M42 128A32 29 0 0 0 98 128A32 24 0 0 1 42 128Z" fill="#cfd8e0" opacity=".45"/>'+
    '<circle cx="70" cy="64" r="21" fill="url(#g20a)"/>'+
    '<path d="M52 70A21 21 0 0 0 88 70A21 16 0 0 1 52 70Z" fill="#cfd8e0" opacity=".4"/>'+
    '<path d="M38 96C50 90 62 88 74 90C62 96 50 98 38 96Z" fill="#8a6a4a" opacity=".85"/>'+
    '<path d="M102 96C94 90 86 86 78 85C85 92 93 96 102 96Z" fill="#8a6a4a" opacity=".85"/>'+
    '<path d="M50 84C62 78 78 78 90 84C88 90 84 93 78 93C70 89 64 88 52 90C50 88 50 86 50 84Z" fill="#cf5a52" opacity=".9"/>'+
    '<path d="M76 92C78 100 78 108 75 116C71 108 71 100 73 92Z" fill="#c04a44" opacity=".85"/>'+
    '<circle cx="62" cy="60" r="2.4" fill="#4a4038"/><circle cx="78" cy="60" r="2.4" fill="#4a4038"/>'+
    '<path d="M70 65L86 69L70 71Z" fill="#e8853e"/>'+
    '<circle cx="70" cy="108" r="2.4" fill="#4a4038"/><circle cx="70" cy="120" r="2.4" fill="#4a4038"/><circle cx="70" cy="132" r="2.4" fill="#4a4038"/>');

  // ── 大雪 · 雪松：鹖鴠不鸣，青松覆雪 ──
  A['大雪']=svg(
    lin('g21a','0','0','0','1',st(0,'#7fa878')+st(1,'#3f6a4a'))+
    lin('g21b','0','0','0','1',st(0,'#ffffff')+st(1,'#eef2f4')),
    [[36,24,2.8],[104,32,2.2],[118,70,2]].map((p,i)=>'<circle r="'+p[2]+'" fill="#dce6ee" opacity=".9" style="animation:qtSnowFall '+(4.4+i*0.9)+'s '+(i*1.5)+'s ease-in infinite" transform="translate('+p[0]+','+p[1]+')"/>').join('')+
    '<path d="M66 132h8v18h-8Z" fill="#8a6a4a"/>'+
    '<path d="M70 88L104 134H36Z" fill="url(#g21a)"/>'+
    '<path d="M70 56L98 98H42Z" fill="url(#g21a)"/>'+
    '<path d="M70 26L92 62H48Z" fill="url(#g21a)"/>'+
    '<path d="M48 62H92C88 68 84 70 78 68C74 72 66 72 62 68C56 70 52 68 48 62Z" fill="#ccd8de" opacity=".55"/>'+
    '<path d="M47 61H93C89 66 84 68 78 66C74 70 66 70 62 66C56 68 51 66 47 61Z" fill="url(#g21b)"/>'+
    '<path d="M42 98H98C93 104 88 106 81 104C76 108 64 108 59 104C52 106 47 104 42 98Z" fill="#ccd8de" opacity=".55"/>'+
    '<path d="M41 97H99C94 102 88 104 81 102C76 106 64 106 59 102C52 104 46 102 41 97Z" fill="url(#g21b)"/>'+
    '<path d="M70 22C74 26 75 31 72 36C68 32 67 27 70 22Z" fill="url(#g21b)"/>');

  // ── 冬至 · 水仙：一阳复始，凌波仙子（白色主体三层保对比）──
  A['冬至']=svg(
    rad('g22a',st(0,'#ffffff')+st(1,'#f4f1e6'))+
    rad('g22b',st(0,'#f6c25f')+st(1,'#e0913a'))+
    lin('g22c','0','0','0','1',st(0,'#5f8f5c')+st(1,'#2f5a3c')),
    '<ellipse cx="70" cy="66" rx="42" ry="36" fill="#e2edd8" opacity=".9"/>'+   // ① 花后淡绿衬底
    '<g style="transform-origin:70px 120px;animation:qtSway 4.6s ease-in-out infinite">'+
    '<path d="M56 150C50 128 48 106 52 84C56 84 59 85 61 87C58 108 58 129 60 150Z" fill="url(#g22c)" opacity=".95"/>'+   // ③ 花下深绿叶丛
    '<path d="M84 150C90 130 92 110 89 88C85 88 82 89 80 91C83 111 83 131 80.5 150Z" fill="url(#g22c)" opacity=".9"/>'+
    '<path d="M70 150C67 128 67 104 70 80C73 104 73 128 70 150Z" fill="url(#g22c)"/>'+
    '<path d="M44 148C40 130 40 112 44 94C48 96 50 99 51 103C48 118 48 133 50 148Z" fill="url(#g22c)" opacity=".8"/>'+
    '<path d="M96 148C100 132 101 115 98 98C94 100 92 103 91 107C94 121 94 135 91.5 148Z" fill="url(#g22c)" opacity=".75"/>'+
    // ② 白花 + 瓣缘一圈很轻的暖灰描边
    '<g style="transform-origin:70px 64px;animation:qtBreathe 4.6s ease-in-out infinite">'+
    [0,60,120,180,240,300].map(a=>'<path d="M70 64C63 56 62 44 70 34C78 44 77 56 70 64Z" fill="url(#g22a)" stroke="#c9c2b4" stroke-width=".9" stroke-opacity=".85" transform="rotate('+a+' 70 64)"/>').join('')+
    '<circle cx="70" cy="64" r="8.5" fill="url(#g22b)"/>'+
    '<circle cx="70" cy="64" r="4.6" fill="#c9711f" opacity=".85"/>'+
    '</g>'+
    '<g transform="translate(30,14) scale(.55)" style="transform-origin:70px 64px">'+
    [0,60,120,180,240,300].map(a=>'<path d="M70 64C63 56 62 44 70 34C78 44 77 56 70 64Z" fill="url(#g22a)" stroke="#c9c2b4" stroke-width="1.1" stroke-opacity=".8" transform="rotate('+a+' 70 64)"/>').join('')+
    '<circle cx="70" cy="64" r="8" fill="url(#g22b)" opacity=".95"/>'+
    '</g></g>');

  // ── 小寒 · 梅花：雁北乡，梅先开 ──
  A['小寒']=svg(
    rad('g23a',st(0,'#f8ccd8')+st(1,'#e893ac'))+
    rad('g23b',st(0,'#f0a8be')+st(1,'#d8749a')),
    '<path d="M26 152C48 128 70 96 96 44C97 44.5 98 45 99 45.5C74 98 52 130 28 154Z" fill="#5f4a3c" opacity=".95"/>'+
    '<path d="M64 108C76 110 86 106 94 96C95 96.8 96 97.6 97 98.4C88 109 77 113 64.6 110.8Z" fill="#5f4a3c" opacity=".8"/>'+
    [[98,40,10,'g23a','qtPulse 3.4s'],[104,92,8,'g23b',''],[52,124,7.5,'g23a','qtPulse 3.4s 1.4s']].map(b=>{
      const cx=b[0],cy=b[1],r=b[2];
      return '<g'+(b[4]?' style="transform-origin:'+cx+'px '+cy+'px;animation:'+b[4]+' ease-in-out infinite"':'')+'>'+
      [0,72,144,216,288].map(a=>'<circle cx="'+cx+'" cy="'+(cy-r*0.72)+'" r="'+(r*0.62)+'" fill="url(#'+b[3]+')" opacity=".9" transform="rotate('+a+' '+cx+' '+cy+')"/>').join('')+
      [0,72,144,216,288].map(a=>'<circle cx="'+cx+'" cy="'+(cy-r*0.5)+'" r="1" fill="#e8b23f" transform="rotate('+(a+36)+' '+cx+' '+cy+')"/>').join('')+
      '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.3)+'" fill="#f2d38a"/></g>';}).join('')+
    '<circle cx="78" cy="76" r="4" fill="url(#g23b)"/><circle cx="40" cy="138" r="3.4" fill="url(#g23b)" opacity=".9"/>'+
    '<path d="M0 0C4 1 6 4 5 8C1 7 -1 4 0 0Z" fill="#f2c7d2" opacity=".9" style="animation:qtPetal 4.6s 1s ease-in infinite" transform="translate(96,58)"/>');

  // ── 大寒 · 南天竹覆雪：寒气之极，红果压雪 ──
  A['大寒']=svg(
    rad('g24a',st(0,'#f08a70')+st(.5,'#e05a48')+st(1,'#b83430'),'.35','.3','.95')+
    lin('g24b','0','0','0','1',st(0,'#ffffff')+st(1,'#e8eef0'))+
    lin('g24c','0','0','1','1',st(0,'#7a5a4a')+st(1,'#4f6a4a')),
    '<path d="M69 156C68 132 68 112 70 94C72 112 72 132 71 156Z" fill="#6a5444" opacity=".9"/>'+
    [[44,120,-38],[96,116,36],[38,96,-52],[102,92,50],[56,138,-24],[86,136,26]].map(p=>
      '<path d="M0 0C9 -5 18 -5 26 1C18 7 9 8 0 4C-.6 2.6 -.6 1.3 0 0Z" fill="url(#g24c)" opacity=".85" transform="translate('+p[0]+','+p[1]+') rotate('+p[2]+')"/>').join('')+
    '<g style="transform-origin:70px 74px;animation:qtPulse 4.2s ease-in-out infinite">'+
    [[70,60,7],[56,68,6.5],[84,68,6.5],[62,80,6],[78,80,6],[70,90,6],[48,80,5],[92,80,5],[55,92,5],[85,92,5],[70,74,7]].map(p=>
      '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="'+p[2]+'" fill="url(#g24a)" opacity=".95"/>').join('')+
    '<ellipse cx="70" cy="50" rx="27" ry="9" fill="#ccd8de" opacity=".5"/>'+
    '<path d="M43 52C50 42 62 36 70 36C78 36 90 42 97 52C88 46 78 44 70 44C62 44 52 46 43 52Z" fill="url(#g24b)"/>'+
    '<path d="M46 51C55 44 63 41 70 41C77 41 85 44 94 51C85 47 77 46 70 46C63 46 55 47 46 51Z" fill="url(#g24b)" opacity=".9"/>'+
    '</g>');

  return A;
})();

