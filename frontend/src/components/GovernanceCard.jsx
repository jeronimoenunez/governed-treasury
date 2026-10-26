import Icon from "./Icon.jsx";
import { EXPLORER } from "../config.js";
import { duration, fmt, who } from "../lib/format.js";

// Traduce la llamada programada en el timelock a una frase.
function describe({ functionName, args }) {
  switch (functionName) {
    case "setBeneficiary":
      return args[1] ? `Habilitar como beneficiario a ${who(args[0])}` : `Quitar de beneficiarios a ${who(args[0])}`;
    case "setLimits":
      return `Cambiar límites: diario ${fmt(args[0].dailyLimit)}, sin doble firma ${fmt(args[0].directDailyLimit)}`;
    case "unpause":
      return "Reactivar la tesorería";
    case "grantRole":
      return `Dar un rol a ${who(args[1])}`;
    case "revokeRole":
      return `Quitar un rol a ${who(args[1])}`;
    case "updateDelay":
      return `Cambiar la demora del timelock a ${duration(Number(args[0]))}`;
    default:
      return null;
  }
}

const STATUS = {
  waiting: "En espera",
  ready: "Lista para ejecutar",
  executed: "Ejecutada",
  cancelled: "Cancelada",
};

export default function GovernanceCard({ ops, minDelay, chainNow, loading }) {
  const waiting = ops.filter((o) => o.status === "waiting" || o.status === "ready");
  return (
    <section id="gobernanza" className="card card-dark" aria-labelledby="gov-title">
      <div className="card-head">
        <h2 id="gov-title" className="card-title">Gobernanza</h2>
        <span className="chip chip-dark">
          <Icon name="clock" size={14} /> Timelock {minDelay ? duration(minDelay) : "…"}
        </span>
      </div>
      <p className="dark-num">{loading ? "…" : waiting.length}</p>
      <p className="dark-sub">
        {waiting.length === 1 ? "cambio de reglas en espera" : "cambios de reglas en espera"}
      </p>

      {loading ? (
        <p className="dark-empty">Leyendo el historial del timelock…</p>
      ) : ops.length === 0 ? (
        <p className="dark-empty">Ningún cambio de reglas programado. Para cambiar límites o beneficiarios hay que pasar por acá.</p>
      ) : (
        <ul className="ops">
          {ops.slice(0, 3).map((o) => {
            const text = describe(o.call);
            return (
              <li key={o.id} className="op">
                <span className={`op-dot op-${o.status}`} aria-hidden="true" />
                <div className="op-main">
                  <span className="op-text">
                    {text ?? (
                      <>
                        <Icon name="alert" size={14} /> Llamada no reconocida: revisar antes de que se ejecute
                      </>
                    )}
                  </span>
                  <span className="op-meta">
                    {STATUS[o.status]}
                    {o.status === "waiting" && ` · se puede ejecutar en ${duration(o.eta - chainNow)}`}
                    {EXPLORER && (
                      <>
                        {" · "}
                        <a href={`${EXPLORER}/tx/${o.hash}`} target="_blank" rel="noreferrer">
                          ver
                        </a>
                      </>
                    )}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="dark-foot">Cualquier cambio queda a la vista {minDelay ? duration(minDelay) : ""} antes de aplicarse. El guardián lo puede cancelar.</p>
    </section>
  );
}
