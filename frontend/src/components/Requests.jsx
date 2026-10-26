import { useEffect, useState } from "react";
import { useConnection } from "wagmi";
import { TREASURY, SYMBOL } from "../config.js";
import { fmt, timeLeft, who } from "../lib/format.js";
import { useTx } from "../lib/tx.jsx";

const STATUS = { 1: "Pendiente", 2: "Ejecutada", 3: "Rechazada" };

// Reloj local que avanza cada 30 s; se le suma la diferencia con el reloj de la cadena.
function useClock() {
  const [clock, setClock] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setClock(Math.floor(Date.now() / 1000)), 30000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

export default function Requests({ t, blocked, offset = 0 }) {
  const { address } = useConnection();
  const { run, current } = useTx();
  const now = useClock() + offset;
  const [all, setAll] = useState(false);
  const busy = ["checking", "signing", "pending"].includes(current?.status);
  const pending = t.requests.filter((r) => r.status === 1 && now <= r.expiresAt).length;

  return (
    <section id="doble-firma" className="card requests-panel" aria-labelledby="req-title">
      <div className="card-head">
        <div>
          <h2 id="req-title" className="card-title">Retiros con doble firma</h2>
          <p className="card-sub">Uno pide, otro aprueba. Vencen a los 3 días.</p>
        </div>
        {pending > 0 && <span className="chip chip-amber">{pending} {pending === 1 ? "pendiente" : "pendientes"}</span>}
      </div>

      {t.requests.length === 0 ? (
        <p className="empty">
          Todavía no hay pedidos. Los retiros desde {fmt(t.limits?.threshold)} {SYMBOL} aparecen acá hasta que otra cuenta los apruebe.
        </p>
      ) : (
        <ol className="requests">
          {[...t.requests]
            .sort((a, b) => (b.status === 1) - (a.status === 1))
            .slice(0, all ? undefined : 4)
            .map((r) => {
            const expired = r.status === 1 && now > r.expiresAt;
            const label = expired ? "Vencida" : STATUS[r.status];
            const mine = address && r.requester.toLowerCase() === address.toLowerCase();
            const canApprove = r.status === 1 && !expired && t.roles.approver && !mine;
            const canReject = r.status === 1 && (t.roles.approver || t.roles.guardian || mine);
            return (
              <li key={r.id} className="request">
                <div className="request-main">
                  <span className="request-amount">
                    {fmt(r.amount)} <small>{SYMBOL}</small>
                  </span>
                  <span className="request-meta">
                    Pedido {r.id} de {who(r.requester)} para {who(r.to)}
                    {r.status === 1 && !expired && `, ${timeLeft(r.expiresAt - now)}`}
                  </span>
                </div>
                <span className={`pill pill-${expired ? "expired" : r.status}`}>{label}</span>
                {(canApprove || canReject) && (
                  <div className="request-actions">
                    {canApprove && (
                      <button
                        className="pill-btn pill-btn-lime pill-btn-sm"
                        disabled={busy || blocked}
                        onClick={() => run({ label: `Aprobar pedido ${r.id}`, contract: TREASURY, functionName: "approveWithdrawal", args: [BigInt(r.id)] })}
                      >
                        Aprobar
                      </button>
                    )}
                    {canReject && (
                      <button
                        className="pill-btn pill-btn-ghost pill-btn-sm"
                        disabled={busy}
                        onClick={() => run({ label: `Rechazar pedido ${r.id}`, contract: TREASURY, functionName: "rejectWithdrawal", args: [BigInt(r.id)] })}
                      >
                        {mine && !t.roles.approver && !t.roles.guardian ? "Cancelar" : "Rechazar"}
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {t.requests.length > 4 && (
        <button className="link-btn" onClick={() => setAll((v) => !v)}>
          {all ? "Ver menos" : `Ver todos los pedidos (${t.requests.length})`}
        </button>
      )}
    </section>
  );
}
