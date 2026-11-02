// 화면 표출 공지: 로그인하면 화면이 어두워지고 가운데에 공지(여러 건은 나란히) · 「하루 동안 보지 않기」 · 「닫기」
import { useCallback, useEffect, useRef, useState } from 'react';
import { rpc } from '../lib/store.js';
import { boardHref } from '../lib/board.js';
import PostBody from '../components/PostBody.jsx';

const KEY = 'k132.noticeHide';
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const hidden = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v.date === today() ? v.ids || [] : []; } catch (_) { return []; } };
const hide = (ids) => { try { localStorage.setItem(KEY, JSON.stringify({ date: today(), ids: [...new Set(hidden().concat(ids))] })); } catch (_) {} };
const sig = (n) => n.id + ':' + (n.updated_at || '');

export default function NoticeLayer() {
  const [list, setList] = useState(null); const box = useRef(null); const closeRef = useRef(null); const prev = useRef(null);
  const open = useCallback(async (force) => {
    let l; try { l = await rpc('app_board_popups'); } catch (_) { return; }
    l = (l || []).filter((n) => force || !hidden().includes(sig(n)));
    if (l.length) { prev.current = document.activeElement; setList(l); }
  }, []);
  useEffect(() => { open(false); const on = (e) => open(!!(e.detail && e.detail.force)); window.addEventListener('k132:notices', on); return () => window.removeEventListener('k132:notices', on); }, [open]);
  const close = useCallback(() => { setList(null); try { prev.current && prev.current.focus(); } catch (_) {} }, []);
  useEffect(() => {
    if (!list) return undefined;
    document.body.classList.add('nl-open'); closeRef.current && closeRef.current.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'Tab' && box.current) { const f = [...box.current.querySelectorAll('a[href],button')]; if (!f.length) return; const a = f[0], z = f[f.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); } }
    };
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('keydown', onKey, true); document.body.classList.remove('nl-open'); };
  }, [list, close]);
  if (!list) return null;
  return (
    <div className="nl-back" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="nl-box" ref={box} role="dialog" aria-modal="true" aria-label="공지사항">
        <div className={'nl-panes' + (list.length === 1 ? ' one' : '')}>
          {list.map((n) => (
            <article key={n.id} className={'nl-pane' + (n.image ? ' has-img' : '')}>
              {n.image
                ? <><a className="nl-link" href={boardHref(n.board_id, n.id)} onClick={close}><img className="nl-img" src={n.image} alt={n.title} /></a>{(n.body || '').trim() && <PostBody text={n.body} className="post-body nl-text" />}</>
                : <><h2 className="nl-title">{n.must_read && <span className="tag must">필독</span>}{n.title}</h2><PostBody text={n.body} className="post-body nl-text" /></>}
              <a className="nl-more" href={boardHref(n.board_id, n.id)} onClick={close}>자세히 보기 →</a>
            </article>
          ))}
        </div>
        <div className="nl-bar">
          <button type="button" className="btn nl-btn" onClick={() => { hide(list.map(sig)); close(); }}>하루 동안 보지 않기</button>
          <button type="button" className="btn nl-btn nl-close" ref={closeRef} onClick={close}>닫기 ✕</button>
        </div>
      </div>
    </div>
  );
}
