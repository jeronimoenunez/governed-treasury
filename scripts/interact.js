// Interacciones reales con GovernedTreasury: cada rol firma con su propia cuenta.
// Genera la evidencia on-chain para el README (hashes + links a Etherscan).
// Uso: npx hardhat run scripts/interact.js --network sepolia
const hre = require("hardhat");
const { ethers, network } = hre;
const fs = require("fs");
const path = require("path");

const T = (n) => ethers.parseEther(String(n));
const EXPLORER = network.name === "sepolia" ? "https://sepolia.etherscan.io/tx/" : "";
// Gas fijo para las transacciones que DEBEN fallar: así ethers no las simula antes,
// la red las incluye y quedan registradas como fallidas (evidencia del rechazo).
const FORCED_GAS = 300000;

const log = [];

// Ejecuta una acción, espera la confirmación y registra el resultado.
async function step(title, txPromise, { expectFail = false } = {}) {
  process.stdout.write(`- ${title}... `);
  try {
    const tx = await txPromise;
    const receipt = await tx.wait().catch((e) => e.receipt);
    const ok = receipt && receipt.status === 1;
    console.log(ok ? "OK" : "RECHAZADA (revert)");
    if (ok === expectFail) console.log("  ATENCIÓN: el resultado no es el esperado");
    log.push({ paso: title, resultado: ok ? "ejecutada" : "rechazada", hash: tx.hash, link: EXPLORER + tx.hash });
  } catch (e) {
    // En la red local, una tx que revierte puede lanzar antes de devolver el hash.
    const reason =
      e.revert?.name || (e.message.match(/custom error '(\w+)/) || [])[1] || e.shortMessage || e.message.split("\n")[0];
    console.log(`RECHAZADA (${reason})`);
    if (!expectFail) console.log("  ATENCIÓN: se esperaba que funcionara");
    log.push({ paso: title, resultado: `rechazada: ${reason}`, hash: e.receipt?.hash || "-", link: "" });
  }
}

async function main() {
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  const dep = JSON.parse(fs.readFileSync(file, "utf8"));

  // Cada rol es una cuenta distinta. En Sepolia, las claves vienen del .env.
  let operator, approver, guardian, proposer;
  if (network.name === "sepolia") {
    const k = (name) => {
      if (!process.env[name]) throw new Error(`Falta ${name} en el .env`);
      return new ethers.Wallet(process.env[name], ethers.provider);
    };
    [operator, approver, guardian, proposer] = ["OPERATOR_KEY", "APPROVER_KEY", "GUARDIAN_KEY", "PROPOSER_KEY"].map(k);
  } else {
    [, operator, approver, guardian, proposer] = await ethers.getSigners();
  }
  // "Quien deplya no conserva ningun poder"
  const [outsider] = await ethers.getSigners(); // el deployer no tiene ningún rol, lo utilizo como "atacante". 

  const treasury = await ethers.getContractAt("GovernedTreasury", dep.contracts.GovernedTreasury);
  const token = await ethers.getContractAt("MockToken", dep.contracts.MockToken);
  const timelock = await ethers.getContractAt("GovernanceTimelock", dep.contracts.GovernanceTimelock);
  const beneficiary = dep.roles.beneficiary;

  const show = async (label) => {
    const [total, direct] = await treasury.remainingToday();
    console.log(`\n[${label}] bóveda: ${ethers.formatEther(await token.balanceOf(dep.contracts.GovernedTreasury))} mARS | ` +
      `beneficiario: ${ethers.formatEther(await token.balanceOf(beneficiary))} | ` +
      `restante hoy: ${ethers.formatEther(total)} (directo ${ethers.formatEther(direct)})\n`);
  };

  console.log(`Red: ${network.name} | Tesorería: ${dep.contracts.GovernedTreasury}`);
  await show("ESTADO INICIAL");

  // ---- Flujo normal ----
  console.log("FLUJO NORMAL");
  await step("Operador: retiro directo de 100", treasury.connect(operator).withdraw(beneficiary, T(100)));
  const nextId = await treasury.nextRequestId();
  await step("Operador: pide retiro de 600 (exige doble firma)", treasury.connect(operator).requestWithdrawal(beneficiary, T(600)));
  await step("Aprobador: aprueba el pedido", treasury.connect(approver).approveWithdrawal(nextId));
  await step("Operador: pide retiro de 700", treasury.connect(operator).requestWithdrawal(beneficiary, T(700)));
  await step("Guardián: rechaza el pedido de 700", treasury.connect(guardian).rejectWithdrawal(nextId + 1n));
  await show("DESPUÉS DEL FLUJO NORMAL");

  // ---- Los ataques deben quedar registrados como rechazados ----
  console.log("ATAQUES (se esperan rechazos)");
  await step("Cuenta sin rol intenta retirar",
    treasury.connect(outsider).withdraw(beneficiary, T(10), { gasLimit: FORCED_GAS }), { expectFail: true });
  await step("Operador intenta enviar a una dirección fuera de la allowlist",
    treasury.connect(operator).withdraw(outsider.address, T(10), { gasLimit: FORCED_GAS }), { expectFail: true });
  await step("Operador intenta aprobar (no tiene el rol)",
    treasury.connect(operator).approveWithdrawal(nextId + 1n, { gasLimit: FORCED_GAS }), { expectFail: true });

  // ---- Timelock: un admin comprometido no puede cambiar nada al instante ----
  console.log("\nTIMELOCK (72 h)");
  const target = dep.contracts.GovernedTreasury;
  const evil = treasury.interface.encodeFunctionData("setBeneficiary", [outsider.address, true]);
  const salt = ethers.id(`demo-${Date.now()}`);
  const opId = await timelock.hashOperation(target, 0, evil, ethers.ZeroHash, salt);
  await step("Proponente: programa agregar un beneficiario sospechoso",
    timelock.connect(proposer).schedule(target, 0, evil, ethers.ZeroHash, salt, await timelock.getMinDelay()));
  await step("Proponente: intenta ejecutarlo ya (faltan 72 h)",
    timelock.connect(proposer).execute(target, 0, evil, ethers.ZeroHash, salt, { gasLimit: FORCED_GAS }), { expectFail: true });
  await step("Guardián: cancela la operación sospechosa", timelock.connect(guardian).cancel(opId));
  console.log(`  ¿Sigue habilitado el sospechoso? ${await treasury.isAllowedBeneficiary(outsider.address)}`);

  await show("ESTADO FINAL");

  const out = path.join(__dirname, "..", "deployments", `${network.name}-interactions.json`);
  fs.writeFileSync(out, JSON.stringify(log, null, 2));
  console.log(`Evidencia guardada en deployments/${network.name}-interactions.json`);
  console.table(log.map(({ paso, resultado, hash }) => ({ paso, resultado, hash })));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});