const toHex = (bytes) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');

export function formatCell(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    if (isNaN(value)) return String(value);
    return value.toISOString().replace('T00:00:00.000Z', '');
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Uint8Array) return '\\x' + toHex(value);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
