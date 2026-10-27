## Spec 003 — README del repositorio

**Objetivo**
Que quien evalúe entienda rápidamente qué es el proyecto, qué controles tiene y cómo comprobar que funcionan, sin tener que creerle a nadie.

## Requerimientos funcionales

**ID Requerimiento	Criterio de aceptación**
- **RF-R1	Qué es y qué problema resuelve:** Dado un lector sin contexto, cuando lee el primer párrafo entiende que es una tesorería con simulación de controles bancarios y por qué onlyOwner no alcanza.

- **RF-R2	Contratos verificados:** Las 3 direcciones de deployments/sepolia.json aparecen con link a Etherscan (#code).

- **RF-R3	Tabla de controles:**	Cada control (roles, doble firma, tope sin doble firma, topes, allowlist, vencimiento, timelock, pausa, sin dueño) dice qué evita y cómo. Los valores salen de limits() / deployments / el código, no de memoria.

- **RF-R4	Arquitectura:**	Un diagrama Mermaid con roles, tesorería, timelock, token, monitor y panel.

- **RF-R5	Modelo de amenazas:**	Tabla amenaza → mitigación → evidencia (test o transacción). Incluye lo que no cubre.

- **RF-R6	Evidencia con números reales:**	Tests, cobertura, gas, fuzzing/invariantes y Slither, copiados de correr los comandos en ese momento (npm test, npm run coverage, npm run test:gas, npm run fuzz, npm run slither). Las salidas completas, sin colores ANSI, quedan en docs/evidencia/ y el README apunta ahí.

- **RF-R7	Hallazgo de Slither triagiado:**	Cada hallazgo con su decisión (corregido / aceptado) y la razón.

- **RF-R8	Evidencia en Sepolia:**	Resumen de deployments/sepolia-interactions.json: acciones ejecutadas y ataques rechazados, con links.

- **RF-R9	Decisiones de diseño:**	uint96/uint40, sin proxy, cancun + ReentrancyGuardTransient, sin payable, errores con datos, CEI. Cada una con su porqué.

- **RF-R10	Panel y SDD:**	Qué hace el frontend y links a specs/ (constitución, 001, 002). Aclara que 002 se implementó sin plan.md ni tasks.md separados.

- **RF-R11	Monitor:**	Niveles de alerta tal como están en scripts/monitor.js.

- **RF-R12	Cómo correrlo:**	Pasos desde git clone hasta tests, monitor y frontend. Variables según .env.example, sin valores, incluidas las del monitor (SLACK_WEBHOOK_URL, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, MONITOR_POLL_MS=6000) con los nombres de scripts/monitor.js. Aclara que npm run fuzz usa el solc de Hardhat en macOS y que en otra máquina se corre forge test con Foundry instalado.

- **RF-R13	Roadmap:**	Multi-firma/Safe, límites por beneficiario, referencia de factura, agente de IA de solo lectura (spec 004), rotación de claves, Vercel.

- **RF-R14	Captura del panel:**	Debajo del primer párrafo se ve docs/panel.png.

- **RF-R15	Cómo se trabajó con IA**	Sección corta: spec-first, AGENTS.md, permisos denegados en .claude/settings.json, regla de ningún número sin comando. Cada afirmación apunta a un archivo que existe; sin exagerar el rol del agente.

- **RF-R16	Riesgos conocidos:**	Dada la auditoría del 2026-10-27, cuando se lee el README, entonces: (a) se corrigen las afirmaciones de las líneas 5 (ninguna cuenta sola), 65 (la tx muestra falta de rol, no SelfApprovalNotAllowed), 75 (guardián malicioso), 147 (timestamp después del Merge), 173 (un pedido: 2 slots en vez de 4), 176 (ETH forzado) y 266 (alcance real de .claude/settings.json); (b) "Lo que no cubre" lista, cada uno con su fix propuesto para la v2 en una línea: guardián que bloquea el unpause para siempre, roles combinables después del constructor, proponente sin vigilancia, borde del día calendario UTC con el trade-off de storage, tokens con comisión y tokens mandados por error, umbral no revalidado al aprobar y borde de expiresAt; (c) dice que invariant_SoloElTimelockEsAdmin hoy no puede fallar porque el handler no toca roles. Sin tocar contracts/ ni test/.

## Requerimientos no funcionales

**ID	Requerimiento**
- **RNF-R1:**	Ningún número que no haya salido de un comando corrido durante la redacción. Si un comando falla, se marca como pendiente.

- **RNF-R2**	Ningún secreto: el README se revisa con `grep -nE "_KEY=0x[0-9a-fA-F]{64}|_KEY=.+|/v2/[A-Za-z0-9_-]{20,}|/v3/[0-9a-f]{32}|hooks\.slack|discord(app)?\.com/api/webhooks|bot[0-9]+:" README.md` y tiene que dar vacío. (No incluye un `0x…{64}` suelto porque los hashes de tx de RF-R8 son públicos y deben aparecer.)

- **RNF-R3**	Castellano rioplatense, directo. Tablas para comparar, prosa para explicar.

- **RNF-R4**	Todos los links internos apuntan a archivos que existen en el repo.

**Validación**
- [ ] RF-R1 a RF-R15 cubiertos (revisión del usuario). Cada RF tiene su sección en el README; falta el visto bueno del usuario.
- [x] RNF-R1: corrida del 2026-10-27 13:16 UTC con salidas completas en `docs/evidencia/` (test, coverage, gas, fuzz, slither; sin códigos ANSI, verificado con grep). `npm test` 29 passing · `npm run coverage` 100 % stmts/funcs/lines, 75 % branch · `npm run test:gas` deploy GovernedTreasury 1.723.506; cambiaron `schedule` (máx 58.173, prom 56.700) y `execute` (prom 60.447) del timelock respecto de la corrida del 26/10, y el README se actualizó · `npm run fuzz` 8 pasan, 0 fallan (forge del paquete npm en el PATH) · `npm run slither` 1 hallazgo (`timestamp`, aceptado), código de salida 255.
- [x] RNF-R2: grep vacío. Grep de RNF-R2 sobre README.md y docs/evidencia/: sin coincidencias (exit 1), 2026-10-27. Tampoco hay ningún `0x…{64}` en docs/evidencia/ (exit 1).
- [ ] RNF-R4: links comprobados. Corrida del 2026-10-27: 26 de 27 rutas internas existen y las anclas `#evidencia-en-sepolia` y `#riesgos-conocidos-lo-que-no-cubre` resuelven. Sigue faltando `docs/panel.png` (RF-R14). Se tilda cuando se agregue la captura. Para que los links funcionen en GitHub hay que commitear `specs/003-readme/`, `specs/004-agente-analista/`, `AGENTS.md`, `.claude/settings.json` y `docs/evidencia/`.
- [ ] RF-R16: correcciones (a), tabla de riesgos con fix v2 (b) y aclaración de la invariante (c) escritas en el README; `git status` no muestra cambios en contracts/, test/ ni test-foundry/. Falta el visto bueno del usuario.
