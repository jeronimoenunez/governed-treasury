import { useState } from "react";
import { useWidth } from "./useWidth.js";
import { niceMax } from "./scale.js";
import { compact, dateTime, fmt, num } from "../../lib/format.js";
import { SYMBOL } from "../../config.js";

const H = 206;
const PAD = { l: 4, r: 4, t: 14, b: 26 };

// Saldo de la bóveda en el tiempo. Línea escalonada: el saldo cambia de golpe en cada movimiento.
export default function BalanceChart({ points }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);

  if (points.length < 2) {
    return (
      <div ref={ref} className="chart-empty">
        El gráfico aparece con el primer movimiento.
      </div>
    );
  }

  const t0 = points[0].t;
  const t1 = points.at(-1).t;
  const span = Math.max(1, t1 - t0);
  const max = niceMax(Math.max(...points.map((p) => num(p.v))) * 1.05);
  const x = (t) => PAD.l + ((t - t0) / span) * (w - PAD.l - PAD.r);
  const y = (n) => PAD.t + (1 - n / max) * (H - PAD.t - PAD.b);
  const base = H - PAD.b;

  let line = `M${x(points[0].t)},${y(num(points[0].v))}`;
  for (let i = 1; i < points.length; i++) line += ` H${x(points[i].t)} V${y(num(points[i].v))}`;
  const area = `${line} V${base} H${x(t0)} Z`;

  const short = span < 2 * 86400;
  const tick = (t) =>
    new Date(t * 1000).toLocaleString("es-AR", short ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });

  function onMove(e) {
    const box = e.currentTarget.getBoundingClientRect();
    const t = t0 + ((e.clientX - box.left - PAD.l) / (w - PAD.l - PAD.r)) * span;
    let p = points[0];
    for (const q of points) if (q.t <= t) p = q;
    setHover({ x: Math.min(Math.max(e.clientX - box.left, PAD.l), w - PAD.r), p, t });
  }

  return (
    <div ref={ref} className="chart" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={H} onMouseMove={onMove} role="img" aria-label="Saldo de la bóveda en el tiempo">
        <defs>
          <linearGradient id="bal-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--lime)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.5, 1].map((f) => (
          <g key={f}>
            <line className="gridline" x1={PAD.l} x2={w - PAD.r} y1={y(max * f)} y2={y(max * f)} />
            <text className="axis" x={PAD.l} y={y(max * f) - 5}>
              {compact(max * f)}
            </text>
          </g>
        ))}
        <line className="baseline" x1={PAD.l} x2={w - PAD.r} y1={base} y2={base} />
        <path d={area} fill="url(#bal-fill)" />
        <path d={line} className="series-line" />
        <text className="axis" x={PAD.l} y={H - 6}>
          {tick(t0)}
        </text>
        <text className="axis" x={w - PAD.r} y={H - 6} textAnchor="end">
          {short ? "ahora" : tick(t1)}
        </text>
        {hover && (
          <g>
            <line className="crosshair" x1={hover.x} x2={hover.x} y1={PAD.t} y2={base} />
            <circle cx={hover.x} cy={y(num(hover.p.v))} r="5" className="dot" />
          </g>
        )}
      </svg>
      {hover && (
        <div className="tip" style={{ left: hover.x, top: y(num(hover.p.v)) }}>
          <strong>
            {fmt(hover.p.v)} {SYMBOL}
          </strong>
          <span>{dateTime(hover.t)}</span>
        </div>
      )}
    </div>
  );
}
