import { Navigate, Outlet } from 'react-router-dom';
import { Spinner } from '../ui';
import { useFacultyAuth } from '../../context/useFacultyAuth';

/** Gate for faculty routes. Server-verifies the stored faculty token. */
export function FacultyProtectedRoute() {
  const { faculty, checking } = useFacultyAuth();

  if (checking) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <Spinner size={22} className="text-brand-600" />
          <p className="text-[13px] text-ink-muted">Verifying your faculty session…</p>
        </div>
      </div>
    );
  }

  if (!faculty) return <Navigate to="/faculty/login" replace />;
  return <Outlet />;
}
