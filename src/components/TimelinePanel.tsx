import { useState } from 'react';
import { Eye, History, RotateCcw } from 'lucide-react';
import {
  CELL_LABELS,
  EventAuditEntry,
  GameStatus,
  TurnSnapshot,
} from '../lib/gameEngine';

interface TimelinePanelProps {
  gameStatus: GameStatus;
  turnHistory: TurnSnapshot[];
  auditLog: EventAuditEntry[];
  previewTurnNumber: number | null;
  isMutating: boolean;
  onSelectTurnPreview: (turnNumber: number | null) => void;
  onRestoreToTurn: (turnNumber: number) => void;
}

export function TimelinePanel({
  gameStatus,
  turnHistory,
  auditLog,
  previewTurnNumber,
  isMutating,
  onSelectTurnPreview,
  onRestoreToTurn,
}: TimelinePanelProps) {
  const [tab, setTab] = useState<'turns' | 'events'>('turns');
  const currentTurnNumber = turnHistory.length - 1;

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            Turn History &amp; Events
          </h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {currentTurnNumber} active {currentTurnNumber === 1 ? 'turn' : 'turns'} · {auditLog.length} stored {auditLog.length === 1 ? 'event' : 'events'}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setTab('turns')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'turns'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Turns
          </button>
          <button
            type="button"
            onClick={() => setTab('events')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              tab === 'events'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Event Log
          </button>
        </div>
      </div>

      {tab === 'turns' ? (
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[480px] pr-1">
          {turnHistory.map((snapshot) => {
            const isLatest = snapshot.turnNumber === currentTurnNumber;
            const isSelected =
              previewTurnNumber !== null
                ? previewTurnNumber === snapshot.turnNumber
                : isLatest;

            return (
              <div
                key={snapshot.turnNumber}
                className={`p-3 rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-300 bg-blue-50/40'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      onSelectTurnPreview(isLatest ? null : snapshot.turnNumber)
                    }
                    className="flex-1 text-left min-w-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        Turn {String(snapshot.turnNumber).padStart(2, '0')}
                      </span>
                      <span aria-hidden="true">·</span>
                      {snapshot.turnNumber === 0 ? (
                        <span>Initial empty board</span>
                      ) : (
                        <span className="truncate">
                          <span
                            className={`font-semibold ${
                              snapshot.lastMoveSymbol === 'X'
                                ? 'text-blue-600'
                                : 'text-rose-600'
                            }`}
                          >
                            {snapshot.lastMoveSymbol}
                          </span>{' '}
                          to{' '}
                          <span className="font-mono text-slate-800">
                            {snapshot.lastMoveCell !== null
                              ? CELL_LABELS[snapshot.lastMoveCell]
                              : ''}
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 truncate">
                      {snapshot.turnNumber === 0
                        ? 'X opens first'
                        : `${snapshot.actorName || 'Player'} · ${
                            snapshot.winner
                              ? snapshot.winner === 'DRAW'
                                ? 'Draw reached'
                                : `${snapshot.winner} won`
                              : `Next: ${snapshot.nextTurn}`
                          }`}
                    </p>
                  </button>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isLatest && (
                      <button
                        type="button"
                        onClick={() => onSelectTurnPreview(snapshot.turnNumber)}
                        title={`Preview Turn ${snapshot.turnNumber}`}
                        className="p-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {!isLatest && gameStatus === 'ACTIVE' && (
                      <button
                        type="button"
                        disabled={isMutating}
                        onClick={() => onRestoreToTurn(snapshot.turnNumber)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-800 bg-white border border-slate-200 rounded-md hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Restore
                      </button>
                    )}

                    {isLatest && (
                      <span className="text-xs font-medium text-emerald-700 px-2">
                        Live
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 space-y-2 overflow-y-auto max-h-[480px] pr-1">
          {auditLog.length === 0 ? (
            <div className="py-10 text-center">
              <History className="w-6 h-6 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-700">No events recorded yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Every move and rollback is appended as an immutable Firestore event document.
              </p>
            </div>
          ) : (
            [...auditLog].reverse().map((entry) => {
              const { event } = entry;
              return (
                <div
                  key={event.id}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/40"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 font-mono text-slate-700">
                      <span className="font-semibold">#{event.seq}</span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={
                          event.type === 'ROLLBACK'
                            ? 'text-amber-700 font-semibold'
                            : 'text-slate-800 font-semibold'
                        }
                      >
                        {event.type}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                      doc/{event.id}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 mt-1.5">
                    {event.type === 'MOVE' ? (
                      <>
                        <span className="font-medium">{event.actorName}</span> placed{' '}
                        <span
                          className={`font-semibold ${
                            event.symbol === 'X' ? 'text-blue-600' : 'text-rose-600'
                          }`}
                        >
                          {event.symbol}
                        </span>{' '}
                        at{' '}
                        <span className="font-mono font-medium">
                          {CELL_LABELS[event.cell] || event.cell}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium">{event.actorName}</span> restored state to{' '}
                        <span className="font-mono font-medium">
                          Turn {event.targetTurn}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    Replayed Turn: {entry.resultingTurn} ·{' '}
                    {new Date(event.createdAtMs).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </p>
                </div>
              );
            })
          )}
        </div>
      )}
    </aside>
  );
}
