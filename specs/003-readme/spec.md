## Spec 003 — README del repositorio

**Objetivo**

Que quien vea y evalúe entienda rápidamente qué es el proyecto, qué controles tiene y cómo comprobar que funcionan, sin tener que creerle a nadie.

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

- **RF-R13	Roadmap:**	Multi-firma/Safe, límites por beneficiario, referencia de factura, agente de IA de solo lectura (spec 004), rotación de claves. El deploy del panel ya no figura: está hecho en Cloudflare Pages y el link va arriba del README, como "Panel en vivo" (cambio del 2026-10-27).

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
- [x] RF-R1 a RF-R15 cubiertos: el usuario leyó el README completo y lo aprobó el 2026-10-27.
- [x] RNF-R1: corridas del 2026-10-27 con salidas completas en `docs/evidencia/` (sin códigos ANSI, verificado con grep). Coverage, gas y Slither: corrida de las 13:16 UTC (contratos y `test/` sin cambios desde entonces): 100 % stmts/funcs/lines, 75 % branch · deploy GovernedTreasury 1.723.506 · Slither 1 hallazgo (`timestamp`, aceptado). `npm test` y `npm run fuzz`: corrida nueva después de la spec 008, con 29 passing y 14 passed (4 fuzz, 4 invariantes, 5 PoC y 1 de sanidad). El README tiene esos mismos números.
- [x] RNF-R2: grep de RNF-R2 sobre README.md, docs/ (evidencia, auditoría, checklist, whitepaper) y los archivos nuevos: sin secretos. Las únicas coincidencias de `_KEY=` en el repo son los marcadores `0x...` de `.env.example` y el patrón citado en esta spec. Los hex de 64 caracteres son hashes de tx públicos, el hash de `PROPOSER_ROLE` y una semilla de fuzzing (2026-10-27).
- [x] RNF-R4: links comprobados el 2026-10-27 con un script que valida rutas y anclas: 43 links internos del README, 0 rotos (incluye `docs/panel.png`, que ahora existe, y las anclas `#riesgos-conocidos-lo-que-no-cubre`, `#evidencia-en-sepolia` y `#gas--npm-run-testgas`). Los documentos enlazados (auditoría, checklist, whitepaper, spec 007, retro): 18 links, 0 rotos. Para que funcionen en GitHub hay que commitear los archivos nuevos.
- [x] RF-R13 (cambio del 2026-10-27): la fila "Deploy del panel en Vercel" salió del Roadmap; `grep -n Vercel README.md` da vacío. "Panel en vivo" está en `README.md:5`.
- [x] RF-R16: correcciones (a), tabla de riesgos con fix v2 (b), ahora con IDs GT-0X y columna PoC, y aclaración de la invariante (c), actualizada porque la spec 008 la corrigió. `git diff --stat contracts/` vacío. Aprobado por el usuario el 2026-10-27.
