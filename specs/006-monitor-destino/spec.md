Spec 006 — Monitor: decodificar la llamada programada según su destino

Estado: aprobada por el usuario el 2026-10-27. La prueba va en `scripts/check-monitor-destino.js` y corre como paso del CI (spec 005, RF-C6).

El bug (uno solo)
- `describeScheduled` (`scripts/monitor.js:63-70`) decodifica el `data` de cada `CallScheduled` y `CallExecuted` siempre con el ABI de la tesorería, y la alerta no dice a qué contrato apunta la llamada (`monitor.js:80-86`). El evento trae el destino en `target`, pero el monitor no lo usa.
- Por qué importa: `grantRole` existe en los dos contratos (los dos heredan `AccessControl`). Un `grantRole(PROPOSER_ROLE, atacante)` programado sobre el timelock se lee como si fuera sobre la tesorería. Una llamada a un tercer contrato con un selector que coincida también se "decodifica" como si fuera de la tesorería. El guardián decide si cancela mirando esta alerta, y ahí la alerta le muestra algo equivocado.

Qué es y qué no es
- Es un arreglo en cómo el monitor describe las operaciones del timelock: elige el ABI según `target` y muestra siempre el destino.
- No es un cambio de contrato, no agrega canales ni alertas nuevas fuera de este caso y no toca la detección de transacciones rechazadas.

Requerimientos funcionales
ID	Requerimiento	Criterio de aceptación
RF-M1	Destino tesorería	Dado un `CallScheduled` o `CallExecuted` con `target` = GovernedTreasury, cuando el monitor lo procesa, entonces decodifica `data` con el ABI de la tesorería y la alerta dice `Destino: tesorería (0x…)` y la acción, por ejemplo `setLimits(…)`.
RF-M2	Destino timelock	Dado un `target` = GovernanceTimelock, cuando el monitor lo procesa, entonces decodifica con el ABI del timelock y la alerta dice `Destino: timelock (0x…)` y la acción, por ejemplo `updateDelay(…)` o `grantRole(…)`.
RF-M3	Destino desconocido	Dado un `target` que no es ninguno de los dos, cuando el monitor lo procesa, entonces no intenta decodificar y emite una alerta 🔴 CRÍTICA con el título "destino desconocido", la dirección completa del destino y el selector (los primeros 4 bytes de `data`).
RF-M4	Siempre el destino	En los tres casos, y también cuando `data` no decodifica con el ABI que corresponde ("llamada no reconocida"), la alerta muestra el destino. Para los destinos conocidos, la comparación de direcciones no distingue mayúsculas de minúsculas.

Requerimientos no funcionales
ID	Requerimiento
RNF-M1	Comprobable sin red: la lógica de decodificación queda en una función pura, `describeCall(target, data)`, en `scripts/lib/describe-call.js`. `monitor.js` la importa. Así se prueba sin RPC, sin `.env` y sin Sepolia.
RNF-M2	Prueba con llamadas armadas a mano: `scripts/check-monitor-destino.js` arma el calldata con `Interface.encodeFunctionData` (un `setLimits` hacia la tesorería, un `updateDelay` y un `grantRole` hacia el timelock, y cualquier llamada hacia una dirección ajena), lo pasa por `describeCall` y verifica cada caso con `node:assert`. Se corre con `node scripts/check-monitor-destino.js` y necesita `artifacts/` compilado.
RNF-M3	Cambio chico: el arreglo no reescribe `monitor.js`. Solo cambian `describeScheduled` y los dos `case` que la usan.
RNF-M4	Sin secretos ni red: el script de prueba no carga `dotenv` ni crea un provider.

Decisión tomada
- La prueba va en `scripts/check-monitor-destino.js`, fuera de `test/`, para no cambiar el conteo de tests de Hardhat. Para que no quede fuera de CI, el workflow suma un paso `node scripts/check-monitor-destino.js` después de `npx hardhat test` (que deja `artifacts/` compilado).

Documentación
- README, sección Monitor: la fila 🔴 CRÍTICA suma "Cambio programado o ejecutado hacia un destino desconocido" (RF-R11 de la spec 003 pide los niveles tal como están en `monitor.js`).

Fuera de alcance
- Nombres legibles para los roles del timelock (`PROPOSER_ROLE`, `EXECUTOR_ROLE`, `CANCELLER_ROLE`). Hoy los `bytes32` de los argumentos se muestran crudos en todos los casos.
- El campo `value` (ETH) de la operación programada.
- La detección de transacciones rechazadas que entran a través de otro contrato (`monitor.js:123`).

Validación
- [x] Spec aprobada por el usuario (2026-10-27).
- [x] RF-M1 a RF-M4: `node scripts/check-monitor-destino.js` → 6 casos OK, código de salida 0 (`docs/evidencia/monitor-destino.txt`, 2026-10-27). Son 6 y no 4 porque RF-M2 y RF-M4 tienen dos casos cada uno. El check prueba `describeCall`; el armado del texto de `notify` en `monitor.js` se revisó leyendo el diff, sin red.
- [x] RNF-M3: `git diff scripts/monitor.js` toca `describeScheduled`, los `case` de `CallScheduled` y `CallExecuted` y, además, una línea `require("./lib/describe-call")` al principio, que hace falta para importar la función.
- [x] RNF-M4: `grep -nE "dotenv|JsonRpcProvider" scripts/check-monitor-destino.js scripts/lib/describe-call.js` sin coincidencias (exit 1), 2026-10-27.
- [x] README: la fila CRÍTICA de la sección Monitor suma "Cambio programado o ejecutado hacia un destino desconocido". CI: paso `node scripts/check-monitor-destino.js` en `.github/workflows/ci.yml` (spec 005, RF-C6).
