# Informe de revisión de seguridad — GovernedTreasury

| | |
|---|---|
| Proyecto | GovernedTreasury (proyecto final del Ethereum Developer Pack, ETH Kipu · Talento Tech) |
| Autor del proyecto y de esta revisión | Jerónimo Núñez (entrega individual) |
| Tipo de revisión | Revisión interna asistida por IA. **No es una auditoría externa ni independiente** |
| Fecha | 2026-10-27 |
| Spec | [`specs/008-red-team/spec.md`](../specs/008-red-team/spec.md) |

## 1. Resumen

Se revisaron los tres contratos desplegados en Sepolia y el monitor de alertas. No se encontró ninguna forma de que una cuenta **sin** rol mueva fondos o cambie reglas: el control de acceso, la doble firma, la allowlist, los topes y el timelock se comportan como dice el README. Los fuzz tests y las invariantes lo confirman.

Los hallazgos están en otro lado: qué puede hacer un rol privilegiado comprometido o malicioso, y algunos bordes de diseño. Cada hallazgo on-chain tiene una prueba de concepto (PoC) ejecutable que **pasa cuando el ataque funciona**.

| Severidad | Cantidad | IDs |
|---|---|---|
| Alta | 0 | — |
| Media | 3 | GT-01, GT-02, GT-07 |
| Baja | 2 | GT-03, GT-06 |
| Informativa | 3 | GT-04, GT-05, GT-08 |

Estado: GT-01 a GT-06, reconocidos, con fix previsto para la v2 (exige deploy nuevo; ver [spec 007](../specs/007-safe-y-rotacion/spec.md)). GT-07 y GT-08, corregidos en este ciclo.

## 2. Alcance

| Elemento | Detalle |
|---|---|
| Repositorio | `github.com/jeronimoenunez/governed-treasury` |
| Último cambio de `contracts/` | commit `455ca1e` (2026-10-25 22:45 -03:00). El deploy en Sepolia es posterior: 2026-10-26 10:57 UTC (`deployments/sepolia.json`) |
| HEAD al momento de la revisión | `2117e2e`, más los cambios sin commitear de las specs 006 y 008, que no tocan `contracts/` |
| `contracts/GovernedTreasury.sol` | SHA-256 `d20c9bc494a1bb4c308ecc2aeaff95b3c5308c85c1dd0b15890b49e485567e26` |
| `contracts/GovernanceTimelock.sol` | SHA-256 `df88009e6b44bcff4c726e7a6ee818c514a489689b89a070280ad00f53751963` |
| `contracts/MockToken.sol` | SHA-256 `9fed10b8ffe774407105ad76edb990447c4efe5758fabe7a39738325fc7c5b6a` |
| Off-chain | `scripts/monitor.js`, solo por GT-07 |
| Configuración auditada | La de `scripts/deploy.js`: delay de 72 h. El proponente es el único que programa y el único que ejecuta (`deploy.js:52`); el guardián tiene permiso de cancelar en el timelock (`deploy.js:57`); el deployer renuncia al admin (`deploy.js:58`). Límites 1.000 por operación / 3.000 por día / doble firma desde 500 / 1.000 por día sin doble firma, y fondeo de 10.000 mARS |
| Fuera de alcance | OpenZeppelin 5.6.1 (se asume correcto), el frontend, la custodia de claves y la infraestructura RPC |

**Correspondencia con lo desplegado.** Etherscan muestra los tres contratos como *Source Code Verified — Exact Match*, compilados con v0.8.24+commit.e11b9ed9, optimizer en 200 runs y EVM cancun: la misma configuración que `hardhat.config.js`. Consultado el 2026-10-27. En esta revisión **no** se comparó byte a byte el bytecode desplegado contra una compilación local.

## 3. Metodología

1. **Revisión manual asistida por IA.** Un agente de código (Claude Code) propuso preguntas de ataque y posibles hallazgos. Cada uno se verificó contra el código, línea por línea, antes de entrar a este informe. Lo que no se pudo respaldar con un archivo o una ejecución se descartó o quedó marcado como no verificado.
2. **Análisis estático.** Slither 0.11.6: 30 contratos, 102 detectores, 1 hallazgo (`timestamp`, aceptado; ver [README](../README.md#análisis-estático--npm-run-slither)). Salida: [`evidencia/slither.txt`](evidencia/slither.txt).
3. **Tests unitarios** (Hardhat): 29 passing. Salida: [`evidencia/test.txt`](evidencia/test.txt).
4. **Fuzzing e invariantes** (Foundry 1.7.1): 4 fuzz tests de 1.000 corridas y 4 invariantes de 256 corridas × 50 llamadas, con un handler que mezcla operaciones legítimas y ataques. Salida: [`evidencia/fuzz.txt`](evidencia/fuzz.txt).
5. **Pruebas de concepto.** Una por hallazgo on-chain, en `test-foundry/poc/`, sobre una base (`PocBase.sol`) que replica `deploy.js`. Un test de sanidad comprueba esa réplica.
6. **Prueba de mutación** sobre la invariante de admin: [`evidencia/mutacion.txt`](evidencia/mutacion.txt).

## 4. Criterio de severidad

Severidad = impacto × probabilidad.

- **Impacto.** Alto: pérdida o inmovilización de la mayoría de los fondos. Medio: se supera un control, con daño acotado. Bajo: inconsistencia sin pérdida directa.
- **Probabilidad.** Media: ocurre sin comprometer ningún rol privilegiado. Baja: exige comprometer un rol privilegiado (riesgo de centralización), varias claves, una decisión de deploy o una ventana de un segundo, o deja tiempo para reaccionar.

| | Probabilidad media | Probabilidad baja |
|---|---|---|
| **Impacto alto** | Alta | Media |
| **Impacto medio** | Media | Baja |
| **Impacto bajo** | Informativa | Informativa |

## 5. Hallazgos

### GT-01 — El guardián puede congelar los fondos sin límite

- **Severidad:** Media (impacto alto × probabilidad baja)
- **Descripción:** el guardián pausa al instante (`GovernedTreasury.sol:398-400`), y reanudar solo lo puede hacer el admin, es decir, el timelock (`GovernedTreasury.sol:389-391`). Pero el guardián además tiene permiso de cancelar en el timelock (`deploy.js:57`). Un guardián malicioso o con la clave robada pausa y después cancela cada `unpause`, cada `revokeRole(GUARDIAN_ROLE)` en la tesorería y cada `revokeRole(CANCELLER_ROLE)` en el timelock. No hay otro camino: el timelock no acepta esperas menores a 72 h. No hay robo, pero los fondos quedan inmovilizados sin límite de tiempo.
- **PoC:** `test-foundry/poc/GT01_GuardianCongela.t.sol:test_PoC_GT01_GuardianCancelaCadaUnpause`. Tres rondas: en cada una, las tres salidas se programan y se cancelan. Además, la vía rápida (delay 0) revierte.
- **Recomendación:** pausa con vencimiento (se levanta sola a los N días salvo que el timelock la renueve), o separar quién pausa de quién cancela. Guardián como multi-firma M-de-N.
- **Estado:** reconocido, fix en v2.

### GT-02 — Un proponente comprometido vacía la bóveda si nadie cancela en 72 h

- **Severidad:** Media (impacto alto × probabilidad baja). Es un riesgo de centralización: exige comprometer un rol privilegiado y deja 72 h a la vista para reaccionar. Combinado con GT-07, esa ventana valía menos, porque la alerta podía describir mal la operación.
- **Descripción:** el proponente es el único que programa y el único que ejecuta (`deploy.js:52`). En un solo `scheduleBatch` puede darle `OPERATOR_ROLE` y `APPROVER_ROLE` a dos cuentas propias, agendar su dirección (`setBeneficiary`) y subir los topes (`setLimits`). A las 72 h ejecuta solo. La doble firma no frena a quien controla las dos firmas.
- **PoC:** `test-foundry/poc/GT02_ProponenteVacia.t.sol:test_PoC_GT02_ProponenteSinVigilanciaVaciaLaBoveda`. El atacante termina con 10.000 y la bóveda en 0.
- **Recomendación:** proponente y ejecutor distintos, los dos como multi-firma M-de-N. Monitor redundante (dos procesos, dos canales).
- **Estado:** reconocido, fix en v2.

### GT-03 — El tope diario se duplica cruzando la medianoche UTC

- **Severidad:** Baja (impacto medio × probabilidad baja)
- **Descripción:** el día es `block.timestamp / 1 days` (`GovernedTreasury.sol:445`): un día calendario UTC, no una ventana de 24 h. 3.000 aprobados a las 23:59 y 3.000 a las 00:01 son 6.000 en dos minutos. Para abusar hace falta el operador y el aprobador. Se eligió así porque el gasto del día entra en un solo slot de storage.
- **PoC:** `test-foundry/poc/GT03_Medianoche.t.sol:test_PoC_GT03_SeisMilEnDosMinutosCruzandoMedianoche`.
- **Recomendación:** ventana deslizante con dos cubetas (día actual y día anterior ponderado). Cuesta un slot más por retiro.
- **Estado:** reconocido, fix en v2.

### GT-04 — Token con comisión: `Deposited` no coincide con lo recibido; tokens ajenos quedan trabados

- **Severidad:** Informativa (impacto bajo × probabilidad baja)
- **Descripción:** `deposit` emite el monto pedido antes de transferir y no mide lo que llegó (`GovernedTreasury.sol:272-276`). Con un token que cobra comisión, el evento suma de más y quien concilie con eventos (el panel, el monitor) ve un saldo falso. mARS no cobra comisión: el riesgo aparece solo si se despliega con otro token. Aparte, no hay función para rescatar otros ERC-20 mandados por error: quedan trabados.
- **PoC:** `test-foundry/poc/GT04_TokenConComision.t.sol:test_PoC_GT04_DepositedNoCoincideConLoRecibido`. Con 1 % de comisión, el evento dice 1.000 y llegan 990. La parte de tokens trabados es una ausencia de función y no tiene PoC.
- **Recomendación:** medir el saldo antes y después en `deposit`, y agregar un `rescue(token)` solo vía timelock que no pueda tocar el token custodiado.
- **Estado:** reconocido, fix en v2.

### GT-05 — Aprobación en el segundo exacto de `expiresAt`; el umbral no se revalida al aprobar

- **Severidad:** Informativa (impacto bajo × probabilidad baja)
- **Descripción:** `approveWithdrawal` compara `block.timestamp > req.expiresAt` (`GovernedTreasury.sol:337`), así que en `expiresAt` exacto el pedido todavía vale: un segundo más de vigencia. Al aprobar se revalidan la allowlist, el tope por operación y el tope diario (`GovernedTreasury.sol:344` y `442-449`), pero no el umbral de doble firma. Los pedidos pendientes tampoco reservan cupo del día.
- **PoC:** `test-foundry/poc/GT05_BordeVencimiento.t.sol:test_PoC_GT05_SeApruebaEnElSegundoExactoDelVencimiento`. En `expiresAt` se aprueba; en `expiresAt + 1`, revierte con `RequestExpired`.
- **Recomendación:** usar `>=` en el vencimiento y revalidar `amount >= approvalThreshold` al aprobar.
- **Estado:** reconocido, fix en v2.

### GT-06 — Operador y aprobador se pueden juntar en una cuenta después del constructor

- **Severidad:** Baja (impacto medio × probabilidad baja)
- **Descripción:** `RolesMustBeDistinct` solo se chequea al desplegar (`GovernedTreasury.sol:249`). Vía timelock, una cuenta puede recibir los dos roles. Lo único que la frena es `SelfApprovalNotAllowed` (`GovernedTreasury.sol:338`). El contrato no controla en ningún momento que el guardián sea distinto del aprobador: eso lo chequea solo `deploy.js:37-39`.
- **PoC:** sin PoC nueva. Lo demuestra el setUp de la invariante (`test-foundry/GovernedTreasury.invariant.t.sol:169-172`), que le da los dos roles a una cuenta vía timelock. `dualSelfApproves` confirma que igual no se puede autoaprobar.
- **Recomendación:** override de `_grantRole` que rechace juntar `OPERATOR_ROLE` con `APPROVER_ROLE` o `GUARDIAN_ROLE` en una misma cuenta.
- **Estado:** reconocido, fix en v2.

### GT-07 — (off-chain) El monitor decodificaba toda llamada programada con el ABI de la tesorería

- **Severidad:** Media (impacto medio × probabilidad media)
- **Descripción:** `describeScheduled` (`scripts/monitor.js:63-70` en `2117e2e`) ignoraba el campo `target` del evento. Un `grantRole(PROPOSER_ROLE, atacante)` programado sobre el timelock se mostraba como si fuera sobre la tesorería, y una llamada a un tercer contrato con un selector que coincidiera también se "decodificaba". Ocurría sin comprometer nada y dejaba mal informado justo al guardián, que decide si cancela (ver GT-02).
- **PoC / prueba:** `scripts/check-monitor-destino.js`, con 6 casos armados a mano y sin red. Salida: [`evidencia/monitor-destino.txt`](evidencia/monitor-destino.txt). Corre en CI.
- **Fix:** [spec 006](../specs/006-monitor-destino/spec.md). La decodificación pasa a `scripts/lib/describe-call.js` y elige el ABI según el destino. La alerta muestra siempre el destino, y un destino desconocido da alerta CRÍTICA con la dirección y el selector.
- **Estado:** corregido (off-chain, sin deploy).

### GT-08 — (pruebas) `invariant_SoloElTimelockEsAdmin` no podía fallar

- **Severidad:** Informativa
- **Descripción:** el handler del fuzzing no tenía ninguna función que tocara roles, así que ninguna secuencia podía cambiar quién es admin: la invariante pasaba siempre. Además revisaba solo tres direcciones.
- **Fix:** `attackerGrantsRole` y `attackerRevokesRole` (`GovernedTreasury.invariant.t.sol:139` y `:147`) intentan dar o sacar cualquier rol desde seis cuentas sin permiso. La invariante (`:201`) revisa que ninguno prospere y que ninguna de ocho cuentas sea admin.
- **Prueba de mutación:** en una copia del repo fuera del árbol, a `GovernedTreasury` se le agregó un `grantRole` sin control de acceso. La invariante vieja **pasó** contra el mutante; la nueva **falló** con `un grantRole/revokeRole sin permiso funciono`, y contra el contrato real pasa. Detalle y diff: [`evidencia/mutacion.txt`](evidencia/mutacion.txt).
- **Estado:** corregido.

## 6. Riesgos aceptados (no son hallazgos)

| Riesgo | Por qué se acepta |
|---|---|
| Operador y aprobador comprometidos a la vez | Pueden sacar hasta 3.000 por día hacia destinos ya agendados. Es el daño máximo por diseño: los topes acotan, no evitan |
| Confianza en el token custodiado | La bóveda confía en el ERC-20 elegido en el deploy |
| Custodia de claves | Vive fuera del contrato |
| MockToken con dueño que emite | Es solo para testnet |
| ETH forzado con `SELFDESTRUCT` | No se puede impedir; quedaría trabado. La bóveda no opera con ETH |
| Timestamp (hallazgo de Slither) | Se usa solo para el vencimiento de 3 días. Después del Merge el timestamp queda fijado por el slot |

## 7. Cómo leer las PoC

Las PoC **pasan cuando el ataque funciona**. Por eso CI en verde no significa "seguro": significa que cada hallazgo sigue siendo reproducible. Cuando la v2 corrija un hallazgo, su PoC va a fallar y hay que invertirla para convertirla en test de regresión (`expectRevert` donde hoy hay éxito). Para correr solo las PoC: `forge test --mt PoC`.
