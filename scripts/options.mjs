import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
export function options(extra = {}) {
  const { values } = parseArgs({ options: { data: { type: 'string', default: 'data/releases.json' }, out: { type: 'string', default: 'dist' }, ...extra }, strict: true });
  return { ...values, data: resolve(values.data), out: resolve(values.out) };
}
