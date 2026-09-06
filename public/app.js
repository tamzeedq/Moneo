let incomeChart;
let allocationChart;

const paycheckForm = document.getElementById('paycheck-form');
const allocationForm = document.getElementById('allocation-form');
const paycheckSelect = document.getElementById('paycheck-select');
const granularitySelect = document.getElementById('granularity');
const summaryTable = document.getElementById('summary-table');

function currency(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }
  return payload;
}

async function refreshPaycheckOptions() {
  const { paychecks } = await api('/api/data');
  paycheckSelect.innerHTML = '<option value="">Not linked</option>';
  for (const paycheck of paychecks.sort((a, b) => a.date.localeCompare(b.date))) {
    const option = document.createElement('option');
    option.value = paycheck.id;
    option.textContent = `${paycheck.date} • ${currency(paycheck.amount)}`;
    paycheckSelect.appendChild(option);
  }
}

function renderTable(summary) {
  summaryTable.innerHTML = '';
  for (const row of summary) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.period}</td><td>${currency(row.income)}</td><td>${currency(row.allocationTotal)}</td><td>${currency(row.remaining)}</td>`;
    summaryTable.appendChild(tr);
  }
}

function renderCharts(summary) {
  const labels = summary.map((row) => row.period);
  const incomes = summary.map((row) => row.income);
  const allocations = summary.map((row) => row.allocationTotal);

  if (incomeChart) incomeChart.destroy();
  if (allocationChart) allocationChart.destroy();

  incomeChart = new Chart(document.getElementById('income-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Income', data: incomes, borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,.2)', tension: 0.2 },
        { label: 'Allocated', data: allocations, borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.2)', tension: 0.2 }
      ]
    }
  });

  const spending = summary.map((row) => row.byType.spending || 0);
  const savings = summary.map((row) => row.byType.savings || 0);
  const investment = summary.map((row) => row.byType.investment || 0);

  allocationChart = new Chart(document.getElementById('allocation-chart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Spending', data: spending, backgroundColor: '#ef4444' },
        { label: 'Savings', data: savings, backgroundColor: '#10b981' },
        { label: 'Investment', data: investment, backgroundColor: '#8b5cf6' }
      ]
    }
  });
}

async function refreshSummary() {
  const granularity = granularitySelect.value;
  const { summary } = await api(`/api/summary?granularity=${granularity}`);
  renderTable(summary);
  renderCharts(summary);
}

paycheckForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(paycheckForm);
  try {
    await api('/api/paychecks', {
      method: 'POST',
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    paycheckForm.reset();
    await refreshPaycheckOptions();
    await refreshSummary();
  } catch (error) {
    alert(error.message);
  }
});

allocationForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(allocationForm);
  const payload = Object.fromEntries(formData.entries());
  if (!payload.paycheckId) delete payload.paycheckId;

  try {
    await api('/api/allocations', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    allocationForm.reset();
    await refreshSummary();
  } catch (error) {
    alert(error.message);
  }
});

granularitySelect.addEventListener('change', refreshSummary);

(async function init() {
  await refreshPaycheckOptions();
  await refreshSummary();
})();
