// Prueba de la spec 006 sin red: arma a mano llamadas programadas, las pasa por
// describeCall (la misma función que usa el monitor) y verifica cada caso.
// No carga .env ni crea un provider. Necesita artifacts/ compilado (npx hardhat compile).
// Uso: node scripts/check-monitor-destino.js
const assert = require("node:assert/strict");
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const { describeCall } = require("./lib/describe-call");

const root = path.join(__dirname, "..");
const abi = (n) => JSON.parse(fs.readFileSync(path.join(root, "artifacts", "contracts", `${n}.sol`, `${n}.json`), "utf8")).abi;
const dep = JSON.parse(fs.readFileSync(path.join(root, "deployments", "sepolia.json"), "utf8"));

const treasuryIface = new ethers.Interface(abi("GovernedTreasury"));
const timelockIface = new ethers.Interface(abi("GovernanceTimelock"));
const TREASURY = dep.contracts.GovernedTreasury;
const TIMELOCK = dep.contracts.GovernanceTimelock;
const ctx = { treasury: TREASURY.toLowerCase(), timelock: TIMELOCK.toLowerCase(), treasuryIface, timelockIface };
const ATTACKER = "0x000000000000000000000000000000000000dEaD";
const UNKNOWN = "0x1111111111111111111111111111111111111111";

let ok = 0;
function check(name, fn) {
  fn();
  ok++;
  console.log(`OK  ${name}`);
}

// RF-M1: destino tesorería → ABI de la tesorería
check("RF-M1 setLimits hacia la tesorería", () => {
  const data = treasuryIface.encodeFunctionData("setLimits", [[1n, 2n, 1n, 1n]]);
  const d = describeCall(TREASURY, data, ctx);
  assert.equal(d.known, true);
  assert.equal(d.destination, `tesorería (${TREASURY})`);
  assert.match(d.action, /^setLimits\(/);
  console.log(`    Destino: ${d.destination} · Acción: ${d.action}`);
});

// RF-M2: destino timelock → ABI del timelock
check("RF-M2 updateDelay hacia el timelock", () => {
  const data = timelockIface.encodeFunctionData("updateDelay", [0n]);
  const d = describeCall(TIMELOCK, data, ctx);
  assert.equal(d.known, true);
  assert.equal(d.destination, `timelock (${TIMELOCK})`);
  assert.equal(d.action, "updateDelay(0)");
  console.log(`    Destino: ${d.destination} · Acción: ${d.action}`);
});

// RF-M2: el caso del bug. grantRole existe en los dos ABI; antes se mostraba como si fuera de la tesorería.
check("RF-M2 grantRole(PROPOSER_ROLE) hacia el timelock se atribuye al timelock", () => {
  const PROPOSER_ROLE = ethers.id("PROPOSER_ROLE");
  const data = timelockIface.encodeFunctionData("grantRole", [PROPOSER_ROLE, ATTACKER]);
  assert.equal(treasuryIface.parseTransaction({ data }).name, "grantRole", "el ABI de la tesorería también lo decodifica: por eso hacía falta el destino");
  const d = describeCall(TIMELOCK, data, ctx);
  assert.equal(d.destination, `timelock (${TIMELOCK})`);
  assert.equal(d.action, `grantRole(${PROPOSER_ROLE}, ${ATTACKER})`);
  console.log(`    Destino: ${d.destination} · Acción: ${d.action}`);
});

// RF-M3: destino desconocido → sin decodificar, con dirección completa y selector
check("RF-M3 destino desconocido", () => {
  const data = treasuryIface.encodeFunctionData("setBeneficiary", [ATTACKER, true]);
  const d = describeCall(UNKNOWN, data, ctx);
  assert.equal(d.known, false);
  assert.equal(d.destination, UNKNOWN);
  assert.equal(d.selector, data.slice(0, 10));
  assert.equal(d.action, null);
  console.log(`    Destino: ${d.destination} · Selector: ${d.selector} (alerta CRÍTICA "destino desconocido")`);
});

// RF-M4: siempre el destino, también si no decodifica; comparación sin mayúsculas
check("RF-M4 llamada no reconocida muestra el destino", () => {
  const data = treasuryIface.encodeFunctionData("setBeneficiary", [ATTACKER, true]); // no existe en el timelock
  const d = describeCall(TIMELOCK, data, ctx);
  assert.equal(d.known, true);
  assert.equal(d.destination, `timelock (${TIMELOCK})`);
  assert.equal(d.action, `llamada no reconocida (selector ${data.slice(0, 10)})`);
  console.log(`    Destino: ${d.destination} · Acción: ${d.action}`);
});

check("RF-M4 la dirección se compara sin distinguir mayúsculas", () => {
  const data = timelockIface.encodeFunctionData("updateDelay", [0n]);
  assert.equal(describeCall(TIMELOCK.toLowerCase(), data, ctx).known, true);
  assert.equal(describeCall(TIMELOCK.toUpperCase().replace("0X", "0x"), data, ctx).known, true);
});

console.log(`\n${ok} casos OK`);
