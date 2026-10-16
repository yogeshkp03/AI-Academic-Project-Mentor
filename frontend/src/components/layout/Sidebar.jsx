import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  Compass,
  FolderKanban,
  GraduationCap,
  Handshake,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { BrandMark } from '../Brand';
import { Avatar, Tooltip } from '../ui';
import { cn } from '../../lib/cn';

/* ==========================================================================
   Navigation — the product's information architecture, in the user's language.
   ========================================================================== */
const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/projects', label: 'Projects', icon: FolderKanban },
      { to: '/tasks', label: 'Milestones', icon: ListChecks },
      { to: '/mentorship', label: 'Find a mentor', icon: Handshake },
    ],
  },
  {
    label: 'AI studio',
    items: [
      { to: '/ai-mentor', label: 'AI Workspace', icon: Sparkles },
      { to: '/ai-planner', label: 'New analysis', icon: Compass },
      { to: '/skill-assessment', label: 'Skill check', icon: GraduationCap },
    ],
  },
  {
    label: 'Insight',
    items: [
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ],
  },
];

const FOOTER_ITEMS = [
  { to: '/profile', label: 'Profile', icon: UserRound },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function SidebarLink({ item, collapsed }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === '/dashboard'}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium no-underline transition-colors duration-150',
          collapsed && 'justify-center px-0',
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-ink-soft hover:bg-subtle hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={17}
            strokeWidth={isActive ? 2.2 : 1.85}
            className={cn('shrink-0 transition-colors', isActive ? 'text-brand-600' : 'text-ink-faint group-hover:text-ink-soft')}
            aria-hidden="true"
          />
          {!collapsed && <span className="truncate">{item.label}</span>}
          {!collapsed && isActive && (
            <span className="absolute top-1.5 bottom-1.5 -left-2.5 w-[3px] rounded-full bg-brand-600" />
          )}
        </>
      )}
    </NavLink>
  );
}

export function Sidebar({ studentName, onLogout, collapsed = false }) {
  return (
    <aside
      data-print-hide
      className={cn(
        'sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-line bg-surface/80 backdrop-blur-sm transition-[width] duration-300',
        collapsed ? 'w-[68px]' : 'w-60',
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          'flex h-16 shrink-0 items-center gap-2.5 border-b border-line px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        <NavLink to="/dashboard" className="no-underline">
          {collapsed ? (
            <BrandMark size={30} />
          ) : (
            <span className="flex items-center gap-2.5">
              <BrandMark size={30} />
              <span className="font-display text-[15px] font-semibold tracking-tight text-ink">
                Project&nbsp;Mentor
              </span>
            </span>
          )}
        </NavLink>
      </div>

      {/* Nav */}
      <nav className="nice-scroll flex-1 overflow-y-auto px-3.5 py-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {!collapsed && <p className="eyebrow mb-2 px-1">{group.label}</p>}
            {collapsed && <div className="rule-fade mb-3" />}
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <SidebarLink key={item.to} item={item} collapsed={collapsed} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-line px-3.5 py-3">
        <div className="flex flex-col gap-0.5">
          {FOOTER_ITEMS.map((item) => (
            <SidebarLink key={item.to} item={item} collapsed={collapsed} />
          ))}
        </div>
        {!collapsed ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-[10px] bg-subtle px-2.5 py-2">
            <Avatar name={studentName || ''} size={30} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-ink">{studentName || 'Student'}</p>
              <p className="text-[11px] text-ink-muted">Student account</p>
            </div>
            <Tooltip label="Log out">
              <button
                type="button"
                onClick={onLogout}
                className="cursor-pointer rounded-md p-1.5 text-ink-faint transition-colors hover:bg-danger-50 hover:text-danger-600"
                aria-label="Log out"
              >
                <LogOut size={15} aria-hidden="true" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <Tooltip label="Log out" side="right">
            <button
              type="button"
              onClick={onLogout}
              className="mt-2 grid w-full cursor-pointer place-items-center rounded-[10px] p-1.5 text-ink-faint transition-colors hover:bg-danger-50 hover:text-danger-600"
              aria-label="Log out"
            >
              <LogOut size={16} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
