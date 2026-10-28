import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import SitemapBuilderPage from './pages/SitemapBuilderPage';
import AccountPage from './pages/AccountPage';
import ClientPortalPage from './pages/ClientPortalPage';
import SupportPage from './pages/SupportPage';

/**
 * Routes mirror the monolith's Blueprint product paths (minus pipeline).
 *
 * Public:      / · /support · /login · /signup · /verify · /forgot-password ·
 *              /reset-password · /project/:projectId/client (tokenised client portal)
 * Protected:   /dashboard · /account · /projects/:projectId
 *              /projects/:projectId/{outline|questionnaire|wireframe|proposal}
 *
 * The sitemap builder hosts outline, questionnaire, wireframe and proposal as
 * tabs, so those four paths deep-link into the same builder at the right tab.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<RegisterPage />} />
      <Route path="/register" element={<Navigate to="/signup" replace />} />
      <Route path="/verify" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Client portal — public, access is granted by the invite token in the URL. */}
      <Route path="/project/:projectId/client" element={<ClientPortalPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/projects/:projectId" element={<SitemapBuilderPage />} />
        <Route path="/projects/:projectId/:view" element={<SitemapBuilderPage />} />
      </Route>

      {/* Legacy monolith paths, kept so old links and emails still land somewhere. */}
      <Route path="/app" element={<Navigate to="/dashboard" replace />} />
      <Route path="/app/projects/:projectId" element={<Navigate to="/dashboard" replace />} />
      <Route path="/app/account" element={<Navigate to="/account" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
