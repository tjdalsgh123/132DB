// 지국장 월급 계산 엔진 (홍보팀장과 별도) · 설정: settings.branch_fee (관리자 → 수당 관리 → 지국장 수당관리)
// 월(ym) = 월급 월 · KDC·재직자 등 상품 매출은 2개월 전, 자율학기제는 1개월 전 매출
import { D, catsOf, chiefFree, branchFree, casesOf, singlesOf, pmap, applicantRanges , snapResult } from './store.js';
import { won, addYm, sum } from './ui.js';
import { calc as calcPromoter, person as personOf } from './pay.js';

export const RATE_TAX = 0.03, RATE_LOCAL = 0.003, RATE_RDS = 0.05;
const rdown10 = (n) => Math.floor(n / 10) * 10;
export const pct = (r) => (r == null || r === '' ? '' : (Math.round(Number(r) * 10000) / 100) + '%');
export const manwon = (b) => (b % 10000 === 0 ? won(b / 10000) + '만원' : won(b) + '원');

export const TYPES = [['commission', '수당표 기준', '상품별 수당표의 1건 수당 × 건수 합계'], ['rate', '비율', '기준 금액 × 비율'], ['tier', '구간표', '기준 금액이 구간 이상이면 그 구간 금액'], ['fixed', '월 고정액', '매월 같은 금액']];
export const MEASURES = [['sales', '판매액'], ['rec', '인정액'], ['com', '수당'], ['cnt', '건수']];
export const SCOPES = [['own', '지국장 직할 매출'], ['branch', '지국 전체 매출 (직할 + 소속 홍보팀장)']];
export const typeName = (t) => (TYPES.find((x) => x[0] === t) || [t, t])[1];
export const measureName = (m) => (MEASURES.find((x) => x[0] === m) || [m, m])[1];
export const scopeName = (s, kind) => (kind === 'general' ? (s === 'branch' ? '총국 전체' : '총국장 직할') : s === 'branch' ? '지국 전체' : '직할');
// 총국장: 총국장 직할 지국(설정 general.branch)의 직할 매출 = 직할 · 모든 지국 매출 = 총국 전체
export const generalBranch = () => ((D.settings && D.settings.general) || {}).branch || '';
export const generalPerson = () => { const b = generalBranch(); const br = D.branches.find((x) => x.id === b); return b && br ? { key: 'g:' + b, name: '총국장 (' + br.name + ' 직할)', role: 'general', branch: b, bname: br.name, general: true, active: true } : null; };

const T = (b, a) => ({ base: b, amount: a });
export const DEFAULT = {
  items: [
    { id: 'kdc_comm', name: 'KDC 수당', type: 'commission', cats: ['c_kdc'], free: false, scope: 'own', measure: 'com', memo: 'KDC 수당표 기준', active: true },
    { id: 'kdc_inc', name: 'KDC 인센티브', type: 'rate', cats: ['c_kdc'], free: false, scope: 'branch', measure: 'sales', rate: 0.04, memo: '지국 전체 KDC 판매액의 4%', active: true },
    { id: 'emp_comm', name: '재직자 수당', type: 'commission', cats: ['c_emp'], free: false, scope: 'own', measure: 'com', memo: '재직자 수당표 기준', active: true },
    { id: 'emp_inc', name: '재직자 인센티브', type: 'rate', cats: ['c_emp'], free: false, scope: 'branch', measure: 'sales', rate: 0.04, memo: '지국 전체 재직자 판매액의 4%', active: true },
    { id: 'free_comm', name: '자유학기제 수당', type: 'rate', cats: [], free: true, scope: 'own', measure: 'sales', rate: 0.5, memo: '지국장이 직접 등록한 자율학기제 판매액의 50%', active: true },
    { id: 'free_inc', name: '자유학기제 인센티브', type: 'rate', cats: [], free: true, scope: 'branch', measure: 'sales', rate: 0.07, memo: '지국 전체 자율학기제 판매액의 7%', active: true },
    { id: 'etc_comm', name: '기타 판매 수당', type: 'commission', cats: ['_rest'], free: false, scope: 'own', measure: 'com', memo: '판매 수당표 기준 (KDC·재직자 외 구분)', active: true },
    { id: 'etc_inc', name: '기타 판매 인센티브', type: 'rate', cats: ['_rest'], free: false, scope: 'branch', measure: 'sales', rate: 0.04, memo: '지국 전체 기타 판매액의 4%', active: true },
    { id: 'chief', name: '국장수당', type: 'tier', cats: ['*'], free: true, scope: 'branch', measure: 'rec', tiers: [T(4000000, 600000), T(8000000, 700000), T(15000000, 800000), T(20000000, 900000)], memo: '판매인정액(매출귀속) 기준 · 달성한 가장 높은 구간 지급', active: true },
    { id: 'org', name: '조직회원운영비', type: 'tier', cats: ['c_kdc'], free: false, scope: 'branch', measure: 'sales', tiers: [T(10000000, 100000), T(12000000, 200000), T(14000000, 300000), T(16000000, 400000), T(18000000, 500000), T(20000000, 600000), T(22000000, 700000), T(24000000, 800000), T(27000000, 900000), T(30000000, 1000000), T(35000000, 1100000), T(40000000, 1200000), T(45000000, 1300000), T(50000000, 1500000)], memo: 'KDC 입금액(지국 전체 판매액) 기준 · 달성 시 자동 지급', active: true },
  ],
  promo: { name: 'K-디지털 시책', cats: ['c_kdc'], scope: 'branch', measure: 'cnt', tiers: [T(10, 50000), T(20, 100000), T(30, 200000), T(50, 300000), T(60, 400000), T(70, 500000), T(100, 700000), T(150, 1000000)], months: {}, memo: '매출 월별로 켜고, 그 달에 적용하지 않는 구간은 끕니다' },
  rds_cap: 3000000,
};
// 지국장 기준을 총국장용으로 복사 (설명 문구의 지국장·지국 전체 → 총국장·총국 전체)
export const generalCopy = (c) => { const x = JSON.parse(JSON.stringify(c)); const fix = (t) => String(t || '').replace(/지국 전체/g, '총국 전체').replace(/지국장/g, '총국장'); (x.items || []).forEach((it) => { it.memo = fix(it.memo); }); if (x.promo) x.promo.memo = fix(x.promo.memo); return x; };
export const config = (kind = 'branch') => { if (kind === 'general') { const g = D.settings && D.settings.general_fee; if (!(g && Array.isArray(g.items))) return generalCopy(config('branch')); return { ...DEFAULT, ...g, promo: { ...DEFAULT.promo, ...(g.promo || {}) } }; } const s = D.settings && D.settings.branch_fee; return s && Array.isArray(s.items) ? { ...DEFAULT, ...s, promo: { ...DEFAULT.promo, ...(s.promo || {}) } } : JSON.parse(JSON.stringify(DEFAULT)); };

// 구분 선택 풀기: '*' = 전체, '_rest' = 다른 항목에 지정되지 않은 나머지 구분
const catIds = () => (D.fee.categories || []).map((c) => c.id).concat(['_none']);
const resolveCats = (cats, cfg) => {
  if (!cats || !cats.length) return [];
  if (cats.includes('*')) return catIds();
  const named = new Set(); cfg.items.forEach((x) => (x.cats || []).forEach((c) => { if (c !== '*' && c !== '_rest') named.add(c); }));
  const out = new Set(cats.filter((c) => c !== '_rest'));
  if (cats.includes('_rest')) catIds().forEach((c) => { if (!named.has(c)) out.add(c); });
  return [...out];
};
export const catLabel = (cats) => {
  if (!cats || !cats.length) return '';
  if (cats.includes('*')) return '모든 상품';
  const cn = new Map((D.fee.categories || []).map((c) => [c.id, c.name]));
  return cats.map((c) => (c === '_rest' ? '그 밖의 구분' : cn.get(c) || c)).join('·');
};
export const srcLabel = (it) => [catLabel(it.cats), it.free ? '자율학기제' : ''].filter(Boolean).join(' + ');

// 실적 (지국 p.branch · 월급 월 ym)
export const perfB = (p, ym) => {
  const kym = addYm(ym, -2), fym = addYm(ym, -1);
  const es = D.entries.filter((e) => e.ym === kym && e.branch_id === p.branch);
  const fs = D.free.filter((f) => f.ym === fym && f.branch_id === p.branch);
  const ew = p.general ? D.entries.filter((e) => e.ym === kym) : es; const fw = p.general ? D.free.filter((f) => f.ym === fym) : fs; // 총국장: 모든 지국
  const agg = (list) => { const m = {}; list.forEach((e) => Object.entries(catsOf(e)).forEach(([c, v]) => { const t = m[c] || (m[c] = { sales: 0, rec: 0, com: 0, cnt: 0 }); t.sales += v.sales; t.rec += v.rec; t.com += v.com; t.cnt += v.cnt; })); return m; };
  const fa = (list) => ({ sales: sum(list, 'amount'), rec: sum(list, 'recognized'), com: sum(list, 'commission'), cnt: list.length });
  return {
    kdc_ym: kym, free_ym: fym,
    own: agg(es.filter((e) => !e.promoter_id)), branch: agg(ew),
    ownFree: fa(fs.filter((f) => !f.promoter_id)), branchFree: fa(fw),
    sales: sum(ew, 'amount') + sum(fw, 'amount'), rec: sum(ew, 'recognized') + sum(fw, 'recognized'),
    own_sales: sum(es.filter((e) => !e.promoter_id), 'amount') + sum(fs.filter((f) => !f.promoter_id), 'amount'),
    cnt: sum(ew, 'cnt'), registered: ew.length > 0 || fw.length > 0,
  };
};
const valueOf = (it, pf, cfg, share = 1) => {
  const m = it.type === 'commission' ? 'com' : it.measure || 'sales';
  const src = it.scope === 'branch' ? pf.branch : pf.own;
  let v = 0; resolveCats(it.cats, cfg).forEach((c) => { if (src[c]) v += src[c][m] || 0; });
  if (it.free) v += (it.scope === 'branch' ? pf.branchFree : pf.ownFree)[m] || 0;
  return it.scope === 'branch' ? v : Math.round(v * share);
};
const monthsText = (it, pf) => { const a = []; if ((it.cats || []).length) a.push(pf.kdc_ym); if (it.free) a.push('자율 ' + pf.free_ym); return a.join(' · ') + ' 매출'; };
// mg: 구간 여유액 (계정 할당 최적화에서 기준액 + 여유액 이상이어야 그 구간으로 봄)
const tierHit = (tiers, v, mg = 0) => (tiers || []).filter((t) => t && t.base != null).slice().sort((a, b) => a.base - b.base).filter((t) => v >= Number(t.base) + (Number(t.base) > 0 ? mg : 0)).pop() || null;

// 시책: 매출 월(kym)에 켜진 경우만 · 그 달에 끈 구간은 제외
export const promoMonth = (cfg, kym) => { const m = (cfg.promo.months || {})[kym]; return m && m.on ? m : null; };
// opt.share: 직할 매출 중 이 계정 몫 · opt.only: 'own'(직할 항목만) / 'branch'(지국 전체 항목·시책만)
const calcRaw = (p, ym, cfg, opt = {}) => {
  const pf = opt.pf || perfB(p, ym); const lines = []; const cf = p.general ? true : chiefFree(p.branch); const K = p.general ? 'general' : 'branch'; const share = opt.share == null ? 1 : opt.share;
  cfg.items.filter((it) => it.active !== false && (!opt.only || (opt.only === 'branch') === (it.scope === 'branch'))).forEach((it) => {
    const v = valueOf(it, pf, cfg, share);
    // 자율학기제만 보는 항목: 자율학기제를 안 하는 지국장·지국이면 표시하지 않음
    if (it.free && !(it.cats || []).length && !v && !(it.scope === 'own' ? cf : p.general || branchFree(p.branch))) return; let amount = 0, how = '';
    const what = scopeName(it.scope, K) + ' ' + srcLabel(it) + ' ' + measureName(it.type === 'commission' ? 'com' : it.measure);
    if (it.type === 'commission') { amount = Math.round(v); how = monthsText(it, pf) + ' · ' + scopeName(it.scope, K) + ' ' + srcLabel(it) + ' 수당표 합계'; }
    else if (it.type === 'rate') { amount = Math.round(v * (Number(it.rate) || 0)); how = monthsText(it, pf) + ' · ' + what + ' ' + won(v) + (it.measure === 'cnt' ? '건' : '원') + ' × ' + pct(it.rate); }
    else if (it.type === 'tier') { const t = tierHit(it.tiers, v, it.measure === 'cnt' ? 0 : pf.tierMargin || 0); amount = t ? (t.rate != null && t.rate !== '' ? Math.round(v * Number(t.rate)) : Number(t.amount) || 0) : 0; how = monthsText(it, pf) + ' · ' + what + ' ' + won(v) + (it.measure === 'cnt' ? '건' : '원') + ' → ' + (t ? (it.measure === 'cnt' ? won(t.base) + '건' : manwon(Number(t.base))) + ' 이상 구간' : '기준 미달'); }
    else if (it.type === 'fixed') { amount = Math.round(Number(it.value) || 0); how = '월 고정액'; }
    lines.push({ it, e: { src: 'default' }, amount, how, value: v });
  });
  const pm = opt.only === 'own' ? null : promoMonth(cfg, pf.kdc_ym);
  if (pm) {
    const P = cfg.promo; const v = valueOf({ ...P, type: 'tier', free: false }, pf, cfg);
    const tiers = (P.tiers || []).filter((t) => !(pm.off || []).includes(Number(t.base)));
    const t = tierHit(tiers, v); const amount = t ? Number(t.amount) || 0 : 0;
    lines.push({ it: { id: 'promo', name: P.name || 'K-디지털 시책', type: 'tier', tiers, measure: P.measure, scope: P.scope, cats: P.cats, memo: P.memo }, e: { src: 'promo' }, amount, value: v,
      how: pf.kdc_ym + ' 매출 시책 · ' + scopeName(P.scope, K) + ' ' + catLabel(P.cats) + ' ' + measureName(P.measure) + ' ' + won(v) + (P.measure === 'cnt' ? '건' : '원') + ' → ' + (t ? won(t.base) + (P.measure === 'cnt' ? '건' : '원') + ' 이상 구간' : '기준 미달') + ((pm.off || []).length ? ' (이번 달 제외 구간: ' + pm.off.map((b) => won(b)).join(', ') + ')' : '') });
  }
  const total = sum(lines, 'amount');
  return { pf, lines, total, tax: rdown10(total * RATE_TAX), local: rdown10(total * RATE_LOCAL), rds0: rdown10(total * RATE_RDS) };
};
// ---------- 계정 할당 (roll): 관리자가 지국마다 홍보팀장 계정 수·지국장 계정 수를 정하면 지국장 직할 매출을 그 수로 똑같이 나눠 계산 ----------
// settings.branch_alloc = { 지국ID: { on: true, promoters: 홍보팀장 계정 수, chiefs: 지국장 계정 수 } }  (권한 관리 → 지국)
export const allocAll = () => (D.settings && D.settings.branch_alloc) || {};
export const allocSet = (bid) => { const a = allocAll()[bid]; return a && typeof a === 'object' && !Array.isArray(a) && 'on' in a ? { on: !!a.on, promoters: Math.max(0, Math.floor(Number(a.promoters) || 0)), chiefs: Math.max(0, Math.floor(Number(a.chiefs) || 0)), cap: Math.max(0, Math.round(Number(a.cap) || 0)), accs: Array.isArray(a.accs) ? a.accs.map((x) => ({ start: /^\d{4}-\d{2}$/.test((x || {}).start || '') ? x.start : '' })) : [] } : { on: false, promoters: 0, chiefs: 1, cap: 0, accs: [] }; };
export const allocOf = (bid) => { const a = allocSet(bid); return a.on && a.promoters + a.chiefs > 0 && !(a.promoters === 0 && a.chiefs === 1) ? a : null; };
export const allocText = (a) => '홍보팀장 ' + a.promoters + '계정 · 지국장 ' + a.chiefs + '계정' + (a.cap ? ' · 구간 여유 ' + manwon(a.cap) : '');
export const ownRec = (pf) => Object.values(pf.own).reduce((a, v) => a + (v.rec || 0), 0) + (pf.ownFree.rec || 0);
export const ownTotal = (pf) => Object.values(pf.own).reduce((a, v) => a + (v.sales || 0), 0) + (pf.ownFree.sales || 0);
// 계정 1개의 실적(직할 몫): Case·개별 판매·자율학기제를 담은 결과
const zero = () => ({ sales: 0, rec: 0, com: 0, cnt: 0 });
const promoterPf = (pf, acc) => {
  const t = Object.values(acc.own).reduce((a, v) => ({ sales: a.sales + v.sales, rec: a.rec + v.rec, com: a.com + v.com, cnt: a.cnt + v.cnt }), zero()); const F = acc.free;
  return { kdc_ym: pf.kdc_ym, free_ym: pf.free_ym, kdc_sales: t.sales, kdc_rec: t.rec, comm: t.com, cnt: t.cnt,
    free_sales: F.sales, free_rec: F.rec, free_comm: F.com, free_cnt: F.cnt, free_amts: acc.freeAmts,
    sales: t.sales + F.sales, rec: t.rec + F.rec, team_sales: 0, team_rec: 0, team_free: 0, registered: true, kdcEntries: [] };
};
// 지국장 직할 매출을 나눌 수 있는 묶음으로: Case의 신청자(같은 Case 신청자는 똑같음) · 개별 판매(상품별) · 자율학기제(건별)
export const ownGroups = (p, kym, fym) => {
  const pm = pmap(); const groups = [];
  D.entries.filter((e) => e.ym === kym && e.branch_id === p.branch && !e.promoter_id).forEach((e) => {
    // 최소 단위 = 신청자 1명 (그 사람이 듣는 강의 묶음 · 강의별로 쪼갤 수 없음)
    const cs = casesOf(e); const rg = applicantRanges(cs);
    cs.forEach((c, ci) => {
      const n = Math.max(0, rg[ci].to - rg[ci].from + 1); if (!n) return;
      const own = {}; let sales = 0, rec = 0, com = 0;
      c.items.forEach((it) => { const cat = ((pm.get(it.pid) || {}).categoryId) || '_none'; const t = own[cat] || (own[cat] = zero()); t.sales += it.price; t.rec += it.rec; t.com += it.com; t.cnt += 1; sales += it.price; rec += it.rec; com += it.com; });
      groups.push({ kind: 'case', caseKey: c.key, name: c.name, titles: c.items.map((x) => x.title), pre: String(c.key || '').replace(/Case-\d+$/, ''), from: rg[ci].from, n, own, free: null, sales, rec, com });
    });
    singlesOf(e).forEach((q, pid) => { const x = pm.get(pid) || {}; const v = { sales: x['판매가'] || 0, rec: x['인정액'] || 0, com: x['수당'] || 0, cnt: 1 };
      groups.push({ kind: 'single', name: x['강의명'] || pid, titles: [x['강의명'] || pid], n: q, own: { [x.categoryId || '_none']: v }, free: null, sales: v.sales, rec: v.rec, com: v.com }); });
  });
  D.free.filter((f) => f.ym === fym && f.branch_id === p.branch && !f.promoter_id).forEach((f) => groups.push({ kind: 'free', key: f.key, name: f.school, titles: ['자율학기제'], n: 1, own: {}, free: { sales: f.amount, rec: f.recognized, com: f.commission, cnt: 1 }, sales: f.amount, rec: f.recognized, com: f.commission }));
  return groups;
};
// 계정의 실적 (묶음별 개수 cnt[] 로 합산)
const aggOf = (G, cnt) => {
  const own = {}; const free = zero(); const freeAmts = []; let rec = 0, sales = 0;
  G.forEach((g, i) => { const k = cnt[i]; if (!k) return;
    Object.entries(g.own).forEach(([c, v]) => { const t = own[c] || (own[c] = zero()); t.sales += v.sales * k; t.rec += v.rec * k; t.com += v.com * k; t.cnt += v.cnt * k; });
    if (g.free) { free.sales += g.free.sales * k; free.rec += g.free.rec * k; free.com += g.free.com * k; free.cnt += k; for (let j = 0; j < k; j++) freeAmts.push(g.free.sales); }
    rec += g.rec * k; sales += g.sales * k; });
  return { own, free, freeAmts, rec, sales };
};
// 계정 1개 월급 (홍보팀장 기준 = 홍보팀장 수당 · 지국장 기준 = 지국장 수당 중 직할 항목)
// 정착수당 (신입 홍보팀장 계정): 관리자가 정한 시작 월급월부터 6개월 안에 최대 횟수(수당 관리의 정착수당 최대 횟수, 기본 4회)
export const SETTLE_MONTHS = 6;
const settleItem = () => (D.fee_items || []).find((i) => i.id === 'settle') || null;
const settleState = (p, ym, al, i) => {
  const st = ((al.accs || [])[i] || {}).start; const it = settleItem(); if (!st || !it) return null;
  const end = addYm(st, SETTLE_MONTHS - 1); const max = Number(it.max_times) || 0; const base = { st, end, max, it, n: 0, ok: false };
  if (ym < st) return { ...base, why: '시작 월급월 ' + st + ' 전' };
  if (ym > end) return { ...base, why: '정착수당 기간(' + st + ' ~ ' + end + ')이 지남' };
  // 지난달까지 이 계정이 받은 횟수 (그 달들도 같은 방식으로 최적 배분해 계산)
  let n = 0; for (let m = st; m < ym; m = addYm(m, 1)) { const r = calcBranch(p, m, 'alloc'); const g = r.groups && r.groups.find((x) => x.acc.id === 'p' + (i + 1)); if (g && g.settle > 0) n++; }
  if (max && n >= max) return { ...base, n, why: '기간 안에 이미 ' + max + '회를 받음' };
  return { ...base, n, ok: true };
};
const settlePay = (S, ag, mg) => {
  const ts = (S.it.tiers || []).filter((t) => t && t.base != null).slice().sort((a, b) => a.base - b.base);
  const t = ts.filter((x) => ag.rec >= Number(x.base) + (Number(x.base) > 0 ? mg : 0)).pop();
  return { t, amount: t ? (t.rate != null && t.rate !== '' ? Math.round(ag.rec * Number(t.rate)) : Number(t.amount) || 0) : 0 };
};
const accPay = (p, ym, cfg, pf, role, ag, id, mg = 0, S = null) => {
  if (role === 'promoter') {
    const vp = { key: 'v:' + p.branch + ':' + id, name: id, role: 'promoter', branch: p.branch, bname: p.bname, pid: null, active: true };
    const r = calcPromoter(vp, ym, null, true, { ...promoterPf(pf, ag), tierMargin: mg });
    const lines = r.lines.map((l) => ({ it: { id: 'p_' + l.it.id, name: l.it.name, memo: '홍보팀장 기준' }, e: l.e, amount: l.amount, how: l.how }));
    let settle = 0;
    if (S && !r.lines.some((l) => l.it.id === 'settle')) {
      const when = '정착 ' + S.st + ' ~ ' + S.end;
      if (S.ok) { const x = settlePay(S, ag, mg); settle = x.amount; lines.push({ it: { id: 'p_settle', name: '정착수당', memo: '신입 홍보팀장 계정' }, e: { src: 'settle' }, amount: settle, how: '인정액 ' + won(ag.rec) + '원 → ' + (x.t ? manwon(Number(x.t.base)) + ' 이상 구간' : '기준 미달') + ' · ' + when + ' · ' + (settle > 0 ? (S.max ? S.max + '회 중 ' + (S.n + 1) + '회째' : (S.n + 1) + '회째') : '이번 달은 횟수 차감 없음') }); }
      else lines.push({ it: { id: 'p_settle', name: '정착수당', memo: '신입 홍보팀장 계정' }, e: { src: 'settle' }, amount: 0, how: when + ' · ' + S.why + ' · 0원' });
    }
    return { total: r.total + settle, settle, lines };
  }
  const r = calcRaw(p, ym, cfg, { only: 'own', pf: { ...pf, own: ag.own, ownFree: ag.free, tierMargin: mg } });
  return { total: r.total, lines: r.lines };
};
// 최적 배분: 계정들의 월급 합계가 가장 커지도록 신청자·개별 판매·자율학기제를 나눔
//  경우의 수가 감당할 만하면 exact()로 모든 조합 비교(정확한 최대값), 너무 많으면 아래 탐색
//  1) 시작안: 구간 기준액(장려수당 등)·상한마다 앞 계정부터 채우기 + 전부 지국장 계정
//  2) 다듬기: 묶음을 1·2·3·5·8…개씩 다른 계정으로 옮겨 합계가 늘면 반영 (더 늘지 않을 때까지)
// 정확한 최대값 (동적계획법): 계정마다 「몇 명/몇 개를 줄지」 모든 조합을 비교해 합계가 가장 큰 배분을 찾음
//  경우의 수가 너무 많으면(EXACT_STATES·EXACT_OPS 초과) 아래 탐색 방식으로 계산
const EXACT_STATES = 5000, EXACT_OPS = 60000000;
const exact = (G, accs0, payRole) => {
  const K = G.length; const n = G.map((g) => g.n); const mult = []; let size = 1; n.forEach((x) => { mult.push(size); size *= x + 1; });
  if (!K || size > EXACT_STATES) return null;
  const A = accs0.length; const P = n.reduce((a, x) => a * ((x + 1) * (x + 2) / 2), 1);
  if (Math.max(0, A - 2) * P + size > EXACT_OPS) return null;
  // 금액이 같으면 지국장 계정에 그대로 두고, 옮길 때는 홍보팀장 계정 1부터 채움
  const order = accs0.map((a, i) => i).sort((x, y) => (accs0[x].role === 'branch' ? 0 : 1) - (accs0[y].role === 'branch' ? 0 : 1) || x - y);
  const accs = order.map((i) => accs0[i]);
  const digits = (code) => { const d = []; for (let i = 0; i < K; i++) { d.push(code % (n[i] + 1)); code = Math.floor(code / (n[i] + 1)); } return d; };
  const units = new Int32Array(size); for (let c = 0; c < size; c++) units[c] = digits(c).reduce((a, b) => a + b, 0);
  const payArr = {}; const payOf = (sig) => { if (payArr[sig]) return payArr[sig]; const a = new Float64Array(size); for (let c = 0; c < size; c++) a[c] = payRole(sig, digits(c)); payArr[sig] = a; return a; };
  // f = 뒤쪽 계정들이 나머지를 받을 때 최대 합계 (뒤에서부터)
  let f = payOf(accs[A - 1].sig).slice(); const pick = [];
  for (let a = A - 2; a >= 0; a--) {
    const pa = payOf(accs[a].sig); const nf = new Float64Array(size); const ch = new Int32Array(size);
    const from = a === 0 ? size - 1 : 0;
    for (let code = from; code < size; code++) {
      const d = digits(code); const s = d.slice(); let sc = code; let best = -Infinity, bs = 0;
      for (;;) { const v = pa[sc] + f[code - sc]; if (v > best + 0.5 || (v > best - 0.5 && units[sc] > units[bs])) { if (v > best) best = v; bs = sc; }
        let i = 0; while (i < K && s[i] === 0) { s[i] = d[i]; sc += d[i] * mult[i]; i++; } if (i === K) break; s[i]--; sc -= mult[i]; }
      nf[code] = best; ch[code] = bs;
    }
    pick[a] = ch; f = nf;
  }
  // 배분 복원
  const rows = accs0.map(() => null); let rem = size - 1;
  for (let a = 0; a < A; a++) { const sc = a === A - 1 ? rem : pick[a][rem]; rows[order[a]] = digits(sc); rem -= sc; }
  return { v: f[size - 1], rows };
};
const optimize = (p, ym, cfg, pf, G, accs, cap) => {
  const A = accs.length; const memoP = new Map(); const bySig = new Map(accs.map((a) => [a.sig, a]));
  // 같은 역할 계정은 같은 기준으로 계산되므로 역할·개수로 기억
  const payRole = (sig, cnt) => { const key = sig + '|' + cnt.join(','); if (memoP.has(key)) return memoP.get(key); const a = bySig.get(sig); const v = accPay(p, ym, cfg, pf, a.role, aggOf(G, cnt), a.id, cap, a.S && a.S.ok ? a.S : null).total; /* 구간은 기준액 + 여유액(cap) 이상일 때만 달성으로 봄 */ memoP.set(key, v); return v; };
  const pay = (ai, cnt) => payRole(accs[ai].sig, cnt);
  const ex = exact(G, accs, payRole); if (ex) { optimize.last = 'exact'; return ex.rows; }
  optimize.last = 'search';
  const score = (C) => C.reduce((s2, row, ai) => s2 + pay(ai, row), 0);
  const units = []; G.forEach((g, gi) => { for (let j = 0; j < g.n; j++) units.push(gi); });
  const R = G.reduce((x, g) => x + g.rec * g.n, 0);
  const fill = (t) => { const C = accs.map(() => G.map(() => 0)); let k = 0, acc = 0; units.forEach((gi) => { C[k][gi]++; acc += G[gi].rec; if (k < A - 1 && acc >= t) { k++; acc = 0; } }); return C; };
  const ths = new Set(); ths.add(Math.ceil(R / A));
  (D.fee_items || []).forEach((it) => (Array.isArray(it.tiers) ? it.tiers : []).forEach((t) => { if (t && t.base > 0 && t.base + cap <= R) ths.add(Number(t.base) + cap); }));
  (D.fee.incentive || []).concat(D.fee.settle || []).forEach((t) => { if (t['기준액'] > 0 && t['기준액'] + cap <= R) ths.add(Number(t['기준액']) + cap); });
  const cands = [...ths].map(fill);
  const chiefIdx = accs.findIndex((a) => a.role === 'branch'); const all = accs.map(() => G.map(() => 0)); all[chiefIdx >= 0 ? chiefIdx : A - 1] = G.map((g) => g.n); cands.push(all);
  let best = null, bestS = -Infinity;
  cands.forEach((C) => { const sc = score(C); if (sc > bestS) { bestS = sc; best = C.map((r) => r.slice()); } });
  const steps = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
  for (let it = 0; it < 400; it++) {
    let mv = null, gain = 0;
    for (let gi = 0; gi < G.length; gi++) for (let a = 0; a < A; a++) { const have = best[a][gi]; if (!have) continue;
      for (let b = 0; b < A; b++) { if (b === a) continue;
        for (const k0 of steps.concat([have])) { const k = Math.min(k0, have); const ra = best[a].slice(), rb = best[b].slice(); ra[gi] -= k; rb[gi] += k;
          const d = pay(a, ra) + pay(b, rb) - pay(a, best[a]) - pay(b, best[b]); if (d > gain + 0.5) { gain = d; mv = [a, b, ra, rb]; } } } }
    if (!mv) break; best[mv[0]] = mv[2]; best[mv[1]] = mv[3]; bestS += gain;
  }
  return best;
};
const calcAllocRaw = (p, ym, cfg, al) => {
  const pf = perfB(p, ym); const G = ownGroups(p, pf.kdc_ym, pf.free_ym);
  const accs = []; for (let i = 1; i <= al.promoters; i++) { const S = settleState(p, ym, al, i - 1); accs.push({ id: 'p' + i, name: '홍보팀장 계정 ' + i + (S ? ' (신입)' : ''), role: 'promoter', S, sig: S && S.ok ? 'promoter:settle' + i : 'promoter' }); } for (let i = 1; i <= al.chiefs; i++) accs.push({ id: 'b' + i, name: '지국장 계정 ' + i, role: 'branch', sig: 'branch' });
  const C = optimize(p, ym, cfg, pf, G, accs, al.cap); const method = optimize.last;
  // 신청자 번호: Case마다 계정 순서대로 앞번호부터
  const nextNo = G.map((g) => g.from || 1);
  const R = G.reduce((x, g) => x + g.rec * g.n, 0);
  accs.forEach((a, ai) => { const ag = aggOf(G, C[ai]); Object.assign(a, ag); a.amount = ag.sales; a.rows = []; a.people = 0;
    G.forEach((g, gi) => { const k = C[ai][gi]; if (!k) return;
      if (g.kind === 'case') { a.rows.push({ kind: 'case', caseKey: g.caseKey, name: g.name, titles: g.titles, from: nextNo[gi], to: nextNo[gi] + k - 1, headcount: k, sales: g.sales * k, rec: g.rec * k, com: g.com * k }); nextNo[gi] += k; a.people += k; }
      else if (g.kind === 'single') a.rows.push({ kind: 'single', name: g.name, titles: g.titles, headcount: k, sales: g.sales * k, rec: g.rec * k, com: g.com * k });
      else a.rows.push({ kind: 'free', key: g.key, name: g.name, titles: g.titles, headcount: k, sales: g.sales * k, rec: g.rec * k, com: g.com * k }); }); });
  const T = pf.own_sales || 1;
  const groups = accs.map((a) => { const r = accPay(p, ym, cfg, pf, a.role, a, a.id, 0, a.S); return { acc: a, share: a.sales / T, total: r.total, settle: r.settle || 0, lines: r.lines }; });
  const wide = calcRaw(p, ym, cfg, { only: 'branch' });
  const one = calcRaw(p, ym, cfg); // 지국장 1명 기준 (비교용)
  const lines = []; groups.forEach((g) => g.lines.forEach((l) => lines.push({ ...l, group: g.acc.name }))); wide.lines.forEach((l) => lines.push({ ...l, group: '지국 전체 기준' }));
  const total = sum(groups, 'total') + wide.total;
  return { pf, lines, groups, wide: wide.lines, alloc: al, method, target: al.cap || Math.ceil(R / accs.length), ownTotal: pf.own_sales, ownRec: R, baseTotal: one.total, total, tax: rdown10(total * RATE_TAX), local: rdown10(total * RATE_LOCAL), rds0: rdown10(total * RATE_RDS) };
};
// 적립금(RDS) 누적 한도: 지난달까지 공제한 RDS 합계가 한도에 닿으면 더 공제하지 않음
// mode: 'base' = 기본 계산 · 'alloc' = 계정 할당이 있으면 할당 합산으로 계산
const memo = { at: null, m: new Map() };
export const calcBranch = (p, ym, mode = 'base') => {
  if (memo.at !== D.loadedAt) { memo.at = D.loadedAt; memo.m = new Map(); }
  const k = p.key + '|' + ym + '|' + mode; if (memo.m.has(k)) return memo.m.get(k);
  { const sn = snapResult(p.key, ym); if (sn) { memo.m.set(k, sn); return sn; } } // 마감한 달 = 확정 월급
  const cfg = config(p.general ? 'general' : 'branch'); const al = mode === 'alloc' && !p.general ? allocOf(p.branch) : null;
  const r = al ? calcAllocRaw(p, ym, cfg, al) : calcRaw(p, ym, cfg); const cap = Number(cfg.rds_cap) || 0;
  let paid = 0;
  if (cap > 0) {
    const first = [...D.entries.filter((e) => p.general || e.branch_id === p.branch).map((e) => addYm(e.ym, 2)), ...D.free.filter((f) => p.general || f.branch_id === p.branch).map((f) => addYm(f.ym, 1))].sort()[0];
    if (first && first < ym) { for (let m = first; m < ym; m = addYm(m, 1)) { const x = calcBranch(p, m, mode); paid += x.rds; } }
  }
  const rds = cap > 0 ? Math.max(0, Math.min(r.rds0, cap - paid)) : r.rds0;
  const out = { ...r, rds, rdsPaid: paid, rdsCap: cap, ded: r.tax + r.local + rds };
  out.net = r.total - out.ded;
  memo.m.set(k, out); return out;
};


// 홍보팀장 관리 화면용: 할당 계정(홍보팀장 계정 i)의 정착수당 받은 달 (upto 월급월까지)
export const settleInfo = (bid, i, upto) => {
  const al = allocSet(bid); const st = ((al.accs || [])[i] || {}).start; const it = settleItem(); if (!st || !it) return null;
  const end = addYm(st, SETTLE_MONTHS - 1); const max = Number(it.max_times) || 0; const got = [];
  const chief = personOf('b:' + bid);
  if (chief && allocOf(bid) && i < al.promoters) for (let m = st; m <= end && m <= upto; m = addYm(m, 1)) { const r = calcBranch(chief, m, 'alloc'); const g = r.groups && r.groups.find((x) => x.acc.id === 'p' + (i + 1)); if (g && g.settle > 0) got.push(m); }
  return { st, end, max, got };
};
