# Tareas 001: Frontend

Cada tarea indica los requisitos que cubre y cómo se validó.

| # | Tarea | Requisitos | Validación |
|---|---|---|---|
| T01 | Script `export-frontend.js`: copia ABI y direcciones al frontend | RNF-03 | Genera `src/contracts/` desde `artifacts/` y `deployments/` |
| T02 | `config.js`: red, contratos, roles, wagmi | RNF-02, RNF-03, RNF-06 | Build sin errores; sin claves en el código |
| T03 | `useTreasury`: lecturas en lote con refresco | RF-02, RF-03, RF-07, RNF-08 | Valores iguales a los del contrato en red local |
| T04 | `tx.jsx`: simular, firmar, esperar, refrescar | RNF-04, RNF-07, RF-09 | Retiro y pedido confirmados en red local |
| T05 | `errors.js`: mensajes en castellano | RNF-04 | Ataque a la allowlist muestra el mensaje esperado |
| T06 | Header con conexión y roles | RF-01, RF-02 | "Operador" y "Aprobador" detectados con cuentas distintas |
| T07 | Bóveda con medidores | RF-03 | 9.300 en bóveda; 2.300 de 3.000 y 900 de 1.000 tras el flujo |
| T08 | Operar: depositar, retirar, pedir | RF-04, RF-05, RF-06, RNF-05, RNF-07 | Aviso "usá Pedir retiro" con 600 en Retirar |
| T09 | Pedidos con aprobación por rol | RF-07 | Aprobador aprueba pedido 0 → "Ejecutada" |
| T10 | Panel del guardián | RF-08 | Visible solo con GUARDIAN_ROLE |
| T11 | Bloqueo por red equivocada | RNF-02 | Aviso y botón de cambio de red |
| T12 | Diseño responsive y accesible | RNF-09 | Sin desborde a 390 px; orden bóveda → operar → pedidos |

## Validación
Prueba de punta a punta con Playwright contra una red local de Hardhat y una billetera simulada por rol
(2026-10-26): todas las tareas T03 a T12 verificadas. Pendiente: validación manual con MetaMask en Sepolia.

Estado de validación (revisado el 2026-10-27)
- [x] T01 a T12 en red local: prueba de punta a punta con Playwright del 2026-10-26, registrada arriba.
- [x] El panel lee el contrato real en Sepolia: `docs/panel.png` muestra la red Sepolia, el rol Operador detectado (0xd99a…3F73, el operador de `deployments/sepolia.json`) y el saldo de la bóveda (9.240 mARS).
- [x] Doble firma desde el panel con MetaMask en Sepolia (RF-06, RF-07): el operador pidió 500 (Pedido 2, tx `0x2ea40276…09ae`) y el aprobador, otra cuenta (`0x964B…39Ef`), lo aprobó (tx `0x756e902c…0fcd`). Verificadas con la RPC pública el 2026-10-27: destino la tesorería, método y remitente correctos, estado *success*. Tabla con links en el README, "Operaciones desde el panel".
- [x] Rechazo por el Guardián desde el panel (RF-07): Pedido 3 (tx `0x2ffc52b4…22e9`) rechazado por `0x0221…E229` (tx `0x26f4a7f0…30fa`), verificadas igual que las anteriores.
- [x] Botón "Aprobar" oculto en el propio pedido (RF-07) y acciones deshabilitadas sin el rol (RNF-05): validación manual del usuario con MetaMask en Sepolia (2026-10-27). La condición está en `Requests.jsx:49-50` (`canApprove` exige `!mine`) y `Operate.jsx:22,111` (`lacksRole` deshabilita y muestra el motivo). No hay captura: la evidencia es la prueba manual.
- [ ] Aviso de red equivocada y modo lectura sin billetera en Sepolia. Motivo: no hay captura ni registro de esos dos casos.
