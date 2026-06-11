import { Doughnut, Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  LineElement, PointElement, CategoryScale, LinearScale, Filler,
  BarElement,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement,
  CategoryScale, LinearScale, Filler, BarElement);

const MUTED = "#71717a";
const GRID  = "#27272a";

const baseOpts = {
  plugins: { legend: { labels: { color: MUTED, font: { size: 11 } } } },
};

export function DonutChart({ metrics }) {
  const data = {
    labels: ["Auto-Resolved", "Suggested", "Escalated"],
    datasets: [{
      data: [metrics?.auto_resolved_count ?? 0, metrics?.suggested_count ?? 0, metrics?.escalated_count ?? 0],
      backgroundColor: ["#16a34a", "#ca8a04", "#dc2626"],
      borderWidth: 0, hoverOffset: 4,
    }],
  };
  return (
    <div className="card chart-wrap">
      <div className="card-header"><span className="card-title">Decision Distribution</span></div>
      <Doughnut data={data} options={{ ...baseOpts, cutout: "68%" }} />
    </div>
  );
}

export function ConfidenceLine({ history }) {
  const data = {
    labels: history.map(h => `#${h.id}`),
    datasets: [{
      label: "Confidence",
      data: history.map(h => h.conf),
      borderColor: "#2563eb",
      backgroundColor: "rgba(37,99,235,.08)",
      fill: true, tension: 0.4, pointRadius: 3,
    }],
  };
  return (
    <div className="card chart-wrap">
      <div className="card-header"><span className="card-title">Confidence History</span><span className="card-sub">Last 30 tickets</span></div>
      <Line data={data} options={{
        ...baseOpts,
        scales: {
          y: { min: 0, max: 1, ticks: { color: MUTED }, grid: { color: GRID } },
          x: { ticks: { color: MUTED, maxTicksLimit: 10 }, grid: { color: GRID } },
        },
      }} />
    </div>
  );
}

export function PriorityBar({ data: raw }) {
  const labels = Object.keys(raw || {});
  const values = Object.values(raw || {});
  const data = {
    labels,
    datasets: [{
      label: "Tickets",
      data: values,
      backgroundColor: ["#dc2626", "#ca8a04", "#16a34a"],
      borderRadius: 4,
    }],
  };
  return (
    <div className="card chart-wrap">
      <div className="card-header"><span className="card-title">Priority Distribution</span></div>
      <Bar data={data} options={{
        ...baseOpts,
        scales: {
          y: { ticks: { color: MUTED }, grid: { color: GRID } },
          x: { ticks: { color: MUTED }, grid: { color: GRID } },
        },
      }} />
    </div>
  );
}
