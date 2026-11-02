// 게시판 관리 (관리자): 만들기 · 이름 · 종류 · 글쓰기 권한 · 순서 · 사용 · 삭제
import { useState } from 'react';
import { D, rpc, save } from '../lib/store.js';
import { errText, MSG } from '../lib/ui.js';
import { boardHref } from '../lib/board.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, ConfirmBtn, LiveCheck, LiveSelect, PageHead, Status, useStatus } from '../components/ui.jsx';

const KIND = [['notice', '공지 (필독·화면 표출 사용)'], ['board', '일반 게시판']];

export default function BoardAdmin() {
  useData();
  const [st, setSt] = useStatus(); const [nm, setNm] = useState(''); const [kd, setKd] = useState('board'); const [bad, setBad] = useState(false);
  const list = (D.boards || []).slice();
  const roles = (D.roles || []).filter((r) => !(r.menus || []).includes('admin'));
  const payload = (b, patch) => ({ id: b.id, name: b.name, kind: b.kind, write_roles: b.write_roles || [], sort_order: b.sort_order, active: b.active !== false, memo: b.memo || '', ...patch });
  const saveB = (b, patch, ok) => save('app_board_save', { p: payload(b, patch) }).then(() => setSt(ok, 'ok')).catch((e) => setSt(errText(e), 'bad'));
  const add = async () => {
    const v = nm.trim(); if (!v) { setBad(true); setSt(MSG + ' · 게시판 이름', 'bad'); return; }
    if (list.some((b) => b.name === v)) { setBad(true); setSt('같은 이름의 게시판이 이미 있습니다', 'bad'); return; }
    try { await save('app_board_save', { p: { name: v, kind: kd, write_roles: [], active: true } }); setNm(''); setSt('「' + v + '」 게시판을 만들었습니다 · 글쓰기 권한을 정해 주세요', 'ok'); } catch (e) { setSt(errText(e), 'bad'); }
  };
  const move = async (i, d) => {
    const order = list.slice(); [order[i], order[i + d]] = [order[i + d], order[i]];
    try { for (let k = 0; k < order.length; k++) if (order[k].sort_order !== k) await rpc('app_board_save', { p: payload(order[k], { sort_order: k }) }); await save('app_hash'); setSt('순서를 바꿨습니다', 'ok'); } catch (e) { setSt(errText(e), 'bad'); }
  };
  return (
    <div className="page">
      <PageHead eyebrow="관리자" title="게시판 관리" lede="게시판을 만들고 이름·종류·글쓰기 권한·순서를 정합니다. 읽기는 로그인한 모든 사람이 할 수 있습니다. 관리자는 모든 게시판에 글을 쓸 수 있습니다." />
      <Card>
        <div className="card-h"><h2>게시판 ({list.length})</h2></div>
        <div className="acts">
          <input className={'in' + (bad ? ' invalid' : '')} type="text" maxLength={40} placeholder="새 게시판 이름" aria-label="새 게시판 이름" value={nm} onChange={(e) => { setNm(e.target.value); setBad(false); }} />
          <select className="in" aria-label="새 게시판 종류" value={kd} onChange={(e) => setKd(e.target.value)}>{KIND.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          <Btn kind="primary" onClick={add}>게시판 만들기</Btn>
        </div>
        <p className="note">이름을 고친 뒤 칸을 벗어나면 저장됩니다 · 글쓰기 권한에 체크한 역할만 글을 쓸 수 있습니다 (체크가 없으면 관리자만) · 삭제하면 그 게시판의 글도 모두 지워집니다</p>
        <Status s={st} />
        <div className="rows">
          {list.map((b, i) => {
            const n = (D.posts || []).filter((p) => p.board_id === b.id).length;
            return (
              <div key={b.id} className={'row pm-row' + (b.active === false ? ' off' : '')}>
                <div className="pm-left"><span className="pm-num">{i + 1}</span>
                  <Btn kind="icon" aria-label={b.name + ' 위로'} disabled={i === 0} onClick={() => move(i, -1)}>▲</Btn>
                  <Btn kind="icon" aria-label={b.name + ' 아래로'} disabled={i === list.length - 1} onClick={() => move(i, 1)}>▼</Btn></div>
                <div className="pm-mid">
                  <div className="acts">
                    <NameInput b={b} onSave={(v) => saveB(b, { name: v }, '「' + b.name + '」 → 「' + v + '」 이름을 바꿨습니다')} onBad={() => setSt(MSG + ' · 게시판 이름', 'bad')} />
                    <LiveSelect className="in bd-kind" aria-label={b.name + ' 종류'} value={b.kind} options={KIND} onChange={(v) => saveB(b, { kind: v }, b.name + ' 종류: ' + (v === 'notice' ? '공지' : '일반 게시판'))} />
                  </div>
                  <div className="bd-roles"><span className="note">글쓰기 권한: 관리자</span>
                    {roles.map((r) => <LiveCheck key={r.id} label={r.name} checked={(b.write_roles || []).includes(r.id)} onChange={(on) => { const s = new Set(b.write_roles || []); on ? s.add(r.id) : s.delete(r.id); saveB(b, { write_roles: [...s] }, b.name + ' 글쓰기 권한: 관리자' + roles.filter((x) => s.has(x.id)).map((x) => ', ' + x.name).join('')); }} />)}
                  </div>
                  <div className="note">{'글 ' + n + '건 · ' + (b.kind === 'notice' ? '필독·화면 표출을 쓸 수 있는 공지 게시판' : '일반 게시판') + (b.updated_by ? ' · 마지막 수정 ' + b.updated_by : '')}</div>
                </div>
                <div className="acts">
                  <LiveCheck label="사용" checked={b.active !== false} onChange={(on) => saveB(b, { active: on }, b.name + (on ? ' 다시 사용합니다' : ' 사용 안 함 (메뉴에서 숨김 · 글은 보관)'))} />
                  <a className="btn sm" href={boardHref(b.id)}>열기</a>
                  <ConfirmBtn kind="sm danger" onFirst={() => setSt('「' + b.name + '」을(를) 삭제하면 글 ' + n + '건도 함께 지워지고 되돌릴 수 없습니다 · 숨기기만 하려면 「사용」을 끄세요', 'warn')}
                    onConfirm={async () => { try { await save('app_board_delete', { p_id: b.id }); setSt('「' + b.name + '」 게시판을 삭제했습니다', 'ok'); } catch (e) { setSt(errText(e), 'bad'); } }}>삭제</ConfirmBtn>
                </div>
              </div>
            );
          })}
          {!list.length && <p className="note empty">게시판이 없습니다 · 위에서 만드세요</p>}
        </div>
      </Card>
    </div>
  );
}

// 이름: 칸을 벗어나면 저장
function NameInput({ b, onSave, onBad }) {
  const [v, setV] = useState(b.name); const [bad, setBad] = useState(false);
  return <input className={'in' + (bad ? ' invalid' : '')} type="text" maxLength={40} aria-label={b.name + ' 이름'} value={v} onChange={(e) => { setV(e.target.value); setBad(false); }}
    onBlur={() => { const t = v.trim(); if (!t) { setBad(true); onBad(); return; } if (t !== b.name) onSave(t); }} />;
}
