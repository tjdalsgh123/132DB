// 132총국 관리시스템 · React 시작점
import { createRoot } from 'react-dom/client';
import './app.css';
import { ENV_LABEL } from './lib/config.js';
import App from './App.jsx';

// 개발 서버 표시 (운영에서는 안 보임)
if (ENV_LABEL) { document.documentElement.dataset.env = 'dev'; const b = document.createElement('div'); b.className = 'env-bar'; b.textContent = ENV_LABEL + ' — 여기서 저장한 내용은 운영에 반영되지 않습니다'; document.body.prepend(b); document.title = '[개발] ' + document.title; }

// 브라우저를 모두 닫으면 로그아웃: 이 사이트 탭이 하나도 열려 있지 않은 상태에서 새로 열면 저장된 로그인을 지움
//  · 새로고침·같은 탭 = 유지 (sessionStorage 표시) · 다른 탭이 열려 있으면 새 탭도 유지 (탭끼리 확인)
const TAB = 'k132.tab';
const tabs = (() => { try { return new BroadcastChannel('k132-tabs'); } catch (_) { return null; } })();
if (tabs) tabs.onmessage = (e) => { if (e.data === 'ping') tabs.postMessage('here'); };
const otherTab = () => new Promise((res) => { if (!tabs) { res(false); return; } const t = setTimeout(() => res(false), 400); const h = (e) => { if (e.data === 'here') { clearTimeout(t); tabs.removeEventListener('message', h); res(true); } }; tabs.addEventListener('message', h); tabs.postMessage('ping'); });
const authKeys = () => { try { return Object.keys(localStorage).filter((k) => /^sb-.*-auth-token/.test(k)); } catch (_) { return []; } };
const mark = () => { try { sessionStorage.setItem(TAB, '1'); } catch (_) {} };

(async () => {
  const mail = /type=recovery|access_token=/.test(location.hash); // 메일 링크 (비밀번호 재설정)
  if (!mail) {
    let fresh = true; try { fresh = !sessionStorage.getItem(TAB); } catch (_) {}
    if (fresh && authKeys().length && !(await otherTab())) { authKeys().forEach((k) => { try { localStorage.removeItem(k); } catch (_) {} }); mark(); location.reload(); return; }
  }
  mark();
  createRoot(document.getElementById('app')).render(<App recovery={mail} />);
})();
