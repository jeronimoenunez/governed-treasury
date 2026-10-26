import { SYMBOL } from "../config.js";
import { fmt } from "../lib/format.js";
import LimitGauge from "./charts/LimitGauge.jsx";

const ratio = (a, b) => (b ? Math.max(0, Math.min(1, Number((a * 10000n) / b) / 10000)) : 0);

export default function LimitsCard({ t }) {
  const l = t.limits;
  const usedTotal = l && t.remainingTotal !== undefined ? l.daily - t.remainingTotal : undefined;
  const usedDirect = l && t.remainingDirect !== undefined ? l.directDaily - t.remainingDirect : undefined;
  const pct = usedTotal !== undefined ? ratio(usedTotal, l.daily) : 0;
  const pctDirect = usedDirect !== undefined ? ratio(usedDirect, l.directDaily) : 0;
  return (
    <section className="card card-limits card-lime" aria-labelledby="lim-title">
      <div className="card-head">
        <h2 id="lim-title" className="card-title">Tope diario usado</h2>
        <span className="chip chip-ink">Se renueva cada día</span>
      </div>
      <div className="gauge-wrap">
        <LimitGauge pct={pct} label="Porcentaje del tope diario usado hoy" />
        <div className="gauge-center">
          <strong>{Math.round(pct * 100)}%</strong>
          <span>
            {fmt(usedTotal)} de {fmt(l?.daily)} {SYMBOL}
          </span>
        </div>
      </div>
      <div className="mini-meter">
        <div className="mini-meter-head">
          <span>Sin doble firma</span>
          <span>
            {fmt(usedDirect)} <small>de {fmt(l?.directDaily)}</small>
          </span>
        </div>
        <div className="mini-track" role="meter" aria-label="Tope diario sin doble firma usado" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctDirect * 100)}>
          <div style={{ width: `${pctDirect * 100}%` }} />
        </div>
      </div>
      {l && (
        <p className="foot-note">
          Máximo {fmt(l.perTx)} por operación. Desde {fmt(l.threshold)} firma un aprobador.
        </p>
      )}
    </section>
  );
}
