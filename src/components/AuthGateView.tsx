import { History, Cpu, Users } from 'lucide-react';

interface AuthGateViewProps {
  pendingInviteCode: string | null;
  authBusy: boolean;
  authError: string | null;
  onSignIn: () => void;
}

export function AuthGateView({
  pendingInviteCode,
  authBusy,
  authError,
  onSignIn,
}: AuthGateViewProps) {
  return (
    <div className="max-w-4xl mx-auto py-8 sm:py-12">
      <div className="bg-white border border-slate-200 rounded-xl p-8 sm:p-12">
        {pendingInviteCode && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-950">
            You have an invite to join match{' '}
            <span className="font-mono font-semibold">{pendingInviteCode}</span>. Sign in with Google to enter the game.
          </div>
        )}

        <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 max-w-xl text-balance">
          Turn-based Tic-Tac-Toe with full time-travel history.
        </h1>
        <p className="text-base text-slate-600 mt-4 max-w-2xl leading-relaxed">
          Challenge a deterministic Minimax AI or share a 6-character invite link with a friend. Every move is stored as an event in Firestore so you can inspect any past turn and roll back the match at any time.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onSignIn}
            disabled={authBusy}
            className="px-6 py-3 text-sm font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
          >
            {authBusy ? 'Connecting Google Account...' : 'Sign in with Google'}
          </button>
          <span className="text-xs text-slate-500">
            Verified Google account required for real-time match sync
          </span>
        </div>

        {authError && (
          <p className="mt-4 text-xs font-medium text-rose-600" role="alert">
            {authError}
          </p>
        )}

        <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Cpu className="w-4 h-4 text-blue-600" />
              Minimax Opponent
            </div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Three difficulty levels powered by alpha-beta Minimax search.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Users className="w-4 h-4 text-rose-600" />
              Instant Match Codes
            </div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Send a 6-character code or direct link to play live across devices.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <History className="w-4 h-4 text-emerald-600" />
              Event-Sourced Rollback
            </div>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Browse the move log, preview prior turns, and restore board state.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
