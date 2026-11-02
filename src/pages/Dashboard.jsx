// 대시보드: 볼 수 있는 범위의 지국별 월 매출 한눈에 (KDC + 자율학기제)
import { useState } from 'react';
import { D, pmap, vendorName, categoryName, scope, qtyOf, personFree } from '../lib/store.js';
import { won, pad, sum } from '../lib/ui.js';
import { useData } from '../hooks/useData.js';
import { Card, Field, PageHead } from '../components/ui.jsx';
import { Bars, Legend, Rank, Stat, Delta, MonthChips, COLORS } from '../components/charts.jsx';

const branchRows = () => {
  const m = new Map();
  const add = (b, ym, k, a, c) => { const key = b + '|' + ym; const x = m.get(key) || { branch_id: b, ym, kdc: 0, free: 0, cnt: 0 }; x[k] += a; x.cnt += c; m.set(key, x); };
  D.entries.forEach((e) => add(e.branch_id, e.ym, 'kdc', e.amount, e.cnt));
  D.free.forEach((f) => add(f.branch_id, f.ym, 'free', f.amount, 0));
  return Array.from(m.values()).map((x) => ({ ...x, amount: x.kdc + x.free }));
};

export default function Dashboard() {
  useData();
  const [year, setYear] = useState(String(new Date().getFullYear())); const [per0, setPer] = useState(null); const [metric, setMetric] = useState('qty');
  const rows = branchRows();
  const years = new Set(rows.map((r) => r.ym.slice(0, 4))); years.add(String(new Date().getFullYear()));
  const ys = Array.from(years).sort().reverse(); const Y = ys.includes(year) ? year : ys[0];
  const yr = rows.filter((r) => r.ym.startsWith(Y));
  const per = per0 || yr.map((r) => r.ym.slice(5)).sort().pop() || pad(new Date().getMonth() + 1);
  const isY = per === 'year'; const label = isY ? Y + '년 연간' : Y + '년 ' + Number(per) + '월';
  const pr = isY ? yr : yr.filter((r) => r.ym.slice(5) === per);
  const tot = sum(pr, 'amount'); const prev = !isY && Number(per) > 1 ? sum(yr.filter((r) => r.ym.slice(5) === pad(Number(per) - 1)), 'amount') : 0;
  const act = D.branches.filter((b) => b.active !== false); const reg = new Set(pr.map((r) => r.branch_id));
  const sc = scope(); const freeShown = D.free.length > 0 || D.promoters.some((p) => personFree(p.id));
  const ser = freeShown ? [{ key: 'kdc', label: 'KDC', color: COLORS[0] }, { key: 'free', label: '자율학기제', color: COLORS[1] }] : [{ key: 'kdc', label: 'KDC', color: COLORS[0] }];
  const md = Array.from({ length: 12 }, (_, i) => { const m = pad(i + 1); const l = yr.filter((r) => r.ym.slice(5) === m); return { m, kdc: sum(l, 'kdc'), free: sum(l, 'free') }; });
  const bl = D.branches.filter((b) => b.active !== false || pr.some((r) => r.branch_id === b.id)).filter((b) => sc === 'all' || pr.some((r) => r.branch_id === b.id) || b.id === (D.me.branch || ''));
  const blist = bl.map((b) => { const l = pr.filter((r) => r.branch_id === b.id); return { key: b.id, label: b.name, value: sum(l, 'amount'), sub: won(sum(l, 'cnt')) + '건' + (sum(l, 'free') ? ' · 자율학기제 ' + won(sum(l, 'free')) + '원' : '') }; }).sort((a, b) => b.value - a.value);
  // 상품 판매 순위
  const pm = pmap(), vn = vendorName(), cn = categoryName(); const by = new Map();
  D.entries.filter((e) => e.ym.startsWith(Y) && (isY || e.ym.slice(5) === per)).forEach((e) => qtyOf(e).forEach((n, pid) => {
    if (!n) return; const p = pm.get(pid) || {}; const x = by.get(pid) || { title: p['강의명'] || pid, cat: cn.get(p.categoryId) || '기타', ven: vn.get(p.vendorId) || '기타', qty: 0, amount: 0, commission: 0 };
    x.qty += n; x.amount += n * (p['판매가'] || 0); x.commission += n * (p['수당'] || 0); by.set(pid, x);
  }));
  const plist = Array.from(by.values()).sort((a, b) => b[metric] - a[metric]); const ptot = sum(plist, metric);
  return (
    <div className="page">
      <PageHead title="대시보드" lede={sc === 'all' ? '지국별 월 매출을 한눈에 봅니다. 월을 누르면 그 달 기준으로 바뀝니다.' : sc === 'branch' ? '소속 지국의 월 매출입니다.' : '본인 매출입니다.'} />
      <Card>
        <div className="toolbar"><Field label="연도" className="inline"><select className="in" aria-label="연도" value={Y} onChange={(e) => { setYear(e.target.value); setPer(null); }}>{ys.map((y) => <option key={y} value={y}>{y}년</option>)}</select></Field></div>
        <MonthChips sel={per} has={(v) => (v === 'year' ? yr.length > 0 : yr.some((r) => r.ym.slice(5) === v))} onPick={setPer} />
        <div className="stats">
          <Stat k={label + ' 매출'} v={won(tot)} u="원" sub={<Delta cur={tot} prev={prev} />} />
          {freeShown && <><Stat k="KDC" v={won(sum(pr, 'kdc'))} u="원" /><Stat k="자율학기제" v={won(sum(pr, 'free'))} u="원" /></>}
          <Stat k="KDC 판매 건수" v={won(sum(pr, 'cnt'))} u="건" />
          {sc === 'all' && <><Stat k={isY ? '매출을 등록한 지국' : '등록 지국'} v={reg.size + (isY ? '' : ' / ' + act.length)} u="곳" /><Stat k="지국 평균" v={won(reg.size ? Math.round(tot / reg.size) : 0)} u="원" /></>}
        </div>
      </Card>
      <section className="grid2">
        <div className="card"><h2>{Y}년 월별 매출</h2><Legend items={ser.map((s) => [s.color, s.label])} /><Bars data={md} series={ser} selected={isY ? null : per} onPick={setPer} /><p className="note">막대를 누르면 그 달을 봅니다 · 단위: 원</p></div>
        <div className="card"><h2>지국별 매출 · {label}</h2>{blist.length ? <Rank list={blist} total={tot} /> : <p className="note empty">표시할 지국이 없습니다</p>}</div>
      </section>
      <Card>
        <div className="card-h"><h2>상품 판매 순위 · {label}</h2>
          <div className="seg">{[['qty', '건수'], ['amount', '매출액']].map(([v, n]) => <button key={v} type="button" className="btn sm" aria-pressed={metric === v} onClick={() => setMetric(v)}>{n}</button>)}</div></div>
        <p className="note">KDC 매출 등록의 상품별 건수 기준 · {metric === 'qty' ? '판매 건수' : '매출액'} 순</p>
        {!plist.length ? <p className="note empty">이 기간에 상품별 건수가 입력된 매출이 없습니다</p> : <>
          <Rank list={plist.slice(0, 10).map((x) => ({ key: x.title, label: x.title, value: x[metric], sub: x.cat + ' · ' + x.ven + ' · ' + (metric === 'qty' ? won(x.amount) + '원' : won(x.qty) + '건') + ' · 수당 ' + won(x.commission) + '원' }))} total={ptot} fmt={metric === 'qty' ? (v) => won(v) + '건' : undefined} />
          {plist.length > 10 && <p className="note">그 외 {plist.length - 10}개 상품</p>}</>}
      </Card>
    </div>
  );
}
