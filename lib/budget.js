function toDate(input) {
  return new Date(`${input}T00:00:00Z`);
}

function formatMonth(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function formatBiweeklyKey(date) {
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const daysSinceYearStart = Math.floor((date.getTime() - yearStart.getTime()) / 86400000);
  const periodIndex = Math.floor(daysSinceYearStart / 14) + 1;
  return `${date.getUTCFullYear()}-BW${String(periodIndex).padStart(2, '0')}`;
}

function getPeriodKey(dateInput, granularity) {
  const date = toDate(dateInput);
  return granularity === 'biweekly' ? formatBiweeklyKey(date) : formatMonth(date);
}

function summarize(paychecks, allocations, granularity = 'monthly') {
  const result = {};

  for (const paycheck of paychecks) {
    const key = getPeriodKey(paycheck.date, granularity);
    if (!result[key]) {
      result[key] = {
        income: 0,
        allocationTotal: 0,
        byType: { investment: 0, savings: 0, spending: 0 },
        byAccount: {}
      };
    }
    result[key].income += Number(paycheck.amount) || 0;
  }

  for (const allocation of allocations) {
    const key = getPeriodKey(allocation.date, granularity);
    if (!result[key]) {
      result[key] = {
        income: 0,
        allocationTotal: 0,
        byType: { investment: 0, savings: 0, spending: 0 },
        byAccount: {}
      };
    }
    const amount = Number(allocation.amount) || 0;
    const type = allocation.type || 'spending';
    const account = allocation.account || 'Unspecified';

    result[key].allocationTotal += amount;
    if (!(type in result[key].byType)) {
      result[key].byType[type] = 0;
    }
    result[key].byType[type] += amount;
    if (!(account in result[key].byAccount)) {
      result[key].byAccount[account] = 0;
    }
    result[key].byAccount[account] += amount;
  }

  return Object.entries(result)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, values]) => ({
      period,
      income: Number(values.income.toFixed(2)),
      allocationTotal: Number(values.allocationTotal.toFixed(2)),
      remaining: Number((values.income - values.allocationTotal).toFixed(2)),
      byType: values.byType,
      byAccount: values.byAccount
    }));
}

module.exports = {
  summarize,
  getPeriodKey
};
