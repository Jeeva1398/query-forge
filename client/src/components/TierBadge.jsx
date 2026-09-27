// "gemini-3.5-flash-lite" -> "3.5 Flash-Lite"
function shortName(model) {
  return model
    .replace(/^gemini-/, '')
    .replace(/-flash-lite$/, ' Flash-Lite')
    .replace(/-flash$/, ' Flash');
}

export default function TierBadge({ meta }) {
  if (!meta) return null;
  const parts = [shortName(meta.model)];
  if (meta.cached) parts.push('cached');
  const title = [
    `Model: ${meta.model}`,
    `Complexity score: ${meta.score}`,
    meta.downgraded && 'Flash was busy or out of quota, so Flash-Lite answered',
    meta.escalated &&
      'The first answer was malformed, retried on a stronger model',
    !meta.cached && `${(meta.ms / 1000).toFixed(1)} s`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <span className={`badge badge-${meta.tier}`} title={title}>
      {meta.tier === 'flash' && '⚡ '}
      {parts.join(' · ')}
      {meta.downgraded && ' (fallback)'}
    </span>
  );
}
