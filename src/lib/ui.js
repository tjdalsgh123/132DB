// 화면 공통 도구
const nf = new Intl.NumberFormat('ko-KR');
export const won = (n) => nf.format(Math.round(Number(n) || 0));
export const MSG = '값을 입력해주세요';
export const pad = (m) => String(m).padStart(2, '0');
export const nowYm = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
export const addYm = (ym, n) => { let [y, m] = ym.split('-').map(Number); m += n; while (m > 12) { m -= 12; y += 1; } while (m < 1) { m += 12; y -= 1; } return y + '-' + pad(m); };
export const ymText = (ym) => (ym ? ym.slice(0, 4) + '년 ' + Number(ym.slice(5)) + '월' : '');
export const sum = (l, k) => l.reduce((a, r) => a + (Number(r[k]) || 0), 0);

export const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
export const btn = (text, cls, onClick) => { const b = el('button', 'btn' + (cls ? ' ' + cls : ''), text); b.type = 'button'; if (onClick) b.addEventListener('click', onClick); return b; };
export const field = (label, ctrl, cls) => { const l = el('label', 'field' + (cls ? ' ' + cls : '')); l.append(el('span', 'field-l', label), ctrl); return l; };
export const select = (label, opts, value, empty) => {
  const s = el('select', 'in'); s.setAttribute('aria-label', label);
  fillSelect(s, opts, value, empty); return s;
};
export const fillSelect = (s, opts, value, empty) => {
  s.replaceChildren(); if (empty != null) s.append(new Option(empty, ''));
  opts.forEach((o) => s.append(new Option(o.name, o.id)));
  s.value = opts.some((o) => o.id === value) ? value : (empty != null ? '' : (opts[0] ? opts[0].id : ''));
  return s.value;
};
// 금액 입력 (천 단위 쉼표)
export const moneyInput = (value, onChange, label) => {
  const w = el('span', 'money'); const i = el('input', 'in money-in'); i.type = 'text'; i.inputMode = 'numeric'; i.autocomplete = 'off';
  if (label) i.setAttribute('aria-label', label);
  i.value = value ? won(value) : '';
  i.addEventListener('input', () => { const d = i.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''); i.value = d ? won(Number(d)) : ''; onChange(d ? Number(d) : 0, i); });
  w.append(i, el('span', 'money-u', '원')); w.input = i; return w;
};
export const status = () => { const s = el('span', 'status'); s.set = (t, k) => { s.textContent = t || ''; s.dataset.kind = k || ''; }; return s; };
export const markErr = (t) => { if (!t) return; t.classList.add('invalid'); t.setAttribute('aria-invalid', 'true'); };
export const clearErr = (t) => { if (!t) return; t.classList.remove('invalid'); t.removeAttribute('aria-invalid'); };

// 저장 팝업: 「저장 중입니다.」 → 「저장이 완료되었습니다.」/「저장에 실패했습니다.」 (3초 후 사라짐)
export const busy = (() => {
  let n = 0, failed = null, tDone = null, tHide = null, box = null, card = null;
  const show = (kind, text, sub) => {
    if (!box) { box = el('div', 'busy'); card = el('div', 'busy-card'); card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'assertive'); box.append(card); document.body.append(box); }
    box.dataset.kind = kind; card.replaceChildren(el('span', 'busy-ic', kind === 'ok' ? '✓' : kind === 'bad' ? '!' : ''), el('div', 'busy-t', text));
    if (sub) card.append(el('div', 'busy-s', sub));
    box.hidden = false;
  };
  const run = async (work, label) => {
    n += 1; clearTimeout(tDone); clearTimeout(tHide); show('busy', label || '저장 중입니다.');
    try { return await work(); }
    catch (e) { failed = e || {}; throw e; }
    finally {
      n -= 1;
      if (!n) tDone = setTimeout(() => {
        const f = failed; failed = null;
        show(f ? 'bad' : 'ok', f ? '저장에 실패했습니다.' : '저장이 완료되었습니다.', f ? errText(f) : '');
        tHide = setTimeout(() => { if (box) box.hidden = true; }, 3000);
      }, 200);
    }
  };
  return { run };
})();
// DB 오류 → 사람이 읽을 문구
export const errText = (e) => {
  if (!e) return '';
  const m = String(e.message || e.error_description || e.msg || e || '');
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return '인터넷 연결을 확인해 주세요';
  if (/JWT expired|invalid JWT|not authenticated/i.test(m)) return '로그인이 만료됐습니다 · 다시 로그인해 주세요';
  if (/Invalid login credentials/i.test(m)) return '이메일 또는 비밀번호가 맞지 않습니다';
  if (/violates check constraint|not-null|null value/i.test(m)) return MSG + ' (비어 있거나 잘못된 값이 있습니다)';
  return m.replace(/^ERROR:\s*/, '').slice(0, 200);
};
// 사용 여부 보기: 사용(Y) · 사용 안 함(N) · 전체
export const YN = { y: (x) => x.active !== false, n: (x) => x.active === false, all: () => true };
export const ynFilter = (cur, list, onPick) => {
  const box = el('div', 'chips yn'); box.setAttribute('role', 'tablist'); box.setAttribute('aria-label', '사용 여부로 보기');
  [['y', '사용 (Y)'], ['n', '사용 안 함 (N)'], ['all', '전체']].forEach(([k, t]) => {
    const b = btn(t + ' ' + list.filter(YN[k]).length, 'chip', () => onPick(k)); b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(cur === k)); box.append(b);
  });
  return box;
};
