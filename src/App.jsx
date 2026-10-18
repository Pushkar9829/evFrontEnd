import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Loading } from './components/ui.jsx';
import DriverLayout from './driver/DriverLayout.jsx';
import QrStart from './driver/QrStart.jsx';
import LiveSession from './driver/LiveSession.jsx';
import MockPay from './driver/MockPay.jsx';

// The QR -> pay -> live flow is in the main bundle (fast on 4G); everything else is split.
const Discover = lazy(() => import('./driver/Discover.jsx'));
const ChargerDetail = lazy(() => import('./driver/ChargerDetail.jsx'));
const DriverLogin = lazy(() => import('./driver/DriverLogin.jsx'));
const Account = lazy(() => import('./driver/Account.jsx'));
const History = lazy(() => import('./driver/History.jsx'));
const HostMode = lazy(() => import('./driver/HostMode.jsx'));
const FleetPage = lazy(() => import('./driver/Fleet.jsx'));
const Console = lazy(() => import('./console/Console.jsx'));
const StaffLogin = lazy(() => import('./console/StaffLogin.jsx'));

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/console/login" element={<StaffLogin />} />
        <Route path="/console/*" element={<Console />} />
        <Route path="/pay/mock/:orderId" element={<MockPay />} />
        <Route element={<DriverLayout />}>
          <Route index element={<Discover />} />
          <Route path="/c/:ocppId/:connector" element={<QrStart />} />
          <Route path="/charger/:ocppId" element={<ChargerDetail />} />
          <Route path="/s/:id" element={<LiveSession />} />
          <Route path="/login" element={<DriverLogin />} />
          <Route path="/history" element={<History />} />
          <Route path="/account" element={<Account />} />
          <Route path="/host" element={<HostMode />} />
          <Route path="/fleet" element={<FleetPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
