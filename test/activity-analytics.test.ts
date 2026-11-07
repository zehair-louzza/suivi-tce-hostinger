import assert from 'node:assert/strict';
import { aggregate, cumulative, isoWeek, normalize, total } from '../client/src/activity/analytics';
import type { ActivityDay } from '../client/src/activity/types';

const day = (date: string, v: number | null): ActivityDay => ({
  date,
  invoiced: v,
  performed: v,
  quoted: v,
  accepted: v,
  interventions: v === null ? null : 1,
  quotes: v === null ? null : 1,
});

assert.deepEqual(isoWeek('2021-01-01'), { year: 2020, week: 53 });
assert.equal(total([day('2026-11-02', 100), day('2026-11-03', 200)], 'invoiced'), 300);
assert.equal(normalize([day('2026-11-02', 0), day('2026-11-04', 100)])[1].invoiced, null);
assert.throws(() => normalize([day('2026-11-02', 0), day('2026-11-02', 0)]));
const rows = normalize([day('2026-11-02', 100), day('2026-11-03', 200), day('2026-11-04', 300)]);
const weekly = aggregate(rows, 'week');
assert.equal(weekly.length, 1);
assert.equal(weekly[0].invoiced, 600);
assert.equal(cumulative(aggregate(rows, 'day'))[2].invoiced, total(rows, 'invoiced'));
assert.equal(aggregate([day('2026-11-02', 100), day('2026-11-03', null)], 'week')[0].invoiced, null);
assert.equal(cumulative(aggregate([day('2026-11-02', 100), day('2026-11-03', null), day('2026-11-04', 100)], 'day'))[2].invoiced, null);
assert.equal(total([day('2026-11-02', 0)], 'invoiced'), 0);
assert.throws(() => total([day('2026-11-02', Number.MAX_SAFE_INTEGER), day('2026-11-03', 1)], 'invoiced'));

console.log('Tests analytics terminés avec succès');
