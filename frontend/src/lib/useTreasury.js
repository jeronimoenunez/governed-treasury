// Lecturas de la blockchain (gratis, sin firmar): estado de la bóveda, roles y solicitudes.
import { useReadContracts } from "wagmi";
import { TREASURY, TOKEN, TIMELOCK, ROLE_IDS } from "../config.js";

const LIVE = { refetchInterval: 15000 };

export function useTreasury(account) {
  const base = useReadContracts({
    contracts: [
      { ...TOKEN, functionName: "balanceOf", args: [TREASURY.address] },
      { ...TREASURY, functionName: "remainingToday" },
      { ...TREASURY, functionName: "limits" },
      { ...TREASURY, functionName: "paused" },
      { ...TREASURY, functionName: "nextRequestId" },
      { ...TIMELOCK, functionName: "getMinDelay" },
    ],
    query: LIVE,
  });

  const mine = useReadContracts({
    contracts: account
      ? [
          { ...TREASURY, functionName: "hasRole", args: [ROLE_IDS.operator, account] },
          { ...TREASURY, functionName: "hasRole", args: [ROLE_IDS.approver, account] },
          { ...TREASURY, functionName: "hasRole", args: [ROLE_IDS.guardian, account] },
          { ...TOKEN, functionName: "balanceOf", args: [account] },
          { ...TOKEN, functionName: "allowance", args: [account, TREASURY.address] },
        ]
      : [],
    query: { ...LIVE, enabled: Boolean(account) },
  });

  const [vaultBalance, remaining, limits, paused, nextRequestId, minDelay] = (base.data ?? []).map((r) => r.result);
  const count = Number(nextRequestId ?? 0n);

  const reqs = useReadContracts({
    contracts: Array.from({ length: count }, (_, i) => ({ ...TREASURY, functionName: "requests", args: [BigInt(i)] })),
    query: { ...LIVE, enabled: count > 0 },
  });

  const [isOperator, isApprover, isGuardian, myBalance, myAllowance] = (mine.data ?? []).map((r) => r.result);

  const requests = (reqs.data ?? [])
    .map((r, id) => {
      if (!r.result) return null;
      const [to, amount, requester, status, expiresAt] = r.result;
      return { id, to, amount, requester, status: Number(status), expiresAt: Number(expiresAt) };
    })
    .filter(Boolean)
    .reverse();

  return {
    loading: base.isLoading,
    failed: base.isError,
    vaultBalance,
    remainingTotal: remaining?.[0],
    remainingDirect: remaining?.[1],
    limits: limits && {
      perTx: limits[0],
      daily: limits[1],
      threshold: limits[2],
      directDaily: limits[3],
    },
    paused,
    minDelay: minDelay === undefined ? undefined : Number(minDelay),
    requests,
    roles: { operator: Boolean(isOperator), approver: Boolean(isApprover), guardian: Boolean(isGuardian) },
    myBalance,
    myAllowance,
  };
}
