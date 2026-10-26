## Plan técnico 001: Frontend

Especificacion: spec.md

## Stack
| Pieza | Elección | Por qué |
|---|---|---|
| Interfaz | React 19 + Vite | React como framework sugerido para web3; Vite arma el proyecto sin servidor |
| Billetera y contratos | wagmi 3 + viem 2 | Hooks para lecturas, simulación previa y decodificación de errores |
| Estado de datos | TanStack Query (vía wagmi) | Caché, refresco periódico e invalidación después de cada transacción |
| Estilos | CSS propio con variables | Identidad visual propia; sin dependencias extra |

## Arquitectura
```
main.jsx         Proveedores: wagmi, React Query, transacciones
config.js        Red, direcciones (desde src/contracts/), ABI, roles
lib/useTreasury  Lecturas en lote (saldo, límites, roles, pedidos)
lib/tx.jsx       Transacción: simular → firmar → esperar bloque → refrescar
lib/errors.js    Custom error → mensaje en castellano
components/      Header, Vault, Operate, Requests, Guardian, Activity
```
## Decisiones
1. **Simular antes de firmar.** `simulateContract` ejecuta la llamada sin enviarla. Si el contrato va a revertir, el usuario ve el motivo y no firma nada (RNF-04). Las transacciones fallidas on-chain se generan solo con el script de interacción, como evidencia.
2. **Lecturas en lote.** `useReadContracts` agrupa las consultas en una sola llamada al nodo.
3. **El contrato es la fuente de verdad.** La interfaz deshabilita acciones según el rol (RNF-05), pero la seguridad real está en el contrato: la interfaz es una ayuda, no un control.
4. **Sin backend.** El frontend habla directo con la blockchain; no hay servidor que atacar ni datos que guardar.
