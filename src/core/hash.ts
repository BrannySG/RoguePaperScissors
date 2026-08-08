/** Key-sorted JSON so a hash never depends on property insertion order. */
function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;

  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, v]) => `${JSON.stringify(key)}:${stable(v)}`);

  return `{${entries.join(',')}}`;
}

/**
 * Stored alongside recorded Fights each Round. A replay that diverges from its
 * recording pinpoints the exact Round determinism broke, which is the only
 * practical way to catch an accidental `Date.now()` added months later.
 */
export function hashState(value: unknown): string {
  const text = stable(value);

  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
}
