import { NavLink, Outlet } from 'react-router-dom';
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

function ReconnectBanner() {
  const needsReconnect = useUiStore((s) => s.needsReconnect);
  const setNeedsReconnect = useUiStore((s) => s.setNeedsReconnect);
  if (!needsReconnect) return null;
  return (
    <div className="glass fade-in fixed inset-x-3 top-3 z-50 flex items-center gap-3 rounded-2xl p-3 lg:left-[15rem] lg:right-4">
      <p className="min-w-0 flex-1 text-sm text-white/80">
        Spotify 연결이 만료되었어요
      </p>
      <button
        type="button"
        className="shrink-0 rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black"
        onClick={() => void beginLogin()}
      >
        Spotify 재연결
      </button>
      <button
        type="button"
        aria-label="닫기"
        className="shrink-0 text-white/40 hover:text-white/80"
        onClick={() => setNeedsReconnect(false)}
      >
        <XIcon size={16} />
      </button>
    </div>
  );
}

function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-white/5 bg-elev/50 p-4 lg:flex">
      <div className="mb-8 px-2 pt-2">
        <p className="text-xl font-bold">Spottied</p>
        <p className="text-xs text-white/40">디스코그래피 디깅 트래커</p>
      </div>
      <nav className="space-y-1">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/10 text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80',
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
    <nav className="glass-deep safe-bottom fixed inset-x-0 bottom-0 z-30 lg:hidden">
      <div className="flex h-[3.75rem]">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                isActive ? 'text-white' : 'text-white/40',
              )
            }
          >
            <Icon size={21} />
            {label}
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
      <main className="mx-auto max-w-3xl px-4 pb-44 pt-4 lg:pb-32">
        <Outlet />
      </main>
      <NowDiggingBar />
      <TabBar />
      <ToastHost />
      <ReconnectBanner />
    </div>
  );
}
