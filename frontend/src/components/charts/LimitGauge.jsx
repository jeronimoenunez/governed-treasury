// Medidor semicircular segmentado: cuánto del tope diario ya se usó hoy.
const N = 32;
const CX = 130;
const CY = 128;

export default function LimitGauge({ pct, label }) {
  const segs = Array.from({ length: N }, (_, i) => {
    const f = (i + 0.5) / N;
    const a = Math.PI - f * Math.PI;
    const r1 = 92;
    const r2 = 120;
    return {
      on: f <= pct,
      x1: CX + r1 * Math.cos(a),
      y1: CY - r1 * Math.sin(a),
      x2: CX + r2 * Math.cos(a),
      y2: CY - r2 * Math.sin(a),
    };
  });
  return (
    <svg className="gauge-svg" viewBox="0 0 260 140" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct * 100)}>
      {segs.map((s, i) => (
        <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className={s.on ? "seg seg-on" : "seg"} />
      ))}
    </svg>
  );
}
