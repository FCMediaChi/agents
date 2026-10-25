import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import PipelineProtectedRoute from './components/PipelineProtectedRoute';
import AppLayout from './components/AppLayout';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import PipelineLanding from './pages/pipeline/PipelineLanding';
import PipelineLogin from './pages/pipeline/PipelineLogin';
import PipelineRegister from './pages/pipeline/PipelineRegister';
import PipelineOnboarding from './pages/pipeline/PipelineOnboarding';
import PipelineDashboard from './pages/pipeline/PipelineDashboard';
import PipelineCaseStudy from './pages/pipeline/PipelineCaseStudy';
import ColdPitchBuilder from './pages/pipeline/ColdPitchBuilder';

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
      </Route>

      {/* Pipeline routes (Phase 3 — ported from the monolith) */}
      <Route path="/pipeline" element={<PipelineLanding />} />
      <Route path="/pipeline/login" element={<PipelineLogin />} />
      <Route path="/pipeline/register" element={<PipelineRegister />} />
      <Route path="/pipeline/onboarding" element={<PipelineProtectedRoute><PipelineOnboarding /></PipelineProtectedRoute>} />
      <Route path="/pipeline/dashboard" element={<PipelineProtectedRoute><PipelineDashboard /></PipelineProtectedRoute>} />
      <Route path="/pipeline/case-study" element={<PipelineProtectedRoute><PipelineCaseStudy /></PipelineProtectedRoute>} />
      <Route path="/pipeline/cold-pitch" element={<PipelineProtectedRoute><ColdPitchBuilder /></PipelineProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
