import { useState } from "react";
import { isAddress } from "viem";
import { TREASURY, TOKEN, KNOWN_ROLES, SYMBOL } from "../config.js";
import { fmt, short, toWei, who } from "../lib/format.js";
import { useTx } from "../lib/tx.jsx";

const TABS = [
  { id: "deposit", label: "Depositar" },
  { id: "withdraw", label: "Retirar", needs: "operator" },
  { id: "request", label: "Pedir retiro", needs: "operator" },
];

export default function Operate({ t, connected, blocked }) {
  const [tab, setTab] = useState("deposit");
  const [amount, setAmount] = useState("");
  const [to, setTo] = useState(KNOWN_ROLES.beneficiary);
  const { run, current } = useTx();

  const wei = toWei(amount);
  const busy = ["checking", "signing", "pending"].includes(current?.status);
  const active = TABS.find((x) => x.id === tab);
  const lacksRole = active.needs && !t.roles[active.needs];
  const threshold = t.limits?.threshold;

  let hint = "";
  if (wei && threshold !== undefined) {
    if (tab === "withdraw" && wei >= threshold) hint = `Desde ${fmt(threshold)} hace falta doble firma: usá "Pedir retiro".`;
    if (tab === "request" && wei < threshold) hint = `Menos de ${fmt(threshold)} se retira directo: usá "Retirar".`;
  }
  const toValid = isAddress(to);
  const needsApprove = tab === "deposit" && wei && t.myAllowance !== undefined && t.myAllowance < wei;
  const disabled = !connected || blocked || busy || !wei || lacksRole || Boolean(hint) || (tab !== "deposit" && !toValid);

  async function submit(e) {
    e.preventDefault();
    if (disabled) return;
    let ok = false;
    if (tab === "deposit" && needsApprove) {
      ok = await run({ label: `Autorizar ${fmt(wei)} ${SYMBOL}`, contract: TOKEN, functionName: "approve", args: [TREASURY.address, wei] });
      return; // el depósito queda como segundo paso
    }
    if (tab === "deposit") ok = await run({ label: `Depositar ${fmt(wei)} ${SYMBOL}`, contract: TREASURY, functionName: "deposit", args: [wei] });
    if (tab === "withdraw") ok = await run({ label: `Retirar ${fmt(wei)} ${SYMBOL} a ${who(to)}`, contract: TREASURY, functionName: "withdraw", args: [to, wei] });
    if (tab === "request") ok = await run({ label: `Pedir retiro de ${fmt(wei)} ${SYMBOL} a ${who(to)}`, contract: TREASURY, functionName: "requestWithdrawal", args: [to, wei] });
    if (ok) setAmount("");
  }

  // Lo que se va a firmar, dicho en castellano antes de abrir MetaMask (RNF-07).
  let summary = "";
  if (wei) {
    if (tab === "deposit")
      summary = needsApprove
        ? `Paso 1 de 2: autorizás a la tesorería a tomar ${fmt(wei)} ${SYMBOL} de tu cuenta.`
        : `Paso 2 de 2: depositás ${fmt(wei)} ${SYMBOL} en la bóveda.`;
    if (tab === "withdraw" && toValid) summary = `Enviás ${fmt(wei)} ${SYMBOL} a ${who(to)} (${short(to)}), sin segunda firma.`;
    if (tab === "request" && toValid) summary = `Pedís enviar ${fmt(wei)} ${SYMBOL} a ${who(to)}. No sale nada hasta que lo apruebe otra cuenta.`;
  }

  const cta = {
    deposit: needsApprove ? "Autorizar tokens" : "Depositar",
    withdraw: "Retirar",
    request: "Pedir retiro",
  }[tab];

  return (
    <section id="operar" className="card operate" aria-labelledby="operate-title">
      <div className="card-head">
        <h2 id="operate-title" className="card-title">Operar</h2>
        {blocked && connected && <span className="chip chip-bad">Bloqueado</span>}
      </div>

      <div className="tabs" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={tab === x.id}
            className={`tab ${tab === x.id ? "tab-on" : ""}`}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="form">
        <label className="field">
          <span>Monto</span>
          <div className="amount">
            <input
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-describedby="op-help"
            />
            <span>{SYMBOL}</span>
          </div>
        </label>

        {tab !== "deposit" && (
          <label className="field">
            <span>Destino</span>
            <input value={to} onChange={(e) => setTo(e.target.value.trim())} spellCheck="false" />
            {!toValid && to && <em className="field-error">No es una dirección válida.</em>}
          </label>
        )}

        <p id="op-help" className="help">
          {!connected && "Conectá tu billetera para operar."}
          {connected && lacksRole && "Esta acción es solo para la cuenta operadora."}
          {connected && !lacksRole && (hint || summary || (tab === "deposit" ? `Tu saldo: ${fmt(t.myBalance)} ${SYMBOL}` : ""))}
        </p>

        <button className="pill-btn pill-btn-lime pill-btn-block" disabled={disabled}>
          {cta}
        </button>
      </form>
    </section>
  );
}
