import { useConnect, useConnection, useDisconnect } from "wagmi";
import { CHAIN } from "../config.js";
import { short } from "../lib/format.js";

const ROLE_LABELS = { operator: "Operador", approver: "Aprobador", guardian: "Guardián" };

export default function Topbar({ roles, head }) {
  const { address, isConnected, chainId } = useConnection();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const myRoles = Object.entries(roles)
    .filter(([, has]) => has)
    .map(([r]) => ROLE_LABELS[r]);
  const onRightChain = chainId === CHAIN.id;

  const hello = !isConnected ? "Tesorería on-chain" : myRoles.length ? `Hola, ${myRoles.join(" y ")}` : "Hola";
  return (
    <header className="topbar">
      <div>
        <h1 className="hello">{hello}</h1>
        <p className="sub">
          Controles de banco sobre una blockchain pública
          {head !== undefined && <> · bloque {head.toLocaleString("es-AR")}</>}
        </p>
      </div>
      <div className="topbar-right">
        <span className={`chip ${isConnected && !onRightChain ? "chip-bad" : "chip-net"}`}>
          <i aria-hidden="true" /> {CHAIN.name}
        </span>
        {isConnected ? (
          <>
            {myRoles.length === 0 && <span className="chip">Sin roles</span>}
            <button className="account" onClick={() => disconnect()} title="Desconectar">
              <span className="avatar" aria-hidden="true" style={{ "--h": parseInt(address.slice(2, 6), 16) % 360 }} />
              <span>
                <strong>{myRoles[0] ?? "Cuenta"}</strong>
                <small>{short(address)}</small>
              </span>
            </button>
          </>
        ) : (
          <button className="pill-btn pill-btn-dark" disabled={isPending || !connectors[0]} onClick={() => connect({ connector: connectors[0] })}>
            {isPending ? "Conectando…" : "Conectar MetaMask"}
          </button>
        )}
      </div>
    </header>
  );
}
