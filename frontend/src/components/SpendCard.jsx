import RadarChart from "./charts/RadarChart.jsx";
import { SYMBOL } from "../config.js";
import { fmt } from "../lib/format.js";

export default function SpendCard({ flows, limit, moves, since, loading }) {
  const week = moves.filter((m) => m.ts >= since - 86400);
  const sum = (kind) => week.filter((m) => m.kind === kind).reduce((a, m) => a - m.amount, 0n);
  const count = (kind) => week.filter((m) => m.kind === kind).length;
  const stats = [
    { label: "Directos", n: count("direct"), amount: sum("direct") },
    { label: "Doble firma", n: count("dual"), amount: sum("dual") },
    { label: "Rechazados", n: count("reject"), amount: null },
  ];
  return (
    <section className="card card-spend" aria-labelledby="sp-title">
      <div className="card-head">
        <h2 id="sp-title" className="card-title">Salidas vs tope</h2>
        <div className="legend">
          <span>
            <i className="key key-in" /> Salió
          </span>
          <span>
            <i className="key key-limit" /> Tope diario
          </span>
        </div>
      </div>
      {loading ? <div className="chart-empty loading">Leyendo el historial de la cadena…</div> : <RadarChart days={flows} limit={limit} />}
      <ul className="mx-stats">
        {stats.map((s) => (
          <li key={s.label}>
            <span>{s.label}</span>
            <strong>{loading ? "…" : s.n}</strong>
            <small>{s.amount === null ? "no salió nada" : `${fmt(s.amount)} ${SYMBOL}`}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
