// Describe una llamada programada en el timelock según su destino (spec 006).
// Es una función pura: no lee .env ni habla con la red, así se puede probar sola
// (scripts/check-monitor-destino.js).
//
// - destino = tesorería → decodifica con el ABI de la tesorería
// - destino = timelock  → decodifica con el ABI del timelock
// - otro destino        → no decodifica: known = false, para que el monitor alerte

function describeCall(target, data, { treasury, timelock, treasuryIface, timelockIface, who = String }) {
  const t = target.toLowerCase();
  const selector = data.slice(0, 10);
  const contracts = {
    [treasury.toLowerCase()]: { name: "tesorería", iface: treasuryIface },
    [timelock.toLowerCase()]: { name: "timelock", iface: timelockIface },
  };
  const dest = contracts[t];
  if (!dest) return { known: false, destination: target, selector, action: null };

  let action;
  try {
    const call = dest.iface.parseTransaction({ data });
    action = `${call.name}(${call.args.map((a) => (typeof a === "string" && a.startsWith("0x") && a.length === 42 ? who(a) : String(a))).join(", ")})`;
  } catch {
    action = `llamada no reconocida (selector ${selector})`;
  }
  return { known: true, destination: `${dest.name} (${target})`, selector, action };
}

module.exports = { describeCall };
