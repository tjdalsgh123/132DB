// 총국장 대시보드: 모든 지국 비교 · 월별 추이 · 지국 상세 · 홍보팀장 순위 (매출 월 기준 · KDC + 자율학기제)
import { useRef, useState } from 'react';
import { D, chiefName, directName } from '../lib/store.js';
import { won, pad, sum } from '../lib/ui.js';
import { generalBranch } from '../lib/branchpay.js';
import { useData } from '../hooks/useData.js';
import { Card, Field, PageHead } from '../components/ui.jsx';
import { Bars, Legend, Rank, Stat, Delta, MonthChips, COLORS } from '../components/charts.jsx';

const pctTxt = (cur, prev) => { if (!prev) return cur ? '신규' : '–'; const d = (cur - prev) / prev; return (d >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d * 1000) / 10) + '%'; };
const SER = [{ key: 'kdc', label: 'KDC', color: COLORS[0] }, { key: 'free', label: '자율학기제', color: COLORS[1] }];
const rowsOf = () => {
  const out = [];
  D.entries.forEach((e) => out.push({ b: e.branch_id, p: e.promoter_id || '', ym: e.ym, kdc: +e.amount || 0, free: 0, rec: +e.recognized || 0, cnt: +e.cnt || 0 }));
  D.free.forEach((f) => out.push({ b: f.branch_id, p: f.promoter_id || '', ym: f.ym, kdc: 0, free: +f.amount || 0, rec: +f.recognized || 0, cnt: 0 }));
  return out.map((r) => ({ ...r, amount: r.kdc + r.free }));
};
const months = (list) => Array.from({ length: 12 }, (_, i) => { const m = pad(i + 1); const l = list.filter((r) => r.ym.slice(5) === m); return { m, kdc: sum(l, 'kdc'), free: sum(l, 'free') }; });

export default function GeneralDash() {
  useData();
  const [year, setYear] = useState(String(new Date().getFullYear())); const [per0, setPer] = useState(null); const [bsel, setBsel] = useState(''); const [sort, setSort] = useState('amount');
  const det = useRef(null);
  const rows = rowsOf();
  const years = new Set(rows.map((r) => r.ym.slice(0, 4))); years.add(String(new Date().getFullYear()));
  const ys = [...years].sort().reverse(); const Y = ys.includes(year) ? year : ys[0];
  const yr = rows.filter((r) => r.ym.startsWith(Y));
  const per = per0 || yr.map((r) => r.ym.slice(5)).sort().pop() || pad(new Date().getMonth() + 1);
  const isY = per === 'year'; const label = isY ? Y + '년 연간' : Y + '년 ' + Number(per) + '월';
  const cur = isY ? yr : yr.filter((r) => r.ym.slice(5) === per);
  const prevYm = !isY ? (per === '01' ? (Number(Y) - 1) + '-12' : Y + '-' + pad(Number(per) - 1)) : null;
  const prev = prevYm ? rows.filter((r) => r.ym === prevYm) : [];
  const brs = D.branches.filter((b) => b.active !== false || rows.some((r) => r.b === b.id));
  const gb = generalBranch();
  const tot = sum(cur, 'amount'); const reg = new Set(cur.map((r) => r.b)); const act = D.branches.filter((b) => b.active !== false);
  const actP = (l) => new Set(l.filter((r) => r.p).map((r) => r.p)).size;
  const data = brs.map((b) => { const l = cur.filter((r) => r.b === b.id); const pl = prev.filter((r) => r.b === b.id);
    return { b, amount: sum(l, 'amount'), kdc: sum(l, 'kdc'), free: sum(l, 'free'), rec: sum(l, 'rec'), cnt: sum(l, 'cnt'), direct: sum(l.filter((r) => !r.p), 'amount'), prev: sum(pl, 'amount'), pm: D.promoters.filter((p) => p.branch_id === b.id && p.active !== false).length, act: actP(l) }; });
  if (sort === 'amount') data.sort((a, b) => b.amount - a.amount);
  const sel = brs.some((b) => b.id === bsel) ? bsel : (data[0] ? data[0].b.id : '');
  const B = brs.find((b) => b.id === sel);
  const pick = (id) => { setBsel(id); setTimeout(() => det.current && det.current.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); };
  const mx = Math.max(1, ...brs.flatMap((b) => Array.from({ length: 12 }, (_, i) => sum(yr.filter((r) => r.b === b.id && r.ym.slice(5) === pad(i + 1)), 'amount'))));
  const ptot = sum(prev, 'amount');
  // 홍보팀장 순위
  const pr = new Map(); cur.filter((r) => r.p).forEach((r) => { const x = pr.get(r.p) || { a: 0, c: 0, rc: 0 }; x.a += r.amount; x.c += r.cnt; x.rc += r.rec; pr.set(r.p, x); });
  const rlist = [...pr.entries()].map(([id, x]) => { const p = D.promoters.find((y) => y.id === id) || {}; const b = D.branches.find((y) => y.id === p.branch_id) || {}; return { key: id, label: (p.name || id) + ' · ' + (b.name || ''), value: x.a, sub: '인정액 ' + won(x.rc) + '원 · KDC ' + won(x.c) + '건' }; }).sort((a, b) => b.value - a.value);
  return (
    <div className="page">
      <PageHead eyebrow="총국장" title="총국장 대시보드" lede="모든 지국의 매출을 비교하고, 지국을 골라 자세히 봅니다. 매출 월 기준(KDC + 자율학기제)입니다." />
      <Card>
        <div className="toolbar"><Field label="연도" className="inline"><select className="in" aria-label="연도" value={Y} onChange={(e) => { setYear(e.target.value); setPer(null); }}>{ys.map((y) => <option key={y} value={y}>{y}년</option>)}</select></Field></div>
        <MonthChips sel={per} has={(v) => (v === 'year' ? yr.length > 0 : yr.some((r) => r.ym.slice(5) === v))} onPick={setPer} />
        <div className="stats">
          <Stat k={label + ' 총국 매출'} v={won(tot)} u="원" sub={prevYm ? <Delta cur={tot} prev={sum(prev, 'amount')} /> : 'KDC ' + won(sum(cur, 'kdc')) + ' · 자율 ' + won(sum(cur, 'free'))} />
          <Stat k="인정액" v={won(sum(cur, 'rec'))} u="원" sub={'KDC ' + won(sum(cur, 'kdc')) + '원 · 자율학기제 ' + won(sum(cur, 'free')) + '원'} />
          <Stat k="KDC 판매 건수" v={won(sum(cur, 'cnt'))} u="건" />
          <Stat k="매출 등록 지국" v={reg.size + (isY ? '' : ' / ' + act.length)} u="곳" sub={'지국 평균 ' + won(reg.size ? Math.round(tot / reg.size) : 0) + '원'} />
          <Stat k="활동 홍보팀장" v={String(actP(cur))} u="명" sub={'등록 ' + D.promoters.filter((p) => p.active !== false).length + '명'} />
        </div>
      </Card>
      <Card>
        <div className="card-h"><h2>지국별 비교 · {label}</h2>
          <div className="seg">{[['amount', '매출순'], ['order', '지국 순서']].map(([k, t]) => <button key={k} type="button" className="btn sm" aria-pressed={sort === k} onClick={() => setSort(k)}>{t}</button>)}</div></div>
        <p className="note">줄을 누르면 아래 「지국 상세」에서 그 지국을 봅니다{gb ? ' · ★ = 총국장 직할 지국' : ''}</p>
        <div className="tbl"><table className="items gd-cmp">
          <thead><tr>{['지국', '지국장', '홍보팀장 (활동/등록)', '매출', 'KDC', '자율학기제', '인정액', 'KDC 건수', '직할 매출'].concat(isY ? [] : ['전월 매출', '전월 대비'], ['비중']).map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>{data.map((x) => (
            <tr key={x.b.id} className={x.b.id === sel ? 'on' : ''} tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => pick(x.b.id)} onKeyDown={(e) => { if (e.key === 'Enter') pick(x.b.id); }}>
              <td>{(x.b.id === gb ? '★ ' : '') + x.b.name}{x.b.active === false && <span className="note"> (사용 안 함)</span>}</td><td>{chiefName(x.b.id) || '–'}</td>
              <td className="num">{x.act + ' / ' + x.pm}</td><td className="num">{won(x.amount)}</td><td className="num">{won(x.kdc)}</td><td className="num">{won(x.free)}</td><td className="num">{won(x.rec)}</td><td className="num">{won(x.cnt)}</td><td className="num">{won(x.direct)}</td>
              {!isY && <><td className="num">{won(x.prev)}</td><td className={'num ' + (x.amount >= x.prev ? 'up' : 'down')}>{pctTxt(x.amount, x.prev)}</td></>}
              <td className="num">{tot ? Math.round(x.amount / tot * 1000) / 10 + '%' : '–'}</td>
            </tr>))}</tbody>
          <tfoot><tr><td>합계</td><td /><td className="num">{actP(cur) + ' / ' + D.promoters.filter((p) => p.active !== false).length}</td><td className="num">{won(tot)}</td><td className="num">{won(sum(cur, 'kdc'))}</td><td className="num">{won(sum(cur, 'free'))}</td><td className="num">{won(sum(cur, 'rec'))}</td><td className="num">{won(sum(cur, 'cnt'))}</td><td className="num">{won(sum(cur.filter((r) => !r.p), 'amount'))}</td>
            {!isY && <><td className="num">{won(ptot)}</td><td className="num">{pctTxt(tot, ptot)}</td></>}<td className="num">{tot ? '100%' : '–'}</td></tr></tfoot>
        </table></div>
      </Card>
      <Card>
        <h2>{Y}년 월별 추이</h2>
        <h3>총국 전체</h3><Legend items={SER.map((s) => [s.color, s.label])} />
        <Bars data={months(yr)} series={SER} selected={isY ? null : per} onPick={setPer} />
        <h3>지국별 (단위: 만원 · 색이 진할수록 큼)</h3>
        <div className="tbl"><table className="items gd-trend">
          <thead><tr><th>지국</th>{Array.from({ length: 12 }, (_, i) => <th key={i}>{i + 1}월</th>)}<th>합계</th></tr></thead>
          <tbody>{brs.map((b) => { let yt = 0; const cells = Array.from({ length: 12 }, (_, i) => { const v = sum(yr.filter((r) => r.b === b.id && r.ym.slice(5) === pad(i + 1)), 'amount'); yt += v;
            return <td key={i} className={'num heat' + (pad(i + 1) === per ? ' sel' : '')} style={v ? { '--h': String(Math.round(v / mx * 100) / 100) } : undefined} title={b.name + ' ' + (i + 1) + '월 ' + won(v) + '원'}>{v ? won(Math.round(v / 10000)) : '–'}</td>; });
            return <tr key={b.id}><td>{b.name}</td>{cells}<td className="num">{won(Math.round(yt / 10000))}</td></tr>; })}</tbody>
        </table></div>
      </Card>
      <section className="card" ref={det}>
        <div className="card-h"><h2>지국 상세 · {B ? B.name : ''} · {label}</h2>
          <select className="in" aria-label="상세 볼 지국" value={sel} onChange={(e) => setBsel(e.target.value)}>{brs.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
        {B ? <BranchDetail B={B} cur={cur} prev={prev} yr={yr} per={per} isY={isY} label={label} prevYm={prevYm} onPick={setPer} /> : <p className="note empty">지국이 없습니다</p>}
      </section>
      <Card>
        <h2>홍보팀장 순위 · {label} (모든 지국)</h2>
        {rlist.length ? <Rank list={rlist.slice(0, 20)} total={sum(rlist, 'value')} /> : <p className="note empty">이 기간에 홍보팀장 매출이 없습니다</p>}
        {rlist.length > 20 && <p className="note">그 외 {rlist.length - 20}명</p>}
      </Card>
    </div>
  );
}

function BranchDetail({ B, cur, prev, yr, per, isY, label, prevYm, onPick }) {
  const l = cur.filter((r) => r.b === B.id); const pl = prev.filter((r) => r.b === B.id); const by = yr.filter((r) => r.b === B.id);
  const ppl = [{ id: '', name: directName(B.id) }].concat(D.promoters.filter((p) => p.branch_id === B.id && (p.active !== false || l.some((r) => r.p === p.id))).map((p) => ({ id: p.id, name: p.name })))
    .map((p) => { const x = l.filter((r) => r.p === p.id); const px = pl.filter((r) => r.p === p.id); return { ...p, a: sum(x, 'amount'), rc: sum(x, 'rec'), c: sum(x, 'cnt'), pv: sum(px, 'amount') }; }).sort((a, b) => b.a - a.a);
  return (<>
    <div className="stats">
      <Stat k="매출" v={won(sum(l, 'amount'))} u="원" sub={prevYm ? <Delta cur={sum(l, 'amount')} prev={sum(pl, 'amount')} /> : null} />
      <Stat k="인정액" v={won(sum(l, 'rec'))} u="원" /><Stat k="KDC 판매 건수" v={won(sum(l, 'cnt'))} u="건" />
      <Stat k="지국장" v={chiefName(B.id) || '미지정'} u="" sub={'직할 매출 ' + won(sum(l.filter((r) => !r.p), 'amount')) + '원'} />
    </div>
    <div className="grid2">
      <div><h3>{yr[0] ? yr[0].ym.slice(0, 4) : ''}년 월별 매출</h3><Legend items={SER.map((s) => [s.color, s.label])} /><Bars data={months(by)} series={SER} selected={isY ? null : per} onPick={onPick} /></div>
      <div><h3>홍보팀장별 · {label}</h3>
        <div className="tbl"><table className="items compact">
          <thead><tr><th>이름</th><th>매출</th><th>인정액</th><th>KDC 건수</th>{!isY && <th>전월 대비</th>}</tr></thead>
          <tbody>{ppl.map((p) => <tr key={p.id || 'direct'} className={p.a ? 'on' : ''}><td>{p.name}</td><td className="num">{won(p.a)}</td><td className="num">{won(p.rc)}</td><td className="num">{won(p.c)}</td>{!isY && <td className="num">{pctTxt(p.a, p.pv)}</td>}</tr>)}</tbody>
        </table></div>
        <a className="btn sm" href="#/gsales">총국 매출 현황 열기</a>
      </div>
    </div>
  </>);
}
