import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/useAuth';
import { Sidebar } from './Sidebar';

/* ==========================================================================
   AppShell — sidebar + content column.
   A persistent strip surfaces any running analysis, wherever you are.
   ========================================================================== */
export function AppShell({ children }) {
  const { studentName, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="relative z-10 flex min-h-screen bg-canvas">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar studentName={studentName} onLogout={handleLogout} />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="animate-fade-in absolute inset-0 cursor-pointer border-none bg-brand-900/30"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-rise relative h-full">
            <Sidebar studentName={studentName} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md lg:hidden" data-print-hide>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="cursor-pointer rounded-lg p-2 text-ink-soft transition-colors hover:bg-subtle"
            aria-label="Open menu"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="flex items-center gap-2 font-display text-[14px] font-semibold text-ink">
            <Sparkles size={15} className="text-brand-600" aria-hidden="true" />
            Project Mentor
          </span>
          <span className="w-9" />
        </header>

        <main
          key={location.pathname}
          className="mx-auto w-full max-w-6xl animate-fade-up px-5 py-7 sm:px-7 lg:px-10 lg:py-9"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
