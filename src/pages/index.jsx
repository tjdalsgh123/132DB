// 화면 목록: React로 옮긴 화면 + (옮기는 중) 기존 화면
import { DASHBOARD_URL, APP_NAME } from '../lib/config.js';
import { labelOf, parentOf } from '../lib/nav.js';
import Account from './Account.jsx';
import Board from './Board.jsx';
import BoardAdmin from './BoardAdmin.jsx';
import PayClose from './PayClose.jsx';
import Logs from './Logs.jsx';
import Dashboard from './Dashboard.jsx';
import GeneralDash from './GeneralDash.jsx';
import SalesIn from './SalesIn.jsx';
import FreeIn from './FreeIn.jsx';
import SalesView from './SalesView.jsx';
import MenuAdmin from './MenuAdmin.jsx';
import Promoters from './Promoters.jsx';
import FeeCalc from './FeeCalc.jsx';
import PayCalc from './PayCalc.jsx';
import PayBranch from './PayBranch.jsx';
import { PayList, PayEdit } from './PayAdmin.jsx';
import FeeAdmin from './FeeAdmin.jsx';
// 기존 화면 (다음 단계에서 React로)
import Admin from './Admin.jsx';

export const PAGES = {
  account: Account,
  board: Board,
  boardadmin: BoardAdmin,
  payclose: PayClose,
  logs: Logs,
  branch: Dashboard,
  gdash: GeneralDash,
  fee: FeeCalc,
  psalesin: () => <SalesIn mode="promoter" />,
  salesin: () => <SalesIn mode="direct" />,
  pfreein: () => <FreeIn mode="promoter" />,
  sfreein: () => <FreeIn mode="branch" />,
  psales: () => <SalesView mode="promoter" />,
  sales: () => <SalesView mode="branch" />,
  ppay: PayCalc,
  bpay: () => <PayBranch />,
  promoters: () => <Promoters />,
  feeadmin: FeeAdmin,
  paylist: PayList,
  payedit: PayEdit,
  admin: Admin,
  menuadmin: MenuAdmin,
  gsalesin: () => <SalesIn mode="direct" general />,
  gfreein: () => <FreeIn mode="branch" general />,
  gsales: () => <SalesView mode="branch" general />,
  gpromoters: () => <Promoters general />,
  gpay: () => <PayBranch kind="general" />,
};
export const Placeholder = ({ id }) => (
  <div className="page"><section className="card">
    <div className="eyebrow">{(parentOf(id) || {}).name || APP_NAME}</div><h1>{labelOf(id)}</h1>
    <p>이 화면은 다음 단계에서 웹앱으로 옮길 예정입니다. 그 전까지는 기존 대시보드에서 사용해 주세요.</p>
    <a className="btn primary" href={DASHBOARD_URL} target="_blank" rel="noopener noreferrer">기존 대시보드 열기</a>
  </section></div>
);
