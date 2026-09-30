import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { cn } from '../../lib/cn';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: '🏠' },
  { to: '/profile', label: 'Profile', icon: '👤' },
  { to: '/projects', label: 'My Projects', icon: '📁' },
  { to: '/tasks', label: 'Tasks', icon: '📋' },
  { to: '/ai-planner', label: 'AI Planner', icon: '🤖' },
  { to: '/ai-mentor', label: 'AI Workspace', icon: '💬' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
];

function SidebarLink({ item }) {
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard'}
      className={({ isActive }) =>
        cn(
          'group flex w-full items-center justify-center rounded-xl px-3 py-3 text-sm font-medium transition-all duration-200 md:justify-start md:gap-3',
          isActive
            ? 'bg-brand-500/15 text-white'
            : 'text-slate-300 hover:bg-white/5 hover:text-white',
        )
      }
    >
      <span className="text-xl leading-none">{item.icon}</span>
      <span className="hidden lg:inline">{item.label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const navigate = useNavigate();
  const { logout, studentName } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col bg-gradient-to-b from-slate-900 to-slate-950 text-white md:w-20 lg:w-64">
      <button
        type="button"
        onClick={() => navigate('/dashboard')}
        className="flex cursor-pointer items-center justify-center gap-2 px-3 py-6 text-base font-extrabold tracking-tight lg:justify-start lg:px-5 lg:text-lg"
      >
        <span className="text-xl">🎓</span>
        <span className="hidden lg:inline">AI Tracker</span>
      </button>

      <nav className="flex flex-1 flex-col gap-1.5 px-2.5 lg:px-3">
        {NAV_ITEMS.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
      </nav>

      <div className="flex flex-col gap-1.5 px-2.5 pb-4 lg:px-3">
        <SidebarLink
          item={{ to: '/settings', label: 'Settings', icon: '⚙️' }}
        />
        <button
          type="button"
          onClick={handleLogout}
          title="Logout"
          className="flex w-full cursor-pointer items-center justify-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-300 transition-all duration-200 hover:bg-red-500/10 hover:text-red-200 md:justify-start"
        >
          <span className="text-xl leading-none">🚪</span>
          <span className="hidden lg:inline">Logout</span>
        </button>
        <p className="hidden truncate px-2 text-xs text-slate-500 lg:block">{studentName}</p>
      </div>
    </aside>
  );
}