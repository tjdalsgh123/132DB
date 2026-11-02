// 132총국 웹앱 설정 (공개해도 되는 값만 둠: 프로젝트 주소와 공개 키 · 데이터 보호는 DB 권한 함수가 함)
// 접속 주소로 DB를 고름: 운영 주소에서만 운영 DB, 그 밖(개발 서버·미리보기·내 컴퓨터)은 모두 개발 DB
const PROD_HOSTS = ['132db.tjdalsgh123.workers.dev'];
const ENVS = {
  prod: { url: 'https://vbcuycufczaabbuuxako.supabase.co', key: 'sb_publishable_xUe_WW4t_Bc6QszplZXs2g_bGAioou8', label: '' },
  dev: { url: 'https://uwlbwmcfqtxhysiclzes.supabase.co', key: 'sb_publishable_5_x0NYBQTxacvcNtd-GfsQ_qScqXRkZ', label: '개발 서버 · 테스트 DB' },
};
export const ENV = PROD_HOSTS.includes(location.hostname) ? 'prod' : 'dev';
export const SUPABASE_URL = ENVS[ENV].url;
export const SUPABASE_KEY = ENVS[ENV].key;
export const ENV_LABEL = ENVS[ENV].label;
// 아직 웹앱으로 옮기지 않은 화면은 기존 대시보드에서 사용
export const DASHBOARD_URL = 'https://claude.ai/artifact/8zuzfMLjxUDnV4oDy1KdMp';
export const APP_NAME = '132총국 관리시스템';
export const COMPANY = '(주)와이즈교육';
export const LOGO = '/assets/img/wise-logo.png';
export const LOGO_DARK = '/assets/img/wise-logo-white.png'; // 다크 모드(기기·브라우저 설정이 어두운 테마)일 때
