// 지국장·총국장 월급 계산: 지국장(총국장) 수당관리 기준 · 계정 할당 최적 배분 · 구간 기준 · 관리자 전체 표/엑셀
// kind: 'branch' = 지국장 월급 · 'general' = 총국장 월급 (총국장 직할 지국의 직할 매출 + 모든 지국 매출, 총국장 수당관리 기준)
import { useRef, useState } from 'react';
import { D, isAdmin, branchFree } from '../lib/store.js';
import { won, pad, nowYm } from '../lib/ui.js';
import { scopePeople, person } from '../lib/pay.js';
import { calcBranch, pct, manwon, typeName, measureName, scopeName, srcLabel, allocOf, allocText, generalPerson } from '../lib/branchpay.js';
import { XLSX, download, T, Mn } from '../lib/xlsx.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, PageHead, Status, useStatus } from '../components/ui.jsx';
import { Stat } from '../components/charts.jsx';

const F = ({ l, children }) => <label className="field inline"><span className="field-l">{l}</span>{children}</label>;

export default function PayBranch({ kind = 'branch' }) {
  useData();
  const G = kind === 'general'; const WHO = G ? '총국장' : '지국장'; const WIDE = G ? '총국 전체' : '지국 전체';
  const [ym, setYm] = useState(nowYm()); const [who0, setWho] = useState(''); const [mode, setMode] = useState('alloc'); const [guide0, setGuide] = useState(''); const [acc0, setAcc] = useState('');
  const [done, setDone] = useState(() => new Set()); const at = useRef(null); const [busy, setBusy] = useState(false); const [xs, setXs] = useStatus();
  // 매출이 바뀌면 최적 배분은 다시 계산해야 함
  if (at.current !== D.loadedAt) { if (at.current && done.size) setDone(new Set()); at.current = D.loadedAt; }
  const PH = <PageHead eyebrow={WHO} title={WHO + ' 월급 계산'} lede={G ? '총국장 직할 실적과 총국 전체(모든 지국) 실적으로 총국장 월급을 자동 계산합니다. 기준은 관리자 → 수당 관리 → 총국장 수당관리에서 정합니다.' : '지국 직할 실적과 지국 전체(소속 홍보팀장 포함) 실적으로 지국장 월급을 자동 계산합니다. 기준은 관리자 → 수당 관리 → 지국장 수당관리에서 정합니다.'} />;
  const gp = G ? generalPerson() : null; const ppl = G ? (gp ? [gp] : []) : scopePeople('branch');
  if (!ppl.length) return <div className="page">{PH}<Card><h2>{G ? '총국장 직할 지국이 정해지지 않았습니다' : '볼 수 있는 지국이 없습니다'}</h2><p className="note">{G ? '관리자 → 수당 관리 → 총국장 수당관리에서 총국장 직할 지국을 정해 주세요.' : '관리자에게 「권한 관리」에서 소속 지국 지정을 요청하세요.'}</p></Card></div>;
  const who = ppl.some((p) => p.key === who0) ? who0 : ppl[0].key;
  const p = G ? gp : person(who); const al = G ? null : allocOf(p.branch); const hasAl = !!al;
  const doneK = (k) => done.has(p.key + '|' + k);
  const modeOf = (k) => (hasAl && mode === 'alloc' && doneK(k) ? 'alloc' : 'base');
  const r = calcBranch(p, ym, modeOf(ym));
  const showF = G || branchFree(p.branch) || r.pf.branchFree.sales > 0;
  const Y = Number(ym.slice(0, 4)); const yNow = new Date().getFullYear();
  const ys = new Set([yNow - 1, yNow, yNow + 1, Y]); D.entries.forEach((e) => ys.add(Number(e.ym.slice(0, 4))));
  let yTot = 0, yNet = 0;
  const months = Array.from({ length: 12 }, (_, i) => { const k = Y + '-' + pad(i + 1); const rm = calcBranch(p, k, modeOf(k)); yTot += rm.total; yNet += rm.net; return { k, m: i + 1, rm }; });
  const cn = new Map((D.fee.categories || []).map((c) => [c.id, c.name])); const tot = (m, k) => Object.values(m).reduce((a, v) => a + (v[k] || 0), 0);
  const compute = () => { setBusy(true); setTimeout(() => { setDone((s) => { const n = new Set(s); n.add(p.key + '|' + ym); return n; }); setBusy(false); }, 30); };
  const tiers = r.lines.filter((l) => l.it.type === 'tier');
  const guide = tiers.some((l) => l.it.id === guide0) ? guide0 : (tiers[0] ? tiers[0].it.id : '');
  const shownLines = r.alloc ? r.lines.filter((l) => l.group === '지국 전체 기준') : r.lines;
  return (
    <div className="page">{PH}
      <Card>
        <div className="toolbar">
          <F l="연도"><select className="in" aria-label="연도" value={String(Y)} onChange={(e) => setYm(e.target.value + '-' + ym.slice(5))}>{[...ys].sort((a, b) => b - a).map((y) => <option key={y} value={String(y)}>{y}년</option>)}</select></F>
          <F l="대상자"><select className="in" aria-label="지국" value={who} disabled={ppl.length <= 1} onChange={(e) => setWho(e.target.value)}>{ppl.map((x) => <option key={x.key} value={x.key}>{G ? x.name : x.bname + ' 지국장'}</option>)}</select></F>
        </div>
        <p className="note">{Y}년 월별 예상 실수령액 · 칸을 누르면 그 달 월급을 봅니다 (칸 아래: 지급되는 매출 월)</p>
        <div className="months" role="tablist">{months.map(({ k, m, rm }) => (
          <button key={k} type="button" role="tab" aria-selected={k === ym} className={'month' + (rm.total > 0 ? ' on' : '') + (k === ym ? ' sel' : '')} onClick={() => { if (k !== ym) setYm(k); }}>
            <span className="m">{m}월 월급</span><span className="v">{rm.total > 0 ? won(rm.net) + '원' : '—'}</span><span className="m">{'KDC ' + Number(rm.pf.kdc_ym.slice(5)) + '월' + (showF ? ' · 자율 ' + Number(rm.pf.free_ym.slice(5)) + '월' : '') + ' 매출'}</span></button>))}</div>
        <div className="total">{Y}년 합계금액 {won(yTot)}원 · 예상 실수령 {won(yNet)}원</div>
      </Card>
      {r.closed && <p className="note info lock">{ym + ' 월급은 마감되었습니다 (확정 금액 · 마감 ' + r.closed.by + ' ' + r.closed.at + ') · 매출·수당 기준이 바뀌어도 이 금액으로 보입니다' + (isAdmin() ? ' · 고치려면 관리자 → 월급 마감에서 마감을 푸세요' : '')}</p>}
      <Card>
        <h2>{p.name + ' · ' + ym + ' 월급 정산 대상 실적'}</h2>
        <p className="note info">{'지급 기준 · KDC·재직자 등 상품 매출은 매출 월 + 2개월' + (showF ? ', 자율학기제는 매출 월 + 1개월' : '') + ' 뒤에 지급 → ' + ym + ' 월급 = ' + r.pf.kdc_ym + ' 상품 매출' + (showF ? ' + ' + r.pf.free_ym + ' 자율학기제 매출' : '') + (r.pf.registered ? '' : ' · 정산 대상 매출이 아직 없습니다')}</p>
        <div className="stats">
          <Stat k={WIDE + ' 판매액 (' + r.pf.kdc_ym + ')'} v={won(tot(r.pf.branch, 'sales'))} u="원" sub={Object.entries(r.pf.branch).filter(([, v]) => v.sales).map(([c, v]) => (cn.get(c) || '기타') + ' ' + won(v.sales)).join(' · ') || '매출 없음'} />
          <Stat k={WHO + ' 직할 판매액'} v={won(tot(r.pf.own, 'sales'))} u="원" sub={'인정액 ' + won(tot(r.pf.own, 'rec')) + '원 · 수당 ' + won(tot(r.pf.own, 'com')) + '원'} />
          <Stat k={WIDE + ' 판매 건수'} v={won(tot(r.pf.branch, 'cnt'))} u="건" sub={'인정액 ' + won(tot(r.pf.branch, 'rec')) + '원'} />
          {showF && <Stat k={'자율학기제 (' + r.pf.free_ym + ')'} v={won(r.pf.branchFree.sales)} u="원" sub={WHO + ' 직할 ' + won(r.pf.ownFree.sales) + '원 · ' + won(r.pf.branchFree.cnt) + '건'} />}
        </div>
      </Card>
      <Card>
        <div className="card-h"><h2>월급 계산</h2>
          {hasAl && <div className="chips yn" role="tablist" aria-label="계산 방식">{[['alloc', '최적 배분 (' + allocText(al) + ')'], ['base', '지국장 1명 기준']].map(([k, t]) => <button key={k} type="button" className="btn chip" role="tab" aria-selected={mode === k} onClick={() => setMode(k)}>{t}</button>)}</div>}</div>
        {hasAl && mode === 'alloc' && !doneK(ym) && !r.closed && <div className="note info"><p>{'지국장 직할 매출(신청자 1명 단위)을 ' + allocText(al) + '에 어떻게 나눠야 월급 합계가 가장 많은지 계산합니다 · 매출이 새로 등록되면 다시 눌러 주세요 · 아래는 지금 지국장 1명 기준 월급입니다'}</p><Btn kind="primary" disabled={busy} onClick={compute}>{busy ? '계산 중…' : '최적 배분 계산하기'}</Btn></div>}
        {!hasAl && !G && <p className="note">{'이 지국은 계정 할당(roll)을 쓰지 않아 지국장 1명 기준으로 계산합니다' + (isAdmin() ? ' · 「권한 관리 → 지국」에서 계정 할당을 켜고 홍보팀장·지국장 계정 수를 정하면 자동으로 나눠 계산합니다' : '')}</p>}
        {r.alloc && (() => { const gain = r.total - r.baseTotal; return (
          <div className="note info">
            <p>{'최적 배분 · ' + allocText(r.alloc) + ' · 신청자 1명(강의 묶음)·개별 판매·자율학기제 단위로 나눠 계정 월급 합계가 가장 많아지게 배분했습니다 · 지국 전체 매출 기준 항목은 지국장 몫으로 한 번 더함'}</p>
            <p>{'지국장 1명 기준 ' + won(r.baseTotal) + '원 → 최적 배분 ' + won(r.total) + '원 (' + (gain >= 0 ? '+' : '') + won(gain) + '원)'}</p>
            <p>{r.alloc.cap ? '구간 여유 ' + won(r.alloc.cap) + '원 적용 · 계정마다 구간 기준액 + ' + won(r.alloc.cap) + '원 이상 채워야 그 구간을 받는 것으로 보고 나눴습니다 (예: 1,500만 구간 → ' + won(15000000 + r.alloc.cap) + '원 이상) · 아래 금액은 실제 인정액 기준' : '구간 여유 없음 · 구간 기준액을 딱 맞게 채워도 달성으로 보고 나눴습니다'}</p>
            <p>{r.method === 'exact' ? '계산 방식: 가능한 모든 배분을 비교한 최대 금액입니다' : '계산 방식: 경우의 수가 너무 많아 근사 탐색으로 찾은 금액입니다 (최대값에 가깝지만 보장되지는 않음)'}</p>
            {!r.closed && <Btn kind="sm" onClick={compute}>다시 계산하기</Btn>}
          </div>); })()}
        <div className="tbl"><table className="items compact">
          <thead><tr><th>사업부분별</th><th>지급기준</th><th>계산</th><th>수당</th></tr></thead>
          <tbody>
            {r.alloc && <>{r.groups.map((g) => <tr key={g.acc.id} className={g.total ? 'on' : ''}><td>{g.acc.name}</td><td className="note">{g.acc.role === 'promoter' ? '홍보팀장 기준' : '지국장 기준 (직할 항목)'}</td><td className="note">{'신청자 ' + g.acc.people + '명' + ((g.acc.rows || []).some((x) => x.kind === 'single') ? ' + 개별 판매' : '') + (g.acc.free && g.acc.free.sales ? ' + 자율학기제' : '') + ' · 인정액 ' + won(g.acc.rec) + '원 · 판매액 ' + won(g.acc.sales) + '원'}</td><td className="num">{won(g.total)}원</td></tr>)}
              <tr className="grp"><td colSpan={4}>지국 전체 매출 기준 (지국장 몫)</td></tr></>}
            {shownLines.map((l, i) => <tr key={i} className={l.amount ? 'on' : ''}><td>{l.it.name}</td><td className="note">{l.it.memo || typeName(l.it.type)}</td><td className="note">{l.how}</td><td className="num">{won(l.amount)}원</td></tr>)}
            {!r.lines.length && <tr><td className="note" colSpan={4}>{'적용된 수당 항목이 없습니다 · 관리자 → 수당 관리 → ' + WHO + ' 수당관리에서 항목을 켜 주세요'}</td></tr>}
          </tbody>
          <tfoot>{[['합계금액', won(r.total) + '원'], ['소득세 (3%)', '−' + won(r.tax) + '원'], ['주민세 (0.3%)', '−' + won(r.local) + '원'], ['적립금 RDS (5%' + (r.rdsCap ? ' · 누적 ' + manwon(r.rdsCap) + '까지, 지금까지 ' + won(r.rdsPaid) + '원' : '') + ')', '−' + won(r.rds) + '원'], ['공제합계', '−' + won(r.ded) + '원']].map(([k, v]) => <tr key={k}><td colSpan={3}>{k}</td><td className="num">{v}</td></tr>)}</tfoot>
        </table></div>
        <div className="net"><span>예상 실지급액</span><b>{won(r.net)}원</b></div>
        {r.rdsCap > 0 && r.rdsPaid + r.rds >= r.rdsCap && <p className="note">{'적립금(RDS)이 누적 한도 ' + manwon(r.rdsCap) + '에 닿아 더 공제하지 않습니다 · 퇴사 시 지급'}</p>}
      </Card>
      {r.alloc && <Detail r={r} acc0={acc0} setAcc={setAcc} />}
      {tiers.length > 0 && <Card>
        <h2>구간 기준</h2>
        <div className="chips">{tiers.map((l) => <button key={l.it.id} type="button" className="chip has" aria-selected={guide === l.it.id} onClick={() => setGuide(l.it.id)}>{l.it.name}</button>)}</div>
        {(() => { const l = tiers.find((x) => x.it.id === guide); const it = l.it; const cnt = it.measure === 'cnt'; const ts = (it.tiers || []).slice().sort((a, b) => a.base - b.base); const hit = ts.filter((x) => l.value >= Number(x.base)).pop(); const next = ts.find((x) => l.value < Number(x.base));
          return (<div>
            <p className="note">{scopeName(it.scope, kind) + ' ' + srcLabel(it) + ' ' + measureName(it.measure) + ' 기준 · 이번 달 ' + won(l.value) + (cnt ? '건' : '원') + (it.memo ? ' · ' + it.memo : '')}</p>
            <div className="tbl"><table className="items compact"><thead><tr><th>실적 구간</th><th>지급</th><th>달성</th></tr></thead>
              <tbody>{ts.map((x, i) => { const on = x === hit; return <tr key={i} className={on ? 'on' : ''}><td>{(cnt ? won(x.base) + '건' : manwon(Number(x.base))) + ' 이상'}</td><td>{won(Number(x.amount) || 0)}원</td><td>{on ? '✓ 달성' : l.value >= Number(x.base) ? '통과' : ''}</td></tr>; })}</tbody></table></div>
            {next && <p className="note">{'다음 구간까지 ' + won(Number(next.base) - l.value) + (cnt ? '건' : '원') + ' 남음'}</p>}
          </div>); })()}
      </Card>}
      {isAdmin() && !G && <AllChiefs ppl={ppl} ym={ym} mode={mode} done={done} who={who} setWho={setWho} xs={xs} setXs={setXs} />}
    </div>
  );
}

// 계정별 상세: 탭(계정마다) · 담긴 Case 목록 + 그 계정 계산
function Detail({ r, acc0, setAcc }) {
  const acc = r.groups.some((g) => g.acc.id === acc0) ? acc0 : (r.groups[0] ? r.groups[0].acc.id : '');
  const g = r.groups.find((x) => x.acc.id === acc); let run = 0;
  return (
    <Card>
      <h2>계정별 상세</h2>
      <div className="seg" role="tablist">{r.groups.map((x) => <button key={x.acc.id} type="button" className="btn" role="tab" aria-selected={acc === x.acc.id} onClick={() => setAcc(x.acc.id)}>{x.acc.name + ' (' + x.acc.people + '명)'}</button>)}</div>
      {g && <div>
        <p className="note info">{g.acc.name + ' · ' + (g.acc.role === 'promoter' ? '홍보팀장 기준' : '지국장 기준(직할 항목)') + ' · 인정액 ' + won(g.acc.rec) + '원 · 판매액 ' + won(g.acc.sales) + '원 · 소계 ' + won(g.total) + '원'}</p>
        <div className="tbl"><table className="items compact left">
          <thead><tr>{['Case 키', 'Case 이름', '신청자', '상품 (1명분)', '판매액', '인정액', '누적 인정액'].map((x) => <th key={x}>{x}</th>)}</tr></thead>
          <tbody>{(g.acc.rows || []).map((u, i) => { run += u.rec; return (
            <tr key={i}><td className="nowrap">{u.kind === 'case' ? u.caseKey : u.kind === 'single' ? '개별 판매' : u.key}</td><td>{u.kind === 'free' ? '자율학기제 · ' + u.name : u.kind === 'case' ? (u.name || '—') : u.name}</td>
              <td>{u.kind === 'case' ? <><div className="nowrap">{'신청자-' + u.from + (u.to > u.from ? ' ~ ' + u.to : '')}</div><div className="note">{u.headcount + '명' + (u.headcount > 1 ? ' · 1명당 인정액 ' + won(Math.round(u.rec / u.headcount)) + '원' : '')}</div></> : <div className="nowrap">{u.kind === 'single' ? won(u.headcount) + '건' : '1건'}</div>}</td>
              <td className="note">{u.kind === 'case' ? (u.titles || []).join(' + ') : ''}</td><td className="num">{won(u.sales)}</td><td className="num">{won(u.rec)}</td><td className="num">{won(run)}</td></tr>); })}
            {!(g.acc.rows || []).length && <tr><td className="note" colSpan={7}>이 계정에 배분된 매출이 없습니다 (다른 계정에 두는 편이 월급이 더 많습니다)</td></tr>}</tbody>
        </table></div>
        <div className="tbl"><table className="items compact">
          <thead><tr><th>수당 항목</th><th>계산</th><th>금액</th></tr></thead>
          <tbody>{g.lines.map((l, i) => <tr key={i} className={l.amount ? 'on' : ''}><td>{l.it.name}</td><td className="note">{l.how}</td><td className="num">{won(l.amount)}원</td></tr>)}</tbody>
          <tfoot><tr><td colSpan={2}>{g.acc.name} 소계</td><td className="num">{won(g.total)}원</td></tr></tfoot>
        </table></div>
      </div>}
    </Card>
  );
}

// 관리자: 이 달 전체 지국장
function AllChiefs({ ppl, ym, mode, done, who, setWho, xs, setXs }) {
  const all = ppl.map((x) => ({ p: x, r: calcBranch(x, ym, mode === 'alloc' && done.has(x.key + '|' + ym) ? 'alloc' : 'base') }));
  const names = []; all.forEach(({ r }) => r.lines.forEach((l) => { if (!names.some((n) => n[0] === l.it.id)) names.push([l.it.id, l.it.name]); }));
  const sumOf = (r, id) => { const ls = r.lines.filter((y) => y.it.id === id); return ls.length ? ls.reduce((a, y) => a + y.amount, 0) : null; };
  const xl = () => {
    const s1 = { name: ym + ' 지국장 월급', cols: [T('지국'), Mn('지국 판매액')].concat(names.map((n) => Mn(n[1])), [Mn('합계금액'), Mn('소득세'), Mn('주민세'), Mn('적립금 RDS'), Mn('공제합계'), Mn('실지급액')]),
      rows: all.map(({ p: x, r }) => [x.bname, r.pf.sales].concat(names.map(([id]) => sumOf(r, id)), [r.total, r.tax, r.local, r.rds, r.ded, r.net])) };
    const s2 = { name: '항목별 계산', cols: [T('지국'), T('사업부분별'), T('지급기준'), T('계산'), Mn('수당')], rows: [] };
    all.forEach(({ p: x, r }) => r.lines.forEach((l) => s2.rows.push([x.bname, (l.group ? l.group + ' · ' : '') + l.it.name, l.it.memo || '', l.how, l.amount])));
    const fn = '지국장_월급_' + ym + '.xlsx'; download(fn, XLSX.build([s1, s2])); setXs(fn + ' 을(를) 내려받았습니다', 'ok');
  };
  return (
    <Card>
      <div className="card-h"><h2>{ym} 전체 지국장 월급</h2><div className="acts"><Btn onClick={xl}>엑셀 다운로드</Btn><Status s={xs} /></div></div>
      <div className="tbl"><table className="items">
        <thead><tr>{['지국', '지국 판매액'].concat(names.map((n) => n[1]), ['합계금액', '실지급액']).map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
        <tbody>{all.map(({ p: x, r }) => <tr key={x.key} className={x.key === who ? 'on' : ''} style={{ cursor: 'pointer' }} onClick={() => setWho(x.key)}>
          <td>{x.bname}</td><td className="num">{won(r.pf.sales)}</td>{names.map(([id]) => { const v = sumOf(r, id); return <td key={id} className={'num' + (v == null ? ' muted' : '')}>{v == null ? '–' : won(v)}</td>; })}<td className="num">{won(r.total)}</td><td className="num">{won(r.net)}</td></tr>)}</tbody>
      </table></div>
    </Card>
  );
}
