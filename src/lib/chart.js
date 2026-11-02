// 간단한 SVG 차트 (외부 라이브러리 없음)
import { el, won } from './ui.js';

export const COLORS = ['#256ef4', '#e07b20', '#1a9f6a', '#8a63d2'];
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v)); if (text != null) e.textContent = text; return e; };
const kr = (n) => { const a = Math.abs(n); if (a >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억'; if (a >= 1e4) return won(Math.round(n / 1e4)) + '만'; return won(n); };
const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

// 월별 세로 막대 (여러 계열은 쌓아서) · 막대를 누르면 onPick(m)
export const bars = (box, data, series, selected, onPick, unit = '원') => {
  box.replaceChildren();
  const W = Math.max(320, box.clientWidth || 640), H = 240, ml = 56, mb = 28, mt = 12, mr = 8;
  const tot = (d) => series.reduce((a, s) => a + (d[s.key] || 0), 0);
  const max = niceMax(Math.max(...data.map(tot), 0));
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': '월별 막대 그래프' });
  const y = (v) => mt + (H - mt - mb) * (1 - v / max);
  for (let i = 0; i <= 4; i++) {
    const v = (max / 4) * i; const yy = y(v);
    svg.append(svgEl('line', { x1: ml, x2: W - mr, y1: yy, y2: yy, stroke: 'currentColor', 'stroke-opacity': i ? 0.1 : 0.35 }));
    svg.append(svgEl('text', { x: ml - 8, y: yy + 4, 'text-anchor': 'end', 'font-size': 12, fill: 'currentColor', 'fill-opacity': 0.7 }, kr(v)));
  }
  const step = (W - ml - mr) / data.length; const bw = Math.min(34, step * 0.62);
  data.forEach((d, i) => {
    const x = ml + step * i + (step - bw) / 2; let acc = 0;
    const g = svgEl('g', { style: onPick ? 'cursor:pointer' : '' });
    if (selected === d.m) g.append(svgEl('rect', { x: ml + step * i + 2, y: mt, width: step - 4, height: H - mt - mb, fill: 'currentColor', 'fill-opacity': 0.06, rx: 4 }));
    series.forEach((s, si) => {
      const v = d[s.key] || 0; if (!v) return;
      const y1 = y(acc + v), y0 = y(acc); acc += v;
      g.append(svgEl('rect', { x, y: y1, width: bw, height: Math.max(1, y0 - y1), fill: s.color || COLORS[si % COLORS.length], rx: 2 }));
    });
    g.append(svgEl('title', {}, Number(d.m) + '월 · ' + series.map((s) => s.label + ' ' + won(d[s.key] || 0) + unit).join(' · ')));
    g.append(svgEl('text', { x: ml + step * i + step / 2, y: H - 8, 'text-anchor': 'middle', 'font-size': 12, fill: 'currentColor', 'font-weight': selected === d.m ? 700 : 400 }, Number(d.m) + '월'));
    if (onPick) { g.addEventListener('click', () => onPick(d.m)); }
    svg.append(g);
  });
  box.append(svg);
};
// 범례
export const legend = (items) => { const l = el('div', 'legend'); items.forEach(([c, n]) => { const i = el('span', 'legend-i'); const sw = el('i'); sw.style.background = c; i.append(sw, document.createTextNode(n)); l.append(i); }); return l; };
// 가로 비율 막대 목록: [{label, value, sub, color}]
export const rank = (list, total, fmt = (v) => won(v) + '원') => {
  const box = el('div', 'rank'); const mx = Math.max(...list.map((x) => x.value), 1);
  list.forEach((x, i) => {
    const r = el('div', 'rank-r' + (x.value ? '' : ' zero'));
    r.append(el('span', 'rank-n', x.value ? String(i + 1) : '–'));
    const mid = el('div', 'rank-m'); const line = el('div', 'rank-line');
    line.append(el('span', 'rank-l', x.label), el('span', 'rank-v', x.value ? fmt(x.value) : '미등록'));
    const bar = el('div', 'rank-bar'); const f = el('span'); f.style.width = (x.value / mx * 100).toFixed(1) + '%'; if (x.color) f.style.background = x.color; bar.append(f);
    mid.append(line, bar); if (x.sub) mid.append(el('div', 'note', x.sub));
    r.append(mid, el('span', 'rank-p', total && x.value ? Math.round(x.value / total * 1000) / 10 + '%' : ''));
    box.append(r);
  });
  return box;
};
// 요약 숫자 칸
export const stat = (k, v, u, sub) => { const d = el('div', 'stat'); const b = el('div', 'stat-v'); b.append(el('span', null, v), el('span', 'stat-u', u || '')); d.append(el('div', 'stat-k', k), b); if (sub) d.append(typeof sub === 'string' ? el('div', 'note', sub) : sub); return d; };
export const delta = (cur, prev) => { if (!prev) return null; const d = (cur - prev) / prev; return el('div', 'delta ' + (d >= 0 ? 'up' : 'down'), (d >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d * 1000) / 10) + '% 전월 대비'); };
// 월 선택 칩: 연간 + 1~12월
export const monthChips = (sel, has, onPick) => {
  const box = el('div', 'chips'); box.setAttribute('role', 'tablist'); box.setAttribute('aria-label', '기간 선택');
  const mk = (v, label) => { const b = el('button', 'chip' + (has(v) ? ' has' : ''), label); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(sel === v)); b.addEventListener('click', () => onPick(v)); return b; };
  box.append(mk('year', '연간'));
  for (let m = 1; m <= 12; m++) box.append(mk(String(m).padStart(2, '0'), m + '월'));
  return box;
};
