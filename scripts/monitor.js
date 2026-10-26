// Monitor de alertas de GovernedTreasury.
// Vigila la tesorería y el timelock bloque a bloque y avisa por consola, Slack y/o Telegram:
//   - cambios programados en el timelock (lo más crítico: alguien quiere cambiar las reglas)
//   - pausas, beneficiarios revocados, roles y límites
//   - pedidos, aprobaciones, rechazos y retiros
//   - transacciones RECHAZADAS contra los contratos (intentos de ataque)
// Uso: node scripts/monitor.js sepolia   (o localhost)
require("dotenv").config({ quiet: true });
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const network = process.argv[2] || "sepolia";
const root = path.join(__dirname, "..");
const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments", `${network}.json`), "utf8"));
const abi = (n) => JSON.parse(fs.readFileSync(path.join(root, "artifacts", "contracts", `${n}.sol`, `${n}.json`), "utf8")).abi;

const RPC = network === "sepolia" ? process.env.SEPOLIA_RPC_URL : "http://127.0.0.1:8545";
const EXPLORER = network === "sepolia" ? "https://sepolia.etherscan.io" : null;
const POLL_MS = Number(process.env.MONITOR_POLL_MS || 6000);

const provider = new ethers.JsonRpcProvider(RPC);
const TREASURY = dep.contracts.GovernedTreasury.toLowerCase();
const TIMELOCK = dep.contracts.GovernanceTimelock.toLowerCase();
const treasuryIface = new ethers.Interface(abi("GovernedTreasury"));
const timelockIface = new ethers.Interface(abi("GovernanceTimelock"));

// ---- Nombres legibles ----
const roleNames = Object.fromEntries(Object.entries(dep.roles).map(([k, a]) => [a.toLowerCase(), k]));
const ES = { operator: "Operador", approver: "Aprobador", guardian: "Guardián", proposer: "Proponente", beneficiary: "Beneficiario" };
const who = (a) => (roleNames[a?.toLowerCase()] ? ES[roleNames[a.toLowerCase()]] : `${a.slice(0, 6)}…${a.slice(-4)}`);
const amt = (wei) => `${Number(ethers.formatEther(wei)).toLocaleString("es-AR")} mARS`;
const ROLE_IDS = Object.fromEntries(
  ["OPERATOR_ROLE", "APPROVER_ROLE", "GUARDIAN_ROLE"].map((r) => [ethers.id(r), r]).concat([[ethers.ZeroHash, "DEFAULT_ADMIN_ROLE"]])
);

// ---- Envío de alertas ----
const LEVEL = { critical: "🔴 CRÍTICA", warning: "🟠 ATENCIÓN", info: "🟢 INFO" };

async function notify(level, title, detail, txHash) {
  const link = EXPLORER && txHash ? `${EXPLORER}/tx/${txHash}` : "";
  const text = `${LEVEL[level]} · GovernedTreasury\n*${title}*\n${detail}${link ? `\n${link}` : ""}`;
  console.log(`\n[${new Date().toLocaleTimeString("es-AR")}] ${text.replace(/\*/g, "")}`);

  const jobs = [];
  if (process.env.SLACK_WEBHOOK_URL) {
    jobs.push(fetch(process.env.SLACK_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }));
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    jobs.push(
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: text.replace(/\*/g, "") }),
      })
    );
  }
  const results = await Promise.allSettled(jobs);
  results.filter((r) => r.status === "rejected").forEach((r) => console.error("  No se pudo enviar la alerta:", r.reason.message));
}

// ---- Traducción de eventos a alertas ----
function describeScheduled(data) {
  try {
    const call = treasuryIface.parseTransaction({ data });
    return `${call.name}(${call.args.map((a) => (typeof a === "string" && a.startsWith("0x") && a.length === 42 ? who(a) : String(a))).join(", ")})`;
  } catch {
    return "llamada no reconocida";
  }
}

function handleLog(log) {
  const isTreasury = log.address.toLowerCase() === TREASURY;
  const parsed = (isTreasury ? treasuryIface : timelockIface).parseLog(log);
  if (!parsed) return null;
  const a = parsed.args;
  const tx = log.transactionHash;
  switch (parsed.name) {
    // Timelock: alguien quiere cambiar las reglas
    case "CallScheduled":
      return notify("critical", "Cambio programado en el timelock",
        `Acción: ${describeScheduled(a.data)}\nSe podrá ejecutar en ${Number(a.delay) / 3600} h. Si no lo reconocés, el guardián debe cancelarlo.`, tx);
    case "Cancelled":
      return notify("warning", "Cambio cancelado en el timelock", `Operación ${a.id.slice(0, 10)}… cancelada.`, tx);
    case "CallExecuted":
      return notify("critical", "Cambio ejecutado por el timelock", `Acción: ${describeScheduled(a.data)}`, tx);
    // Tesorería: emergencia y configuración
    case "Paused":
      return notify("critical", "Tesorería PAUSADA", `Pausada por ${who(a.account)}. Reanudar requiere el timelock (72 h).`, tx);
    case "Unpaused":
      return notify("warning", "Tesorería reanudada", `Reanudada vía timelock.`, tx);
    case "BeneficiaryUpdated":
      return notify(a.allowed ? "critical" : "warning", a.allowed ? "Beneficiario habilitado" : "Beneficiario revocado", `${who(a.beneficiary)}`, tx);
    case "LimitsUpdated":
      return notify("critical", "Límites modificados",
        `Por operación ${amt(a.perTxLimit)}, diario ${amt(a.dailyLimit)}, doble firma desde ${amt(a.approvalThreshold)}, directo diario ${amt(a.directDailyLimit)}`, tx);
    case "RoleGranted":
      return notify("critical", "Rol otorgado", `${ROLE_IDS[a.role] || a.role} → ${who(a.account)}`, tx);
    case "RoleRevoked":
      return notify("warning", "Rol revocado", `${ROLE_IDS[a.role] || a.role} ← ${who(a.account)}`, tx);
    // Tesorería: operación
    case "WithdrawalRequested":
      return notify("warning", "Pedido de retiro con doble firma", `Pedido ${a.requestId}: ${amt(a.amount)} para ${who(a.to)}, pedido por ${who(a.requester)}. Espera aprobación.`, tx);
    case "WithdrawalRequestApproved":
      return notify("info", "Pedido aprobado", `Pedido ${a.requestId} aprobado por ${who(a.approver)}.`, tx);
    case "WithdrawalRejected":
      return notify("info", "Pedido rechazado", `Pedido ${a.requestId} rechazado por ${who(a.rejecter)}.`, tx);
    case "Withdrawn":
      return notify("info", "Retiro ejecutado", `${amt(a.amount)} a ${who(a.to)} (origen: ${who(a.operator)}).`, tx);
    case "Deposited":
      return notify("info", "Depósito", `${amt(a.amount)} de ${who(a.from)}.`, tx);
    default:
      return null;
  }
}

// ---- Transacciones rechazadas: no emiten eventos, hay que mirarlas en el bloque ----
async function checkFailedTxs(blockNumber) {
  const block = await provider.getBlock(blockNumber, true);
  if (!block) return;
  for (const tx of block.prefetchedTransactions) {
    const to = tx.to?.toLowerCase();
    if (to !== TREASURY && to !== TIMELOCK) continue;
    const receipt = await provider.getTransactionReceipt(tx.hash);
    if (receipt && receipt.status === 0) {
      let action = "función desconocida";
      try {
        action = (to === TREASURY ? treasuryIface : timelockIface).parseTransaction({ data: tx.data }).name;
      } catch {}
      await notify("critical", "Intento RECHAZADO por el contrato",
        `${who(tx.from)} intentó ${action}() en ${to === TREASURY ? "la tesorería" : "el timelock"} y el contrato lo bloqueó.`, tx.hash);
    }
  }
}

// ---- Bucle principal ----
async function main() {
  let last = Number(process.env.MONITOR_FROM_BLOCK || (await provider.getBlockNumber()));
  console.log(`Monitor activo en ${network} desde el bloque ${last}.`);
  console.log(`Tesorería ${dep.contracts.GovernedTreasury} · Timelock ${dep.contracts.GovernanceTimelock}`);
  console.log(`Canales: consola${process.env.SLACK_WEBHOOK_URL ? ", Slack" : ""}${process.env.TELEGRAM_BOT_TOKEN ? ", Telegram" : ""}\n`);

  for (;;) {
    try {
      const latest = await provider.getBlockNumber();
      if (latest > last) {
        const logs = await provider.getLogs({ address: [dep.contracts.GovernedTreasury, dep.contracts.GovernanceTimelock], fromBlock: last + 1, toBlock: latest });
        // Bloque por bloque, para que las alertas salgan en orden cronológico.
        for (let b = last + 1; b <= latest; b++) {
          for (const log of logs.filter((l) => l.blockNumber === b)) await handleLog(log);
          await checkFailedTxs(b);
        }
        last = latest;
      }
    } catch (e) {
      console.error("Error leyendo la red (se reintenta):", e.shortMessage || e.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

main();
