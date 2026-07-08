# -*- coding: utf-8 -*-
"""v4.6.5 功能测试：撤回/重新生成的底层——从某条消息开始把它和之后的都清掉。"""
import tempfile
from pathlib import Path


def test_delete_messages_from_truncates_correctly():
    import quill_agent as qa
    from mylib_core import Library
    from migrate_db import migrate

    tmp = Path(tempfile.mkdtemp())
    lib = Library(tmp / 'lib'); db = lib.root / 'library.db'; lib.close()
    migrate(db)

    sid = qa.create_session(db, book_title='测试')
    m1 = qa.add_message(db, sid, 'user', '你好')
    m2 = qa.add_message(db, sid, 'assistant', '你好呀')
    m3 = qa.add_message(db, sid, 'user', '推荐本书')
    m4 = qa.add_message(db, sid, 'assistant', '推荐xxx')

    # 撤回第二轮的用户消息：连它引出的回复一起清掉，第一轮不受影响
    qa.delete_messages_from(db, sid, m3)
    ids = [m['id'] for m in qa.get_session_messages(db, sid)]
    assert ids == [m1, m2], ids

    # 重新生成：旧问旧答一起清掉再重新来一轮
    m3b = qa.add_message(db, sid, 'user', '推荐本书')
    qa.add_message(db, sid, 'assistant', '推荐yyy')
    qa.delete_messages_from(db, sid, m3b)
    ids2 = [m['id'] for m in qa.get_session_messages(db, sid)]
    assert ids2 == [m1, m2], ids2

    # 只删最后一条：前面完全不受影响
    m5 = qa.add_message(db, sid, 'user', '再问一句')
    qa.delete_messages_from(db, sid, m5)
    ids3 = [m['id'] for m in qa.get_session_messages(db, sid)]
    assert ids3 == [m1, m2], ids3

    # 只对指定 session 生效，不该误删别的会话
    sid2 = qa.create_session(db, book_title='另一本')
    other = qa.add_message(db, sid2, 'user', '别的会话的话')
    qa.delete_messages_from(db, sid, m1)  # 清空第一个 session
    assert [m['id'] for m in qa.get_session_messages(db, sid)] == []
    assert [m['id'] for m in qa.get_session_messages(db, sid2)] == [other]


def test_truncate_route_requires_both_params(app_client):
    r = app_client.post('/api/quill/messages/truncate', json={'session_id': 1})
    assert r.status_code == 400
    r2 = app_client.post('/api/quill/messages/truncate', json={'from_message_id': 1})
    assert r2.status_code == 400


