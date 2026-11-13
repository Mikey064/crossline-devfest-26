interface ArchitectureViewProps {
  onBackToPlay: () => void;
}

export function ArchitectureView({ onBackToPlay }: ArchitectureViewProps) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl p-6 sm:p-10 max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900">
            How Crossline Works
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Event-sourced state reconstruction in Firestore paired with a deterministic Minimax opponent.
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToPlay}
          className="px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
        >
          Back to Play
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            01. Append-Only Event Log
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Board cells are never mutated directly in the match document. Each move writes an immutable event document under{' '}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              games/&#123;code&#125;/events/e_&#123;seq&#125;
            </code>{' '}
            atomically synchronized with the parent sequence counter.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            02. Deterministic Replay &amp; Rollback
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            The client reconstructs the board, active turn, and victory line by replaying the ordered stream of{' '}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">MOVE</code> and{' '}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">ROLLBACK</code> events. Restoring a prior turn appends a rollback event rather than erasing history.
          </p>
        </div>

        <div>
          <h2 className="font-display text-base font-semibold text-slate-900">
            03. Minimax AI Search
          </h2>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Single-player matches evaluate future board trees locally using alpha-beta pruned Minimax with depth-penalized terminal scores, running in milliseconds with zero LLM or external API calls.
          </p>
        </div>
      </div>
    </section>
  );
}
