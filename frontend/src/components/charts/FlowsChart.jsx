import { useState } from "react";
import { useWidth } from "./useWidth.js";
import { niceMax } from "./scale.js";
import { compact, fmt, num } from "../../lib/format.js";
import { SYMBOL } from "../../config.js";

const H = 210;
const PAD = { l: 40, r: 4, t: 12, b: 28 };

// Barra con las dos esquinas de arriba redondeadas (4 px) y apoyada en la base.
function bar(x, y, w, h) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

// Entradas y salidas por día. Un solo eje: las dos series están en mARS.
export default function FlowsChart({ days }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(1, ...days.flatMap((d) => [num(d.in), num(d.out)])));
  const innerH = H - PAD.t - PAD.b;
  const gw = (w - PAD.l - PAD.r) / days.length;
  const bw = Math.max(6, Math.min(22, gw * 0.26));
  const y = (n) => PAD.t + (1 - n / max) * innerH;
  const base = H - PAD.b;

  return (
    <div ref={ref} className="chart chart-flows" onMouseLeave={() => setHover(null)}>
      <svg width={w} height={H} role="img" aria-label="Entradas y salidas por día">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className={f === 0 ? "baseline" : "gridline"} x1={PAD.l} x2={w - PAD.r} y1={y(max * f)} y2={y(max * f)} />
            <text className="axis" x={PAD.l - 8} y={y(max * f) + 4} textAnchor="end">
              {compact(max * f)}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = PAD.l + gw * i + gw / 2;
          const vin = num(d.in);
          const vout = num(d.out);
          return (
            <g key={d.key} onMouseEnter={() => setHover({ i, cx })}>
              <rect className={`band ${hover?.i === i ? "band-on" : ""}`} x={cx - gw / 2 + 2} y={PAD.t} width={gw - 4} height={innerH} rx="10" />
              {vin > 0 && <path className="bar-in" d={bar(cx - bw - 1, y(vin), bw, base - y(vin))} />}
              {vout > 0 && <path className="bar-out" d={bar(cx + 1, y(vout), bw, base - y(vout))} />}
              <text className="axis" x={cx} y={H - 8} textAnchor="middle">
                {d.short}
              </text>
            </g>
          );
        })}
      </svg>
      {hover && (
        <div className="tip" style={{ left: hover.cx, top: PAD.t + 10 }}>
          <strong>{days[hover.i].long}</strong>
          <span>
            <i className="key key-in" /> Entró {fmt(days[hover.i].in)} {SYMBOL}
          </span>
          <span>
            <i className="key key-out" /> Salió {fmt(days[hover.i].out)} {SYMBOL}
          </span>
        </div>
      )}
    </div>
  );
}
