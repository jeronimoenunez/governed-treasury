# Checklist de entrega — GovernedTreasury

Autor: Jerónimo Núñez · entrega individual · revisado el 2026-10-27.

Leyenda: ✅ cumple, con evidencia · ⚠️ cumple en parte o con una salvedad explicada · ❌ no cumple · ⏳ pendiente (lo hace el autor).

La verificación del código fue **en modo lectura**: `contracts/` no se modificó (`git diff --stat contracts/` vacío; ver [`evidencia/mutacion.txt`](evidencia/mutacion.txt), sección 5). Las líneas citadas son de `contracts/GovernedTreasury.sol` salvo que se indique otro archivo.

## A. Alcance del proyecto

| Punto | Estado | Evidencia |
|---|---|---|
| Pertinente para Web3 | ✅ | Tesorería on-chain con controles que no dependen de un operador de confianza. Por qué blockchain y cuándo no conviene: README, sección "¿Por qué blockchain?" (`README.md:11`) |
| Flujo principal demostrable | ✅ | Pedido de retiro → aprobación con doble firma → pago, en Sepolia: pasos 2 y 3 de `deployments/sepolia-interactions.json` (`README.md:185`) |
| Hardhat o Foundry | ✅ | Los dos: `hardhat.config.js` y `foundry.toml` |
| Al menos una interacción entre contratos | ✅ | La tesorería llama al token con `safeTransfer`/`safeTransferFrom` (líneas 275, 295 y 347). El timelock llama a la tesorería al ejecutar (por ejemplo, el test *"pasadas las 72 horas, los cambios legítimos se aplican"*, `test/GovernedTreasury.test.js:364`) |
| Contratos propios desplegados en red EVM | ✅ | Sepolia, `deployments/sepolia.json` (chainId 11155111) |
| Verificados, con URL directa al código en el README | ✅ | `README.md:28-30`, links `…#code`. Etherscan muestra los tres como *Source Code Verified — Exact Match* (consultado el 2026-10-27) |
| Lo desplegado corresponde al código del repo | ⚠️ | Etherscan: *Exact Match*, compilados con v0.8.24+commit.e11b9ed9, optimizer en 200 runs y EVM cancun, la misma configuración que `hardhat.config.js`. El último cambio de `contracts/` (commit `455ca1e`, 2026-10-26 01:45 UTC) es anterior al deploy (2026-10-26 10:57 UTC). **No se comparó byte a byte** el bytecode desplegado contra una compilación local: hace falta una lectura contra Sepolia, que requiere confirmación |
| Al menos una interacción real on-chain del flujo principal | ✅ | 7 acciones ejecutadas y 4 ataques rechazados con hash: `README.md:185-203`, `deployments/sepolia-interactions.json` |

## B. Calidad del contrato

| Punto | Estado | Evidencia |
|---|---|---|
| NatSpec: variables de estado | ⚠️ | Todas tienen `@notice` (líneas 69-97). A los getters de las variables públicas les falta `@return`: solc (`--devdoc`) no registra `returns` para los 10 getters (`token`, `limits`, `requests`, etc.). Los campos de los structs se documentan con comentarios en línea (líneas 32-63), no con etiquetas |
| NatSpec: eventos y parámetros | ✅ | 7 eventos propios con `@notice` y `@param` (líneas 103-151); comprobado con `solc --devdoc --userdoc` |
| NatSpec: custom errors y parámetros | ✅ | 15 errores con `@notice` y `@param` (líneas 157-217); comprobado con solc |
| NatSpec: funciones (descripción, params, returns) | ✅ | Todas las funciones propias tienen descripción, `@param` y `@return` (`requestWithdrawal`, `remainingToday`); las privadas, `@dev` y `@param`. `GovernanceTimelock` y `MockToken`: completos. Comprobado con solc |
| NatSpec: modifiers | ✅ (no aplica) | No hay modifiers propios. Se usan `onlyRole`, `whenNotPaused` y `nonReentrant` de OpenZeppelin, documentados allí |
| Custom errors en lugar de strings | ✅ | No hay ningún `require(` ni `revert("…")` en `contracts/` (grep vacío). Todos los reverts son errores con datos |
| Sin strings/bytes largos innecesarios | ✅ | Solo el nombre y el símbolo de `MockToken` |
| Sin lecturas/escrituras repetidas a storage | ⚠️ | `withdraw` y `requestWithdrawal` copian `limits` a memoria una vez (líneas 290 y 308). En `approveWithdrawal` se lee `req.requester` dos veces (líneas 338 y 346), y `status`, `expiresAt` y `requester` comparten slot pero se leen por separado. Son lecturas *warm* de 100 gas cada una: ahorro chico, y el contrato desplegado no se toca |
| storage/memory/calldata correctos | ✅ | `setLimits(Limits calldata)` (línea 383), puntero `storage` para el pedido en `approveWithdrawal`/`rejectWithdrawal` (líneas 335 y 355), copias a `memory` donde se leen varios campos |
| constant e immutable cuando corresponde | ✅ | Roles y `REQUEST_TTL` son `constant` (líneas 70-79); `token` es `immutable` (línea 82) |
| Visibilidad y mutabilidad adecuadas | ✅ | Funciones de entrada `external`; `remainingToday` es `view`; helpers `private` |
| Eventos para operaciones relevantes | ✅ | Depósito, retiro, pedido, aprobación, rechazo, beneficiario y límites (líneas 274-484). Pausa y roles, con los eventos de OpenZeppelin (`Paused`, `RoleGranted`…) |
| CEI | ✅ | Checks → efectos → interacción, marcado en el código (líneas 293-295 y 343-347). Test de reentrancy: `test/GovernedTreasury.test.js:378` |
| Control de acceso correcto y roles documentados en NatSpec | ✅ | `onlyRole` en cada función sensible; roles documentados en las líneas 16-19 y 69-76. Riesgos de los roles privilegiados en [`auditoria.md`](auditoria.md) (GT-01, GT-02, GT-06) |
| Transferencias seguras con SafeERC20 | ✅ | `using SafeERC20 for IERC20` (línea 21); `safeTransfer`/`safeTransferFrom` en las líneas 275, 295 y 347 |
| Sin estado ni cálculos innecesarios | ✅ | Estado mínimo: límites, allowlist, gasto por día y pedidos |
| Nombres claros y estructura auditable | ✅ | Secciones comentadas (tipos, estado, eventos, errores, operación, administración, emergencia, lectura, privadas) |
| Sin tx.origin, delegatecall, selfdestruct ni assembly innecesarios | ✅ | grep vacío en `contracts/`. El único assembly es el de `TransientSlot` de OpenZeppelin, que usa `ReentrancyGuardTransient` |
| unchecked cuando es seguro y ahorra gas | ⚠️ | No se usa `unchecked`. El único bucle (constructor, línea 255) usa `++i` con `i < len`; desde Solidity 0.8.22 el compilador ya omite el chequeo de overflow de ese incremento. Quedan restas protegidas por una comparación previa en `remainingToday` (líneas 423-424), que es `view` y no le cuesta gas a nadie en una llamada externa. Ahorro marginal; no se toca el contrato desplegado |
| Proxies: inicialización y permisos | ✅ (no aplica) | Sin proxy, por diseño (`README.md`, Decisiones de diseño) |

## C. Testing

| Punto | Estado | Evidencia |
|---|---|---|
| 100 % de los tests pasa | ✅ | `npm test`: 29 passing ([`evidencia/test.txt`](evidencia/test.txt)). `npm run fuzz`: 14 passed, 0 failed ([`evidencia/fuzz.txt`](evidencia/fuzz.txt)). Check del monitor: 6 casos OK ([`evidencia/monitor-destino.txt`](evidencia/monitor-destino.txt)) |
| Al menos un test del flujo principal exitoso | ✅ | *"flujo completo: el operador pide, el aprobador firma y se ejecuta"*, `test/GovernedTreasury.test.js:222` |
| Al menos un test de revert | ✅ | Por ejemplo, *"una cuenta sin rol no puede retirar"*, `test/GovernedTreasury.test.js:146` (y los demás bloques "ATAQUE") |
| Coverage > 40 % en todas las métricas del código propio | ✅ | Total: 100 % statements, 75 % branches, 100 % functions, 100 % lines. Mínimo por archivo: `MockToken.sol`, 50 % branches ([`evidencia/coverage.txt`](evidencia/coverage.txt)) |

## D. Análisis estático

| Punto | Estado | Evidencia |
|---|---|---|
| Slither sobre el contrato principal | ✅ | Slither 0.11.6: 30 contratos, 102 detectores ([`evidencia/slither.txt`](evidencia/slither.txt)) |
| Findings que requerían corrección, corregidos | ✅ | Ningún finding requería corrección |
| Los que quedan identificados (falso positivo / aceptado / fuera de alcance) | ✅ | 1 finding, `timestamp` en `approveWithdrawal` (línea 337): aceptado (`README.md:177`) |
| Todo lo aceptado con justificación técnica | ✅ | Vencimiento de 3 días; después del Merge el timestamp queda fijado por el slot; no se usa como aleatoriedad |
| Nada relevante sin corregir | ⚠️ | En Slither, nada. La revisión manual sí encontró hallazgos (GT-01 a GT-06): no se corrigen porque el contrato está desplegado. Están documentados con PoC y fix para la v2 en [`auditoria.md`](auditoria.md) y en la spec 007 |

## E. Frontend y demo

| Punto | Estado | Evidencia |
|---|---|---|
| Frontend que interactúa realmente con los contratos y demuestra el flujo principal | ✅ | Simula y firma con wagmi (`frontend/src/lib/tx.jsx:24-27`): depositar, retirar y pedir (`frontend/src/components/Operate.jsx:42-44`), aprobar (`Requests.jsx:70`) y pausar (`Guardian.jsx:35`). Validado de punta a punta con Playwright contra la red local (`specs/001-frontend/tasks.md:21`) |
| Demo con evidencia real on-chain | ⚠️ | La captura [`panel.png`](panel.png) muestra el panel conectado a Sepolia, leyendo el saldo real de la bóveda (9.240 mARS). Las transacciones on-chain registradas con hash salen de `scripts/interact.js`, no del panel. Faltan los hashes de operaciones hechas desde el panel en Sepolia (validación manual pendiente en la spec 001) |
| Complejidad acorde al nivel avanzado | ✅ | Tres contratos con timelock, roles y doble firma; fuzzing con invariantes, PoCs y prueba de mutación; monitor con alertas; CI |
| Se priorizó lo funcional antes que complejidad sin valor | ✅ | Panel sin backend ni librerías de gráficos (dependencias en `frontend/package.json`: react, wagmi, viem, react-query) |

## F. Repositorio y README

| Punto | Estado | Evidencia |
|---|---|---|
| Repo público | ✅ | `api.github.com/repos/jeronimoenunez/governed-treasury` → `"visibility": "public"` (consultado el 2026-10-27) |
| Al menos un commit de cada integrante (individual) | ✅ | `git log`: 3 commits de Jerónimo Núñez |
| Sin private keys, mnemonics ni API keys | ✅ | grep sobre todos los archivos versionados y nuevos: solo marcadores `0x...` de `.env.example`. Los hex de 64 caracteres son hashes de tx públicos de `sepolia-interactions.json`, el hash de `PROPOSER_ROLE` y una semilla de fuzzing. `.env` está en `.gitignore` |
| `.env.example` | ✅ | `.env.example` |
| Compila sin warnings relevantes sin analizar | ✅ | `npx hardhat compile --force`: 5 warnings, todos de `node_modules/@openzeppelin/contracts/utils/TransientSlot.sol` (uso de `tstore`). El mismo mensaje del compilador dice que usarlo para un guard de reentrancy que se limpia al terminar la llamada es seguro, y ese es el caso de `ReentrancyGuardTransient`. Contratos propios: 0 warnings |
| README: qué hace y arquitectura | ✅ | `README.md:7` y `README.md:51` (diagrama Mermaid) |
| README: cómo instalar y compilar | ✅ | `README.md:242-251` |
| README: cómo correr tests y coverage | ✅ | `README.md:252-253` |
| README: cómo correr Slither | ✅ | `README.md:256` |
| README: cómo usarlo | ✅ | Panel web (`README.md:216`) y `npm run dev` (`README.md:296`); monitor (`README.md:232`) |
| README: red y direcciones | ✅ | `README.md:24-32` |
| README: URL al código verificado | ✅ | `README.md:28-30` |
| README: links o hashes de tx reales del flujo principal | ✅ | `README.md:185-203` |
| README: limitaciones conocidas del MVP | ✅ | `README.md:86` (Riesgos conocidos, con IDs y PoC) y [`auditoria.md`](auditoria.md) |
| README: roadmap | ✅ | `README.md:313` |

## G. Video

| Punto | Estado | Evidencia |
|---|---|---|
| Video de 5 minutos como máximo, con evidencia real del proyecto funcionando | ⏳ | Lo graba el autor |

## H. Opcional

| Punto | Estado | Evidencia |
|---|---|---|
| Frontend desplegado públicamente | ⏳ (opcional) | No está desplegado. Figura en el Roadmap (Vercel) |
