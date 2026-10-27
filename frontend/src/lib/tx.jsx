// Ejecuta transacciones de punta a punta: simula, pide la firma, espera la confirmación
// y refresca los datos. Lleva el registro de lo hecho en esta sesión.
import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { getConnection, simulateContract, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { useQueryClient } from "@tanstack/react-query";
import { describeError } from "./errors.js";
import { TxContext } from "./useTx.js";

export function TxProvider({ children }) {
  const config = useConfig();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(null); // { label, status, hash?, message? }
  const [history, setHistory] = useState([]);

  const run = useCallback(
    async ({ label, contract, functionName, args }) => {
      const { address: account } = getConnection(config);
      setCurrent({ label, status: "checking" });
      let hash;
      try {
        // 1. Simulación: si el contrato va a rechazar, lo sabemos antes de firmar.
        const { request } = await simulateContract(config, { ...contract, functionName, args, account });
        // 2. Firma en MetaMask.
        setCurrent({ label, status: "signing" });
        hash = await writeContract(config, request);
        // 3. Esperar a que la red la incluya en un bloque.
        setCurrent({ label, status: "pending", hash });
        const receipt = await waitForTransactionReceipt(config, { hash });
        if (receipt.status !== "success") throw new Error("La transacción fue revertida.");
        setCurrent({ label, status: "success", hash });
        setHistory((h) => [{ label, hash, ok: true, at: new Date() }, ...h]);
        await queryClient.invalidateQueries();
        return true;
      } catch (err) {
        const message = describeError(err);
        setCurrent({ label, status: "error", hash, message });
        if (hash) setHistory((h) => [{ label, hash, ok: false, at: new Date() }, ...h]);
        return false;
      }
    },
    [config, queryClient]
  );

  return (
    <TxContext.Provider value={{ run, current, history, dismiss: () => setCurrent(null) }}>{children}</TxContext.Provider>
  );
}
