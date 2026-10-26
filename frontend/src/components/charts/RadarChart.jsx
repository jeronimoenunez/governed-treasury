import { useState } from "react";
import { fmt, num } from "../../lib/format.js";
import { SYMBOL } from "../../config.js";

const S = 300;
const C = S / 2;
const R = 112;

// Radar de 7 ejes (un eje por día): lo que salió cada día contra el tope diario.
// El relleno es lo que salió; el contorno negro es el tope. Si el relleno toca el contorno, ese día se llegó al límite.
export default function RadarChart({ days, limit }) {
  const [hover, setHover] = useState(null);
  const n = days.length;
  const max = Math.max(num(limit), ...days.map((d) => num(d.out)), 1);
  const at = (i, r) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [C + r * Math.cos(a), C + r * Math.sin(a)];
  };
  const poly = (vals) => vals.map((v, i) => at(i, (v / max) * R).join(",")).join(" ");
  const outs = days.map((d) => num(d.out));

  return (
    <div className="radar" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${S} ${S}`} role="img" aria-label="Salidas por día comparadas con el tope diario">
        {[0.5, 1].map((f) => (
          <polygon key={f} className="radar-ring" points={poly(days.map(() => max * f))} />
        ))}
        {days.map((d, i) => {
          const [x, y] = at(i, R);
          return <line key={d.key} className="radar-spoke" x1={C} y1={C} x2={x} y2={y} />;
        })}
        <polygon className="radar-fill" points={poly(outs)} />
        {limit !== undefined && <polygon className="radar-limit" points={poly(days.map(() => num(limit)))} />}
        {days.map((d, i) => {
          const [x, y] = at(i, (outs[i] / max) * R);
          const [lx, ly] = at(i, R + 22);
          return (
            <g key={d.key} onMouseEnter={() => setHover(i)}>
              <circle cx={x} cy={y} r="14" fill="transparent" />
              <circle cx={x} cy={y} r={hover === i ? 6 : 3.5} className="radar-dot" />
              <text x={lx} y={ly + 4} textAnchor="middle" className={`radar-label ${hover === i ? "on" : ""}`}>
                {d.short}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="radar-read" aria-live="polite">
        {hover === null ? (
          "Pasá el mouse por un día para ver el detalle."
        ) : (
          <>
            <strong>{days[hover].long}:</strong> salió {fmt(days[hover].out)} de {fmt(limit)} {SYMBOL} permitidos
          </>
        )}
      </p>
    </div>
  );
}
