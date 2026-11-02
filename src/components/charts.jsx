// 그래프·요약 칸 (React) · 모양은 기존 화면과 같음 (외부 라이브러리 없음)
import { useEffect, useRef, useState } from 'react';
import { won } from '../lib/ui.js';
import { COLORS } from '../lib/chart.js';

export { COLORS };
const kr = (n) => { const a = Math.abs(n); if (a >= 1e8) return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억'; if (a >= 1e4) return won(Math.round(n / 1e4)) + '만'; return won(n); };
const niceMax = (v) => { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p; };

// 월별 세로 막대 (여러 계열은 쌓아서) · 막대를 누르면 onPick(m)
export function Bars({ data, series, selected, onPick, unit = '원' }) {
  const box = useRef(null); const [W, setW] = useState(640);
  useEffect(() => { const el = box.current; if (!el) return undefined; const f = () => setW(Math.max(320, el.clientWidth || 640)); f(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(f) : null; ro && ro.observe(el); return () => ro && ro.disconnect(); }, []);
  const H = 240, ml = 56, mb = 28, mt = 12, mr = 8;
  const tot = (d) => series.reduce((a, s) => a + (d[s.key] || 0), 0);
  const max = niceMax(Math.max(...data.map(tot), 0));
  const y = (v) => mt + (H - mt - mb) * (1 - v / max);
  const step = (W - ml - mr) / data.length; const bw = Math.min(34, step * 0.62);
  return (
    <div className="chart" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="월별 막대 그래프">
        {[0, 1, 2, 3, 4].map((i) => { const v = (max / 4) * i; const yy = y(v); return <g key={i}><line x1={ml} x2={W - mr} y1={yy} y2={yy} stroke="currentColor" strokeOpacity={i ? 0.1 : 0.35} /><text x={ml - 8} y={yy + 4} textAnchor="end" fontSize={12} fill="currentColor" fillOpacity={0.7}>{kr(v)}</text></g>; })}
        {data.map((d, i) => {
          const x = ml + step * i + (step - bw) / 2; let acc = 0;
          return (
            <g key={d.m} style={onPick ? { cursor: 'pointer' } : undefined} onClick={onPick ? () => onPick(d.m) : undefined}>
              {selected === d.m && <rect x={ml + step * i + 2} y={mt} width={step - 4} height={H - mt - mb} fill="currentColor" fillOpacity={0.06} rx={4} />}
              {series.map((s, si) => { const v = d[s.key] || 0; if (!v) return null; const y1 = y(acc + v), y0 = y(acc); acc += v; return <rect key={s.key} x={x} y={y1} width={bw} height={Math.max(1, y0 - y1)} fill={s.color || COLORS[si % COLORS.length]} rx={2} />; })}
              <title>{Number(d.m) + '월 · ' + series.map((s) => s.label + ' ' + won(d[s.key] || 0) + unit).join(' · ')}</title>
              <text x={ml + step * i + step / 2} y={H - 8} textAnchor="middle" fontSize={12} fill="currentColor" fontWeight={selected === d.m ? 700 : 400}>{Number(d.m) + '월'}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
export const Legend = ({ items }) => <div className="legend">{items.map(([c, n]) => <span key={n} className="legend-i"><i style={{ background: c }} />{n}</span>)}</div>;
// 가로 비율 막대 목록: [{label, value, sub, color}]
export function Rank({ list, total, fmt = (v) => won(v) + '원' }) {
  const mx = Math.max(...list.map((x) => x.value), 1);
  return (
    <div className="rank">{list.map((x, i) => (
      <div key={x.key || x.label + i} className={'rank-r' + (x.value ? '' : ' zero')}>
        <span className="rank-n">{x.value ? String(i + 1) : '–'}</span>
        <div className="rank-m"><div className="rank-line"><span className="rank-l">{x.label}</span><span className="rank-v">{x.value ? fmt(x.value) : '미등록'}</span></div>
          <div className="rank-bar"><span style={{ width: (x.value / mx * 100).toFixed(1) + '%', background: x.color || undefined }} /></div>{x.sub && <div className="note">{x.sub}</div>}</div>
        <span className="rank-p">{total && x.value ? Math.round(x.value / total * 1000) / 10 + '%' : ''}</span>
      </div>))}
    </div>
  );
}
export const Stat = ({ k, v, u, sub }) => (<div className="stat"><div className="stat-k">{k}</div><div className="stat-v"><span>{v}</span><span className="stat-u">{u || ''}</span></div>{sub ? (typeof sub === 'string' ? <div className="note">{sub}</div> : sub) : null}</div>);
export const Delta = ({ cur, prev }) => { if (!prev) return null; const d = (cur - prev) / prev; return <div className={'delta ' + (d >= 0 ? 'up' : 'down')}>{(d >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d * 1000) / 10) + '% 전월 대비'}</div>; };
// 월 선택 칩: 연간 + 1~12월
export const MonthChips = ({ sel, has, onPick }) => (
  <div className="chips" role="tablist" aria-label="기간 선택">
    {[['year', '연간']].concat(Array.from({ length: 12 }, (_, i) => [String(i + 1).padStart(2, '0'), (i + 1) + '월'])).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={sel === v} className={'chip' + (has(v) ? ' has' : '')} onClick={() => onPick(v)}>{l}</button>)}
  </div>
);
