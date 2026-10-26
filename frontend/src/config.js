// Configuración de red, contratos y wagmi.
// La red se elige con VITE_NETWORK (sepolia por defecto). Las direcciones y los ABI
// vienen de src/contracts/, generados por scripts/export-frontend.js (RNF-03).
import { http, createConfig } from "wagmi";
import { sepolia, hardhat } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { keccak256, stringToBytes } from "viem";
import treasuryAbi from "./contracts/GovernedTreasury.abi.json";
import tokenAbi from "./contracts/MockToken.abi.json";
import timelockAbi from "./contracts/GovernanceTimelock.abi.json";

export const NETWORK = import.meta.env.VITE_NETWORK || "sepolia";
export const CHAIN = NETWORK === "localhost" ? hardhat : sepolia;

const files = import.meta.glob("./contracts/*.json", { eager: true, import: "default" });
const deployment = files[`./contracts/${NETWORK}.json`];
if (!deployment) throw new Error(`Falta src/contracts/${NETWORK}.json: corré scripts/export-frontend.js`);

export const ADDRESSES = deployment.contracts;
export const KNOWN_ROLES = deployment.roles;
export const TREASURY = { address: ADDRESSES.GovernedTreasury, abi: treasuryAbi };
export const TOKEN = { address: ADDRESSES.MockToken, abi: tokenAbi };
export const TIMELOCK = { address: ADDRESSES.GovernanceTimelock, abi: timelockAbi };

// Desde qué bloque se lee el historial de eventos (el del deploy, o uno anterior).
export const FROM_BLOCK = deployment.deployBlock === undefined ? null : BigInt(deployment.deployBlock);

// Evidencia de scripts/interact.js (intentos de ataque rechazados), si se exportó.
export const EVIDENCE = files[`./contracts/${NETWORK}-interactions.json`] ?? null;

// Mismo cálculo que en Solidity: keccak256("OPERATOR_ROLE")
export const ROLE_IDS = {
  operator: keccak256(stringToBytes("OPERATOR_ROLE")),
  approver: keccak256(stringToBytes("APPROVER_ROLE")),
  guardian: keccak256(stringToBytes("GUARDIAN_ROLE")),
};

export const EXPLORER = NETWORK === "sepolia" ? "https://sepolia.etherscan.io" : null;
export const REPO_URL = import.meta.env.VITE_REPO_URL || null;
export const SYMBOL = "mARS";

export const wagmiConfig = createConfig({
  chains: [CHAIN],
  connectors: [injected()],
  transports: { [CHAIN.id]: http(import.meta.env.VITE_RPC_URL || undefined) },
});
