// 관리자 · 로그 관리: 관리자 메뉴에서 한 행위 기록 (기간 · 구분 · 수행자 · 검색 · 엑셀)
import { Fragment, useCallback, useEffect, useState } from 'react';
import { rpc } from '../lib/store.js';
import { won, errText } from '../lib/ui.js';
import { XLSX, download, T, N } from '../lib/xlsx.js';
import { Btn, Card, Field, PageHead, Status, useStatus } from '../components/ui.jsx';

const GROUPS = [
  ['sales', '매출 등록', ['sales_entries', 'sales_cases', 'sales_reports', 'free_sales']],
  ['promoters', '홍보팀장', ['promoters']],
  ['branches', '지국', ['branches']],
  ['fee', '수당표', ['products', 'vendors', 'categories', 'incentive_tiers', 'settle_tiers', 'tiers', 'all']],
  ['fee_items', '수당 항목', ['fee_items']],
  ['person_fee', '사람별 수당', ['person_fee_items']],
  ['payroll', '월급 입력값·마감', ['payroll_inputs', 'payroll']],
  ['access', '권한·계정', ['access_rules']],
  ['menu', '메뉴·설정', ['access_layout']],
  ['boards', '게시판', ['boards']],
  ['queue', '등록 대기함', ['queue']],
  ['backup', '백업', ['backup']],
];
const ALL = GROUPS.flatMap((g) => g[2]);
const groupOf = (t) => GROUPS.find((g) => g[2].includes(t)) || ['etc', '기타', []];
const pad = (n) => String(n).padStart(2, '0');
const day = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const ago = (n) => { const t = new Date(); return day(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n)); };

function Detail({ d }) {
  if (d == null) return <dl className="kv log-d"><dt>상세</dt><dd>상세 기록이 없습니다</dd></dl>;
  const out = [];
  const walk = (o, pre) => {
    if (o && typeof o === 'object' && !Array.isArray(o)) Object.entries(o).forEach(([k, v]) => { if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length <= 8) walk(v, pre + k + '.'); else out.push([pre + k, v && typeof v === 'object' ? JSON.stringify(v) : v == null ? '—' : String(v)]); });
    else out.push([pre || '값', JSON.stringify(o)]);
  };
  walk(d, '');
  return <dl className="kv log-d">{out.map(([k, v], i) => <Fragment key={i}><dt>{k}</dt><dd>{v}</dd></Fragment>)}</dl>;
}

export default function Logs() {
  const [F, setF] = useState({ from: ago(6), to: day(new Date()), group: '', actor: '', q: '' });
  const [qIn, setQIn] = useState('');
  const [R, setR] = useState({ rows: [], counts: [], total: 0, state: 'idle', err: '' });
  const [open, setOpen] = useState(() => new Set()); const [xs, setXs] = useStatus();
  const load = useCallback(async (f) => {
    setR((r) => ({ ...r, state: 'loading' }));
    try {
      const tg = f.group && f.group !== 'etc' ? GROUPS.find((g) => g[0] === f.group)[2] : null;
      const r = await rpc('app_logs', { p_from: f.from, p_to: f.to, p_targets: tg, p_actor: f.actor || null, p_q: f.q.trim() || null, p_limit: f.group === 'etc' ? 2000 : 500 });
      const rows = (r.rows || []).filter((x) => f.group !== 'etc' || !ALL.includes(x.target));
      setR({ rows, counts: r.counts || [], total: f.group === 'etc' ? rows.length : r.total || 0, state: 'ok', err: '' });
    } catch (e) { setR((r) => ({ ...r, state: 'off', err: errText(e) })); }
  }, []);
  useEffect(() => { load(F); }, [F, load]);
  const upd = (patch) => setF((f) => ({ ...f, ...patch }));
  const cnt = (g) => R.counts.filter((x) => (!F.actor || x.actor === F.actor) && (g === '' || groupOf(x.target)[0] === g)).reduce((s, x) => s + Number(x.n), 0);
  const xlsx = () => {
    if (!R.rows.length) { setXs('내려받을 로그가 없습니다', 'warn'); return; }
    download('행위로그_' + F.from + '_' + F.to + '.xlsx', XLSX.build([{ name: '행위 로그', cols: [N('로그 번호'), T('일시'), T('수행자'), T('구분'), T('대상'), T('행위 내용'), T('상세')], rows: R.rows.map((r) => [r.id, r.at, r.actor || '', groupOf(r.target)[1], r.target, r.summary || '', r.detail ? JSON.stringify(r.detail) : '']) }]));
    setXs('엑셀을 내려받았습니다', 'ok');
  };
  const actors = [...new Set(R.counts.map((x) => x.actor))].sort();
  return (
    <div className="page">
      <PageHead eyebrow="관리자" title="로그 관리" lede="관리자 메뉴에서 저장·수정·삭제한 기록입니다. 홍보팀장·지국장의 매출 등록과 조회는 기록하지 않습니다." />
      <Card>
        <div className="form3">
          <Field label="시작일"><input className="in" type="date" value={F.from} onChange={(e) => e.target.value && upd({ from: e.target.value })} /></Field>
          <Field label="종료일"><input className="in" type="date" value={F.to} onChange={(e) => e.target.value && upd({ to: e.target.value })} /></Field>
          <Field label="수행자"><select className="in" value={F.actor} onChange={(e) => upd({ actor: e.target.value })}><option value="">전체 수행자</option>{actors.map((a) => <option key={a} value={a}>{a || '(이름 없음)'}</option>)}</select></Field>
          <Field label="검색"><input className="in" type="search" placeholder="내용·수행자 검색 후 Enter" value={qIn} onChange={(e) => { setQIn(e.target.value); if (!e.target.value && F.q) upd({ q: '' }); }} onKeyDown={(e) => { if (e.key === 'Enter') upd({ q: qIn }); }} /></Field>
        </div>
        <div className="acts">
          {[['오늘', 0], ['최근 7일', 6], ['최근 30일', 29], ['최근 90일', 89]].map(([n, d]) => <Btn key={n} kind="sm" onClick={() => upd({ to: day(new Date()), from: ago(d) })}>{n}</Btn>)}
          <Btn kind="sm" onClick={() => load(F)}>새로고침</Btn><Btn kind="primary sm" onClick={xlsx}>엑셀 다운로드</Btn><Status s={xs} />
        </div>
      </Card>
      <Card>
        <div className="card-h"><h2>행위 로그 {R.state === 'ok' ? won(R.total) + '건' : ''}</h2></div>
        <div className="chips" role="tablist">
          {[['', '전체']].concat(GROUPS.map((g) => [g[0], g[1]]), [['etc', '기타']]).map(([k, t]) => { const n = cnt(k); if (k && !n && F.group !== k) return null;
            return <button key={k || 'all'} type="button" className="btn chip" role="tab" aria-selected={F.group === k} onClick={() => upd({ group: k })}>{t + ' ' + won(n)}</button>; })}
        </div>
        {R.state === 'loading' && <p className="note">불러오는 중…</p>}
        {R.state === 'off' && <p className="status" data-kind="bad">{R.err}</p>}
        {R.state === 'ok' && (<>
          <div className="tbl"><table className="items left">
            <thead><tr><th>일시</th><th>수행자</th><th>구분</th><th>행위 내용</th><th /></tr></thead>
            <tbody>{R.rows.map((r) => { const o = open.has(r.id); return (
              <Fragment key={r.id}>
                <tr><td className="nowrap">{r.at}</td><td>{r.actor || '—'}</td><td>{groupOf(r.target)[1]}</td><td className="title">{r.summary || ''}</td>
                  <td className="act"><Btn kind="sm" aria-expanded={o} onClick={() => setOpen((s) => { const n = new Set(s); o ? n.delete(r.id) : n.add(r.id); return n; })}>{o ? '접기' : '상세'}</Btn></td></tr>
                {o && <tr className="drow"><td colSpan={5}><div className="note">{'로그 번호 ' + r.id + ' · 대상 ' + r.target}</div><Detail d={r.detail} /></td></tr>}
              </Fragment>); })}</tbody>
          </table></div>
          {!R.rows.length && <p className="note empty">조건에 맞는 로그가 없습니다</p>}
          {R.total > R.rows.length && <p className="note">최근 {R.rows.length}건만 보입니다 · 기간을 줄이거나 구분·검색으로 좁혀 보세요 (엑셀도 보이는 건만)</p>}
        </>)}
      </Card>
    </div>
  );
}
