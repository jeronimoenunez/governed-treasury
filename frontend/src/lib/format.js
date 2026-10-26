import { formatEther, parseEther } from "viem";
import { KNOWN_ROLES } from "../config.js";

// 9300000000000000000000n -> "9.300"
export const fmt = (wei, decimals = 2) =>
  wei === undefined ? "—" : Number(formatEther(wei)).toLocaleString("es-AR", { maximumFractionDigits: decimals });

// "100,5" o "100.5" -> wei. Devuelve null si no es un número válido.
export function toWei(text) {
  const clean = String(text).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,18})?$/.test(clean)) return null;
  return parseEther(clean);
}

export const short = (addr) => (addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "");

const ROLE_NAMES = {
  operator: "Operador",
  approver: "Aprobador",
  guardian: "Guardián",
  proposer: "Proponente",
  beneficiary: "Beneficiario",
};

// Nombre legible de una dirección conocida del deploy, o la dirección abreviada.
export function who(addr) {
  if (!addr) return "";
  const entry = Object.entries(KNOWN_ROLES).find(([, a]) => a.toLowerCase() === addr.toLowerCase());
  return entry ? ROLE_NAMES[entry[0]] : short(addr);
}

export function timeLeft(seconds) {
  if (seconds <= 0) return "vencida";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `vence en ${d} d ${h} h`;
  if (h > 0) return `vence en ${h} h ${m} min`;
  return `vence en ${m} min`;
}

// wei -> número de JS (para dibujar; nunca para operar).
export const num = (wei) => (wei === undefined || wei === null ? 0 : Number(formatEther(wei)));

// 10000 -> "10 mil" (ejes de los gráficos)
export const compact = (n) => n.toLocaleString("es-AR", { notation: "compact", maximumFractionDigits: 1 });

export const dateTime = (ts) =>
  new Date(ts * 1000).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Duración en palabras: 200000 -> "2 d 7 h"
export function duration(seconds) {
  const s = Math.max(0, seconds);
  if (s > 0 && s <= 72 * 3600 && s % 3600 === 0) return `${s / 3600} h`; // 259200 -> "72 h"
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}
