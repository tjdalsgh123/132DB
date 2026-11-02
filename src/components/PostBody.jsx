// 본문: 줄바꿈 유지 · http(s) 주소는 링크
export default function PostBody({ text, className = 'post-body' }) {
  const lines = String(text || '').split('\n');
  return (
    <div className={className}>
      {lines.map((line, i) => {
        const parts = []; let last = 0; const re = /https?:\/\/[^\s<>"]+/g; let m;
        while ((m = re.exec(line))) { if (m.index > last) parts.push(line.slice(last, m.index)); parts.push(<a key={m.index} href={m[0]} target="_blank" rel="noopener noreferrer">{m[0]}</a>); last = m.index + m[0].length; }
        if (last < line.length) parts.push(line.slice(last));
        return <span key={i}>{i > 0 && <br />}{parts}</span>;
      })}
    </div>
  );
}
