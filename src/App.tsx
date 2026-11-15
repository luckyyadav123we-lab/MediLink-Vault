import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore, type UserRole } from './store/useAuthStore';
import { apiFetch } from './lib/api';
import { Layout } from './components/Layout';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { PatientDashboard } from './pages/PatientDashboard';
import { VaultPage } from './pages/VaultPage';
import { ComparisonPage } from './pages/ComparisonPage';
import { AiCompanionPage } from './pages/AiCompanionPage';
import { FamilyVaultPage } from './pages/FamilyVaultPage';
import { ConsentSecurityPage } from './pages/ConsentSecurityPage';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { HospitalDashboard } from './pages/HospitalDashboard';
import { LabDashboard } from './pages/LabDashboard';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
import { ServicesSupportPage } from './pages/ServicesSupportPage';
import { BillingPage } from './pages/BillingPage';

const ROLE_HOME: Record<UserRole, string> = {
  patient: '/patient',
  doctor: '/doctor',
  hospital_admin: '/hospital',
  lab_admin: '/lab',
  super_admin: '/super-admin',
};

const ProtectedRoute: React.FC<{ allowedRoles?: UserRole[]; children: React.ReactNode }> = ({
  allowedRoles,
  children,
}) => {
  const { token, user } = useAuthStore();
  if (!token || !user) {
    return <Navigate to="/" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }
  return <>{children}</>;
};

export default function App() {
  const { token, setPatientMeta } = useAuthStore();

  useEffect(() => {
    if (!token) return;
    apiFetch<{
      patient: { id: string; health_id: string } | null;
    }>('/api/auth/me')
      .then((res) => {
        if (res.patient) {
          setPatientMeta(res.patient.id, res.patient.health_id);
        }
      })
      .catch(() => {});
  }, [token]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          {/* Patient Routes */}
          <Route
            path="/patient"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <PatientDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/vault"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <VaultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compare"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <ComparisonPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/companion"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <AiCompanionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/family"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <FamilyVaultPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/consent"
            element={
              <ProtectedRoute allowedRoles={['patient']}>
                <ConsentSecurityPage />
              </ProtectedRoute>
            }
          />

          {/* Clinical, Hospital, Lab & Super Admin Routes */}
          <Route
            path="/doctor"
            element={
              <ProtectedRoute allowedRoles={['doctor']}>
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hospital"
            element={
              <ProtectedRoute allowedRoles={['hospital_admin']}>
                <HospitalDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lab"
            element={
              <ProtectedRoute allowedRoles={['lab_admin']}>
                <LabDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Shared Services, Support & Billing Routes */}
          <Route path="/services" element={<ServicesSupportPage />} />
          <Route path="/billing" element={<BillingPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
