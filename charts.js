/**
 * chart.js — Live Telemetry Chart
 *
 * Maintains a rolling 30-point line chart showing
 * Temperature, Humidity, and Soil Moisture over time.
 *
 * Uses Chart.js (loaded via CDN in index.html).
 */

const CHART_MAX_POINTS = 30;

const chartData = {
  labels:      [],
  temperature: [],
  humidity:    [],
  soil:        []
};

let telemetryChart = null;

function initChart() {
  const ctx = document.getElementById("telemetryChart").getContext("2d");

  telemetryChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: "Temp °C",
          data: chartData.temperature,
          borderColor: "#ef4444",
          backgroundColor: "rgba(239,68,68,0.08)",
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          fill: true
        },
        {
          label: "Humidity %",
          data: chartData.humidity,
          borderColor: "#38bdf8",
          backgroundColor: "rgba(56,189,248,0.08)",
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          fill: true
        },
        {
          label: "Soil %",
          data: chartData.soil,
          borderColor: "#4ade80",
          backgroundColor: "rgba(74,222,128,0.08)",
          tension: 0.4,
          pointRadius: 0,
          borderWidth: 2,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "top",
          labels: {
            color: "#94a3b8",
            boxWidth: 10,
            font: { size: 10, family: "'Space Grotesk', sans-serif" }
          }
        },
        tooltip: {
          backgroundColor: "#1e293b",
          borderColor: "#334155",
          borderWidth: 1,
          titleColor: "#f1f5f9",
          bodyColor: "#94a3b8",
          titleFont: { family: "'Space Grotesk', sans-serif" },
          bodyFont:  { family: "'JetBrains Mono', monospace" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#475569", font: { size: 9 }, maxTicksLimit: 6 },
          grid:  { color: "rgba(51,65,85,0.5)" }
        },
        y: {
          min: 0,
          max: 100,
          ticks: { color: "#475569", font: { size: 9 } },
          grid:  { color: "rgba(51,65,85,0.5)" }
        }
      }
    }
  });
}

/**
 * Push a new reading into the rolling chart buffer.
 * Trims oldest point when buffer exceeds CHART_MAX_POINTS.
 */
function pushChartData(temperature, humidity, soil) {
  const label = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  chartData.labels.push(label);
  chartData.temperature.push(temperature);
  chartData.humidity.push(humidity);
  chartData.soil.push(soil);

  if (chartData.labels.length > CHART_MAX_POINTS) {
    chartData.labels.shift();
    chartData.temperature.shift();
    chartData.humidity.shift();
    chartData.soil.shift();
  }

  telemetryChart.update("none"); // no animation for live performance
}
