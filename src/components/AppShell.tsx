import { NavLink, Outlet } from 'react-router-dom';
import { isClientIdConfigured } from '../lib/spotify/client';
import { beginLogin } from '../lib/spotify/pkce';
import { useUiStore } from '../store/uiStore';
import { cn } from '../utils/cn';
import { GearIcon, HomeIcon, SearchIcon, UserIcon, XIcon } from './Icons';
import { NowDiggingBar } from './NowDiggingBar';
import { ToastHost } from './Toast';

const TABS = [
  { to: '/', label: '홈', icon: HomeIcon },
  { to: '/search', label: '검색', icon: SearchIcon },
  { to: '/profile', label: '프로필', icon: UserIcon },
  { to: '/settings', label: '설정', icon: GearIcon },
] as const;

function AuthBanner() {
  const authNotice = useUiStore((s) => s.authNotice);
  const setAuthNotice = useUiStore((s) => s.setAuthNotice);
  if (!authNotice) return null;
  return (
    <div className="glass-bar fade-in fixed inset-x-3 top-3 z-50 flex items-start gap-3 rounded-[20px] p-3 lg:left-[15rem] lg:right-4">
      <p className="min-w-0 flex-1 text-sm font-medium text-ink/75">{authNotice}</p>
      {isClientIdConfigured() && (
        <button
          type="button"
          className="shrink-0 rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-white transition-transform active:scale-95"
          onClick={() => void beginLogin()}
        >
          Spotify 재연결
        </button>
      )}
      <button
        type="button"
        aria-label="닫기"
        className="shrink-0 pt-0.5 text-ink/35 hover:text-ink/70"
        onClick={() => setAuthNotice(null)}
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-ink/[0.07] bg-white/50 p-4 backdrop-blur-xl lg:flex">
      <div className="mb-8 px-2 pt-2">
        <p className="text-xl font-bold">Spottied</p>
        <p className="text-xs text-ink/40">디스코그래피 디깅 트래커</p>
      </div>
      <nav className="space-y-1">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition-colors',
                isActive
                  ? 'glass text-ink'
                  : 'text-ink/45 hover:bg-white/50 hover:text-ink/80',
              )
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

function TabBar() {
  return (
    <nav className="glass-bar fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-30 rounded-[26px] lg:hidden">
      <div className="flex h-16">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold transition-colors',
                isActive ? 'text-ink' : 'text-ink/35',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                    isActive && 'bg-ink/[0.07] shadow-[inset_0_1px_2px_rgba(16,18,27,0.06)]',
                  )}
                >
                  <Icon size={20} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function AppShell() {
  return (
    <div className="min-h-screen lg:pl-56">
      <Sidebar />
      <main className="mx-auto max-w-3xl px-4 pb-48 pt-4 lg:pb-32">
        <Outlet />
      </main>
      <NowDiggingBar />
      <TabBar />
      <ToastHost />
      <AuthBanner />
    </div>
  );
}
