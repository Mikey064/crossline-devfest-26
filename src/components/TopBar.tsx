import { User } from 'firebase/auth';

export type AppView = 'play' | 'matches' | 'how-it-works';

interface TopBarProps {
  user: User | null;
  activeView: AppView;
  onSelectView: (view: AppView) => void;
  onSignIn: () => void;
  onSignOut: () => void;
  authBusy: boolean;
}

export function TopBar({
  user,
  activeView,
  onSelectView,
  onSignIn,
  onSignOut,
  authBusy,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onSelectView('play')}
          className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          Crossline
        </button>

        <nav className="flex items-center gap-6 text-sm font-medium" aria-label="Primary">
          <button
            type="button"
            onClick={() => onSelectView('play')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
              activeView === 'play'
                ? 'text-slate-900 border-slate-900'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            Play Match
          </button>
          <button
            type="button"
            onClick={() => onSelectView('matches')}
            className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
              activeView === 'matches'
                ? 'text-slate-900 border-slate-900'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            My Matches
          </button>
          <button
            type="button"
            onClick={() => onSelectView('how-it-works')}
            className={`hidden sm:inline-block py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
              activeView === 'how-it-works'
                ? 'text-slate-900 border-slate-900'
                : 'text-slate-500 border-transparent hover:text-slate-900'
            }`}
          >
            How It Works
          </button>
        </nav>

        <div className="flex items-center shrink-0">
          {user ? (
            <button
              type="button"
              onClick={onSignOut}
              disabled={authBusy}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              Sign Out
            </button>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              disabled={authBusy}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
            >
              {authBusy ? 'Signing In...' : 'Sign in with Google'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
