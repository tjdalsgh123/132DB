// 메뉴 구조: 대메뉴(단독 화면 또는 묶음) / 중메뉴(화면)
// 관리자 「메뉴 관리」 설정(settings.layout = { nav, labels, hidden })으로 순서·위치·이름·숨김을 바꿀 수 있음
import { D } from './store.js';

export const PAGES = [
  ['branch', '대시보드'], ['board', '게시판'], ['fee', '수당계산기'],
  ['psalesin', 'KDC 매출 등록'], ['pfreein', '자율학기제 매출 등록'], ['petcin', '기타 상품 판매 등록'], ['psales', '매출 현황'], ['ppay', '월급 계산'],
  ['salesin', '직할 매출 등록'], ['sfreein', '자율학기제 직할 등록'], ['setcin', '기타 상품 직할 등록'], ['sales', '지국 매출 현황'], ['promoters', '홍보팀장 관리'], ['bpay', '지국장 월급 계산'],
  ['gdash', '총국장 대시보드'], ['gsalesin', '직할 매출 등록'], ['gfreein', '자율학기제 직할 등록'], ['getcin', '기타 상품 직할 등록'], ['gsales', '총국 매출 현황'], ['gpromoters', '홍보팀장 관리'], ['gpay', '총국장 월급 계산'],
  ['admin', '권한 관리'], ['feeadmin', '수당 관리'], ['paylist', '수당 현황'], ['payedit', '수당 등록'], ['payclose', '월급 마감'], ['logs', '로그 관리'], ['menuadmin', '메뉴 관리'], ['boardadmin', '게시판 관리'],
];
const IDS = PAGES.map((p) => p[0]);
export const DEFAULT_NAV = [
  { type: 'page', id: 'branch' },
  { type: 'page', id: 'board' },
  { type: 'page', id: 'fee' },
  { type: 'group', id: 'g_promoter', name: '홍보팀장', items: ['psalesin', 'pfreein', 'petcin', 'psales', 'ppay'] },
  { type: 'group', id: 'g_branch', name: '지국장', items: ['salesin', 'sfreein', 'setcin', 'sales', 'promoters', 'bpay'] },
  { type: 'group', id: 'g_general', name: '총국장', items: ['gdash', 'gsalesin', 'gfreein', 'getcin', 'gsales', 'gpromoters', 'gpay'] },
  { type: 'group', id: 'g_admin', name: '관리자', items: ['admin', 'feeadmin', 'paylist', 'payedit', 'payclose', 'logs', 'menuadmin', 'boardadmin'] },
];
// 관리 화면은 숨길 수 없음 (잠김 방지)
export const LOCKED = ['admin', 'menuadmin'];
export const defaultLabel = (id) => (PAGES.find((p) => p[0] === id) || [id, id])[1];

const raw = () => (D.settings && D.settings.layout) || {};
// 저장된 구조 정리: 모든 화면이 정확히 한 번씩 들어가도록 (새 화면은 기본 위치에)
export const tree = (src) => {
  const s = Array.isArray(src) ? src : Array.isArray(raw().nav) && raw().nav.length ? raw().nav : DEFAULT_NAV;
  const seen = new Set(); const out = [];
  s.forEach((e) => {
    if (e && e.type === 'page' && IDS.includes(e.id) && !seen.has(e.id)) { seen.add(e.id); out.push({ type: 'page', id: e.id }); }
    else if (e && e.type === 'group' && e.id) {
      const items = (e.items || []).filter((id) => IDS.includes(id) && !seen.has(id)); items.forEach((id) => seen.add(id));
      out.push({ type: 'group', id: e.id, name: String(e.name || '대메뉴'), items });
    }
  });
  IDS.forEach((id) => {
    if (seen.has(id)) return;
    const home = DEFAULT_NAV.find((g) => g.type === 'group' && g.items.includes(id));
    const g = home && out.find((x) => x.type === 'group' && x.id === home.id);
    if (g) { const prev = home.items[home.items.indexOf(id) - 1]; const i = g.items.indexOf(prev); g.items.splice(i >= 0 ? i + 1 : g.items.length, 0, id); }
    else if (home && !out.some((x) => x.id === home.id)) { const ai = out.findIndex((x) => x.type === 'group' && x.id === 'g_admin'); out.splice(ai >= 0 ? ai : out.length, 0, { type: 'group', id: home.id, name: home.name, items: [id] }); }
    else if (id === 'board') { const i = out.findIndex((x) => x.type === 'page' && x.id === 'branch'); out.splice(i >= 0 ? i + 1 : out.length, 0, { type: 'page', id }); }
    else out.push({ type: 'page', id });
  });
  return out;
};
export const layout = () => { const l = raw(); return { nav: tree(), labels: { ...(l.labels || {}) }, hidden: (l.hidden || []).filter((x) => !LOCKED.includes(x)) }; };
export const labelOf = (id) => (id === 'account' ? '내 계정' : (raw().labels || {})[id] || defaultLabel(id));
export const parentOf = (id) => tree().find((e) => e.type === 'group' && e.items.includes(id)) || null;
export const groupOf = (id) => (parentOf(id) || {}).name || '';
export const isHidden = (id) => !LOCKED.includes(id) && (raw().hidden || []).includes(id);
// 권한 화면용: 현재 구조 순서의 화면 목록 [{id, label, group}]
export const ALWAYS = ['board']; // 로그인한 모든 사람에게 보이는 화면 (권한 체크 없음)
export const menus = () => tree().filter((e) => !(e.type === 'page' && ALWAYS.includes(e.id))).flatMap((e) => (e.type === 'page' ? [{ id: e.id, label: labelOf(e.id), group: '' }] : e.items.map((id) => ({ id, label: labelOf(id), group: e.name }))));
