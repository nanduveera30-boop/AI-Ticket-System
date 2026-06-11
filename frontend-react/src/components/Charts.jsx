import { Doughnut, Line, Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend,
  LineElement, PointElement, CategoryScale, LinearScale, Filler, BarElement,
} from "chart.js";

ChartJS.register(ArcElement, Tooltip, Legend, LineElement, PointElement,
  CategoryScale, LinearScale, Filler, BarElement);

const LABEL_COLOR = "#464555";
const GRID_COLOR  = "rgba(199,196,216,0.3)";

const baseOpts = {
  plugins: { legend: { labels: { color: LABEL_COLOR, font: { size: 11, family: "Inter" }, boxWidth: 10, padding: 14 } } },
  maintainAspectRatio: true,
};

export function DonutChart({ metrics }) {
  const data = {
    labels: ["Auto-Resolved", "Suggested", "Escalated"],
    datasets: [{
      data: [metrics?.auto_resolved_count ?? 0, metrics?.suggested_count ?? 0, metrics?.escalated_count ?? 0],
      backgroundColor: ["#4f46e5", "#ffb695", "#ffdad6"],
      borderColor: ["#3525cd", "#a44100", "#ba1a1a"],
      borderWidth: 1,
      hoverOffset: 6,
    }],
  };
  const total = (metrics?.auto_resolved_count ?? 0) + (metrics?.suggested_count ?? 0) + (metrics?.escalated_count ?? 0);
  const autoRate = total > 0 ? Math.round(((metrics?.auto_resolved_count ?? 0) / total) * 100) : 0;

  return (
    <div className="card chart-wrap" style={{ position: "relative" }}>
      <div className="card-header">
        <div>
          <div className="card-title">Decision Distribution</div>
          <div className="card-sub">AI resolution breakdown</div>
        </div>
        <span className="badge badge-blue">{autoRate}% Auto Rate</span>
      </div>
      <Doughnut data={data} options={{ ...baseOpts, cutout: "70%" }} />
    </div>
  );
}

export function ConfidenceLine({ history }) {
  const data = {
    labels: history.map(h => `#${h.id}`),
    datasets: [{
      label: "Confidence",
      data: history.map(h => h.conf),
      borderColor: "#4f46e5",
      backgroundColor: "rgba(79,70,229,0.06)",
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: "#4f46e5",
      borderWidth: 2,
    }],
  };
  return (
    <div className="card chart-wrap">
      <div className="card-header">
        <div>
          <div className="card-title">Confidence History</div>
          <div className="card-sub">Last {history.length} tickets</div>
        </div>
      </div>
      <Line data={data} options={{
        ...baseOpts,
        scales: {
          y: { min: 0, max: 1, ticks: { color: LABEL_COLOR, font: { size: 10 } }, grid: { color: GRID_COLOR } },
          x: { ticks: { color: LABEL_COLOR, maxTicksLimit: 10, font: { size: 10 } }, grid: { color: GRID_COLOR } },
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
      backgroundColor: ["#ffdad6", "#ffdbcc", "#dcfce7"],
      borderColor: ["#ba1a1a", "#a44100", "#166534"],
      borderWidth: 1,
      borderRadius: 6,
    }],
  };
  return (
    <div className="card chart-wrap">
      <div className="card-header">
        <div className="card-title">Priority Distribution</div>
      </div>
      <Bar data={data} options={{
        ...baseOpts,
        scales: {
          y: { ticks: { color: LABEL_COLOR, font: { size: 10 } }, grid: { color: GRID_COLOR } },
          x: { ticks: { color: LABEL_COLOR, font: { size: 10 } }, grid: { display: false } },
        },
      }} />
    </div>
  );
}
