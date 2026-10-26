// Historial on-chain: lee los eventos de la tesorería y del timelock y los convierte
// en los datos del panel (saldo en el tiempo, flujos por día, cambios de gobernanza).
// Solo lecturas: no firma nada y no necesita billetera.
import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { decodeFunctionData, parseEventLogs } from "viem";
import { CHAIN, FROM_BLOCK, TIMELOCK, TREASURY } from "../config.js";

const ABI = [...TREASURY.abi, ...TIMELOCK.abi];
const DAY = 86400;

// Caché en memoria: cada actualización pide solo los bloques nuevos.
const cache = { to: null, logs: [], times: new Map() };
let inflight = null;

// Muchos RPC públicos limitan el rango de eth_getLogs: si uno falla, se achica el tramo.
async function getLogsChunked(client, address, from, to) {
  const out = [];
  let size = 10000n;
  let start = from;
  while (start <= to) {
    const end = start + size - 1n < to ? start + size - 1n : to;
    try {
      out.push(...(await client.getLogs({ address, fromBlock: start, toBlock: end })));
      start = end + 1n;
    } catch (err) {
      if (size <= 100n) throw err;
      size /= 5n;
    }
  }
  return out;
}

async function blockTimes(client, numbers) {
  const missing = [...new Set(numbers)].filter((n) => !cache.times.has(n));
  for (let i = 0; i < missing.length; i += 8) {
    const group = missing.slice(i, i + 8);
    const blocks = await Promise.all(group.map((n) => client.getBlock({ blockNumber: n })));
    blocks.forEach((b) => cache.times.set(b.number, Number(b.timestamp)));
  }
}

async function load(client) {
  const head = await client.getBlock();
  const from =
    cache.to !== null ? cache.to + 1n : (FROM_BLOCK ?? (head.number > 50000n ? head.number - 50000n : 0n));
  if (from <= head.number) {
    const raw = await getLogsChunked(client, [TREASURY.address, TIMELOCK.address], from, head.number);
    cache.logs.push(...raw);
    cache.to = head.number;
  }
  await blockTimes(client, cache.logs.map((l) => l.blockNumber));

  const events = parseEventLogs({ abi: ABI, logs: cache.logs, strict: false })
    .filter((e) => e.eventName)
    .map((e) => ({
      name: e.eventName,
      args: e.args,
      on: e.address.toLowerCase() === TIMELOCK.address.toLowerCase() ? "timelock" : "treasury",
      block: e.blockNumber,
      index: e.logIndex,
      hash: e.transactionHash,
      ts: cache.times.get(e.blockNumber),
    }))
    .sort((a, b) => (a.block === b.block ? a.index - b.index : a.block < b.block ? -1 : 1));

  return { events, head: head.number, chainNow: Number(head.timestamp), complete: FROM_BLOCK !== null };
}

export function useHistory() {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["history", CHAIN.id],
    queryFn: () => (inflight ??= load(client).finally(() => (inflight = null))),
    refetchInterval: 30000,
    enabled: Boolean(client),
  });
}

// ---------- Derivados para los gráficos ----------

// Clave del día en hora local: "2026-10-26".
export const dayKey = (ts) => {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Movimientos de dinero, del más nuevo al más viejo.
export function movements(events) {
  const approvedTx = new Set(events.filter((e) => e.name === "WithdrawalRequestApproved").map((e) => e.hash));
  const out = [];
  for (const e of events) {
    if (e.on !== "treasury") continue;
    if (e.name === "Deposited") out.push({ ...e, kind: "deposit", label: "Depósito", amount: e.args.amount, party: e.args.from });
    if (e.name === "Withdrawn")
      out.push({
        ...e,
        kind: approvedTx.has(e.hash) ? "dual" : "direct",
        label: approvedTx.has(e.hash) ? "Retiro con doble firma" : "Retiro directo",
        amount: -e.args.amount,
        party: e.args.to,
      });
    if (e.name === "WithdrawalRequested")
      out.push({ ...e, kind: "request", label: `Pedido ${e.args.requestId}`, amount: null, party: e.args.to });
    if (e.name === "WithdrawalRejected")
      out.push({ ...e, kind: "reject", label: `Pedido ${e.args.requestId} rechazado`, amount: null, party: e.args.rejecter });
  }
  return out.reverse();
}

// Saldo después de cada movimiento, reconstruido hacia atrás desde el saldo actual.
// Así es exacto aunque el historial no empiece en el deploy.
export function balanceSeries(events, current, chainNow) {
  const moves = events.filter((e) => e.on === "treasury" && (e.name === "Deposited" || e.name === "Withdrawn"));
  if (current === undefined || moves.length === 0) return [];
  let v = current;
  const points = [{ t: chainNow, v }];
  for (let i = moves.length - 1; i >= 0; i--) {
    const m = moves[i];
    points.push({ t: m.ts, v, hash: m.hash });
    v = m.name === "Deposited" ? v - m.args.amount : v + m.args.amount;
  }
  points.push({ t: moves[0].ts, v, start: true });
  return points.reverse();
}

// Últimos 7 días (incluido hoy, según el reloj de la cadena).
export function lastDays(chainNow, n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const ts = chainNow - (n - 1 - i) * DAY;
    const d = new Date(ts * 1000);
    return {
      key: dayKey(ts),
      short: d.toLocaleDateString("es-AR", { weekday: "short" }).replace(".", ""),
      long: d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" }),
    };
  });
}

export function dailyFlows(events, days) {
  const map = Object.fromEntries(days.map((d) => [d.key, { in: 0n, out: 0n }]));
  for (const e of events) {
    if (e.on !== "treasury") continue;
    const slot = map[dayKey(e.ts)];
    if (!slot) continue;
    if (e.name === "Deposited") slot.in += e.args.amount;
    if (e.name === "Withdrawn") slot.out += e.args.amount;
  }
  return days.map((d) => ({ ...d, ...map[d.key] }));
}

// Cambios de reglas que pasaron por el timelock, con su estado actual.
export function timelockOps(events, chainNow) {
  const executed = new Set(events.filter((e) => e.name === "CallExecuted").map((e) => e.args.id));
  const cancelled = new Map(events.filter((e) => e.name === "Cancelled").map((e) => [e.args.id, e]));
  return events
    .filter((e) => e.name === "CallScheduled")
    .map((e) => {
      const eta = e.ts + Number(e.args.delay);
      let status = "waiting";
      if (executed.has(e.args.id)) status = "executed";
      else if (cancelled.has(e.args.id)) status = "cancelled";
      else if (chainNow >= eta) status = "ready";
      return { id: e.args.id, hash: e.hash, ts: e.ts, eta, status, call: describeCall(e.args.target, e.args.data) };
    })
    .reverse();
}

function describeCall(target, data) {
  const abi = target.toLowerCase() === TIMELOCK.address.toLowerCase() ? TIMELOCK.abi : TREASURY.abi;
  try {
    const { functionName, args } = decodeFunctionData({ abi, data });
    return { functionName, args };
  } catch {
    return { functionName: null, args: [] };
  }
}

// Beneficiarios habilitados hoy, según los eventos BeneficiaryUpdated.
export function beneficiaries(events) {
  const set = new Map();
  for (const e of events) if (e.name === "BeneficiaryUpdated") set.set(e.args.beneficiary.toLowerCase(), e.args.allowed);
  return [...set].filter(([, ok]) => ok).map(([a]) => a);
}
