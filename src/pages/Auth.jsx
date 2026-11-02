// 로그인 · 비밀번호 재설정(메일 링크) · 첫 로그인 비밀번호 변경 · 계정 오류
import { useEffect, useRef, useState } from 'react';
import { sb } from '../lib/store.js';
import { errText, MSG } from '../lib/ui.js';
import { Brand, Btn, Field, Status, useStatus } from '../components/ui.jsx';

const Frame = ({ children }) => <main className="login"><section className="card login-card"><Brand large />{children}</section></main>;

export function LoginView({ msg, onDone }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [st, setSt] = useStatus(); const [busy, setBusy] = useState(false);
  const eRef = useRef(null); const pRef = useRef(null);
  useEffect(() => { if (msg) setSt(msg[0], msg[1]); eRef.current && eRef.current.focus(); }, [msg, setSt]);
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !pw) { setSt(MSG, 'bad'); (email.trim() ? pRef : eRef).current.focus(); return; }
    setBusy(true); setSt('로그인 중…');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pw });
    setBusy(false);
    if (error) { setSt(errText(error), 'bad'); return; }
    setSt(''); onDone();
  };
  const forgot = async () => {
    if (!email.trim()) { setSt('이메일을 먼저 입력해 주세요', 'warn'); eRef.current.focus(); return; }
    setSt('재설정 메일을 보내는 중…');
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + '/' });
    setSt(error ? errText(error) : email.trim() + ' 로 비밀번호 재설정 메일을 보냈습니다 · 메일의 링크를 눌러 새 비밀번호를 정하세요', error ? 'bad' : 'ok');
  };
  return (
    <Frame>
      <h1>로그인</h1><p className="note">관리자에게 받은 이메일과 비밀번호로 로그인하세요.</p>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="이메일"><input ref={eRef} className="in" type="email" autoComplete="username" required placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="비밀번호"><input ref={pRef} className="in" type="password" autoComplete="current-password" required value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <button type="submit" className="btn primary block" disabled={busy}>로그인</button>
        <Status s={st} />
      </form>
      <Btn kind="link" onClick={forgot}>비밀번호를 잊었어요</Btn>
    </Frame>
  );
}

export function RecoveryView({ forced, onDone, onLogout }) {
  const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [st, setSt] = useStatus(); const [busy, setBusy] = useState(false);
  const r1 = useRef(null); const r2 = useRef(null);
  useEffect(() => { r1.current && r1.current.focus(); }, []);
  const submit = async (e) => {
    e.preventDefault();
    if (p1.length < 8) { setSt('8자 이상 입력해 주세요', 'bad'); r1.current.focus(); return; }
    if (p1 !== p2) { setSt('두 비밀번호가 다릅니다', 'bad'); r2.current.focus(); return; }
    setBusy(true); const { error } = await sb.auth.updateUser({ password: p1, data: { must_change: false } }); setBusy(false);
    if (error) { setSt(errText(error), 'bad'); return; }
    history.replaceState(null, '', location.pathname + (forced ? location.hash : '')); onDone();
  };
  return (
    <Frame>
      <h1>{forced ? '비밀번호를 바꿔 주세요' : '새 비밀번호'}</h1>
      <p className="note">{forced ? '관리자가 정해 준 임시 비밀번호로 로그인했습니다. 본인만 아는 새 비밀번호(8자 이상)로 바꾼 뒤 사용할 수 있습니다.' : '8자 이상으로 정해 주세요.'}</p>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="새 비밀번호"><input ref={r1} className="in" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
        <Field label="한 번 더"><input ref={r2} className="in" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
        <button type="submit" className="btn primary block" disabled={busy}>비밀번호 바꾸기</button>
        <Status s={st} />
      </form>
      {forced && <Btn kind="link" onClick={onLogout}>로그아웃</Btn>}
    </Frame>
  );
}

export function ErrorView({ error, onRetry, onLogout }) {
  return (
    <Frame>
      <h1>사용할 수 없는 계정입니다</h1><p>{errText(error)}</p>
      <Btn onClick={onRetry}>다시 시도</Btn><Btn kind="link" onClick={onLogout}>로그아웃</Btn>
    </Frame>
  );
}
