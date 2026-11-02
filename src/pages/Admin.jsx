// 관리자 · 권한 관리: 사람(로그인 계정) · 역할(볼 수 있는 메뉴와 범위) · 지국(계정 할당 포함)
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { D, save, edge } from '../lib/store.js';
import { MSG, errText, busy } from '../lib/ui.js';
import { menus, labelOf } from '../lib/nav.js';
import { allocAll, allocSet } from '../lib/branchpay.js';
import { useData } from '../hooks/useData.js';
import { Btn, ConfirmBtn, Field, LiveCheck, MoneyInput, PageHead, Status, Tabs, useLive, useStatus, YN, YnFilter } from '../components/ui.jsx';

const SCOPES = [['all', '전체 지국'], ['branch', '소속 지국만'], ['own', '본인 것만'], ['none', '데이터 없음']];
const scopeName = (s) => (SCOPES.find((x) => x[0] === s) || [s, s])[1];
const scopeOfRole = (id) => (D.roles.find((r) => r.id === id) || {}).scope || '';
// 연결 칸: 홍보팀장 역할만 홍보팀장 연결 · 지국장 역할은 지국 직할로 자동 연결 · 그 밖에는 없음
const linkNote = (rid, bid) => { const sc = scopeOfRole(rid); return sc === 'branch' ? (bid ? '지국 직할 (자동 연결)' : '소속 지국을 정하면 지국 직할로 연결') : sc === 'own' ? '' : '— (연결 없음)'; };
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// 임시 비밀번호: 헷갈리는 글자(0 O 1 l I) 제외 10자
const genPw = () => { const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; const a = new Uint32Array(10); crypto.getRandomValues(a); let s = ''; a.forEach((x) => { s += c[x % c.length]; }); return /\d/.test(s) ? s : s.slice(0, 9) + '7'; };
const fmt = (t) => { if (!t) return ''; const d = new Date(t); if (isNaN(d)) return ''; const p = (n) => String(n).padStart(2, '0'); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); };
const promoterOpts = (branch, email) => D.promoters.filter((p) => p.branch_id === branch && (p.active !== false)).map((p) => ({ id: p.id, name: p.name + (D.users.some((u) => u.promoter === p.id && u.email !== email) ? ' (다른 계정 연결됨)' : '') }));
const branchOpts = () => D.branches.map((b) => ({ id: b.id, name: b.name + (b.active === false ? ' (사용 안 함)' : '') }));
const Opts = ({ list, empty }) => <>{empty != null && <option value="">{empty}</option>}{list.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</>;

// 창: 모달 <dialog>
function Dlg({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => { const d = ref.current; if (d && !d.open) d.showModal(); const c = (e) => { e.preventDefault(); onClose && onClose(); }; d.addEventListener('cancel', c); return () => d.removeEventListener('cancel', c); }, [onClose]);
  return <dialog className="dlg" ref={ref}>{children}</dialog>;
}
// 비밀번호 알려 주기 창
function PwShow({ title, email, pw, onClose }) {
  const [st, setSt] = useStatus();
  const copy = async () => { try { await navigator.clipboard.writeText('132총국 접속 주소: ' + location.origin + '\n이메일: ' + email + '\n임시 비밀번호: ' + pw + '\n(첫 로그인 후 새 비밀번호로 바꿔 주세요)'); setSt('복사했습니다', 'ok'); } catch (_) { setSt('복사하지 못했습니다 · 직접 선택해 복사해 주세요', 'warn'); } };
  return (
    <Dlg onClose={onClose}><div className="stack">
      <h2>{title}</h2><p className="note">아래 이메일과 임시 비밀번호를 본인에게 직접 전달하세요. 첫 로그인 때 새 비밀번호로 바꾸게 됩니다. 이 창을 닫으면 비밀번호를 다시 볼 수 없습니다.</p>
      <dl className="kv"><dt>접속 주소</dt><dd>{location.origin}</dd><dt>이메일</dt><dd>{email}</dd><dt>임시 비밀번호</dt><dd className="pw-show">{pw}</dd></dl>
      <div className="acts"><Btn onClick={copy}>함께 복사</Btn><Btn kind="primary" onClick={onClose}>닫기</Btn></div><Status s={st} />
    </div></Dlg>
  );
}
// 비밀번호 정하기 창
function PwAsk({ title, email, onDone }) {
  const [pw, setPw] = useState(genPw); const [st, setSt] = useStatus(); const [bad, setBad] = useState(false); const ref = useRef(null);
  useEffect(() => { ref.current && ref.current.select(); }, []);
  return (
    <Dlg onClose={() => onDone(null)}><form className="stack" onSubmit={(e) => { e.preventDefault(); if (pw.trim().length < 8) { setBad(true); setSt('8자 이상 입력해 주세요', 'bad'); return; } onDone(pw.trim()); }}>
      <h2>{title}</h2><p className="note">{email + ' · 임시 비밀번호(8자 이상)를 정하세요. 자동으로 만든 값을 그대로 써도 됩니다.'}</p>
      <Field label="임시 비밀번호"><div className="acts"><input ref={ref} className={'in' + (bad ? ' invalid' : '')} type="text" autoComplete="off" spellCheck={false} value={pw} onChange={(e) => { setPw(e.target.value); setBad(false); }} /><Btn kind="sm" onClick={() => { setPw(genPw()); setBad(false); }}>새로 만들기</Btn></div></Field>
      <div className="acts"><Btn onClick={() => onDone(null)}>취소</Btn><button type="submit" className="btn primary">확인</button></div><Status s={st} />
    </form></Dlg>
  );
}

export default function Admin() {
  useData();
  const [tab, setTab] = useState('people');
  return (
    <div className="page">
      <PageHead eyebrow="관리자" title="권한 관리" lede="사람마다 로그인 계정·역할·소속을 정합니다. 역할은 볼 수 있는 메뉴와 데이터 범위를 정합니다. 회원가입은 막혀 있어 여기서 등록한 사람만 로그인할 수 있습니다." />
      <Tabs items={[['people', '사람 (' + D.users.length + ')'], ['roles', '역할 (' + D.roles.length + ')'], ['branches', '지국 (' + D.branches.length + ')']]} value={tab} onPick={setTab} />
      <div className="stack">{tab === 'people' ? <People /> : tab === 'roles' ? <Roles /> : <Branches />}</div>
    </div>
  );
}

// ---------- 사람 ----------
function People() {
  const [st, setSt] = useStatus(); const [q, setQ] = useState(''); const [role, setRole] = useState(''); const [yn, setYn] = useState('y');
  const [sel, setSel] = useState(() => new Set()); const [auth, setAuth] = useState(null); const [authErr, setAuthErr] = useState('');
  const [drafts, setDrafts] = useState(() => new Map()); const [adding, setAdding] = useState(false); const [dlg, setDlg] = useState(null);
  const loadAuth = useCallback(async () => { setAuthErr(''); try { const r = await edge('list'); setAuth(new Map((r.users || []).map((u) => [u.email, u]))); } catch (e) { setAuth((a) => a || new Map()); setAuthErr(errText(e)); } }, []);
  useEffect(() => { loadAuth(); }, [loadAuth]);
  const authText = (u) => { if (!auth) return ['확인 중…', '']; const a = auth.get(u.email); if (!a) return ['로그인 계정 없음', 'warn']; if (a.must_change) return [a.last_sign_in_at ? '임시 비밀번호 사용 중' : '첫 로그인 전', 'info']; return [a.last_sign_in_at ? '최근 로그인 ' + fmt(a.last_sign_in_at) : '로그인 기록 없음', a.last_sign_in_at ? 'ok' : '']; };
  const askPw = (title, email) => new Promise((res) => setDlg({ type: 'ask', title, email, res }));
  const showPw = (title, email, pw) => setDlg({ type: 'show', title, email, pw });
  const saveUser = async (u, okMsg) => { await save('app_user_save', { p_email: u.email, p_name: u.name || '', p_role: u.role, p_branch: u.branch || null, p_promoter: u.promoter || null, p_free: !!u.free, p_active: u.active !== false }); setSt(okMsg, 'ok'); };
  const makeAccount = async (u, reset) => {
    const pw = await askPw(reset ? '비밀번호 초기화' : '로그인 계정 만들기', u.email); setDlg(null); if (!pw) return;
    try { await busy.run(() => edge(reset ? 'reset' : 'create', { email: u.email, password: pw })); showPw(reset ? '비밀번호를 초기화했습니다' : '로그인 계정을 만들었습니다', u.email, pw); setSt(u.email + (reset ? ' 비밀번호를 초기화했습니다' : ' 로그인 계정을 만들었습니다'), 'ok'); loadAuth(); }
    catch (e) { setSt(errText(e), 'bad'); }
  };
  const delSel = async () => {
    const emails = [...sel];
    try { await save('app_user_delete', { p_emails: emails }); const fail = []; for (const em of emails) { try { await edge('delete', { email: em }); } catch (e) { fail.push(em); } }
      setSel(new Set()); setSt(emails.length + '명을 삭제했습니다' + (fail.length ? ' · 로그인 계정 삭제 실패: ' + fail.join(', ') : ''), fail.length ? 'warn' : 'ok'); loadAuth(); }
    catch (e) { setSt(errText(e), 'bad'); }
  };
  const list = D.users.filter((u) => YN[yn](u) && (!role || u.role === role) && (!q || (u.name + ' ' + u.email).toLowerCase().includes(q.toLowerCase())));
  const noAcc = auth ? D.users.filter((u) => !auth.has(u.email)).length : 0;
  const toggle = (em, on) => setSel((s) => { const n = new Set(s); on ? n.add(em) : n.delete(em); return n; });
  return (<>
    {adding && <AddForm onClose={() => setAdding(false)} saveUser={saveUser} showPw={showPw} loadAuth={loadAuth} setPeopleSt={setSt} />}
    <section className="card">
      <div className="card-h"><h2>사람 목록</h2>
        <div className="acts">
          <YnFilter value={yn} list={D.users} onPick={setYn} />
          <input className="in" type="search" placeholder="이름·이메일 검색" aria-label="검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="in" aria-label="역할로 거르기" value={role} onChange={(e) => setRole(e.target.value)}><option value="">역할 전체</option>{D.roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
          <Btn onClick={() => { setAuth(null); loadAuth(); }}>계정 상태 새로고침</Btn>
          <ConfirmBtn disabled={!sel.size} confirmText={'한 번 더 눌러 ' + sel.size + '명 삭제'} onFirst={() => setSt('삭제하면 로그인 계정도 함께 지워집니다 · 등록한 매출은 남습니다', 'warn')} onConfirm={delSel}>{'선택 삭제 (' + sel.size + ')'}</ConfirmBtn>
          <Btn kind="primary" onClick={() => setAdding(true)}>+ 사람 추가</Btn>
        </div></div>
      <p className="note">역할·소속·연결을 바꾼 뒤 그 줄의 「저장」을 누르세요 · 「계정 만들기」/「비밀번호 초기화」는 임시 비밀번호를 정해 본인에게 전달합니다</p>
      <Status s={st} />
      {authErr && <p className="status">{'로그인 계정 상태를 불러오지 못했습니다: ' + authErr}</p>}
      <div className="tbl"><table className="items left">
        <thead><tr><th><input type="checkbox" aria-label="모두 선택" checked={list.length > 0 && list.every((u) => sel.has(u.email) || u.email === D.me.email)} onChange={(e) => setSel((s) => { const n = new Set(s); list.forEach((u) => { if (u.email === D.me.email) return; e.target.checked ? n.add(u.email) : n.delete(u.email); }); return n; })} /></th>
          {['이름', '이메일', '역할', '소속 지국', '연결', '자율학기제', '사용', '로그인 계정', ''].map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
        <tbody>{list.map((u0) => <UserRow key={u0.email} u0={u0} draft={drafts.get(u0.email)} setDraft={(u) => setDrafts((m) => { const n = new Map(m); if (u) n.set(u0.email, u); else n.delete(u0.email); return n; })}
          checked={sel.has(u0.email)} onCheck={(on) => toggle(u0.email, on)} auth={auth} authText={authText(u0)} saveUser={saveUser} setSt={setSt} makeAccount={makeAccount} />)}</tbody>
      </table></div>
      {!list.length && <p className="note empty">{D.users.length ? '조건에 맞는 사람이 없습니다' : '등록된 사람이 없습니다 · 「+ 사람 추가」를 눌러 주세요'}</p>}
      {noAcc > 0 && <p className="note info">{'로그인 계정이 없는 사람 ' + noAcc + '명 · 「계정 만들기」를 눌러야 로그인할 수 있습니다'}</p>}
    </section>
    {dlg && dlg.type === 'ask' && <PwAsk title={dlg.title} email={dlg.email} onDone={(v) => dlg.res(v)} />}
    {dlg && dlg.type === 'show' && <PwShow title={dlg.title} email={dlg.email} pw={dlg.pw} onClose={() => setDlg(null)} />}
  </>);
}

function UserRow({ u0, draft, setDraft, checked, onCheck, auth, authText, saveUser, setSt, makeAccount }) {
  const u = draft || u0; const me = u.email === D.me.email; const [bad, setBad] = useState(new Set());
  const set = (patch) => { setDraft({ ...u, ...patch }); setBad((b) => { const n = new Set(b); Object.keys(patch).forEach((k) => n.delete(k)); return n; }); };
  const own = scopeOfRole(u.role) === 'own';
  const doSave = async () => {
    const r = D.roles.find((x) => x.id === u.role) || {}; const need = [];
    if (!String(u.name || '').trim()) need.push('name'); if ((r.scope === 'branch' || r.scope === 'own') && !u.branch) need.push('branch'); if (r.scope === 'own' && !u.promoter) need.push('promoter');
    if (need.length) { setBad(new Set(need)); setSt(MSG + ' · ' + scopeName(r.scope) + ' 역할은 소속' + (r.scope === 'own' ? '·홍보팀장 연결' : '') + '이 필요합니다', 'bad'); return; }
    try { await saveUser(u, (u.name || u.email) + ' 님 정보를 저장했습니다'); setDraft(null); } catch (e) { setSt(errText(e), 'bad'); }
  };
  const [at, ak] = authText; const cls = (k) => 'in' + (bad.has(k) ? ' invalid' : '');
  return (
    <tr className={u.active === false ? 'off' : ''}>
      <td><input type="checkbox" checked={checked} disabled={me} title={me ? '본인 계정은 삭제할 수 없습니다' : undefined} aria-label={u.name + ' 선택'} onChange={(e) => onCheck(e.target.checked)} /></td>
      <td><div><input className={cls('name')} type="text" maxLength={30} aria-label="이름" value={u.name || ''} onChange={(e) => set({ name: e.target.value })} />{me && <span className="badge">본인</span>}</div></td>
      <td><span className="nowrap">{u.email}</span></td>
      <td><select className="in" aria-label="역할" value={u.role} disabled={me} onChange={(e) => set({ role: e.target.value, ...(scopeOfRole(e.target.value) !== 'own' ? { promoter: '' } : {}) })}><Opts list={D.roles.map((r) => ({ id: r.id, name: r.name }))} /></select></td>
      <td><select className={cls('branch')} aria-label="소속 지국" value={u.branch || ''} onChange={(e) => set({ branch: e.target.value, promoter: '' })}><Opts list={branchOpts()} empty="없음" /></select></td>
      <td><div><select className={cls('promoter')} aria-label="연결할 홍보팀장" hidden={!own} disabled={!own || !u.branch} value={u.promoter || ''} onChange={(e) => set({ promoter: e.target.value })}><Opts list={promoterOpts(u.branch, u.email)} empty="연결 안 함" /></select><span className="link-note" hidden={own}>{linkNote(u.role, u.branch)}</span></div></td>
      <td><input type="checkbox" aria-label="자율학기제" checked={!!u.free} onChange={(e) => set({ free: e.target.checked })} /></td>
      <td><input type="checkbox" aria-label="사용" checked={u.active !== false} disabled={me} onChange={(e) => set({ active: e.target.checked })} /></td>
      <td className="nowrap"><span className="status" data-kind={ak}>{at}</span></td>
      <td className="act"><div className="acts"><Btn kind={'sm' + (draft ? ' primary' : '')} disabled={!draft} onClick={doSave}>저장</Btn>
        {auth && (auth.has(u.email) ? <Btn kind="sm" onClick={() => makeAccount(u, true)}>비밀번호 초기화</Btn> : <Btn kind="sm" onClick={() => makeAccount(u, false)}>계정 만들기</Btn>)}</div></td>
    </tr>
  );
}

function AddForm({ onClose, saveUser, showPw, loadAuth, setPeopleSt }) {
  const [n, setN] = useState({ email: '', name: '', role: 'r_promo', branch: '', promoter: '', free: false }); const [mk, setMk] = useState(true); const [pw, setPw] = useState(genPw);
  const [st, setSt] = useStatus(); const [bad, setBad] = useState(new Set()); const nameRef = useRef(null);
  useEffect(() => { nameRef.current && nameRef.current.focus(); }, []);
  const r = D.roles.find((x) => x.id === n.role) || {};
  const set = (patch) => { setN((x) => ({ ...x, ...patch })); setBad((b) => { const m = new Set(b); Object.keys(patch).forEach((k) => m.delete(k)); return m; }); };
  const go = async () => {
    const need = []; const em = n.email.trim().toLowerCase();
    if (!n.name.trim()) need.push('name'); if (!EMAIL.test(em)) need.push('email');
    if ((r.scope === 'branch' || r.scope === 'own') && !n.branch) need.push('branch'); if (r.scope === 'own' && !n.promoter) need.push('promoter');
    if (need.length) { setBad(new Set(need)); setSt(MSG, 'bad'); return; }
    if (D.users.some((u) => u.email === em)) { setBad(new Set(['email'])); setSt('이미 등록된 이메일입니다', 'bad'); return; }
    if (mk && pw.trim().length < 8) { setBad(new Set(['pw'])); setSt('임시 비밀번호는 8자 이상이어야 합니다', 'bad'); return; }
    const u = { email: em, name: n.name.trim(), role: n.role, branch: n.branch, promoter: r.scope === 'own' ? n.promoter : '', free: n.free, active: true };
    try { await saveUser(u, u.name + ' 님을 등록했습니다'); } catch (e) { setSt(errText(e), 'bad'); return; }
    if (mk) { try { await busy.run(() => edge('create', { email: em, password: pw.trim() })); showPw('등록하고 로그인 계정을 만들었습니다', em, pw.trim()); loadAuth(); } catch (e) { setPeopleSt(u.name + ' 님은 등록했지만 로그인 계정을 만들지 못했습니다: ' + errText(e) + ' · 목록에서 「계정 만들기」를 다시 눌러 주세요', 'warn'); } }
    onClose();
  };
  const cls = (k) => 'in' + (bad.has(k) ? ' invalid' : '');
  return (
    <section className="card">
      <div className="card-h"><h2>사람 추가</h2><Btn kind="sm" onClick={onClose}>닫기</Btn></div>
      <div className="form3">
        <Field label="이름"><input ref={nameRef} className={cls('name')} type="text" maxLength={30} placeholder="예: 홍길동" value={n.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="이메일 (로그인 아이디)"><input className={cls('email')} type="email" placeholder="name@example.com" autoComplete="off" value={n.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="역할"><select className="in" aria-label="역할" value={n.role} onChange={(e) => set({ role: e.target.value, promoter: '' })}><Opts list={D.roles.map((x) => ({ id: x.id, name: x.name }))} /></select></Field>
        <Field label="소속 지국"><select className={cls('branch')} aria-label="소속 지국" value={n.branch} onChange={(e) => set({ branch: e.target.value, promoter: '' })}><Opts list={branchOpts()} empty="선택 안 함" /></select></Field>
        <Field label="연결 (홍보팀장 · 지국 직할)"><div><select className={cls('promoter')} aria-label="연결할 홍보팀장" hidden={r.scope !== 'own'} disabled={!n.branch || r.scope !== 'own'} value={n.promoter} onChange={(e) => set({ promoter: e.target.value })}><Opts list={promoterOpts(n.branch, '')} empty="연결 안 함" /></select><span className="link-note" hidden={r.scope === 'own'}>{linkNote(n.role, n.branch)}</span></div></Field>
      </div>
      <p className="note">{'데이터 범위: ' + scopeName(r.scope) + (r.scope === 'branch' ? ' · 소속 지국을 꼭 정하세요' : r.scope === 'own' ? ' · 소속 지국과 연결할 홍보팀장을 꼭 정하세요' : '')}</p>
      <label className="check"><input type="checkbox" checked={n.free} onChange={(e) => set({ free: e.target.checked })} /> 자율학기제 매출 등록 사용</label>
      <label className="check"><input type="checkbox" checked={mk} onChange={(e) => setMk(e.target.checked)} /> 로그인 계정도 바로 만들기</label>
      {mk && <Field label="임시 비밀번호"><div className="acts"><input className={cls('pw')} type="text" autoComplete="off" spellCheck={false} value={pw} onChange={(e) => { setPw(e.target.value); setBad(new Set()); }} /><Btn kind="sm" onClick={() => setPw(genPw())}>새로 만들기</Btn></div></Field>}
      <div className="acts"><Btn kind="primary" onClick={go}>등록</Btn><Status s={st} /></div>
    </section>
  );
}

// ---------- 역할 ----------
function Roles() {
  const S = useRef({ roles: null, sig: '', dirty: false }); const [, force] = useReducer((x) => x + 1, 0); const [st, setSt] = useStatus(); const [bad, setBad] = useState(new Set());
  const load = (f) => { const sig = JSON.stringify(D.roles); if (f || (!S.current.dirty && sig !== S.current.sig)) { S.current.roles = JSON.parse(sig).map((r) => ({ ...r, menus: Array.isArray(r.menus) ? r.menus : [] })); S.current.sig = sig; S.current.dirty = false; } };
  load(false);
  const roles = S.current.roles;
  const dirty = () => { S.current.dirty = true; setSt('저장하지 않은 변경이 있습니다', 'warn'); force(); };
  const doSave = async () => {
    const empty = roles.map((r, i) => (!r.name.trim() ? i : -1)).filter((i) => i >= 0);
    if (empty.length) { setBad(new Set(empty)); setSt(MSG + ' · 역할 이름', 'bad'); return; }
    try { await save('app_roles_save', { p_roles: roles.map((r, i) => ({ id: r.id, name: r.name.trim(), scope: r.scope, menus: r.menus, sort_order: i })) }); S.current.dirty = false; load(true); setBad(new Set()); force(); setSt('역할을 저장했습니다 · 해당 사람은 다음 갱신 때 메뉴가 바뀝니다', 'ok'); }
    catch (e) { setSt(errText(e), 'bad'); }
  };
  const MS = menus(); const groups = [...new Set(MS.map((m) => m.group))];
  return (
    <section className="card">
      <div className="card-h"><h2>역할</h2><div className="acts">
        <Btn onClick={() => { roles.push({ id: 'r_' + Date.now().toString(36), name: '', scope: 'own', menus: [], sort_order: roles.length }); dirty(); }}>+ 역할 추가</Btn>
        <Btn onClick={() => { load(true); setSt(''); setBad(new Set()); force(); }}>되돌리기</Btn><Btn kind="primary" onClick={doSave}>저장</Btn></div></div>
      <p className="note">「관리자」 메뉴가 켜진 역할은 모든 메뉴와 전체 지국을 봅니다 · 데이터 범위: 전체 지국 / 소속 지국만 / 본인 것만 · 사람이 지정된 역할은 삭제할 수 없습니다</p>
      <Status s={st} />
      {roles.map((r, i) => { const nUsers = D.users.filter((u) => u.role === r.id).length; const mine = r.id === D.me.role; const isAdm = r.menus.includes('admin'); return (
        <div className="role-box" key={r.id}>
          <div className="acts">
            <Btn kind="sm icon" aria-label="위로" disabled={i === 0} onClick={() => { [roles[i - 1], roles[i]] = [roles[i], roles[i - 1]]; dirty(); }}>▲</Btn>
            <Btn kind="sm icon" aria-label="아래로" disabled={i === roles.length - 1} onClick={() => { [roles[i + 1], roles[i]] = [roles[i], roles[i + 1]]; dirty(); }}>▼</Btn>
            <input className={'in role-name' + (bad.has(i) ? ' invalid' : '')} type="text" maxLength={20} placeholder="역할 이름" aria-label="역할 이름" value={r.name} onChange={(e) => { r.name = e.target.value; setBad(new Set()); dirty(); }} />
            <select className="in" aria-label="데이터 범위" value={r.scope} onChange={(e) => { r.scope = e.target.value; dirty(); }}>{SCOPES.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>
            <span className="badge">{nUsers}명</span>
            <Btn kind="sm" disabled={nUsers > 0 || mine} title={nUsers > 0 || mine ? '사람이 지정된 역할은 삭제할 수 없습니다' : undefined} onClick={() => { roles.splice(i, 1); dirty(); }}>삭제</Btn>
          </div>
          <div className="checks">{groups.map((g) => (
            <div className="checks-g" key={g || '_'}><span className="checks-l">{g || '공통'}</span>
              {MS.filter((m) => m.group === g).map((m) => <label key={m.id} className="check"><input type="checkbox" checked={isAdm || r.menus.includes(m.id)} disabled={(isAdm && m.id !== 'admin') || (mine && m.id === 'admin')} onChange={(e) => { r.menus = e.target.checked ? [...new Set(r.menus.concat(m.id))] : r.menus.filter((x) => x !== m.id); dirty(); }} /> {labelOf(m.id)}</label>)}
            </div>))}</div>
        </div>); })}
    </section>
  );
}

// ---------- 지국 ----------
function Branches() {
  const [st, setSt] = useStatus(); const [yn, setYn] = useState('y'); const [ni, setNi] = useState(''); const [nbad, setNbad] = useState(false);
  const list = D.branches.map((b) => ({ ...b }));
  const vis = list.filter(YN[yn]);
  const saveBranches = async (l, ok) => { try { await save('app_branch_save', { p_items: l.map((b) => ({ id: b.id, name: String(b.name).trim(), active: b.active !== false })) }); setSt(ok, 'ok'); return true; } catch (e) { setSt(errText(e), 'bad'); return false; } };
  const add = async () => { const v = ni.trim(); if (!v) { setNbad(true); setSt(MSG + ' · 지국 이름', 'bad'); return; } if (list.some((b) => b.name === v)) { setNbad(true); setSt('같은 이름의 지국이 이미 있습니다', 'bad'); return; } if (await saveBranches(list.concat([{ id: 'b_' + Date.now().toString(36), name: v, active: true }]), v + ' 지국을 추가했습니다')) setNi(''); };
  return (
    <section className="card">
      <div className="card-h"><h2>지국</h2><YnFilter value={yn} list={list} onPick={setYn} /></div>
      <div className="acts"><input className={'in' + (nbad ? ' invalid' : '')} type="text" maxLength={40} placeholder="새 지국 이름" aria-label="새 지국 이름" value={ni} onChange={(e) => { setNi(e.target.value); setNbad(false); }} /><Btn kind="primary" onClick={add}>지국 추가</Btn></div>
      <p className="note">순서는 화면·엑셀의 지국 순서입니다 · 이름을 고친 뒤 칸을 벗어나면 저장됩니다 · 매출이 있는 지국은 삭제 대신 「사용 안 함」으로 바꾸세요 · 지국코드는 신청자 키에 쓰이며 바뀌지 않습니다</p>
      <Status s={st} />
      <div className="rows">
        {vis.map((b, vi) => { const i = list.findIndex((x) => x.id === b.id); const prev = vi > 0 ? list.findIndex((x) => x.id === vis[vi - 1].id) : -1, next = vi < vis.length - 1 ? list.findIndex((x) => x.id === vis[vi + 1].id) : -1;
          return <BranchRow key={b.id} b={b} i={i} list={list} prev={prev} next={next} saveBranches={saveBranches} setSt={setSt} />; })}
        {!vis.length && <p className="note empty">{list.length ? (yn === 'n' ? '사용 안 함인 지국이 없습니다' : '사용 중인 지국이 없습니다') : '등록된 지국이 없습니다'}</p>}
      </div>
    </section>
  );
}

function BranchRow({ b, i, list, prev, next, saveBranches, setSt }) {
  const nS = D.entries.filter((e) => e.branch_id === b.id).length + D.free.filter((f) => f.branch_id === b.id).length;
  const nP = D.users.filter((u) => u.branch === b.id).length;
  const [nm, setNm] = useLive(b.name); const [nmBad, setNmBad] = useState(false);
  const A = allocSet(b.id);
  const [np, setNp] = useLive(String(A.promoters)); const [nc, setNc] = useLive(String(A.chiefs)); const [cap, setCap] = useLive(A.cap || 0);
  const sMax = Number((D.fee_items.find((x) => x.id === 'settle') || {}).max_times) || 4;
  const accsV = (n, starts) => { const out = []; for (let k = 0; k < n; k++) out.push({ start: (starts && starts[k] != null ? starts[k] : ((A.accs || [])[k] || {}).start) || '' }); return out; };
  const saveA = async (nx, ok) => {
    if (nx.on && nx.promoters + nx.chiefs < 1) { setSt('계정 수를 1 이상 넣어 주세요', 'bad'); return; }
    const all = JSON.parse(JSON.stringify(allocAll())); Object.keys(all).forEach((k) => { if (!all[k] || !('on' in all[k])) delete all[k]; }); all[b.id] = nx;
    try { await save('app_setting_save', { p_key: 'branch_alloc', p_value: all }); setSt(ok, 'ok'); } catch (e) { setSt(errText(e), 'bad'); }
  };
  const saveNums = (pv = np, cv = nc, capv = cap) => { const P = Math.max(0, Math.floor(Number(pv) || 0)), C = Math.max(0, Math.floor(Number(cv) || 0)); saveA({ on: true, promoters: P, chiefs: C, cap: capv || 0, accs: accsV(P) }, b.name + ' 계정 할당: 홍보팀장 ' + (Number(pv) || 0) + '계정 · 지국장 ' + (Number(cv) || 0) + '계정' + (capv ? ' · 구간 여유 ' + Number(capv).toLocaleString('ko-KR') + '원' : ' · 구간 여유 없음')); };
  const setStart = (k, v) => { const starts = []; for (let j = 0; j < A.promoters; j++) starts.push(((A.accs || [])[j] || {}).start || ''); starts[k] = v; saveA({ ...A, accs: accsV(Math.max(0, Math.floor(Number(np) || 0)), starts) }, b.name + ' 홍보팀장 계정 ' + (k + 1) + (v ? ' 정착수당 시작 ' + v + ' (' + v + ' ~ 6개월 · 최대 ' + sMax + '회)' : ' 정착수당 없음 (신입 아님)')); };
  const rename = () => { const v = nm.trim(); if (!v) { setNmBad(true); setSt(MSG + ' · 지국 이름', 'bad'); return; } if (list.some((x) => x.id !== b.id && x.name === v)) { setNmBad(true); setSt('같은 이름의 지국이 이미 있습니다', 'bad'); return; } if (v === b.name) return; saveBranches(list.map((x) => (x.id === b.id ? { ...x, name: v } : x)), '「' + b.name + '」 → 「' + v + '」 이름을 바꿨습니다'); };
  return (
    <div className={'row pm-row' + (b.active === false ? ' off' : '')}>
      <div className="pm-left"><span className="pm-num">{i + 1}</span>
        <Btn kind="sm icon" aria-label={b.name + ' 위로'} disabled={prev < 0} onClick={() => { const n = list.slice(); [n[prev], n[i]] = [n[i], n[prev]]; saveBranches(n, b.name + ' 위로 옮겼습니다'); }}>▲</Btn>
        <Btn kind="sm icon" aria-label={b.name + ' 아래로'} disabled={next < 0} onClick={() => { const n = list.slice(); [n[next], n[i]] = [n[i], n[next]]; saveBranches(n, b.name + ' 아래로 옮겼습니다'); }}>▼</Btn>
        <span className="badge">{b.code ? '코드 ' + b.code : '코드 자동'}</span></div>
      <div className="pm-mid">
        <input className={'in br-name' + (nmBad ? ' invalid' : '')} type="text" maxLength={40} aria-label="지국 이름" value={nm} onChange={(e) => { setNm(e.target.value); setNmBad(false); }} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
        <div className="note">{'매출 ' + nS + '건 · 홍보팀장 ' + D.promoters.filter((p) => p.branch_id === b.id).length + '명 · 소속 계정 ' + nP + '명'}</div>
        <div className="alloc-row">
          <LiveCheck label="계정 할당" checked={A.on} onChange={(on) => saveA({ ...A, accs: A.accs || [], on, chiefs: on && A.promoters + A.chiefs < 1 ? 1 : A.chiefs }, b.name + (on ? ' 계정 할당을 켰습니다 · 지국장 월급 계산에 자동 반영' : ' 계정 할당을 껐습니다 (지국장 1명 기준)'))} />
          {A.on && <span className="alloc-nums">
            <span className="note">홍보팀장</span><input className="in num" type="number" min="0" max="50" step="1" aria-label={b.name + ' 홍보팀장 계정 수'} value={np} onChange={(e) => setNp(e.target.value)} onBlur={() => { if (String(A.promoters) !== np) saveNums(); }} />
            <span className="note">계정 · 지국장</span><input className="in num" type="number" min="0" max="50" step="1" aria-label={b.name + ' 지국장 계정 수'} value={nc} onChange={(e) => setNc(e.target.value)} onBlur={() => { if (String(A.chiefs) !== nc) saveNums(); }} />
            <span className="note">계정 · 구간 여유 인정액</span><span onBlur={() => { if ((A.cap || 0) !== (cap || 0)) saveNums(); }}><MoneyInput value={cap} label={b.name + ' 구간 여유 인정액'} onChange={setCap} /></span>
            <span className="note">(예: 150만 → 1,500만 구간은 1,650만 이상일 때만 달성으로 보고 나눔)</span>
          </span>}
          {A.on && A.promoters > 0 && <div className="alloc-settle">
            <span className="note">{'신입 정착수당 시작 월급월 (신입이 아니면 비움 · 시작월부터 6개월 안에 최대 ' + sMax + '회)'}</span>
            {Array.from({ length: A.promoters }, (_, k) => <AccStart key={k} label={b.name + ' 홍보팀장 계정 ' + (k + 1) + ' 정착수당 시작 월급월'} title={'홍보팀장 계정 ' + (k + 1)} value={((A.accs || [])[k] || {}).start || ''} onPick={(v) => setStart(k, v)} />)}
          </div>}
        </div>
      </div>
      <LiveCheck label="사용" checked={b.active !== false} onChange={(on) => saveBranches(list.map((x) => (x.id === b.id ? { ...x, active: on } : x)), b.name + (on ? ' 다시 사용합니다' : ' 사용 안 함 (등록 목록에서 숨김)'))} />
      <ConfirmBtn kind="sm" disabled={nS > 0} title={nS ? '매출이 있어 삭제할 수 없습니다' : undefined} onFirst={() => setSt(b.name + ' 을(를) 삭제하려면 한 번 더 누르세요', 'warn')} onConfirm={() => saveBranches(list.filter((x) => x.id !== b.id), b.name + ' 을(를) 삭제했습니다')}>삭제</ConfirmBtn>
    </div>
  );
}
function AccStart({ label, title, value, onPick }) {
  const [v, setV] = useLive(value);
  return <label className="alloc-st"><span className="note">{title}</span><input className="in" type="month" aria-label={label} value={v} onChange={(e) => { setV(e.target.value); onPick(e.target.value); }} /><Btn kind="sm" onClick={(e) => { e.preventDefault(); if (!v) return; setV(''); onPick(''); }}>비움</Btn></label>;
}
