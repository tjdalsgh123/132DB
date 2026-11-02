// 월급 마감 (관리자): 월급 월마다 홍보팀장·지국장·총국장 월급을 확정해 저장 · 마감한 달의 매출·입력값은 잠김
import { useMemo, useState } from 'react';
import { D, save, closedOf } from '../lib/store.js';
import { errText, won, pad, addYm } from '../lib/ui.js';
import { people, calc } from '../lib/pay.js';
import { calcBranch, allocOf, generalPerson } from '../lib/branchpay.js';
import { XLSX, download, T, Mn } from '../lib/xlsx.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, ConfirmBtn, Field, PageHead, Status, useStatus } from '../components/ui.jsx';

const KIND = { promoter: '홍보팀장', branch: '지국장', general: '총국장' };
const nowYm = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
const plain = (r) => JSON.parse(JSON.stringify(r, (k, v) => (v instanceof Map ? Object.fromEntries(v) : v)));

// 마감할 사람별 월급 (지금 기준으로 계산)
const compute = (ym) => {
  const out = [];
  people().forEach((p) => {
    if (p.role === 'promoter') { const r = calc(p, ym); if (p.active || r.total) out.push({ key: p.key, kind: 'promoter', name: p.name, bname: p.bname, branch: p.branch, total: r.total, ded: r.ded, net: r.net, note: '', data: plain(r) }); }
    else if (p.role === 'branch') { const al = allocOf(p.branch); const r = calcBranch(p, ym, al ? 'alloc' : 'base'); if (p.active || r.total) out.push({ key: p.key, kind: 'branch', name: p.name, bname: p.bname, branch: p.branch, total: r.total, ded: r.ded, net: r.net, note: al ? '최적 배분' : '', data: plain(r) }); }
  });
  const g = generalPerson(); if (g) { const r = calcBranch(g, ym, 'base'); out.push({ key: g.key, kind: 'general', name: g.name, bname: g.bname, branch: g.branch, total: r.total, ded: r.ded, net: r.net, note: '', data: plain(r) }); }
  return out;
};

export default function PayClose() {
  useData();
  const [ym, setYm] = useState(() => (closedOf(nowYm()) ? addYm(nowYm(), 1) : nowYm()));
  const [preview, setPreview] = useState(null); const [memo, setMemo] = useState(''); const [st, setSt] = useStatus(); const [busy, setBusy] = useState(false);
  const Y = Number(ym.slice(0, 4)); const c = closedOf(ym);
  const years = useMemo(() => { const s = new Set([Y - 1, Y, Y + 1, new Date().getFullYear()]); (D.closes || []).forEach((x) => s.add(Number(x.ym.slice(0, 4)))); return [...s].sort((a, b) => b - a); }, [Y]);
  const pick = (k) => { setYm(k); setPreview(null); setSt(''); };
  const snaps = c ? [...(D.snaps || new Map()).values()].filter((s) => s.ym === ym).sort((a, b) => a.kind.localeCompare(b.kind) || String(a.branch).localeCompare(String(b.branch)) || a.name.localeCompare(b.name)) : [];
  const prevOpen = !c && !closedOf(addYm(ym, -1)) && (D.closes || []).some((x) => x.ym < ym);
  const doCompute = () => { setBusy(true); setSt('계산 중…'); setTimeout(() => { try { setPreview(compute(ym)); setSt(''); } catch (e) { setSt(errText(e), 'bad'); } setBusy(false); }, 30); };
  const doClose = async () => {
    try { const rows = preview.map(({ key, kind, name, branch, total, net, data }) => ({ key, kind, name, branch, total, net, data }));
      const r = await save('app_payroll_close', { p_ym: ym, p_rows: rows, p_memo: memo.trim() }); setPreview(null); setMemo(''); setSt(ym + ' 월급을 마감했습니다 · ' + r.people + '명 · 합계 ' + won(r.total) + '원', 'ok'); }
    catch (e) { setSt(errText(e), 'bad'); }
  };
  const doReopen = async () => { try { await save('app_payroll_reopen', { p_ym: ym }); setSt(ym + ' 월급 마감을 풀었습니다 · 매출을 고친 뒤 다시 마감하세요', 'ok'); } catch (e) { setSt(errText(e), 'bad'); } };
  const xlsx = (rows, fn) => { download(fn, XLSX.build([{ name: ym + ' 월급', cols: [T('구분'), T('지국'), T('대상자'), Mn('합계금액'), Mn('공제합계'), Mn('실지급액')], rows: rows.map((r) => [KIND[r.kind], r.bname || '', r.name, r.total, r.total - r.net, r.net]) }])); setSt(fn + ' 을(를) 내려받았습니다', 'ok'); };
  const table = (rows) => (
    <div className="tbl"><table className="items compact">
      <thead><tr><th>구분</th><th>지국</th><th>대상자</th><th>합계금액</th><th>공제합계</th><th>실지급액</th></tr></thead>
      <tbody>{rows.map((r) => <tr key={r.key} className={r.total ? 'on' : ''}><td>{KIND[r.kind]}</td><td>{r.bname || ''}</td><td>{r.name}{r.note && <span className="badge">{r.note}</span>}</td><td className="num">{won(r.total)}원</td><td className="num">{won(r.total - r.net)}원</td><td className="num">{won(r.net)}원</td></tr>)}</tbody>
      <tfoot><tr><td colSpan={3}>합계 ({rows.length}명 · 지급 대상 {rows.filter((r) => r.total).length}명)</td><td className="num">{won(rows.reduce((a, r) => a + r.total, 0))}원</td><td className="num">{won(rows.reduce((a, r) => a + r.total - r.net, 0))}원</td><td className="num">{won(rows.reduce((a, r) => a + r.net, 0))}원</td></tr></tfoot>
    </table></div>
  );
  const withBname = (s) => ({ ...s, bname: (D.branches.find((b) => b.id === s.branch) || {}).name || '' });
  return (
    <div className="page">
      <PageHead eyebrow="관리자" title="월급 마감" lede="월급 월마다 홍보팀장·지국장·총국장 월급을 확정합니다. 마감한 달은 수당 기준이나 매출이 바뀌어도 확정 금액으로 보이고, 그 달에 들어가는 매출(상품 매출 = 월급 월 − 2개월, 자율학기제 = − 1개월)과 월 입력값은 고칠 수 없습니다." />
      <Card>
        <div className="toolbar"><Field label="연도" className="inline"><select className="in" aria-label="연도" value={Y} onChange={(e) => pick(e.target.value + '-' + ym.slice(5))}>{years.map((y) => <option key={y} value={y}>{y}년</option>)}</select></Field></div>
        <div className="months" role="tablist">
          {Array.from({ length: 12 }, (_, i) => { const k = Y + '-' + pad(i + 1); const cl = closedOf(k);
            return <button key={k} type="button" role="tab" aria-selected={k === ym} className={'month' + (cl ? ' on' : '') + (k === ym ? ' sel' : '')} onClick={() => pick(k)}>
              <span className="m">{i + 1}월 월급</span><span className="v">{cl ? '마감' : '—'}</span><span className="m">{cl ? won(cl.net) + '원' : '열림'}</span></button>; })}
        </div>
        <p className="note">칸을 누르면 그 달을 봅니다 · 마감한 달은 「마감」으로 표시</p>
      </Card>
      <Card>
        <div className="card-h"><h2>{ym} 월급 {c ? '· 마감됨' : '· 마감 전'}</h2>
          {c && <div className="acts"><Btn onClick={() => xlsx(snaps.map(withBname), '월급확정_' + ym + '.xlsx')}>엑셀 다운로드</Btn></div>}</div>
        <p className="note info">{ym} 월급 = {addYm(ym, -2)} 상품(KDC 등) 매출 + {addYm(ym, -1)} 자율학기제 매출 + {ym} 월 입력값</p>
        <Status s={st} />
        {c ? (<>
          <p>마감: {c.closed_by} · {c.closed_at} · {c.people}명 · 합계 {won(c.total)}원 · 실지급 {won(c.net)}원{c.memo ? ' · 메모: ' + c.memo : ''}</p>
          {table(snaps.map(withBname))}
          <div className="acts"><ConfirmBtn kind="danger" confirmText="한 번 더 눌러 마감 풀기" onFirst={() => setSt('마감을 풀면 이 달 금액이 다시 지금 기준으로 계산되고 매출을 고칠 수 있게 됩니다 · 한 번 더 누르세요 (확정 내역은 로그에 남음)', 'warn')} onConfirm={doReopen}>마감 풀기</ConfirmBtn></div>
        </>) : (<>
          {prevOpen && <p className="status" data-kind="warn">{addYm(ym, -1)} 월급이 아직 마감되지 않았습니다 · 보통 이전 달부터 마감합니다</p>}
          {!preview ? <div className="acts"><Btn kind="primary" disabled={busy} onClick={doCompute}>{busy ? '계산 중…' : '마감할 금액 계산하기'}</Btn><span className="note">지금 매출·수당 기준으로 모든 사람의 {ym} 월급을 계산해 보여 줍니다 (계정 할당 지국은 최적 배분 기준)</span></div>
            : (<>
              {table(preview)}
              <div className="acts">
                <input className="in" type="text" maxLength={200} placeholder="메모 (선택)" aria-label="마감 메모" value={memo} onChange={(e) => setMemo(e.target.value)} />
                <ConfirmBtn kind="primary" confirmText="한 번 더 눌러 마감" onFirst={() => setSt('위 금액으로 ' + ym + ' 월급을 확정합니다 · 마감하면 ' + addYm(ym, -2) + ' 상품 매출과 ' + addYm(ym, -1) + ' 자율학기제 매출을 고칠 수 없습니다 · 한 번 더 누르세요', 'warn')} onConfirm={doClose}>이 금액으로 마감</ConfirmBtn>
                <Btn onClick={() => xlsx(preview, '월급미리보기_' + ym + '.xlsx')}>엑셀 다운로드</Btn>
                <Btn onClick={doCompute}>다시 계산</Btn>
              </div>
            </>)}
        </>)}
      </Card>
    </div>
  );
}
