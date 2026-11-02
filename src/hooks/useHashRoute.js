// 주소: #/화면ID?키=값&...  (기존 웹앱과 같은 주소 그대로)
import { useEffect, useState } from 'react';

const parse = () => {
  const h = location.hash || '';
  const page = (h.match(/^#\/([a-z]+)/) || [])[1] || '';
  const q = {}; (h.split('?')[1] || '').split('&').forEach((kv) => { const [k, v] = kv.split('='); if (k) q[k] = decodeURIComponent(v || ''); });
  return { page, q, hash: h };
};
export const useHashRoute = () => {
  const [r, setR] = useState(parse);
  useEffect(() => { const on = () => setR(parse()); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return r;
};
export const go = (hash) => { if (location.hash !== hash) location.hash = hash; };
