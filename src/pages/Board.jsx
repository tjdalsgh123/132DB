// 게시판 · 공지사항: 읽기는 로그인한 모든 사람 · 글쓰기는 게시판마다 정한 역할(관리자는 항상)
// 주소: #/board?b=게시판ID  ·  &p=글ID (보기)  ·  &w=1 (새 글) / &p=글ID&w=1 (고치기)
import { useEffect, useMemo, useRef, useState } from 'react';
import { D, rpc, save, isAdmin } from '../lib/store.js';
import { errText, MSG } from '../lib/ui.js';
import { boardHref, boards, fmtD, fmtDT, isNew, readImage, openNotices } from '../lib/board.js';
import { useData } from '../hooks/useData.js';
import { go } from '../hooks/useHashRoute.js';
import { Btn, Card, ConfirmBtn, PageHead, Status, Tabs, useStatus } from '../components/ui.jsx';
import PostBody from '../components/PostBody.jsx';

const PER = 15;

export default function Board({ route }) {
  useData();
  const all = boards(); const Q = route.q;
  if (!all.length) return (<div className="page"><PageHead eyebrow="게시판" title="게시판" /><Card>아직 만든 게시판이 없습니다{isAdmin() ? ' · 「관리자 → 게시판 관리」에서 만드세요' : ''}</Card></div>);
  const B = all.find((b) => b.id === Q.b) || all[0];
  return (
    <div className="page">
      <PageHead eyebrow="게시판" title={B.name} />
      <Tabs hidden={all.length < 2} items={all.map((b) => [b.id, b.name])} value={B.id} onPick={(id) => go(boardHref(id))} />
      {Q.w ? <PostEdit key={'e' + B.id + (Q.p || '')} B={B} id={Q.p ? Number(Q.p) : null} />
        : Q.p ? <PostView key={'v' + Q.p} B={B} id={Number(Q.p)} />
        : <PostList key={'l' + B.id} B={B} />}
    </div>
  );
}

// ---- 목록: 필독은 맨 위 고정 + 강조 ----
function PostList({ B }) {
  const [q, setQ] = useState(''); const [page, setPage] = useState(1);
  const kw = q.trim().toLowerCase();
  const posts = (D.posts || []).filter((p) => p.board_id === B.id && (!kw || p.title.toLowerCase().includes(kw) || (p.body || '').toLowerCase().includes(kw)));
  const must = posts.filter((p) => p.must_read); const rest = posts.filter((p) => !p.must_read);
  const pages = Math.max(1, Math.ceil(rest.length / PER)); const pg = Math.min(page, pages);
  const shown = rest.slice((pg - 1) * PER, pg * PER);
  const Row = ({ p, no }) => (
    <a className={'bl-row' + (p.must_read ? ' must' : '')} href={boardHref(B.id, p.id)}>
      <span className="bl-c0">{p.must_read ? '필독' : String(no)}</span>
      <span className="bl-c1">{p.must_read && <span className="tag must">필독</span>}{p.popup && <span className="tag pop">표출</span>}<span className="bl-t">{p.title}</span>{p.has_image && <span className="bl-ic">이미지</span>}{isNew(p.created_at) && <span className="tag new">N</span>}</span>
      <span className="bl-c2">{p.author_name}</span><span className="bl-c3">{fmtD(p.created_at)}</span><span className="bl-c4">{p.views || 0}</span>
    </a>
  );
  return (
    <Card>
      <div className="card-h">
        <h2>{B.name} 목록</h2>
        <div className="acts">
          <input className="in" type="search" placeholder="제목·내용 검색" aria-label="글 검색" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
          {B.kind === 'notice' && <Btn onClick={openNotices}>화면 표출 공지 보기</Btn>}
          {B.can_write && <Btn kind="primary" onClick={() => go(boardHref(B.id, null, true))}>글쓰기</Btn>}
        </div>
      </div>
      {B.memo && <p className="note">{B.memo}</p>}
      <div className="board-list">
        <div className="bl-row bl-head">{['번호', '제목', '글쓴이', '날짜', '조회'].map((t, i) => <span key={i} className={'bl-c' + i}>{t}</span>)}</div>
        {pg === 1 && must.map((p) => <Row key={p.id} p={p} />)}
        {shown.map((p, i) => <Row key={p.id} p={p} no={rest.length - ((pg - 1) * PER + i)} />)}
        {!must.length && !shown.length && <p className="note empty">{kw ? '찾는 글이 없습니다' : '아직 글이 없습니다'}</p>}
      </div>
      {pages > 1 && <div className="pager">{Array.from({ length: pages }, (_, i) => i + 1).map((i) => <Btn key={i} kind={'sm' + (i === pg ? ' primary' : '')} aria-current={i === pg ? 'page' : undefined} onClick={() => setPage(i)}>{i}</Btn>)}</div>}
    </Card>
  );
}

// ---- 보기 ----
function PostView({ B, id }) {
  const [P, setP] = useState(null); const [err, setErr] = useState(''); const [st, setSt] = useStatus();
  useEffect(() => { let on = true; rpc('app_board_post', { p_id: id, p_count: true }).then((r) => on && setP(r)).catch((e) => on && setErr(errText(e))); return () => { on = false; }; }, [id]);
  if (err) return <Card><p className="status">{err}</p><Btn onClick={() => go(boardHref(B.id))}>목록</Btn></Card>;
  if (!P) return <Card className="post"><p className="note">불러오는 중…</p></Card>;
  const edited = P.updated_at && new Date(P.updated_at) - new Date(P.created_at) > 60000;
  return (
    <Card className="post">
      <h2 className="post-t">{P.must_read && <span className="tag must">필독</span>}{P.title}</h2>
      <p className="note post-meta">{P.author_name + ' · ' + fmtDT(P.created_at) + (edited ? ' (수정 ' + fmtDT(P.updated_at) + ')' : '') + ' · 조회 ' + (P.views || 0) + (P.popup ? ' · 화면 표출 ' + (P.popup_from || '처음') + ' ~ ' + (P.popup_to || '계속') : '')}</p>
      {P.image && <img className="post-img" src={P.image} alt={P.title + ' 이미지'} />}
      <PostBody text={P.body} />
      <div className="acts post-acts">
        <Btn onClick={() => go(boardHref(B.id))}>목록</Btn>
        {(isAdmin() || P.mine) && <>
          <Btn onClick={() => go(boardHref(B.id, P.id, true))}>수정</Btn>
          <ConfirmBtn kind="danger" onFirst={() => setSt('삭제하면 되돌릴 수 없습니다 · 한 번 더 누르세요', 'warn')}
            onConfirm={async () => { try { await save('app_board_post_delete', { p_id: P.id }); go(boardHref(B.id)); } catch (e) { setSt(errText(e), 'bad'); } }}>삭제</ConfirmBtn>
        </>}
      </div>
      <Status s={st} />
    </Card>
  );
}

// ---- 쓰기 · 고치기 ----
function PostEdit({ B, id }) {
  const [P, setP] = useState(id ? null : { title: '', body: '', must_read: false, popup: false, popup_from: '', popup_to: '', image: null, mine: true });
  const [err, setErr] = useState(''); const [st, setSt] = useStatus(); const [ist, setIst] = useStatus(); const [saving, setSaving] = useState(false);
  const [bad, setBad] = useState({}); const [imgTouched, setImgTouched] = useState(false); const titleRef = useRef(null);
  useEffect(() => { if (!id) return undefined; let on = true; rpc('app_board_post', { p_id: id, p_count: false }).then((r) => on && setP({ ...r, popup_from: r.popup_from || '', popup_to: r.popup_to || '' })).catch((e) => on && setErr(errText(e))); return () => { on = false; }; }, [id]);
  useEffect(() => { if (P && titleRef.current) titleRef.current.focus(); }, [!!P]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!id && !B.can_write) return <Card><p>이 게시판에 글을 쓸 권한이 없습니다</p><Btn onClick={() => go(boardHref(B.id))}>목록</Btn></Card>;
  if (err) return <Card><p className="status">{err}</p></Card>;
  if (!P) return <Card><p className="note">불러오는 중…</p></Card>;
  if (id && !(isAdmin() || P.mine)) return <Card><p>본인이 쓴 글만 고칠 수 있습니다</p><Btn onClick={() => go(boardHref(B.id))}>목록</Btn></Card>;
  const set = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const pick = async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return; setIst('이미지 줄이는 중…'); try { const img = await readImage(f); set('image', img); setImgTouched(true); setIst(''); } catch (x) { setIst(errText(x), 'bad'); } };
  const submit = async () => {
    setBad({}); if (!P.title.trim()) { setBad({ title: 1 }); setSt(MSG + ' · 제목', 'bad'); titleRef.current.focus(); return; }
    if (B.kind === 'notice' && P.popup && P.popup_from && P.popup_to && P.popup_to < P.popup_from) { setBad({ to: 1 }); setSt('표출 종료일이 시작일보다 빠릅니다', 'bad'); return; }
    const p = { board_id: B.id, title: P.title.trim(), body: P.body || '', must_read: !!P.must_read, popup: !!P.popup, popup_from: P.popup_from || '', popup_to: P.popup_to || '' };
    if (id) p.id = id; if (!id || imgTouched) p.image = P.image || '';
    setSaving(true);
    try { const r = await save('app_board_post_save', { p }); go(boardHref(B.id, r.id)); } catch (e) { setSt(errText(e), 'bad'); setSaving(false); }
  };
  return (
    <Card>
      <h2>{id ? '글 고치기' : B.name + ' 글쓰기'}</h2>
      <div className="form-grid post-form">
        <div className="field"><label className="field-l" htmlFor="post-title">제목</label><input id="post-title" ref={titleRef} className={'in' + (bad.title ? ' invalid' : '')} aria-invalid={bad.title ? 'true' : undefined} type="text" maxLength={200} value={P.title} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="field"><label className="field-l" htmlFor="post-body">내용</label><textarea id="post-body" className="in post-ta" rows={14} maxLength={20000} value={P.body || ''} onChange={(e) => set('body', e.target.value)} /></div>
        <div className="field"><span className="field-l">이미지 (선택 · 1장 · 화면 표출 공지에도 보임)</span>
          <div className="acts"><label className="btn sm" htmlFor="post-img">이미지 고르기</label><input id="post-img" className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={pick} />
            {P.image && <Btn kind="sm" onClick={() => { set('image', null); setImgTouched(true); }}>이미지 빼기</Btn>}<Status s={ist} /></div>
          <div className="img-prev">{P.image && <img src={P.image} alt="올릴 이미지 미리보기" />}</div>
        </div>
        {B.kind === 'notice' && (
          <fieldset className="post-opts"><legend>공지 설정</legend>
            <div><label className="check"><input type="checkbox" checked={!!P.must_read} onChange={(e) => set('must_read', e.target.checked)} /> 필독</label><p className="note">목록 맨 위에 고정되고 강조 표시됩니다</p></div>
            <div><label className="check"><input type="checkbox" checked={!!P.popup} onChange={(e) => set('popup', e.target.checked)} /> 화면 표출</label><p className="note">로그인하면 화면이 어두워지고 가운데에 이 공지가 보입니다 · 기간을 비우면 계속 표출</p></div>
            {P.popup && <div className="acts post-dates"><span className="note">표출 기간</span><input className="in" type="date" aria-label="표출 시작일" value={P.popup_from} onChange={(e) => set('popup_from', e.target.value)} /><span className="note">~</span><input className={'in' + (bad.to ? ' invalid' : '')} type="date" aria-label="표출 종료일" value={P.popup_to} onChange={(e) => set('popup_to', e.target.value)} /></div>}
          </fieldset>
        )}
      </div>
      <div className="acts">
        <Btn kind="primary" disabled={saving} onClick={submit}>{id ? '고친 내용 저장' : '등록'}</Btn>
        <Btn onClick={() => go(id ? boardHref(B.id, id) : boardHref(B.id))}>취소</Btn>
        <Status s={st} />
      </div>
    </Card>
  );
}
