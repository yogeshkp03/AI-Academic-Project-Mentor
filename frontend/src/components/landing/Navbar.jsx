import { useNavigate } from 'react-router-dom';
import { Button } from '../ui';

export function Navbar() {
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/85 px-6 backdrop-blur-xl md:px-10">
      <button
        type="button"
        onClick={() => navigate('/')}
        className="cursor-pointer text-lg font-extrabold tracking-tight text-slate-900"
      >
        🎓 AI <span className="text-brand-600">Project Tracker</span>
      </button>
      <div className="flex items-center gap-6">
        <a href="#features" className="hidden text-sm font-medium text-slate-600 transition hover:text-brand-600 sm:inline">
          Features
        </a>
        <Button size="sm" onClick={() => navigate('/login')}>
          Login
        </Button>
      </div>
    </nav>
  );
}