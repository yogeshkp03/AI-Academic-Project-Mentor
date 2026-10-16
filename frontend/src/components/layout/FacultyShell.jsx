import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useFacultyAuth } from '../../context/useFacultyAuth';
import { BrandMark } from '../Brand';
import { Avatar } from '../ui';

/**
 * FacultyShell — deliberately quieter chrome than the student app.
 * Reviewing student work is the whole job; the interface must not compete with it.
 */
export function FacultyShell({ children }) {
  const navigate = useNavigate();
  const { faculty, logout } = useFacultyAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/faculty/login');
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <header
        data-print-hide
        className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-5 sm:px-8">
          <Link to="/faculty/dashboard" className="flex items-center gap-2.5 no-underline">
            <BrandMark size={28} />
            <span className="hidden font-display text-[14px] font-semibold text-ink sm:inline">
              Faculty Review
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/dashboard"
              className="hidden rounded-[10px] px-3 py-2 text-[13px] font-semibold text-ink-soft no-underline transition-colors hover:bg-subtle hover:text-ink sm:inline-block"
            >
              Student app
            </Link>

            <div className="hidden items-center gap-2.5 rounded-[10px] bg-subtle py-1.5 pr-2.5 pl-1.5 sm:flex">
              <Avatar name={faculty?.name || ''} size={26} />
              <span className="max-w-40 truncate text-[12.5px] font-semibold text-ink">
                {faculty?.name}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border border-line-strong bg-surface px-3 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-danger-50 hover:text-danger-700"
            >
              <LogOut size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>

            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="cursor-pointer rounded-lg p-2 text-ink-soft transition-colors hover:bg-subtle sm:hidden"
              aria-label="Toggle navigation"
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-line bg-surface px-5 py-3 sm:hidden">
            <Link
              to="/dashboard"
              className="block rounded-[10px] px-3 py-2 text-[13px] font-semibold text-ink-soft no-underline hover:bg-subtle"
            >
              Student app
            </Link>
            <p className="mt-1 px-3 text-[12px] text-ink-muted">{faculty?.name}</p>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl animate-fade-up px-5 py-7 sm:px-8">{children}</main>
    </div>
  );
}
