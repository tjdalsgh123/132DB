// 관리자 · 수당 관리 → 기타 상품 관리: 상품군 · 상품표 (판매가 · 인정액 · 판매수당율)
// 상품 1개 수당 = 인정액 × 판매수당율 · 이미 등록한 판매는 등록 때 값 그대로 (여기서 바꿔도 지난 매출은 안 바뀜)
import { useReducer, useRef, useState } from 'react';
import { D, save } from '../lib/store.js';
import { won, MSG, errText } from '../lib/ui.js';
import { Btn, MoneyInput, Status, useStatus } from '../components/ui.jsx';

const clone = (v) => JSON.parse(JSON.stringify(v));
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

export default function EtcAdmin() {
  const S = useRef({ g: null, p: null, sig: '', dirty: false }); const [, force] = useReducer((x) => x + 1, 0);
  const [st, setSt] = useStatus(); const [bad, setBad] = useState(new Set()); const [gsel, setGsel] = useState(''); const [q, setQ] = useState(''); const [ver, setVer] = useState(0);
  const load = (f) => { const sig = JSON.stringify([D.etcGroups, D.etcProducts]); if (f || (!S.current.dirty && sig !== S.current.sig)) { S.current.g = clone(D.etcGroups || []); S.current.p = clone(D.etcProducts || []); S.current.sig = sig; S.current.dirty = false; } };
  load(false);
  const G = S.current.g, P = S.current.p;
  const dirty = () => { S.current.dirty = true; setSt('저장하지 않은 변경이 있습니다', 'warn'); force(); };
  const redraw = () => setVer((v) => v + 1);
  const cur = G.some((g) => g.id === gsel) ? gsel : (G[0] || {}).id || '';
  const list = P.filter((p) => p.group === cur && (!q || p.title.toLowerCase().includes(q.toLowerCase())));
  const doSave = async () => {
    const need = []; G.forEach((g, i) => { if (!String(g.name || '').trim()) need.push('g' + i); }); P.forEach((p) => { if (!String(p.title || '').trim()) need.push('p' + p.id); });
    if (need.length) { setBad(new Set(need)); setSt(MSG + ' · 상품군 이름·상품명', 'bad'); return; }
    setBad(new Set());
    try { const r = await save('app_etc_catalog_save', { p_groups: G.map((g) => ({ id: g.id, name: g.name.trim(), active: g.active !== false, memo: g.memo || '' })), p_products: P.map((p) => ({ id: p.id, group: p.group, title: p.title.trim(), list: p.list || 0, price: p.price || 0, rec: p.rec || 0, rate: Number(p.rate) || 0, memo: p.memo || '', active: p.active !== false })) });
      S.current.dirty = false; load(true); redraw(); setSt('기타 상품표를 저장했습니다 · 상품군 ' + r.groups + '개 · 상품 ' + r.products + '개 · 새로 등록하는 판매부터 적용', 'ok'); }
    catch (e) { setSt(errText(e), 'bad'); }
  };
  return (
    <div className="stack" key={ver}>
      <section className="card">
        <div className="card-h"><h2>{'기타 상품 관리 (상품군 ' + G.length + '개 · 상품 ' + P.length + '개)'}</h2>
          <div className="acts"><Btn onClick={() => { load(true); setBad(new Set()); setSt(''); redraw(); }}>되돌리기</Btn><Btn kind="primary" onClick={doSave}>저장</Btn></div></div>
        <p className="note">홍보팀장·지국장·총국장이 「기타 상품 판매 등록」에서 고르는 상품입니다 · 수당 = 인정액 × 판매수당율 · 매출 월 + 1개월 월급에 지급 · 지국장 월급은 지국장 수당관리의 「기타 판매 수당·인센티브」(그 밖의 구분)로 들어갑니다 · 이미 등록한 판매는 등록 때 값 그대로</p>
        <Status s={st} />
        <h3>상품군</h3>
        {G.map((g, i) => (
          <div className="acts" key={g.id}>
            <Btn kind="sm icon" aria-label="위로" disabled={i === 0} onClick={() => { [G[i - 1], G[i]] = [G[i], G[i - 1]]; dirty(); }}>▲</Btn>
            <Btn kind="sm icon" aria-label="아래로" disabled={i === G.length - 1} onClick={() => { [G[i + 1], G[i]] = [G[i], G[i + 1]]; dirty(); }}>▼</Btn>
            <input className={'in role-name' + (bad.has('g' + i) ? ' invalid' : '')} type="text" maxLength={40} aria-label="상품군 이름" value={g.name} onChange={(e) => { g.name = e.target.value; dirty(); }} />
            <input className="in" type="text" maxLength={200} placeholder="설명" aria-label="상품군 설명" value={g.memo || ''} onChange={(e) => { g.memo = e.target.value; dirty(); }} />
            <label className="check"><input type="checkbox" checked={g.active !== false} onChange={(e) => { g.active = e.target.checked; dirty(); }} /> 사용</label>
            <span className="badge">{P.filter((p) => p.group === g.id).length + '개'}</span>
            <Btn kind="sm" disabled={P.some((p) => p.group === g.id)} title="상품이 있는 상품군은 뺄 수 없습니다" onClick={() => { G.splice(i, 1); dirty(); }}>빼기</Btn>
          </div>))}
        <Btn kind="sm" onClick={() => { G.push({ id: uid('g_'), name: '', memo: '', active: true }); dirty(); }}>+ 상품군</Btn>
      </section>
      <section className="card">
        <div className="card-h"><h2>상품</h2>
          <div className="acts">
            <select className="in" aria-label="상품군 고르기" value={cur} onChange={(e) => setGsel(e.target.value)}>{G.map((g) => <option key={g.id} value={g.id}>{(g.name || '(이름 없음)') + ' (' + P.filter((p) => p.group === g.id).length + ')'}</option>)}</select>
            <input className="in" type="search" placeholder="상품명 검색" aria-label="상품명 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            <Btn kind="primary" disabled={!cur} onClick={() => { P.push({ id: uid('e_'), group: cur, title: '', list: 0, price: 0, rec: 0, rate: 0, memo: '', active: true }); dirty(); }}>+ 상품</Btn>
          </div></div>
        <div className="tbl"><table className="items etc-admin">
          <thead><tr>{['상품명', '수강료·소비자가', '판매가', '인정액', '판매수당율', '1개 수당', '비고', '사용', ''].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>
            {!list.length && <tr><td className="note" colSpan={9}>상품이 없습니다 · 「+ 상품」을 눌러 넣으세요</td></tr>}
            {list.map((p) => (
              <tr key={p.id} className={p.active === false ? 'off' : 'on'}>
                <td><input className={'in' + (bad.has('p' + p.id) ? ' invalid' : '')} type="text" maxLength={80} aria-label="상품명" value={p.title} onChange={(e) => { p.title = e.target.value; dirty(); }} /></td>
                <td><MoneyInput value={p.list} label={p.title + ' 수강료'} onChange={(v) => { p.list = v || 0; dirty(); }} /></td>
                <td><MoneyInput value={p.price} label={p.title + ' 판매가'} onChange={(v) => { p.price = v || 0; dirty(); }} /></td>
                <td><MoneyInput value={p.rec} label={p.title + ' 인정액'} onChange={(v) => { p.rec = v || 0; dirty(); }} /></td>
                <td><span className="nowrap"><input className="in num rate-in" type="number" min="0" max="100" step="0.1" aria-label={p.title + ' 판매수당율'} defaultValue={String(Math.round((Number(p.rate) || 0) * 100000) / 1000)} onChange={(e) => { p.rate = (Number(e.target.value) || 0) / 100; dirty(); }} /> %</span></td>
                <td className="num">{won(Math.round((p.rec || 0) * (Number(p.rate) || 0)))}</td>
                <td><input className="in" type="text" maxLength={200} aria-label={p.title + ' 비고'} value={p.memo || ''} onChange={(e) => { p.memo = e.target.value; dirty(); }} /></td>
                <td><input type="checkbox" aria-label={p.title + ' 사용'} checked={p.active !== false} onChange={(e) => { p.active = e.target.checked; dirty(); }} /></td>
                <td><Btn kind="icon" aria-label={p.title + ' 빼기'} onClick={() => { P.splice(P.indexOf(p), 1); dirty(); }}>×</Btn></td>
              </tr>))}
          </tbody>
        </table></div>
      </section>
    </div>
  );
}
