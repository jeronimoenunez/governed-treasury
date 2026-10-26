import { SYMBOL } from "../config.js";
import { num } from "../lib/format.js";
import BalanceChart from "./charts/BalanceChart.jsx";

export default function BalanceCard({ t, series, flows, loading }) {
  const weekIn = flows.reduce((a, d) => a + d.in, 0n);
  const weekOut = flows.reduce((a, d) => a + d.out, 0n);
  const net = num(weekIn) - num(weekOut);
  return (
    <section className={`card card-balance ${t.paused ? "is-paused" : ""}`} aria-labelledby="bal-title">
      <div className="card-head">
        <h2 id="bal-title" className="card-title">Saldo en la bóveda</h2>
        <span className={`status ${t.paused ? "status-bad" : "status-ok"}`}>
          <i aria-hidden="true" /> {t.paused ? "Pausada" : "Operativa"}
        </span>
      </div>
      <p className="hero-num">
        {t.vaultBalance === undefined ? "…" : (t.vaultBalance / 10n ** 18n).toLocaleString("es-AR")}
        <span className="cents">,{t.vaultBalance === undefined ? "00" : String((t.vaultBalance / 10n ** 16n) % 100n).padStart(2, "0")}</span>
        <span>{SYMBOL}</span>
      </p>
      {!loading && <p className="delta">
        <span className={net >= 0 ? "delta-up" : "delta-down"}>
          {net >= 0 ? "+" : "−"}
          {Math.abs(net).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
        </span>{" "}
        neto en los últimos 7 días
      </p>}
      {loading ? <div className="chart-empty loading">Leyendo el historial de la cadena…</div> : <BalanceChart points={series} />}
    </section>
  );
}
