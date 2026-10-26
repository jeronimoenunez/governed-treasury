## Especificaion 001: Frontend de GovernedTreasury

Estado: aprobada· Fecha: 2026-10-26 · Constitución: specs/constitution.md

## objetivo
Que cada rol pueda operar la tesorerìa desde el navegador, y que una persona sin conocimientos técnicos entienda el estado de la bóveda de un vistazo.

# Usuarios
|          Usuario                |                   Qué necesita                          |
|---------------------------------|---------------------------------------------------------|
| Operador                        | Retirar montos chicos y pedir retiros grandes           |
| Aprobador                       | Revisar y aprobar o rechazar pedidos de otros           |
| Guardián                        | Frenar todo ante un incidente y revocar beneficiarios   |
| Cualquier cuenta                | Ver el estado y depositar                               |
| Evaluador (docente, reclutador) | Entender qué controles existen y verlos funcionar       |

## Requisitos funcionales
| ID | Requisito | Criterio de aceptación |
|---|---|---|
| RF-01 | Conectar MetaMask y mostrar la cuenta | Dado que no hay cuenta conectada, cuando el usuario toca "Conectar MetaMask", entonces se ve la dirección abreviada |
| RF-02 | Detectar los roles de la cuenta | Dada una cuenta con OPERATOR_ROLE, se muestra "Operador"; sin roles, "Sin roles" |
| RF-03 | Mostrar saldo de la bóveda, restante del día (total y directo) y estado | Los valores coinciden con `balanceOf`, `remainingToday` y `paused` del contrato |
| RF-04 | Depositar con el paso previo de `approve` | Si la autorización no alcanza, el botón pide "Autorizar tokens"; después, "Depositar" |
| RF-05 | Retiro directo (operador) | Un monto menor al umbral hacia un beneficiario habilitado se ejecuta y actualiza saldo y medidores |
| RF-06 | Pedir retiro grande (operador) | Un monto desde el umbral crea un pedido "Pendiente" visible en la lista |
| RF-07 | Lista de pedidos con estado y vencimiento; aprobar o rechazar según el rol | El aprobador ve "Aprobar" en pedidos ajenos vigentes; quien pidió solo ve "Cancelar" |
| RF-08 | Panel de emergencia del guardián | Solo visible para GUARDIAN_ROLE; "Pausar" pide confirmación |
| RF-09 | Comprobantes de lo hecho en la sesión | Cada transacción confirmada aparece con link a Etherscan |

## Requisitos no funcionales
| ID | Categoría | Requisito | Criterio de aceptación |
|---|---|---|---|
| RNF-01 | Seguridad | La app nunca pide ni guarda claves privadas | No existe ningún campo, variable ni almacenamiento de claves en el código |
| RNF-02 | Seguridad | Si la red no es Sepolia, se bloquean las acciones | Con otra red se ve un aviso y un botón para cambiar; los botones de operar quedan deshabilitados |
| RNF-03 | Seguridad | Las direcciones vienen del deploy, no las escribe nadie a mano | Las direcciones se leen de `src/contracts/*.json`, generado por `scripts/export-frontend.js` |
| RNF-04 | Usabilidad | Errores del contrato decodificados y en castellano | Un retiro a una dirección no habilitada muestra "… no está en la lista de beneficiarios habilitados" |
| RNF-05 | Usabilidad / Seguridad | Botones habilitados según el rol | Una cuenta sin OPERATOR_ROLE ve "Retirar" deshabilitado y el motivo |
| RNF-06 | Seguridad | Sin secretos en el frontend | No hay claves de API privadas en el código ni en variables `VITE_` |
| RNF-07 | Seguridad / Usabilidad | Antes de firmar, se muestra qué se firma | Cada formulario describe la acción, el monto y el destino antes del botón |
| RNF-08 | Rendimiento | Datos actualizados sin recargar | Las lecturas se refrescan cada 15 s y después de cada transacción |
| RNF-09 | Accesibilidad | Usable en celular y con teclado | Sin desborde horizontal a 390 px; foco visible; respeta "reducir movimiento" |

## Restricciones
- No se modifican contratos, tests, scripts ni el deploy existente (constitución, principio 1).
- La app funciona contra los contratos ya deployados y verificados en Sepolia.

## Fuera del alcance
- Programar o ejecutar operaciones del timelock desde la interfaz (se hace por script).
- Historial completo de eventos (se enlaza a Etherscan).
- Despliegue público del frontend 

## Clarificaciones resueltas
| Pregunta | Decisión |
|---|---|
| React, Next.js o HTML plano? | React con Vite; Next.js no aporta porque no hay servidor |
| ethers o wagmi/viem? | wagmi + viem, como en la clase 12: manejan estados de transacción y decodifican errores |
| Se puede pausar desde la interfaz? | Sí, pero con confirmación y advertencia: reanudar tarda 72 h |