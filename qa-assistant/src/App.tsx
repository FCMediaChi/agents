import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectNewPage from './pages/ProjectNewPage';
import ProjectDetailPage from './pages/ProjectDetailPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/dashboard"
          element={
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          }
        />
        <Route
          path="/projects"
          element={
            <AppLayout>
              <ProjectsPage />
            </AppLayout>
          }
        />
        <Route
          path="/projects/new"
          element={
            <AppLayout>
              <ProjectNewPage />
            </AppLayout>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <AppLayout>
              <ProjectDetailPage />
            </AppLayout>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
