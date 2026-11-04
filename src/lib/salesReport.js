// 매출 현황 공통: 상품별 집계 · Case 행 · 엑셀 리포트
import { directName, chiefName, pmap, vendorName, categoryName, bname, pname, keyPrefix, casesOf, singlesOf, singleNotesOf, qtyOf, applicantRanges, rangeText } from './store.js';
import { sum, addYm } from './ui.js';
import { XLSX, download, T, Mn, N, P } from './xlsx.js';

const MAXP = 3;
export const catOf = (pid) => { const p = pmap().get(pid) || {}; return { cat: categoryName().get(p.categoryId) || '', ven: vendorName().get(p.vendorId) || '' }; };
export const prodAgg = (list) => {
  const pm = pmap(); const m = new Map();
  list.forEach((e) => qtyOf(e).forEach((n, pid) => {
    if (!n) return; const p = pm.get(pid) || {}; const cv = catOf(pid);
    const x = m.get(pid) || { pid, title: p['강의명'] || pid, cat: cv.cat, ven: cv.ven, price: p['판매가'] || 0, n: 0, a: 0, r: 0, m: 0 };
    x.n += n; x.a += n * (p['판매가'] || 0); x.r += n * (p['인정액'] || 0); x.m += n * (p['수당'] || 0); m.set(pid, x);
  }));
  return Array.from(m.values()).sort((a, b) => b.n - a.n || b.a - a.a);
};
export const sortE = (l) => l.slice().sort((a, b) => (a.ym + bname(a.branch_id) + (a.promoter_id ? pname(a.promoter_id) : '')).localeCompare(b.ym + bname(b.branch_id) + (b.promoter_id ? pname(b.promoter_id) : '')));
export const caseRows = (list) => {
  const out = []; const pm = pmap();
  sortE(list).forEach((e) => {
    const cs = casesOf(e); const rg = applicantRanges(cs); const pf = keyPrefix(e.ym, e.branch_id, e.promoter_id);
    cs.forEach((c, ci) => { const ua = sum(c.items, 'price'), ur = sum(c.items, 'rec'), um = sum(c.items, 'com'); const n = c.headcount; out.push({ e, kind: 'case', no: c.no, key: c.key, pre: pf, rg: rg[ci], range: rangeText(pf, rg[ci]), name: c.name, c, n, ua, ur, um, a: ua * n, r: ur * n, m: um * n }); });
    const nts = singleNotesOf(e); singlesOf(e).forEach((n, pid) => { const p = pm.get(pid) || {}; const it = { pid, title: p['강의명'] || pid, price: p['판매가'] || 0, rec: p['인정액'] || 0, com: p['수당'] || 0 }; out.push({ e, kind: 'single', key: '', name: '', note: nts.get(pid) || '', c: { items: [it] }, n, ua: it.price, ur: it.rec, um: it.com, a: it.price * n, r: it.rec * n, m: it.com * n }); });
  });
  return out;
};


export const salesReport = (V, isP, lastPer, lastFree) => {
  const isY = V.per === 'year'; const label = isY ? V.year + '년' : V.year + '-' + V.per;
  const rowsC = caseRows(lastPer); const plist = prodAgg(lastPer);
  if (!rowsC.length && !plist.length && !lastFree.length) return null;
  const who = (e) => (e.promoter_id ? pname(e.promoter_id) : directName(e.branch_id));
  const s0cols = [T('신청자 키'), T('연월'), T('지국'), T('구분'), T('홍보팀장'), N('신청자 번호'), T('Case 키'), T('Case 이름')];
  for (let k = 1; k <= MAXP; k++) s0cols.push(T('상품 ' + k), Mn('상품 ' + k + ' 판매가'), Mn('상품 ' + k + ' 수당'));
  s0cols.push(Mn('판매가 합계'), Mn('인정액 합계'), Mn('수당 합계'));
  const s0rows = [];
  rowsC.filter((x) => x.kind === 'case').forEach((x) => { for (let a = x.rg.from; a <= x.rg.to; a++) { const r = [x.pre + '신청자-' + a, x.e.ym, bname(x.e.branch_id), x.e.promoter_id ? '홍보팀장' : '지국 직할', x.e.promoter_id ? pname(x.e.promoter_id) : chiefName(x.e.branch_id), a, x.key, x.name]; for (let k = 0; k < MAXP; k++) { const it = x.c.items[k]; r.push(it ? it.title : '', it ? it.price : null, it ? it.com : null); } r.push(x.ua, x.ur, x.um); s0rows.push(r); } });
  const tn = sum(plist, 'n');
  const sp = { name: '상품별 수량', cols: [N('순위'), T('구분'), T('업체'), T('강의명'), Mn('판매가'), N('판매 건수'), P('비중'), Mn('매출액'), Mn('인정액'), Mn('수당')], rows: plist.map((x, i) => [i + 1, x.cat, x.ven, x.title, x.price, x.n, tn ? x.n / tn : null, x.a, x.r, x.m]).concat([[null, '합계', '', '', null, tn, 1, sum(plist, 'a'), sum(plist, 'r'), sum(plist, 'm')]]) };
  const pm = pmap(); const sp2rows = []; sortE(lastPer).forEach((e) => qtyOf(e).forEach((n, pid) => { if (!n) return; const p = pm.get(pid) || {}; const cv = catOf(pid); sp2rows.push([e.ym, bname(e.branch_id), who(e), cv.cat, cv.ven, p['강의명'] || pid, p['판매가'] || 0, n, n * (p['판매가'] || 0), n * (p['인정액'] || 0), n * (p['수당'] || 0)]); }));
  const sp2 = { name: '등록별 상품 수량', cols: [T('연월'), T('지국'), T('등록'), T('구분'), T('업체'), T('강의명'), Mn('판매가'), N('판매 건수'), Mn('매출액'), Mn('인정액'), Mn('수당')], rows: sp2rows };
  const s1cols = [T('Case 키'), T('신청자 범위'), T('연월'), T('지국'), T('구분'), T('홍보팀장'), N('Case 번호'), T('Case 이름'), N('상품 수')];
  for (let k = 1; k <= MAXP; k++) s1cols.push(T('상품 ' + k), Mn('상품 ' + k + ' 수당'));
  s1cols.push(N('등록자 수'), Mn('1명 판매가'), Mn('1명 인정액'), Mn('1명 수당'), Mn('판매가 합계'), Mn('인정액 합계'), Mn('수당 합계'));
  const s1 = { name: 'Case별 매출', cols: s1cols, rows: rowsC.filter((x) => x.kind === 'case').map((x) => { const r = [x.key, x.range, x.e.ym, bname(x.e.branch_id), x.e.promoter_id ? '홍보팀장' : '지국 직할', x.e.promoter_id ? pname(x.e.promoter_id) : chiefName(x.e.branch_id), x.no, x.name, x.c.items.length]; for (let k = 0; k < MAXP; k++) { const it = x.c.items[k]; r.push(it ? it.title : '', it ? it.com : null); } r.push(x.n, x.ua, x.ur, x.um, x.a, x.r, x.m); return r; }) };
  const s2rows = []; rowsC.forEach((x) => x.c.items.forEach((it, k) => { const cv = catOf(it.pid); s2rows.push([x.kind === 'case' ? x.key : '', x.kind === 'case' ? x.range : '', x.e.ym, bname(x.e.branch_id), who(x.e), x.kind === 'case' ? x.no : null, x.kind === 'case' ? x.name : (x.n < 0 ? '미승인 차감' + (x.note ? ' · ' + x.note : '') : '개별 판매'), x.kind === 'case' ? k + 1 : null, cv.cat, cv.ven, it.title, it.price, it.rec, it.com, it.rec ? it.com / it.rec : null, x.n, it.price * x.n, it.rec * x.n, it.com * x.n]); }));
  const s2 = { name: '상품별 수당', cols: [T('Case 키'), T('신청자 범위'), T('연월'), T('지국'), T('등록'), N('Case 번호'), T('Case 이름'), N('묶음 칸'), T('구분'), T('업체'), T('강의명'), Mn('1건 판매가'), Mn('1건 인정액'), Mn('1건 수당'), P('수당율'), N('건수 (등록자 수)'), Mn('판매가 합계'), Mn('인정액 합계'), Mn('수당 합계')], rows: s2rows };
  const g = new Map(); rowsC.forEach((x) => { const k = x.e.ym + '|' + x.e.branch_id + '|' + (x.e.promoter_id || ''); const y = g.get(k) || { e: x.e, cs: 0, hc: 0, sq: 0, a: 0, r: 0, m: 0 }; if (x.kind === 'case') { y.cs++; y.hc += x.n; } else y.sq += x.n; y.a += x.a; y.r += x.r; y.m += x.m; g.set(k, y); });
  const gv = Array.from(g.values());
  const s3 = { name: '수당 요약', cols: [T('연월'), T('지국'), T('등록'), N('Case 수'), N('등록자 수'), N('개별 판매 건수 (미승인 차감은 −)'), Mn('판매가 합계'), Mn('인정액 합계'), Mn('수당 합계')], rows: gv.map((y) => [y.e.ym, bname(y.e.branch_id), who(y.e), y.cs, y.hc, y.sq, y.a, y.r, y.m]).concat([['합계', '', '', sum(gv, 'cs'), sum(gv, 'hc'), sum(gv, 'sq'), sum(gv, 'a'), sum(gv, 'r'), sum(gv, 'm')]]) };
  const sf = { name: '자율학기제', cols: [T('매출 키'), T('연월'), T('지국'), T('홍보팀장'), N('순번'), T('학교·기관명'), Mn('금액'), Mn('인정액 (100%)'), Mn('수당 (50%)'), T('지급 월급'), T('비고')], rows: lastFree.map((x) => [x.key, x.ym, bname(x.branch_id), pname(x.promoter_id), x.seq, x.school, x.amount, x.recognized, x.commission, addYm(x.ym, 1), x.memo || '']) };
  const fname = '매출리포트_' + bname(V.branch) + (isP ? '_' + pname(V.promoter) : '') + '_' + label + '.xlsx';
  download(fname, XLSX.build([sp, sp2, { name: '신청자별 매출', cols: s0cols, rows: s0rows }, s1, s2, s3].concat(lastFree.length ? [sf] : [])));
  return fname;
};
