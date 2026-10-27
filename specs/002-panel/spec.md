# Spec 002 — Panel de tesorería

Extiende `001-frontend`. Misma constitución: el frontend no modifica los contratos, solo lee y pide firmas.

## Requerimientos funcionales

| ID | Requerimiento | Criterio de aceptación |
|---|---|---|
| RF-10 | Saldo en el tiempo | Dado el historial de eventos `Deposited`/`Withdrawn`, cuando abro el panel, entonces veo un gráfico del saldo reconstruido hacia atrás desde el saldo actual leído del contrato. |
| RF-11 | Entradas y salidas por día | Dado el historial, cuando miro "Entradas y salidas", entonces veo los últimos 7 días con dos barras por día (entró / salió) y el detalle al pasar el mouse. |
| RF-12 | Uso del tope diario | Dado `remainingToday()` y `limits()`, entonces veo el porcentaje del tope diario usado y, aparte, el uso del tope sin doble firma. |
| RF-13 | Gobernanza visible | Dado un `CallScheduled` en el timelock, entonces veo el cambio traducido a una frase, su estado (en espera, listo, ejecutado, cancelado) y cuánto falta. Si la llamada no se puede decodificar, se muestra como alerta. |
| RF-14 | Controles activos | Entonces veo los controles del contrato con sus valores leídos de la cadena (doble firma, topes, lista de destinos, demora del timelock, freno de emergencia). |
| RF-15 | Movimientos | Entonces veo los movimientos de toda la tesorería leídos de la cadena, con link a cada transacción, además de los de mi sesión (RF-09). |
| RF-17 | Salidas vs tope | Dado el historial y `limits()`, entonces veo un radar de 7 ejes (un día por eje): el relleno es lo que salió y el contorno es el tope diario. Al pasar el mouse veo el monto exacto del día. |
| RF-16 | Evidencia de ataques | Si existe `<red>-interactions.json`, entonces veo los intentos rechazados por el contrato con el error que los frenó. |

## Requerimientos no funcionales

| ID | Requerimiento | Criterio |
|---|---|---|
| RNF-10 | Sin backend ni indexador | Todo sale de lecturas RPC (`eth_getLogs`, `eth_call`). Sin servidores propios. |
| RNF-11 | Tolerancia al RPC | Si el RPC limita el rango de `eth_getLogs`, el panel achica el tramo y reintenta. Si igual falla, avisa y el resto sigue funcionando. |
| RNF-12 | Sin dependencias nuevas | Los gráficos son SVG propios: no se suman librerías (menos superficie de supply chain). |
| RNF-13 | Hora de la cadena | Los "últimos 7 días" y los vencimientos se calculan con el timestamp del último bloque, no con el reloj de la computadora. |
| RNF-14 | Accesible y responsive | Sin scroll horizontal en 390 px; los medidores usan `role="meter"`; ningún dato se distingue solo por color (hay leyenda o etiqueta). El lima tiene poco contraste sobre fondo claro: por eso las marcas lima llevan contorno negro y siempre hay números al lado. |

## Validación

- [ ] Local (Hardhat): panel completo con actividad de varios días. Motivo: no hay captura ni registro de una corrida local con actividad de varios días (ver `retro.md`).
- [x] Sepolia: los gráficos muestran los movimientos reales del contrato verificado. `docs/panel.png` (captura nueva del 2026-10-27, bloque 12.006.541, cuenta del guardián) muestra el saldo en el tiempo, entradas y salidas de los últimos 7 días (entró 10.000, salió 1.260), el tope diario usado (500 de 3.000) y la operación cancelada del timelock. Los números cierran con la cadena: `balanceOf` de la tesorería dio 8.740 con la RPC pública el 2026-10-27, y las salidas son 100 + 600 de `scripts/interact.js` más 50 + 10 + 500 desde el panel.
