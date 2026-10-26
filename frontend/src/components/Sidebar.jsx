import Icon from "./Icon.jsx";
import { EXPLORER, TREASURY } from "../config.js";

const NAV = [
  { id: "resumen", label: "Resumen", icon: "grid" },
  { id: "operar", label: "Operar", icon: "swap" },
  { id: "doble-firma", label: "Doble firma", icon: "sign" },
  { id: "gobernanza", label: "Gobernanza", icon: "clock" },
  { id: "seguridad", label: "Seguridad", icon: "shield" },
  { id: "movimientos", label: "Movimientos", icon: "list" },
];

export default function Sidebar({ active, pending }) {
  return (
    <aside className="sidebar">
      <a className="brand" href="#resumen" aria-label="GovernedTreasury, ir al resumen">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="shield" size={18} />
        </span>
        <span className="brand-name">GovernedTreasury</span>
      </a>

      <nav className="nav" aria-label="Secciones">
        <p className="nav-group">Tesorería</p>
        {NAV.map((n) => (
          <a key={n.id} href={`#${n.id}`} className={`nav-item ${active === n.id ? "nav-on" : ""}`}>
            <Icon name={n.icon} />
            <span>{n.label}</span>
            {n.id === "doble-firma" && pending > 0 && <span className="nav-badge">{pending}</span>}
          </a>
        ))}
      </nav>

      <div className="side-card">
        <span className="side-card-icon" aria-hidden="true">
          <Icon name="check" />
        </span>
        <strong>Código verificado</strong>
        <p>Lo que ves en el panel lo ejecuta un contrato público. Cualquiera puede leer su código.</p>
        {EXPLORER && (
          <a className="pill-btn pill-btn-dark" href={`${EXPLORER}/address/${TREASURY.address}#code`} target="_blank" rel="noreferrer">
            Ver en Etherscan <Icon name="arrow" size={16} />
          </a>
        )}
      </div>
    </aside>
  );
}
