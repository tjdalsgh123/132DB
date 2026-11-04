// 데이터: 로그인한 사람의 범위 안 데이터만 app_bootstrap 으로 받아 둠
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { busy } from './ui.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });

export const D = { me: null, roles: [], settings: {}, branches: [], promoters: [], entries: [], items: {}, cases: {}, free: [], prod: [], fee: {}, fee_items: [], person_fee: [], inputs: [], users: [], at: '', hash: null };
const listeners = new Set();
export const onChange = (f) => { listeners.add(f); return () => listeners.delete(f); };
const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

export const rpc = async (fn, args) => { const { data, error } = await sb.rpc(fn, args || {}); if (error) throw error; return data; };
// 저장: 팝업을 띄우고 저장 → 최신 데이터 다시 읽기까지 끝나면 완료
export const save = (fn, args) => busy.run(async () => { const r = await rpc(fn, args); try { await load(); } catch (_) { setTimeout(() => load().catch(() => {}), 1500); } return r; });

export const load = async () => {
  const r = await rpc('app_bootstrap');
  Object.assign(D, r || {});
  D.entries = (D.entries || []).map((x) => ({ ...x, amount: +x.amount || 0, cnt: +x.cnt || 0, recognized: +x.recognized || 0, commission: +x.commission || 0, item_qty: +x.item_qty || 0 }));
  D.free = (D.free || []).map((a) => ({ id: a[0], branch_id: a[1], promoter_id: a[2], ym: a[3], seq: +a[4] || 0, key: a[5], school: a[6] || '', amount: +a[7] || 0, recognized: +a[8] || 0, commission: +a[9] || 0, memo: a[10] || '', updated_by: a[11] || '', updated_at: a[12] || '' }));
  D.fee = D.fee || {};
  try { const x = await rpc('app_pay_extra'); D.ecats = (x && x.cats) || null; D.bfree = (x && x.bfree) || {}; D.chiefs = (x && x.chiefs) || {}; } catch (_) { D.ecats = null; D.bfree = D.bfree || {}; D.chiefs = D.chiefs || {}; }
  try { const b = await rpc('app_board_list'); D.boards = (b && b.boards) || []; D.posts = (b && b.posts) || []; } catch (_) { D.boards = D.boards || []; D.posts = D.posts || []; }
  try { const x = await rpc('app_payroll_list'); D.closes = (x && x.closes) || []; D.snaps = new Map(((x && x.snaps) || []).map((s) => [s.ym + '|' + s.key, s])); } catch (_) { D.closes = D.closes || []; D.snaps = D.snaps || new Map(); }
  D.loadedAt = new Date();
  try { D.hash = await rpc('app_hash'); } catch (_) { /* 지문은 없어도 동작 */ }
  emit();
  return D;
};
// 5분마다 바뀐 게 있는지만 확인 (편집 중인 화면은 각 화면이 알아서 보존)
let timer = null;
export const startAutoRefresh = () => {
  if (timer) return;
  timer = setInterval(async () => {
    if (document.visibilityState === 'hidden') return;
    try { const h = await rpc('app_hash'); if (h && h !== D.hash) await load(); } catch (_) {}
  }, 300000);
};
export const stopAutoRefresh = () => { clearInterval(timer); timer = null; };

// ---------- 권한 ----------
const hasRaw = (menu) => !!D.me && (D.me.admin || (D.me.menus || []).includes(menu));
// 자율학기제: 지국장(지국 범위)은 「지국장 → 자율학기제 매출 등록(sfreein)」, 홍보팀장은 「홍보팀장 → 자율학기제 매출 등록(pfreein)」
export const has = (menu) => {
  if (!D.me) return false;
  if (D.me.admin) return true;
  if (menu === 'board') return true; // 게시판: 로그인한 모든 사람
  if (menu === 'gfreein') return hasRaw('gfreein') && !!D.me.free; // 총국장 본인 자율학기제만
  const br = D.me.scope === 'branch';
  if (menu === 'pfreein') return D.me.scope === 'own' && hasRaw('pfreein'); // 홍보팀장 본인만 (지국장·총국장은 직할 메뉴)
  if (menu === 'sfreein') return br && (hasRaw('sfreein') || hasRaw('salesin')) && !!D.me.free; // 지국장 본인 자율학기제만
  return hasRaw(menu);
};
export const isAdmin = () => !!(D.me && D.me.admin);
export const scope = () => (D.me ? D.me.scope : 'none');

// ---------- 기준 정보 ----------
export const products = () => (D.fee.products || []);
export const pmap = () => new Map(products().map((p) => [p.id, p]));
export const vendorName = () => new Map((D.fee.vendors || []).map((x) => [x.id, x.name]));
export const categoryName = () => new Map((D.fee.categories || []).map((x) => [x.id, x.name]));
export const bname = (id) => (D.branches.find((b) => b.id === id) || {}).name || id || '';
// 지국장 이름 (지국 직할 = 지국장): DB가 알려 준 이름 → 관리자는 사람 목록 → 본인
export const chiefName = (bid) => {
  if (!bid) return '';
  const c = (D.chiefs || {})[bid]; if (c) return c;
  const u = (D.users || []).find((x) => x.branch === bid && x.active !== false && ((D.roles.find((r) => r.id === x.role) || {}).scope === 'branch'));
  if (u && u.name) return u.name;
  return D.me && D.me.scope === 'branch' && D.me.branch === bid ? D.me.name || '' : '';
};
export const directName = (bid) => { const n = chiefName(bid); return '지국 직할' + (n ? ' · ' + n : ''); };
export const pname = (id, bid) => (id ? (D.promoters.find((p) => p.id === id) || {}).name || id : directName(bid));
const p2 = (n) => String(n).padStart(2, '0');
export const branchCode = (id) => { const b = D.branches.find((x) => x.id === id); return b ? b.code || p2(D.branches.indexOf(b) + 1) : '??'; };
export const promoterCode = (id) => { if (!id) return '00'; const p = D.promoters.find((x) => x.id === id); return p && p.code ? p.code : '??'; };
// 키 앞부분: 연월-지국코드-홍보팀장코드(직할 00)-
export const keyPrefix = (ym, branch, promoter) => ym + '-' + (branch ? branchCode(branch) : '지국') + '-' + (branch ? promoterCode(promoter) : '팀장') + '-';

// 볼 수 있는 지국 · 홍보팀장
export const branchChoices = () => {
  const act = D.branches.filter((b) => b.active !== false);
  const s = scope();
  if (s === 'all') return act;
  if (s === 'branch') return act.filter((b) => b.id === D.me.branch);
  if (s === 'own') { const p = D.promoters.find((x) => x.id === D.me.promoter); return p ? act.filter((b) => b.id === p.branch_id) : []; }
  return [];
};
export const promoterChoices = (branch) => {
  const l = D.promoters.filter((p) => p.branch_id === branch && p.active !== false);
  return scope() === 'own' ? l.filter((p) => p.id === D.me.promoter) : l;
};
// 자율학기제를 보여 줄지 (관리자 · 체크된 홍보팀장 · 이미 등록된 자율학기제 매출이 있음)
// 그 사람(홍보팀장)이 자율학기제 대상인지: 권한 관리에서 체크됨 · 또는 이미 등록된 자율학기제 매출이 있음 (보는 사람과 무관)
export const personFree = (pid) => !!pid && (!!(D.promoters.find((p) => p.id === pid) || {}).free || D.free.some((f) => f.promoter_id === pid));
// 지국에 자율학기제 대상 홍보팀장이 있는지
// 지국장(지국 직할) 자율학기제: 지국장 계정의 자율학기제 체크 · 또는 이미 등록된 지국 직할 자율학기제 매출
export const chiefFree = (bid) => !!bid && (!!(D.bfree || {})[bid] || D.free.some((f) => f.branch_id === bid && !f.promoter_id) || (scope() === 'branch' && D.me.branch === bid && !!D.me.free));
export const branchFree = (bid) => D.promoters.some((p) => p.branch_id === bid && personFree(p.id)) || D.free.some((f) => f.branch_id === bid) || chiefFree(bid);
// 매출 1건의 구분별 합계 {구분ID: {sales, rec, com, cnt}} (DB 함수가 없으면 전체를 첫 구분으로)
export const catsOf = (e) => {
  const raw = D.ecats && D.ecats[String(e.entry_id)];
  if (raw) { const o = {}; Object.entries(raw).forEach(([k, a]) => { o[k] = { sales: +a[0] || 0, rec: +a[1] || 0, com: +a[2] || 0, cnt: +a[3] || 0 }; }); return o; }
  const c0 = ((D.fee.categories || [])[0] || {}).id || '_none';
  return { [c0]: { sales: e.amount || 0, rec: e.recognized || 0, com: e.commission || 0, cnt: e.cnt || 0 } };
};
export const freeOnPromoter = (pid) => isAdmin() ? true : (!!pid && (!!(D.promoters.find((p) => p.id === pid) || {}).free || D.free.some((f) => f.promoter_id === pid)));

// ---------- 매출 ----------
export const findEntry = (branch, promoter, ym) => D.entries.find((e) => e.branch_id === branch && (e.promoter_id || '') === (promoter || '') && e.ym === ym) || null;
const noOf = (key, i) => { const m = /Case-(\d+)$/.exec(key || ''); return m ? Number(m[1]) : i + 1; };
// 저장된 Case: [{key, no, name, headcount, memo, items:[{pid,title,price,rec,com}]}]
export const casesOf = (e) => (e ? (D.cases[String(e.entry_id)] || []).map(([key, nm, hc, me, its], i) => ({ key, no: noOf(key, i), name: nm || '', headcount: +hc || 0, memo: me || '', items: (its || []).map(([pid, t, pr, rc, cm]) => ({ pid, title: t, price: +pr || 0, rec: +rc || 0, com: +cm || 0 })) })) : []);
// 따로 판 건수: Map(pid → qty) · 음수 = 미승인 차감 (Case에 든 상품을 본사 미승인으로 뺌)
export const singlesOf = (e) => { const m = new Map(); if (e) (D.items[String(e.entry_id)] || []).forEach(([pid, , sq]) => { if (+sq) m.set(pid, +sq); }); return m; };
// 미승인 차감 사유: Map(pid → 사유) · 따로 판 건수가 음수(차감)인 상품
export const singleNotesOf = (e) => { const m = new Map(); if (e) (D.items[String(e.entry_id)] || []).forEach(([pid, , sq, nt]) => { if (+sq < 0) m.set(pid, nt || ''); }); return m; };
// 상품별 합계 건수
export const qtyOf = (e) => { const m = new Map(); if (e) (D.items[String(e.entry_id)] || []).forEach(([pid, q]) => m.set(pid, (m.get(pid) || 0) + (+q || 0))); return m; };
// 신청자 번호: Case 순서대로 등록자 수만큼 1부터
export const applicantRanges = (cases) => { let n = 0; return cases.map((c) => { const h = Math.max(0, Number(c.headcount) || 0); const r = { from: n + 1, to: n + h }; n += h; return r; }); };
export const rangeText = (pre, r) => (r.to < r.from ? '등록자 없음' : pre + '신청자-' + r.from + (r.to > r.from ? ' ~ ' + r.to : ''));

// 로그인 계정 관리 (Edge Function admin-users · 관리자만)
export const edge = async (action, body) => {
  const { data, error } = await sb.functions.invoke('admin-users', { body: { action, ...(body || {}) } });
  if (error) {
    let m = error.message;
    try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch (_) {}
    throw new Error(m);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
};

// ---------- 월급 마감 ----------
// 월급 월(YYYY-MM)이 마감됐으면 마감 정보 · 확정 월급(사람 key)
export const closedOf = (ym) => (D.closes || []).find((c) => c.ym === ym) || null;
export const snapOf = (key, ym) => { const s = D.snaps && D.snaps.get(ym + '|' + key); return s ? s : null; };
// 확정 월급을 계산 결과 모양으로 (마감 표시 포함)
export const snapResult = (key, ym) => { const s = snapOf(key, ym); if (!s) return null; const c = closedOf(ym); return { ...s.data, closed: { ym, at: c ? c.closed_at : '', by: c ? c.closed_by : '' } }; };
// 매출 월 → 그 매출이 들어가는 월급 월이 마감됐는지 (KDC 등 +2개월 · 자율학기제 +1개월)
export const salesLocked = (salesYm, free) => { if (!salesYm) return null; let [y, m] = salesYm.split('-').map(Number); m += free ? 1 : 2; while (m > 12) { m -= 12; y += 1; } return closedOf(y + '-' + String(m).padStart(2, '0')); };
