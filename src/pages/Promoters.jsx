// 홍보팀장 관리 (관리자 · 소속 지국 지국장 · 총국장): 추가 · 이름 변경 · 사용 여부 · 정착수당 시작월 (매출 기록 보호를 위해 삭제 대신 사용 안 함)
import { useRef, useState } from 'react';
import { D, save, branchChoices, isAdmin, chiefName } from '../lib/store.js';
import { MSG, errText, addYm } from '../lib/ui.js';
import { rows as feeRows, calc as calcPromoter, person } from '../lib/pay.js';
import { allocSet, allocAll, allocOf, settleInfo, SETTLE_MONTHS } from '../lib/branchpay.js';
import { useData } from '../hooks/useData.js';
import { Btn, Card, LiveCheck, PageHead, Status, useLive, useStatus, YN, YnFilter } from '../components/ui.jsx';

// 정착수당: 홍보팀장마다 시작 월급월을 넣으면 그 달부터 6개월 「정착수당」 사람별 조건으로 등록 (수당 등록 화면과 같은 데이터)
const thisYm = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };
const settleIt = () => (D.fee_items || []).find((i) => i.id === 'settle') || null;
const settleRows = (pk) => feeRows().filter((r) => r.person_key === pk && r.item_id === 'settle' && r.active !== false && r.mode !== 'exclude').sort((a, b) => (b.valid_from || '').localeCompare(a.valid_from || ''));
const gotMonths = (pk, r) => { const p = person(pk); const out = []; if (!p || !r) return out; const end = r.valid_to || addYm(r.valid_from, SETTLE_MONTHS - 1); const now = thisYm();
  for (let m = r.valid_from; m <= end && m <= now; m = addYm(m, 1)) { const l = calcPromoter(p, m).lines.find((x) => x.it.id === 'settle'); if (l && l.amount > 0) out.push(m); } return out; };
const mm = (m) => Number(m.slice(5)) + '월';
const settleNote = (st, end, max, got) => '정착 ' + st + ' ~ ' + end + ' · ' + (got.length ? '받은 달 ' + got.map(mm).join('·') + ' (' + got.length + '회' + (max ? ' / 최대 ' + max + '회' : '') + ')' : '아직 받은 달 없음' + (max ? ' (최대 ' + max + '회)' : '')) + (thisYm() > end ? ' · 기간 끝남' : '');

export default function Promoters({ general }) {
  useData();
  const [branch0, setBranch] = useState(''); const [yn, setYn] = useState('y'); const [st, setSt] = useStatus(); const [nw, setNw] = useState(''); const [nwBad, setNwBad] = useState(false);
  const busy = useRef(new Set()); // 같은 사람 정착수당 저장이 겹치지 않게
  const bc = branchChoices(); const can = isAdmin() || D.me.scope === 'branch' || (!!general && D.me.scope === 'all');
  const PH = <PageHead eyebrow={general ? '총국장' : '지국장'} title="홍보팀장 관리" lede="지국 소속 홍보팀장을 등록·수정합니다. 로그인 계정 연결과 자율학기제 사용은 관리자가 「권한 관리」에서 정합니다. 매출 기록을 지키기 위해 삭제 대신 「사용 안 함」으로 관리합니다." />;
  if (!bc.length) return <div className="page">{PH}<Card><h2>볼 수 있는 지국이 없습니다</h2><p className="note">관리자에게 소속 지국 지정을 요청하세요.</p></Card></div>;
  const branch = bc.some((b) => b.id === branch0) ? branch0 : bc[0].id;
  const list = D.promoters.filter((p) => p.branch_id === branch).slice().sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')) || (a.sort_order || 0) - (b.sort_order || 0));
  const savePm = async (p, ok) => { try { await save('app_promoter_save', { p_id: p.id, p_branch: p.branch_id, p_name: p.name, p_active: p.active !== false, p_sort: Number(p.sort_order) || 0 }); setSt(ok, 'ok'); return true; } catch (e) { setSt(errText(e), 'bad'); return false; } };
  const add = async () => {
    const v = nw.trim();
    if (!v) { setNwBad(true); setSt(MSG + ' · 새 홍보팀장 이름', 'bad'); return; }
    if (list.some((p) => p.name === v)) { setNwBad(true); setSt('같은 지국에 같은 이름의 홍보팀장이 있습니다', 'bad'); return; }
    if (await savePm({ id: 'pm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), branch_id: branch, name: v, active: true, sort_order: list.length }, v + ' 홍보팀장을 추가했습니다')) setNw('');
  };
  const applySettle = async (p, v) => {
    const pk = 'p:' + p.id; if (busy.current.has(pk)) return; busy.current.add(pk);
    try {
      const olds = settleRows(pk); if (v && olds.length === 1 && olds[0].valid_from === v) return;
      for (const r of olds) await save('app_person_fee_save', { p: { ...r, active: false } });
      if (v) await save('app_person_fee_save', { p: { people: [pk], item_id: 'settle', mode: 'apply', value: null, rate: null, valid_from: v, valid_to: addYm(v, SETTLE_MONTHS - 1), memo: '홍보팀장 관리에서 등록' } });
      setSt(p.name + (v ? ' 정착수당 ' + v + ' ~ ' + addYm(v, SETTLE_MONTHS - 1) + ' 등록 (최대 ' + (Number(settleIt().max_times) || 0) + '회)' : ' 정착수당 해제 (신입 아님)'), 'ok');
    } catch (e) { setSt(errText(e), 'bad'); } finally { busy.current.delete(pk); }
  };
  const applyAcc = async (i, v) => {
    if (busy.current.has('alloc')) return; busy.current.add('alloc');
    try { const all = JSON.parse(JSON.stringify(allocAll())); const a = { ...allocSet(branch) }; const accs = []; for (let k = 0; k < a.promoters; k++) accs.push({ start: ((a.accs || [])[k] || {}).start || '' }); accs[i] = { start: v || '' }; all[branch] = { on: a.on, promoters: a.promoters, chiefs: a.chiefs, cap: a.cap, accs };
      await save('app_setting_save', { p_key: 'branch_alloc', p_value: all }); setSt('홍보팀장 계정 ' + (i + 1) + (v ? ' 정착수당 ' + v + ' ~ ' + addYm(v, SETTLE_MONTHS - 1) : ' 정착수당 없음 (신입 아님)'), 'ok'); }
    catch (e) { setSt(errText(e), 'bad'); } finally { busy.current.delete('alloc'); }
  };
  const nE = D.entries.filter((e) => e.branch_id === branch && !e.promoter_id).length; const cn = chiefName(branch);
  const A = allocSet(branch); const S = settleIt();
  return (
    <div className="page">{PH}
      <Card>
        <div className="card-h"><h2>홍보팀장 목록</h2><YnFilter value={yn} list={list} onPick={setYn} /></div>
        <div className="acts"><div className="acts">
          <select className="in" aria-label="지국" value={branch} disabled={bc.length <= 1} onChange={(e) => setBranch(e.target.value)}>{bc.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
          {can && <><input className={'in' + (nwBad ? ' invalid' : '')} type="text" maxLength={30} placeholder="새 홍보팀장 이름" aria-label="새 홍보팀장 이름" value={nw} onChange={(e) => { setNw(e.target.value); setNwBad(false); }} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} /><Btn kind="primary" onClick={add}>홍보팀장 추가</Btn></>}
        </div></div>
        <p className="note">목록은 등록한 순서(코드 순)로 고정됩니다 · 이름을 고친 뒤 칸을 벗어나면 저장됩니다 · 코드는 신청자 키에 쓰이며 바뀌지 않습니다 · 오른쪽 위에서 사용(Y) / 사용 안 함(N) / 전체로 골라 봅니다</p>
        <Status s={st} />
        <div className="rows">
          <div className="row pm-row direct">
            <div className="pm-left"><span className="pm-num">–</span><span className="badge">코드 00</span></div>
            <div className="pm-mid"><div className="row-n">지국 직할 · {cn || '지국장 미지정'}</div><div className="note">{'지국장 본인 매출 · 「직할 매출 등록」에서 입력 · 매출 ' + nE + '건' + (cn ? '' : ' · 「권한 관리」에서 이 지국 소속 지국장 계정을 만들면 자동 연결됩니다')}</div></div>
            <span className="badge ok">자동 연결</span>
          </div>
          {list.map((p, i) => YN[yn](p) && (
            <div key={p.id} className={'row pm-row' + (p.active === false ? ' off' : '')}>
              <div className="pm-left"><span className="pm-num">{i + 1}</span><span className="badge">코드 {p.code || '자동'}</span></div>
              <div className="pm-mid">
                <PmName p={p} disabled={!can} onSave={(v) => {
                  if (!v) { setSt(MSG + ' · 홍보팀장 이름', 'bad'); return false; }
                  if (list.some((x) => x.id !== p.id && x.name === v)) { setSt('같은 지국에 같은 이름의 홍보팀장이 있습니다', 'bad'); return false; }
                  if (v !== p.name) savePm({ ...p, name: v }, '「' + p.name + '」 → 「' + v + '」 이름을 바꿨습니다'); return true; }} />
                <div className="note">{'매출 ' + D.entries.filter((e) => e.promoter_id === p.id).length + '건 등록 · ' + (p.linked ? '로그인 계정 연결됨' : '로그인 계정 미연결') + (p.free ? ' · 자율학기제 사용' : '')}</div>
                {S && (() => { const pk = 'p:' + p.id; const cur = settleRows(pk)[0] || null;
                  return <SettleField label={p.name + ' 정착수당 시작 월급월'} value={cur ? cur.valid_from : ''} onPick={(v) => applySettle(p, v)}
                    info={cur ? settleNote(cur.valid_from, cur.valid_to || addYm(cur.valid_from, SETTLE_MONTHS - 1), Number(S.max_times) || 0, gotMonths(pk, cur)) : '신입이 아니면 비워 둡니다'} />; })()}
              </div>
              <LiveCheck label="사용" checked={p.active !== false} disabled={!can} onChange={(on) => savePm({ ...p, active: on }, p.name + (on ? ' 다시 사용합니다' : ' 사용 안 함 (등록 목록에서 숨김, 과거 매출 유지 · 「사용 안 함 (N)」에서 다시 볼 수 있습니다)'))} />
            </div>))}
          {!list.length ? <p className="note empty">이 지국에 등록된 홍보팀장이 없습니다 · 위에서 추가하세요</p>
            : !list.some(YN[yn]) && <p className="note empty">{yn === 'n' ? '사용 안 함인 홍보팀장이 없습니다' : '사용 중인 홍보팀장이 없습니다 · 「전체」나 「사용 안 함 (N)」을 눌러 보세요'}</p>}
        </div>
        {A.on && A.promoters > 0 && S && (<>
          <div className="card-h"><h3>월급 계산용 홍보팀장 계정 (계정 할당)</h3></div>
          <p className="note">{'실제로 등록되는 홍보팀장이 아니라 지국장 월급 최적 배분에 쓰는 계정입니다 · 신입으로 볼 계정만 정착수당 시작 월급월을 넣습니다 · 「권한 관리 → 지국」의 계정 할당과 같은 설정' + (isAdmin() ? '' : ' (관리자만 바꿀 수 있습니다)')}</p>
          <div className="rows">{Array.from({ length: A.promoters }, (_, i) => { const cur = ((A.accs || [])[i] || {}).start || ''; const inf = cur ? settleInfo(branch, i, thisYm()) : null;
            return (
              <div key={i} className="row pm-row direct">
                <div className="pm-left"><span className="pm-num">–</span><span className="badge">할당 {i + 1}</span></div>
                <div className="pm-mid"><div className="row-n">홍보팀장 계정 {i + 1}{cur ? ' (신입)' : ''}</div>
                  <SettleField label={'홍보팀장 계정 ' + (i + 1) + ' 정착수당 시작 월급월'} value={cur} onPick={(v) => applyAcc(i, v)}
                    info={inf ? settleNote(inf.st, inf.end, inf.max, inf.got) + ' · 받은 달은 매달 최적 배분 결과로 자동 계산' : cur ? '정착 ' + cur + ' ~ ' + addYm(cur, SETTLE_MONTHS - 1) : '신입이 아니면 비워 둡니다'} /></div>
                <span className="badge">{allocOf(branch) ? '계산용' : '계산 안 함'}</span>
              </div>); })}</div>
        </>)}
      </Card>
    </div>
  );
}

// 이름: 칸을 벗어나면 저장
function PmName({ p, disabled, onSave }) {
  const [v, setV] = useLive(p.name); const [bad, setBad] = useState(false);
  return <input className={'in pm-name' + (bad ? ' invalid' : '')} aria-invalid={bad ? 'true' : undefined} type="text" maxLength={30} disabled={disabled} aria-label={p.name + ' 이름'} value={v}
    onChange={(e) => { setV(e.target.value); setBad(false); }} onBlur={() => { const t = v.trim(); if (t === p.name) return; if (onSave(t) === false) setBad(true); }} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />;
}
// 정착수당 시작 월급월 (관리자만 바꿈)
function SettleField({ label, value, onPick, info }) {
  const [v, setV] = useLive(value);
  return (
    <div className="pm-settle"><span className="note pm-settle-l">정착수당 시작</span>
      <input className="in" type="month" aria-label={label} value={v} disabled={!isAdmin()} onChange={(e) => { setV(e.target.value); e.target.blur(); onPick(e.target.value); }} />
      {isAdmin() && <Btn kind="sm" disabled={!value} onClick={() => { setV(''); onPick(''); }}>비움</Btn>}
      <span className="note">{info}</span>
    </div>
  );
}
