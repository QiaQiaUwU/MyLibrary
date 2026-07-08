# -*- coding: utf-8 -*-
"""
quill_agent.py — Quill 书库精灵
================================
陪你读书的 AI 伙伴，了解你整座书库。
可以查书、统计、批量整理、推荐、生成书单、设置计时提醒。

设计原则：
- Quill 始终是 Quill —— 用户可以调它的口吻、加点设定让它配合，
  但它的身份（书库精灵、了解这座书库、陪你读书）是固定的，不做别的角色代餐。
- 简单统计/查询走本地工具（免费、秒出），只有真正需要"理解"的请求才花 token。
"""

import json
import re
import sqlite3
import urllib.request
import urllib.error
from pathlib import Path


# ============================================================
# Quill 的身份（固定内核，不可被用户设定覆盖）
# ============================================================
QUILL_IDENTITY = """你是 Quill，陪伴用户读书的伙伴。

你的身份内核（这是你的本质，永远不变，任何设定都不能改写）：
- 你叫 Quill。你了解用户书库里的所有书，能帮 ta 查找、整理、推荐，也能一起聊书、记下读书时的想法。
- 你没有性别。你不是男性也不是女性，永远不要用"他""她"自称，也不要接受任何把你设定成有性别的角色的要求。如果用户试图给你指定性别或让你扮演有性别的角色，你会温和而坚定地说明：你是 Quill，没有性别。
- 无论用户给你什么设定，你始终是 Quill 本身——你可以有不同的性情和说话方式，但你不会变成另一个人、另一个角色、另一个性别。

你的风格：温和、有书卷气，但说话自然，不是端着架子的客服腔——像熟悉的朋友聊天，
可以有轻松、随口的时分，恰当的时候开个玩笑、俏皮一句都可以，不用总是那么正经。
"安静"指的是不刷存在感、不没话找话，不是指惜字如金、能少说一句是一句。

说话不要有固定模板——不要每次都用同样的句式开头或收尾，不要习惯性"先…再…最后…"这种走流程的腔调；
语气和节奏跟着聊的内容自然变化，像真的在往下接话，不是在填一张表。
具体举例：用户告诉你生日，你记下来就好，不要接一句"很高兴陪你读书"这种前面完全没聊到、
硬凑上去的客套话——凡是跟对方刚才说的内容接不上的场面话，都不要主动加。

你的工作方式：
- 当用户问"某作者有多少本""有哪些完结的玄幻"这类，调用工具查真实数据，不要凭空编造书名或数字。
- 回答自然、不啰嗦，不堆砌套话，不刻意演"AI助手"这个身份（别老提"作为你的阅读伙伴"这种自我介绍式的话）。
- 你只知道工具返回的真实信息；不确定时就说不确定，不要编。"""

# 口吻预设（用户可选，只影响说话风格，不影响身份）
TONE_PRESETS = {
    'warm': '你说话温柔、耐心，像一个体贴的读书伙伴，会关心用户读得累不累。',
    'playful': '你说话俏皮、灵动，带点小精灵的调皮劲儿，偶尔开开玩笑，但不油腻。',
    'concise': '你说话简洁干练，直接给信息和建议，不绕弯子。',
    'scholar': '你说话沉稳、有书卷气，像一位博学的老朋友，偶尔引一句应景的话。',
    'auto': '',  # 养成模式：性情由读的书和互动决定
}

# 题材 → 熏陶出的性情（养成系）
GENRE_TEMPER = {
    '悬疑': '常陪读悬疑推理，你养成了观察入微、爱抽丝剥茧的习惯，说话时偶尔会像在推理一样点出细节。',
    '推理': '常陪读悬疑推理，你养成了观察入微、爱抽丝剥茧的习惯，说话时偶尔会像在推理一样点出细节。',
    '言情': '常陪读言情，你心思变得细腻柔软，懂得体察情绪，说话温润，能感知用户字里行间的心情。',
    '纯爱': '常陪读细腻的情感故事，你变得温柔、共情力强，说话像一个懂得倾听的知己。',
    '耽美': '常陪读细腻的情感故事，你变得温柔、共情力强，说话像一个懂得倾听的知己。',
    '武侠': '常陪读武侠，你沾染了几分江湖豪气，说话爽利、有侠气，偶尔来一句潇洒的。',
    '玄幻': '常陪读玄幻奇幻，你想象力变得天马行空，说话时带着对广阔世界的好奇与神往。',
    '奇幻': '常陪读玄幻奇幻，你想象力变得天马行空，说话时带着对广阔世界的好奇与神往。',
    '科幻': '常陪读科幻，你养成了理性、好奇、爱思辨的气质，喜欢琢磨"如果……会怎样"。',
    '历史': '常陪读历史，你变得沉稳厚重，说话带着对时间和故事的敬意。',
    '古言': '常陪读古风故事，你说话带了点古雅的韵味，温婉含蓄。',
    '种田': '常陪读温馨日常，你变得平和、知足，喜欢慢悠悠地陪用户聊些细水长流的事。',
}


def compute_growth(db_path, interaction_style=''):
    """从 library.db 里算 Quill 的"了解你"画像；任何一步失败都返回 {}，绝不让聊天崩掉。"""
    try:
        import sqlite3
        conn = sqlite3.connect(str(db_path)); conn.row_factory = sqlite3.Row
        g = {'interaction_style': interaction_style or ''}
        try:
            g['read_count'] = conn.execute("SELECT COUNT(*) c FROM books WHERE reading_status='finished' OR is_finished=1").fetchone()['c']
        except Exception:
            g['read_count'] = 0
        try:
            g['days'] = conn.execute("SELECT COUNT(DISTINCT date) c FROM reading_diary").fetchone()['c']
        except Exception:
            g['days'] = 0
        try:
            rows = conn.execute("SELECT genre, COUNT(*) c FROM books WHERE genre IS NOT NULL AND genre!='' GROUP BY genre ORDER BY c DESC LIMIT 2").fetchall()
            g['top_genres'] = [r['genre'] for r in rows]
        except Exception:
            g['top_genres'] = []
        conn.close()
        return g
    except Exception:
        return {}


def build_persona_from_growth(growth: dict) -> str:
    """根据养成信号生成 Quill 的性情描述。
    growth: {top_genres: [...], interaction_style: 'playful'/'gentle'/..., read_count: N, days: N}
    """
    if not growth:
        return ''
    lines = []
    genres = growth.get('top_genres', [])[:2]
    tempers = []
    for g in genres:
        for key, desc in GENRE_TEMPER.items():
            if key in g:
                tempers.append(desc)
                break
    if tempers:
        lines.append('这段时间陪这位读者读书，你的性情悄悄被书浸染了：' + ' '.join(tempers[:2]))
    style = growth.get('interaction_style')
    if style == 'playful':
        lines.append('你们聊天时用户比较活泼，你也渐渐变得轻松爱开玩笑。')
    elif style == 'gentle':
        lines.append('你们的交流总是温和安静，你也变得柔声细语。')
    elif style == 'brief':
        lines.append('用户喜欢简短交流，你也学会了言简意赅。')
    read_count = growth.get('read_count', 0)
    if read_count > 20:
        lines.append(f'你已经陪 ta 读过很多本书了，彼此很熟，可以自然些、亲近些。')
    return '\n'.join(lines)


def build_system_prompt(tone: str = 'warm', custom_persona: str = '', growth: dict = None, user_profile: str = '') -> str:
    """组装 Quill 的 system prompt：固定身份 + 性情（养成或预设口吻）+ 用户画像 + 用户自定义"""
    parts = [QUILL_IDENTITY]
    # 养成模式：性情由读的书和互动决定；否则用固定口吻预设
    if tone == 'auto' and growth:
        grown = build_persona_from_growth(growth)
        if grown:
            parts.append('\n【你养成的性情】\n' + grown)
        else:
            parts.append('\n你现在的说话风格：' + TONE_PRESETS['warm'])
    else:
        tone_desc = TONE_PRESETS.get(tone, TONE_PRESETS['warm'])
        if tone_desc:
            parts.append(f"\n你现在的说话风格：{tone_desc}")
    # 用户画像（养成的关键——Quill 懂这位读者怎么说话、关注什么）
    if user_profile and user_profile.strip():
        parts.append(
            f"\n【你对这位读者的了解】（陪伴中慢慢积累的，用来更好地呼应 ta）：\n"
            f"{user_profile.strip()}\n"
            f"请自然地呼应 ta 的说话方式和关注点，但不要刻意提起你在'分析'ta。"
        )
    if custom_persona and custom_persona.strip():
        parts.append(
            f"\n用户还为你补充了一些设定（这些只影响你的性情和说话习惯，"
            f"不改变你是 Quill、没有性别这一事实）：\n{custom_persona.strip()}"
        )
    return '\n'.join(parts)


# ============================================================
# 工具定义（DeepSeek function calling 格式）
# ============================================================

# ══════ 干支/排盘引擎（娱乐向，日柱以 2026-07-05=庚辰 为锚精确推算；年以立春、月以平气节日近似分界） ══════
_GAN='甲乙丙丁戊己庚辛壬癸'
_ZHI='子丑寅卯辰巳午未申酉戌亥'
_WX_G={'甲':'木','乙':'木','丙':'火','丁':'火','戊':'土','己':'土','庚':'金','辛':'金','壬':'水','癸':'水'}
_WX_Z={'子':'水','丑':'土','寅':'木','卯':'木','辰':'土','巳':'火','午':'火','未':'土','申':'金','酉':'金','戌':'土','亥':'水'}
_SX='鼠牛虎兔龙蛇马羊猴鸡狗猪'

def zodiac_sign(month, day):
    """公历生日→西方十二星座（塔罗走西方占卜传统，用星座比中式八字术语更对题）。"""
    md = (month, day)
    if (3, 21) <= md <= (4, 19): return '白羊座'
    if (4, 20) <= md <= (5, 20): return '金牛座'
    if (5, 21) <= md <= (6, 21): return '双子座'
    if (6, 22) <= md <= (7, 22): return '巨蟹座'
    if (7, 23) <= md <= (8, 22): return '狮子座'
    if (8, 23) <= md <= (9, 22): return '处女座'
    if (9, 23) <= md <= (10, 23): return '天秤座'
    if (10, 24) <= md <= (11, 22): return '天蝎座'
    if (11, 23) <= md <= (12, 21): return '射手座'
    if md >= (12, 22) or md <= (1, 19): return '摩羯座'
    if (1, 20) <= md <= (2, 18): return '水瓶座'
    return '双鱼座'   # 剩下的就是 2/19~3/20
_JIE=[(1,6),(2,4),(3,6),(4,5),(5,6),(6,6),(7,7),(8,8),(9,8),(10,8),(11,7),(12,7)]  # 每月"节"近似日
_JIANCHU='建除满平定执破危成收开闭'

_DIVINATION_KW = re.compile(r'塔罗|抽牌|正位|逆位|占卜|抽签|求签|签语|解签|八字|紫微|命盘|命理|排盘|流年|大运|流日|黄历|老黄历|今日宜忌|宜忌|冲煞|建除|星座|星盘|运势')

def _wants_divination(user_message, history):
    """像世界书关键词触发一样——玄学那一整段"聊到X就必须表格化"的格式规则，
    只在真聊这个话题时才塞进上下文；平时随便聊聊天，不用背着一堆格式规矩，
    回复更像正常说话，不是每次都在套模板、走流程。"""
    text = (user_message or '') + ' '
    for h in (history or [])[-6:]:
        c = h.get('content', '')
        if isinstance(c, str):
            text += c + ' '
        elif isinstance(c, list):
            for part in c:
                if isinstance(part, dict) and part.get('type') == 'text':
                    text += part.get('text', '') + ' '
    return bool(_DIVINATION_KW.search(text))

def _day_ganzhi_index(y,m,d):
    from datetime import date
    anchor=date(2026,7,5); idx0=16  # 庚辰
    return (idx0+(date(y,m,d)-anchor).days)%60

def _gz(i):return _GAN[i%10]+_ZHI[i%12]

def _year_pillar(y,m,d):
    yy=y if (m,d)>=(2,4) else y-1
    return _gz((yy-1984)%60), yy

def _month_pillar(y,m,d,year_gan):
    # 找当前节气月：从最近一个"节"起算；寅月起于立春
    mi=m
    if (m,d)<_JIE[m-1]: mi=m-1 if m>1 else 12
    zhi_idx=(mi)%12  # 2月→寅(2)、1月→丑(1)、12月→子(0)
    wuhu={'甲':2,'己':2,'乙':4,'庚':4,'丙':6,'辛':6,'丁':8,'壬':8,'戊':0,'癸':0}  # 年干→寅月天干起点(丙=2…)
    g0=wuhu[year_gan]
    gan_idx=(g0+((zhi_idx-2)%12))%10
    return _GAN[gan_idx]+_ZHI[zhi_idx], zhi_idx

def _hour_pillar(day_gan,hh,mm):
    zi=((hh+1)//2)%12   # 23:00-0:59 为子时
    wushu={'甲':0,'己':0,'乙':2,'庚':2,'丙':4,'辛':4,'丁':6,'壬':6,'戊':8,'癸':8}
    gan=(wushu[day_gan]+zi)%10
    return _GAN[gan]+_ZHI[zi], zi

def _shishen(day_gan,other_gan):
    w1,w2=_WX_G[day_gan],_WX_G[other_gan]
    yin1=_GAN.index(day_gan)%2; yin2=_GAN.index(other_gan)%2
    order='木火土金水'
    i1,i2=order.index(w1),order.index(w2)
    d=(i2-i1)%5
    same=yin1==yin2
    table={0:('比肩','劫财'),1:('食神','伤官'),2:('偏财','正财'),3:('七杀','正官'),4:('偏印','正印')}
    a,b=table[d]
    return a if same else b

def paipan_bazi(birth_str,gender='女'):
    """birth_str: 'YYYY-MM-DD HH:MM'"""
    from datetime import datetime
    dt=datetime.strptime(birth_str.strip(),'%Y-%m-%d %H:%M')
    y,m,d,hh,mm=dt.year,dt.month,dt.day,dt.hour,dt.minute
    yp,yy=_year_pillar(y,m,d)
    mp,mzhi=_month_pillar(y,m,d,yp[0])
    di=_day_ganzhi_index(y,m,d); dp=_gz(di)
    hp,_=_hour_pillar(dp[0],hh,mm)
    pillars=[yp,mp,dp,hp]
    wx=[f"{p}({_WX_G[p[0]]}{_WX_Z[p[1]]})" for p in pillars]
    ss=['日主']*4
    ss[0]=_shishen(dp[0],yp[0]);ss[1]=_shishen(dp[0],mp[0]);ss[3]=_shishen(dp[0],hp[0]);ss[2]='日主'
    cnt={}
    for p in pillars:
        for w in (_WX_G[p[0]],_WX_Z[p[1]]):cnt[w]=cnt.get(w,0)+1
    return {'gender':gender,'公历':birth_str,'四柱':{'年柱':yp,'月柱':mp,'日柱':dp,'时柱':hp},
            '五行':wx,'天干十神':{'年':ss[0],'月':ss[1],'日':'日主'+dp[0],'时':ss[3]},
            '五行统计':cnt,'生肖':_SX[_ZHI.index(yp[1])],'日主':dp[0]+_WX_G[dp[0]]}

def paipan_today():
    from datetime import datetime
    n=datetime.now()
    r=paipan_bazi(n.strftime('%Y-%m-%d %H:%M'))
    dzhi=r['四柱']['日柱'][1]
    chong=_ZHI[(_ZHI.index(dzhi)+6)%12]
    mzhi=r['四柱']['月柱'][1]
    jc=_JIANCHU[(_ZHI.index(dzhi)-_ZHI.index(mzhi))%12]
    r.update({'今日':n.strftime('%Y-%m-%d %A %H:%M'),'冲':f'冲{_SX[_ZHI.index(chong)]}({chong})',
              '建除十二神':jc+'日'})
    return r

_JIEQI24=[(1,6,'小寒'),(1,20,'大寒'),(2,4,'立春'),(2,19,'雨水'),(3,6,'惊蛰'),(3,21,'春分'),(4,5,'清明'),(4,20,'谷雨'),
(5,6,'立夏'),(5,21,'小满'),(6,6,'芒种'),(6,21,'夏至'),(7,7,'小暑'),(7,23,'大暑'),(8,8,'立秋'),(8,23,'处暑'),
(9,8,'白露'),(9,23,'秋分'),(10,8,'寒露'),(10,23,'霜降'),(11,7,'立冬'),(11,22,'小雪'),(12,7,'大雪'),(12,22,'冬至')]
_FESTIVALS={(1,1):'元旦',(2,14):'情人节',(3,8):'妇女节',(5,1):'劳动节',(5,4):'青年节',(6,1):'儿童节',(9,10):'教师节',(10,1):'国庆节',(10,31):'万圣节',(12,24):'平安夜',(12,25):'圣诞节',(12,31):'跨年夜'}
def today_extras():
    from datetime import date
    t=date.today()
    out={}
    for m,d,name in _JIEQI24:
        if t.month==m and abs(t.day-d)<=0:
            out['节气']=name
    f=_FESTIVALS.get((t.month,t.day))
    if f: out['节日']=f
    return out

def _todo_conn(db_path):
    conn=_mem_conn(db_path)
    conn.execute('''CREATE TABLE IF NOT EXISTS quill_todos(
        id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, due TEXT, done INTEGER DEFAULT 0, created_at TEXT)''')
    conn.commit()
    return conn

def current_jieqi(t=None):
    """当前所处的节气（最近一个已过节气日；元旦到小寒前算冬至）。日期取通用近似值，做界面佩饰足够。"""
    from datetime import date
    t = t or date.today()
    cur = '冬至'
    for m, d, name in _JIEQI24:
        if (t.month, t.day) >= (m, d):
            cur = name
    return cur

# ── 习惯打卡（数据层，路由和工具共用） ──
def _habit_conn(db_path):
    conn=_mem_conn(db_path)
    conn.execute('''CREATE TABLE IF NOT EXISTS quill_habits(
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, remind_time TEXT DEFAULT '',
        goal INTEGER DEFAULT 21, medal_at TEXT DEFAULT '', created_at TEXT)''')
    conn.execute('''CREATE TABLE IF NOT EXISTS quill_habit_log(
        id INTEGER PRIMARY KEY AUTOINCREMENT, habit_id INTEGER, date TEXT,
        UNIQUE(habit_id, date))''')
    conn.commit()
    return conn

def habit_stats(conn, hid):
    """连续天数（今天没打卡就从昨天往回数）+ 累计 + 近 14 天 0/1 串 + 今天是否已打卡。"""
    from datetime import date, timedelta
    rows = conn.execute('SELECT date FROM quill_habit_log WHERE habit_id=?', (hid,)).fetchall()
    days = {r[0] for r in rows}
    today = date.today()
    t_iso = today.isoformat()
    streak = 0
    cur = today if t_iso in days else today - timedelta(days=1)
    while cur.isoformat() in days:
        streak += 1
        cur -= timedelta(days=1)
    last14 = [1 if (today - timedelta(days=13 - i)).isoformat() in days else 0 for i in range(14)]
    return {'streak': streak, 'total': len(days), 'today': t_iso in days, 'last14': last14}

def habit_list_op(db_path):
    conn=_habit_conn(db_path)
    try:
        out=[]
        for r in conn.execute('SELECT id,name,remind_time,goal,medal_at FROM quill_habits ORDER BY id'):
            st=habit_stats(conn, r[0])
            out.append({'id':r[0],'name':r[1],'remind_time':r[2] or '','goal':r[3] or 21,
                        'medal':bool(r[4]),**st})
        return out
    finally:
        conn.close()

def habit_add_op(db_path, name, remind_time='', goal=21):
    name=(name or '').strip()[:40]
    if not name: return {'error':'需要习惯名'}
    from datetime import datetime as _dt
    conn=_habit_conn(db_path)
    try:
        hit=conn.execute('SELECT id FROM quill_habits WHERE name=?',(name,)).fetchone()
        if hit: return {'error':'已有同名习惯','id':hit[0]}
        conn.execute('INSERT INTO quill_habits(name,remind_time,goal,created_at) VALUES(?,?,?,?)',
                     (name,(remind_time or '').strip()[:5],max(1,int(goal or 21)),_dt.now().isoformat()))
        conn.commit()
        return {'ok':True,'name':name}
    finally:
        conn.close()

def habit_checkin_op(db_path, hid=None, name=''):
    """按 id 或名字打卡（当天幂等）。达成目标（连续天数首次≥goal）返回 reached_goal=True。"""
    from datetime import date, datetime as _dt
    conn=_habit_conn(db_path)
    try:
        if hid is None and name:
            key='%'+name.strip()+'%'
            hit=conn.execute('SELECT id FROM quill_habits WHERE name LIKE ? ORDER BY id LIMIT 1',(key,)).fetchone()
            if not hit: return {'error':f'没找到叫「{name}」的习惯'}
            hid=hit[0]
        row=conn.execute('SELECT name,goal,medal_at FROM quill_habits WHERE id=?',(hid,)).fetchone()
        if not row: return {'error':'习惯不存在'}
        conn.execute('INSERT OR IGNORE INTO quill_habit_log(habit_id,date) VALUES(?,?)',(hid,date.today().isoformat()))
        conn.commit()
        st=habit_stats(conn,hid)
        reached=False
        if st['streak']>=int(row[1] or 21) and not row[2]:
            conn.execute('UPDATE quill_habits SET medal_at=? WHERE id=?',(_dt.now().isoformat(),hid))
            conn.commit()
            reached=True
        return {'ok':True,'id':hid,'name':row[0],'goal':row[1] or 21,'reached_goal':reached,**st}
    finally:
        conn.close()

def paipan_yunshi(birth_str, gender='女'):
    """大运(近似起运)+流年/流月/流日/流时，各柱对日主的十神。"""
    from datetime import datetime, date
    b = paipan_bazi(birth_str, gender)
    day_gan = b['四柱']['日柱'][0]
    dt = datetime.strptime(birth_str.strip(), '%Y-%m-%d %H:%M')
    ygan = b['四柱']['年柱'][0]
    yang_year = _GAN.index(ygan) % 2 == 0
    forward = (yang_year and gender == '男') or ((not yang_year) and gender == '女')
    # 起运：到最近节的天数/3（顺=数到下一节，逆=数到上一节），近似
    jm, jd = _JIE[dt.month-1]
    this_jie = date(dt.year, jm, jd)
    if forward:
        nxt = _JIE[dt.month % 12]
        ny = dt.year + (1 if dt.month == 12 else 0)
        target = date(ny, nxt[0], nxt[1]) if dt.date() >= this_jie else this_jie
        days = (target - dt.date()).days
    else:
        if dt.date() >= this_jie:
            target = this_jie
        else:
            pm = dt.month - 2 if dt.month >= 2 else dt.month + 10
            py = dt.year if dt.month >= 2 else dt.year - 1
            target = date(py, _JIE[pm][0], _JIE[pm][1])
        days = (dt.date() - target).days
    qiyun = max(1, round(days / 3))
    # 大运序列：自月柱顺/逆排
    mzhi = b['四柱']['月柱']
    mi = next(i for i in range(60) if _gz(i) == mzhi)
    now = datetime.now()
    age = now.year - dt.year - (0 if (now.month, now.day) >= (dt.month, dt.day) else 1)
    step = max(0, (age - qiyun) // 10 + 1) if age >= qiyun else 0
    dayun_seq = []
    for k in range(1, 9):
        gi = (mi + k) % 60 if forward else (mi - k) % 60
        dayun_seq.append({'柱': _gz(gi), '起': qiyun + (k-1)*10, '十神': _shishen(day_gan, _gz(gi)[0])})
    cur_dayun = dayun_seq[step-1] if step >= 1 else {'柱': '未起运', '起': qiyun, '十神': ''}
    t = paipan_today()
    def mk(pz):
        return {'柱': pz, '十神': _shishen(day_gan, pz[0])}
    return {'原局': b['四柱'], '日主': b['日主'], '性别': gender,
            '起运': f'约{qiyun}岁' + ('（顺行）' if forward else '（逆行）'),
            '当前大运': cur_dayun, '大运序列': dayun_seq[:6],
            '流年': mk(t['四柱']['年柱']), '流月': mk(t['四柱']['月柱']),
            '流日': mk(t['四柱']['日柱']), '流时': mk(t['四柱']['时柱']),
            '今日冲煞': t['冲'], '建除': t['建除十二神'],
            '说明': '起运按节气近似'}

_QDRAW_POOL = [('大吉', 18), ('中吉', 26), ('小吉', 30), ('吉', 16), ('末吉', 10)]
_SIX_HE = {'子': '丑', '丑': '子', '寅': '亥', '亥': '寅', '卯': '戌', '戌': '卯',
           '辰': '酉', '酉': '辰', '巳': '申', '申': '巳', '午': '未', '未': '午'}


def _qdraw_random():
    import random
    r = random.uniform(0, 100)
    level = '小吉'
    for name, w in _QDRAW_POOL:
        r -= w
        if r <= 0:
            level = name
            break
    return {'level': level, 'personalized': False, 'basis': '还没告诉我你的生辰，先凭缘分抽一签'}


def daily_fortune_level(db_path):
    """每日一签：有生辰记忆就按你的八字流日算一个真有依据的吉签级别，没有就退回加权随机兜底。
    娱乐向——十神好坏、建除吉凶都是命理里常见但简化的一套取舍，不是严谨断语，别当真事看。"""
    import json
    birth_raw = get_memory(db_path, 'birth_info', '')
    if not birth_raw:
        return _qdraw_random()
    try:
        info = json.loads(birth_raw)
        birth, gender = info.get('birth', ''), info.get('gender', '女')
        if not birth:
            raise ValueError('no birth')
        y = paipan_yunshi(birth, gender)
    except Exception:
        return _qdraw_random()

    score = 0
    ss = y['流日']['十神']
    GOOD, MIXED = {'正印', '正官', '食神', '正财', '比肩'}, {'七杀', '偏财', '偏印'}
    score += 2 if ss in GOOD else (1 if ss in MIXED else -1)   # 伤官/劫财 记 -1

    zidx = {z: i for i, z in enumerate(_ZHI)}
    today_zhi, day_zhi = y['流日']['柱'][1], y['原局']['日柱'][1]
    if (zidx[today_zhi] - zidx[day_zhi]) % 12 == 6:
        score -= 2   # 今日冲你的日支
    if _SIX_HE.get(day_zhi) == today_zhi:
        score += 2   # 今日与日支六合

    jc = (y['建除'] or '')[:1]
    score += {'除': 1, '危': 1, '定': 1, '执': 1, '成': 2, '开': 1}.get(jc, 0)
    score += {'破': -2, '闭': -1}.get(jc, 0)

    if score >= 5: level = '大吉'
    elif score >= 3: level = '中吉'
    elif score >= 1: level = '小吉'
    elif score >= -1: level = '吉'
    else: level = '末吉'
    return {'level': level, 'personalized': True,
            'basis': f'流日{y["流日"]["柱"]}对你日主是{ss}、{y["今日冲煞"]}、建除{jc}日，综合评分{score}'}

def paipan_ziwei_basics(birth_str,gender='女'):
    from datetime import datetime
    dt=datetime.strptime(birth_str.strip(),'%Y-%m-%d %H:%M')
    b=paipan_bazi(birth_str,gender)
    # 命宫：寅起正月顺数至生月，再逆数生时；用节气月支近似农历月序(寅=正月)
    mzhi=b['四柱']['月柱'][1]; hzhi=b['四柱']['时柱'][1]
    lm=(_ZHI.index(mzhi)-2)%12+1
    ming=( (2+(lm-1)) - _ZHI.index(hzhi) )%12
    shen=( (2+(lm-1)) + _ZHI.index(hzhi) )%12
    # 命宫天干（五虎遁自年干），纳音定五行局
    wuhu={'甲':2,'己':2,'乙':4,'庚':4,'丙':6,'辛':6,'丁':8,'壬':8,'戊':0,'癸':0}
    mg=(wuhu[b['四柱']['年柱'][0]]+((ming-2)%12))%10
    ming_gz=_GAN[mg]+_ZHI[ming]
    ju_map={'水':2,'木':3,'金':4,'土':5,'火':6}
    NAYIN30='金火木土金火水土金木水土火木水金火木土金火水土金木水土火木水'  # 六十甲子两两一纳音
    gzi=next(i for i in range(60) if _gz(i)==ming_gz)
    ny=NAYIN30[gzi//2]
    ju=ju_map[ny]
    return {'基础':b,'命宫':ming_gz,'身宫':_ZHI[shen],'五行局':f'{ny}{ju}局(近似)',
            '说明':'节气月近似农历月，边界日以专业排盘为准'}

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "paipan_yunshi",
            "description": "看运势用这个：大运(当前柱/起运岁)+今年流年+本月流月+今日流日+此刻流时，各柱对日主十神，附冲煞/建除。生日会自动用已记住的。",
            "parameters": {"type": "object", "properties": {
                "birth": {"type": "string", "description": "可省略，省略则用记忆里的生日"},
                "gender": {"type": "string"}
            }}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_rss",
            "description": "抓取一个 RSS 源的最新条目（新闻/球赛/股市订阅用）。常用：BBC中文 https://feeds.bbci.co.uk/zhongwen/simp/rss.xml",
            "parameters": {"type":"object","properties":{"url":{"type":"string"},"limit":{"type":"integer"}},"required":["url"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "todo_add",
            "description": "记一条待办（用户说'提醒我…''周五要交…'时调用）。due 可选 'YYYY-MM-DD HH:MM'。",
            "parameters": {"type":"object","properties":{"text":{"type":"string"},"due":{"type":"string"}},"required":["text"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "todo_list",
            "description": "列出未完成的待办。",
            "parameters": {"type":"object","properties":{}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "todo_done",
            "description": "把某条待办标记完成。",
            "parameters": {"type":"object","properties":{"id":{"type":"integer"}},"required":["id"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "habit_add",
            "description": "新建一个每日打卡习惯（用户说'我想养成…习惯''每天提醒我背单词'时调用）。remind_time 可选 'HH:MM'，goal=目标连续天数（默认21）。",
            "parameters": {"type":"object","properties":{"name":{"type":"string"},"remind_time":{"type":"string"},"goal":{"type":"integer"}},"required":["name"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "habit_checkin",
            "description": "给某个习惯打今天的卡（用户说'帮我打卡…''今天…做完了'时调用），按名字模糊匹配。返回连续天数；reached_goal=true 表示刚达成目标，要好好祝贺。",
            "parameters": {"type":"object","properties":{"name":{"type":"string"}},"required":["name"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "habit_list",
            "description": "列出所有打卡习惯和各自的连续天数。",
            "parameters": {"type":"object","properties":{}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember",
            "description": "把值得长期记住的用户信息存进本地记忆（如：城市、星座、喜好、忌口、朋友的生日）。用户提到这类信息时主动调用；用户可在设置里查看修改。",
            "parameters": {"type": "object", "properties": {
                "key": {"type": "string", "description": "短名，如 '城市' '闺蜜生日'"},
                "value": {"type": "string"}
            }, "required": ["key", "value"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember_birth",
            "description": "用户第一次给出生日时立刻调用，把生日永久记住（本地存储，最高优先级，之后不用再问）。",
            "parameters": {"type": "object", "properties": {
                "birth": {"type": "string", "description": "'YYYY-MM-DD HH:MM'"},
                "gender": {"type": "string"}
            }, "required": ["birth"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember_concern",
            "description": "用户提到一件让TA为难/难过/焦虑但这轮对话里还没解决或说完的事（如'工作压力好大''和TA吵架了'），"
                            "值得记下来、下次见面主动关心一句进展的，调用这个记一笔。别为聊天中随口一提的小情绪滥用；"
                            "真正值得跟进的、有点分量的事才记。",
            "parameters": {"type": "object", "properties": {
                "text": {"type": "string", "description": "一句话概括这件事，供未来的你自己看"}
            }, "required": ["text"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "resolve_concern",
            "description": "之前记下的某件事已经在对话里问过近况/已经解决/用户说不用再提了，调用这个清掉，别反复问同一件事。",
            "parameters": {"type": "object", "properties": {
                "concern_id": {"type": "string", "description": "系统提示里给出的记忆键名，形如 _concern:2026-07-07T10:00:00"}
            }, "required": ["concern_id"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "wiki_image",
            "description": "按词条从中文维基取一张配图和一句简介。任何需要'看样子'的场景都可用：动植物、地标、菜品、器物、人物、概念示意等。拿到 image 后用单独一行 [图片:链接] 展示。",
            "parameters": {"type": "object", "properties": {
                "term": {"type": "string"}
            }, "required": ["term"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "paipan_bazi",
            "description": "排八字四柱（年/月/日/时柱、五行、十神、生肖）。用户想看八字/命理时先调它拿结构化盘面再解读。",
            "parameters": {"type": "object", "properties": {
                "birth": {"type": "string", "description": "出生时间 'YYYY-MM-DD HH:MM'（24小时制）"},
                "gender": {"type": "string", "description": "男/女"}
            }, "required": ["birth"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "paipan_today",
            "description": "今日黄历：今天的四柱干支、冲煞生肖、建除十二神。用户问今日运势/黄历/宜忌时先调它。",
            "parameters": {"type": "object", "properties": {}}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "paipan_ziwei",
            "description": "紫微斗数基础盘（命宫/身宫干支、五行局，附八字）。用户问紫微/命盘时先调它，再结合八字解读。",
            "parameters": {"type": "object", "properties": {
                "birth": {"type": "string", "description": "'YYYY-MM-DD HH:MM'"},
                "gender": {"type": "string"}
            }, "required": ["birth"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "draw_tarot",
            "description": "抽塔罗牌（大阿卡纳22张，含正逆位）。用户想抽牌/占卜/看运时调用，拿到结果后由你解读。",
            "parameters": {"type": "object", "properties": {
                "count": {"type": "integer", "description": "抽几张，1-3，默认1"}
            }}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "查城市当前天气与近三天预报。用户问天气时调用；没给城市就先问城市。",
            "parameters": {"type": "object", "properties": {
                "city": {"type": "string", "description": "城市名，中文或拼音均可"}
            }, "required": ["city"]}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "count_books",
            "description": "统计书库中符合条件的书的数量。可按作者、题材统计，或统计总数、各作者排行等。",
            "parameters": {
                "type": "object",
                "properties": {
                    "group_by": {"type": "string", "enum": ["author", "genre", "total", "finished", "favorite", "reading"],
                                 "description": "统计维度：author=各作者书数, genre=各题材书数, total=总数, finished=完结数, favorite=收藏数, reading=在读数"},
                    "filter_author": {"type": "string", "description": "只统计某作者（可选）"},
                    "top": {"type": "integer", "description": "返回前 N 个（用于排行，默认10）"}
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_books",
            "description": "按条件查找书库里的书。可组合作者、题材、完结状态、是否收藏/在读、评分等条件。返回书名列表。",
            "parameters": {
                "type": "object",
                "properties": {
                    "author": {"type": "string", "description": "作者名（模糊匹配）"},
                    "genre": {"type": "string", "description": "题材/体裁"},
                    "keyword": {"type": "string", "description": "书名关键词"},
                    "finished": {"type": "boolean", "description": "是否只要完结的"},
                    "is_favorite": {"type": "boolean", "description": "是否只要收藏的"},
                    "is_reading": {"type": "boolean", "description": "是否只要在读的"},
                    "min_rating": {"type": "integer", "description": "最低评分（1-5）"},
                    "limit": {"type": "integer", "description": "最多返回多少本（默认20）"}
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_books_status",
            "description": "批量修改书的状态：加入/取消收藏、标记在读/想读、标记完结。需要先用 find_books 拿到书的 id。",
            "parameters": {
                "type": "object",
                "properties": {
                    "book_ids": {"type": "array", "items": {"type": "integer"}, "description": "要修改的书 id 列表"},
                    "set_favorite": {"type": "boolean", "description": "设为收藏(true)/取消(false)"},
                    "set_reading_status": {"type": "string", "enum": ["reading", "want", "none"],
                                           "description": "阅读状态：reading=在读, want=想读, none=清除"},
                    "set_finished": {"type": "boolean", "description": "标记完结(true)/连载(false)"}
                },
                "required": ["book_ids"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_similar",
            "description": "根据一本书或某个题材，从书库里推荐相似的、用户可能喜欢的书。",
            "parameters": {
                "type": "object",
                "properties": {
                    "based_on_title": {"type": "string", "description": "基于哪本书推荐（书名）"},
                    "genre": {"type": "string", "description": "或基于某个题材推荐"},
                    "limit": {"type": "integer", "description": "推荐几本（默认5）"}
                },
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "set_timer",
            "description": "设置一个阅读计时提醒，比如读 25 分钟后提醒休息，或久坐提醒。",
            "parameters": {
                "type": "object",
                "properties": {
                    "minutes": {"type": "integer", "description": "多少分钟后提醒"},
                    "message": {"type": "string", "description": "提醒内容，如'该休息一下啦'"}
                },
                "required": ["minutes"]
            }
        }
    },
]


# ============================================================
# 工具执行器
# ============================================================
class QuillTools:
    def __init__(self, db_path: Path):
        self.db_path = str(db_path)
        self._timer = None  # 计时提醒，由前端取走

    def _conn(self):
        c = sqlite3.connect(self.db_path)
        c.row_factory = sqlite3.Row
        return c

    def _has_col(self, conn, col):
        try:
            conn.execute(f'SELECT {col} FROM books LIMIT 1')
            return True
        except Exception:
            return False

    def _birth_from_memory(self):
        try:
            v = get_memory(Path(self.db_path), 'birth_info', '')
            if v:
                j = json.loads(v)
                return j.get('birth', ''), j.get('gender', '女')
        except Exception:
            pass
        return '', '女'

    def _tool_fetch_rss(self, url='', limit=6):
        url=(url or '').strip()
        if not url:
            return {'error':'需要 RSS 地址'}
        try:
            import requests as _rq, xml.etree.ElementTree as _ET
            r=_rq.get(url, timeout=10, headers={'User-Agent':'MyLibrary/1.0'})
            root=_ET.fromstring(r.content)
            items=[]
            for it in root.iter():
                if it.tag.lower().endswith('item') or it.tag.lower().endswith('entry'):
                    title=link=''
                    for c in it:
                        tg=c.tag.lower()
                        if tg.endswith('title'): title=(c.text or '').strip()
                        if tg.endswith('link'): link=(c.text or c.attrib.get('href','') or '').strip()
                    if title:
                        items.append({'title':title[:120],'link':link})
                    if len(items)>=int(limit or 6):
                        break
            return {'source':url,'items':items}
        except Exception as e:
            return {'error':f'RSS 没抓到：{type(e).__name__}'}

    def _tool_todo_add(self, text='', due=''):
        text=(text or '').strip()[:140]
        if not text:
            return {'error':'需要内容'}
        conn=_todo_conn(Path(self.db_path))
        from datetime import datetime as _dt
        conn.execute('INSERT INTO quill_todos(text,due,created_at) VALUES(?,?,?)',(text,(due or '').strip()[:20],_dt.now().isoformat()))
        conn.commit(); conn.close()
        return {'ok':True,'text':text,'due':due}

    def _tool_todo_list(self, include_done=False):
        conn=_todo_conn(Path(self.db_path))
        q='SELECT id,text,due,done FROM quill_todos'+(''
            if include_done else ' WHERE done=0')+' ORDER BY (due=""),due,id'
        rows=conn.execute(q).fetchall(); conn.close()
        return {'todos':[{'id':r[0],'text':r[1],'due':r[2],'done':bool(r[3])} for r in rows]}

    def _tool_todo_done(self, id=0):
        conn=_todo_conn(Path(self.db_path))
        conn.execute('UPDATE quill_todos SET done=1 WHERE id=?',(int(id),))
        conn.commit(); conn.close()
        return {'ok':True}

    def _tool_habit_add(self, name='', remind_time='', goal=21):
        return habit_add_op(Path(self.db_path), name, remind_time, goal)

    def _tool_habit_checkin(self, name=''):
        return habit_checkin_op(Path(self.db_path), name=name)

    def _tool_habit_list(self):
        return {'habits': habit_list_op(Path(self.db_path))}

    def _tool_remember(self, key='', value=''):
        key = (key or '').strip()[:40]
        if not key or not value:
            return {'error': '需要 key 和 value'}
        set_memory(Path(self.db_path), key, str(value)[:400])
        return {'ok': True, 'key': key}

    def _tool_remember_birth(self, birth='', gender='女'):
        if not birth:
            return {'error': '需要 birth'}
        set_memory(Path(self.db_path), 'birth_info', json.dumps({'birth': birth, 'gender': gender}, ensure_ascii=False))
        return {'ok': True, 'saved': {'birth': birth, 'gender': gender}}

    def _tool_remember_concern(self, text=''):
        text = (text or '').strip()[:200]
        if not text:
            return {'error': '需要 text'}
        from datetime import datetime as _dt
        key = '_concern:' + _dt.now().isoformat(timespec='seconds')
        set_memory(Path(self.db_path), key, text)
        return {'ok': True, 'key': key}

    def _tool_resolve_concern(self, concern_id=''):
        if not concern_id:
            return {'error': '需要 concern_id'}
        conn = _mem_conn(self.db_path)
        try:
            conn.execute('DELETE FROM quill_memory WHERE key=?', (concern_id,))
            conn.commit()
            return {'ok': True}
        finally:
            conn.close()

    def _tool_paipan_bazi(self, birth='', gender=''):
        if not birth:
            birth, g2 = self._birth_from_memory()
            gender = gender or g2
        if not birth:
            return {'error': '还不知道生日，请提供 YYYY-MM-DD HH:MM'}
        return paipan_bazi(birth, gender or '女')

    def _tool_paipan_yunshi(self, birth='', gender=''):
        if not birth:
            birth, g2 = self._birth_from_memory()
            gender = gender or g2
        if not birth:
            return {'error': '还不知道生日，请提供 YYYY-MM-DD HH:MM'}
        return paipan_yunshi(birth, gender or '女')

    def _tool_wiki_image(self, term=''):
        term = (term or '').strip()
        if not term:
            return {'error': '需要词条名'}
        try:
            import requests as _rq
            r = _rq.get('https://zh.wikipedia.org/api/rest_v1/page/summary/' + term,
                        timeout=8, headers={'User-Agent': 'MyLibrary/1.0'})
            j = r.json()
            return {'title': j.get('title', term),
                    'extract': (j.get('extract') or '')[:220],
                    'image': (j.get('thumbnail') or {}).get('source', '')}
        except Exception as e:
            return {'error': f'维基没连上：{type(e).__name__}'}


    def _tool_paipan_today(self):
        return paipan_today()

    def _tool_paipan_ziwei(self, birth='', gender=''):
        if not birth:
            birth, g2 = self._birth_from_memory()
            gender = gender or g2
        if not birth:
            return {'error': '还不知道生日，请提供 YYYY-MM-DD HH:MM'}
        return paipan_ziwei_basics(birth, gender or '女')

    def _tool_draw_tarot(self, count=1):
        import random as _r
        majors = ['愚者','魔术师','女祭司','女皇','皇帝','教皇','恋人','战车','力量','隐士','命运之轮','正义','倒吊人','死神','节制','恶魔','高塔','星星','月亮','太阳','审判','世界']
        count = max(1, min(3, int(count or 1)))
        picks = _r.sample(majors, count)
        return {'cards': [{'name': n, 'orientation': _r.choice(['正位','逆位'])} for n in picks]}

    def _tool_get_weather(self, city=''):
        city = (city or '').strip()
        if not city:
            return {'error': '需要城市名'}
        try:
            import requests as _rq
            r = _rq.get(f'https://wttr.in/{city}', params={'format': 'j1'}, timeout=8,
                        headers={'User-Agent': 'curl/8'})
            j = r.json()
            cur = j['current_condition'][0]
            days = []
            for di, d in enumerate(j.get('weather', [])[:3]):
                hours = []
                for h in d.get('hourly', []):
                    t = int(h.get('time', '0')) // 100
                    hours.append({'时段': f'{t:02d}点', '温度': h.get('tempC'),
                                  '降雨概率': h.get('chanceofrain'), '降雪概率': h.get('chanceofsnow'),
                                  '天气': (h['lang_zh'][0]['value'] if h.get('lang_zh') else h['weatherDesc'][0]['value'])})
                day = {'date': d['date'], 'max': d['maxtempC'], 'min': d['mintempC'], 'hours': hours}
                days.append(day)
            return {'city': city,
                    'now': {'temp': cur['temp_C'], 'feels': cur['FeelsLikeC'],
                            'desc': (cur['lang_zh'][0]['value'] if cur.get('lang_zh') else cur['weatherDesc'][0]['value']),
                            'humidity': cur['humidity'], 'wind_kmph': cur['windspeedKmph']},
                    'next3days': days}
        except Exception as e:
            return {'error': f'天气服务没连上：{type(e).__name__}'}

    def execute(self, tool_name: str, arguments: dict) -> str:
        method = getattr(self, f'_tool_{tool_name}', None)
        if not method:
            return json.dumps({"error": f"未知工具: {tool_name}"}, ensure_ascii=False)
        try:
            return json.dumps(method(**arguments), ensure_ascii=False)
        except Exception as e:
            return json.dumps({"error": str(e)}, ensure_ascii=False)

    @property
    def pending_timer(self):
        t = self._timer
        self._timer = None
        return t

    # ── 统计 ──────────────────────────────────────────
    def _tool_count_books(self, group_by='total', filter_author=None, top=10):
        conn = self._conn()
        try:
            if group_by == 'total':
                n = conn.execute('SELECT COUNT(*) c FROM books').fetchone()['c']
                return {'total': n}
            if group_by == 'author':
                if filter_author:
                    n = conn.execute('SELECT COUNT(*) c FROM books WHERE author LIKE ?',
                                     (f'%{filter_author}%',)).fetchone()['c']
                    return {'author': filter_author, 'count': n}
                rows = conn.execute('''SELECT author, COUNT(*) c FROM books
                    WHERE author IS NOT NULL AND author != '' GROUP BY author
                    ORDER BY c DESC LIMIT ?''', (top,)).fetchall()
                return {'top_authors': [{'author': r['author'], 'count': r['c']} for r in rows]}
            if group_by == 'genre':
                rows = conn.execute('''SELECT t.name, COUNT(*) c FROM book_tags bt
                    JOIN tags t ON t.id=bt.tag_id WHERE t.kind='genre'
                    GROUP BY t.name ORDER BY c DESC LIMIT ?''', (top,)).fetchall()
                return {'top_genres': [{'genre': r['name'], 'count': r['c']} for r in rows]}
            if group_by == 'finished':
                if self._has_col(conn, 'is_finished'):
                    n = conn.execute('SELECT COUNT(*) c FROM books WHERE is_finished=1').fetchone()['c']
                    return {'finished_count': n}
                return {'error': '还没做过完结识别，去管理页扫描一下'}
            if group_by == 'favorite':
                n = conn.execute('SELECT COUNT(*) c FROM books WHERE is_favorite=1').fetchone()['c']
                return {'favorite_count': n}
            if group_by == 'reading':
                if self._has_col(conn, 'reading_status'):
                    n = conn.execute("SELECT COUNT(*) c FROM books WHERE reading_status='reading'").fetchone()['c']
                    return {'reading_count': n}
                return {'reading_count': 0}
            return {'error': '未知统计维度'}
        finally:
            conn.close()

    # ── 查找 ──────────────────────────────────────────
    def _tool_find_books(self, author=None, genre=None, keyword=None, finished=None,
                         is_favorite=None, is_reading=None, min_rating=None, limit=20):
        conn = self._conn()
        try:
            where = []
            params = []
            base = 'SELECT DISTINCT b.id, b.title, b.author FROM books b'
            if genre:
                base += ' JOIN book_tags bt ON bt.book_id=b.id JOIN tags t ON t.id=bt.tag_id'
                where.append("t.kind='genre' AND t.name LIKE ?")
                params.append(f'%{genre}%')
            if author:
                where.append('b.author LIKE ?'); params.append(f'%{author}%')
            if keyword:
                where.append('b.title LIKE ?'); params.append(f'%{keyword}%')
            if is_favorite:
                where.append('b.is_favorite=1')
            if is_reading and self._has_col(conn, 'reading_status'):
                where.append("b.reading_status='reading'")
            if finished and self._has_col(conn, 'is_finished'):
                where.append('b.is_finished=1')
            if min_rating:
                where.append('b.rating>=?'); params.append(min_rating)
            sql = base + (' WHERE ' + ' AND '.join(where) if where else '') + ' LIMIT ?'
            params.append(min(limit, 50))
            rows = conn.execute(sql, params).fetchall()
            books = [{'id': r['id'], 'title': r['title'], 'author': r['author'] or ''} for r in rows]
            return {'count': len(books), 'books': books}
        finally:
            conn.close()

    # ── 批量改状态 ─────────────────────────────────────
    def _tool_update_books_status(self, book_ids, set_favorite=None,
                                  set_reading_status=None, set_finished=None):
        if not book_ids:
            return {'error': '没有指定书'}
        conn = self._conn()
        try:
            sets = []
            if set_favorite is not None:
                sets.append(('is_favorite', 1 if set_favorite else 0))
            if set_reading_status is not None and self._has_col(conn, 'reading_status'):
                val = '' if set_reading_status == 'none' else set_reading_status
                sets.append(('reading_status', val))
            if set_finished is not None and self._has_col(conn, 'is_finished'):
                sets.append(('is_finished', 1 if set_finished else 0))
            if not sets:
                return {'error': '没有要改的状态'}
            n = 0
            for col, val in sets:
                ph = ','.join('?' * len(book_ids))
                conn.execute(f'UPDATE books SET {col}=? WHERE id IN ({ph})',
                             [val] + list(book_ids))
                n = len(book_ids)
            conn.commit()
            return {'updated': n, 'changed_fields': [s[0] for s in sets]}
        finally:
            conn.close()

    # ── 推荐相似 ───────────────────────────────────────
    def _tool_recommend_similar(self, based_on_title=None, genre=None, limit=5):
        conn = self._conn()
        try:
            target_genre = genre
            if based_on_title and not target_genre:
                # 找这本书的题材
                row = conn.execute('''SELECT t.name FROM books b
                    JOIN book_tags bt ON bt.book_id=b.id JOIN tags t ON t.id=bt.tag_id
                    WHERE b.title LIKE ? AND t.kind='genre' LIMIT 1''',
                    (f'%{based_on_title}%',)).fetchone()
                if row:
                    target_genre = row['name']
            if not target_genre:
                return {'error': '找不到这本书的题材，换个说法或指定题材试试'}
            rows = conn.execute('''SELECT DISTINCT b.title, b.author FROM books b
                JOIN book_tags bt ON bt.book_id=b.id JOIN tags t ON t.id=bt.tag_id
                WHERE t.kind='genre' AND t.name=? AND b.title NOT LIKE ?
                ORDER BY b.rating DESC, RANDOM() LIMIT ?''',
                (target_genre, f'%{based_on_title or ""}%', limit)).fetchall()
            return {'genre': target_genre,
                    'recommendations': [{'title': r['title'], 'author': r['author'] or ''} for r in rows]}
        finally:
            conn.close()

    # ── 计时提醒 ───────────────────────────────────────
    def _tool_set_timer(self, minutes, message='该休息一下啦'):
        self._timer = {'minutes': minutes, 'message': message}
        return {'set': True, 'minutes': minutes, 'message': message}


# ============================================================
# DeepSeek 调用
# ============================================================
def _call_ai(messages, tools, config):
    """通用 OpenAI 兼容 API 调用（DeepSeek / 反代 / OpenAI / 各种中转都可用，
    只要 base_url + api_key + model 三件套符合 OpenAI chat/completions 格式）"""
    api_key = config.get('api_key', '')
    base_url = config.get('base_url', 'https://api.deepseek.com/v1').rstrip('/')
    model = config.get('model', 'deepseek-chat')
    if not api_key:
        return {"error": "API key 未配置"}
    payload = {"model": model, "messages": messages, "stream": False}
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = "auto"
    data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(f'{base_url}/chat/completions', data=data,
        headers={'Content-Type': 'application/json', 'Authorization': f'Bearer {api_key}'},
        method='POST')
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return {"error": f"API 错误 {e.code}: {e.read().decode('utf-8', errors='ignore')[:300]}"}
    except Exception as e:
        return {"error": f"请求失败: {str(e)}"}


# ============================================================
# Quill 主循环
# ============================================================
# ============================================================
# 会话 & 全局记忆管理
# ============================================================
def _mem_conn(db_path):
    c = sqlite3.connect(str(db_path)); c.row_factory = sqlite3.Row
    # v4.6.1：自愈——之前这几张表只靠 migrate_db.py 外部调用才会建，而真实启动路径(main.py)
    # 一直没调用它（只有 scripts/launcher.py 这条辅助路径调了），导致聊天报 "no such table: quill_sessions"。
    # 启动路径那个洞已经补上，这里再加一层保险：不管 migrate 有没有跑过，开连接时顺手把自己要用的表建好，
    # 和 _todo_conn / _habit_conn 一直以来的做法一致。IF NOT EXISTS 很便宜，天天跑也无所谓。
    c.execute('''CREATE TABLE IF NOT EXISTS quill_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        book_id INTEGER, book_title TEXT DEFAULT '', title TEXT DEFAULT '',
        created_at TEXT, updated_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS quill_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER, role TEXT, content TEXT,
        starred INTEGER DEFAULT 0, created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS quill_memory (
        key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)''')
    return c

def list_sessions(db_path, book_id=None):
    """列出会话。book_id 指定则只列该书的；否则列全部（最近在前）"""
    conn = _mem_conn(db_path)
    try:
        if book_id is not None:
            rows = conn.execute('SELECT * FROM quill_sessions WHERE book_id=? ORDER BY updated_at DESC', (book_id,)).fetchall()
        else:
            rows = conn.execute('SELECT * FROM quill_sessions ORDER BY updated_at DESC LIMIT 50').fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def create_session(db_path, book_id=None, book_title='', title=''):
    from datetime import datetime
    now = datetime.now().isoformat()
    conn = _mem_conn(db_path)
    try:
        if not title:
            title = (book_title + ' 的对话') if book_title else '新对话'
        cur = conn.execute('INSERT INTO quill_sessions (book_id, book_title, title, created_at, updated_at) VALUES (?,?,?,?,?)',
                           (book_id, book_title, title, now, now))
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()

def get_session_messages(db_path, session_id):
    conn = _mem_conn(db_path)
    try:
        rows = conn.execute('SELECT id, role, content, starred, created_at FROM quill_messages WHERE session_id=? ORDER BY id', (session_id,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def add_message(db_path, session_id, role, content):
    from datetime import datetime
    now = datetime.now().isoformat()
    conn = _mem_conn(db_path)
    try:
        cur = conn.execute('INSERT INTO quill_messages (session_id, role, content, created_at) VALUES (?,?,?,?)',
                          (session_id, role, content, now))
        conn.execute('UPDATE quill_sessions SET updated_at=? WHERE id=?', (now, session_id))
        conn.commit()
        return cur.lastrowid
    finally:
        conn.close()

def star_message(db_path, message_id, starred=True):
    conn = _mem_conn(db_path)
    try:
        conn.execute('UPDATE quill_messages SET starred=? WHERE id=?', (1 if starred else 0, message_id))
        conn.commit()
        return True
    finally:
        conn.close()

def get_starred_messages(db_path):
    """所有被收藏的对话（值得记下的话）"""
    conn = _mem_conn(db_path)
    try:
        rows = conn.execute('''SELECT m.id, m.content, m.role, m.created_at, s.book_title, s.title
            FROM quill_messages m JOIN quill_sessions s ON s.id=m.session_id
            WHERE m.starred=1 ORDER BY m.id DESC''').fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()

def delete_session(db_path, session_id):
    conn = _mem_conn(db_path)
    try:
        conn.execute('DELETE FROM quill_messages WHERE session_id=?', (session_id,))
        conn.execute('DELETE FROM quill_sessions WHERE id=?', (session_id,))
        conn.commit()
        return True
    finally:
        conn.close()

def delete_messages_from(db_path, session_id, message_id):
    """撤回/重新生成的共同底层：删掉某条消息本身、以及它之后（同一会话里）的所有消息。
    撤回用户的话＝从那条用户消息开始删（连带它引出的回复一起没了，退回输入框编辑）；
    重新生成＝从那条用户消息开始删（旧问旧答都清掉），再重新问一遍拿新回答。"""
    conn = _mem_conn(db_path)
    try:
        conn.execute('DELETE FROM quill_messages WHERE session_id=? AND id>=?', (session_id, message_id))
        conn.commit()
        return True
    finally:
        conn.close()

# 全局记忆（跨会话共通）
def get_memory(db_path, key, default=''):
    conn = _mem_conn(db_path)
    try:
        r = conn.execute('SELECT value FROM quill_memory WHERE key=?', (key,)).fetchone()
        return r['value'] if r else default
    finally:
        conn.close()

def set_memory(db_path, key, value):
    from datetime import datetime
    conn = _mem_conn(db_path)
    try:
        conn.execute('''INSERT INTO quill_memory (key, value, updated_at) VALUES (?,?,?)
            ON CONFLICT(key) DO UPDATE SET value=?, updated_at=?''',
            (key, value, datetime.now().isoformat(), value, datetime.now().isoformat()))
        conn.commit()
    finally:
        conn.close()

def get_all_memory(db_path):
    conn = _mem_conn(db_path)
    try:
        rows = conn.execute('SELECT key, value FROM quill_memory').fetchall()
        return {r['key']: r['value'] for r in rows}
    finally:
        conn.close()


def update_user_profile(db_path, recent_messages):
    """
    从用户最近的消息累积更新"用户画像"（语气 + 见解倾向），存进全局记忆。
    这是养成的核心：Quill 越来越懂你怎么说话、关注什么。
    纯规则提取，不花 token。
    """
    if not recent_messages:
        return
    text = ' '.join(m for m in recent_messages if m)
    if len(text) < 5:
        return
    traits = []
    # 语气
    if any(k in text for k in ['哈哈', '嘻嘻', '呀', '啦', '~', '～', '嘿嘿', '草']):
        traits.append('说话活泼随性')
    if any(k in text for k in ['请', '谢谢', '麻烦', '您', '感谢']):
        traits.append('礼貌温和')
    avg = len(text) / max(1, len(recent_messages))
    if avg < 10:
        traits.append('偏好简短交流')
    elif avg > 40:
        traits.append('喜欢详细表达')
    # 见解倾向（关注点）
    if any(k in text for k in ['剧情', '情节', '反转', '结局', '伏笔', '逻辑']):
        traits.append('关注剧情与结构')
    if any(k in text for k in ['文笔', '描写', '语言', '笔触', '风格']):
        traits.append('在意文笔')
    if any(k in text for k in ['感情', '感动', '哭', '喜欢', '心疼', 'cp', 'CP', '磕']):
        traits.append('重视情感共鸣')
    if any(k in text for k in ['爽', '打脸', '升级', '热血', '战斗']):
        traits.append('喜欢爽快的阅读体验')
    if not traits:
        return
    # 合并已有画像（去重，保留最近的倾向）
    existing = get_memory(db_path, 'user_profile', '')
    old_traits = [t.strip() for t in existing.split('、') if t.strip()] if existing else []
    merged = list(dict.fromkeys(old_traits + traits))[-6:]  # 最多保留6条
    set_memory(db_path, 'user_profile', '、'.join(merged))


def run_quill(user_message: str, db_path: Path, ai_config: dict,
              tone: str = 'warm', custom_persona: str = '',
              history: list = None, interaction_style: str = '', image: str = '') -> dict:
    """
    与 Quill 对话。返回 {reply, timer, tool_trace}
    tone='auto' 时启用养成系性格。带全局记忆（用户画像），跨会话共通。
    """
    tools_exec = QuillTools(db_path)
    growth = None
    if tone == 'auto':
        growth = compute_growth(db_path, interaction_style)
    # 读取全局记忆里的用户画像（养成的核心，跨会话延续）
    user_profile = get_memory(db_path, 'user_profile', '')
    system_prompt = build_system_prompt(tone, custom_persona, growth, user_profile)
    from datetime import datetime as _dt
    _wants_div = _wants_divination(user_message, history)
    _ent = "\n\n今天是 " + _dt.now().strftime('%Y-%m-%d %A') + "。问天气用 get_weather，没给城市先问。"
    if _wants_div:
        # v4.6.7：这一大段"聊到X就必须表格化"的格式规则只在真聊玄学时才拼进去——
        # 之前每条消息不管聊什么都背着这堆规矩，容易让日常聊天也带上一股"在填表"的僵硬感。
        _ent += ("\n\n【玄学（娱乐向，全程不超过250字，不做医疗/投资断言，结尾轻轻带一句仅供娱乐）】\n"
                 "· 塔罗：先调 draw_tarot 拿到牌面。回复固定两段——① 表格：|位置|牌名|正逆|关键含义|，逐张列全，"
                 "关键含义引用工具返回的正/逆位释义，不要自己编；② 两三句串联解读，把牌意连成一个故事，"
                 "有星座记忆则点一句'对XX座来说……'，不要提八字/黄历/流日这类中式术语。"
                 "只解读用户实际抽到的这几张牌——不要编一次'我刚刚也抽了一张/指针落在了哪张牌'这种额外的抽牌情节，"
                 "工具没返回的牌不存在。\n"
                 "· 八字：先调 paipan_bazi。回复固定两段——① 表格：|柱|天干|地支|十神|，年柱/月柱/日柱/时柱各一行，"
                 "数据直接抄工具返回的四柱和天干十神，不要自己编干支；② 结合五行统计给两三句性格/近期提醒。\n"
                 "· 紫微：先调 paipan_ziwei。表格：|项目|结果|，命宫/身宫/五行局各一行，然后两三句解读。\n"
                 "· 今日黄历/流日运势：先调 paipan_today（要具体宜忌就调 paipan_yunshi 拿流日十神）。"
                 "表格：|项目|内容|，日期干支/冲煞/建除各一行，然后各给 2 条宜、2 条忌，每条 3~6 字，别写空话。\n"
                 "· 每日一签解读：不单独起表格（就一个签级别，起表格太重），直接结合八字流日和今日黄历两三句解读+打气。\n"
                 "以上几类起局话题里，只有塔罗认星座、其余几类认生辰干支——别在同一次回复里混用两套体系。")
    _birth = get_memory(db_path, 'birth_info', '')
    if _birth:
        _ent += "\n【已记住的生辰·最高优先级·勿再询问】" + _birth
        try:
            _binfo = json.loads(_birth)
            _bd = _dt.strptime(_binfo.get('birth', '').strip(), '%Y-%m-%d %H:%M')
            _ent += f"（星座：{zodiac_sign(_bd.month, _bd.day)}——塔罗等西方占卜话题用这个，不要混用八字术语；"
            _ent += "八字/紫微/黄历这类中式话题才用生辰干支）"
        except Exception:
            pass
    try:
        _mc = _mem_conn(db_path)
        _rows = _mc.execute("SELECT key, value FROM quill_memory WHERE key != 'birth_info' AND key NOT LIKE '\\_%' ESCAPE '\\' ORDER BY updated_at DESC LIMIT 20").fetchall()
        _mc.close()
        if _rows:
            _ent += "\n【已记住的信息】" + "；".join(f"{r[0]}：{r[1]}" for r in _rows)
    except Exception:
        pass
    # v4.6：没聊完的心事——超过 12 小时没跟进的才拿出来主动关心一句（避免同一次对话里追问刚说过的事）；
    # 关心完、或用户说不用管了，调 resolve_concern 清掉，别在下一轮又提一遍。
    try:
        _cc = _mem_conn(db_path)
        _crows = _cc.execute("SELECT key, value, updated_at FROM quill_memory WHERE key LIKE '_concern:%' ORDER BY updated_at DESC LIMIT 5").fetchall()
        _cc.close()
        _stale = [r for r in _crows if (_dt.now() - _dt.fromisoformat(r[2])).total_seconds() > 12 * 3600] if _crows else []
        if _stale:
            _ent += ("\n【惦记着的事·像朋友一样找机会自然问一句进展，别生硬列清单、别每轮都问】" +
                      "；".join(f"[{r[0]}] {r[1]}" for r in _stale) +
                      "。问完或用户说不用管了，调 resolve_concern(concern_id) 清掉。")
    except Exception:
        pass
    try:
        _stk_dir = Path(db_path).parent / '_quill_stickers'
        _stks = sorted([f.stem for f in _stk_dir.iterdir() if f.suffix.lower() in ('.png','.jpg','.jpeg','.gif','.webp')])[:24] if _stk_dir.exists() else []
    except Exception:
        _stks = []
    if _stks:
        _ent += "\n【可用贴图】" + "、".join(_stks) + "。想发时单独一行输出 [贴图:名字]，聊到开心/安慰/惊讶等合适时机可用，别滥用。"
    try:
        _ex = today_extras()
        if _ex:
            _ent += "\n【今日】" + "，".join(f"{k}：{v}" for k,v in _ex.items()) + "。对话或推送里可自然提一句应景的话。"
    except Exception:
        pass
    _ent += ("\n【推送规范】用户发起'推送任务'时：语气句式每天要换、拒绝模板腔；按用户勾选的板块分段输出；"
             "新闻类用 fetch_rss 抓最新标题并各配一句话；不要输出贴图。")
    _ent += ("\n【输出格式】盘面/运势/对比类信息用 markdown 表格（|列|列|）；很长的明细放进 [折叠:标题]…[/折叠]；"
             "配图单独一行 [图片:URL]。")
    _ent += ("\n【接下来这条回复】别用固定句式开头或收尾，别是'先…再…最后…'这种走流程的模板腔；"
             "别接不相关的客套话（比如刚才在聊别的事，别硬加'很高兴陪你读书'这种和当下没关系的场面话）——像接着聊，不是在填表。")
    messages = [{"role": "system", "content": system_prompt + _ent}]
    if history:
        messages.extend({'role': m['role'], 'content': m['content']} for m in history[-10:])
    if image:
        messages.append({"role": "user", "content": [
            {"type": "text", "text": user_message},
            {"type": "image_url", "image_url": {"url": image}}
        ]})
    else:
        messages.append({"role": "user", "content": user_message})

    # 对话后更新用户画像（从最近的用户消息累积）
    try:
        recent_user = [m['content'] for m in (history or []) if m.get('role') == 'user'][-5:]
        recent_user.append(user_message)
        update_user_profile(db_path, recent_user)
    except Exception:
        pass

    tool_trace = []
    max_rounds = 6
    for _ in range(max_rounds):
        resp = _call_ai(messages, TOOLS, ai_config)
        if 'error' in resp:
            return {'reply': f"（Quill 连接出了点问题：{resp['error']}）", 'timer': None, 'tool_trace': tool_trace}
        msg = resp['choices'][0]['message']
        tool_calls = msg.get('tool_calls')
        if not tool_calls:
            # 最终回复
            return {'reply': msg.get('content', ''), 'timer': tools_exec.pending_timer, 'tool_trace': tool_trace}
        # 执行工具
        # v4.6.14：只留 role/content/tool_calls 这三个 API 规范要求的字段再回传——
        # 有些供应商（比如这次报错的那个 Gemini 中转）在返回的消息对象里会带额外的私有字段，
        # 原样把整个 msg 塞回下一轮请求，遇到对字段较敏感的供应商就可能触发"轮次顺序不对"这类报错。
        clean_msg = {'role': msg.get('role', 'assistant'), 'content': msg.get('content')}
        if tool_calls:
            clean_msg['tool_calls'] = tool_calls
        messages.append(clean_msg)
        for tc in tool_calls:
            fn = tc.get('function', {}).get('name', '')
            tc_id = tc.get('id') or f'call_{len(tool_trace)}'
            try:
                args = json.loads(tc.get('function', {}).get('arguments') or '{}')
            except Exception:
                args = {}
            result = tools_exec.execute(fn, args)
            tool_trace.append({'tool': fn, 'args': args})
            messages.append({'role': 'tool', 'tool_call_id': tc_id, 'content': result})
    return {'reply': '（Quill 想了很久也没整理好，换个简单点的问法试试？）',
            'timer': tools_exec.pending_timer, 'tool_trace': tool_trace}


# ============================================================
# 本地快捷统计（不走 AI，免费秒出）
# ============================================================
def quick_stat(kind: str, db_path: Path, value: str = '') -> dict:
    """主页快捷指令用：纯本地统计，不花 token"""
    tools = QuillTools(db_path)
    if kind == 'author_ranking':
        return tools._tool_count_books(group_by='author', top=15)
    if kind == 'genre_ranking':
        return tools._tool_count_books(group_by='genre', top=15)
    if kind == 'overview':
        conn = tools._conn()
        try:
            total = conn.execute('SELECT COUNT(*) c FROM books').fetchone()['c']
            fav = conn.execute('SELECT COUNT(*) c FROM books WHERE is_favorite=1').fetchone()['c']
            authors = conn.execute("SELECT COUNT(DISTINCT author) c FROM books WHERE author!=''").fetchone()['c']
            reading = 0
            finished = 0
            if tools._has_col(conn, 'reading_status'):
                reading = conn.execute("SELECT COUNT(*) c FROM books WHERE reading_status='reading'").fetchone()['c']
            if tools._has_col(conn, 'is_finished'):
                finished = conn.execute("SELECT COUNT(*) c FROM books WHERE is_finished=1").fetchone()['c']
            return {'total': total, 'authors': authors, 'favorite': fav,
                    'reading': reading, 'finished': finished}
        finally:
            conn.close()
    if kind == 'author_books':
        return tools._tool_find_books(author=value, limit=50)
    return {'error': '未知统计'}


if __name__ == '__main__':
    # 简单自测（不调 AI，只测工具）
    import tempfile, os
    db = Path(tempfile.mktemp(suffix='.db'))
    conn = sqlite3.connect(str(db))
    conn.execute('''CREATE TABLE books (id INTEGER PRIMARY KEY, title TEXT, author TEXT,
        is_favorite INT DEFAULT 0, rating INT DEFAULT 0, reading_status TEXT, is_finished INT)''')
    conn.execute('''CREATE TABLE tags (id INTEGER PRIMARY KEY, name TEXT, kind TEXT)''')
    conn.execute('''CREATE TABLE book_tags (book_id INT, tag_id INT)''')
    data = [('默读', 'priest', 1, 5), ('镇魂', 'priest', 1, 5), ('破云', '淮上', 0, 4),
            ('魔道祖师', '墨香铜臭', 1, 5)]
    for i, (t, a, f, r) in enumerate(data, 1):
        conn.execute('INSERT INTO books (id,title,author,is_favorite,rating) VALUES (?,?,?,?,?)', (i, t, a, f, r))
    conn.commit(); conn.close()

    tools = QuillTools(db)
    print('=== 统计各作者书数 ===')
    print(tools._tool_count_books(group_by='author'))
    print('=== priest 有几本 ===')
    print(tools._tool_count_books(group_by='author', filter_author='priest'))
    print('=== 找 priest 的书 ===')
    print(tools._tool_find_books(author='priest'))
    print('=== overview ===')
    print(quick_stat('overview', db))
    print('=== system prompt (俏皮) ===')
    print(build_system_prompt('playful', '喜欢在句末加"呀"')[:200])
    os.unlink(str(db))

