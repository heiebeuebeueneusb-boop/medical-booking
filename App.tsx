import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import { useAuth } from './context/AuthContext';

const HomePage = lazy(() => import('./pages/HomePage'));
const DoctorsPage = lazy(() => import('./pages/DoctorsPage'));
const DepartmentsPage = lazy(() => import('./pages/DepartmentsPage'));
const DoctorProfilePage = lazy(() => import('./pages/DoctorProfilePage'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const PatientDashboard = lazy(() => import('./pages/PatientDashboard'));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const MapPage = lazy(() => import('./pages/MapPage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children, requiredRole }: { children: React.ReactNode; requiredRole?: 'patient' | 'doctor' | 'admin' }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <PageLoader />;

  if (!user) return <Navigate to="/auth" replace />;
  if (requiredRole && profile?.role !== requiredRole) {
    const fallback = profile?.role === 'doctor' ? '/dashboard/doctor' : profile?.role === 'admin' ? '/admin' : '/dashboard/patient';
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/doctors" element={<DoctorsPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/doctor/:doctorId" element={<DoctorProfilePage />} />
            <Route path="/book/:doctorId" element={<BookingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route
              path="/dashboard/patient"
              element={
                <ProtectedRoute requiredRole="patient">
                  <PatientDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard/doctor"
              element={
                <ProtectedRoute requiredRole="doctor">
                  <DoctorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminPanel />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
