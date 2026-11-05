// 지국장·총국장 직급·등급 (등급별 국장수당 금액을 정함) · settings.grades = { 'b:지국ID' | 'g:지국ID': [{ from: 월급월, rank, grade }] }
// 수수료지급명세서의 등급을 월급월부터 적용 · 지난 기록은 그대로 두고 새 월부터 바뀜
import { useState } from 'react';
import { D, save, chiefName } from '../lib/store.js';
import { nowYm, errText } from '../lib/ui.js';
import { GRADES, GRADE_DEFAULT, RANKS, gradeHist, gradeOf, gradeName, generalPerson } from '../lib/branchpay.js';
import { Btn, Status, useStatus } from '../components/ui.jsx';

export default function Grades({ kind = 'branch' }) {
  const G = kind === 'general'; const ranks = RANKS(kind);
  const [st, setSt] = useStatus(); const [ym, setYm] = useState(nowYm());
  const people = G ? [generalPerson()].filter(Boolean).map((p) => ({ key: p.key, name: p.name, general: true }))
    : D.branches.filter((b) => b.active !== false).map((b) => ({ key: 'b:' + b.id, name: b.name + ' 지국장' + (chiefName(b.id) ? ' (' + chiefName(b.id) + ')' : '') }));
  const put = async (key, list, ok) => {
    const all = JSON.parse(JSON.stringify((D.settings && D.settings.grades) || {})); if (list.length) all[key] = list; else delete all[key];
    try { await save('app_setting_save', { p_key: 'grades', p_value: all }); setSt(ok, 'ok'); } catch (e) { setSt(errText(e), 'bad'); }
  };
  return (
    <section className="card">
      <div className="card-h"><h2>{(G ? '총국장' : '지국장') + ' 직급·등급'}</h2>
        <label className="field inline"><span className="field-l">기준 월급월</span><input className="in" type="month" aria-label="기준 월급월" value={ym} onChange={(e) => e.target.value && setYm(e.target.value)} /></label></div>
      <p className="note">{'국장수당(등급별) 금액 = 직급 × 등급 표 금액 · 수수료지급명세서의 등급을 「적용 월급월」부터 넣으세요 · 바꾸면 그 월급월부터 적용되고 이전 달은 그대로입니다 · 정하지 않으면 ' + ranks[0] + ' · ' + gradeName(GRADE_DEFAULT)}</p>
      <Status s={st} />
      {!people.length && <p className="note empty">{G ? '총국장 직할 지국을 먼저 정해 주세요' : '사용 중인 지국이 없습니다'}</p>}
      <div className="rows">{people.map((p) => <Row key={p.key} p={p} ym={ym} ranks={ranks} put={put} />)}</div>
    </section>
  );
}

function Row({ p, ym, ranks, put }) {
  const h = gradeHist(p.key); const cur = gradeOf(p, ym);
  const [from, setFrom] = useState(ym); const [rank, setRank] = useState(cur.rank); const [grade, setGrade] = useState(cur.grade);
  const apply = () => { const list = h.filter((x) => x.from !== from).concat([{ from, rank, grade }]).sort((a, b) => (a.from < b.from ? -1 : 1)); put(p.key, list, p.name + ' · ' + from + ' 월급부터 ' + rank + ' ' + gradeName(grade)); };
  return (
    <div className="row grade-row">
      <div className="grade-main">
        <strong>{p.name}</strong>
        <span className={'badge' + (cur.set ? '' : ' muted')}>{ym + ' 월급: ' + cur.rank + ' · ' + gradeName(cur.grade) + (cur.set ? '' : ' (미지정 · 기본값)')}</span>
      </div>
      <div className="acts">
        <input className="in" type="month" aria-label={p.name + ' 적용 월급월'} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} />
        <select className="in" aria-label={p.name + ' 직급'} value={rank} onChange={(e) => setRank(e.target.value)}>{ranks.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        <select className="in" aria-label={p.name + ' 등급'} value={grade} onChange={(e) => setGrade(e.target.value)}>{GRADES.map(([g, t]) => <option key={g} value={g}>{t}</option>)}</select>
        <Btn kind="sm primary" onClick={apply}>적용</Btn>
      </div>
      {h.length > 0 && <div className="grade-hist">{h.map((x) => (
        <span key={x.from} className="chip-x">{x.from + '~ ' + x.rank + ' ' + gradeName(x.grade)}
          <button type="button" className="btn sm" aria-label={p.name + ' ' + x.from + ' 기록 지우기'} onClick={() => put(p.key, h.filter((y) => y.from !== x.from), p.name + ' · ' + x.from + ' 기록을 지웠습니다')}>×</button></span>))}</div>}
    </div>
  );
}
