// 홍보팀장 월급 계산 · 연도 선택 + 12개월 칸 · 월 입력값(관리자) · 내 수당 기준
import { useState } from 'react';
import { D, save, isAdmin, products, vendorName, categoryName, qtyOf } from '../lib/store.js';
import { won, pad, nowYm, errText } from '../lib/ui.js';
import { calc, effective, inputOf, scopePeople, person, freeOnP, needsInput, condText, periodText, typeName, baseName, needsBasis, tierLabel, pct, baseValue } from '../lib/pay.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, MoneyInput, PageHead, Status, useStatus } from '../components/ui.jsx';
import { Stat } from '../components/charts.jsx';

const RULE_KDC = 'KDC 매출에 따른 수당(상품·장려·정착 등)은 매출 월 + 2개월 뒤에 지급';
const RULE_FREE = '자율학기제 매출만 매출 월 + 1개월 뒤에 지급';
const F = ({ l, children }) => <label className="field inline"><span className="field-l">{l}</span>{children}</label>;

export default function PayCalc() {
  useData();
  const [ym, setYm] = useState(nowYm()); const [who0, setWho] = useState(''); const [over, setOver] = useState(() => new Map()); const [guide0, setGuide] = useState(''); const [msg, setMsg] = useStatus();
  const PH = <PageHead eyebrow="홍보팀장" title="월급 계산" lede="매출 등록에 입력된 실적과 내게 적용된 수당 조건으로 월급을 자동 계산합니다." />;
  const ppl = scopePeople('promoter');
  if (!ppl.length) return <div className="page">{PH}<Card><h2>볼 수 있는 대상자가 없습니다</h2><p className="note">관리자에게 「권한 관리」에서 소속 지국 지정 또는 홍보팀장 연결을 요청하세요.</p></Card></div>;
  const who = ppl.some((p) => p.key === who0) ? who0 : ppl[0].key;
  const pick = (fn) => { fn(); setOver(new Map()); setMsg(''); };
  const p = person(who); const r = calc(p, ym, over); const showF = freeOnP(p) || r.pf.free_sales > 0;
  const Y = Number(ym.slice(0, 4)); const yNow = new Date().getFullYear();
  const ys = new Set([yNow - 1, yNow, yNow + 1, Y]); D.entries.forEach((e) => ys.add(Number(e.ym.slice(0, 4))));
  const byB = new Map(); ppl.forEach((x) => { if (!byB.has(x.bname)) byB.set(x.bname, []); byB.get(x.bname).push(x); });
  let yTot = 0, yNet = 0;
  const months = Array.from({ length: 12 }, (_, i) => { const k = Y + '-' + pad(i + 1); const rm = k === ym ? r : calc(p, k); yTot += rm.total; yNet += rm.net; return { k, m: i + 1, rm }; });
  const needIn = effective(p.key, p.role, ym).filter((e) => (e.src === 'default' || e.src === 'person') && needsInput(e.it));
  const effAll = effective(p.key, p.role, ym).filter((e) => (e.src === 'default' || e.src === 'person') && (e.it.basis !== 'free_sales' || showF));
  const guide = effAll.some((e) => e.it.id === guide0) ? guide0 : (effAll[0] ? effAll[0].it.id : '');
  const saveInputs = async () => {
    if (!over.size) { setMsg('바뀐 값이 없습니다', 'warn'); return; }
    try { for (const [id, v] of over) await save('app_payroll_input_save', { p_person: p.key, p_ym: ym, p_item: id, p_qty: Number(v.qty) || 0, p_amount: Math.round(Number(v.amount) || 0), p_memo: '' }); setOver(new Map()); setMsg(p.name + ' ' + ym + ' 입력값을 저장했습니다', 'ok'); }
    catch (e) { setMsg(errText(e), 'bad'); }
  };
  const setOv = (id, v) => setOver((m) => { const x = new Map(m); x.set(id, v); return x; });
  return (
    <div className="page">{PH}
      <Card>
        <div className="toolbar">
          <F l="연도"><select className="in" aria-label="연도" value={String(Y)} onChange={(e) => pick(() => setYm(e.target.value + '-' + ym.slice(5)))}>{[...ys].sort((a, b) => b - a).map((y) => <option key={y} value={String(y)}>{y}년</option>)}</select></F>
          <F l="대상자"><select className="in" aria-label="대상자" value={who} disabled={ppl.length <= 1} onChange={(e) => pick(() => setWho(e.target.value))}>{[...byB.entries()].map(([bn, l]) => <optgroup key={bn} label={bn}>{l.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</optgroup>)}</select></F>
        </div>
        <p className="note">{Y}년 월별 예상 실수령액 · 칸을 누르면 그 달 월급을 봅니다 (칸 아래: 지급되는 매출 월)</p>
        <div className="months" role="tablist" aria-label="월급 월 선택">{months.map(({ k, m, rm }) => (
          <button key={k} type="button" role="tab" aria-selected={k === ym} className={'month' + (rm.total > 0 ? ' on' : '') + (k === ym ? ' sel' : '')} onClick={() => { if (k !== ym) pick(() => setYm(k)); }}>
            <span className="m">{m}월 월급</span><span className="v">{rm.total > 0 ? won(rm.net) + '원' : '—'}</span><span className="m">{'KDC ' + Number(rm.pf.kdc_ym.slice(5)) + '월' + (showF ? ' · 자율 ' + Number(rm.pf.free_ym.slice(5)) + '월' : '') + ' 매출'}</span></button>))}</div>
        <div className="total">{Y}년 합계금액 {won(yTot)}원 · 예상 실수령 {won(yNet)}원</div>
      </Card>
      {r.closed && <p className="note info lock">{ym + ' 월급은 마감되었습니다 (확정 금액 · 마감 ' + r.closed.by + ' ' + r.closed.at + ') · 매출·수당 기준이 바뀌어도 이 금액으로 보입니다' + (isAdmin() ? ' · 고치려면 관리자 → 월급 마감에서 마감을 푸세요' : '')}</p>}
      <Card>
        <h2>{p.name + ' · ' + ym + ' 월급 정산 대상 실적'}</h2>
        <p className="note info">{'지급 기준 · ' + RULE_KDC + (showF ? ' · ' + RULE_FREE : '') + ' → ' + ym + ' 월급 = ' + r.pf.kdc_ym + ' KDC 매출' + (showF ? ' + ' + r.pf.free_ym + ' 자율학기제 매출' : '') + (r.pf.registered ? '' : ' · 정산 대상 매출이 아직 없습니다')}</p>
        <div className="stats">
          <Stat k={'KDC 판매가 (' + r.pf.kdc_ym + ' 매출)'} v={won(r.pf.kdc_sales)} u="원" sub={'판매 건수 ' + won(r.pf.cnt) + '건 · 인정액 ' + won(r.pf.kdc_rec) + '원'} />
          {showF && <><Stat k={'자율학기제 (' + r.pf.free_ym + ' 매출)'} v={won(r.pf.free_sales)} u="원" sub={won(r.pf.free_cnt) + '건 · 수당 ' + won(r.pf.free_comm) + '원'} /><Stat k="인정액 합계 (KDC + 자율학기제)" v={won(r.pf.rec)} u="원" /></>}
          <Stat k="KDC 상품 수당 합계" v={won(r.pf.comm)} u="원" />
        </div>
      </Card>
      {needIn.length > 0 && (
        <Card>
          <div className="card-h"><h2>이 달 입력값</h2>{isAdmin() && <Btn kind="primary" onClick={saveInputs}>입력값 저장</Btn>}</div>
          <p className="note">{isAdmin() ? '저장하면 이 사람의 이 달 월급 계산에 반영됩니다' : '관리자가 입력한 값입니다 · 숫자를 바꿔 보면 계산을 미리 볼 수 있지만 저장되지 않습니다'}</p>
          <Status s={msg} />
          <div className="form3">{needIn.map((e) => { const it = e.it; const x = inputOf(p.key, ym, it.id); const cur = over.get(it.id) || (x ? { qty: +x.qty || 0, amount: +x.amount || 0 } : { qty: 0, amount: 0 }); const lab = (it.input_label || it.name) + ' (' + it.name + ')';
            return it.calc_type === 'per_unit'
              ? <F key={it.id} l={lab}><span className="money"><input className="in money-in" type="number" min="0" aria-label={lab} value={String(cur.qty || 0)} onChange={(ev) => setOv(it.id, { ...cur, qty: Math.max(0, Number(ev.target.value) || 0) })} /><span className="money-u">{it.unit || '건'}</span></span></F>
              : <F key={it.id} l={lab}><MoneyInput value={cur.amount || 0} label={lab} onChange={(v) => setOv(it.id, { ...cur, amount: v || 0 })} /></F>; })}</div>
        </Card>)}
      <Card>
        <h2>월급 계산</h2><p className="note">적용된 수당 항목(직급 기본 + 사람별 조건)으로 자동 계산합니다 · 조건은 관리자 → 수당 등록에서 바꿉니다</p>
        <div className="tbl"><table className="items compact">
          <thead><tr><th>수당 항목</th><th>조건</th><th>계산</th><th>금액</th></tr></thead>
          <tbody>{r.lines.map((l, i) => <tr key={i}><td>{l.it.name}</td><td className="note">{(l.e.src === 'person' ? '개인 · ' : '기본 · ') + condText(l.e) + (l.e.row ? ' (' + periodText(l.e.row) + ')' : '')}</td><td className="note">{l.how}</td><td className="num">{won(l.amount)}원</td></tr>)}
            {!r.lines.length && <tr><td className="note" colSpan={4}>적용된 수당 항목이 없습니다</td></tr>}</tbody>
          <tfoot>{[['합계금액', won(r.total) + '원'], ['소득세 (3%)', '−' + won(r.tax) + '원'], ['주민세 (0.3%)', '−' + won(r.local) + '원'], ['적립금 RDS (5%)', '−' + won(r.rds) + '원'], ['공제합계', '−' + won(r.ded) + '원']].map(([k, v]) => <tr key={k}><td colSpan={3}>{k}</td><td className="num">{v}</td></tr>)}</tfoot>
        </table></div>
        <div className="net"><span>예상 실수령액</span><b>{won(r.net)}원</b></div>
      </Card>
      <Card>
        <h2>내 수당 기준</h2>
        <div className="chips">{effAll.map((e) => <button key={e.it.id} type="button" className="chip has" aria-selected={guide === e.it.id} onClick={() => setGuide(e.it.id)}>{e.it.name + (e.src === 'person' ? ' · 개인' : '')}</button>)}</div>
        <p className="note">{ym + ' 기준 · ' + p.name + '에게 적용된 수당 항목의 조건입니다 · 조건 변경은 관리자에게 요청하세요'}</p>
        <Guide e={effAll.find((x) => x.it.id === guide)} r={r} p={p} ym={ym} over={over} />
      </Card>
    </div>
  );
}

function Guide({ e, r, p, ym, over }) {
  if (!e) return <p className="note empty">적용된 수당 항목이 없습니다</p>;
  const it = e.it; const line = r.lines.find((l) => l.it.id === it.id);
  const kv = [['계산 방식', typeName(it.calc_type) + (needsBasis(it.calc_type) ? ' · ' + (it.basis === 'recognized_dues' ? '인정액 + ' + (it.input_label || '입력액') : baseName(it.basis)) : '')]];
  if (it.max_times) kv.push(['지급 횟수', '조건 기간 안 최대 ' + it.max_times + '회']);
  kv.push(['이번 달 금액', won(line ? line.amount : 0) + '원']); if (line) kv.push(['계산', line.how]);
  let extra = null;
  if (it.calc_type === 'tier') {
    const iv = over.get(it.id) || inputOf(p.key, ym, it.id); const bv = baseValue(it, r.pf, iv ? { amount: +iv.amount || 0 } : null);
    const ts = (e.tiers || []).filter((x) => x && x.base != null).slice().sort((a, b) => a.base - b.base); const hit = ts.filter((x) => bv >= Number(x.base)).pop(); const next = ts.find((x) => bv < Number(x.base));
    extra = (<>
      <div className="tbl"><table className="items compact"><thead><tr><th>실적 구간</th><th>지급</th><th>달성</th></tr></thead>
        <tbody>{ts.map((x, i) => { const on = x === hit; return <tr key={i} className={on ? 'on' : ''}><td>{tierLabel(Number(x.base))}</td><td>{x.rate != null && x.rate !== '' ? '기준 금액의 ' + pct(x.rate) : won(Number(x.amount) || 0) + '원'}</td><td>{on ? '✓ 달성' : bv >= Number(x.base) ? '통과' : ''}</td></tr>; })}</tbody></table></div>
      <p className="note">{'이번 달 기준 금액 ' + won(bv) + '원' + (next ? ' · 다음 구간(' + tierLabel(Number(next.base)) + ')까지 ' + won(Number(next.base) - bv) + '원 남음' : ' · 최고 구간')}</p>
    </>);
  } else if (it.calc_type === 'product') {
    const q = new Map(); (r.pf.kdcEntries || []).forEach((x) => qtyOf(x).forEach((n, pid) => q.set(pid, (q.get(pid) || 0) + n)));
    const vn = vendorName(), cn = categoryName();
    extra = (<>
      {e.customRate && <p className="note">{'개인 수당율 ' + pct(e.rate) + ' · 상품별 수당 대신 「인정액 × ' + pct(e.rate) + '」로 계산됩니다'}</p>}
      <div className="tbl"><table className="items"><thead><tr>{['구분', '업체', '강의명', '판매가', '인정액', '1건 수당', '수당율', 'KDC 건수', '수당 소계'].map((x) => <th key={x}>{x}</th>)}</tr></thead>
        <tbody>{products().map((x) => { const n = q.get(x.id) || 0; return <tr key={x.id} className={n ? 'on' : ''}><td>{cn.get(x.categoryId) || ''}</td><td>{vn.get(x.vendorId) || ''}</td><td className="title">{x['강의명'] || ''}</td><td className="num">{won(x['판매가'] || 0)}</td><td className="num">{won(x['인정액'] || 0)}</td><td className="num">{won(x['수당'] || 0)}</td><td className="num">{pct(x['수당율'])}</td><td className="num">{n ? won(n) + '건' : ''}</td><td className="num">{n ? won(n * (x['수당'] || 0)) : ''}</td></tr>; })}</tbody></table></div>
    </>);
  } else if (it.calc_type === 'per_unit') extra = <p className="note">{(it.input_label || '건수') + ' 1' + (it.unit || '건') + '당 ' + won(e.value) + '원' + (e.customValue ? ' (개인 금액)' : '')}</p>;
  else if (it.calc_type === 'rate') extra = <p className="note">{baseName(it.basis) + ' × ' + pct(e.rate) + (e.customRate ? ' (개인 비율)' : '')}</p>;
  else if (it.calc_type === 'fixed') extra = <p className="note">{'매월 ' + won(e.value) + '원' + (e.customValue ? ' (개인 금액)' : '')}</p>;
  else if (it.calc_type === 'input') { const iv = over.get(it.id) || inputOf(p.key, ym, it.id); extra = <p className="note">{'매월 관리자가 입력하는 금액입니다 · 이번 달 ' + won((iv && iv.amount) || 0) + '원'}</p>; }
  return (<>
    <dl className="kv">{kv.map(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + 'v'}>{v}</dd>])}</dl>
    {it.memo && <p className="note">{it.memo}</p>}
    {extra}
  </>);
}
