/**
 * Login Page
 */

import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuthStore } from '@context/stores/authStore';
import { LoginForm } from '@components/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuthStore();

  // Redirect if already authenticated
  if (isAuthenticated) {
    const from = (location.state as { from?: Location })?.from?.pathname || '/schedule';
    return <Navigate to={from} replace />;
  }

  const handleLoginSuccess = () => {
    const from = (location.state as { from?: Location })?.from?.pathname || '/schedule';
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl">H</span>
          </div>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            Home Health Care AI
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account to continue
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-white py-8 px-6 shadow rounded-lg">
          <LoginForm onSuccess={handleLoginSuccess} />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-500">
          HIPAA Compliant | Protected Health Information
        </p>
      </div>
    </div>
  );
}
