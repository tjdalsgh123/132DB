// 자율학기제 매출 등록: 한 달에 여러 건 (학교·기관명 + 금액) · 인정액 100% · 수당 50% · 다음 달 월급에 지급
// mode: 'promoter' = 홍보팀장 · 'branch' = 지국장 직할 · general = 총국장 직할
import { useEffect, useRef, useState } from 'react';
import { D, save, keyPrefix, branchChoices, promoterChoices, pname, personFree, chiefFree, isAdmin, scope, has, directName, salesLocked } from '../lib/store.js';
import { generalBranch } from '../lib/branchpay.js';
import { won, MSG, nowYm, addYm, ymText, pad, sum, errText } from '../lib/ui.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, Field, MoneyInput, PageHead, Status, useStatus } from '../components/ui.jsx';

const REC = 1, COM = 0.5;
const DIRECT = '__d'; // 지국 직할 (지국장·총국장 본인)
const com = (a) => Math.round((Number(a) || 0) * COM);

export default function FreeIn({ mode, general }) {
  useData();
  const isB = mode === 'branch'; const GEN = !!general;
  const bc = GEN ? D.branches.filter((b) => b.id === generalBranch()) : branchChoices();
  const [ym, setYm] = useState(nowYm()); const [branch0, setBranch] = useState(''); const [who0, setWho] = useState('');
  const branch = bc.some((b) => b.id === branch0) ? branch0 : (bc.length === 1 ? bc[0].id : '');
  const chiefOk = !!branch && (isAdmin() || (GEN ? scope() === 'all' && !!D.me.free && has('gfreein') && branch === generalBranch() : scope() === 'branch' && D.me.branch === branch && !!D.me.free && has('salesin')));
  const bnm = (D.branches.find((b) => b.id === branch) || {}).name || '';
  const pc = isB ? (chiefOk ? [{ id: DIRECT, name: (GEN ? '총국장 직할 · ' + bnm : directName(branch)) + (isAdmin() && !chiefFree(branch) ? ' (자율학기제 미사용)' : '') }] : [])
    : isAdmin() ? promoterChoices(branch).map((p) => ({ id: p.id, name: p.name + (personFree(p.id) ? '' : ' (자율학기제 미사용)') })) : promoterChoices(branch).filter((p) => personFree(p.id));
  const target = pc.some((x) => x.id === who0) ? who0 : (pc.length === 1 || (isB && pc.length) ? pc[0].id : '');
  const pid = target === DIRECT ? null : target || null;
  const whoName = target === DIRECT ? (GEN ? '총국장 직할 · ' + bnm : directName(branch)) : pname(target);
  const mine = (f) => f.branch_id === branch && (f.promoter_id || null) === pid;
  const sv = D.free.filter((f) => mine(f) && f.ym === ym).sort((a, b) => a.seq - b.seq);
  const sig = [branch, target, ym, sv.map((f) => f.id + ':' + f.amount + ':' + f.school + ':' + f.memo).join(',')].join('|');
  const head = [branch, target, ym].join('|');
  const [L, setL] = useState({ base: null, head: null, rows: [], dirty: false });
  const [st, setSt] = useStatus(); const [bad, setBad] = useState(new Set()); const [saving, setSaving] = useState(false); const tbRef = useRef(null);
  const fromDb = () => ({ base: sig, head, rows: sv.map((f) => ({ school: f.school, amount: f.amount, memo: f.memo })), dirty: false });
  useEffect(() => { if (L.base === sig) return; if (L.head === head && L.dirty) { setL((x) => ({ ...x, base: sig })); return; } setL(fromDb()); setBad(new Set()); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const lock = salesLocked(ym, true);
  const prefix = branch && target ? keyPrefix(ym, branch, pid) : '';
  const rows = L.rows;
  const setRows = (r) => { setL((x) => ({ ...x, rows: r, dirty: true })); setSt('저장하지 않은 변경이 있습니다', 'warn'); };
  const setRow = (i, patch) => { setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))); setBad((b) => { const n = new Set(b); Object.keys(patch).forEach((k) => n.delete(i + ':' + k)); return n; }); };
  const changeHead = (fn) => { fn(); setBad(new Set()); setSt(''); setL((x) => ({ ...x, base: null, head: null, dirty: false })); };
  const doSave = async () => {
    const need = []; if (!ym) need.push('ym'); if (!branch) need.push('br'); if (!target) need.push('pr');
    rows.forEach((r, i) => { if (!String(r.school || '').trim()) need.push(i + ':school'); if (!(Number(r.amount) > 0)) need.push(i + ':amount'); });
    if (need.length) { setBad(new Set(need)); setSt(MSG, 'bad'); setTimeout(() => { const f = document.querySelector('.main [aria-invalid=true]'); if (f) f.focus(); }, 0); return; }
    const out = rows.map((r) => ({ school: String(r.school).trim(), amount: Math.round(Number(r.amount) || 0), memo: String(r.memo || '').trim() }));
    setSaving(true);
    try { await save('app_free_save', { p_branch: branch, p_promoter: pid, p_ym: ym, p_rows: out }); setL((x) => ({ ...x, base: null, head: null, dirty: false })); setSt(whoName + ' ' + ym + ' 자율학기제 ' + out.length + '건 · ' + won(sum(out, 'amount')) + '원을 저장했습니다 · ' + ymText(addYm(ym, 1)) + ' 월급에 지급됩니다', 'ok'); }
    catch (e) { setSt(errText(e), 'bad'); } finally { setSaving(false); }
  };
  const addRow = () => { setRows(rows.concat([{ school: '', amount: 0, memo: '' }])); setTimeout(() => { const l = tbRef.current && tbRef.current.querySelectorAll('.school'); if (l && l.length) l[l.length - 1].focus(); }, 0); };
  const PH = <PageHead eyebrow={GEN ? '총국장' : isB ? '지국장' : '홍보팀장'} title={isB ? '자율학기제 직할 등록' : '자율학기제 매출 등록'} lede="학교·기관별 자율학기제 매출을 건별로 등록합니다. 인정액은 금액의 100%, 수당은 금액의 50%로 자동 계산되고, 매출 월 + 1개월 뒤(예: 10월 매출 → 11월 월급)에 지급됩니다." />;
  const noOne = !bc.length || (!pc.length && !!branch && bc.length <= 1);
  if (noOne) return (<div className="page">{PH}<Card><h2>{GEN && !bc.length ? '총국장 직할 지국이 정해지지 않았습니다' : GEN ? '자율학기제를 쓰지 않는 총국장입니다' : isB ? '자율학기제를 쓰지 않는 지국장입니다' : '자율학기제를 쓸 수 있는 홍보팀장이 없습니다'}</h2><p className="note">{GEN && !bc.length ? '관리자 → 수당 관리 → 총국장 수당관리에서 총국장 직할 지국을 정해 주세요.' : '관리자에게 「권한 관리」에서 자율학기제 사용 체크를 요청하세요.'}</p></Card></div>);
  const last = sv.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  const modeText = lock ? ym + ' 자율학기제 매출은 ' + lock.ym + ' 월급 마감으로 고칠 수 없습니다 (보기만 가능) · '
    : sv.length ? '등록된 자율학기제 매출을 수정합니다' + (last && last.updated_by ? ' (마지막 수정: ' + last.updated_by + ' ' + last.updated_at + ')' : '') + ' · ' : (target ? '아직 등록되지 않은 달입니다 · 「+ 건 추가」로 입력하세요 · ' : '');
  const a = sum(rows, 'amount'); const cm = rows.reduce((s, r) => s + com(r.amount), 0);
  const y = (ym || nowYm()).slice(0, 4); const all = D.free.filter(mine); const yl = all.filter((f) => f.ym.startsWith(y));
  const cls = (id) => 'in' + (bad.has(id) ? ' invalid' : '');
  return (
    <div className="page">{PH}
      <section className="grid2">
        <div className="card">
          <div className="card-h"><h2>자율학기제 월 매출</h2><div className="acts"><Btn onClick={() => { setL(fromDb()); setBad(new Set()); setSt(''); }}>되돌리기</Btn><Btn kind="primary" disabled={saving} onClick={doSave}>저장</Btn></div></div>
          <p className="note">{modeText}<Status s={st} /></p>
          <div className="form3">
            <Field label="연월"><input className={cls('ym')} aria-invalid={bad.has('ym') ? 'true' : undefined} type="month" aria-label="연월" value={ym} onChange={(e) => e.target.value && changeHead(() => setYm(e.target.value))} /></Field>
            <Field label="지국"><select className={cls('br')} aria-label="지국" value={branch} disabled={bc.length <= 1 && !!branch} onChange={(e) => changeHead(() => { setBranch(e.target.value); setWho(''); })}>{bc.length > 1 && <option value="">지국 선택</option>}{bc.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label={isB ? '대상 (지국장 본인)' : '홍보팀장'}><select className={cls('pr')} aria-label="홍보팀장" value={target} disabled={isB || (pc.length <= 1 && !!target)} onChange={(e) => changeHead(() => setWho(e.target.value))}>
              {pc.length ? <>{pc.length > 1 && <option value="">대상 선택</option>}{pc.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</> : <option value="">{branch ? '자율학기제를 쓰는 사람 없음' : '지국을 먼저 고르세요'}</option>}</select></Field>
          </div>
          <dl className="sum">{[['건수', won(rows.length) + '건'], ['매출 합계', won(a) + '원'], ['인정액 합계 (100%)', won(a * REC) + '원'], ['수당 합계 (50%)', won(cm) + '원'], ['지급', ym ? ymText(addYm(ym, 1)) + ' 월급' : '—']].map(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + 'v'}>{v}</dd>])}</dl>
        </div>
        <div className="card">
          <h2>{(target ? whoName : isB ? '지국 직할' : '홍보팀장') + ' · ' + y + '년 자율학기제'}</h2><p className="note">칸을 누르면 그 달을 불러옵니다 · 월급은 다음 달에 지급</p>
          <div className="months">{Array.from({ length: 12 }, (_, i) => { const k = y + '-' + pad(i + 1); const l = all.filter((f) => f.ym === k);
            return <button key={k} type="button" className={'month' + (l.length ? ' on' : '') + (k === ym ? ' sel' : '')} onClick={() => changeHead(() => setYm(k))}><span className="m">{i + 1}월</span><span className="v">{l.length ? won(sum(l, 'amount')) + '원' : '미등록'}</span><span className="m">{l.length ? won(l.length) + '건 · ' + Number(addYm(k, 1).slice(5)) + '월 지급' : ''}</span></button>; })}</div>
          <div className="total">{y}년 합계 {won(sum(yl, 'amount'))}원 · 수당 {won(sum(yl, 'commission'))}원</div>
        </div>
      </section>
      <Card>
        <div className="card-h"><h2>건별 매출</h2><div className="acts"><Btn kind="primary" onClick={addRow}>+ 건 추가</Btn></div></div>
        <p className="note">학교·기관별로 한 줄씩 입력합니다 · 「저장」을 누르면 이 달 목록이 그대로 저장됩니다</p>
        <div className="tbl"><table className="items">
          <thead><tr>{['번호', '매출 키', '학교·기관명', '금액', '인정액 (100%)', '수당 (50%)', '비고', ''].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody ref={tbRef}>
            {!rows.length && <tr><td className="note" colSpan={8}>등록된 자율학기제 매출이 없습니다 · 「+ 건 추가」를 눌러 입력하세요</td></tr>}
            {rows.map((r, i) => (
              <tr key={i} className="on">
                <td className="num">{i + 1}</td><td className="note">{prefix ? prefix + '자율-' + (i + 1) : ''}</td>
                <td><input className={cls(i + ':school') + ' school'} aria-invalid={bad.has(i + ':school') ? 'true' : undefined} type="text" maxLength={60} placeholder="예: OO중학교" aria-label={(i + 1) + '번 학교·기관명'} value={r.school || ''} onChange={(e) => setRow(i, { school: e.target.value })} /></td>
                <td><MoneyInput value={r.amount} label={(i + 1) + '번 금액'} invalid={bad.has(i + ':amount')} onChange={(v) => setRow(i, { amount: v })} /></td>
                <td className="num">{won((r.amount || 0) * REC)}</td><td className="num">{won(com(r.amount))}</td>
                <td><input className="in" type="text" maxLength={200} aria-label={(i + 1) + '번 비고'} value={r.memo || ''} onChange={(e) => setRow(i, { memo: e.target.value })} /></td>
                <td><Btn kind="icon" aria-label={(i + 1) + '번 빼기'} onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</Btn></td>
              </tr>))}
          </tbody>
          <tfoot><tr><td colSpan={3}>합계 ({rows.length}건)</td><td className="num">{won(a)}</td><td className="num">{won(a * REC)}</td><td className="num">{won(cm)}</td><td /><td /></tr></tfoot>
        </table></div>
      </Card>
    </div>
  );
}
