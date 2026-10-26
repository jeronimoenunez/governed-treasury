import { useState } from "react";
import { isAddress } from "viem";
import { TREASURY } from "../config.js";
import { who } from "../lib/format.js";
import { useTx } from "../lib/tx.jsx";

export default function Guardian({ t }) {
  const { run, current } = useTx();
  const [target, setTarget] = useState("");
  const [confirming, setConfirming] = useState(false);
  const busy = ["checking", "signing", "pending"].includes(current?.status);

  return (
    <section className="card card-guardian" aria-labelledby="guard-title">
      <div className="card-head">
        <h2 id="guard-title" className="card-title">Controles de emergencia</h2>
        <span className="chip chip-bad">Solo guardián</span>
      </div>
      <p className="help">
        Restringir es inmediato. Volver a habilitar pasa por el timelock y tarda 72 horas, así que usalo solo ante un incidente.
      </p>

      <div className="guard-row">
        <div>
          <strong>{t.paused ? "La tesorería está pausada" : "Pausar la tesorería"}</strong>
          <p className="help">Bloquea depósitos, retiros y aprobaciones. Los pedidos se pueden seguir rechazando.</p>
        </div>
        {!t.paused &&
          (confirming ? (
            <div className="confirm">
              <button
                className="pill-btn pill-btn-danger pill-btn-sm"
                disabled={busy}
                onClick={async () => {
                  await run({ label: "Pausar la tesorería", contract: TREASURY, functionName: "pause", args: [] });
                  setConfirming(false);
                }}
              >
                Sí, pausar
              </button>
              <button className="pill-btn pill-btn-ghost pill-btn-sm" onClick={() => setConfirming(false)}>
                No
              </button>
            </div>
          ) : (
            <button className="pill-btn pill-btn-danger pill-btn-sm" disabled={busy} onClick={() => setConfirming(true)}>
              Pausar
            </button>
          ))}
      </div>

      <form
        className="guard-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (isAddress(target))
            run({ label: `Revocar beneficiario ${who(target)}`, contract: TREASURY, functionName: "revokeBeneficiary", args: [target] });
        }}
      >
        <label className="field grow">
          <span>Revocar un beneficiario</span>
          <input placeholder="0x…" value={target} onChange={(e) => setTarget(e.target.value.trim())} spellCheck="false" />
        </label>
        <button className="pill-btn pill-btn-danger pill-btn-sm" disabled={busy || !isAddress(target)}>
          Revocar
        </button>
      </form>
    </section>
  );
}
