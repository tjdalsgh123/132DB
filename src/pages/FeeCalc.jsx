// 수당계산기: 상품별 건수를 넣으면 수당·장려·정착수당과 공제 후 실지급액 계산 (저장 안 함)
import { useState } from 'react';
import { D, products, vendorName, categoryName } from '../lib/store.js';
import { won } from '../lib/ui.js';
import { useData } from '../hooks/useData.js';
import { Btn, MoneyInput, PageHead } from '../components/ui.jsx';

const RATE_TAX = 0.03, RATE_LOCAL = 0.003, RATE_RDS = 0.05;
const rdown10 = (n) => Math.floor(n / 10) * 10;
const TOP_BASE = 25000000, TOP_RATE = 0.13;
const tierLabel = (b) => (b == null ? '' : b % 10000 === 0 ? won(b / 10000) + '만원 이상' : won(b) + '원 이상');
const tiers = (l) => (l || []).filter((r) => r && r['기준액'] != null).slice().sort((a, b) => a['기준액'] - b['기준액']);

export default function FeeCalc() {
  useData();
  const [counts, setCounts] = useState(() => new Map()); const [bonus, setBonus] = useState(0); const [settle, setSettle] = useState(false);
  const dues = 0;
  let n = 0, sales = 0, rec = 0, comm = 0;
  products().forEach((p) => { const c = counts.get(p.id) || 0; n += c; sales += c * (p['판매가'] || 0); rec += c * (p['인정액'] || 0); comm += c * (p['수당'] || 0); });
  let incTier = null, incAmt = 0; const inc = tiers(D.fee.incentive), set = tiers(D.fee.settle);
  if (rec >= TOP_BASE) { incTier = '2,500만원 이상 (인정액의 13%)'; incAmt = Math.round(rec * TOP_RATE); }
  else { const t = inc.filter((r) => rec >= r['기준액']).pop(); if (t) { incTier = tierLabel(t['기준액']); incAmt = t['수당'] || 0; } }
  let setTier = null, setAmt = 0;
  if (settle) { const t = set.filter((r) => rec + dues >= r['기준액']).pop(); if (t) { setTier = tierLabel(t['기준액']); setAmt = t['수당'] || 0; } }
  const total = comm + incAmt + setAmt + bonus;
  const tax = rdown10(total * RATE_TAX), local = rdown10(total * RATE_LOCAL), rds = rdown10(total * RATE_RDS); const ded = tax + local + rds;
  const lines = [['판매 건수', won(n) + '건'], ['판매가 합계', won(sales) + '원'], ['인정액 합계', won(rec) + '원'], ['수당', won(comm) + '원', 'sep'], ['장려수당' + (incTier ? ' · ' + incTier : ''), won(incAmt) + '원'],
    ['정착수당' + (settle ? (setTier ? ' · ' + setTier : ' · 기준 미달') : ' · 대상 아님'), won(setAmt) + '원'], ['시책금액 (직접 입력)', won(bonus) + '원'], ['합계금액', won(total) + '원'],
    ['소득세 (3%)', '−' + won(tax) + '원', 'sep'], ['주민세 (0.3%)', '−' + won(local) + '원'], ['적립금 RDS (5%)', '−' + won(rds) + '원'], ['공제합계', '−' + won(ded) + '원'], ['실지급액', won(total - ded) + '원', 'sep final']];
  const TierT = ({ list, hit, name }) => (
    <div className="tbl"><table className="items compact"><thead><tr><th>{name}</th><th>수당</th></tr></thead>
      <tbody>{tiers(list).map((x) => { const lb = tierLabel(x['기준액']); return <tr key={x['기준액']} className={lb === hit ? 'on' : ''}><td>{lb + (lb === hit ? ' · 해당' : '')}</td><td className="num">{x['수당'] == null ? '' : won(x['수당']) + '원'}</td></tr>; })}</tbody></table></div>
  );
  const vn = vendorName(), cn = categoryName();
  return (
    <div className="page">
      <PageHead title="KDC 수당 계산기" lede="상품별 건수를 입력하면 수당·장려수당·정착수당과 공제 후 실지급액을 바로 계산합니다. 상품 단가와 수당 기준은 「수당 관리」에서 등록한 내용을 씁니다." />
      <section className="grid2">
        <div className="card">
          <div className="card-h"><h2>예상 지급액</h2><Btn onClick={() => setCounts(new Map())}>건수 초기화</Btn></div>
          <p className="note">입력한 건수 기준 · 이 화면에서만 계산되며 저장되지 않습니다</p>
          <div className="form3">
            <label className="check"><input type="checkbox" id="fc-settle" checked={settle} onChange={(e) => setSettle(e.target.checked)} /> 정착수당 대상 (신규 등록 후 6개월 이내)</label>
            <label className="field"><span className="field-l">시책금액</span><MoneyInput value={bonus} label="시책금액" onChange={setBonus} /></label>
          </div>
          <dl className="sum">{lines.map(([k, v, c]) => [<dt key={k} className={c}>{k}</dt>, <dd key={k + 'v'} className={c}>{v}</dd>])}</dl>
        </div>
        <div className="card">
          <h2>장려수당 · 정착수당 기준</h2><p className="note">당월 신규 인정실적 기준 · 2,500만원 이상은 인정금액의 13%</p>
          <TierT list={D.fee.incentive} hit={incTier} name="장려수당 구간" /><TierT list={D.fee.settle} hit={setTier} name="정착수당 구간" />
        </div>
      </section>
      <section className="card">
        <h2>상품별 수당표</h2><p className="note">건수 칸에 숫자를 입력하세요 · 판매가·인정액·수당은 1건 기준</p>
        {!products().length ? <p className="note empty">등록된 상품이 없습니다 · 「수당 관리」에서 상품을 추가하세요</p> :
          <div className="tbl"><table className="items">
            <thead><tr>{['NO', '구분', '업체', '강의명', '판매가', '인정액', '수당', '수당율', '건수', '수당 합계'].map((x) => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>{products().map((p, i) => { const c = counts.get(p.id) || 0; return (
              <tr key={p.id} className={c ? 'on' : ''}>
                <td className="num">{i + 1}</td><td>{cn.get(p.categoryId) || ''}</td><td>{vn.get(p.vendorId) || ''}</td><td className="title">{p['강의명'] || ''}</td>
                <td className="num">{won(p['판매가'] || 0)}</td><td className="num">{won(p['인정액'] || 0)}</td><td className="num">{won(p['수당'] || 0)}</td><td className="num">{p['수당율'] == null ? '' : Math.round(p['수당율'] * 1000) / 10 + '%'}</td>
                <td className="num"><input className="in num cnt" type="number" min="0" inputMode="numeric" aria-label={(p['강의명'] || '') + ' 건수'} value={String(c)} onChange={(e) => { const v = Math.max(0, Math.floor(Number(e.target.value) || 0)); setCounts((m) => { const x = new Map(m); x.set(p.id, v); return x; }); }} /></td>
                <td className="num">{won(c * (p['수당'] || 0))}원</td>
              </tr>); })}</tbody>
          </table></div>}
      </section>
    </div>
  );
}
