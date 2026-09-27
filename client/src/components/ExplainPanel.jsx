import { useState } from 'react';
import TierBadge from './TierBadge.jsx';

export default function ExplainPanel({ explain, onClose }) {
  const [tab, setTab] = useState('steps');
  const { ai, aiError, plan, planError, loading } = explain;

  return (
    <section className="panel explain">
      <div className="explain-head">
        <div className="tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'steps'}
            className={tab === 'steps' ? 'tab active' : 'tab'}
            onClick={() => setTab('steps')}
          >
            Step by step
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'plan'}
            className={tab === 'plan' ? 'tab active' : 'tab'}
            onClick={() => setTab('plan')}
          >
            Query plan
          </button>
        </div>
        <div className="explain-actions">
          {tab === 'steps' && ai && <TierBadge meta={ai.meta} />}
          <button type="button" className="link" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      {tab === 'steps' && (
        <div className="explain-body">
          {loading && !ai && !aiError && (
            <p className="muted">Explaining the query…</p>
          )}
          {aiError && <div className="error">{aiError.message}</div>}
          {ai && (
            <>
              <ol className="steps">
                {ai.data.steps.map((s, i) => (
                  <li key={i}>
                    <code>{s.part}</code>
                    <p>{s.explanation}</p>
                  </li>
                ))}
              </ol>
              {ai.data.complexityNotes && (
                <p className="muted notes">{ai.data.complexityNotes}</p>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'plan' && (
        <div className="explain-body">
          {planError && <div className="error">{planError.message}</div>}
          {plan && <pre className="plan">{plan}</pre>}
          {!plan && !planError && <p className="muted">Loading plan…</p>}
          <p className="muted">
            From Postgres <code>EXPLAIN ANALYZE</code> (plain{' '}
            <code>EXPLAIN</code> for queries that change data).
          </p>
        </div>
      )}
    </section>
  );
}
