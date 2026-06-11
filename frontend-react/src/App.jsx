import { useMetrics }    from "./hooks/useMetrics";
import { useTicketLog }  from "./hooks/useTicketLog";
import Header            from "./components/Header";
import MetricsRow        from "./components/MetricsRow";
import { DonutChart, ConfidenceLine } from "./components/Charts";
import TicketForm        from "./components/TicketForm";
import TicketLog         from "./components/TicketLog";

export default function App() {
  const { metrics, online, refresh } = useMetrics(10000);
  const { log, confidenceHistory, addEntry } = useTicketLog();

  function handleResult(result, meta) {
    addEntry(result, meta);
    refresh();
  }

  return (
    <>
      <Header online={online} />
      <main>
        <MetricsRow metrics={metrics} />
        <section className="charts-row">
          <DonutChart metrics={metrics} />
          <ConfidenceLine history={confidenceHistory} />
        </section>
        <TicketForm onResult={handleResult} />
        <TicketLog log={log} />
      </main>
    </>
  );
}
