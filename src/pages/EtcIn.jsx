// 기타 상품 판매 등록 (GAAT · AICC · AICE 자격증반 · 미래일반 · 평생교육이용권 · 사업주과정 · 판매가능상품)
// 자율학기제처럼 한 달에 여러 건 · 상품을 고르면 판매가·인정액·수당(인정액 × 판매수당율)이 자동 · 매출 월 + 1개월 월급에 지급
// mode: 'promoter' = 홍보팀장 · 'branch' = 지국장 직할 · general = 총국장 직할
import { useEffect, useRef, useState } from 'react';
import { D, ETC_ROLES, save, keyPrefix, branchChoices, promoterChoices, pname, isAdmin, scope, has, directName, salesLocked } from '../lib/store.js';
import { generalBranch, pct } from '../lib/branchpay.js';
import { won, MSG, nowYm, addYm, ymText, pad, sum, errText } from '../lib/ui.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, Field, PageHead, Status, useStatus } from '../components/ui.jsx';

const DIRECT = '__d';
export const etcUnit = (p) => ({ a: p ? p.price : 0, r: p ? p.rec : 0, m: p ? Math.round(p.rec * p.rate) : 0 });

export default function EtcIn({ mode, general }) {
  useData();
  const isB = mode === 'branch'; const GEN = !!general;
  const bc = GEN ? D.branches.filter((b) => b.id === generalBranch()) : branchChoices();
  const [ym, setYm] = useState(nowYm()); const [branch0, setBranch] = useState(''); const [who0, setWho] = useState('');
  const branch = bc.some((b) => b.id === branch0) ? branch0 : (bc.length === 1 ? bc[0].id : '');
  const chiefOk = !!branch && (isAdmin() || (GEN ? scope() === 'all' && has('getcin') && branch === generalBranch() : scope() === 'branch' && D.me.branch === branch && has('setcin')));
  const bnm = (D.branches.find((b) => b.id === branch) || {}).name || '';
  const pc = isB ? (chiefOk ? [{ id: DIRECT, name: GEN ? '총국장 직할 · ' + bnm : directName(branch) }] : []) : promoterChoices(branch);
  const target = pc.some((x) => x.id === who0) ? who0 : (pc.length === 1 || (isB && pc.length) ? pc[0].id : '');
  const pid = target === DIRECT ? null : target || null;
  const whoName = target === DIRECT ? (GEN ? '총국장 직할 · ' + bnm : directName(branch)) : pname(target);
  const mine = (f) => f.branch_id === branch && (f.promoter_id || null) === pid;
  const sv = (D.etc || []).filter((f) => mine(f) && f.ym === ym).sort((a, b) => a.seq - b.seq);
  // 판매자 역할에 맞는 상품만 (관리자 → 기타 상품 관리에서 정함) · 이 달에 이미 등록한 상품은 그대로 보임
  const role = !isB ? 'promoter' : (GEN || (branch && branch === generalBranch())) ? 'general' : 'branch'; const roleName = (ETC_ROLES.find((r) => r[0] === role) || [, ''])[1];
  const allP = D.etcProducts || []; const pm = new Map(allP.map((p) => [p.id, p])); const had = new Set(sv.map((f) => f.product_id));
  const prods = allP.filter((p) => (p.roles || []).includes(role) || had.has(p.id));
  const groups = (D.etcGroups || []).filter((g) => g.active !== false && prods.some((p) => p.group === g.id && p.active !== false));
  const sig = [branch, target, ym, sv.map((f) => [f.id, f.product_id, f.qty, f.customer, f.memo].join(':')).join(',')].join('|');
  const head = [branch, target, ym].join('|');
  const [L, setL] = useState({ base: null, head: null, rows: [], dirty: false });
  const [st, setSt] = useStatus(); const [bad, setBad] = useState(new Set()); const [saving, setSaving] = useState(false); const tbRef = useRef(null);
  // 저장된 건은 등록 때 값(판매가·인정액·수당율)을 그대로 보여 줌 · 상품을 바꾸거나 새로 넣으면 지금 상품표 값
  const fromDb = () => ({ base: sig, head, rows: sv.map((f) => ({ group: f.group_id || (pm.get(f.product_id) || {}).group || '', product: f.product_id || '', qty: f.qty, customer: f.customer, memo: f.memo, snap: { price: f.price, rec: f.rec, rate: f.rate, title: f.title } })), dirty: false });
  useEffect(() => { if (L.base === sig) return; if (L.head === head && L.dirty) { setL((x) => ({ ...x, base: sig })); return; } setL(fromDb()); setBad(new Set()); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const lock = salesLocked(ym, true);
  const prefix = branch && target ? keyPrefix(ym, branch, pid) : '';
  const rows = L.rows;
  const setRows = (r) => { setL((x) => ({ ...x, rows: r, dirty: true })); setSt('저장하지 않은 변경이 있습니다', 'warn'); };
  const setRow = (i, patch) => { setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r))); setBad((b) => { const n = new Set(b); Object.keys(patch).forEach((k) => n.delete(i + ':' + k)); return n; }); };
  const changeHead = (fn) => { fn(); setBad(new Set()); setSt(''); setL((x) => ({ ...x, base: null, head: null, dirty: false })); };
  // 저장 때와 같은 규칙: 이 달에 이미 등록한 상품이면 등록 때 값, 아니면 지금 상품표 값
  const unitOf = (r) => { const o = sv.find((f) => f.product_id === r.product); const s0 = r.snap && !r.changed ? r.snap : o ? { price: o.price, rec: o.rec, rate: o.rate } : null;
    return s0 && r.product ? { a: s0.price, r: s0.rec, m: Math.round(s0.rec * s0.rate), rate: s0.rate } : { ...etcUnit(pm.get(r.product)), rate: (pm.get(r.product) || {}).rate || 0 }; };
  const doSave = async () => {
    const need = []; if (!ym) need.push('ym'); if (!branch) need.push('br'); if (!target) need.push('pr');
    rows.forEach((r, i) => { if (!r.product || !pm.has(r.product)) need.push(i + ':product'); if (!(Number(r.qty) >= 1)) need.push(i + ':qty'); });
    if (need.length) { setBad(new Set(need)); setSt(MSG, 'bad'); setTimeout(() => { const f = document.querySelector('.main [aria-invalid=true]'); if (f) f.focus(); }, 0); return; }
    const out = rows.map((r) => ({ product: r.product, qty: Math.floor(Number(r.qty)), customer: String(r.customer || '').trim(), memo: String(r.memo || '').trim() }));
    setSaving(true);
    try { const x = await save('app_etc_save', { p_branch: branch, p_promoter: pid, p_ym: ym, p_rows: out }); setL((v) => ({ ...v, base: null, head: null, dirty: false }));
      setSt(whoName + ' ' + ym + ' 기타 상품 ' + won((x && x.count) || out.length) + '건 · ' + won((x && x.amount) || 0) + '원을 저장했습니다 · ' + ymText(addYm(ym, 1)) + ' 월급에 지급됩니다', 'ok'); }
    catch (e) { setSt(errText(e), 'bad'); } finally { setSaving(false); }
  };
  const addRow = () => { const g = (rows[rows.length - 1] || {}).group || (groups[0] || {}).id || ''; setRows(rows.concat([{ group: g, product: '', qty: 1, customer: '', memo: '', changed: true }])); setTimeout(() => { const l = tbRef.current && tbRef.current.querySelectorAll('.etc-prod'); if (l && l.length) l[l.length - 1].focus(); }, 0); };
  const PH = <PageHead eyebrow={GEN ? '총국장' : isB ? '지국장' : '홍보팀장'} title={isB ? '기타 상품 직할 등록' : '기타 상품 판매 등록'} lede="GAAT·AICC·AICE 자격증반·미래일반·평생교육이용권·사업주과정·판매가능상품 판매를 건별로 등록합니다. 상품을 고르면 판매가·인정액·수당(인정액 × 판매수당율)이 자동 계산되고, 매출 월 + 1개월 뒤(예: 10월 매출 → 11월 월급)에 지급됩니다." />;
  const noOne = !bc.length || (!pc.length && !!branch && bc.length <= 1);
  if (noOne) return (<div className="page">{PH}<Card><h2>{GEN && !bc.length ? '총국장 직할 지국이 정해지지 않았습니다' : isB ? '직할 판매를 등록할 수 없는 계정입니다' : '등록할 수 있는 홍보팀장이 없습니다'}</h2><p className="note">{GEN && !bc.length ? '관리자 → 수당 관리 → 총국장 수당관리에서 총국장 직할 지국을 정해 주세요.' : '관리자에게 「권한 관리」에서 소속·연결 확인을 요청하세요.'}</p></Card></div>);
  if (!prods.length) return (<div className="page">{PH}<Card><h2>{allP.length ? roleName + ' 판매로 등록할 수 있는 상품이 없습니다' : '등록된 상품이 없습니다'}</h2><p className="note">{allP.length ? '관리자 → 수당 관리 → 기타 상품 관리에서 상품마다 「' + roleName + '」 사용을 켜 주세요.' : '관리자 → 수당 관리 → 기타 상품 관리에서 상품표를 넣어 주세요 (SQL 22_etc_sales.sql 실행 필요).'}</p></Card></div>);
  const last = sv.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
  const modeText = lock ? ym + ' 매출은 ' + lock.ym + ' 월급 마감으로 고칠 수 없습니다 (보기만 가능) · '
    : sv.length ? '등록된 판매를 수정합니다' + (last && last.updated_by ? ' (마지막 수정: ' + last.updated_by + ' ' + last.updated_at + ')' : '') + ' · ' : (target ? '아직 등록되지 않은 달입니다 · 「+ 건 추가」로 입력하세요 · ' : '');
  let A = 0, R = 0, M = 0, Q = 0; rows.forEach((r) => { const u = unitOf(r); const q = Number(r.qty) || 0; Q += q; A += u.a * q; R += u.r * q; M += u.m * q; });
  const y = (ym || nowYm()).slice(0, 4); const all = (D.etc || []).filter(mine); const yl = all.filter((f) => f.ym.startsWith(y));
  const cls = (id) => 'in' + (bad.has(id) ? ' invalid' : '');
  return (
    <div className="page">{PH}
      <section className="grid2">
        <div className="card">
          <div className="card-h"><h2>기타 상품 월 판매</h2><div className="acts"><Btn onClick={() => { setL(fromDb()); setBad(new Set()); setSt(''); }}>되돌리기</Btn><Btn kind="primary" disabled={saving} onClick={doSave}>저장</Btn></div></div>
          <p className="note">{modeText}<Status s={st} /></p>
          <div className="form3">
            <Field label="연월"><input className={cls('ym')} aria-invalid={bad.has('ym') ? 'true' : undefined} type="month" aria-label="연월" value={ym} onChange={(e) => e.target.value && changeHead(() => setYm(e.target.value))} /></Field>
            <Field label="지국"><select className={cls('br')} aria-label="지국" value={branch} disabled={bc.length <= 1 && !!branch} onChange={(e) => changeHead(() => { setBranch(e.target.value); setWho(''); })}>{bc.length > 1 && <option value="">지국 선택</option>}{bc.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            <Field label={isB ? '대상 (본인 직할)' : '홍보팀장'}><select className={cls('pr')} aria-label="홍보팀장" value={target} disabled={isB || (pc.length <= 1 && !!target)} onChange={(e) => changeHead(() => setWho(e.target.value))}>
              {pc.length ? <>{pc.length > 1 && <option value="">대상 선택</option>}{pc.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</> : <option value="">{branch ? '등록할 수 있는 사람 없음' : '지국을 먼저 고르세요'}</option>}</select></Field>
          </div>
          <dl className="sum">{[['건수', won(rows.length) + '건 · ' + won(Q) + '개'], ['판매 합계', won(A) + '원'], ['인정액 합계', won(R) + '원'], ['수당 합계', won(M) + '원'], ['지급', ym ? ymText(addYm(ym, 1)) + ' 월급' : '—']].map(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + 'v'}>{v}</dd>])}</dl>
        </div>
        <div className="card">
          <h2>{(target ? whoName : isB ? '지국 직할' : '홍보팀장') + ' · ' + y + '년 기타 상품'}</h2><p className="note">칸을 누르면 그 달을 불러옵니다 · 월급은 다음 달에 지급</p>
          <div className="months">{Array.from({ length: 12 }, (_, i) => { const k = y + '-' + pad(i + 1); const l = all.filter((f) => f.ym === k);
            return <button key={k} type="button" className={'month' + (l.length ? ' on' : '') + (k === ym ? ' sel' : '')} onClick={() => changeHead(() => setYm(k))}><span className="m">{i + 1}월</span><span className="v">{l.length ? won(sum(l, 'amount')) + '원' : '미등록'}</span><span className="m">{l.length ? won(l.length) + '건 · ' + Number(addYm(k, 1).slice(5)) + '월 지급' : ''}</span></button>; })}</div>
          <div className="total">{y}년 합계 {won(sum(yl, 'amount'))}원 · 수당 {won(sum(yl, 'commission'))}원</div>
        </div>
      </section>
      <Card>
        <div className="card-h"><h2>건별 판매</h2><div className="acts"><Btn kind="primary" onClick={addRow}>+ 건 추가</Btn></div></div>
        <p className="note">{roleName + ' 판매로 등록할 수 있는 상품만 보입니다 · '}상품군 → 상품 → 수량 순서로 고릅니다 · 고객·기관명은 선택 · 「저장」을 누르면 이 달 목록이 그대로 저장됩니다 · 이 달에 이미 등록한 상품은 등록 때 가격으로 계산됩니다 (상품표를 바꿔도 지난 판매는 그대로)</p>
        <div className="tbl"><table className="items etc-tbl">
          <thead><tr>{['번호', '매출 키', '상품군', '상품', '수량', '판매가', '인정액', '수당 (율)', '고객·기관명', '비고', ''].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody ref={tbRef}>
            {!rows.length && <tr><td className="note" colSpan={11}>등록된 판매가 없습니다 · 「+ 건 추가」를 눌러 입력하세요</td></tr>}
            {rows.map((r, i) => { const u = unitOf(r); const q = Number(r.qty) || 0; const list = prods.filter((p) => p.group === r.group && (p.active !== false || p.id === r.product)); const cur = pm.get(r.product);
              return (
                <tr key={i} className="on">
                  <td className="num">{i + 1}</td><td className="note nowrap">{prefix ? prefix + '기타-' + (i + 1) : ''}</td>
                  <td><select className="in" aria-label={(i + 1) + '번 상품군'} value={r.group || ''} onChange={(e) => setRow(i, { group: e.target.value, product: '', changed: true })}><option value="">상품군</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></td>
                  <td><select className={cls(i + ':product') + ' etc-prod'} aria-invalid={bad.has(i + ':product') ? 'true' : undefined} aria-label={(i + 1) + '번 상품'} value={r.product || ''} onChange={(e) => setRow(i, { product: e.target.value, changed: true })}><option value="">상품 선택</option>{list.map((p) => <option key={p.id} value={p.id}>{p.title + ' · ' + won(p.price) + '원' + (p.active === false ? ' (판매 중지)' : '')}</option>)}</select>
                    {cur && cur.memo && <div className="note">{cur.memo}</div>}</td>
                  <td><input className={cls(i + ':qty') + ' num'} aria-invalid={bad.has(i + ':qty') ? 'true' : undefined} type="number" min="1" step="1" aria-label={(i + 1) + '번 수량'} value={String(r.qty ?? '')} onChange={(e) => setRow(i, { qty: e.target.value === '' ? '' : Math.max(0, Math.floor(Number(e.target.value) || 0)) })} /></td>
                  <td className="num">{won(u.a * q)}</td><td className="num">{won(u.r * q)}</td><td className="num">{won(u.m * q)}<div className="note">{pct(u.rate)}</div></td>
                  <td><input className="in" type="text" maxLength={60} placeholder="예: OO학원" aria-label={(i + 1) + '번 고객·기관명'} value={r.customer || ''} onChange={(e) => setRow(i, { customer: e.target.value })} /></td>
                  <td><input className="in" type="text" maxLength={200} aria-label={(i + 1) + '번 비고'} value={r.memo || ''} onChange={(e) => setRow(i, { memo: e.target.value })} /></td>
                  <td><Btn kind="icon" aria-label={(i + 1) + '번 빼기'} onClick={() => setRows(rows.filter((_, j) => j !== i))}>×</Btn></td>
                </tr>); })}
          </tbody>
          <tfoot><tr><td colSpan={4}>합계 ({rows.length}건)</td><td className="num">{won(Q)}</td><td className="num">{won(A)}</td><td className="num">{won(R)}</td><td className="num">{won(M)}</td><td /><td /><td /></tr></tfoot>
        </table></div>
      </Card>
    </div>
  );
}
