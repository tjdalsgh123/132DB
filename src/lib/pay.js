// 월급 계산 엔진: 수당 항목(fee_items) × 사람별 조건(person_fee) × 월 입력값(inputs) × 실적
// 월(ym) = 월급(지급) 월 · KDC는 2개월 전 매출, 자율학기제는 1개월 전 매출 (예: 12월 월급 = 10월 KDC + 11월 자율학기제)
import { D, scope, personFree, branchFree, chiefName , snapResult } from './store.js';
import { won, addYm, sum } from './ui.js';

export const RATE_TAX = 0.03, RATE_LOCAL = 0.003, RATE_RDS = 0.05;
export const rdown10 = (n) => Math.floor(n / 10) * 10;
export const pct = (r) => (r == null || r === '' ? '' : (Math.round(Number(r) * 10000) / 100) + '%');
export const TYPES = [
  ['product', '상품별 수당 합계', '매출 등록의 상품별 건수 × 상품 수당 (개인 비율을 지정하면 인정액 × 비율)'],
  ['tier', '구간표', '기준 금액이 구간 기준액 이상이면 그 구간 지급액 (또는 기준 금액 × 비율)'],
  ['per_unit', '건당 금액', '매월 입력한 건수 × 금액'],
  ['rate', '비율', '기준 금액 × 비율'],
  ['fixed', '월 고정액', '매월 같은 금액'],
  ['input', '직접 입력', '매월 금액을 직접 입력'],
];
export const BASES = [
  ['recognized', '인정액 합계'], ['recognized_dues', '인정액 + 월 입력액 (예: 회비인정액)'], ['sales', '판매가 합계'], ['commission', '상품 수당 합계'],
  ['team_sales', '소속 홍보팀장 판매가 합계 (지국장)'], ['team_recognized', '소속 홍보팀장 인정액 합계 (지국장)'], ['free_sales', '자율학기제 매출 합계 (지난달 등록분)'],
];
export const typeName = (t) => (TYPES.find((x) => x[0] === t) || [t, t])[1];
export const baseName = (b) => (BASES.find((x) => x[0] === b) || [b, '기준 없음'])[1];
export const needsBasis = (t) => t === 'tier' || t === 'rate';
export const needsInput = (it) => it.calc_type === 'per_unit' || it.calc_type === 'input' || it.basis === 'recognized_dues';
export const tierLabel = (b) => (b % 10000 === 0 ? won(b / 10000) + '만원 이상' : won(b) + '원 이상');
export const periodText = (r) => (r ? r.valid_from + ' ~ ' + (r.valid_to || '계속') : '');

const num = (v) => (v == null || v === '' ? null : Number(v));
export const items = () => (D.fee_items || []).map((i) => ({ ...i, default_value: +i.default_value || 0, default_rate: +i.default_rate || 0, max_times: i.max_times == null ? null : +i.max_times, tiers: Array.isArray(i.tiers) ? i.tiers : [], apply_default: i.apply_default || [] }));
export const rows = () => (D.person_fee || []).map((r) => ({ ...r, value: num(r.value), rate: num(r.rate) }));
export const inputOf = (pk, ym, id) => (D.inputs || []).find((x) => x.person_key === pk && x.ym === ym && x.item_id === id) || null;

// 사람: 지국장(b:지국) · 홍보팀장(p:홍보팀장)
export const people = () => {
  const out = [];
  D.branches.forEach((b) => {
    out.push({ key: 'b:' + b.id, name: b.name + ' 지국장' + (chiefName(b.id) ? ' (' + chiefName(b.id) + ')' : ''), role: 'branch', branch: b.id, bname: b.name, code: '00', active: b.active !== false });
    D.promoters.filter((p) => p.branch_id === b.id).slice().sort((a, x) => String(a.code || '').localeCompare(String(x.code || '')) || (a.sort_order || 0) - (x.sort_order || 0))
      .forEach((p) => out.push({ key: 'p:' + p.id, name: p.name, role: 'promoter', branch: b.id, bname: b.name, code: p.code || '', active: p.active !== false, pid: p.id }));
  });
  return out;
};
export const person = (key) => people().find((x) => x.key === key) || null;
// 월급 계산 화면에서 볼 수 있는 사람
export const scopePeople = (role) => {
  const all = people().filter((x) => x.role === role && x.active); const s = scope();
  if (s === 'all') return all;
  if (s === 'own') return role === 'promoter' ? all.filter((x) => x.pid === D.me.promoter) : [];
  if (s === 'branch') return all.filter((x) => x.branch === D.me.branch);
  return [];
};
export const freeOnP = (p) => (!p ? false : p.role === 'promoter' ? personFree(p.pid) : branchFree(p.branch));

const inPeriod = (r, ym) => r.active !== false && r.valid_from <= ym && (!r.valid_to || ym <= r.valid_to);
export const effective = (pk, role, ym) => {
  const out = []; const R = rows();
  items().filter((it) => it.active !== false).forEach((it) => {
    const r = R.filter((x) => x.person_key === pk && x.item_id === it.id && inPeriod(x, ym)).sort((a, b) => (b.valid_from || '').localeCompare(a.valid_from || '') || b.id - a.id)[0];
    if (r) {
      if (r.mode === 'exclude') { out.push({ it, src: 'exclude', row: r }); return; }
      out.push({ it, src: 'person', row: r, value: r.value != null ? r.value : it.default_value, rate: r.rate != null ? r.rate : it.default_rate, tiers: Array.isArray(r.tiers) && r.tiers.length ? r.tiers : it.tiers, customRate: r.rate != null, customValue: r.value != null, customTiers: Array.isArray(r.tiers) && r.tiers.length > 0 });
      return;
    }
    if (it.apply_default.includes(role)) out.push({ it, src: 'default', value: it.default_value, rate: it.default_rate, tiers: it.tiers });
    else out.push({ it, src: 'none' });
  });
  return out;
};
export const condText = (e) => {
  if (e.src === 'none') return ''; if (e.src === 'exclude') return '제외';
  const it = e.it;
  if (it.calc_type === 'etc') return '기타 상품 수당표 (인정액 × 판매수당율)';
  if (it.calc_type === 'product') return e.customRate ? '인정액 × ' + pct(e.rate) : '상품별 수당';
  if (it.calc_type === 'tier') return e.customTiers ? '개인 구간표' : '기본 구간표';
  if (it.calc_type === 'rate') return pct(e.rate);
  if (it.calc_type === 'per_unit') return won(e.value) + '원/' + (it.unit || '건');
  if (it.calc_type === 'fixed') return won(e.value) + '원';
  return '직접 입력';
};
// 실적 (정산 월 기준)
export const perf = (p, ym) => {
  const kym = addYm(ym, -2), fym = addYm(ym, -1);
  const es = D.entries.filter((e) => e.ym === kym && e.branch_id === p.branch);
  const own = p.role === 'promoter' ? es.filter((e) => e.promoter_id === p.pid) : es.filter((e) => !e.promoter_id);
  const team = p.role === 'branch' ? es.filter((e) => e.promoter_id) : [];
  const fl = D.free.filter((f) => f.ym === fym && f.branch_id === p.branch);
  const fown = p.role === 'promoter' ? fl.filter((f) => f.promoter_id === p.pid) : [];
  const fteam = p.role === 'branch' ? fl : [];
  // 기타 상품 판매 (GAAT·AICC 등): 자율학기제처럼 매출 월 + 1개월 · 판매액·인정액은 실적에 합산 · 수당은 「기타 상품 판매 수당」 줄
  const xl = (D.etc || []).filter((f) => f.ym === fym && f.branch_id === p.branch);
  const xown = p.role === 'promoter' ? xl.filter((f) => f.promoter_id === p.pid) : []; const xteam = p.role === 'branch' ? xl : [];
  const ks = sum(own, 'amount'), kr = sum(own, 'recognized'), fs = sum(fown, 'amount'), fr = sum(fown, 'recognized'), xs = sum(xown, 'amount'), xr = sum(xown, 'recognized');
  return { kdc_ym: kym, free_ym: fym, kdc_sales: ks, kdc_rec: kr, free_sales: fs, free_rec: fr, free_comm: sum(fown, 'commission'), free_cnt: fown.length, free_amts: fown.map((f) => f.amount),
    etc_ym: fym, etc_sales: xs, etc_rec: xr, etc_comm: sum(xown, 'commission'), etc_cnt: xown.length, etc_qty: sum(xown, 'qty'),
    sales: ks + fs + xs, rec: kr + fr + xr, comm: sum(own, 'commission'), cnt: sum(own, 'cnt'), team_sales: sum(team, 'amount') + sum(fteam, 'amount') + sum(xteam, 'amount'), team_rec: sum(team, 'recognized') + sum(fteam, 'recognized') + sum(xteam, 'recognized'), team_free: sum(fteam, 'amount'),
    registered: own.length > 0 || fown.length > 0 || xown.length > 0, kdcEntries: own };
};
export const baseValue = (it, pf, iv) => ({ commission: pf.comm, recognized: pf.rec, recognized_dues: pf.rec + ((iv && iv.amount) || 0), sales: pf.sales, team_sales: pf.team_sales, team_recognized: pf.team_rec, free_sales: pf.free_sales, none: 0 }[it.basis] || 0);
// pfOverride: 실적을 직접 넘길 때 (지국장 계정 할당 = 가상 홍보팀장 계정)
export const calc = (p, ym, overrides, noLimit, pfOverride) => {
  if (!pfOverride && p && p.key) { const s = snapResult(p.key, ym); if (s) return s; } // 마감한 달 = 확정 월급
  const pf = pfOverride || perf(p, ym); const lines = [];
  const inp = (id) => { const o = overrides && overrides.get(id); if (o) return o; const x = inputOf(p.key, ym, id); return x ? { qty: +x.qty || 0, amount: +x.amount || 0 } : { qty: 0, amount: 0 }; };
  effective(p.key, p.role, ym).forEach((e) => {
    if (e.src === 'none' || e.src === 'exclude') return;
    if (e.it.basis === 'free_sales' && !pf.free_sales && !freeOnP(p)) return;
    const it = e.it; const iv = inp(it.id); const bv = baseValue(it, pf, iv);
    let amount = 0, how = '';
    if (it.calc_type === 'product') {
      if (e.customRate) { amount = Math.round(pf.kdc_rec * e.rate); how = pf.kdc_ym + ' KDC 인정액 ' + won(pf.kdc_rec) + '원 × ' + pct(e.rate) + ' (개인 수당율)'; }
      else { amount = pf.comm; how = pf.kdc_ym + ' KDC 상품별 수당 합계'; }
    } else if (it.calc_type === 'tier') {
      const ts = (e.tiers || []).filter((t) => t && t.base != null).slice().sort((a, b) => a.base - b.base);
      const mg = pf.tierMargin || 0; const t = ts.filter((x) => bv >= Number(x.base) + (Number(x.base) > 0 ? mg : 0)).pop(); /* tierMargin: 계정 할당 최적화용 구간 여유액 */
      const bn = (it.basis === 'recognized_dues' ? '인정액 + ' + (it.input_label || '입력액') : baseName(it.basis)) + (['recognized', 'recognized_dues', 'sales'].includes(it.basis) && pf.free_sales ? ' (KDC ' + pf.kdc_ym + ' + 자율학기제 ' + pf.free_ym + ')' : '');
      if (t) { amount = t.rate != null && t.rate !== '' ? Math.round(bv * Number(t.rate)) : Number(t.amount) || 0; how = bn + ' ' + won(bv) + '원 → ' + tierLabel(Number(t.base)) + (t.rate != null && t.rate !== '' ? ' (' + pct(t.rate) + ')' : ''); }
      else how = bn + ' ' + won(bv) + '원 → 기준 미달';
    } else if (it.calc_type === 'per_unit') { amount = Math.round((iv.qty || 0) * e.value); how = won(iv.qty || 0) + (it.unit || '건') + ' × ' + won(e.value) + '원'; }
    else if (it.calc_type === 'rate') { amount = it.basis === 'free_sales' ? pf.free_amts.reduce((a, x) => a + Math.round(x * e.rate), 0) : Math.round(bv * e.rate); how = (it.basis === 'free_sales' ? pf.free_ym + ' 자율학기제 매출' : baseName(it.basis)) + ' ' + won(bv) + '원 × ' + pct(e.rate); }
    else if (it.calc_type === 'fixed') { amount = Math.round(e.value); how = '월 고정액'; }
    else if (it.calc_type === 'input') { amount = Math.round(iv.amount || 0); how = '직접 입력'; }
    // 지급 횟수 제한 (예: 정착수당 최대 4회): 조건 시작월부터 지난달까지 받은 횟수
    if (!noLimit && it.max_times && e.row && amount > 0) {
      let n = 0; for (let m = addYm(ym, -1); m >= e.row.valid_from; m = addYm(m, -1)) { const pl = calc(p, m, null, true).lines.find((x) => x.it.id === it.id); if (pl && pl.amount > 0) n++; if (n >= it.max_times) break; }
      if (n >= it.max_times) { how += ' · 최대 ' + it.max_times + '회를 이미 받아 0원'; amount = 0; } else how += ' · ' + it.max_times + '회 중 ' + (n + 1) + '회째';
    }
    lines.push({ it, e, amount, how });
  });
  if (pf.etc_cnt > 0) { const it = { id: 'etc', name: '기타 상품 판매 수당', calc_type: 'etc' };
    lines.push({ it, e: { src: 'default', it }, amount: pf.etc_comm, how: pf.etc_ym + ' 기타 상품 ' + won(pf.etc_cnt) + '건 (' + won(pf.etc_qty) + '개) · 판매액 ' + won(pf.etc_sales) + '원 · 인정액 ' + won(pf.etc_rec) + '원 · 상품별 수당 합계' }); }
  const total = sum(lines, 'amount');
  const tax = rdown10(total * RATE_TAX), local = rdown10(total * RATE_LOCAL), rds = rdown10(total * RATE_RDS);
  return { pf, lines, total, tax, local, rds, ded: tax + local + rds, net: total - (tax + local + rds) };
};
