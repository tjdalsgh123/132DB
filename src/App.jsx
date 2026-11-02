// 132총국 웹앱: 로그인 · 메뉴 · 화면 전환
import { useCallback, useEffect, useRef, useState } from 'react';
import { sb, D, load, has, isAdmin, save, startAutoRefresh, stopAutoRefresh } from './lib/store.js';
import { errText } from './lib/ui.js';
import { APP_NAME, ENV_LABEL } from './lib/config.js';
import { tree, layout, labelOf, parentOf, isHidden } from './lib/nav.js';
import { useData } from './hooks/useData.js';
import { useHashRoute } from './hooks/useHashRoute.js';
import { Brand, Btn } from './components/ui.jsx';
import { LoginView, RecoveryView, ErrorView } from './pages/Auth.jsx';
import { PAGES, Placeholder } from './pages/index.jsx';
import NoticeLayer from './pages/NoticeLayer.jsx';

const can = (id) => has(id) && !isHidden(id);

export default function App({ recovery }) {
  // view: boot | login | recovery | forced | error | app
  const [view, setView] = useState(recovery ? 'recovery' : 'boot');
  const [msg, setMsg] = useState(null); const [err, setErr] = useState(null);
  const booting = useRef(false);
  const boot = useCallback(async () => {
    if (booting.current) return; booting.current = true;
    try {
      const { data } = await sb.auth.getSession();
      if (!data.session) { stopAutoRefresh(); setView('login'); return; }
      const meta = (data.session.user && data.session.user.user_metadata) || {};
      if (meta.must_change) { setView('forced'); return; }
      setView('boot');
      try { await load(); } catch (e) { setErr(e); setView('error'); return; }
      setView('app'); startAutoRefresh();
    } finally { booting.current = false; }
  }, []);
  useEffect(() => {
    const { data } = sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') setView('recovery'); });
    if (!recovery) boot();
    return () => data.subscription.unsubscribe();
  }, [boot, recovery]);
  const logout = async (m) => { await sb.auth.signOut(); stopAutoRefresh(); location.hash = ''; setMsg(m || null); setView('login'); };

  if (view === 'boot') return <div className="boot">불러오는 중…</div>;
  if (view === 'login') return <LoginView msg={msg} onDone={() => { setMsg(null); boot(); }} />;
  if (view === 'recovery' || view === 'forced') return <RecoveryView forced={view === 'forced'} onDone={boot} onLogout={() => logout()} />;
  if (view === 'error') return <ErrorView error={err} onRetry={boot} onLogout={() => logout()} />;
  return <Shell onLogout={() => logout(['로그아웃했습니다', 'ok'])} />;
}

// ---------- 화면 틀 ----------
const visibleNav = () => tree().map((e) => (e.type === 'page'
  ? (can(e.id) ? { key: 'p:' + e.id, id: e.id, label: labelOf(e.id) } : null)
  : { key: 'g:' + e.id, gid: e.id, label: e.name, items: e.items.filter(can).map((x) => [x, labelOf(x)]) })).filter((n) => n && (n.id || n.items.length));
const firstPage = () => { for (const n of visibleNav()) { if (n.id && PAGES[n.id]) return n.id; if (n.items) { const f = n.items.find((x) => PAGES[x[0]]); if (f) return f[0]; } } return 'account'; };
const saveNav = async (nav) => { const l = layout(); try { await save('app_setting_save', { p_key: 'layout', p_value: { nav, labels: l.labels, hidden: l.hidden } }); } catch (_) { /* 다시 그리면 원래 순서 */ } };
const keyOf = (x) => (x.type === 'page' ? 'p:' : 'g:') + x.id;

// 관리자: 마우스로 메뉴를 끌어서 순서 바꾸기 (모바일은 「메뉴 관리」 화면에서)
function SortableLinks({ items, className, onDrop, children }) {
  const [order, setOrder] = useState(null); const d = useRef(null); const box = useRef(null); const suppress = useRef(false);
  const keys = order || items.map((x) => x.key);
  const byKey = new Map(items.map((x) => [x.key, x]));
  const down = (e) => { if (!isAdmin() || e.pointerType !== 'mouse' || e.button !== 0) return; const a = e.target.closest('a[data-key]'); if (!a) return; d.current = { key: a.dataset.key, id: e.pointerId, x0: e.clientX, y0: e.clientY, on: false, a }; };
  const move = (e) => {
    const s = d.current; if (!s || e.pointerId !== s.id) return;
    if (!s.on) { if (Math.abs(e.clientX - s.x0) < 6 && Math.abs(e.clientY - s.y0) < 6) return; s.on = true; try { s.a.setPointerCapture(e.pointerId); } catch (_) {} setOrder(items.map((x) => x.key)); }
    e.preventDefault();
    const els = [...box.current.querySelectorAll('a[data-key]')].filter((x) => x.dataset.key !== s.key);
    const o = els.find((x) => { const r = x.getBoundingClientRect(); return e.clientX < r.left + r.width / 2; });
    setOrder((cur) => { const base = (cur || items.map((x) => x.key)).filter((k) => k !== s.key); const i = o ? base.indexOf(o.dataset.key) : base.length; base.splice(i, 0, s.key); return base.join() === (cur || []).join() ? cur : base; });
  };
  const end = (e) => { const s = d.current; if (!s || e.pointerId !== s.id) return; d.current = null; if (!s.on) return; suppress.current = true; setTimeout(() => { suppress.current = false; }, 0); const fin = order; setOrder(null); if (fin && fin.join() !== items.map((x) => x.key).join()) onDrop(fin); };
  return (
    <div ref={box} className={className + (order ? ' is-dragging' : '')} title={isAdmin() ? '관리자: 메뉴를 끌어서 순서를 바꿀 수 있습니다' : ''}
      onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onDragStart={(e) => e.preventDefault()}
      onClickCapture={(e) => { if (suppress.current) { e.preventDefault(); e.stopPropagation(); } }}>
      {keys.map((k) => byKey.get(k)).filter(Boolean).map((x) => children(x, order && d.current && d.current.key === x.key))}
    </div>
  );
}

function Shell({ onLogout }) {
  useData(); const route = useHashRoute();
  const [sync, setSync] = useState('');
  const vis = visibleNav();
  let id = route.page;
  if (!id || (id !== 'account' && !can(id))) id = firstPage();
  useEffect(() => { if (route.page !== id) history.replaceState(null, '', '#/' + id); }, [route.page, id]);
  useEffect(() => { document.title = (ENV_LABEL ? '[개발] ' : '') + labelOf(id) + ' · ' + APP_NAME; window.scrollTo(0, 0); }, [id]);
  const par = parentOf(id); const grp = par && vis.find((n) => n.gid === par.id);
  const role = (D.roles.find((r) => r.id === D.me.role) || {}).name || '';
  const doSync = async () => { setSync('불러오는 중…'); try { await load(); setSync(''); } catch (e) { setSync(errText(e)); } };
  const P = PAGES[id];
  return (
    <>
      <header className="top">
        <Brand />
        <div className="who">
          <span className="sync-t">{sync || (D.loadedAt ? '5분마다 자동 갱신 · 마지막 ' + D.loadedAt.toLocaleTimeString('ko-KR', { hour12: false }) : '')}</span>
          <Btn kind="sm" onClick={doSync}>지금 업데이트</Btn>
          <a className="who-name" href="#/account" title="내 계정 · 비밀번호 변경">{(D.me.name || D.me.email) + (role ? ' · ' + role : '')}</a>
          <Btn kind="sm" onClick={onLogout}>로그아웃</Btn>
        </div>
      </header>
      <nav className="nav" aria-label="메뉴">
        <SortableLinks className="nav-in" items={vis} onDrop={(order) => { const full = tree(); const shown = order.map((k) => full.find((x) => keyOf(x) === k)).filter(Boolean); saveNav(shown.concat(full.filter((x) => !order.includes(keyOf(x))))); }}>
          {(n, dragging) => <a key={n.key} data-key={n.key} className={'nav-i' + (dragging ? ' dragging' : '')} href={'#/' + (n.id || n.items[0][0])} aria-current={(n.id && n.id === id) || (n.gid && par && n.gid === par.id) ? 'page' : undefined}>{n.label}</a>}
        </SortableLinks>
      </nav>
      <div className="subnav" hidden={!grp}>
        {grp && <SortableLinks className="nav-in" items={grp.items.map(([pid, lb]) => ({ key: 'p:' + pid, pid, lb }))} onDrop={(order) => { const full = tree(); const g = full.find((x) => x.type === 'group' && x.id === grp.gid); if (!g) return; const ids = order.map((k) => k.slice(2)); g.items = ids.filter((x) => g.items.includes(x)).concat(g.items.filter((x) => !ids.includes(x))); saveNav(full); }}>
          {(x, dragging) => <a key={x.key} data-key={x.key} className={'sub-i' + (dragging ? ' dragging' : '')} href={'#/' + x.pid} aria-current={x.pid === id ? 'page' : undefined}>{x.lb}</a>}
        </SortableLinks>}
      </div>
      <main className="main" id="main">
        {P ? <P key={id} id={id} route={route} /> : <Placeholder id={id} />}
      </main>
      <NoticeLayer />
    </>
  );
}
