// 관리자: 수당 현황(사람 × 수당 항목) · 수당 등록(수당 항목 + 사람별 조건)
import { useEffect, useRef, useState } from 'react';
import { D, save } from '../lib/store.js';
import { MSG, nowYm, errText } from '../lib/ui.js';
import { items, rows, people, person, effective, condText, periodText, TYPES, BASES, typeName, baseName, needsBasis, pct } from '../lib/pay.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, Field, MoneyInput, PageHead, Status, useStatus } from '../components/ui.jsx';

// 수당 현황 → 수당 등록으로 넘길 선택 (화면을 옮겨도 유지)
const ED = { item: '', draft: null, people: new Set(), pBranch: '', q: '', cond: null, scrollTo: null };
const goEdit = (preset) => {
  if (preset.item === '__new') { ED.item = '__new'; ED.draft = null; }
  else if (preset.item) { ED.item = preset.item; ED.draft = null; ED.cond = { item_id: preset.item }; }
  if (preset.people) { ED.people = new Set(preset.people); const p = person(preset.people[0]); if (p) ED.pBranch = p.branch; }
  ED.scrollTo = preset.people ? 'cond' : 'item';
  location.hash = '#/payedit';
};
const PctInput = ({ label, value, onChange, className = '' }) => {
  const [v, setV] = useState(value == null || value === '' ? '' : String(Math.round(value * 10000) / 100));
  return <span className="money"><input className={'in money-in' + (className ? ' ' + className : '')} type="number" step="0.1" min="0" inputMode="decimal" aria-label={label} value={v} onChange={(e) => { setV(e.target.value); onChange(e.target.value === '' ? null : Number(e.target.value) / 100); }} /><span className="money-u">%</span></span>;
};
const FI = ({ l, children }) => <label className="field inline"><span className="field-l">{l}</span>{children}</label>;

export function PayList() {
  useData();
  const [branch, setBranch] = useState(''); const [ym, setYm] = useState(nowYm()); const [q, setQ] = useState('');
  const its = items().filter((i) => i.active !== false);
  const ppl = people().filter((p) => p.active && (!branch || p.branch === branch) && p.role === 'promoter' && (!q || p.name.includes(q.trim()) || p.bname.includes(q.trim())));
  const R = rows();
  return (
    <div className="page">
      <PageHead eyebrow="관리자" title="수당 현황" lede="홍보팀장 수당 항목과 사람마다 적용된 수당 조건을 한눈에 봅니다. 칸을 누르면 그 사람·수당의 조건을 바로 등록할 수 있습니다. 지국장 수당은 「수당 관리 → 지국장 수당관리」에서 정합니다." />
      <Card><div className="toolbar">
        <FI l="지국"><select className="in" aria-label="지국" value={branch} onChange={(e) => setBranch(e.target.value)}><option value="">전체 지국</option>{D.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></FI>
        <FI l="구분"><select className="in" aria-label="구분" value="promoter" disabled><option value="promoter">홍보팀장</option></select></FI>
        <FI l="기준월"><input className="in" type="month" aria-label="기준월" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} /></FI>
        <FI l="검색"><input className="in" type="search" placeholder="이름 검색" aria-label="이름 검색" value={q} onChange={(e) => setQ(e.target.value)} /></FI>
      </div></Card>
      <Card>
        <div className="card-h"><h2>수당 항목 {its.length}개</h2><Btn kind="primary" onClick={() => goEdit({ item: '__new' })}>+ 수당 항목 등록</Btn></div>
        <div className="tiles">{its.map((it) => <button key={it.id} type="button" className="tile" onClick={() => goEdit({ item: it.id })}><strong>{it.name}</strong><span className="note">{typeName(it.calc_type) + (needsBasis(it.calc_type) ? ' · ' + baseName(it.basis) : '')}</span><span className="note">{'기본 적용: ' + (it.apply_default.length ? it.apply_default.map((r) => (r === 'branch' ? '지국장' : '홍보팀장')).join(', ') : '없음 (사람별 지정)')}</span></button>)}</div>
      </Card>
      <Card>
        <h2>{'사람별 적용 현황 · ' + ym + ' 기준 (' + ppl.length + '명)'}</h2>
        <p className="note">칸을 누르면 그 사람·수당의 조건 등록 화면으로 갑니다 · 「기본」 = 직급 기본 적용, 파란 칸 = 사람별 조건, 「제외」 = 받지 않음, – = 적용 안 됨</p>
        <div className="tbl"><table className="items matrix">
          <thead><tr><th>대상자</th><th>지국</th>{its.map((it) => <th key={it.id}>{it.name}</th>)}<th>사람별 조건</th></tr></thead>
          <tbody>{ppl.map((p) => { const n = R.filter((r) => r.person_key === p.key && r.active !== false).length; return (
            <tr key={p.key}><td><div>{p.name}</div><div className="note">{p.role === 'branch' ? '지국장' : '홍보팀장 ' + (p.code || '')}</div></td><td>{p.bname}</td>
              {effective(p.key, p.role, ym).map((e) => <td key={e.it.id} className={'cell ' + e.src}><button type="button" className="cell-b" aria-label={p.name + ' · ' + e.it.name + ' 조건 등록'} onClick={() => goEdit({ item: e.it.id, people: [p.key] })}>
                <div>{e.src === 'default' ? '기본' + (condText(e) ? ' · ' + condText(e) : '') : e.src === 'person' ? condText(e) : e.src === 'exclude' ? '제외' : '–'}</div>{e.row && <div className="note">{periodText(e.row)}</div>}</button></td>)}
              <td className="num">{n ? n + '건' : ''}</td></tr>); })}</tbody>
        </table></div>
      </Card>
    </div>
  );
}

const copyItem = (src) => { const x = JSON.parse(JSON.stringify(src)); x.tiers = (x.tiers || []).slice().sort((a, b) => (a.base || 0) - (b.base || 0)); return x; };
const newItem = () => ({ id: 'fi_' + Date.now().toString(36), name: '', calc_type: '', basis: 'none', unit: '', input_label: '', default_value: 0, default_rate: 0, tiers: [], apply_default: [], max_times: null, sort_order: items().length + 1, active: true, memo: '', _new: true });

export function PayEdit() {
  useData();
  const its = items();
  if (!ED.item) ED.item = its[0] ? its[0].id : '__new';
  const [item, setItem] = useState(ED.item);
  const [d, setD] = useState(() => { const src = its.find((i) => i.id === ED.item); if (!src) ED.item = '__new'; return src ? copyItem(src) : newItem(); });
  const [ver, setVer] = useState(0); // 구간표·입력칸 다시 그리기
  const [st1, setSt1] = useStatus(); const [st2, setSt2] = useStatus(); const [st3, setSt3] = useStatus();
  const [bad, setBad] = useState(new Set()); const [cbad, setCbad] = useState(new Set());
  const [C, setC] = useState(() => { const c = ED.cond || {}; return { item_id: c.item_id || (ED.item !== '__new' ? ED.item : ''), mode: c.mode || 'apply', value: c.value ?? null, rate: c.rate ?? null, valid_from: c.valid_from || nowYm(), valid_to: c.valid_to || '', memo: c.memo || '' }; });
  const [sel, setSel] = useState(() => new Set(ED.people)); const [pBranch, setPBranch] = useState(ED.pBranch); const [pq, setPq] = useState(ED.q);
  const c1 = useRef(null); const c2 = useRef(null);
  useEffect(() => { ED.people = sel; ED.pBranch = pBranch; ED.q = pq; ED.cond = C; }, [sel, pBranch, pq, C]);
  useEffect(() => { if (ED.scrollTo) { const t = ED.scrollTo === 'cond' ? c2.current : c1.current; ED.scrollTo = null; setTimeout(() => { try { t && t.scrollIntoView({ block: 'start' }); } catch (_) {} }, 30); } }, []);
  const pickItem = (id) => { ED.item = id; setItem(id); const src = items().find((i) => i.id === id); setD(src ? copyItem(src) : newItem()); setVer((v) => v + 1); setBad(new Set()); setSt1(''); };
  const up = (patch) => { setD((x) => ({ ...x, ...patch })); setBad((b) => { const n = new Set(b); Object.keys(patch).forEach((k) => n.delete(k)); return n; }); };
  const basisOf = (x, bsv) => (needsBasis(x.calc_type) ? bsv : x.calc_type === 'product' ? 'commission' : (bsv === 'recognized_dues' ? 'recognized_dues' : 'none'));
  const [bsv, setBsv] = useState(d.basis || 'none');
  useEffect(() => { setBsv(d.basis || 'none'); }, [ver]); // eslint-disable-line react-hooks/exhaustive-deps
  const ct = d.calc_type;
  const tiersSorted = (d.tiers || []).slice().sort((a, b) => (a.base || 0) - (b.base || 0));
  const saveItem = async () => {
    const x = { ...d, basis: basisOf(d, bsv) }; const need = [];
    if (!x.name.trim()) need.push('name'); if (!x.calc_type) need.push('calc_type'); if (needsBasis(x.calc_type) && (!x.basis || x.basis === 'none')) need.push('basis');
    if (x.calc_type === 'tier') { tiersSorted.forEach((t, i) => { if (t.base == null) need.push('t' + i); }); if (!tiersSorted.length) { setSt1(MSG + ' · 구간을 1개 이상 추가하세요', 'bad'); return; } }
    if ((x.calc_type === 'per_unit' || x.calc_type === 'input') && !(x.input_label || '').trim()) need.push('input_label');
    if (need.length) { setBad(new Set(need)); setSt1(MSG, 'bad'); setTimeout(() => { const f = c1.current && c1.current.querySelector('[aria-invalid=true]'); if (f) f.focus(); }, 0); return; }
    if (its.some((i) => i.name === x.name.trim() && i.id !== x.id)) { setBad(new Set(['name'])); setSt1('같은 이름의 수당 항목이 있습니다', 'bad'); return; }
    const p = { id: x.id, name: x.name.trim(), calc_type: x.calc_type, basis: x.basis, unit: x.unit, input_label: (x.input_label || '').trim(), default_value: x.default_value || 0, default_rate: x.default_rate || 0, tiers: tiersSorted.filter((t) => t.base != null).map((t) => ({ base: t.base, ...(t.rate != null && t.rate !== '' ? { rate: t.rate } : { amount: t.amount || 0 }) })), apply_default: x.apply_default, max_times: x.max_times || null, sort_order: x.sort_order || 0, active: x.active !== false, memo: x.memo || '' };
    try { const r = await save('app_fee_item_save', { p }); pickItem(p.id); setSt1(p.name + ' 수당 항목을 ' + (r && r.new ? '등록' : '저장') + '했습니다', 'ok'); } catch (e) { setSt1(errText(e), 'bad'); }
  };
  const inv = (k) => (bad.has(k) ? { 'aria-invalid': 'true', className: 'in invalid' } : { className: 'in' });
  // ---- 2. 사람별 조건 ----
  const activeIts = its.filter((i) => i.active !== false);
  const cit = activeIts.some((i) => i.id === C.item_id) ? C.item_id : '';
  const it2 = its.find((i) => i.id === cit);
  const showCv = C.mode !== 'exclude' && it2 && ['per_unit', 'fixed'].includes(it2.calc_type); const showCr = C.mode !== 'exclude' && it2 && ['rate', 'product'].includes(it2.calc_type);
  const hint = !it2 ? '' : C.mode === 'exclude' ? '고른 사람은 이 기간에 「' + it2.name + '」을(를) 받지 않습니다' : it2.calc_type === 'product' ? '비율을 넣으면 이 사람은 상품별 수당 대신 「인정액 × 비율」로 계산됩니다' : it2.calc_type === 'tier' ? '구간표는 수당 항목의 기본 구간표를 씁니다' : it2.calc_type === 'input' ? '금액은 매월 월급 계산 화면에서 입력합니다' : '';
  const setCC = (patch) => { setC((x) => ({ ...x, ...patch })); setCbad((b) => { const n = new Set(b); Object.keys(patch).forEach((k) => n.delete(k)); return n; }); };
  const ppl = people().filter((p) => p.active && p.role === 'promoter' && (!pBranch || p.branch === pBranch) && (!pq || p.name.includes(pq.trim())));
  const byB = new Map(); ppl.forEach((p) => { if (!byB.has(p.branch)) byB.set(p.branch, []); byB.get(p.branch).push(p); });
  const toggle = (keys, on) => setSel((s) => { const n = new Set(s); keys.forEach((k) => (on ? n.add(k) : n.delete(k))); return n; });
  const register = async () => {
    const need = []; if (!cit) need.push('item_id'); if (!C.valid_from) need.push('valid_from');
    if (need.length) { setCbad(new Set(need)); setSt2(MSG, 'bad'); return; }
    if (C.valid_to && C.valid_to < C.valid_from) { setCbad(new Set(['valid_to'])); setSt2('종료월이 시작월보다 빠릅니다', 'bad'); return; }
    if (!sel.size) { setSt2(MSG + ' · 대상자를 1명 이상 고르세요', 'bad'); return; }
    const p = { people: Array.from(sel), item_id: cit, mode: C.mode, value: showCv ? C.value : null, rate: showCr ? C.rate : null, valid_from: C.valid_from, valid_to: C.valid_to || null, memo: (C.memo || '').trim() };
    try { const r = await save('app_person_fee_save', { p }); setSt2(((r && r.count) || p.people.length) + '명에게 「' + it2.name + '」 조건을 등록했습니다', 'ok'); } catch (e) { setSt2(errText(e), 'bad'); }
  };
  // ---- 3. 등록된 조건 ----
  const list = rows().filter((r) => r.active !== false && (sel.size ? sel.has(r.person_key) : (!cit || r.item_id === cit))).sort((a, b) => a.person_key.localeCompare(b.person_key) || (b.valid_from || '').localeCompare(a.valid_from || ''));
  const release = async (r) => { const p = person(r.person_key); const it = its.find((i) => i.id === r.item_id) || { name: r.item_id }; try { await save('app_person_fee_save', { p: { ...r, active: false } }); setSt3((p ? p.name : r.person_key) + ' · ' + it.name + ' 조건을 해제했습니다', 'ok'); } catch (e) { setSt3(errText(e), 'bad'); } };
  return (
    <div className="page">
      <PageHead eyebrow="관리자" title="수당 등록" lede="새 수당 항목을 만들고, 사람마다 다른 수당 조건(적용·제외·금액·비율·기간)을 등록합니다." />
      <section className="card" ref={c1}>
        <div className="card-h"><h2>1. 수당 항목</h2>
          <div className="acts"><select className="in" aria-label="수당 항목 선택" value={item} onChange={(e) => pickItem(e.target.value)}>{its.map((i) => <option key={i.id} value={i.id}>{i.name + (i.active === false ? ' (사용 안 함)' : '')}</option>)}<option value="__new">+ 새 수당 항목</option></select>
            <Btn kind="primary" onClick={saveItem}>{d._new ? '수당 항목 등록' : '수당 항목 저장'}</Btn></div></div>
        <p className="note">새 수당이 생기면 여기서 추가합니다 · 직급 기본 적용을 고르지 않으면 「사람별 조건」으로 지정한 사람만 받습니다</p>
        <Status s={st1} />
        <div className="form3" key={'f' + ver}>
          <Field label="수당 이름"><input {...inv('name')} type="text" maxLength={40} value={d.name} onChange={(e) => up({ name: e.target.value })} /></Field>
          <Field label="계산 방식"><select {...inv('calc_type')} value={ct || ''} onChange={(e) => up({ calc_type: e.target.value })}><option value="">계산 방식 선택</option>{TYPES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>
          {needsBasis(ct) && <Field label="계산 기준"><select {...inv('basis')} value={bsv} onChange={(e) => { setBsv(e.target.value); setBad((b) => { const n = new Set(b); n.delete('basis'); return n; }); }}><option value="none">계산 기준 선택</option>{BASES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}</select></Field>}
          {(ct === 'per_unit' || ct === 'input' || bsv === 'recognized_dues') && <Field label="월급 계산 입력 칸 이름"><input {...inv('input_label')} type="text" maxLength={30} placeholder="예: 리크루팅 인원, 시책금액" value={d.input_label || ''} onChange={(e) => up({ input_label: e.target.value })} /></Field>}
          {ct === 'per_unit' && <Field label="단위"><input className="in" type="text" maxLength={6} placeholder="건 / 명 / 원" value={d.unit || ''} onChange={(e) => up({ unit: e.target.value })} /></Field>}
          {['per_unit', 'fixed'].includes(ct) && <Field label="기본 금액"><MoneyInput value={d.default_value || 0} label="기본 금액" onChange={(v) => up({ default_value: v })} /></Field>}
          {ct === 'rate' && <Field label="기본 비율"><PctInput label="기본 비율" value={d.default_rate || null} onChange={(v) => up({ default_rate: v || 0 })} /></Field>}
          <Field label="최대 지급 횟수 (비우면 제한 없음)"><input className="in num" type="number" min="1" value={d.max_times ? String(d.max_times) : ''} onChange={(e) => up({ max_times: e.target.value === '' ? null : Math.max(1, Math.floor(Number(e.target.value) || 1)) })} /></Field>
          <Field label="직급 기본 적용 (사람별 조건으로 바꿀 수 있음)" className="wide"><div className="checks"><label className="check"><input type="checkbox" checked={d.apply_default.includes('promoter')} onChange={(e) => up({ apply_default: d.apply_default.filter((x) => x !== 'promoter').concat(e.target.checked ? ['promoter'] : []) })} /> 홍보팀장</label></div></Field>
          <Field label="사용 여부"><label className="check"><input type="checkbox" checked={d.active !== false} onChange={(e) => up({ active: e.target.checked })} /> 사용</label></Field>
          <Field label="비고" className="wide"><input className="in" type="text" value={d.memo || ''} onChange={(e) => up({ memo: e.target.value })} /></Field>
        </div>
        <p className="note info">{ct ? (TYPES.find((x) => x[0] === ct) || [])[2] : '계산 방식을 고르면 필요한 칸이 나타납니다'}</p>
        {ct === 'tier' && <div className="tiers" key={'t' + ver}>
          <div className="field-l">구간표 · 기준 금액이 「기준액 이상」이면 그 줄의 지급액 (비율을 넣으면 기준 금액 × 비율)</div>
          {(d.tiers || []).map((t, i) => (
            <div className="tier-r" key={i}>
              <span className="note">기준액</span><MoneyInput value={t.base} label={(i + 1) + '구간 기준액'} invalid={bad.has('t' + i)} className="tbase" onChange={(v) => { const ts = d.tiers.slice(); ts[i] = { ...t, base: v || null }; up({ tiers: ts }); setBad((b) => { const n = new Set(b); n.delete('t' + i); return n; }); }} />
              <span className="note">이상 → 지급액</span><MoneyInput value={t.amount} label={(i + 1) + '구간 지급액'} onChange={(v) => { const ts = d.tiers.slice(); ts[i] = { ...t, amount: v }; up({ tiers: ts }); }} />
              <span className="note">또는 비율</span><PctInput label={(i + 1) + '구간 비율'} value={t.rate} onChange={(v) => { const ts = d.tiers.slice(); ts[i] = { ...t, rate: v }; up({ tiers: ts }); }} />
              <Btn kind="sm" onClick={() => { up({ tiers: d.tiers.filter((_, j) => j !== i) }); setVer((v) => v + 1); }}>빼기</Btn>
            </div>))}
          <Btn kind="sm" onClick={() => up({ tiers: (d.tiers || []).concat([{ base: null, amount: null, rate: null }]) })}>+ 구간 추가</Btn>
        </div>}
      </section>
      <section className="card" ref={c2}>
        <div className="card-h"><h2>2. 사람별 수당 조건 등록</h2><Btn kind="primary" onClick={register}>조건 등록</Btn></div>
        <p className="note">대상자를 골라 이 사람들만의 수당 조건을 등록합니다 · 금액·비율을 비우면 수당 항목 기본값 · 기간이 겹치면 시작월이 늦은 조건이 우선</p>
        <Status s={st2} />
        <div className="form3">
          <Field label="수당 항목"><select className={'in' + (cbad.has('item_id') ? ' invalid' : '')} value={cit} onChange={(e) => setCC({ item_id: e.target.value })}><option value="">수당 항목 선택</option>{activeIts.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}</select></Field>
          <Field label="적용 여부"><select className="in" value={C.mode} onChange={(e) => setCC({ mode: e.target.value })}><option value="apply">적용 (지급)</option><option value="exclude">제외 (지급 안 함)</option></select></Field>
          {showCv && <Field label="개인 금액 (비우면 기본값)"><MoneyInput value={C.value} label="개인 금액" onChange={(v) => setCC({ value: v || null })} /></Field>}
          {showCr && <Field label="개인 비율 (비우면 기본값)"><PctInput label="개인 비율" value={C.rate} onChange={(v) => setCC({ rate: v })} /></Field>}
          <Field label="적용 시작월"><input className={'in' + (cbad.has('valid_from') ? ' invalid' : '')} type="month" aria-label="적용 시작월" value={C.valid_from} onChange={(e) => setCC({ valid_from: e.target.value })} /></Field>
          <Field label="적용 종료월 (비우면 계속)"><input className={'in' + (cbad.has('valid_to') ? ' invalid' : '')} type="month" aria-label="적용 종료월" value={C.valid_to} onChange={(e) => setCC({ valid_to: e.target.value })} /></Field>
          <Field label="비고" className="wide"><input className="in" type="text" placeholder="예: 신규 등록 6개월 정착수당" value={C.memo} onChange={(e) => setCC({ memo: e.target.value })} /></Field>
        </div>
        <p className="note">{hint}</p>
        <h3>대상자</h3>
        <div className="toolbar">
          <FI l="대상자 지국"><select className="in" aria-label="대상자 지국" value={pBranch} onChange={(e) => setPBranch(e.target.value)}><option value="">전체 지국</option>{D.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></FI>
          <FI l="검색"><input className="in" type="search" placeholder="이름 검색" aria-label="대상자 검색" value={pq} onChange={(e) => setPq(e.target.value)} /></FI>
          <span className="note">{sel.size}명 선택</span>
        </div>
        <div className="people">
          {[...byB.values()].map((l) => (
            <fieldset className="pgroup" key={l[0].branch}>
              <legend><label className="check"><input type="checkbox" checked={l.every((p) => sel.has(p.key))} onChange={(e) => toggle(l.map((p) => p.key), e.target.checked)} /> {l[0].bname} 전체</label></legend>
              <div className="pchips">{l.map((p) => <label key={p.key} className={'pchip' + (sel.has(p.key) ? ' on' : '')}><input type="checkbox" checked={sel.has(p.key)} onChange={(e) => toggle([p.key], e.target.checked)} /> {p.name}</label>)}</div>
            </fieldset>))}
          {!ppl.length && <p className="note">대상자가 없습니다</p>}
        </div>
      </section>
      <Card>
        <h2>{'3. 등록된 사람별 조건 (' + list.length + '건)'}</h2>
        <p className="note">고른 대상자(없으면 고른 수당 항목 전체)의 사람별 조건 · 「해제」하면 기록은 남고 계산에서 빠집니다</p>
        <Status s={st3} />
        {!list.length ? <p className="note empty">등록된 조건이 없습니다</p> :
          <div className="tbl"><table className="items compact">
            <thead><tr>{['대상자', '수당 항목', '구분', '값', '기간', '비고', ''].map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
            <tbody>{list.map((r) => { const p = person(r.person_key); const it = its.find((i) => i.id === r.item_id) || { name: r.item_id };
              const v = r.mode === 'exclude' ? '' : [r.value != null ? Number(r.value).toLocaleString('ko-KR') + '원' : '', r.rate != null ? pct(r.rate) : '', Array.isArray(r.tiers) && r.tiers.length ? '개인 구간표' : ''].filter(Boolean).join(' · ') || '기본값';
              return <tr key={r.id}><td>{p ? p.name + ' (' + p.bname + ')' : r.person_key}</td><td>{it.name}</td><td>{r.mode === 'exclude' ? '제외' : '적용'}</td><td>{v}</td><td>{periodText(r)}</td><td className="note">{r.memo || ''}</td><td className="act"><ReleaseBtn onClick={() => release(r)} /></td></tr>; })}</tbody>
          </table></div>}
      </Card>
    </div>
  );
}
const ReleaseBtn = ({ onClick }) => { const [b, setB] = useState(false); return <Btn kind="sm" disabled={b} onClick={async () => { setB(true); await onClick(); setB(false); }}>해제</Btn>; };
