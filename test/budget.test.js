const test = require('node:test');
const assert = require('node:assert/strict');
const { summarize, getPeriodKey } = require('../lib/budget');

test('monthly summary aggregates income and allocations by type', () => {
  const paychecks = [
    { date: '2026-01-05', amount: 1500 },
    { date: '2026-01-20', amount: 1500 }
  ];
  const allocations = [
    { date: '2026-01-06', amount: 500, type: 'savings', account: 'HYSA' },
    { date: '2026-01-10', amount: 300, type: 'investment', account: 'Brokerage' }
  ];

  const summary = summarize(paychecks, allocations, 'monthly');
  assert.equal(summary.length, 1);
  assert.equal(summary[0].period, '2026-01');
  assert.equal(summary[0].income, 3000);
  assert.equal(summary[0].allocationTotal, 800);
  assert.equal(summary[0].remaining, 2200);
  assert.equal(summary[0].byType.savings, 500);
  assert.equal(summary[0].byType.investment, 300);
});

test('biweekly granularity changes grouping', () => {
  const keyOne = getPeriodKey('2026-01-01', 'biweekly');
  const keyTwo = getPeriodKey('2026-01-20', 'biweekly');
  assert.notEqual(keyOne, keyTwo);
});
