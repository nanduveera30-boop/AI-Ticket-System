import MetricsRow    from "../components/MetricsRow";
import { DonutChart, ConfidenceLine } from "../components/Charts";
import TicketForm    from "../components/TicketForm";
import TicketLog     from "../components/TicketLog";

export default function DashboardPage({ metrics, confidenceHistory, log, onResult }) {
  return (
    <>
      <MetricsRow metrics={metrics} />
      <div className="charts-grid">
        <DonutChart metrics={metrics} />
        <ConfidenceLine history={confidenceHistory} />
      </div>
      <TicketForm onResult={onResult} />
      <TicketLog log={log} />
    </>
  );
}
