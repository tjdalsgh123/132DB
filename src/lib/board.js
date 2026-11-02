// 게시판 공통: 주소 · 날짜 · 이미지 줄이기
import { D } from './store.js';

export const boardHref = (b, p, w) => '#/board?b=' + encodeURIComponent(b) + (p ? '&p=' + p : '') + (w ? '&w=1' : '');
export const boards = () => (D.boards || []).filter((b) => b.active !== false);
export const fmtD = (t) => { if (!t) return ''; const d = new Date(t); return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0'); };
export const fmtDT = (t) => { if (!t) return ''; const d = new Date(t); return fmtD(t) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
export const isNew = (t) => t && Date.now() - new Date(t).getTime() < 3 * 86400000;
// 이미지: 긴 변 1600px 이하로 줄여 data URL (2MB 이하)
const MAXB = 3000000;
export const readImage = (file) => new Promise((res, rej) => {
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { rej(new Error('PNG·JPG·WEBP·GIF 이미지만 올릴 수 있습니다')); return; }
  const fr = new FileReader(); fr.onerror = () => rej(new Error('이미지를 읽지 못했습니다'));
  fr.onload = () => {
    const src = String(fr.result);
    if (file.type === 'image/gif') { if (src.length > MAXB) rej(new Error('GIF는 2MB 이하만 올릴 수 있습니다')); else res(src); return; }
    const img = new Image(); img.onerror = () => rej(new Error('이미지를 읽지 못했습니다'));
    img.onload = () => {
      const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
      let out = file.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
      if (out.length > MAXB) { const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const g = c2.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h); out = c2.toDataURL('image/jpeg', 0.8); }
      if (out.length > MAXB) rej(new Error('이미지가 너무 큽니다 · 더 작은 이미지를 올려 주세요')); else res(out);
    };
    img.src = src;
  };
  fr.readAsDataURL(file);
});
// 화면 표출 공지 다시 열기 (게시판 → NoticeLayer)
export const openNotices = () => window.dispatchEvent(new CustomEvent('k132:notices', { detail: { force: true } }));
