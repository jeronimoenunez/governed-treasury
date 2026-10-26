// Copia al frontend los ABI compilados, las direcciones deployadas y (si existe)
// la evidencia de interact.js. Así el frontend nunca tiene direcciones escritas a mano (RNF-03).
// Uso: node scripts/export-frontend.js sepolia   (o localhost)
const fs = require("fs");
const path = require("path");

const network = process.argv[2] || "sepolia";
const root = path.join(__dirname, "..");
const outDir = path.join(root, "frontend", "src", "contracts");
const depDir = path.join(root, "deployments");

const deployment = JSON.parse(fs.readFileSync(path.join(depDir, `${network}.json`), "utf8"));
const abi = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, "artifacts", "contracts", `${name}.sol`, `${name}.json`), "utf8")).abi;

// Bloque desde el que el panel lee el historial. Si ya estaba cargado a mano en el
// archivo del frontend, se conserva.
const outFile = path.join(outDir, `${network}.json`);
const previous = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
const deployBlock = deployment.deployBlock ?? previous.deployBlock ?? (network === "localhost" ? 0 : undefined);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  outFile,
  JSON.stringify({ chainId: deployment.chainId, deployBlock, contracts: deployment.contracts, roles: deployment.roles }, null, 2)
);
for (const name of ["GovernedTreasury", "MockToken", "GovernanceTimelock"]) {
  fs.writeFileSync(path.join(outDir, `${name}.abi.json`), JSON.stringify(abi(name), null, 2));
}
const evidence = path.join(depDir, `${network}-interactions.json`);
if (fs.existsSync(evidence)) fs.copyFileSync(evidence, path.join(outDir, `${network}-interactions.json`));
console.log(`ABI, direcciones${fs.existsSync(evidence) ? " y evidencia" : ""} de ${network} exportados a frontend/src/contracts/`);
