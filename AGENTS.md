AGENTS.md — GovernedTreasury

Tesorería on-chain con controles bancarios (roles separados, doble firma, topes diarios, allowlist, timelock de 72 h). 
Proyecto final del Ethereum Developer Pack (ETH Kipu · Talento Tech). Autor: Jerónimo Núñez.

Cómo se trabaja acá: Spec-Driven Development
Flujo obligatorio: constitución → spec → clarificación → plan → tareas → implementación → validación.
- La constitución está en specs/constitucion.md. Si algo choca con ella, gana la constitución.
- Cada funcionalidad tiene su carpeta en specs/NNN-nombre/ con spec.md (RF/RNF con criterios Dado/Cuando/Entonces), plan.md y tasks.md.
- Ningún código sin spec aprobada. Si falta, se escribe primero el borrador de la spec y se espera la aprobación del usuario.
- Todo cambio de alcance vuelve a la spec antes que al código.
- Al terminar, se tildan los criterios de ## Validación solo con evidencia (salida de un comando, captura, hash de transacción).

Reglas no negociables
1. Los contratos de contracts/ están deployados y verificados en Sepolia. No se modifican ni se tocan. Un cambio de contrato requiere spec nueva, aprobación explícita y un deploy nuevo.
2. Nunca leer, mostrar ni copiar .env ni ningún archivo con claves. Para saber qué variables existen, usar .env.example.
3. Nunca escribir claves, tokens, webhooks ni API keys en código, docs, commits o salidas.
4. No ejecutar nada contra Sepolia (scripts/deploy.js, scripts/interact.js, transacciones) sin confirmación explícita del usuario en ese momento.
5. Ningún número inventado. Toda cifra de tests, cobertura, gas, fuzzing o Slither sale de correr el comando en ese momento. Si no se puede correr, se deja marcado como pendiente.
6. No correr npm audit fix --force (rompe Hardhat 2). Las vulnerabilidades de dependencias de desarrollo se analizan, no se fuerzan.
7. No hacer git push ni commits sin que el usuario lo pida.

Comandos
Qué	Comando
Tests unitarios (29)	npm test
Cobertura	npm run coverage
Gas	npm run test:gas
Fuzzing, invariantes y PoC del red team (14)	npm run fuzz
Análisis estático	npm run slither
Check del monitor, sin red (6 casos)	node scripts/check-monitor-destino.js
Monitor de alertas	npm run monitor (necesita .env; correrlo solo si el usuario lo pide)
Frontend	cd frontend && npm run dev · npm run lint · npm run build
Exportar ABI y direcciones al frontend	node scripts/export-frontend.js sepolia

Mapa del repo
- contracts/ — GovernedTreasury, GovernanceTimelock, MockToken; contracts/mocks/ solo para tests (no se deploya).
- test/ — tests de Hardhat. test-foundry/ — fuzzing e invariantes (handler + variables fantasma).
- scripts/ — deploy, interact (evidencia en Sepolia), export-frontend, monitor.
- deployments/ — direcciones y evidencia de Sepolia (sepolia-interactions.json).
- frontend/ — React 19 + Vite + wagmi 3 + viem 2. No pide claves: todas las firmas pasan por la billetera.
- specs/ — constitución y specs por funcionalidad.

Stack fijo
Solidity 0.8.24 (pragma fijo), EVM cancun, OpenZeppelin 5.6.1, Hardhat 2.29.1, Foundry (forge 1.7.1), Node 22.

Estilo
- Documentación y comentarios en castellano rioplatense, directo y sin humo.
- Cada concepto técnico nuevo se explica por lo que es y lo que no es.
- El usuario tiene que poder defender cada línea en vivo: cambios chicos, explicados, y nada de reescribir archivos enteros sin necesidad.
