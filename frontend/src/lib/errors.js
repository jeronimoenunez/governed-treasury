// Traduce los errores del contrato a mensajes claros (RNF-04).
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, decodeErrorResult } from "viem";
import { TREASURY, TOKEN } from "../config.js";
import { fmt, short } from "./format.js";

const MESSAGES = {
  ZeroAmount: () => "El monto tiene que ser mayor a cero.",
  ZeroAddress: () => "Falta una dirección válida.",
  BeneficiaryNotAllowed: ([to]) => `${short(to)} no está en la lista de beneficiarios habilitados.`,
  ExceedsPerTxLimit: ([amount, limit]) => `Supera el límite por operación: ${fmt(amount)} de ${fmt(limit)} permitidos.`,
  ExceedsDailyLimit: ([total, limit]) => `Supera el tope diario: el día sumaría ${fmt(total)} y el tope es ${fmt(limit)}.`,
  ExceedsDirectDailyLimit: ([total, limit]) =>
    `Supera el tope diario sin doble firma: sumaría ${fmt(total)} y el tope es ${fmt(limit)}. Pedí el retiro para que lo apruebe otra cuenta.`,
  RequiresApproval: ([, threshold]) => `Desde ${fmt(threshold)} hace falta doble firma: usá "Pedir retiro".`,
  BelowApprovalThreshold: ([, threshold]) => `Menos de ${fmt(threshold)} se retira directo: usá "Retirar".`,
  NotPending: () => "Esta solicitud ya fue resuelta.",
  RequestExpired: () => "La solicitud venció: pasaron más de 3 días desde que se pidió.",
  SelfApprovalNotAllowed: () => "No podés aprobar una solicitud que pediste vos: tiene que firmar otra cuenta.",
  NotAuthorizedToReject: () => "Tu cuenta no puede rechazar esta solicitud.",
  AccessControlUnauthorizedAccount: () => "Tu cuenta no tiene el rol necesario para esta acción.",
  EnforcedPause: () => "La tesorería está pausada por el guardián.",
  ReentrancyGuardReentrantCall: () => "Llamada reentrante bloqueada.",
  ERC20InsufficientAllowance: () => "Primero autorizá a la tesorería a usar tus tokens.",
  ERC20InsufficientBalance: () => "No tenés suficientes tokens.",
};

const ALL_ABIS = [...TREASURY.abi, ...TOKEN.abi];

export function describeError(err) {
  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return "Cancelaste la firma en MetaMask.";

    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert) {
      let name = revert.data?.errorName;
      let args = revert.data?.args ?? [];
      // Errores de otro contrato (por ejemplo el token) que el ABI de la tesorería no conoce.
      if (!name && revert.raw) {
        try {
          const decoded = decodeErrorResult({ abi: ALL_ABIS, data: revert.raw });
          name = decoded.errorName;
          args = decoded.args ?? [];
        } catch {
          /* sin decodificar */
        }
      }
      if (name && MESSAGES[name]) return MESSAGES[name](args);
      if (name) return `El contrato rechazó la operación (${name}).`;
    }
    return err.shortMessage;
  }
  return err?.message ?? "Error desconocido.";
}
