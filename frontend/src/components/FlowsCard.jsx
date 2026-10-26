import { SYMBOL } from "../config.js";
import { fmt } from "../lib/format.js";
import FlowsChart from "./charts/FlowsChart.jsx";

export default function FlowsCard({ flows, loading }) {
  const out = flows.reduce((a, d) => a + d.out, 0n);
  const inn = flows.reduce((a, d) => a + d.in, 0n);
  return (
    <section className="card card-flows" aria-labelledby="flows-title">
      <div className="card-head">
        <div>
          <h2 id="flows-title" className="card-title">Entradas y salidas</h2>
          <p className="card-sub">Últimos 7 días, en {SYMBOL}</p>
        </div>
        <div className="legend" aria-label="Referencias">
          <span>
            <i className="key key-in" /> Entradas
          </span>
          <span>
            <i className="key key-out" /> Salidas
          </span>
        </div>
      </div>
      <div className="kpis">
        <div>
          <span>Entró</span>
          <strong>{loading ? "…" : fmt(inn)}</strong>
        </div>
        <div>
          <span>Salió</span>
          <strong>{loading ? "…" : fmt(out)}</strong>
        </div>
      </div>
      {loading ? <div className="chart-empty loading">Leyendo el historial de la cadena…</div> : <FlowsChart days={flows} />}
    </section>
  );
}
