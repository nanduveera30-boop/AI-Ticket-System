import { Doughnut, Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement, Tooltip, Legend,
  LineElement, PointElement,
  CategoryScale, LinearScale, Filler,
} from "chart.js";

ChartJS.register(
  ArcElement, Tooltip, Legend,
  LineElement, PointElement,
  CategoryScale, LinearScale, Filler
);

const MUTED = "#8892a4";
const GRID  = "#2a2d3e";

export function DonutChart({ metrics }) {
  const data = {
    labels: ["Auto-Resolved", "Suggested", "Escalated"],
    datasets: [{
      data: [
        metrics?.auto_resolved_count ?? 0,
        metrics?.suggested_count     ?? 0,
        metrics?.escalated_count     ?? 0,
      ],
      backgroundColor: ["#22c55e", "#eab308", "#ef4444"],
      borderWidth: 0,
      hoverOffset: 6,
    }],
  };
  return (
    <div className="chart-card">
      <h2>Decision Distribution</h2>
      <Doughnut
        data={data}
        options={{
          cutout: "70%",
          plugins: { legend: { labels: { color: MUTED, font: { size: 12 } } } },
        }}
      />
    </div>
  );
}

export function ConfidenceLine({ history }) {
  const data = {
    labels: history.map((h) => `#${h.id}`),
    datasets: [{
      label: "Confidence",
      data: history.map((h) => h.conf),
      borderColor: "#3b82f6",
      backgroundColor: "rgba(59,130,246,.1)",
      fill: true,
      tension: 0.4,
      pointRadius: 3,
    }],
  };
  return (
    <div className="chart-card wide">
      <h2>Confidence History</h2>
      <Line
        data={data}
        options={{
          scales: {
            y: { min: 0, max: 1, ticks: { color: MUTED }, grid: { color: GRID } },
            x: { ticks: { color: MUTED, maxTicksLimit: 12 }, grid: { color: GRID } },
          },
          plugins: { legend: { labels: { color: MUTED } } },
        }}
      />
    </div>
  );
}
