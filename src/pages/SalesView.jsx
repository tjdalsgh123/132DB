// 매출 현황 (mode: 'promoter' = 홍보팀장 · 'branch' = 지국 · general = 총국장 메뉴) · 상품별 수량 · 자율학기제 · 엑셀 리포트
import { useState } from 'react';
import { directName, D, bname, pname, branchChoices, promoterChoices, casesOf, personFree, branchFree } from '../lib/store.js';
import { won, pad, sum, addYm, ymText } from '../lib/ui.js';
import { prodAgg, salesReport } from '../lib/salesReport.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, PageHead, Status, useStatus } from '../components/ui.jsx';
import { Bars, Legend, Rank, Stat, Delta, MonthChips, COLORS } from '../components/charts.jsx';

const RULE_KDC = 'KDC 매출에 따른 수당(상품·장려·정착 등)은 매출 월 + 2개월(예: 10월 매출 → 12월 월급)에 지급됩니다';
const RULE_FREE = '자율학기제 매출만 매출 월 + 1개월(예: 10월 매출 → 11월 월급)에 지급됩니다';
const F = ({ l, children }) => <label className="field inline"><span className="field-l">{l}</span>{children}</label>;

export default function SalesView({ mode, general }) {
  useData();
  const isP = mode === 'promoter';
  const [year0, setYear] = useState(String(new Date().getFullYear())); const [branch0, setBranch] = useState(''); const [prom0, setProm] = useState(''); const [per0, setPer] = useState(null);
  const [xs, setXs] = useStatus();
  const PH = (lede) => <PageHead eyebrow={isP ? '홍보팀장' : general ? '총국장' : '지국장'} title={isP ? '매출 현황' : general ? '총국 매출 현황' : '지국 매출 현황'} lede={lede} />;
  const bc = branchChoices();
  if (!bc.length) return <div className="page">{PH('')}<Card><h2>볼 수 있는 매출이 없습니다</h2><p className="note">관리자에게 「권한 관리」에서 소속 지국 또는 홍보팀장 연결을 요청하세요.</p></Card></div>;
  const branch = bc.some((b) => b.id === branch0) ? branch0 : bc[0].id;
  const pc = isP ? promoterChoices(branch) : [];
  const promoter = isP ? (pc.some((p) => p.id === prom0) ? prom0 : (pc[0] ? pc[0].id : '')) : '';
  const inSel = (x) => x.branch_id === branch && (!isP || x.promoter_id === promoter);
  const all = D.entries.filter(inSel); const fall = D.free.filter(inSel);
  const years = new Set(all.map((e) => e.ym.slice(0, 4)).concat(fall.map((x) => x.ym.slice(0, 4)))); years.add(String(new Date().getFullYear()));
  const ys = Array.from(years).sort().reverse(); const year = ys.includes(year0) ? year0 : ys[0];
  const yr = all.filter((e) => e.ym.startsWith(year)); const fyr = fall.filter((x) => x.ym.startsWith(year));
  const per = per0 || yr.map((e) => e.ym.slice(5)).concat(fyr.map((x) => x.ym.slice(5))).sort().pop() || pad(new Date().getMonth() + 1);
  const isY = per === 'year'; const label = isY ? year + '년 연간' : year + '년 ' + Number(per) + '월';
  const pr = isY ? yr : yr.filter((e) => e.ym.slice(5) === per); const fper = isY ? fyr : fyr.filter((x) => x.ym.slice(5) === per);
  const showF = isP ? personFree(promoter) : branchFree(branch);
  const prevOf = (l) => (!isY && Number(per) > 1 ? sum(l.filter((e) => e.ym.slice(5) === pad(Number(per) - 1)), 'amount') : 0);
  const fm = (m) => sum(fyr.filter((x) => x.ym.slice(5) === m), 'amount');
  const pick = (fn) => { fn(); setPer(null); };
  const xl = () => { const fn = salesReport({ year, per, branch, promoter }, isP, pr, fper); setXs(fn ? fn + ' 을(를) 내려받았습니다' : '이 기간에 입력된 매출이 없습니다', fn ? 'ok' : 'warn'); };
  // 상품별 수량
  const plist = prodAgg(pr); const totN = sum(plist, 'n'); let cN = 0, cHc = 0; pr.forEach((e) => casesOf(e).forEach((c) => { cN += 1; cHc += c.headcount; }));
  let top;
  if (isP) {
    const ser = [{ key: 'amount', label: 'KDC', color: COLORS[0] }].concat(showF ? [{ key: 'free', label: '자율학기제', color: COLORS[1] }] : []);
    const md = Array.from({ length: 12 }, (_, i) => { const m = pad(i + 1); return { m, amount: sum(yr.filter((e) => e.ym.slice(5) === m), 'amount'), free: fm(m) }; });
    top = (<>
      <div className="stats">
        <Stat k={label + ' KDC 매출'} v={won(sum(pr, 'amount'))} u="원" sub={<Delta cur={sum(pr, 'amount')} prev={prevOf(yr)} />} />
        {showF && <Stat k="자율학기제 매출" v={won(sum(fper, 'amount'))} u="원" sub={won(fper.length) + '건 · 수당 ' + won(sum(fper, 'commission')) + '원'} />}
        <Stat k="KDC 판매 건수" v={won(sum(pr, 'cnt'))} u="건" /><Stat k="KDC 수당 합계" v={won(sum(pr, 'commission'))} u="원" /><Stat k="KDC 인정액 합계" v={won(sum(pr, 'recognized'))} u="원" />
      </div>
      <div className="grid2 inner">
        <div><h2>{year}년 월별 매출</h2><Legend items={ser.map((s) => [s.color, s.label])} /><Bars data={md} series={ser} selected={isY ? null : per} onPick={setPer} /></div>
        <div><h2>월별 상세</h2>
          <div className="tbl"><table className="items compact">
            <thead><tr>{['월', 'KDC 매출', '건수', '인정액', '수당'].concat(showF ? ['자율학기제'] : []).map((x) => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>{Array.from({ length: 12 }, (_, i) => { const m = pad(i + 1); const e = yr.find((x) => x.ym.slice(5) === m);
              return <tr key={m} className={m === per ? 'on' : ''}><td>{i + 1}월</td>{e ? <><td className="num">{won(e.amount)}</td><td className="num">{won(e.cnt)}</td><td className="num">{won(e.recognized)}</td><td className="num">{won(e.commission)}</td></> : <td className="note" colSpan={4}>미등록</td>}{showF && <td className="num">{fm(m) ? won(fm(m)) : '—'}</td>}</tr>; })}</tbody>
            <tfoot><tr><td>합계</td><td className="num">{won(sum(yr, 'amount'))}</td><td className="num">{won(sum(yr, 'cnt'))}</td><td className="num">{won(sum(yr, 'recognized'))}</td><td className="num">{won(sum(yr, 'commission'))}</td>{showF && <td className="num">{won(sum(fyr, 'amount'))}</td>}</tr></tfoot>
          </table></div></div>
      </div>
    </>);
  } else {
    const dir = sum(pr.filter((e) => !e.promoter_id), 'amount'), pro = sum(pr.filter((e) => e.promoter_id), 'amount'), tot = dir + pro;
    const ps = D.promoters.filter((p) => p.branch_id === branch && (p.active !== false || pr.some((e) => e.promoter_id === p.id)));
    const regP = new Set(pr.filter((e) => e.promoter_id).map((e) => e.promoter_id)).size;
    const ser = [{ key: 'direct', label: 'KDC 직할', color: COLORS[0] }, { key: 'promoter', label: 'KDC 홍보팀장', color: COLORS[2] }].concat(showF ? [{ key: 'free', label: '자율학기제', color: COLORS[1] }] : []);
    const md = Array.from({ length: 12 }, (_, i) => { const m = pad(i + 1); const l = yr.filter((e) => e.ym.slice(5) === m); return { m, direct: sum(l.filter((e) => !e.promoter_id), 'amount'), promoter: sum(l.filter((e) => e.promoter_id), 'amount'), free: fm(m) }; });
    const rl = [{ id: '', name: directName(branch), d: true }].concat(ps.map((p) => ({ id: p.id, name: p.name }))).map((x) => { const l = pr.filter((e) => (x.d ? !e.promoter_id : e.promoter_id === x.id)); const fa = sum(fper.filter((q) => (x.d ? !q.promoter_id : q.promoter_id === x.id)), 'amount'); return { key: x.id || 'd', label: x.name, value: sum(l, 'amount'), color: x.d ? COLORS[0] : COLORS[2], sub: won(sum(l, 'cnt')) + '건 · 수당 ' + won(sum(l, 'commission')) + '원' + (fa ? ' · 자율학기제 ' + won(fa) + '원' : '') }; }).sort((a, b) => b.value - a.value);
    top = (<>
      <div className="stats">
        <Stat k={label + ' 지국 KDC 매출'} v={won(tot)} u="원" sub={<Delta cur={tot} prev={prevOf(yr)} />} />
        {showF && <Stat k="자율학기제 (홍보팀장)" v={won(sum(fper, 'amount'))} u="원" sub={won(fper.length) + '건'} />}
        <Stat k={directName(branch)} v={won(dir)} u="원" sub={tot ? Math.round(dir / tot * 1000) / 10 + '%' : ''} />
        <Stat k="홍보팀장 합계" v={won(pro)} u="원" sub={tot ? Math.round(pro / tot * 1000) / 10 + '%' : ''} />
        <Stat k="등록 홍보팀장" v={regP + ' / ' + ps.filter((p) => p.active !== false).length} u="명" />
      </div>
      <div className="grid2 inner">
        <div><h2>{year}년 월별 지국 매출</h2><Legend items={ser.map((s) => [s.color, s.label])} /><Bars data={md} series={ser} selected={isY ? null : per} onPick={setPer} /></div>
        <div><h2>직할 · 홍보팀장별 KDC 매출 · {label}</h2><Rank list={rl} total={tot} /></div>
      </div>
    </>);
  }
  return (
    <div className="page">
      {PH(isP ? pname(promoter) + ' (' + bname(branch) + ')의 월 매출 현황입니다.' : bname(branch) + ' 매출(지국 직할 + 소속 홍보팀장) 현황입니다.')}
      <Card>
        <div className="toolbar">
          <F l="연도"><select className="in" aria-label="연도" value={year} onChange={(e) => pick(() => setYear(e.target.value))}>{ys.map((y) => <option key={y} value={y}>{y}년</option>)}</select></F>
          <F l="지국"><select className="in" aria-label="지국" value={branch} disabled={bc.length <= 1} onChange={(e) => pick(() => { setBranch(e.target.value); setProm(''); })}>{bc.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></F>
          {isP && <F l="홍보팀장"><select className="in" aria-label="홍보팀장" value={promoter} disabled={pc.length <= 1} onChange={(e) => pick(() => setProm(e.target.value))}>{pc.length ? pc.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) : <option value="">홍보팀장 없음</option>}</select></F>}
          <Btn kind="primary" onClick={xl}>엑셀 리포트</Btn><Status s={xs} />
        </div>
        <MonthChips sel={per} has={(v) => (v === 'year' ? yr.length + fyr.length > 0 : yr.some((e) => e.ym.slice(5) === v) || fyr.some((x) => x.ym.slice(5) === v))} onPick={setPer} />
        <p className="note info">{'지급 기준 · ' + RULE_KDC + (showF ? ' · ' + RULE_FREE : '') + (isY ? '' : ' · 이번 선택(' + Number(per) + '월 매출): KDC → ' + ymText(addYm(year + '-' + per, 2)) + ' 월급' + (showF ? ', 자율학기제 → ' + ymText(addYm(year + '-' + per, 1)) + ' 월급' : ''))}</p>
        {top}
      </Card>
      <Card>
        <h2>상품별 수량 · {label}</h2><p className="note">KDC 매출 등록의 상품별 건수 기준 (Case 건수 + 따로 판 건수) · 판매 건수 순</p>
        {!plist.length ? <p className="note empty">이 기간에 입력된 상품별 건수가 없습니다</p> : <>
          <div className="stats"><Stat k="전체 판매 건수" v={won(totN)} u="건" /><Stat k="판매된 상품" v={String(plist.length)} u="개" /><Stat k="Case 등록" v={won(cN)} u="개" sub={'등록자 ' + won(cHc) + '명'} /></div>
          <Rank list={plist.map((x, i) => ({ key: x.pid, label: x.title, value: x.n, color: i < 3 ? COLORS[0] : 'var(--gray-40)', sub: [x.cat, x.ven].filter(Boolean).join(' · ') + ' · 매출 ' + won(x.a) + '원 · 수당 ' + won(x.m) + '원' }))} total={totN} fmt={(v) => won(v) + '건'} />
        </>}
      </Card>
      {showF && <Card>
        <h2>자율학기제 매출 · {label}</h2><p className="note">인정액 = 금액의 100% · 수당 = 금액의 50% · 매출 월 + 1개월 월급에 지급</p>
        <div className="stats"><Stat k="자율학기제 매출" v={won(sum(fper, 'amount'))} u="원" /><Stat k="건수" v={won(fper.length)} u="건" /><Stat k="인정액" v={won(sum(fper, 'recognized'))} u="원" /><Stat k="수당" v={won(sum(fper, 'commission'))} u="원" /></div>
        {!fper.length ? <p className="note empty">이 기간에 등록된 자율학기제 매출이 없습니다</p> :
          <div className="tbl"><table className="items compact">
            <thead><tr>{['매출 키', '연월'].concat(isP ? [] : ['홍보팀장']).concat(['학교·기관명', '금액', '인정액', '수당', '지급 월급', '비고']).map((x) => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>{fper.slice().sort((a, b) => a.ym.localeCompare(b.ym) || String(a.promoter_id).localeCompare(String(b.promoter_id)) || a.seq - b.seq).map((x) => (
              <tr key={x.id}><td className="note">{x.key}</td><td>{x.ym}</td>{!isP && <td>{pname(x.promoter_id, x.branch_id)}</td>}<td>{x.school}</td><td className="num">{won(x.amount)}</td><td className="num">{won(x.recognized)}</td><td className="num">{won(x.commission)}</td><td>{addYm(x.ym, 1)}</td><td className="note">{x.memo || ''}</td></tr>))}</tbody>
          </table></div>}
      </Card>}
    </div>
  );
}
