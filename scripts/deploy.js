// Deploy de GovernedTreasury en tres contratos:
//   MockToken (la moneda) -> GovernanceTimelock (el admin) -> GovernedTreasury (la bóveda)
// Uso: npx hardhat run scripts/deploy.js --network sepolia
const hre = require("hardhat");
const { ethers, network } = hre;
const fs = require("fs");
const path = require("path");

const T = (n) => ethers.parseEther(String(n));
const DELAY = 72 * 60 * 60;
const LIMITS = {
  perTxLimit: T(1000),
  dailyLimit: T(3000),
  approvalThreshold: T(500),
  directDailyLimit: T(1000),
};
const INITIAL_FUNDING = T(10000);

// En Sepolia espero confirmaciones antes de verificar; en local, no hace falta.
const CONFIRMATIONS = network.name === "sepolia" ? 5 : 1;

async function main() {
  const [deployer, ...localSigners] = await ethers.getSigners();

  // Direcciones de los roles: del .env en Sepolia, de cuentas de prueba en local.
  const roles = {
    operator: process.env.OPERATOR_ADDRESS || localSigners[0].address,
    approver: process.env.APPROVER_ADDRESS || localSigners[1].address,
    guardian: process.env.GUARDIAN_ADDRESS || localSigners[2].address,
    proposer: process.env.PROPOSER_ADDRESS || localSigners[3].address,
    beneficiary: process.env.BENEFICIARY_ADDRESS || localSigners[4].address,
  };

  for (const [name, addr] of Object.entries(roles)) {
    if (!ethers.isAddress(addr)) throw new Error(`Dirección inválida para ${name}: ${addr}`);
  }
  const unique = new Set(Object.values(roles).map((a) => a.toLowerCase()));
  unique.add(deployer.address.toLowerCase());
  if (unique.size !== 6) throw new Error("Cada rol tiene que ser una cuenta distinta (y distinta del deployer)");

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Red:       ${network.name} (chainId ${network.config.chainId ?? (await ethers.provider.getNetwork()).chainId})`);
  console.log(`Deployer:  ${deployer.address}  (${ethers.formatEther(balance)} ETH)`);
  console.log("Roles:", roles, "\n");

  // ---- 1. Token ----
  const token = await ethers.deployContract("MockToken");
  await token.deploymentTransaction().wait(CONFIRMATIONS);
  console.log(`MockToken:          ${await token.getAddress()}`);

  // ---- 2. Timelock: el deployer es admin TEMPORAL solo para configurar el guardián ----
  const timelockArgs = [DELAY, [roles.proposer], [roles.proposer], deployer.address];
  const timelock = await ethers.deployContract("GovernanceTimelock", timelockArgs);
  await timelock.deploymentTransaction().wait(CONFIRMATIONS);
  console.log(`GovernanceTimelock: ${await timelock.getAddress()}`);

  await (await timelock.grantRole(await timelock.CANCELLER_ROLE(), roles.guardian)).wait();
  await (await timelock.renounceRole(await timelock.DEFAULT_ADMIN_ROLE(), deployer.address)).wait();
  console.log("  - guardián con CANCELLER_ROLE; deployer renunció al admin del timelock");

  // ---- 3. Tesorería ----
  const treasuryArgs = [
    await token.getAddress(),
    await timelock.getAddress(),
    roles.operator,
    roles.approver,
    roles.guardian,
    [roles.beneficiary],
    LIMITS,
  ];
  const treasury = await ethers.deployContract("GovernedTreasury", treasuryArgs);
  await treasury.deploymentTransaction().wait(CONFIRMATIONS);
  console.log(`GovernedTreasury:   ${await treasury.getAddress()}`);

  // ---- 4. Fondeo inicial ----
  await (await token.mint(deployer.address, INITIAL_FUNDING)).wait();
  await (await token.approve(await treasury.getAddress(), INITIAL_FUNDING)).wait();
  const depositTx = await treasury.deposit(INITIAL_FUNDING);
  await depositTx.wait();
  console.log(`  - depósito inicial de 10.000 mARS (tx ${depositTx.hash})`);

  // ---- 5. Chequeos post-deploy: leer de la red, no confiar 100% en lo que esta en la memoria ----
  const ADMIN = await treasury.DEFAULT_ADMIN_ROLE();
  const checks = [
    ["Timelock es admin de la tesorería", await treasury.hasRole(ADMIN, await timelock.getAddress())],
    ["Deployer SIN admin en la tesorería", !(await treasury.hasRole(ADMIN, deployer.address))],
    ["Deployer SIN admin en el timelock", !(await timelock.hasRole(await timelock.DEFAULT_ADMIN_ROLE(), deployer.address))],
    ["Operador con OPERATOR_ROLE", await treasury.hasRole(await treasury.OPERATOR_ROLE(), roles.operator)],
    ["Aprobador con APPROVER_ROLE", await treasury.hasRole(await treasury.APPROVER_ROLE(), roles.approver)],
    ["Guardián con GUARDIAN_ROLE", await treasury.hasRole(await treasury.GUARDIAN_ROLE(), roles.guardian)],
    ["Guardián puede cancelar en el timelock", await timelock.hasRole(await timelock.CANCELLER_ROLE(), roles.guardian)],
    ["Beneficiario habilitado", await treasury.isAllowedBeneficiary(roles.beneficiary)],
    ["Delay del timelock = 72 h", (await timelock.getMinDelay()) === BigInt(DELAY)],
    ["Saldo de la bóveda = 10.000", (await token.balanceOf(await treasury.getAddress())) === INITIAL_FUNDING],
  ];
  console.log("\nChequeos post-deploy:");
  let ok = true;
  for (const [label, passed] of checks) {
    console.log(`  ${passed ? "OK  " : "FALLA"} ${label}`);
    ok = ok && passed;
  }
  if (!ok) throw new Error("Algún chequeo post-deploy falló: revisar antes de seguir");

  // ---- 6. Guardar direcciones para el frontend y el script de interacción ----
  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployedAt: new Date().toISOString(),
    contracts: {
      MockToken: await token.getAddress(),
      GovernanceTimelock: await timelock.getAddress(),
      GovernedTreasury: await treasury.getAddress(),
    },
    roles,
  };
  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${network.name}.json`), JSON.stringify(out, null, 2));
  console.log(`\nDirecciones guardadas en deployments/${network.name}.json`);

  // ---- 7. Verificación en Etherscan (solo en Sepolia) ----
  if (network.name === "sepolia") {
    const toVerify = [
      ["MockToken", await token.getAddress(), []],
      ["GovernanceTimelock", await timelock.getAddress(), timelockArgs],
      ["GovernedTreasury", await treasury.getAddress(), treasuryArgs],
    ];
    for (const [name, address, constructorArguments] of toVerify) {
      try {
            await hre.run("verify:verify", {
            address,
            constructorArguments,
            contract: `contracts/${name}.sol:${name}`,
            });
      } catch (e) {
        console.log(`No se pudo verificar ${name}: ${e.message.split("\n")[0]}`);
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});