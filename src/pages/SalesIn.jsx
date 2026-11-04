// KDC 매출 등록 (mode: 'promoter' = 홍보팀장 · 'direct' = 지국 직할 · general = 총국장 직할)
// Case = 상품 최대 3개 묶음 × 등록자 수 · 저장된 Case는 아래 「상품별 건수」에 합쳐 보이고, 위에서는 새 Case만 추가
import { useEffect, useMemo, useRef, useState } from 'react';
import { directName, D, save, products, pmap, vendorName, categoryName, bname, pname, keyPrefix, branchChoices, promoterChoices, findEntry, casesOf, singlesOf, singleNotesOf, applicantRanges, rangeText, salesLocked } from '../lib/store.js';
import { generalBranch } from '../lib/branchpay.js';
import { won, MSG, nowYm, addYm, ymText, pad, sum, errText } from '../lib/ui.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, Field, PageHead, Status, useStatus } from '../components/ui.jsx';

const MAXP = 3;
const toLocal = (c) => ({ key: c.key, no: c.no, name: c.name, headcount: c.headcount, memo: c.memo, products: c.items.map((x) => x.pid) });
const unit = (c, pm) => { let a = 0, r = 0, m = 0; c.products.forEach((pid) => { const p = pid && pm.get(pid); if (p) { a += p['판매가'] || 0; r += p['인정액'] || 0; m += p['수당'] || 0; } }); return { a, r, m }; };
const caseQty = (list) => { const q = new Map(); list.forEach((c) => { const n = Number(c.headcount) || 0; c.products.forEach((pid) => { if (pid) q.set(pid, (q.get(pid) || 0) + n); }); }); return q; };
const singlesArr = (m, notes) => Array.from(m.entries()).filter(([, n]) => n !== 0).map(([productId, qty]) => ({ productId, qty, note: qty < 0 ? String((notes && notes.get(productId)) || '').trim() : '' }));
const inv = (bad, id) => (bad.has(id) ? { className: 'in invalid', 'aria-invalid': 'true' } : { className: 'in' });

export default function SalesIn({ mode, general }) {
  useData();
  const isP = mode === 'promoter'; const GEN = !!general;
  const bc = GEN ? D.branches.filter((b) => b.id === generalBranch()) : branchChoices();
  const [ym, setYm] = useState(nowYm()); const [branch0, setBranch] = useState(''); const [promoter0, setPromoter] = useState('');
  const branch = bc.some((b) => b.id === branch0) ? branch0 : (bc.length === 1 ? bc[0].id : (bc.some((b) => b.id === branch0) ? branch0 : ''));
  const pc = isP && branch ? promoterChoices(branch) : [];
  const promoter = !isP ? '' : pc.some((p) => p.id === promoter0) ? promoter0 : (pc.length === 1 ? pc[0].id : '');
  const entry = branch && (!isP || promoter) && ym ? findEntry(branch, isP ? promoter : null, ym) : null;
  const sig = [branch, promoter, ym, entry ? [entry.entry_id, entry.amount, entry.cnt, entry.updated_at].join(':') : ''].join('|');
  const head = [branch, promoter, ym].join('|');
  const saved = useMemo(() => casesOf(entry), [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const [L, setL] = useState({ base: null, head: null, memo: '', cases: [], singles: new Map(), notes: new Map(), enote: new Map(), showSaved: false, dirty: false, editing: new Map() });
  const [st, setSt] = useStatus(); const [bad, setBad] = useState(new Set()); const caseBox = useRef(null);
  const lock = salesLocked(ym, false);
  // 지금 DB 기준으로 다시 불러오기
  const fresh = (patch = {}) => { const e = branch && (!isP || promoter) && ym ? findEntry(branch, isP ? promoter : null, ym) : null; const sv = casesOf(e);
    return { base: [branch, promoter, ym, e ? [e.entry_id, e.amount, e.cnt, e.updated_at].join(':') : ''].join('|'), head, memo: e ? e.memo || '' : '', cases: patch.showSaved ? sv.map(toLocal) : [], singles: singlesOf(e), notes: singleNotesOf(e), enote: new Map(), showSaved: false, dirty: false, editing: new Map(), ...patch, sv }; };
  // 매출이 바뀌면(다른 사람 저장·월 바꿈) 다시 불러오기 · 같은 달을 편집 중이면 입력은 그대로
  useEffect(() => {
    if (L.base === sig) return;
    if (L.head === head && L.dirty) { setL((x) => ({ ...x, base: sig })); return; }
    const { sv, ...n } = fresh(); setL(n); setBad(new Set()); // eslint-disable-line no-unused-vars
  }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const prefix = keyPrefix(ym, branch, isP ? promoter : null);
  const keyOf = (c) => c.key || prefix + 'Case-' + c.no;
  const savedCase = (key) => saved.find((c) => c.key === key) || null;
  const allCases = L.showSaved ? L.cases : saved.map(toLocal).concat(L.cases);
  const offset = L.showSaved ? 0 : saved.length;
  const sameAsSaved = (c) => { const s = savedCase(keyOf(c)); return !!s && s.name === (c.name || '').trim() && s.headcount === (Number(c.headcount) || 0) && JSON.stringify(s.items.map((i) => i.pid)) === JSON.stringify(c.products.filter(Boolean)); };
  const payload = (c, i) => ({ no: c.no, new: !savedCase(keyOf(c)), name: (c.name || '').trim(), headcount: Number(c.headcount) || 0, memo: c.memo || '', products: c.products.filter(Boolean).slice(0, MAXP), sort: i });
  const target = { p_branch: branch, p_promoter: isP ? promoter : null, p_ym: ym };
  const dirty = (patch) => { setL((x) => ({ ...x, ...patch, dirty: true })); setSt('저장하지 않은 변경이 있습니다', 'warn'); };
  const setCase = (i, patch) => { const cs = L.cases.map((c, j) => (j === i ? { ...c, ...patch } : c)); dirty({ cases: cs }); setBad((b) => { const n = new Set(b); [...n].filter((k) => k.startsWith('c' + i + ':')).forEach((k) => n.delete(k)); return n; }); };
  const headNeed = () => { const n = []; if (!ym) n.push('ym'); if (!branch) n.push('br'); if (isP && !promoter) n.push('pr'); return n; };
  const caseNeed = (c, i) => { const n = []; if (!c.products.some(Boolean)) n.push('c' + i + ':p0'); else c.products.forEach((p, s) => { if (!p) n.push('c' + i + ':p' + s); }); if (c.headcount === '' || c.headcount == null) n.push('c' + i + ':hc'); return n; };
  const fail = (need) => { setBad(new Set(need)); setSt(MSG, 'bad'); setTimeout(() => { const f = document.querySelector('.main [aria-invalid=true]'); if (f) { try { f.scrollIntoView({ block: 'center' }); f.focus({ preventScroll: true }); } catch (_) {} } }, 0); };
  const pm = pmap(); const vn = vendorName(), cn = categoryName();

  // 저장 (save 가 최신 데이터를 다시 읽은 뒤 끝남)
  const run = async (fn, args, done) => { try { const r = await save(fn, args); done(r || {}); } catch (e) { setSt(errText(e), 'bad'); } };
  // 저장 뒤: 저장된 Case는 목록에서 빠지고(아래 표에 합쳐짐), 저장 전 Case는 그대로 남김
  const after = (local, singles, memoV, msg, notes) => {
    const f = fresh(); const keepNew = local.filter((c) => !f.sv.some((x) => x.key === keyOf(c)));
    const { sv, ...n } = f; // eslint-disable-line no-unused-vars
    setL({ ...n, memo: memoV, singles, notes: notes || n.notes, showSaved: L.showSaved, cases: (L.showSaved ? sv.map(toLocal) : []).concat(keepNew), dirty: keepNew.length > 0 });
    setSt(msg, 'ok');
  };
  const keepLocal = (skipKey) => L.cases.filter((c) => keyOf(c) !== skipKey).map((c) => ({ ...c, products: c.products.slice() }));
  const saveCase = (c, i) => { const n = caseNeed(c, i).concat(headNeed()); if (n.length) { fail(n); return; } const local = keepLocal(keyOf(c)); const singles = new Map(L.singles); run('app_sales_save_case', { ...target, p_case: payload(c, i + offset) }, (r) => after(local, singles, L.memo, 'Case ' + c.no + ' 저장 · 월 합계 ' + won(r.amount || 0) + '원 · 아래 상품별 건수에 합쳐졌습니다')); };
  const removeCase = (c, i) => {
    if (!savedCase(keyOf(c))) { const cs = L.cases.slice(); cs.splice(i, 1); setL((x) => ({ ...x, cases: cs })); setSt(''); return; }
    const local = keepLocal(keyOf(c)); const singles = new Map(L.singles);
    run('app_sales_remove_case', { ...target, p_key: keyOf(c) }, (r) => after(local, singles, L.memo, 'Case ' + c.no + ' 을(를) 뺐습니다 · 신청자 번호를 다시 매겼습니다 · 월 합계 ' + won(r.amount || 0) + '원'));
  };
  const saveItem = (p, caseN) => {
    const total = L.editing.get(p.id); if (total == null) return;
    const need = headNeed(); if (need.length) { fail(need); return; }
    const svq = caseQty(saved.map(toLocal));
    const note = String(L.enote.has(p.id) ? L.enote.get(p.id) : (L.notes.get(p.id) || '')).trim();
    const sing = singlesOf(entry); const notes = singleNotesOf(entry); const extra = total - (svq.get(p.id) || 0); if (extra) sing.set(p.id, extra); else sing.delete(p.id);
    if (extra < 0) notes.set(p.id, note); else notes.delete(p.id);
    const localS = new Map(L.singles); const extraL = total - caseN; if (extraL) localS.set(p.id, extraL); else localS.delete(p.id);
    const localN = new Map(L.notes); if (extraL < 0) localN.set(p.id, note); else localN.delete(p.id);
    const local = keepLocal(null);
    run('app_sales_save_all', { ...target, p_memo: entry ? entry.memo || '' : '', p_cases: saved.map(toLocal).map((c, i) => ({ ...payload(c, i), new: false })), p_singles: singlesArr(sing, notes) },
      (r) => after(local.filter((c) => !savedCase(keyOf(c))), localS, L.memo, (p['강의명'] || p.id) + ' 합계 ' + won(total) + '건으로 저장' + (extra < 0 ? ' (미승인 차감 ' + won(-extra) + '건)' : '') + ' · 월 합계 ' + won(r.amount || 0) + '원', localN));
  };
  const saveAll = () => {
    let need = headNeed(); L.cases.forEach((c, i) => { need = need.concat(caseNeed(c, i)); });
    if (need.length) { fail(need); return; }
    if (!allCases.length && !L.singles.size && !entry) { setSt(MSG + ' · Case를 추가하거나 상품별 건수를 입력하세요', 'bad'); return; }
    run('app_sales_save_all', { ...target, p_memo: L.memo || '', p_cases: allCases.map(payload), p_singles: singlesArr(L.singles, L.notes) }, (r) => {
      const { sv, ...n } = fresh(); setL(n); setBad(new Set()); // eslint-disable-line no-unused-vars
      setSt((isP ? pname(promoter) : bname(branch) + ' 직할') + ' ' + ym + ' 매출을 ' + (r.new ? '등록' : '전체 저장') + '했습니다 · ' + won(r.count || 0) + '건 · ' + won(r.amount || 0) + '원', 'ok');
    });
  };
  const addCase = () => {
    const used = L.cases.map((c) => c.no).concat(saved.map((c) => c.no));
    dirty({ cases: L.cases.concat([{ key: null, no: (used.length ? Math.max(...used) : 0) + 1, name: '', headcount: 1, memo: '', products: [''] }]) });
    setTimeout(() => { const l = caseBox.current && caseBox.current.querySelector('.case:last-child .prod'); if (l) { l.scrollIntoView({ block: 'center' }); l.focus({ preventScroll: true }); } }, 0);
  };
  const toggleSaved = () => {
    const fresh = L.cases.filter((c) => !savedCase(keyOf(c)));
    const lost = L.showSaved && L.cases.some((c) => savedCase(keyOf(c)) && !sameAsSaved(c));
    const show = !L.showSaved;
    setL((x) => ({ ...x, showSaved: show, cases: (show ? saved.map(toLocal) : []).concat(fresh), dirty: fresh.length > 0, editing: new Map() }));
    setSt(lost ? '저장하지 않은 Case 수정 내용은 버렸습니다' : '', lost ? 'warn' : '');
  };
  const changeHead = (fn) => { fn(); setBad(new Set()); setSt(''); setL((x) => ({ ...x, base: null, head: null, dirty: false })); };
  const revert = () => { const { sv, ...n } = fresh(); setL(n); setBad(new Set()); setSt(''); }; // eslint-disable-line no-unused-vars

  if (!bc.length) return (<div className="page"><Head isP={isP} GEN={GEN} /><Card><h2>볼 수 있는 지국이 없습니다</h2><p className="note">{isP ? '관리자에게 「권한 관리」에서 홍보팀장 연결을 요청하세요.' : GEN ? '관리자 → 수당 관리 → 총국장 수당관리에서 총국장 직할 지국을 정해 주세요.' : '관리자에게 「권한 관리」에서 소속 지국 지정을 요청하세요.'}</p></Card></div>);
  // 합계
  let A = 0, R = 0, M = 0, HC = 0, SQ = 0, DQ = 0;
  allCases.forEach((c) => { const u = unit(c, pm); const n = Number(c.headcount) || 0; HC += n; A += u.a * n; R += u.r * n; M += u.m * n; });
  L.singles.forEach((n, pid) => { const p = pm.get(pid) || {}; if (n > 0) SQ += n; else DQ -= n; A += n * (p['판매가'] || 0); R += n * (p['인정액'] || 0); M += n * (p['수당'] || 0); });
  const ranges = applicantRanges(allCases); const cq = caseQty(allCases);
  const modeText = lock ? ym + ' 매출은 ' + lock.ym + ' 월급 마감으로 고칠 수 없습니다 (보기만 가능) · '
    : entry ? '등록된 매출을 수정합니다' + (entry.updated_by ? ' (마지막 수정: ' + entry.updated_by + ' ' + (entry.updated_at || '') + ')' : '') + ' · ' : (branch && (!isP || promoter) ? '아직 등록되지 않은 달입니다 · Case를 추가해 저장하세요 · ' : '');
  const nS = saved.length;
  const T = { cq: 0, n: 0, a: 0, r: 0, m: 0 };
  return (
    <div className="page">
      <Head isP={isP} GEN={GEN} />
      <section className="grid2">
        <div className="card">
          <div className="card-h"><h2>{isP ? '홍보팀장 KDC 월 매출' : (GEN ? '총국장 직할 · ' + bname(branch) : directName(branch)) + ' KDC 월 매출'}</h2>
            <div className="acts"><Btn onClick={revert}>되돌리기</Btn><Btn kind="primary" onClick={saveAll}>전체 저장</Btn></div></div>
          <p className="note">{modeText}<Status s={st} /></p>
          <div className="form3">
            <Field label="연월"><input type="month" aria-label="연월" value={ym} {...inv(bad, 'ym')} onChange={(e) => e.target.value && changeHead(() => setYm(e.target.value))} /></Field>
            <Field label="지국"><select aria-label="지국" value={branch} disabled={bc.length <= 1 && !!branch} {...inv(bad, 'br')} onChange={(e) => changeHead(() => { setBranch(e.target.value); setPromoter(''); })}>{bc.length > 1 && <option value="">지국 선택</option>}{bc.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
            {isP && <Field label="홍보팀장"><select aria-label="홍보팀장" value={promoter} disabled={pc.length <= 1 && !!promoter} {...inv(bad, 'pr')} onChange={(e) => changeHead(() => setPromoter(e.target.value))}>{pc.length > 1 && <option value="">홍보팀장 선택</option>}{pc.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>}
            <Field label="비고" className="wide"><input className="in" type="text" maxLength={200} aria-label="비고" value={L.memo} onChange={(e) => dirty({ memo: e.target.value })} /></Field>
          </div>
          {isP && branch && !pc.length && <p className="status" data-kind="warn">이 지국에 등록된 홍보팀장이 없습니다</p>}
          <dl className="sum">{[['Case', won(allCases.length) + '개 · 등록자 ' + won(HC) + '명'], ['개별 판매', won(SQ) + '건' + (DQ ? ' · 미승인 차감 ' + won(DQ) + '건' : '')], ['매출 합계 (판매가)', won(A) + '원'], ['인정액 합계', won(R) + '원'], ['수당 합계', won(M) + '원'], ['지급', ym ? ymText(addYm(ym, 2)) + ' 월급' : '—']].map(([k, v]) => [<dt key={k}>{k}</dt>, <dd key={k + 'v'}>{v}</dd>])}</dl>
        </div>
        <div className="card"><Side isP={isP} GEN={GEN} ym={ym} branch={branch} promoter={promoter} onPick={(k) => changeHead(() => setYm(k))} /></div>
      </section>
      <Card>
        <div className="card-h"><h2>Case별 매출 등록</h2>
          <div className="acts">{(nS > 0 || L.showSaved) && <Btn onClick={toggleSaved}>{L.showSaved ? '저장된 Case 닫기' : '저장된 Case 수정 (' + nS + ')'}</Btn>}<Btn kind="primary" onClick={addCase}>+ Case 추가</Btn></div></div>
        <p className="note">Case = 상품 최대 {MAXP}개 묶음 × 등록자 수 · 등록자 1명 = 신청자 1명 (Case 순서대로 신청자-1, 신청자-2 … 번호가 붙어 저장) · 「Case 저장」은 그 Case만, 「전체 저장」은 모든 Case와 개별 건수를 저장합니다</p>
        {!L.showSaved && nS > 0 && <p className="note info">이 달에 저장된 Case {won(nS)}개 (등록자 {won(sum(saved, 'headcount'))}명)는 아래 「상품별 건수」에 합쳐 보입니다 · 여기서는 새로 등록할 Case만 추가합니다</p>}
        <div className="cases" ref={caseBox}>
          {!L.cases.length && <p className="note empty">{nS && !L.showSaved ? '새로 등록할 Case가 없습니다 · 「+ Case 추가」를 눌러 상품 묶음을 만드세요' : '등록된 Case가 없습니다 · 「+ Case 추가」를 눌러 상품 묶음을 만드세요'}</p>}
          {L.cases.map((c, i) => {
            const existed = !!savedCase(keyOf(c)); const ok = sameAsSaved(c); const u = unit(c, pm); const n = Number(c.headcount) || 0; const taken = new Set(c.products.filter(Boolean));
            const setHc = (v) => setCase(i, { headcount: v });
            return (
              <article className="case" key={keyOf(c)}>
                <div className="case-top">
                  <div className="case-lab"><strong>Case {c.no}</strong><code className="case-key">{rangeText(prefix, ranges[i + offset] || { from: 1, to: 0 })}</code></div>
                  <input className="in case-name" type="text" maxLength={40} placeholder="Case 이름 (예: 미라클 3종)" aria-label={'Case ' + c.no + ' 이름'} value={c.name || ''} onChange={(e) => setCase(i, { name: e.target.value })} />
                  <span className={'badge ' + (ok ? 'ok' : 'warn')}>{ok ? '저장됨' : existed ? '수정됨 · 저장 전' : '새 Case · 저장 전'}</span>
                  <Btn kind="primary" onClick={() => saveCase(c, i)}>Case 저장</Btn>
                  <Btn aria-label={'Case ' + c.no + ' 빼기'} onClick={() => removeCase(c, i)}>빼기</Btn>
                </div>
                <div className="slots">
                  {c.products.map((pid, s) => (
                    <div className="slot" key={s}><span className="slot-n">{s + 1}</span>
                      <ProductSelect value={pid} taken={taken} label={'Case ' + c.no + ' 상품 ' + (s + 1)} bad={bad.has('c' + i + ':p' + s)} onChange={(v) => { const ps = c.products.slice(); ps[s] = v; setCase(i, { products: ps }); }} />
                      <Btn kind="icon" aria-label={'상품 ' + (s + 1) + ' 빼기'} disabled={c.products.length <= 1} onClick={() => { const ps = c.products.slice(); ps.splice(s, 1); setCase(i, { products: ps }); }}>×</Btn></div>))}
                  <Btn kind="sm" disabled={c.products.length >= MAXP} onClick={() => setCase(i, { products: c.products.concat(['']) })}>{'+ 상품 추가 (' + c.products.length + '/' + MAXP + ')'}</Btn>
                </div>
                <div className="case-foot">
                  <div className="stepper"><span className="field-l">등록자 수</span>
                    <Btn kind="icon" aria-label="등록자 1명 빼기" onClick={() => setHc(Math.max(0, n - 1))}>−</Btn>
                    <input type="number" min="0" max="999" inputMode="numeric" aria-label={'Case ' + c.no + ' 등록자 수'} value={c.headcount === '' || c.headcount == null ? '' : String(c.headcount)} {...inv(bad, 'c' + i + ':hc')} className={(bad.has('c' + i + ':hc') ? 'in invalid' : 'in') + ' num'} onChange={(e) => setHc(e.target.value === '' ? '' : Math.max(0, Math.min(999, Math.floor(Number(e.target.value) || 0))))} />
                    <Btn kind="icon" aria-label="등록자 1명 더하기" onClick={() => setHc(Math.min(999, n + 1))}>+</Btn><span>명</span></div>
                  <div className="case-tot"><div className="note">{'1명 기준 · 판매가 ' + won(u.a) + '원 · 인정액 ' + won(u.r) + '원 · 수당 ' + won(u.m) + '원'}</div><div className="case-sum">{'× ' + won(n) + '명 = 판매가 ' + won(u.a * n) + '원 · 인정액 ' + won(u.r * n) + '원 · 수당 ' + won(u.m * n) + '원'}</div></div>
                </div>
              </article>);
          })}
        </div>
      </Card>
      <Card>
        <h2>상품별 건수</h2>
        <p className="note">합계 건수 = Case 건수 + 따로 판 건수 · 「수정」으로 합계 건수를 바꾸고 「저장」하면 그 상품만 바로 저장됩니다 · Case 건수보다 적게 저장하면 그 차이는 「미승인 차감」으로 남습니다 (본사 미승인 등 · 사유를 적어 두세요) · 등록자 자체가 빠졌다면 「저장된 Case 수정」에서 등록자 수를 줄이세요</p>
        <div className="tbl"><table className="items">
          <thead><tr>{['구분', '업체', '강의명', '판매가', 'Case 건수', '합계 건수', '매출 소계', '인정액 소계', '수당 소계', ''].map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
          <tbody>{products().map((p) => {
            const a = cq.get(p.id) || 0; const b = L.singles.get(p.id) || 0; const ed = L.editing.has(p.id);
            const n = ed ? Math.max(0, L.editing.get(p.id)) : Math.max(0, a + b); const dq = Math.max(0, a - n); const noteV = L.enote.has(p.id) ? L.enote.get(p.id) : (L.notes.get(p.id) || '');
            T.cq += a; T.n += n; T.a += n * (p['판매가'] || 0); T.r += n * (p['인정액'] || 0); T.m += n * (p['수당'] || 0);
            const setN = (v) => { v = Math.max(0, Math.min(9999, Math.floor(Number(v) || 0))); const m = new Map(L.editing); m.set(p.id, v); setL((x) => ({ ...x, editing: m })); };
            return (
              <tr key={p.id} className={(n ? 'on' : '') + (ed ? ' editing' : '')}>
                <td>{cn.get(p.categoryId) || ''}</td><td>{vn.get(p.vendorId) || ''}</td><td className="title">{p['강의명'] || ''}</td><td className="num">{won(p['판매가'] || 0)}</td><td className={'num' + (a ? '' : ' muted')}>{won(a)}</td>
                <td className="num">{ed ? (<><div className="stepper"><Btn kind="icon" aria-label={(p['강의명'] || '') + ' 1건 빼기'} disabled={n <= 0} onClick={() => setN(n - 1)}>−</Btn>
                  <input className="in num tq" type="number" min={0} inputMode="numeric" aria-label={(p['강의명'] || '') + ' 합계 건수'} value={String(n)} onChange={(e) => { if (e.target.value !== '') setN(e.target.value); }} />
                  <Btn kind="icon" aria-label={(p['강의명'] || '') + ' 1건 더하기'} onClick={() => setN(n + 1)}>+</Btn></div>{a > 0 && (dq ? <div className="note deduct">{'Case ' + won(a) + '건 중 미승인 차감 ' + won(dq) + '건'}</div> : <div className="note">Case {won(a)}건 포함</div>)}
                  {dq > 0 && <input className="in deduct-note" type="text" maxLength={200} placeholder="차감 사유 (예: 본사 미승인 · 서류 미비)" aria-label={(p['강의명'] || '') + ' 차감 사유'} value={noteV} onChange={(e) => { const m = new Map(L.enote); m.set(p.id, e.target.value); setL((x) => ({ ...x, enote: m })); }} />}</>)
                  : <>{won(n)}{dq > 0 && <div className="note deduct" title={noteV || undefined}>{'미승인 차감 ' + won(dq) + '건' + (noteV ? ' · ' + noteV : '')}</div>}</>}</td>
                <td className="num">{won(n * (p['판매가'] || 0))}</td><td className="num">{won(n * (p['인정액'] || 0))}</td><td className="num">{won(n * (p['수당'] || 0))}</td>
                <td className="act">{ed ? <><Btn kind="primary sm" onClick={() => saveItem(p, a)}>저장</Btn><Btn kind="sm" onClick={() => { const m = new Map(L.editing); m.delete(p.id); const en = new Map(L.enote); en.delete(p.id); setL((x) => ({ ...x, editing: m, enote: en })); }}>취소</Btn></>
                  : <Btn kind="sm" onClick={() => { const m = new Map(L.editing); m.set(p.id, Math.max(0, a + b)); setL((x) => ({ ...x, editing: m })); }}>수정</Btn>}</td>
              </tr>);
          })}</tbody>
          <tfoot><tr><td colSpan={4}>합계</td><td className="num">{won(T.cq)}</td><td className="num">{won(T.n)}</td><td className="num">{won(T.a)}</td><td className="num">{won(T.r)}</td><td className="num">{won(T.m)}</td><td /></tr></tfoot>
        </table></div>
      </Card>
    </div>
  );
}

const Head = ({ isP, GEN }) => <PageHead eyebrow={isP ? '홍보팀장' : GEN ? '총국장' : '지국장'} title={isP ? 'KDC 매출 등록' : '직할 매출 등록'}
  lede={isP ? '홍보팀장 본인의 KDC 월 매출을 등록합니다. KDC 매출에 따른 수당은 매출 월 + 2개월 뒤(예: 10월 매출 → 12월 월급)에 지급됩니다.' : GEN ? '총국장 직할 KDC 매출을 등록합니다. 총국장 직할 지국(관리자 → 수당 관리 → 총국장 수당관리에서 지정)의 직할 매출로 저장됩니다.' : '지국장 직할 KDC 매출을 등록합니다. 오른쪽에서 소속 홍보팀장 등록 현황과 지국 합계를 함께 볼 수 있습니다.'} />;

function ProductSelect({ value, taken, label, bad, onChange }) {
  const vn = vendorName(), cn = categoryName(); const groups = new Map();
  products().forEach((p) => { const g = vn.get(p.vendorId) || '업체 없음'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p); });
  return (
    <select className={'in prod' + (bad ? ' invalid' : '')} aria-invalid={bad ? 'true' : undefined} aria-label={label} value={value || ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">상품 선택</option>
      {[...groups.entries()].map(([g, l]) => <optgroup key={g} label={g}>{l.map((p) => <option key={p.id} value={p.id} disabled={taken.has(p.id) && p.id !== value}>{'[' + (cn.get(p.categoryId) || '-') + '] ' + (p['강의명'] || '') + ' · ' + won(p['판매가'] || 0) + '원'}</option>)}</optgroup>)}
      {value && !products().some((p) => p.id === value) && <option value={value}>{'(수당표에 없는 상품) ' + value}</option>}
    </select>
  );
}

function Side({ isP, GEN, ym, branch, promoter, onPick }) {
  const y = (ym || nowYm()).slice(0, 4);
  if (isP) {
    let tot = 0;
    return (<>
      <h2>{(promoter ? pname(promoter) : '홍보팀장') + ' · ' + y + '년'}</h2><p className="note">칸을 누르면 그 달을 불러옵니다 · 각 칸 아래는 지급 월</p>
      <div className="months">{Array.from({ length: 12 }, (_, i) => { const k = y + '-' + pad(i + 1); const e = D.entries.find((x) => x.promoter_id === promoter && x.ym === k); if (e) tot += e.amount;
        return <button key={k} type="button" className={'month' + (e ? ' on' : '') + (k === ym ? ' sel' : '')} onClick={() => onPick(k)}><span className="m">{i + 1}월</span><span className="v">{e ? won(e.amount) + '원' : '미등록'}</span><span className="m">{e ? won(e.cnt) + '건 · ' + Number(addYm(k, 2).slice(5)) + '월 지급' : ''}</span></button>; })}</div>
      <div className="total">{y}년 KDC 합계 {won(tot)}원</div>
    </>);
  }
  const es = D.entries.filter((e) => e.branch_id === branch && e.ym === ym); const fs = D.free.filter((f) => f.branch_id === branch && f.ym === ym);
  const Row = ({ name, e, sub }) => <div className={'row' + (e ? ' on' : '')}><div><div className="row-n">{name}</div><div className="note">{sub + (e ? ' · ' + won(e.cnt) + '건' : '')}</div></div><div className="row-v">{e ? won(e.amount) + '원' : '미등록'}</div></div>;
  const df = sum(fs.filter((f) => !f.promoter_id), 'amount');
  const ps = D.promoters.filter((p) => p.branch_id === branch && (p.active !== false || es.some((e) => e.promoter_id === p.id)));
  return (<>
    <h2>{bname(branch) + ' · ' + Number((ym || nowYm()).slice(5)) + '월 지국 합계'}</h2><p className="note">지국 매출 = 지국 직할 + 소속 홍보팀장</p>
    <div className="rows">
      <Row name={GEN ? '총국장 직할 · ' + bname(branch) : directName(branch)} e={es.find((e) => !e.promoter_id)} sub={(GEN ? '총국장 직할' : '지국장 직할') + ' · 이 화면에서 입력' + (df ? ' · 자율학기제 ' + won(df) + '원' : '')} />
      {ps.map((p) => { const fa = sum(fs.filter((f) => f.promoter_id === p.id), 'amount'); return <Row key={p.id} name={p.name} e={es.find((x) => x.promoter_id === p.id)} sub={'홍보팀장' + (fa ? ' · 자율학기제 ' + won(fa) + '원' : '')} />; })}
    </div>
    <div className="total">{'지국 KDC 합계 ' + won(sum(es, 'amount')) + '원 · ' + won(sum(es, 'cnt')) + '건' + (sum(fs, 'amount') ? ' · 자율학기제 ' + won(sum(fs, 'amount')) + '원 별도' : '')}</div>
  </>);
}
