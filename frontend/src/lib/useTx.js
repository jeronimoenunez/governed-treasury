// Contexto y hook de las transacciones. Van aparte de tx.jsx para que ese archivo
// exporte solo el componente TxProvider (fast refresh de Vite lo necesita así).
import { createContext, useContext } from "react";

export const TxContext = createContext(null);

export const useTx = () => useContext(TxContext);
