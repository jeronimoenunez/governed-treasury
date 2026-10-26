// Escala "redonda" para ejes: 9.300 -> 10.000, 1.180 -> 1.500.
export function niceMax(v) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (v <= m * mag) return m * mag;
  return 10 * mag;
}
