// 내 계정: 정보 확인 · 비밀번호 변경
import { useState } from 'react';
import { sb, D, bname, pname } from '../lib/store.js';
import { errText, busy } from '../lib/ui.js';
import { Card, Field, Status, useStatus } from '../components/ui.jsx';
import { useData } from '../hooks/useData.js';

export default function Account() {
  useData();
  const role = (D.roles.find((r) => r.id === D.me.role) || {}).name || '';
  const [p1, setP1] = useState(''); const [p2, setP2] = useState(''); const [st, setSt] = useStatus(); const [going, setGoing] = useState(false);
  const rows = [['이메일', D.me.email], ['역할', role], ['소속 지국', D.me.branch ? bname(D.me.branch) : '전체']];
  if (D.me.promoter) rows.push(['연결된 홍보팀장', pname(D.me.promoter)]);
  rows.push(['자율학기제', D.me.free || D.me.admin ? '사용' : '사용 안 함']);
  const submit = async (e) => {
    e.preventDefault();
    if (p1.length < 8) { setSt('8자 이상 입력해 주세요', 'bad'); return; }
    if (p1 !== p2) { setSt('두 비밀번호가 다릅니다', 'bad'); return; }
    setGoing(true);
    try { await busy.run(async () => { const { error } = await sb.auth.updateUser({ password: p1 }); if (error) throw error; }); setP1(''); setP2(''); setSt('비밀번호를 바꿨습니다', 'ok'); }
    catch (err) { setSt(errText(err), 'bad'); } finally { setGoing(false); }
  };
  return (
    <div className="page">
      <Card>
        <div className="eyebrow">내 계정</div><h1>{D.me.name || D.me.email}</h1>
        <dl className="kv">{rows.map(([k, v]) => [<dt key={k + 't'}>{k}</dt>, <dd key={k + 'd'}>{v || '—'}</dd>])}</dl>
        <p className="note">역할·소속은 관리자가 정합니다. 바꿔야 하면 관리자에게 요청하세요.</p>
      </Card>
      <Card>
        <h2>비밀번호 변경</h2><p className="note">처음 받은 비밀번호는 바꿔 두세요. 8자 이상.</p>
        <form className="stack narrow" onSubmit={submit} noValidate>
          <Field label="새 비밀번호"><input className="in" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></Field>
          <Field label="한 번 더"><input className="in" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></Field>
          <button type="submit" className="btn primary" disabled={going}>비밀번호 바꾸기</button>
          <Status s={st} />
        </form>
      </Card>
    </div>
  );
}
