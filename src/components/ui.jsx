// React 공통 부품 (기존 KRDS 스타일 클래스 그대로 사용)
import { useState, useCallback, useEffect } from 'react';
import { APP_NAME, COMPANY, LOGO, LOGO_DARK } from '../lib/config.js';
import { won } from '../lib/ui.js';

// 로고: 밝은 화면 = 컬러 · 다크 모드 = 흰색 (기기·브라우저 설정 자동)
export const Logo = ({ className = 'brand-logo' }) => (
  <picture><source srcSet={LOGO_DARK} media="(prefers-color-scheme: dark)" /><img className={className} src={LOGO} alt={COMPANY} decoding="async" /></picture>
);
export const Brand = ({ large, href }) => {
  const inner = (<><Logo /><span className="brand-t">{APP_NAME}</span></>);
  return large ? <div className="brand-lg">{inner}</div> : <a className="brand" href={href || '#/'} aria-label={COMPANY + ' ' + APP_NAME + ' 첫 화면'}>{inner}</a>;
};
// 상태 문구: [text, kind('ok'|'bad'|'warn'|'')]
export const useStatus = () => { const [s, setS] = useState(['', '']); const set = useCallback((t, k) => setS([t || '', k || '']), []); return [s, set]; };
export const Status = ({ s }) => <span className="status" data-kind={s[1] || ''}>{s[0]}</span>;
export const Field = ({ label, children, className }) => (<label className={'field' + (className ? ' ' + className : '')}><span className="field-l">{label}</span>{children}</label>);
export const Btn = ({ kind = '', className = '', children, ...p }) => <button type="button" className={['btn', kind, className].filter(Boolean).join(' ')} {...p}>{children}</button>;
export const Card = ({ className = '', children, ...p }) => <section className={'card' + (className ? ' ' + className : '')} {...p}>{children}</section>;
export const PageHead = ({ eyebrow, title, lede, children }) => (<header className="page-h">{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{lede && <p className="lede">{lede}</p>}{children}</header>);
// 탭 (KRDS seg)
export const Tabs = ({ items, value, onPick, hidden }) => (
  <div className="seg" role="tablist" hidden={hidden}>{items.map(([k, t]) => <button key={k} type="button" className="btn" role="tab" aria-selected={value === k} onClick={() => onPick(k)}>{t}</button>)}</div>
);
// 사용 여부 칩: 사용(Y) · 사용 안 함(N) · 전체
export const YN = { y: (x) => x.active !== false, n: (x) => x.active === false, all: () => true };
export const YnFilter = ({ value, list, onPick }) => (
  <div className="chips yn" role="tablist" aria-label="사용 여부로 보기">
    {[['y', '사용 (Y)'], ['n', '사용 안 함 (N)'], ['all', '전체']].map(([k, t]) => <button key={k} type="button" className="btn chip" role="tab" aria-selected={value === k} onClick={() => onPick(k)}>{t + ' ' + list.filter(YN[k]).length}</button>)}
  </div>
);
// 두 번 눌러 확인하는 버튼 (삭제 등)
export const ConfirmBtn = ({ children, confirmText = '한 번 더 눌러 삭제', onFirst, onConfirm, kind = '', ...p }) => {
  const [armed, setArmed] = useState(false);
  return <Btn kind={kind} {...p} onClick={() => { if (!armed) { setArmed(true); onFirst && onFirst(); return; } setArmed(false); onConfirm(); }}>{armed ? confirmText : children}</Btn>;
};
// 저장 전에 바로 바뀌어 보이는 체크박스·선택 (저장 후 데이터가 오면 그 값으로 맞춤)
export const useLive = (v) => { const [x, setX] = useState(v); useEffect(() => { setX(v); }, [v]); return [x, setX]; };
export const LiveCheck = ({ checked, onChange, label, ...p }) => {
  const [v, setV] = useLive(!!checked);
  return <label className="check"><input type="checkbox" checked={v} onChange={(e) => { setV(e.target.checked); onChange(e.target.checked); }} {...p} /> {label}</label>;
};
export const LiveSelect = ({ value, onChange, options, className = 'in', ...p }) => {
  const [v, setV] = useLive(value);
  return <select className={className} value={v} onChange={(e) => { setV(e.target.value); onChange(e.target.value); }} {...p}>{options.map(([k, t]) => <option key={k} value={k}>{t}</option>)}</select>;
};
// 금액 입력 (천 단위 쉼표) · value = 숫자
export const MoneyInput = ({ value, onChange, label, invalid, className = '' }) => (
  <span className="money"><input className={'in money-in' + (invalid ? ' invalid' : '') + (className ? ' ' + className : '')} aria-invalid={invalid ? 'true' : undefined} type="text" inputMode="numeric" autoComplete="off" aria-label={label}
    value={value ? won(value) : ''} onChange={(e) => { const d = e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''); onChange(d ? Number(d) : 0); }} /><span className="money-u">원</span></span>
);
