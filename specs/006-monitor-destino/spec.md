Spec 006 — Monitor: decodificar la llamada programada según su destino (BORRADOR · esperando aprobación)

Estado: borrador. No se toca `scripts/monitor.js` hasta que el usuario apruebe esta spec.

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

Decisión a confirmar
- Ubicación de la prueba. Recomiendo `scripts/check-monitor-destino.js`, fuera de `test/`, para no cambiar el número de tests ("29") que citan el README, `AGENTS.md` y la spec 005. La contra es que no corre en CI. La alternativa es `test/monitor-destino.test.js`: corre con `npm test` y en CI, pero obliga a actualizar el número de tests en esos tres lugares con una corrida nueva.

Documentación
- README, sección Monitor: la fila 🔴 CRÍTICA suma "Cambio programado o ejecutado hacia un destino desconocido" (RF-R11 de la spec 003 pide los niveles tal como están en `monitor.js`).

Fuera de alcance
- Nombres legibles para los roles del timelock (`PROPOSER_ROLE`, `EXECUTOR_ROLE`, `CANCELLER_ROLE`). Hoy los `bytes32` de los argumentos se muestran crudos en todos los casos.
- El campo `value` (ETH) de la operación programada.
- La detección de transacciones rechazadas que entran a través de otro contrato (`monitor.js:123`).

Validación
- [ ] Spec aprobada por el usuario.
- [ ] RF-M1 a RF-M4: salida de `node scripts/check-monitor-destino.js` con los 4 casos OK.
- [ ] RNF-M3: `git diff scripts/monitor.js` acotado a `describeScheduled` y a los `case` de `CallScheduled` y `CallExecuted`.
- [ ] RNF-M4: `grep -nE "dotenv|JsonRpcProvider" scripts/check-monitor-destino.js scripts/lib/describe-call.js` vacío.
- [ ] README: fila CRÍTICA actualizada.
