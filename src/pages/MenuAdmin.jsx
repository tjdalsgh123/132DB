// 관리자 · 메뉴 관리: 대메뉴/중메뉴 순서 · 위치(어느 대메뉴 아래) · 이름 · 숨김 · 대메뉴 추가/삭제 (모든 사람에게 적용)
// 상단 메뉴를 마우스로 끌어서 순서를 바꿀 수도 있음 · 누가 어떤 화면을 보는지는 「권한 관리 → 역할」
import { useState } from 'react';
import { D, save } from '../lib/store.js';
import { MSG, errText } from '../lib/ui.js';
import { LOCKED, ALWAYS, layout, defaultLabel, DEFAULT_NAV } from '../lib/nav.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, ConfirmBtn, LiveCheck, PageHead, Status, useStatus, useLive } from '../components/ui.jsx';

export default function MenuAdmin() {
  useData();
  const [st, setSt] = useStatus(); const [gname, setGname] = useState(''); const [gbad, setGbad] = useState(false);
  const l = layout(); const N = l.nav; const groups = N.filter((e) => e.type === 'group');
  const clone = () => JSON.parse(JSON.stringify(N));
  const put = async (patch, ok) => { const v = { nav: l.nav, labels: l.labels, hidden: l.hidden, ...patch }; try { await save('app_setting_save', { p_key: 'layout', p_value: v }); setSt(ok + ' · 다른 사람은 다음 갱신(최대 5분) 때 바뀝니다', 'ok'); } catch (e) { setSt(errText(e), 'bad'); } };
  const lbl = (id) => l.labels[id] || defaultLabel(id);
  const rolesWith = (id) => (ALWAYS.includes(id) ? ['모든 사람'] : D.roles.filter((r) => Array.isArray(r.menus) && (r.menus.includes('admin') || r.menus.includes(id))).map((r) => r.name));
  const allNames = (except) => { const n = []; N.forEach((e) => { if (e.type === 'group') { if ('g:' + e.id !== except) n.push(e.name); e.items.forEach((id) => { if ('p:' + id !== except) n.push(lbl(id)); }); } else if ('p:' + e.id !== except) n.push(lbl(e.id)); }); return n; };
  const addGroup = () => {
    const v = gname.trim(); if (!v) { setGbad(true); setSt(MSG + ' · 대메뉴 이름', 'bad'); return; }
    if (allNames('').includes(v)) { setGbad(true); setSt('같은 이름의 메뉴가 이미 있습니다', 'bad'); return; }
    setGname(''); put({ nav: clone().concat([{ type: 'group', id: 'g_' + Date.now().toString(36), name: v, items: [] }]) }, v + ' 대메뉴를 추가했습니다 · 화면의 「위치」에서 이 대메뉴를 고르면 들어갑니다');
  };
  const pageRow = ({ id, idx, count, parent }) => { // 함수로 호출 (다시 그려도 입력 칸 유지)
    const off = l.hidden.includes(id);
    const swap = (dlt) => { const n = clone(); const arr = parent ? n.find((x) => x.type === 'group' && x.id === parent.id).items : n; [arr[idx + dlt], arr[idx]] = [arr[idx], arr[idx + dlt]]; put({ nav: n }, lbl(id) + (dlt < 0 ? ' 위로' : ' 아래로') + ' 옮겼습니다'); };
    const move = (to) => {
      const n = clone().map((x) => (x.type === 'group' ? { ...x, items: x.items.filter((p) => p !== id) } : x)).filter((x) => !(x.type === 'page' && x.id === id));
      if (to) n.find((x) => x.type === 'group' && x.id === to).items.push(id); else n.push({ type: 'page', id });
      put({ nav: n }, lbl(id) + ' → ' + (to ? groups.find((g) => g.id === to).name + ' 아래로' : '단독 대메뉴로') + ' 옮겼습니다');
    };
    return (
      <div key={id} className={'mm-row' + (parent ? ' mm-child' : ' mm-top') + (off ? ' off' : '')}>
        <MoveBtns name={lbl(id)} canUp={idx > 0} canDn={idx < count - 1} onUp={() => swap(-1)} onDn={() => swap(1)} />
        <div className="mm-mid">
          <NameInput value={lbl(id)} label="메뉴 이름" onBad={(m) => setSt(m, 'bad')} onSave={(v) => {
            if (allNames('p:' + id).includes(v)) { setSt('같은 이름의 메뉴가 이미 있습니다', 'bad'); return false; }
            if (v === lbl(id)) return true; const labels = { ...l.labels }; if (v === defaultLabel(id)) delete labels[id]; else labels[id] = v;
            put({ labels }, '메뉴 이름을 「' + v + '」(으)로 바꿨습니다'); return true; }} />
          <div className="note">{(lbl(id) !== defaultLabel(id) ? '기본 이름: ' + defaultLabel(id) + ' · ' : '') + '볼 수 있는 역할: ' + (rolesWith(id).join(', ') || '없음')}</div>
        </div>
        <LocSelect id={id} parent={parent} groups={groups} label={lbl(id) + ' 위치'} onPick={move} />
        <LiveCheck checked={!off} disabled={LOCKED.includes(id)} label={LOCKED.includes(id) ? '항상 보임' : '보이기'}
          onChange={(on) => put({ hidden: on ? l.hidden.filter((x) => x !== id) : l.hidden.concat(id) }, lbl(id) + (on ? ' 다시 보입니다' : ' 숨겼습니다 (모든 사람에게 안 보임)'))} />
      </div>
    );
  };
  return (
    <div className="page">
      <PageHead eyebrow="관리자" title="메뉴 관리" lede="상단 대메뉴와 그 아래 중메뉴의 순서·위치·이름을 바꾸거나 잠시 숨깁니다. 모든 사람에게 똑같이 적용됩니다. PC에서는 상단 메뉴를 마우스로 끌어서 순서를 바꿀 수도 있습니다. 누가 어떤 화면을 보는지는 「권한 관리 → 역할」에서 정합니다." />
      <Card>
        <div className="card-h"><h2>메뉴 구조</h2>
          <div className="acts">
            <input className={'in' + (gbad ? ' invalid' : '')} type="text" maxLength={20} placeholder="새 대메뉴 이름" aria-label="새 대메뉴 이름" value={gname} onChange={(e) => { setGname(e.target.value); setGbad(false); }} />
            <Btn kind="primary" onClick={addGroup}>대메뉴 추가</Btn>
            <ConfirmBtn confirmText="한 번 더 눌러 기본값으로" onFirst={() => setSt('메뉴 순서·위치·이름·숨김을 모두 처음 상태로 되돌리려면 한 번 더 누르세요', 'warn')} onConfirm={() => put({ nav: DEFAULT_NAV, labels: {}, hidden: [] }, '메뉴를 기본값으로 되돌렸습니다')}>기본값으로</ConfirmBtn>
          </div></div>
        <p className="note">▲▼ 순서 · 「위치」로 다른 대메뉴 아래로 옮기기 · 이름은 고친 뒤 칸을 벗어나면 저장 · 「권한 관리」「메뉴 관리」는 잠김 방지를 위해 숨길 수 없습니다</p>
        <Status s={st} />
        <div className="mm-tree">
          {N.map((e, i) => {
            if (e.type === 'page') return pageRow({ id: e.id, idx: i, count: N.length, parent: null });
            return (
              <div className="mm-group" key={'g' + e.id}>
                <div className="mm-row mm-ghead">
                  <MoveBtns name={e.name} canUp={i > 0} canDn={i < N.length - 1} onUp={() => { const n = clone(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; put({ nav: n }, e.name + ' 위로 옮겼습니다'); }} onDn={() => { const n = clone(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; put({ nav: n }, e.name + ' 아래로 옮겼습니다'); }} />
                  <span className="badge">대메뉴</span>
                  <div className="mm-mid">
                    <NameInput value={e.name} label="대메뉴 이름" onBad={(m) => setSt(m, 'bad')} onSave={(v) => {
                      if (allNames('g:' + e.id).includes(v)) { setSt('같은 이름의 메뉴가 이미 있습니다', 'bad'); return false; }
                      if (v === e.name) return true; const n = clone(); n.find((x) => x.type === 'group' && x.id === e.id).name = v; put({ nav: n }, '대메뉴 이름을 「' + v + '」(으)로 바꿨습니다'); return true; }} />
                    <div className="note">{'대메뉴 · 중메뉴 ' + e.items.length + '개' + (e.items.length ? '' : ' (중메뉴가 없으면 상단에 보이지 않습니다)')}</div>
                  </div>
                  <Btn kind="sm" disabled={e.items.length > 0} title={e.items.length ? '중메뉴를 다른 곳으로 옮긴 뒤 삭제할 수 있습니다' : undefined} onClick={() => put({ nav: clone().filter((x) => !(x.type === 'group' && x.id === e.id)) }, e.name + ' 대메뉴를 삭제했습니다')}>대메뉴 삭제</Btn>
                </div>
                {e.items.map((id, j) => pageRow({ id, idx: j, count: e.items.length, parent: e }))}
                {!e.items.length && <p className="note mm-empty">중메뉴가 없습니다 · 화면의 「위치」에서 이 대메뉴를 고르면 들어옵니다</p>}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

const MoveBtns = ({ name, canUp, canDn, onUp, onDn }) => (
  <span className="mm-mv"><Btn kind="sm icon" disabled={!canUp} aria-label={name + ' 위로'} onClick={onUp}>▲</Btn><Btn kind="sm icon" disabled={!canDn} aria-label={name + ' 아래로'} onClick={onDn}>▼</Btn></span>
);
// 이름: 칸을 벗어나면 저장 (onSave 가 false 면 잘못된 값)
function NameInput({ value, label, onSave, onBad }) {
  const [v, setV] = useLive(value); const [bad, setBad] = useState(false);
  return <input className={'in mm-name' + (bad ? ' invalid' : '')} aria-invalid={bad ? 'true' : undefined} type="text" maxLength={20} aria-label={label} value={v}
    onChange={(e) => { setV(e.target.value); setBad(false); }}
    onBlur={() => { const t = v.trim(); if (t === value) return; if (!t) { setBad(true); onBad(MSG + ' · ' + label); return; } if (onSave(t) === false) setBad(true); }}
    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}
function LocSelect({ id, parent, groups, label, onPick }) {
  const [v, setV] = useLive(parent ? parent.id : '');
  return <select className="in mm-loc" aria-label={label} value={v} onChange={(e) => { setV(e.target.value); onPick(e.target.value); }}><option value="">대메뉴로 (단독)</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name} 아래</option>)}</select>;
}
