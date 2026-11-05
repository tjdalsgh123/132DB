// 관리자 · 수당 관리: KDC 수당관리(상품별 수당표·업체/구분) · 홍보팀장 수당관리(장려/정착 기준) · 지국장·총국장 수당관리
import { useReducer, useRef, useState } from 'react';
import { D, save } from '../lib/store.js';
import { won, MSG, errText } from '../lib/ui.js';
import { XLSX, download, T, Mn, N, P } from '../lib/xlsx.js';
import { useData } from '../hooks/useData.js';
import { Btn, MoneyInput, PageHead, Status, Tabs, useLive, useStatus } from '../components/ui.jsx';
import BranchFee from './BranchFee.jsx';
import EtcAdmin from './EtcAdmin.jsx';

const copy = (v) => JSON.parse(JSON.stringify(v || []));
const newId = (p) => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
// 업체별 사용 구분 (설정 vendor_categories = {업체id: [구분id]}) · 설정이 없으면 모든 구분 사용
const vcMap = () => (D.settings && D.settings.vendor_categories) || {};
const vcats = (vid) => { const all = (D.fee.categories || []).map((c) => c.id); const l = vcMap()[vid]; return Array.isArray(l) ? l.filter((x) => all.includes(x)) : all; };
const pairOk = (vid, cid) => !vid || !cid || vcats(vid).includes(cid);
const tierLabel = (b) => (b == null ? '—' : b % 10000 === 0 ? won(b / 10000) + '만원 이상' : won(b) + '원 이상');
const TABS = [['kdc', 'KDC 수당관리'], ['promoter', '홍보팀장 수당관리'], ['branch', '지국장 수당관리'], ['general', '총국장 수당관리'], ['etc', '기타 상품 관리']];

export default function FeeAdmin() {
  useData();
  const [tab, setTab0] = useState(() => { try { return localStorage.getItem('feeTab') || 'kdc'; } catch (_) { return 'kdc'; } });
  const setTab = (k) => { setTab0(k); try { localStorage.setItem('feeTab', k); } catch (_) {} };
  const [xs, setXs] = useStatus();
  const xlsx = () => {
    const vn = new Map((D.fee.vendors || []).map((x) => [x.id, x.name])), cn = new Map((D.fee.categories || []).map((x) => [x.id, x.name]));
    const s1 = { name: '상품별 수당표', cols: [N('NO'), T('구분'), T('업체'), T('강의명'), Mn('수강료'), Mn('판매가'), Mn('인정액'), Mn('수당'), P('수당율'), T('비고')], rows: (D.fee.products || []).map((p, i) => [i + 1, cn.get(p.categoryId) || '', vn.get(p.vendorId) || '', p['강의명'] || '', p['수강료'], p['판매가'], p['인정액'], p['수당'], p['수당율'], p['비고'] || '']) };
    const tr = (l) => (l || []).slice().sort((a, b) => a['기준액'] - b['기준액']).map((r) => [tierLabel(r['기준액']), r['기준액'], r['수당']]);
    const d = new Date(); const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    download('수당표_수당기준_' + stamp + '.xlsx', XLSX.build([s1, { name: '장려수당 기준', cols: [T('구간'), Mn('기준액'), Mn('수당')], rows: tr(D.fee.incentive) }, { name: '정착수당 기준', cols: [T('구간'), Mn('기준액'), Mn('수당')], rows: tr(D.fee.settle) }]));
    setXs('엑셀을 내려받았습니다', 'ok');
  };
  return (
    <div className="page">
      <PageHead eyebrow="관리자" title="수당 관리" lede="KDC 수당관리(지국장·홍보팀장 공통 상품별 수당표) · 홍보팀장 수당관리 · 지국장 수당관리로 나눠 관리합니다. 저장하면 132총국 DB에 바로 반영됩니다.">
        {(tab === 'kdc' || tab === 'promoter') && <div className="acts"><Btn onClick={xlsx}>엑셀 다운로드</Btn><Status s={xs} /></div>}
      </PageHead>
      <Tabs items={TABS} value={tab} onPick={setTab} />
      {tab === 'kdc' && <><Products /><section className="grid2"><Lookup kind="vendors" name="업체" pre="v" /><Lookup kind="categories" name="구분 (예: KDC, 재직자)" pre="c" /></section></>}
      {tab === 'promoter' && <>
        <section className="card"><h2>홍보팀장 수당 항목</h2><p className="note">홍보팀장 월급에 들어가는 수당 항목(상품 수당·장려수당·정착수당·자율학기제 수당 등)과 사람별 조건은 「수당 등록」에서, 적용 현황은 「수당 현황」에서 관리합니다 · 아래 장려수당·정착수당 기준은 수당계산기에 쓰입니다</p>
          <div className="acts"><a className="btn" href="#/payedit">수당 등록 열기</a><a className="btn" href="#/paylist">수당 현황 열기</a></div></section>
        <section className="grid2"><TierCard k="incentive" name="장려수당 기준" kind="incentive_tiers" note="당월 신규 인정실적 기준 · 2,500만원 이상은 인정금액의 13% (홍보팀장 · 수당계산기)" /><TierCard k="settle" name="정착수당 기준" kind="settle_tiers" note="인정실적 기준 (홍보팀장 · 수당계산기)" /></section>
      </>}
      {tab === 'branch' && <BranchFee key="b" kind="branch" />}
      {tab === 'general' && <BranchFee key="g" kind="general" />}
      {tab === 'etc' && <EtcAdmin />}
    </div>
  );
}

// 상품별 수당표 (저장 전까지 이 화면 안에서만 바뀜)
function Products() {
  const S = useRef({ rows: null, sig: '', dirty: false }); const [, force] = useReducer((x) => x + 1, 0); const [st, setSt] = useStatus(); const [bad, setBad] = useState(new Set()); const [ver, setVer] = useState(0);
  const load = (f) => { const sig = JSON.stringify(D.fee.products || []); if (f || (!S.current.dirty && sig !== S.current.sig)) { S.current.rows = copy(D.fee.products); S.current.sig = sig; S.current.dirty = false; } };
  load(false);
  const rows = S.current.rows;
  const dirty = () => { S.current.dirty = true; setSt('저장하지 않은 변경이 있습니다', 'warn'); force(); };
  const unbad = (k) => setBad((b) => { if (!b.has(k)) return b; const n = new Set(b); n.delete(k); return n; });
  const add = () => { rows.push({ id: newId('p'), categoryId: null, vendorId: null, '강의명': '', '수강료': null, '판매가': null, '인정액': null, '수당': null, '수당율': 0.35, '비고': '' }); dirty(); setTimeout(() => { const r = document.querySelectorAll('.fee-t tbody tr'); const s = r[r.length - 1] && r[r.length - 1].querySelector('select'); if (s) s.focus(); }, 0); };
  const doSave = async () => {
    const need = []; rows.forEach((r, i) => { if (!r.categoryId) need.push(i + ':cat'); if (!(r.vendorId && pairOk(r.vendorId, r.categoryId))) need.push(i + ':ven'); if (!String(r['강의명'] || '').trim()) need.push(i + ':ttl'); if (r['판매가'] == null) need.push(i + ':price'); if (r['인정액'] == null) need.push(i + ':rec'); if (r['수당'] == null) need.push(i + ':comm'); });
    if (need.length) { setBad(new Set(need)); setSt(MSG + ' · 빈 칸이나 업체가 하지 않는 구분 ' + need.length + '개', 'bad'); setTimeout(() => { const f = document.querySelector('.fee-t [aria-invalid=true]'); if (f) f.focus(); }, 0); return; }
    const out = rows.map((r) => ({ id: r.id || newId('p'), categoryId: r.categoryId || null, vendorId: r.vendorId || null, '강의명': String(r['강의명'] || '').trim(), '수강료': r['수강료'] ?? null, '판매가': r['판매가'] ?? null, '인정액': r['인정액'] ?? null, '수당': r['수당'] ?? null, '수당율': r['수당율'] ?? null, '비고': String(r['비고'] || '').trim() }));
    try { await save('app_fee_save_products', { p_items: out }); S.current.dirty = false; load(true); setVer((v) => v + 1); setBad(new Set()); setSt('상품별 수당표를 저장했습니다 · 계산기와 매출 등록에 반영됐습니다', 'ok'); } catch (e) { setSt(errText(e), 'bad'); }
  };
  const iv = (k, cls = 'in') => (bad.has(k) ? { className: cls + ' invalid', 'aria-invalid': 'true' } : { className: cls });
  return (
    <section className="card" key={ver}>
      <div className="card-h"><h2>{'상품별 수당표 (' + rows.length + '개)'}</h2>
        <div className="acts"><Btn onClick={add}>+ 상품 추가</Btn><Btn onClick={() => { load(true); setSt(''); setBad(new Set()); setVer((v) => v + 1); }}>되돌리기</Btn><Btn kind="primary" onClick={doSave}>저장</Btn></div></div>
      <p className="note">수당 = 인정액 × 수당율 (수당을 직접 고치면 수당율이 다시 계산됩니다) · 판매가·인정액·수당은 1건 기준</p>
      <Status s={st} />
      <div className="tbl"><table className="items fee-t">
        <thead><tr>{['NO', '구분', '업체', '강의명', '수강료', '판매가', '인정액', '수당', '수당율(%)', '비고', ''].map((x, i) => <th key={i}>{x}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => {
          const venList = (D.fee.vendors || []).filter((v) => !r.categoryId || vcats(v.id).includes(r.categoryId) || v.id === r.vendorId).map((v) => ({ id: v.id, name: v.name + (pairOk(v.id, r.categoryId) ? '' : ' (이 구분 안 함)') }));
          const recalc = () => { if (r['인정액'] != null && r['수당율'] != null) { r['수당'] = Math.round(r['인정액'] * r['수당율']); unbad(i + ':comm'); } };
          return (
            <tr key={r.id}>
              <td className="num">{i + 1}</td>
              <td><select aria-label="구분" value={r.categoryId || ''} {...iv(i + ':cat')} onChange={(e) => { r.categoryId = e.target.value || null; if (!pairOk(r.vendorId, r.categoryId)) r.vendorId = null; unbad(i + ':cat'); unbad(i + ':ven'); dirty(); }}><option value="">구분 선택</option>{(D.fee.categories || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
              <td><select aria-label="업체" value={r.vendorId || ''} {...iv(i + ':ven')} onChange={(e) => { r.vendorId = e.target.value || null; unbad(i + ':ven'); dirty(); }}><option value="">업체 선택</option>{venList.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></td>
              <td className="title"><input type="text" aria-label="강의명" value={r['강의명'] || ''} {...iv(i + ':ttl')} onChange={(e) => { r['강의명'] = e.target.value; unbad(i + ':ttl'); dirty(); }} /></td>
              <td><MoneyInput value={r['수강료']} label="수강료" onChange={(v) => { r['수강료'] = v || null; dirty(); }} /></td>
              <td><MoneyInput value={r['판매가']} label="판매가" invalid={bad.has(i + ':price')} onChange={(v) => { r['판매가'] = v || null; unbad(i + ':price'); dirty(); }} /></td>
              <td><MoneyInput value={r['인정액']} label="인정액" invalid={bad.has(i + ':rec')} onChange={(v) => { r['인정액'] = v || null; unbad(i + ':rec'); recalc(); dirty(); }} /></td>
              <td><MoneyInput value={r['수당']} label="수당" invalid={bad.has(i + ':comm')} onChange={(v) => { r['수당'] = v || null; unbad(i + ':comm'); if (v != null && r['인정액']) { r['수당율'] = Math.round((v / r['인정액']) * 10000) / 10000; r._rateTxt = String(Math.round(r['수당율'] * 1000) / 10); } dirty(); }} /></td>
              <td><input className="in num" type="number" min="0" step="0.1" aria-label="수당율" value={r._rateTxt != null ? r._rateTxt : r['수당율'] == null ? '' : String(Math.round(r['수당율'] * 1000) / 10)} onChange={(e) => { r._rateTxt = e.target.value; const v = e.target.value === '' ? null : Number(e.target.value); r['수당율'] = v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 10000; recalc(); dirty(); }} /></td>
              <td><input className="in" type="text" aria-label="비고" value={r['비고'] || ''} onChange={(e) => { r['비고'] = e.target.value; dirty(); }} /></td>
              <td className="act"><Btn kind="sm" onClick={() => { rows.splice(i, 1); dirty(); setBad(new Set()); }}>빼기</Btn></td>
            </tr>);
        })}</tbody>
      </table></div>
      {!rows.length && <p className="note empty">상품이 없습니다 · 「+ 상품 추가」를 눌러 주세요</p>}
    </section>
  );
}

// 업체·구분 관리
function Lookup({ kind, name, pre }) {
  const [st, setSt] = useStatus(); const [ni, setNi] = useState(''); const [nbad, setNbad] = useState(false);
  const list = D.fee[kind] || []; const ref = kind === 'vendors' ? 'vendorId' : 'categoryId';
  const saveList = async (l) => { try { await save('app_fee_save_lookup', { p_kind: kind, p_items: l }); setSt('저장했습니다', 'ok'); return true; } catch (e) { setSt(errText(e), 'bad'); return false; } };
  const add = async () => { const v = ni.trim(); if (!v) { setNbad(true); setSt(MSG, 'bad'); return; } if (list.some((y) => y.name === v)) { setSt('같은 이름이 이미 있습니다', 'bad'); return; } if (await saveList(list.map((y) => ({ id: y.id, name: y.name })).concat([{ id: pre + '_' + Date.now().toString(36), name: v }]))) setNi(''); };
  const setCat = async (x, c, on) => {
    const mine = vcats(x.id); const next = on ? [...new Set(mine.concat(c.id))] : mine.filter((y) => y !== c.id);
    if (!next.length) { setSt('구분을 하나 이상 골라 주세요', 'bad'); return; }
    const m = { ...vcMap() }; const all = (D.fee.categories || []).map((y) => y.id);
    if (all.every((y) => next.includes(y))) delete m[x.id]; else m[x.id] = next;
    try { await save('app_setting_save', { p_key: 'vendor_categories', p_value: m }); setSt(x.name + ' · ' + c.name + (on ? ' 사용' : ' 사용 안 함') + ' 저장했습니다', 'ok'); } catch (e) { setSt(errText(e), 'bad'); }
  };
  return (
    <div className="card">
      <h2>{name} 관리</h2>
      <p className="note">{kind === 'vendors' ? '업체마다 하는 구분을 체크하세요 (예: 유비온은 재직자만) · 상품별 수당표에서 구분을 고르면 그 구분을 하는 업체만 나옵니다 · 상품이 있는 구분은 끌 수 없습니다' : '상품별 수당표의 선택 목록입니다 · 상품에서 쓰는 항목은 삭제할 수 없습니다 · 이름을 고친 뒤 칸을 벗어나면 저장됩니다'}</p>
      <Status s={st} />
      <div className="rows">{list.map((x) => { const n = (D.fee.products || []).filter((p) => p[ref] === x.id).length; const mine = vcats(x.id); return (
        <div key={x.id} className="row lk-row">
          <div className="lk-top">
            <LkName value={x.name} label={name + ' 이름'} onSave={(v) => { if (!v) { setSt(MSG, 'bad'); return false; } if (list.some((y) => y !== x && y.name === v)) { setSt('같은 이름이 이미 있습니다', 'bad'); return false; } saveList(list.map((y) => ({ id: y.id, name: y.id === x.id ? v : y.name }))); return true; }} />
            <span className="lk-n">{n ? '상품 ' + n + '개' : '미사용'}</span>
            <Btn kind="sm" disabled={n > 0} title={n ? '이 항목을 쓰는 상품이 있어 삭제할 수 없습니다' : undefined} onClick={() => saveList(list.filter((y) => y.id !== x.id).map((y) => ({ id: y.id, name: y.name })))}>삭제</Btn>
          </div>
          {kind === 'vendors' ? <div className="lk-cats"><span className="lk-l">하는 구분</span>
            {(D.fee.categories || []).map((c) => { const used = (D.fee.products || []).filter((p) => p.vendorId === x.id && p.categoryId === c.id).length; const on = mine.includes(c.id); const lock = on && used > 0;
              return <label key={c.id} className="check" title={lock ? '이 업체의 ' + c.name + ' 상품이 ' + used + '개 있어 끌 수 없습니다' : undefined}><input type="checkbox" checked={on} disabled={lock} onChange={(e) => setCat(x, c, e.target.checked)} /> {c.name + (used ? ' (' + used + ')' : '')}</label>; })}
          </div> : <div className="lk-cats note">{(() => { const vs = (D.fee.vendors || []).filter((v) => vcats(v.id).includes(x.id)).map((v) => v.name); return vs.length ? '하는 업체: ' + vs.join(', ') : '이 구분을 하는 업체가 없습니다'; })()}</div>}
        </div>); })}</div>
      <div className="acts"><input className={'in' + (nbad ? ' invalid' : '')} type="text" placeholder={'새 ' + name.split(' ')[0] + ' 이름'} aria-label={'새 ' + name + ' 이름'} value={ni} onChange={(e) => { setNi(e.target.value); setNbad(false); }} /><Btn kind="primary" onClick={add}>추가</Btn></div>
    </div>
  );
}
function LkName({ value, label, onSave }) {
  const [v, setV] = useLive(value);
  return <input className="in" type="text" aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => { const t = v.trim(); if (t === value) return; if (onSave(t) === false) setV(value); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}

// 장려수당·정착수당 구간
function TierCard({ k, name, kind, note }) {
  const S = useRef({ rows: null, sig: '', dirty: false }); const [, force] = useReducer((x) => x + 1, 0); const [st, setSt] = useStatus(); const [bad, setBad] = useState(new Set());
  const load = (f) => { const sig = JSON.stringify(D.fee[k] || []); if (f || (!S.current.dirty && sig !== S.current.sig)) { S.current.rows = copy(D.fee[k]); S.current.sig = sig; S.current.dirty = false; } };
  load(false);
  const rows = S.current.rows;
  const dirty = () => { S.current.dirty = true; setSt('저장하지 않은 변경이 있습니다', 'warn'); force(); };
  const shown = rows.slice().sort((a, b) => (a['기준액'] || 0) - (b['기준액'] || 0));
  const doSave = async () => {
    const need = []; shown.forEach((r, i) => { if (r['기준액'] == null) need.push(i + ':b'); if (r['수당'] == null) need.push(i + ':m'); });
    if (need.length) { setBad(new Set(need)); setSt(MSG, 'bad'); return; }
    try { await save('app_fee_save_tiers', { p_kind: kind, p_items: rows.map((r) => ({ '기준액': r['기준액'], '수당': r['수당'] })).sort((x, y) => x['기준액'] - y['기준액']) }); S.current.dirty = false; load(true); setBad(new Set()); force(); setSt(name + '을 저장했습니다', 'ok'); } catch (e) { setSt(errText(e), 'bad'); }
  };
  return (
    <div className="card">
      <div className="card-h"><h2>{name}</h2><div className="acts"><Btn kind="sm" onClick={() => { rows.push({ '기준액': null, '수당': null }); dirty(); }}>+ 구간</Btn><Btn kind="sm" onClick={() => { load(true); setSt(''); setBad(new Set()); force(); }}>되돌리기</Btn><Btn kind="primary sm" onClick={doSave}>저장</Btn></div></div>
      <p className="note">{note}</p><Status s={st} />
      <div className="tbl"><table className="items compact">
        <thead><tr><th>구간</th><th>기준액</th><th>수당</th><th /></tr></thead>
        <tbody>{shown.map((r, i) => <tr key={rows.indexOf(r)}><td>{tierLabel(r['기준액'])}</td>
          <td><MoneyInput value={r['기준액']} label="기준액" invalid={bad.has(i + ':b')} onChange={(v) => { r['기준액'] = v || null; dirty(); }} /></td>
          <td><MoneyInput value={r['수당']} label="수당" invalid={bad.has(i + ':m')} onChange={(v) => { r['수당'] = v || null; dirty(); }} /></td>
          <td className="act"><Btn kind="sm" onClick={() => { rows.splice(rows.indexOf(r), 1); dirty(); }}>빼기</Btn></td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
