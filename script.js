let originalData = [];
let filteredData = [];
let charts = {};

document.getElementById('csvUpload').addEventListener('change', function(e) {
  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.disabled = !e.target.files.length;
});

document.getElementById('uploadBtn').addEventListener('click', function() {
  const fileInput = document.getElementById('csvUpload');
  const file = fileInput.files[0];

  document.getElementById('loading').style.display = 'block';
  
  Papa.parse(file, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: function(results) {
      setTimeout(() => {
        try {
          processData(results.data);
          document.getElementById('loading').style.display = 'none';
          document.getElementById('dashboard').classList.remove('hidden');
        } catch (error) {
          console.error('Error processing data:', error);
          alert('Check your CSV format.');
          document.getElementById('loading').style.display = 'none';
        }
      }, 1000);
    }
  });
});

function parseDate(dateString) {
  if (!dateString) return null;
  const dateStr = dateString.toString().trim();
  const ddmmyyyy = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) return new Date(ddmmyyyy[3], ddmmyyyy[2]-1, ddmmyyyy[1]);
  const yyyymmdd = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) return new Date(yyyymmdd[1], yyyymmdd[2]-1, yyyymmdd[3]);
  const fallbackDate = new Date(dateStr);
  return isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

function processData(data) {
  let runningBalance = 0;
  originalData = [];
  data.forEach((row) => {
    const parsedDate = parseDate(row.Date);
    if (!parsedDate) return;
    const income = parseFloat(row.Income) || 0;
    const expense = parseFloat(row.Expense) || 0;
    const dailyNet = income - expense;
    runningBalance += dailyNet;
    originalData.push({
      Date: row.Date,
      Income: income,
      Expense: expense,
      Balance: runningBalance,
      DailyNet: dailyNet,
      ParsedDate: parsedDate
    });
  });

  if (!originalData.length) {
    alert('No valid data for date');
    return;
  }
  originalData.sort((a, b) => a.ParsedDate - b.ParsedDate);
  runningBalance = 0;
  originalData.forEach(row => {
    runningBalance += row.DailyNet;
    row.Balance = runningBalance;
  });
  setupDateFilters();
  filteredData = [...originalData];
  renderDashboard();
  getAiAdvice();
}

function setupDateFilters() {
  if (!originalData.length) return;
  const dates = originalData.map(row => row.ParsedDate);
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));
  document.getElementById('startDate').value = minDate.toISOString().split('T')[0];
  document.getElementById('endDate').value = maxDate.toISOString().split('T')[0];
}

function applyDateFilter() {
  const startDate = new Date(document.getElementById('startDate').value);
  const endDate = new Date(document.getElementById('endDate').value);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    alert('Please select valid dates');
    return;
  }
  filteredData = originalData.filter(row => row.ParsedDate >= startDate && row.ParsedDate <= endDate);
  if (!filteredData.length) {
    alert('No data between that dates');
    return;
  }
  renderDashboard();
}

function resetFilter() {
  filteredData = [...originalData];
  setupDateFilters();
  renderDashboard();
}

function renderDashboard() {
  if (!filteredData.length) return;
  const totalIncome = filteredData.reduce((sum, row) => sum + row.Income, 0);
  const totalExpense = filteredData.reduce((sum, row) => sum + row.Expense, 0);
  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100) : 0;

  document.getElementById('totalIncome').textContent = `₹${totalIncome.toLocaleString('en-IN')}`;
  document.getElementById('totalExpense').textContent = `₹${totalExpense.toLocaleString('en-IN')}`;
  document.getElementById('netBalance').textContent = `₹${netBalance.toLocaleString('en-IN')}`;
  document.getElementById('savingsRate').textContent = `${savingsRate.toFixed(1)}%`;

  const balanceElement = document.getElementById('netBalance');
  balanceElement.className = netBalance >= 0 ? 'stat-value positive' : 'stat-value negative';

  if (netBalance >= 0 && savingsRate > 20) {
    showToast("AMAZINGG You're saving well keep going ☺️☺️☺️☺️", "success");
  } else if (netBalance >= 0) {
    showToast("Nice! Not bad! You could do better", "success");
  } else {
    showToast("☹️ You're spending more than what you are earning", "error");
  }

  createBarChart();
  createLineChart();
  createDailyChart();
  populateTable();
}

function createBarChart() {
  const ctx = document.getElementById('barChart').getContext('2d');
  if (charts.bar) charts.bar.destroy();
  const recentData = filteredData.slice(-10);
  charts.bar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: recentData.map(r => r.ParsedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets: [
        { label: 'Income', data: recentData.map(r => r.Income), backgroundColor: '#10b981', borderRadius: 2, maxBarThickness: 40 },
        { label: 'Expenses', data: recentData.map(r => r.Expense), backgroundColor: '#ef4444', borderRadius: 2, maxBarThickness: 40 }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function createLineChart() {
  const ctx = document.getElementById('lineChart').getContext('2d');
  if (charts.line) charts.line.destroy();
  let runningBalance = 0;
  const balanceData = filteredData.map(row => (runningBalance += row.DailyNet));
  charts.line = new Chart(ctx, {
    type: 'line',
    data: {
      labels: filteredData.map(r => r.ParsedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets: [{ label: 'Balance', data: balanceData, borderColor: '#3b82f6', fill: true }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function createDailyChart() {
  const ctx = document.getElementById('dailyChart').getContext('2d');
  if (charts.daily) charts.daily.destroy();
  const recentData = filteredData.slice(-15);
  charts.daily = new Chart(ctx, {
    type: 'line',
    data: {
      labels: recentData.map(r => r.ParsedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets: [{ label: 'Daily Net', data: recentData.map(r => r.DailyNet), borderColor: '#8b5cf6', fill: true }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function populateTable() {
  const tbody = document.querySelector('#dataTable tbody');
  tbody.innerHTML = '';
  const recentData = filteredData.slice(-15).reverse();
  recentData.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.ParsedDate.toLocaleDateString('en-IN')}</td>
      <td style="color:${row.Income>0?'#10b981':'#64748b'};">₹${row.Income.toLocaleString('en-IN')}</td>
      <td style="color:${row.Expense>0?'#ef4444':'#64748b'};">₹${row.Expense.toLocaleString('en-IN')}</td>
      <td style="color:${row.DailyNet>=0?'#10b981':'#ef4444'};">₹${row.DailyNet.toLocaleString('en-IN')}</td>
      <td style="color:${row.Balance>=0?'#10b981':'#ef4444'};">₹${row.Balance.toLocaleString('en-IN')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function showToast(message, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  const icon = type === "success" ? "😀" : "☹️";
  toast.innerHTML = `${icon} ${message}`;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 40000);
  }, 4000);
}

function markdownToHTML(text) {
    let html = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^\s*\*\s+(.*)$/gm, '<li>$1</li>');
    if (html.includes('<li>')) {
        html = '<ul>' + html + '</ul>';
    }
    html = html.replace(/(?<!<\/li>)\n/g, '<br>');
    return html;
}

async function getAiAdvice() {
    if (!filteredData.length) return;

    const totalIncome = filteredData.reduce((sum, r) => sum + r.Income, 0);
    const totalExpense = filteredData.reduce((sum, r) => sum + r.Expense, 0);
    const net = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((net / totalIncome) * 100).toFixed(1) : 0;

    const prompt = `
Here is my complete financial data:
Income: ₹${totalIncome.toLocaleString('en-IN')}
Expenses: ₹${totalExpense.toLocaleString('en-IN')}
Net Balance: ₹${net.toLocaleString('en-IN')}
Savings Rate: ${savingsRate}%
Please give elaborative, useful, and actionable advice in simple language. Also, focus only on useful insights based on their data.
`;

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer API key"
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: "You are a very helpful financial advisor. Keep your reply elaborative and real. Keep it under 500 Tokens, No need to thank the user. Tell them where they should invest and what they should do better. First tell user income, expense and balance then explain the details."},
                    { role: "user", content: prompt }
                ],
                max_tokens: 500,
                temperature: 0.7
            })
        });

        const data = await response.json();
        const advice = data.choices?.[0]?.message?.content || "Could not fetch the data";
        document.getElementById("aiAdviceContent").innerHTML = `<strong>AI says:</strong> ${markdownToHTML(advice)}`;
    } catch (err) {
        console.error(err);
        document.getElementById("aiAdviceContent").innerHTML = `<span style="color:#f85149;">Error fetching advice. Try again.</span>`;
    }
}
