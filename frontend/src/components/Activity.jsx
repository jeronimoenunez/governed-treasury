import { EXPLORER } from "../config.js";
import { useTx } from "../lib/tx.jsx";

const STATUS_TEXT = {
  checking: "Verificando con el contrato…",
  signing: "Confirmá en MetaMask",
  pending: "Esperando que la red la incluya en un bloque…",
  success: "Listo",
};

// Estado de la transacción en curso (abajo de la pantalla).
export function TxStatus() {
  const { current, dismiss } = useTx();
  if (!current) return null;
  const done = current.status === "success" || current.status === "error";
  return (
    <div className={`toast toast-${current.status}`} role="status" aria-live="polite">
      <div>
        <strong>{current.label}</strong>
        <p>{current.status === "error" ? current.message : STATUS_TEXT[current.status]}</p>
        {current.hash && EXPLORER && (
          <a href={`${EXPLORER}/tx/${current.hash}`} target="_blank" rel="noreferrer">
            Ver en Etherscan
          </a>
        )}
      </div>
      {done && (
        <button className="toast-close" onClick={dismiss} aria-label="Cerrar">
          ×
        </button>
      )}
    </div>
  );
}
