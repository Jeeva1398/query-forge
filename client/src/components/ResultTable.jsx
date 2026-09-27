import { formatCell } from '../lib/format.js';

function summary(result) {
  const time = `${result.ms.toFixed(1)} ms`;
  if (result.columns.length) {
    const rows = `${result.rowCount} row${result.rowCount === 1 ? '' : 's'}`;
    const note = result.truncated
      ? ` (showing first ${result.rows.length})`
      : '';
    return `${rows}${note} · ${time}`;
  }
  const affected = result.affectedRows ? ` ${result.affectedRows}` : '';
  return `${result.command || 'OK'}${affected} · ${time}`;
}

export default function ResultTable({ result, error, running }) {
  if (running) return <div className="results muted">Running…</div>;

  if (error) {
    return (
      <div className="results">
        <div className="error">
          <strong>ERROR{error.code ? ` ${error.code}` : ''}:</strong>{' '}
          {error.message}
          {error.detail && <div>Detail: {error.detail}</div>}
          {error.hint && <div>Hint: {error.hint}</div>}
          {error.position && (
            <div className="muted">at character {error.position}</div>
          )}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="results muted">Press Run or Ctrl+Enter to execute.</div>
    );
  }

  return (
    <div className="results">
      <div className="summary">{summary(result)}</div>
      {result.columns.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {result.columns.map((c, i) => (
                  <th key={i}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => {
                    const text = formatCell(cell);
                    return text === null ? (
                      <td key={c} className="null">
                        NULL
                      </td>
                    ) : (
                      <td key={c}>{text}</td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
