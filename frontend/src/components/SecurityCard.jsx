import Icon from "./Icon.jsx";
import { EVIDENCE, EXPLORER, KNOWN_ROLES, REPO_URL } from "../config.js";
import { duration, fmt } from "../lib/format.js";

export default function SecurityCard({ t, minDelay, beneficiaryCount }) {
  const l = t.limits;
  const distinct = new Set([KNOWN_ROLES.operator, KNOWN_ROLES.approver, KNOWN_ROLES.guardian].map((a) => a?.toLowerCase())).size === 3;
  const controls = [
    { ok: distinct, title: "Funciones separadas", detail: "Operador, aprobador y guardián son cuentas distintas" },
    { ok: Boolean(l), title: "Doble firma", detail: l ? `Desde ${fmt(l.threshold)}: pide uno, aprueba otro` : "…" },
    { ok: Boolean(l), title: "Topes", detail: l ? `${fmt(l.perTx)} por operación · ${fmt(l.daily)} por día` : "…" },
    {
      ok: true,
      title: "Lista de destinos",
      detail: beneficiaryCount === null ? "Solo a direcciones habilitadas" : `Solo a ${beneficiaryCount} ${beneficiaryCount === 1 ? "dirección habilitada" : "direcciones habilitadas"}`,
    },
    { ok: Boolean(minDelay), title: "Reglas con demora", detail: minDelay ? `Todo cambio espera ${duration(minDelay)}` : "…" },
    { ok: !t.paused, title: "Freno de emergencia", detail: t.paused ? "Activado: la tesorería está pausada" : "Disponible para el guardián" },
  ];
  const attacks = (EVIDENCE ?? []).filter((r) => String(r.resultado).startsWith("rechazada"));

  return (
    <section className="card card-security" aria-labelledby="sec-title">
      <div className="card-head">
        <h2 id="sec-title" className="card-title">Controles activos</h2>
        <span className="chip chip-soft">Leídos del contrato</span>
      </div>
      <ul className="controls">
        {controls.map((c) => (
          <li key={c.title}>
            <span className={`ctl-icon ${c.ok ? "ctl-ok" : "ctl-warn"}`}>
              <Icon name={c.ok ? "check" : "alert"} size={16} />
            </span>
            <div>
              <strong>{c.title}</strong>
              <span>{c.detail}</span>
            </div>
          </li>
        ))}
      </ul>

      {attacks.length > 0 && (
        <div className="attacks">
          <p className="attacks-title">
            <strong>{attacks.length} intentos de ataque rechazados</strong> en las pruebas sobre {EXPLORER ? "Sepolia" : "la red local"}
          </p>
          <ul>
            {attacks.map((a) => (
              <li key={a.paso}>
                <Icon name="x" size={14} />
                <span>{a.paso}</span>
                {a.link && a.link.startsWith("http") ? (
                  <a href={a.link} target="_blank" rel="noreferrer">
                    {a.resultado.replace("rechazada: ", "").replace("rechazada", "revert")}
                  </a>
                ) : (
                  <code>{a.resultado.replace("rechazada: ", "")}</code>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {REPO_URL && (
        <a className="pill-btn pill-btn-light" href={REPO_URL} target="_blank" rel="noreferrer">
          Tests, fuzzing y auditoría en el repositorio <Icon name="arrow" size={16} />
        </a>
      )}
    </section>
  );
}
