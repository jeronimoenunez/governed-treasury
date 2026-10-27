import { useState } from "react";
import { EXPLORER, SYMBOL, TREASURY } from "../config.js";
import { dateTime, fmt, who } from "../lib/format.js";
import { useTx } from "../lib/useTx.js";
import Icon from "./Icon.jsx";

const ICONS = { deposit: "down", direct: "arrow", dual: "sign", request: "clock", reject: "x" };

// Movimientos de toda la tesorería (leídos de la cadena) o solo los de esta sesión (RF-09).
export default function Movements({ moves, loading }) {
  const [tab, setTab] = useState("all");
  const { history } = useTx();
  const [limit, setLimit] = useState(8);

  return (
    <section id="movimientos" className="card card-moves" aria-labelledby="mov-title">
      <div className="card-head">
        <h2 id="mov-title" className="card-title">Movimientos</h2>
        <div className="seg-ctl" role="tablist">
          <button role="tab" aria-selected={tab === "all"} className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>
            Toda la tesorería
          </button>
          <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>
            Esta sesión {history.length > 0 && `(${history.length})`}
          </button>
        </div>
      </div>

      {tab === "all" &&
        (moves.length === 0 ? (
          <p className="empty">{loading ? "Leyendo el historial de la cadena…" : "Todavía no hay movimientos."}</p>
        ) : (
          <ul className="tx-list">
            {moves.slice(0, limit).map((m) => (
              <li key={`${m.hash}-${m.index}`} className="tx">
                <span className={`tx-icon tx-${m.kind}`} aria-hidden="true">
                  <Icon name={ICONS[m.kind]} size={18} />
                </span>
                <div className="tx-main">
                  <strong>{m.label}</strong>
                  <span>
                    {dateTime(m.ts)} · {who(m.party)}
                  </span>
                </div>
                <div className="tx-right">
                  <strong className={m.amount !== null && m.amount > 0n ? "pos" : ""}>
                    {m.amount === null ? "—" : `${m.amount > 0n ? "+" : "−"}${fmt(m.amount > 0n ? m.amount : -m.amount)}`}
                    {m.amount !== null && <small> {SYMBOL}</small>}
                  </strong>
                  {EXPLORER && (
                    <a href={`${EXPLORER}/tx/${m.hash}`} target="_blank" rel="noreferrer">
                      Comprobante
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}
      {tab === "all" && moves.length > limit && (
        <button className="link-btn" onClick={() => setLimit((n) => n + 10)}>
          Ver más movimientos
        </button>
      )}

      {tab === "mine" &&
        (history.length === 0 ? (
          <p className="empty">Las operaciones que firmes aparecen acá con su comprobante.</p>
        ) : (
          <ul className="session">
            {history.map((h) => (
              <li key={h.hash} className={h.ok ? "" : "session-fail"}>
                <span>{h.label}</span>
                <time>{h.at.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</time>
                {EXPLORER && (
                  <a href={`${EXPLORER}/tx/${h.hash}`} target="_blank" rel="noreferrer">
                    Comprobante
                  </a>
                )}
              </li>
            ))}
          </ul>
        ))}

      {EXPLORER && (
        <a className="link-all" href={`${EXPLORER}/address/${TREASURY.address}`} target="_blank" rel="noreferrer">
          Historial completo del contrato en Etherscan
        </a>
      )}
    </section>
  );
}
