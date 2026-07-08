#!/usr/bin/env python3
# -*- coding: utf-8 -*-
r"""
booklist_export.py — 阅读笔记导出精致书单
=============================================
把选中的书（或某标签/收藏的书）导出成评分书单。
三种格式：
  - text:     纯文本（贴备忘录/微博），书名+星级+笔记
  - markdown: Markdown（带表格）
  - svg:      精致书单卡片图（可分享）
可选 AI 辅助：归类 + 写一句话推荐语。
"""

import html


def stars(rating: int) -> str:
    """评分转星星"""
    r = max(0, min(5, int(rating or 0)))
    return '★' * r + '☆' * (5 - r)


def build_text(title: str, books: list) -> str:
    """纯文本书单（像备忘录那种）"""
    lines = [title, '']
    for i, b in enumerate(books, 1):
        line = f'{i}. {b["title"]}'
        if b.get('rating'):
            line += ' ' + stars(b['rating'])
        if b.get('author'):
            line += f'  by {b["author"]}'
        if b.get('note'):
            line += f'  — {b["note"]}'
        lines.append(line)
    return '\n'.join(lines)


def build_markdown(title: str, books: list) -> str:
    """Markdown 书单（表格）"""
    lines = [f'# {title}', '', '| # | 书名 | 作者 | 评分 | 一句话 |', '|---|------|------|------|--------|']
    for i, b in enumerate(books, 1):
        note = (b.get('note') or '').replace('|', '/')
        lines.append(f'| {i} | {b["title"]} | {b.get("author","")} | {stars(b.get("rating",0))} | {note} |')
    return '\n'.join(lines)


def build_svg(title: str, books: list, theme: str = 'paper') -> str:
    """
    精致书单卡片图（SVG）。纸感书房风格。
    theme: paper(米白) / dark(深色) / kraft(牛皮纸)
    """
    themes = {
        'paper': {'bg': '#f3eee3', 'card': '#fbf8f1', 'ink': '#2b2620', 'soft': '#8a8175',
                  'accent': '#9a5b42', 'gold': '#c8a04e', 'line': '#e0d8cb'},
        'dark':  {'bg': '#1a1a1a', 'card': '#242420', 'ink': '#e8e0d4', 'soft': '#888070',
                  'accent': '#c08858', 'gold': '#d4a85e', 'line': '#3a3632'},
        'kraft': {'bg': '#d4c4a8', 'card': '#e4d8c0', 'ink': '#3a2e1e', 'soft': '#6a5a42',
                  'accent': '#8a5a2a', 'gold': '#a8763a', 'line': '#c4b498'},
        'sage':  {'bg': '#e4ebdf', 'card': '#f1f5ec', 'ink': '#33402c', 'soft': '#74846a',
                  'accent': '#5f7a52', 'gold': '#8a9a5e', 'line': '#d3ddca'},
        'mist':  {'bg': '#dfe7ec', 'card': '#eef3f6', 'ink': '#2c3742', 'soft': '#6a7884',
                  'accent': '#5a7a8c', 'gold': '#7a98a8', 'line': '#cdd9e0'},
        'cream': {'bg': '#f5efe4', 'card': '#fdf9f0', 'ink': '#4a3f30', 'soft': '#9a8d76',
                  'accent': '#b07050', 'gold': '#c8a878', 'line': '#e8ddcd'},
    }
    t = themes.get(theme, themes['paper'])

    row_h = 52
    header_h = 110
    pad = 36
    width = 600
    height = header_h + len(books) * row_h + pad + 50

    def esc(s):
        return html.escape(str(s or ''))

    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="Songti SC, Noto Serif SC, serif">')
    # 背景
    parts.append(f'<rect width="{width}" height="{height}" fill="{t["bg"]}"/>')
    # 卡片
    parts.append(f'<rect x="20" y="20" width="{width-40}" height="{height-40}" rx="16" fill="{t["card"]}" stroke="{t["line"]}"/>')
    # 标题
    parts.append(f'<text x="{pad+8}" y="62" font-size="26" font-weight="700" fill="{t["ink"]}">{esc(title)}</text>')
    # 副标 + 数量
    parts.append(f'<text x="{pad+8}" y="88" font-size="13" fill="{t["soft"]}" font-family="PingFang SC, sans-serif" letter-spacing="2">BOOKLIST · {len(books)} 本</text>')
    # 分隔线
    parts.append(f'<line x1="{pad}" y1="{header_h-8}" x2="{width-pad}" y2="{header_h-8}" stroke="{t["line"]}"/>')

    # 书目
    y = header_h + 20
    for i, b in enumerate(books, 1):
        # 序号
        parts.append(f'<text x="{pad+4}" y="{y+6}" font-size="15" fill="{t["soft"]}" font-family="PingFang SC, sans-serif">{i:02d}</text>')
        # 书名
        bx = pad + 42
        title_txt = esc(b['title'])
        if len(title_txt) > 16:
            title_txt = title_txt[:16] + '…'
        parts.append(f'<text x="{bx}" y="{y+6}" font-size="17" font-weight="600" fill="{t["ink"]}">{title_txt}</text>')
        # 星级
        if b.get('rating'):
            star_txt = stars(b['rating'])
            parts.append(f'<text x="{width-pad-4}" y="{y+6}" font-size="15" fill="{t["gold"]}" text-anchor="end" font-family="Arial">{star_txt}</text>')
        # 作者 / 一句话（第二行小字）
        sub = []
        if b.get('author'):
            sub.append(b['author'])
        if b.get('note'):
            sub.append(b['note'])
        if sub:
            sub_txt = esc(' · '.join(sub))
            if len(sub_txt) > 40:
                sub_txt = sub_txt[:40] + '…'
            parts.append(f'<text x="{bx}" y="{y+24}" font-size="12" fill="{t["soft"]}" font-family="PingFang SC, sans-serif">{sub_txt}</text>')
        # 行分隔
        if i < len(books):
            parts.append(f'<line x1="{pad}" y1="{y+34}" x2="{width-pad}" y2="{y+34}" stroke="{t["line"]}" stroke-opacity="0.5"/>')
        y += row_h

    # 落款
    parts.append(f'<text x="{width-pad}" y="{height-32}" font-size="11" fill="{t["soft"]}" text-anchor="end" font-family="PingFang SC, sans-serif" letter-spacing="1">— 我的书房 · MyLibrary</text>')
    parts.append('</svg>')
    return '\n'.join(parts)


def build_journey_card(stats: dict, theme: str = 'sage') -> str:
    """阅读历程精致卡片（SVG）。展示阅读统计，可分享。"""
    themes = {
        'paper': {'bg': '#f3eee3', 'card': '#fbf8f1', 'ink': '#2b2620', 'soft': '#8a8175', 'accent': '#9a5b42', 'gold': '#c8a04e', 'line': '#e0d8cb'},
        'dark':  {'bg': '#1a1a1a', 'card': '#242420', 'ink': '#e8e0d4', 'soft': '#888070', 'accent': '#c08858', 'gold': '#d4a85e', 'line': '#3a3632'},
        'kraft': {'bg': '#d4c4a8', 'card': '#e4d8c0', 'ink': '#3a2e1e', 'soft': '#6a5a42', 'accent': '#8a5a2a', 'gold': '#a8763a', 'line': '#c4b498'},
        'sage':  {'bg': '#e4ebdf', 'card': '#f1f5ec', 'ink': '#33402c', 'soft': '#74846a', 'accent': '#5f7a52', 'gold': '#8a9a5e', 'line': '#d3ddca'},
        'mist':  {'bg': '#dfe7ec', 'card': '#eef3f6', 'ink': '#2c3742', 'soft': '#6a7884', 'accent': '#5a7a8c', 'gold': '#7a98a8', 'line': '#cdd9e0'},
        'cream': {'bg': '#f5efe4', 'card': '#fdf9f0', 'ink': '#4a3f30', 'soft': '#9a8d76', 'accent': '#b07050', 'gold': '#c8a878', 'line': '#e8ddcd'},
    }
    t = themes.get(theme, themes['sage'])
    hrs = stats.get('total_hours', 0)
    books = stats.get('books_read', 0)
    days = stats.get('days', 0)
    marks = stats.get('marks_total', 0)
    trees = stats.get('finished_count', 0)
    W, H = 600, 760
    import html as _html
    def esc(s): return _html.escape(str(s))
    # 装饰用的小树剪影
    tree = f'<path d="M300 {H-90} L285 {H-58} L315 {H-58} Z M300 {H-72} L280 {H-40} L320 {H-40} Z" fill="{t["accent"]}" opacity="0.25"/><rect x="297" y="{H-44}" width="6" height="18" fill="{t["accent"]}" opacity="0.25"/>'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" font-family="-apple-system,'PingFang SC',sans-serif">
  <rect width="{W}" height="{H}" fill="{t['bg']}"/>
  <rect x="32" y="32" width="{W-64}" height="{H-64}" rx="20" fill="{t['card']}"/>
  <text x="{W//2}" y="118" text-anchor="middle" font-size="26" font-weight="700" fill="{t['ink']}">我的阅读历程</text>
  <line x1="180" y1="142" x2="{W-180}" y2="142" stroke="{t['gold']}" stroke-width="1.5"/>
  <text x="{W//2}" y="232" text-anchor="middle" font-size="76" font-weight="800" fill="{t['accent']}">{hrs}</text>
  <text x="{W//2}" y="266" text-anchor="middle" font-size="17" fill="{t['soft']}">小时的阅读时光</text>
  <g>
    <text x="160" y="372" text-anchor="middle" font-size="42" font-weight="700" fill="{t['ink']}">{books}</text>
    <text x="160" y="400" text-anchor="middle" font-size="14" fill="{t['soft']}">读过的书</text>
    <text x="440" y="372" text-anchor="middle" font-size="42" font-weight="700" fill="{t['ink']}">{days}</text>
    <text x="440" y="400" text-anchor="middle" font-size="14" fill="{t['soft']}">阅读天数</text>
    <text x="160" y="476" text-anchor="middle" font-size="42" font-weight="700" fill="{t['ink']}">{marks}</text>
    <text x="160" y="504" text-anchor="middle" font-size="14" fill="{t['soft']}">标记摘录</text>
    <text x="440" y="476" text-anchor="middle" font-size="42" font-weight="700" fill="{t['ink']}">{trees}</text>
    <text x="440" y="504" text-anchor="middle" font-size="14" fill="{t['soft']}">种下的树</text>
  </g>
  <line x1="120" y1="560" x2="{W-120}" y2="560" stroke="{t['line']}" stroke-width="1"/>
  {tree}
  <text x="{W//2}" y="{H-18}" text-anchor="middle" font-size="12" fill="{t['soft']}">MyLibrary · 我的私人书房</text>
</svg>'''
    return svg


def export_booklist(title: str, books: list, fmt: str = 'text', theme: str = 'paper') -> dict:
    """
    主入口。books: [{title, author, rating, note}, ...]
    返回 {format, content, mime}
    """
    if fmt == 'markdown':
        return {'format': 'markdown', 'content': build_markdown(title, books), 'mime': 'text/markdown'}
    elif fmt == 'svg':
        return {'format': 'svg', 'content': build_svg(title, books, theme), 'mime': 'image/svg+xml'}
    else:
        return {'format': 'text', 'content': build_text(title, books), 'mime': 'text/plain'}


if __name__ == '__main__':
    # 自测
    demo = [
        {'title': '默读', 'author': 'priest', 'rating': 5, 'note': '骆闻舟×费渡，社会派推理天花板'},
        {'title': '破云', 'author': '淮上', 'rating': 5, 'note': '严峫×江停，刑侦缉毒'},
        {'title': '魔道祖师', 'author': '墨香铜臭', 'rating': 4, 'note': '魏无羡×蓝忘机'},
        {'title': '一醉经年', 'author': '', 'rating': 0, 'note': '宋居寒把我气的弃文了'},
    ]
    for fmt in ['text', 'markdown']:
        print(f'===== {fmt} =====')
        print(export_booklist('不看文笔不好的不看没眼缘的', demo, fmt)['content'])
        print()
    svg = export_booklist('我的耽美书单', demo, 'svg')['content']
    print(f'SVG 长度: {len(svg)} 字符，前200:')
    print(svg[:200])
