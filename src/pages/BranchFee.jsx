// 관리자 · 수당 관리 → 지국장(총국장) 수당관리: 수당 항목 · 국장수당/조직회원운영비 구간 · K-디지털 시책(월별) · 적립금 한도
// kind: 'branch' = 지국장 수당관리 (settings.branch_fee) · 'general' = 총국장 수당관리 (settings.general_fee, 처음엔 지국장 기준 복사본)
import { useReducer, useRef, useState } from 'react';
import { D, save } from '../lib/store.js';
import { won, pad, nowYm, MSG, errText, addYm as addYmL } from '../lib/ui.js';
import { config, DEFAULT, TYPES, MEASURES, SCOPES as SCOPES_B, manwon, srcLabel, generalBranch, generalCopy, GRADES, GRADE_TABLE, RANKS, GENERAL_ITEMS, SPLIT_MONTHS } from '../lib/branchpay.js';
import Grades from './Grades.jsx';
import { Btn, ConfirmBtn, MoneyInput, Status, useStatus } from '../components/ui.jsx';

const clone = (v) => JSON.parse(JSON.stringify(v));
const Sel = ({ opts, value, label, onChange, className = 'in' }) => <select className={className} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{opts.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>;

export default function BranchFee({ kind = 'branch' }) {
  const G = kind === 'general'; const KEY = G ? 'general_fee' : 'branch_fee'; const WHO = G ? '총국장' : '지국장';
  const SCOPES = G ? [['own', '총국장 직할 매출'], ['branch', '총국 전체 매출 (모든 지국)']] : SCOPES_B;
  const S = useRef({ d: null, sig: '', dirty: false, year: Number(nowYm().slice(0, 4)), pm: nowYm() }); const [, force] = useReducer((x) => x + 1, 0);
  const [st, setSt] = useStatus(); const [gs, setGs] = useStatus(); const [bad, setBad] = useState(new Set()); const [ver, setVer] = useState(0);
  // 구간은 다시 그릴 때만 정렬 (입력 중에는 순서 유지)
  const sortTiers = (x) => { if (!x) return; (x.items || []).forEach((it) => { if (it.tiers) it.tiers.sort((a, b) => (a.base ?? Infinity) - (b.base ?? Infinity)); }); if (x.promo && x.promo.tiers) x.promo.tiers.sort((a, b) => (a.base ?? Infinity) - (b.base ?? Infinity)); };
  const redraw = () => { sortTiers(S.current.d); setVer((v) => v + 1); };
  const load = (f) => { const sig = JSON.stringify(config(kind)); if (f || (!S.current.dirty && sig !== S.current.sig)) { S.current.d = clone(config(kind)); sortTiers(S.current.d); S.current.sig = sig; S.current.dirty = false; } };
  load(false);
  const d = S.current.d;
  const dirty = () => { S.current.dirty = true; setSt('저장하지 않은 변경이 있습니다', 'warn'); force(); };
  const CatChecks = ({ o, withFree }) => { // 함수로 호출 (입력 칸 유지)
    const cats = [['*', '전체 구분']].concat((D.fee.categories || []).map((c) => [c.id, c.name]), [['_etc', '기타 상품 (GAAT·AICC 등)'], ['_rest', '그 밖의 구분']]);
    return (
      <div className="checks-g"><span className="checks-l">대상 매출</span>
        {cats.map(([id, name]) => <label key={id} className="check"><input type="checkbox" checked={(o.cats || []).includes(id)} disabled={id !== '*' && (o.cats || []).includes('*')} onChange={(e) => { o.cats = e.target.checked ? (id === '*' ? ['*'] : [...new Set((o.cats || []).concat(id))]) : (o.cats || []).filter((x) => x !== id); dirty(); }} /> {name}</label>)}
        {withFree && <label className="check"><input type="checkbox" checked={!!o.free} onChange={(e) => { o.free = e.target.checked; dirty(); }} /> 자율학기제</label>}
      </div>
    );
  };
  const TierEditor = ({ o, cnt, pre }) => ( // 함수로 호출
    <div className="tiers">
      {(o.tiers || []).map((t, i) => (
        <div className="tier-r" key={i}>
          {cnt ? <input className={'in num' + (bad.has(pre + i) ? ' invalid' : '')} aria-invalid={bad.has(pre + i) ? 'true' : undefined} type="number" min="0" aria-label="기준 건수" defaultValue={String(t.base ?? '')} onChange={(e) => { t.base = e.target.value === '' ? null : Number(e.target.value); dirty(); }} />
            : <MoneyInput value={t.base} label="기준 금액" invalid={bad.has(pre + i)} onChange={(v) => { t.base = v || null; dirty(); }} />}
          <span className="note">{cnt ? '건 이상 →' : '이상 →'}</span>
          <MoneyInput value={t.amount} label="지급 금액" onChange={(v) => { t.amount = v || 0; dirty(); }} />
          <Btn kind="sm" onClick={() => { o.tiers.splice(o.tiers.indexOf(t), 1); dirty(); redraw(); }}>빼기</Btn>
        </div>))}
      <Btn kind="sm" onClick={() => { o.tiers = (o.tiers || []).concat([{ base: null, amount: 0 }]); dirty(); }}>+ 구간</Btn>
    </div>
  );
  const GradeTable = ({ it }) => { const ranks = RANKS(kind); it.table = it.table || {}; // 함수로 호출
    return (
      <div className="tbl"><table className="items compact grade-tbl">
        <thead><tr><th>직급</th>{GRADES.map(([g, t]) => <th key={g}>{t}</th>)}</tr></thead>
        <tbody>{ranks.map((r) => { const row = it.table[r] || (it.table[r] = {}); return (
          <tr key={r}><td>{WHO + ' ' + r}</td>{GRADES.map(([g]) => <td key={g}><MoneyInput value={row[g] || 0} label={r + ' ' + g + '등급 금액'} onChange={(v) => { row[g] = v || 0; dirty(); }} /></td>)}</tr>); })}</tbody>
      </table><p className="note">사람마다 직급·등급은 아래 「직급·등급」에서 정합니다 · 정하지 않은 사람은 {RANKS(kind)[0]} · D등급(신임)으로 계산</p></div>
    );
  };
  const ItemBox = ({ it, i, list }) => ( // 함수로 호출
    <div key={it.id || i} className={'role-box' + (it.active === false ? ' off' : '')}>
      <div className="acts">
        <Btn kind="sm icon" aria-label="위로" disabled={i === 0} onClick={() => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; dirty(); redraw(); }}>▲</Btn>
        <Btn kind="sm icon" aria-label="아래로" disabled={i === list.length - 1} onClick={() => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; dirty(); redraw(); }}>▼</Btn>
        <input className={'in role-name' + (bad.has('n' + i) ? ' invalid' : '')} aria-invalid={bad.has('n' + i) ? 'true' : undefined} type="text" maxLength={30} placeholder="항목 이름" aria-label="항목 이름" value={it.name} onChange={(e) => { it.name = e.target.value; dirty(); }} />
        <Sel opts={TYPES.filter((x) => G || x[0] !== 'split').map((x) => [x[0], x[1]])} value={it.type} label="계산 방식" onChange={(v) => { it.type = v; if (v === 'tier' && !it.tiers) it.tiers = []; if ((v === 'rate' || v === 'split') && it.rate == null) it.rate = 0; if (v === 'grade') { if (!it.table) it.table = clone(GRADE_TABLE[G ? 'general' : 'branch']); if (it.min == null) it.min = 4000000; if (!it.measure || it.measure === 'com') it.measure = 'rec'; } dirty(); redraw(); }} />
        <Sel opts={SCOPES} value={it.scope || 'own'} label="범위" onChange={(v) => { it.scope = v; dirty(); }} />
        <label className="check"><input type="checkbox" checked={it.active !== false} onChange={(e) => { it.active = e.target.checked; dirty(); }} /> 사용</label>
        {G && <label className="check" title="총국장수당 지급 조건(직할 조직·총국 인정액)을 못 채우면 0원"><input type="checkbox" checked={!!it.gated} onChange={(e) => { it.gated = e.target.checked; dirty(); }} /> 지급 조건 적용</label>}
        {G && it.type === 'rate' && <label className="check" title="월별로 입력한 회비도 같은 비율로 더함"><input type="checkbox" checked={!!it.dues} onChange={(e) => { it.dues = e.target.checked; dirty(); }} /> 회비 포함</label>}
        <Btn kind="sm" onClick={() => { list.splice(i, 1); dirty(); redraw(); }}>빼기</Btn>
      </div>
      {it.type !== 'fixed' && CatChecks({ o: it, withFree: true })}
      <div className="acts">
        {(it.type === 'rate' || it.type === 'tier' || it.type === 'grade' || it.type === 'split') && <><span className="checks-l">기준</span><Sel opts={MEASURES} value={it.measure || 'sales'} label="기준" onChange={(v) => { it.measure = v; dirty(); redraw(); }} /></>}
        {it.type === 'grade' && <><span className="checks-l">최소 실적</span><MoneyInput value={it.min || 0} label="최소 실적" onChange={(v) => { it.min = v || 0; dirty(); }} /><span className="note">이상일 때 지급 (0이면 항상)</span></>}
        {(it.type === 'rate' || it.type === 'split') && <><span className="checks-l">비율</span><input className="in num" type="number" min="0" step="0.1" aria-label="비율" defaultValue={String(Math.round((Number(it.rate) || 0) * 100000) / 1000)} onChange={(e) => { it.rate = (Number(e.target.value) || 0) / 100; dirty(); }} /><span className="note">%</span></>}
        {it.type === 'fixed' && <><span className="checks-l">금액</span><MoneyInput value={it.value || 0} label="월 고정액" onChange={(v) => { it.value = v || 0; dirty(); }} /></>}
        <input className="in" type="text" maxLength={80} placeholder="지급기준 설명 (월급 계산표에 표시)" aria-label="지급기준 설명" value={it.memo || ''} onChange={(e) => { it.memo = e.target.value; dirty(); }} />
      </div>
      {it.type === 'tier' && TierEditor({ o: it, cnt: it.measure === 'cnt', pre: 't' + i + ':' })}
      {it.type === 'grade' && GradeTable({ it })}
      {it.type === 'split' && <p className="note">{'분화 지국과 분화월은 아래 「분화 지국」에서 정합니다 · 분화월(매출 월)부터 ' + SPLIT_MONTHS + '개월 동안 지급'}</p>}
      <p className="note">{'요약: ' + (it.type === 'fixed' ? '매월 ' + won(it.value || 0) + '원' + (it.gated ? ' (지급 조건 달성 시)' : '') : it.type === 'split' ? '분화 지국 ' + (srcLabel(it) || '대상 없음') + ' 판매액 × ' + (Math.round((Number(it.rate) || 0) * 100000) / 1000) + '% (분화 후 ' + SPLIT_MONTHS + '개월)' : it.type === 'grade' ? (it.scope === 'branch' ? (G ? '총국 전체' : '지국 전체') : WHO + ' 직할') + ' ' + (MEASURES.find((m) => m[0] === it.measure) || [, ''])[1] + ' ' + manwon(Number(it.min) || 0) + ' 이상이면 직급·등급표 금액' : '') + (it.type === 'fixed' || it.type === 'split' || it.type === 'grade' ? '' : (it.scope === 'branch' ? (G ? '총국 전체' : '지국 전체') : WHO + ' 직할') + ' ' + (srcLabel(it) || '대상 없음')) + (it.type === 'commission' ? ' 수당표 수당 합계' : it.type === 'rate' ? ' ' + (MEASURES.find((m) => m[0] === it.measure) || [, ''])[1] + ' × ' + (Math.round((Number(it.rate) || 0) * 100000) / 1000) + '%' : it.type === 'tier' ? ' ' + (MEASURES.find((m) => m[0] === it.measure) || [, ''])[1] + ' 구간 ' + (it.tiers || []).length + '개' : '')}</p>
    </div>
  );
  // 총국장수당: 지급 조건 · 월별 회비 · 분화 지국 (함수로 호출)
  const GeneralBox = () => { d.gate = d.gate || { own: 4000000, all: 20000000 }; d.dues = d.dues || {}; d.splits = d.splits || []; const Y = S.current.year;
    const has = d.items.some((it) => it.gated || it.type === 'split');
    return (
      <section className="card">
        <h2>총국장수당 (업무위임 · 매출 · 분화)</h2>
        <p className="note">문서 「총국장수당」 기준 · 직할 조직(총국장 직할 지국 전체)과 총국 전체 인정액이 아래 기준 이상이면 「지급 조건 적용」 항목(매출수당 기본금 70만원 + 총국 판매·회비 1% + 자유학기제 3%, 분화수당 1%)을 모두 지급하고, 못 채우면 0원입니다 · 저장해야 반영</p>
        {!has && <div className="acts"><span className="status" data-kind="warn">총국장수당 항목이 없습니다</span><Btn onClick={() => { d.items = d.items.concat(GENERAL_ITEMS()); dirty(); redraw(); }}>총국장수당 기본 항목 넣기</Btn></div>}
        <div className="acts"><span className="checks-l">지급 조건</span>
          <span className="note">직할 조직 인정액</span><MoneyInput value={d.gate.own || 0} label="직할 조직 인정액 기준" onChange={(v) => { d.gate.own = v || 0; dirty(); }} />
          <span className="note">이상 · 총국 전체 인정액</span><MoneyInput value={d.gate.all || 0} label="총국 전체 인정액 기준" onChange={(v) => { d.gate.all = v || 0; dirty(); }} /><span className="note">이상</span></div>
        <h3>회비 (매출 월별 입력)</h3>
        <p className="note">시스템에 없는 회비를 매출 월마다 넣으면 「회비 포함」 항목에 같은 비율로 더해집니다 (매출 월 + 2개월 월급)</p>
        <div className="dues-grid">{Array.from({ length: 12 }, (_, i) => { const k = Y + '-' + pad(i + 1); return (
          <label key={k} className="field inline"><span className="field-l">{(i + 1) + '월 매출'}</span><MoneyInput value={d.dues[k] || 0} label={k + ' 회비'} onChange={(v) => { if (v) d.dues[k] = v; else delete d.dues[k]; dirty(); }} /></label>); })}</div>
        <h3>분화 지국</h3>
        <p className="note">{'총국에서 분화한 자조직과 분화월(매출 월)을 넣으면 분화월부터 ' + SPLIT_MONTHS + '개월 동안 그 지국 판매액으로 분화수당을 계산합니다'}</p>
        {d.splits.map((x, i) => (
          <div className="acts" key={i}>
            <select className="in" aria-label="분화 지국" value={x.branch || ''} onChange={(e) => { x.branch = e.target.value; dirty(); }}><option value="">지국 선택</option>{D.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
            <input className="in" type="month" aria-label="분화월" value={x.ym || ''} onChange={(e) => { x.ym = e.target.value; dirty(); }} />
            <span className="note">{x.ym ? x.ym + ' ~ ' + addYmL(x.ym, SPLIT_MONTHS - 1) + ' 매출' : ''}</span>
            <Btn kind="sm" onClick={() => { d.splits.splice(i, 1); dirty(); redraw(); }}>빼기</Btn>
          </div>))}
        <Btn kind="sm" onClick={() => { d.splits.push({ branch: '', ym: nowYm() }); dirty(); }}>+ 분화 지국</Btn>
      </section>
    );
  };
  const P = d.promo; P.months = P.months || {};
  const mo = P.months[S.current.pm] || { on: false, off: [] };
  const doSave = async () => {
    const need = []; d.items.forEach((x, i) => { if (!String(x.name || '').trim()) need.push('n' + i); if (x.type === 'tier') (x.tiers || []).forEach((t, j) => { if (t.base == null) need.push('t' + i + ':' + j); }); });
    (P.tiers || []).forEach((t, j) => { if (t.base == null) need.push('pt' + j); });
    if (G && (d.splits || []).some((x) => !x.branch || !x.ym)) { setSt(MSG + ' · 분화 지국과 분화월', 'bad'); return; }
    if (need.length) { setBad(new Set(need)); setSt(MSG, 'bad'); setTimeout(() => { const f = document.querySelector('.main [aria-invalid=true]'); if (f) f.focus(); }, 0); return; }
    setBad(new Set());
    const v = clone(d); v.items.forEach((x) => { x.name = String(x.name).trim(); (x.tiers || []).sort((p, q) => p.base - q.base); }); (v.promo.tiers || []).sort((p, q) => p.base - q.base);
    try { await save('app_setting_save', { p_key: KEY, p_value: v }); S.current.dirty = false; load(true); redraw(); setSt(WHO + ' 수당 기준을 저장했습니다 · ' + WHO + ' 월급 계산에 바로 반영됩니다', 'ok'); } catch (e) { setSt(errText(e), 'bad'); }
  };
  return (
    <div className="page" key={ver}>
      {G && <section className="card">
        <h2>총국장 직할 지국</h2><p className="note">이 지국의 직할 매출(코드 00)이 총국장 본인 매출입니다 · 총국장 메뉴의 「직할 매출 등록」·「자율학기제 직할 등록」은 이 지국으로 등록됩니다</p>
        <div className="acts"><span className="checks-l">총국장 직할 지국</span>
          <select className="in" aria-label="총국장 직할 지국" value={generalBranch()} onChange={async (e) => { const v = e.target.value; const nm = (D.branches.find((b) => b.id === v) || {}).name; try { await save('app_setting_save', { p_key: 'general', p_value: { ...((D.settings && D.settings.general) || {}), branch: v } }); setGs(v ? '총국장 직할 지국: ' + nm : '총국장 직할 지국을 비웠습니다', 'ok'); } catch (x) { setGs(errText(x), 'bad'); } }}>
            <option value="">지국 선택</option>{D.branches.filter((b) => b.active !== false || b.id === generalBranch()).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select><Status s={gs} /></div>
        {!generalBranch() && <p className="status">총국장 직할 지국을 정해야 총국장 월급을 계산할 수 있습니다</p>}
      </section>}
      <section className="card">
        <div className="card-h"><h2>{WHO + ' 수당 항목 (' + d.items.length + '개)'}</h2>
          <div className="acts">
            <Btn onClick={() => { d.items.push({ id: 'bi_' + Date.now().toString(36), name: '', type: 'rate', cats: [], free: false, scope: 'branch', measure: 'sales', rate: 0, memo: '', active: true }); dirty(); }}>+ 항목 추가</Btn>
            <ConfirmBtn confirmText={G ? '한 번 더 눌러 복사' : '한 번 더 눌러 기본값으로'} onFirst={() => setSt(G ? '지금 지국장 수당관리 설정으로 덮어쓰려면 한 번 더 누르세요 (저장해야 반영)' : '엑셀 「지국장 수당 총액」 기본값으로 되돌리려면 한 번 더 누르세요 (저장해야 반영)', 'warn')}
              onConfirm={() => { S.current.d = clone(G ? generalCopy(config('branch')) : DEFAULT); dirty(); redraw(); }}>{G ? '지국장 기준 다시 복사' : '기본값으로'}</ConfirmBtn>
            <Btn onClick={() => { load(true); setSt(''); setBad(new Set()); redraw(); }}>되돌리기</Btn>
            <Btn kind="primary" onClick={doSave}>저장</Btn>
          </div></div>
        <p className="note">{G ? '지국장 수당관리를 복사한 총국장 기준 · 범위: 총국장 직할(총국장 직할 지국의 직할 매출) 또는 총국 전체(모든 지국 매출) · 상품 매출은 매출 월 + 2개월, 자율학기제는 + 1개월 월급에 지급 · 저장해야 반영됩니다' + (D.settings && D.settings.general_fee ? '' : ' · 아직 저장 전이라 지국장 기준을 그대로 씁니다') : '엑셀 「지국장 수당 총액」 기준 · 범위: 지국장 직할 매출 또는 지국 전체(직할 + 소속 홍보팀장) · 상품 매출은 매출 월 + 2개월, 자율학기제는 + 1개월 월급에 지급 · 저장해야 반영됩니다'}</p>
        <Status s={st} />
        {d.items.map((it, i) => ItemBox({ it, i, list: d.items }))}
      </section>
      {G && GeneralBox()}
      <Grades kind={kind} />
      <section className="card">
        <h2>K-디지털 시책 (변동)</h2><p className="note">매출 월마다 시책을 켜고 끕니다 · 켠 달에도 적용하지 않는 구간(예: 10건·20건)은 체크를 풀어 주세요 · 시책은 KDC 매출과 같이 매출 월 + 2개월 월급에 지급</p>
        <div className="acts">
          <input className="in role-name" type="text" aria-label="시책 이름" value={P.name || ''} onChange={(e) => { P.name = e.target.value; dirty(); }} />
          <Sel opts={SCOPES} value={P.scope || 'branch'} label="시책 범위" onChange={(v) => { P.scope = v; dirty(); }} />
          <Sel opts={MEASURES} value={P.measure || 'cnt'} label="시책 기준" onChange={(v) => { P.measure = v; dirty(); redraw(); }} />
        </div>
        {CatChecks({ o: P, withFree: false })}
        <h3>기본 구간</h3>{TierEditor({ o: P, cnt: P.measure === 'cnt', pre: 'pt' })}
        <h3>월별 진행</h3>
        <div className="acts"><select className="in" aria-label="시책 연도" value={String(S.current.year)} onChange={(e) => { S.current.year = Number(e.target.value); force(); }}>{[S.current.year - 1, S.current.year, S.current.year + 1].map((y) => <option key={y} value={String(y)}>{y}년 매출</option>)}</select></div>
        <div className="months">{Array.from({ length: 12 }, (_, i) => { const k = S.current.year + '-' + pad(i + 1); const m = P.months[k]; const on = !!(m && m.on);
          return <button key={k} type="button" className={'month' + (on ? ' on' : '') + (k === S.current.pm ? ' sel' : '')} onClick={() => { S.current.pm = k; force(); }}><span className="m">{i + 1}월 매출</span><span className="v">{on ? '시책 진행' : '없음'}</span><span className="m">{on && (m.off || []).length ? '제외 구간 ' + m.off.length + '개' : ''}</span></button>; })}</div>
        <div className="role-box">
          <label className="check"><input type="checkbox" checked={!!mo.on} onChange={(e) => { P.months[S.current.pm] = { on: e.target.checked, off: mo.off || [] }; if (!e.target.checked) delete P.months[S.current.pm]; dirty(); }} /> {S.current.pm} 매출에 시책 진행</label>
          {mo.on && <div className="checks-g"><span className="checks-l">적용 구간</span>
            {(P.tiers || []).slice().sort((a, b) => a.base - b.base).map((t, i) => <label key={i} className="check"><input type="checkbox" checked={!(mo.off || []).includes(Number(t.base))} onChange={(e) => { const off = new Set(mo.off || []); if (e.target.checked) off.delete(Number(t.base)); else off.add(Number(t.base)); P.months[S.current.pm] = { on: true, off: [...off] }; dirty(); }} /> {(P.measure === 'cnt' ? won(t.base) + '건' : manwon(Number(t.base))) + ' 이상 ' + won(t.amount) + '원'}</label>)}</div>}
        </div>
      </section>
      <section className="card">
        <h2>공제</h2><p className="note">소득세 3% · 주민세 0.3% · 적립금(RDS) 5% (10원 미만 버림) · 적립금은 퇴사 시 지급하며 누적 한도까지만 공제합니다 (0원이면 한도 없음)</p>
        <div className="acts"><span className="checks-l">적립금 누적 한도</span><MoneyInput value={d.rds_cap || 0} label="적립금 누적 한도" onChange={(v) => { d.rds_cap = v || 0; dirty(); }} /></div>
      </section>
    </div>
  );
}
