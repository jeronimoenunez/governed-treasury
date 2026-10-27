## Spec 008 — Red team: PoCs ejecutables de los riesgos conocidos e informe de auditoría

**Estado:** aprobada por el Jeronimo Nuñez el 2026-10-27, con un cambio: GT-02 pasa de Alta a Media.

**Objetivo**
Convertir cada fila de "Riesgos conocidos" del README en algo que se pueda correr: una prueba que pasa cuando el ataque funciona. Sumar a eso un informe de auditoría con formato profesional que cualquiera pueda contrastar contra el código. Los contratos desplegados no se tocan.

**Qué es y qué no es**
- Es una batería de pruebas de concepto (PoC) en Foundry. Cada una reproduce un ataque o un comportamiento no deseado contra el código actual, con la misma configuración que usa `scripts/deploy.js`.
- Es también un arreglo de la invariante `invariant_SoloElTimelockEsAdmin`, que hoy no puede fallar, y un informe en `docs/auditoria.md`.
- No es un fix: no cambia `contracts/` (regla 1 de AGENTS.md). Los fixes quedan para una v2 con spec y deploy nuevos.
- No es una auditoría externa. El informe dice quién la hizo y cómo, sin hacerse pasar por un tercero.

**Alcance**
- Contratos: `contracts/GovernedTreasury.sol`, `contracts/GovernanceTimelock.sol` y `contracts/MockToken.sol`. Su último cambio está en el commit `455ca1e`; el informe cita además el HEAD vigente al momento de la corrida y el SHA-256 de cada archivo.
- Off-chain: `scripts/monitor.js`, solo por el hallazgo de la spec 006.
- Configuración auditada: la de `scripts/deploy.js`. Delay de 72 h. El proponente es a la vez el único que programa y el único que ejecuta. El guardián tiene permiso de cancelar en el timelock. El deployer renuncia al admin. Límites 1.000 / 3.000 / 500 / 1.000 y fondeo de 10.000 mARS.

**Hallazgos y severidad propuesta
~ Criterio: severidad = impacto × probabilidad.**
- **Impacto:** Alto si hay pérdida o inmovilización de la mayoría de los fondos; Medio si se supera un control pero con daño acotado; Bajo si es una inconsistencia sin pérdida directa.
- **Probabilidad:** Media si se dispara sin comprometer ningún rol privilegiado (por ejemplo, el uso normal del sistema); Baja si exige comprometer un rol privilegiado (riesgo de centralización), varias claves, una decisión de deploy o una ventana de un segundo, o si hay tiempo para reaccionar antes del daño.
- **Tabla:** Alto × Media = Alta · Alto × Baja = Media · Medio × Media = Media · Medio × Baja = Baja · Bajo × cualquiera = Informativa.
- **GT-02 es Media y no Alta:** es un riesgo de centralización. Exige comprometer un rol privilegiado (el proponente) y deja 72 h a la vista para que el guardián cancele. Si se combina con GT-07 (el monitor no muestra el destino), esa ventana de reacción vale menos; el informe lo dice.
- **GT-07 es Media:** se dispara con cualquier operación programada sobre el timelock, sin comprometer nada, y deja mal informado justo al rol que decide si cancela.

## ID -	Título -	Impacto	Prob.	Severidad	PoC
- **GT-01**	El guardián congela los fondos sin límite cancelando cada unpause- Alto - Baja -	Media - (1)
- **GT-02**	Un proponente comprometido vacía la bóveda si nadie cancela en 72 h - Alto - Baja - Media - (3)
- **GT-03**	El tope diario se duplica cruzando la medianoche UTC - Medio - Baja - Baja - (2)
- **GT-04**	Token con comisión: Deposited no coincide con lo recibido; tokens ajenos quedan trabados - Bajo - Baja - Informativa - (4)
- **GT-05**	Un pedido se puede aprobar en el segundo exacto de expiresAt; el umbral no se revalida al aprobar - Bajo - Baja - Informativa - (5)
- **GT-06**	Operador y aprobador se pueden juntar en una cuenta después del constructor - Medio - Baja - Baja. Sin PoC nueva: lo demuestra el setUp existente de la invariante (`GovernedTreasury.invariant.t.sol:132-135`)
- **GT-07**	(off-chain) El monitor decodifica toda llamada programada con el ABI de la tesorería y no muestra el destino - Medio - Media - Media. 
**Sin PoC:** fix especificado en la spec 006
- **GT-08**	(pruebas) invariant_SoloElTimelockEsAdmin no podía fallar	—	—	Informativa	Corregido en esta spec

## Lo que el informe deja fuera de los hallazgos y pone en "Riesgos aceptados"
Que operador y aprobador estén comprometidos a la vez (está acotado por diseño a 3.000 por día), la confianza en el token custodiado, la custodia de claves, MockToken con dueño que emite y el ETH forzado con SELFDESTRUCT.

## Requerimientos funcionales
**ID	Requerimiento	Criterio de aceptación**

- **RF-T1**	Base común	`test-foundry/poc/PocBase.sol` replica `deploy.js`: timelock con el deployer como admin temporal, guardián con permiso de cancelar, renuncia del admin, roles, beneficiario, límites y fondeo. No hereda de `TreasuryBase`, porque ahí el guardián no puede cancelar. Un test de sanidad comprueba esa configuración, igual que los chequeos post-deploy de `deploy.js:84-95`.
- **RF-T2	PoC GT-01**	Dado el guardián con permiso de cancelar, cuando pausa y el proponente programa `unpause`, `revokeRole(GUARDIAN_ROLE)` en la tesorería y `revokeRole(CANCELLER_ROLE)` en el timelock, entonces el guardián cancela las tres; pasadas las 72 h ninguna se puede ejecutar y la bóveda sigue pausada con los 10.000. El ciclo se repite 3 veces. El NatSpec aclara que un test no prueba "para siempre": prueba que cada intento se puede cancelar y que no hay otro camino.
- **RF-T3	PoC GT-03**	Dado operador y aprobador, cuando se aprueban 3.000 a las 23:59:00 UTC y otros 3.000 a las 00:01:00 UTC, entonces el beneficiario recibe 6.000 en 120 segundos.
- **RF-T4	PoC GT-02**	Dado un proponente comprometido y nadie que cancele, cuando programa en un solo `scheduleBatch` darle `OPERATOR_ROLE` y `APPROVER_ROLE` a dos cuentas propias, agendar su dirección y subir los topes, y ejecuta a las 72 h + 1 s, entonces vacía la bóveda: el atacante recibe 10.000 y la bóveda queda en 0.
- **RF-T5	PoC GT-04**	Dado un token con 1 % de comisión definido dentro del archivo de la PoC (`contracts/mocks/` no se toca), cuando se depositan 1.000, entonces `Deposited` emite 1.000 y la bóveda recibe 990.
- **RF-T6	PoC GT-05**	Dado un pedido creado en t, cuando el tiempo llega exactamente a `expiresAt` = t + 3 días, entonces `approveWithdrawal` se ejecuta; un segundo después, revierte con `RequestExpired`.
- **RF-T7	NatSpec**	Cada PoC lleva `@notice` con el ID del hallazgo y la vulnerabilidad, y `@dev` con qué demuestra el test y qué no. Los tests se llaman `test_PoC_GTxx_…`, así un `forge test --mt PoC` corre solo las PoC.
- **RF-T8	Invariante arreglada**	El handler suma `attackerGrantsRole(seed)` y `attackerRevokesRole(seed)`. Cada una elige al azar quién llama (atacante, operador, aprobador, guardián, dual, proponente), qué rol (admin, operador, aprobador, guardián) y a quién, siempre sobre la tesorería. Si una llamada no revierte, marca `roleAttackSucceeded`. La invariante revisa el flag y que ninguna de esas cuentas, ni el handler, tenga el rol de admin.
- **RF-T9	Prueba de mutación**	En una copia del repo en el scratchpad, fuera del repo, se agrega a `GovernedTreasury` un `grantRole` sin control de acceso. Resultado esperado: la invariante nueva FALLA y la vieja PASA con el mismo mutante. Las dos salidas quedan en `docs/evidencia/mutacion.txt` con el diff exacto del mutante. En el repo real, `git diff --stat contracts/` queda vacío.
- **RF-T10	Informe	`docs/auditoria.md` incluye:**
	- alcance (commit, HEAD, SHA-256 de cada contrato, configuración);
	- metodología: revisión manual asistida por IA y verificada contra el código línea por línea, Slither, fuzzing, invariantes, PoCs y prueba de mutación;
	- tabla de severidades con el criterio;
	- resumen por severidad;
	- por hallazgo: ID, título, severidad (con impacto × probabilidad), descripción con archivo:línea, PoC (archivo:test), recomendación y estado. GT-01 a GT-06: "reconocido, fix en v2". GT-07: "reconocido, fix en spec 006 (sin implementar)". GT-08: "corregido".
	Aclara también que el bytecode desplegado en Sepolia no se comparó en esta revisión.

## Requerimientos no funcionales
**ID	Requerimiento**
- **RNF-T1**	`contracts/` sin cambios: `git diff --stat contracts/` vacío al terminar.
- **RNF-T2	Tests existentes:** el único archivo existente que cambia es `test-foundry/GovernedTreasury.invariant.t.sol` (handler e invariante). `test/` y `GovernedTreasury.fuzz.t.sol` no se tocan.
- **RNF-T3	Sin red:** las PoCs corren localmente en Foundry; nada contra Sepolia.
- **RNF-T4	Ningún número inventado:** los conteos y resultados de README, informe y evidencia salen de la corrida nueva de `npm test` y `npm run fuzz`.
- **RNF-T5	Aviso visible:** el README y el informe dicen que estas pruebas pasan cuando el ataque funciona. Cuando la v2 corrija un hallazgo, su PoC tiene que fallar y se convierte en un test de regresión invertido.

## Documentación y números
- `docs/evidencia/test.txt` y `docs/evidencia/fuzz.txt`, regenerados con la corrida nueva. Se suma `mutacion.txt`.
- README:
  - conteo de Foundry y tabla de fuzz/invariantes (más una fila por PoC);
  - columna "PoC" en "Riesgos conocidos";
  - link a `docs/auditoria.md`;
  - el aviso de RNF-T5.
- Para que no queden números viejos: `AGENTS.md` ("Fuzzing e invariantes (8)") y la spec 005 (RF-C4, "los 8 tests") se actualizan con el conteo nuevo. El dato histórico de la spec 005 ("comprobado el 2026-10-26 … 8 tests") queda como está, porque es lo que se midió ese día.

## Riesgos y notas
- CI queda en verde con los ataques funcionando, porque `forge test` corre las PoCs. Es lo esperado: el verde significa "el hallazgo sigue reproducible", no "es seguro". Lo dice RNF-T5.
- La spec 007 (Safe M-de-N y rotación, con los fixes de la v2) se escribió después, como borrador.
- La prueba de mutación compila un contrato modificado solo en la copia del scratchpad. Nada de eso entra al repo, salvo la salida y el diff en `mutacion.txt`.

## Validación
- [x] Spec aprobada por el usuario (2026-10-27, con GT-02 en Media).
- [x] RF-T1 a RF-T7: `npm run fuzz` → 14 passed, 0 failed; las 5 PoC y `test_PocBase_ReplicaElDeploy` en PASS (`docs/evidencia/fuzz.txt`, 2026-10-27). Cada PoC tiene `@notice` con el ID y `@dev` con qué prueba y qué no, y se llama `test_PoC_GTxx_…`.
- [x] RF-T8 y RF-T9: `docs/evidencia/mutacion.txt`: la invariante nueva contra el mutante → FAIL ("un grantRole/revokeRole sin permiso funciono"); la vieja contra el mutante → PASS; la nueva contra el contrato real → PASS. Incluye el diff del mutante.
- [x] RF-T10: `docs/auditoria.md` tiene alcance (commits, SHA-256, configuración, verificación en Etherscan y la aclaración del bytecode), metodología, criterio, resumen por severidad y los 8 hallazgos con ID, severidad, descripción con archivo:línea, PoC, recomendación y estado. Las líneas citadas se tomaron con grep sobre los archivos actuales, y los links internos dan 0 rotos.
- [x] RNF-T1: `git diff --stat contracts/` vacío (2026-10-27; también en `mutacion.txt`, sección 5).
- [x] RNF-T2: `git status --short test test-foundry` → ` M test-foundry/GovernedTreasury.invariant.t.sol` y `?? test-foundry/poc/`. `test/` no aparece.
- [x] RNF-T4: `npm test` (29 passing) y `npm run fuzz` (14 passed) corridos el 2026-10-27. README, AGENTS.md ("(14)") y la spec 005 (RF-C4) tienen el mismo conteo.
