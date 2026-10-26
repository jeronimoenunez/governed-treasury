import { useEffect, useMemo, useState } from "react";
import { useConnection, useSwitchChain } from "wagmi";
import { CHAIN, EXPLORER, TREASURY } from "./config.js";
import { useTreasury } from "./lib/useTreasury.js";
import {
  useHistory,
  movements,
  balanceSeries,
  lastDays,
  dailyFlows,
  timelockOps,
  beneficiaries,
} from "./lib/useHistory.js";
import Sidebar from "./components/Sidebar.jsx";
import Topbar from "./components/Topbar.jsx";
import BalanceCard from "./components/BalanceCard.jsx";
import LimitsCard from "./components/LimitsCard.jsx";
import GovernanceCard from "./components/GovernanceCard.jsx";
import FlowsCard from "./components/FlowsCard.jsx";
import SpendCard from "./components/SpendCard.jsx";
import SecurityCard from "./components/SecurityCard.jsx";
import Movements from "./components/Movements.jsx";
import Operate from "./components/Operate.jsx";
import Requests from "./components/Requests.jsx";
import Guardian from "./components/Guardian.jsx";
import { TxStatus } from "./components/Activity.jsx";

const SECTIONS = ["resumen", "operar", "doble-firma", "gobernanza", "seguridad", "movimientos"];

// Resalta en el menú la sección que está en pantalla.
function useActiveSection() {
  const [active, setActive] = useState("resumen");
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (window.scrollY < 120) setActive("resumen");
        else if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5] }
    );
    SECTIONS.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);
  return active;
}

export default function App() {
  const { address, isConnected, chainId } = useConnection();
  const { switchChain, isPending } = useSwitchChain();
  const t = useTreasury(isConnected ? address : undefined);
  const history = useHistory();
  const active = useActiveSection();
  const [openedAt] = useState(() => Math.floor(Date.now() / 1000));

  // RNF-02: con la red equivocada no se puede operar.
  const wrongChain = isConnected && chainId !== CHAIN.id;

  const h = history.data;
  const chainNow = h?.chainNow ?? openedAt;
  const offset = h ? h.chainNow - Math.floor(history.dataUpdatedAt / 1000) : 0;

  const view = useMemo(() => {
    const events = h?.events ?? [];
    const days = lastDays(chainNow);
    const moves = movements(events);
    return {
      moves,
      series: balanceSeries(events, t.vaultBalance, chainNow),
      flows: dailyFlows(events, days),
      ops: timelockOps(events, chainNow),
      beneficiaryCount: h?.complete ? beneficiaries(events).length : null,
    };
  }, [h, chainNow, t.vaultBalance]);

  const pending = t.requests.filter((r) => r.status === 1 && chainNow <= r.expiresAt).length;

  return (
    <div className="shell">
      <Sidebar active={active} pending={pending} />

      <div className="main">
        <Topbar roles={t.roles} head={h?.head} />

        {wrongChain && (
          <div className="banner" role="alert">
            <span>Tu billetera está en otra red. Para operar, cambiá a {CHAIN.name}.</span>
            <button className="pill-btn pill-btn-dark pill-btn-sm" disabled={isPending} onClick={() => switchChain({ chainId: CHAIN.id })}>
              Cambiar a {CHAIN.name}
            </button>
          </div>
        )}
        {t.failed && (
          <div className="banner" role="alert">
            <span>No se pudo leer el contrato. Revisá tu conexión y recargá la página.</span>
          </div>
        )}
        {history.isError && (
          <div className="banner banner-soft" role="status">
            <span>No se pudo leer el historial de eventos con este RPC. El saldo y las operaciones funcionan igual.</span>
          </div>
        )}

        <main id="resumen" className="grid">
          <BalanceCard t={t} series={view.series} flows={view.flows} loading={history.isLoading} />
          <LimitsCard t={t} />
          <GovernanceCard ops={view.ops} minDelay={t.minDelay} chainNow={chainNow} loading={history.isLoading} />

          <FlowsCard flows={view.flows} loading={history.isLoading} />
          <Operate t={t} connected={isConnected} blocked={wrongChain || t.paused} />

          <Requests t={t} blocked={wrongChain || t.paused} offset={offset} />
          <SpendCard loading={history.isLoading} flows={view.flows} limit={t.limits?.daily} moves={view.moves} since={chainNow - 6 * 86400} />

          <div id="seguridad" className="stack">
            <SecurityCard t={t} minDelay={t.minDelay} beneficiaryCount={view.beneficiaryCount} />
            {t.roles.guardian && <Guardian t={t} />}
          </div>
          <Movements moves={view.moves} loading={history.isLoading} />
        </main>

        <footer className="footer">
          Contrato{" "}
          {EXPLORER ? (
            <a href={`${EXPLORER}/address/${TREASURY.address}#code`} target="_blank" rel="noreferrer">
              {TREASURY.address}
            </a>
          ) : (
            TREASURY.address
          )}{" "}
          en {CHAIN.name}. Esta app nunca te pide claves: todas las firmas pasan por tu billetera.
        </footer>
      </div>

      <TxStatus />
    </div>
  );
}
