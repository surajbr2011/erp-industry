import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import Sidebar from './components/Sidebar';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SuppliersPage from './pages/SuppliersPage';
import RFQPage from './pages/RFQPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import MaterialsPage from './pages/MaterialsPage';
import BOMPage from './pages/BOMPage';
import WorkOrdersPage from './pages/WorkOrdersPage';
import MachinesPage from './pages/MachinesPage';
import PartsPage from './pages/PartsPage';
import InspectionsPage from './pages/InspectionsPage';
import FinishedGoodsPage from './pages/FinishedGoodsPage';
import ReportsPage from './pages/ReportsPage';
import UsersPage from './pages/UsersPage';

function ProtectedLayout() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}

function App() {
  const { loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: 'Inter, sans-serif',
            fontSize: '13.5px',
            fontWeight: 500,
            borderRadius: '8px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
          },
          success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/suppliers" element={<SuppliersPage />} />
          <Route path="/rfqs" element={<RFQPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/materials" element={<MaterialsPage />} />
          <Route path="/boms" element={<BOMPage />} />
          <Route path="/work-orders" element={<WorkOrdersPage />} />
          <Route path="/machines" element={<MachinesPage />} />
          <Route path="/parts" element={<PartsPage />} />
          <Route path="/inspections" element={<InspectionsPage />} />
          <Route path="/finished-goods" element={<FinishedGoodsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
