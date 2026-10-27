Spec 007 — Safe M-de-N para los roles críticos, rotación de claves y v2 con los fixes de la revisión (BORRADOR)

Estado: borrador. No se implementa nada. Tiene dos partes que se aprueban por separado:
- La parte A no toca contratos: usa el timelock que ya está desplegado.
- La parte B exige un contrato nuevo y un deploy nuevo (regla 1 de AGENTS.md).

Por qué
La revisión de seguridad ([docs/auditoria.md](../../docs/auditoria.md)) muestra que los riesgos que quedan no vienen de cuentas sin rol, sino de claves únicas en roles privilegiados:
- un proponente que se lleva todo si nadie cancela (GT-02);
- un guardián que congela los fondos sin límite (GT-01).

Una multi-firma M-de-N (Safe) en cada rol crítico hace que comprometer un rol exija varias claves. Además, las claves usadas durante el desarrollo pasaron por un `.env` local: conviene rotarlas antes de cualquier uso real.

Qué es y qué no es
- Es un plan para pasar el proponente, el aprobador y el guardián a Safes M-de-N, y para rotar las cuentas expuestas por el timelock, paso a paso y a la vista.
- Es también la lista de fixes de la v2 del contrato, cada uno con la PoC que hay que invertir.
- No es una implementación. No define todavía quiénes son los firmantes ni el umbral exacto de cada Safe (ver preguntas abiertas).

## Parte A — Safes y rotación con el contrato actual (sin deploy)

Requerimientos funcionales
ID	Requerimiento	Criterio de aceptación
RF-S1	Safes por rol	Dado un Safe por rol crítico (proponente, aprobador, guardián) desplegado en Sepolia con firmantes distintos, cuando se consulta en la Safe UI o con `getOwners()`/`getThreshold()`, entonces cada uno tiene M-de-N firmantes y ningún firmante está en dos Safes.
RF-S2	Rotación del aprobador y del guardián (tesorería)	Dado el Safe nuevo, cuando se ejecuta el plan de rotación, entonces el Safe tiene el rol y la cuenta vieja no, y en el medio no hubo ningún momento sin titular del rol.
RF-S3	Rotación del proponente y del cancelador (timelock)	Igual que RF-S2, pero sobre los roles `PROPOSER_ROLE`, `EXECUTOR_ROLE` y `CANCELLER_ROLE` del timelock. El timelock es su propio admin, así que también se rota programando sobre sí mismo.
RF-S4	Ejecutor separado	El `EXECUTOR_ROLE` queda en una cuenta o Safe distinto del proponente. Esto mitiga GT-02 sin deploy: quien programa ya no puede ejecutar solo.
RF-S5	Monitor durante la rotación	Cada `CallScheduled` de la rotación aparece en el monitor con su destino correcto (spec 006). El guardián vigente revisa cada uno antes de que pasen las 72 h.

Plan paso a paso para cada rol (ejemplo: aprobador)
1. Desplegar el Safe del aprobador (M-de-N) y anotar su dirección.
2. El proponente programa en el timelock un `scheduleBatch` con destino tesorería: `grantRole(APPROVER_ROLE, safe)`.
3. Esperar 72 h. El monitor alerta "Cambio programado en el timelock · Destino: tesorería · Acción: grantRole(...)". El guardián verifica que la dirección sea la del Safe.
4. El ejecutor ejecuta (`executeBatch`). Comprobar `hasRole(APPROVER_ROLE, safe) == true`.
5. Prueba de humo: el Safe aprueba un pedido chico de prueba.
6. El proponente programa `revokeRole(APPROVER_ROLE, cuentaVieja)`.
7. Esperar 72 h y ejecutar. Comprobar `hasRole(APPROVER_ROLE, cuentaVieja) == false`.
8. Registrar los hashes de los pasos 2, 4, 6 y 7 en `deployments/sepolia-rotacion.json`.

Orden recomendado
- Primero el guardián (tesorería y `CANCELLER_ROLE` del timelock), para que los pasos siguientes tengan un cancelador confiable.
- Después el ejecutor separado (RF-S4).
- Por último el proponente: en el mismo lote, `grantRole(PROPOSER_ROLE, safe)` y `CANCELLER_ROLE` según corresponda; después, `revokeRole` del proponente viejo.
- La rotación del proponente es el paso más delicado: lo programa la cuenta vieja. Si esa clave está comprometida, el atacante puede cancelar la rotación, porque los proponentes tienen `CANCELLER_ROLE` por defecto en OpenZeppelin. Hay que tenerlo en cuenta (pregunta abierta 3).

Requerimientos no funcionales
ID	Requerimiento
RNF-S1	Nada se ejecuta contra Sepolia sin confirmación explícita del usuario en el momento (regla 4).
RNF-S2	Ningún momento sin titular: siempre se otorga antes de revocar.
RNF-S3	Las claves viejas no se borran hasta comprobar la revocación on-chain; después se dan por comprometidas y no se reutilizan.

## Parte B — v2 del contrato (exige deploy nuevo)

Cada fix cierra un hallazgo de docs/auditoria.md. Su PoC hoy pasa porque el ataque funciona. En la v2 tiene que fallar, y entonces se invierte: donde hoy hay éxito, pasa a haber `expectRevert`.

ID	Hallazgo	Fix v2	PoC que hay que invertir
RF-V1	GT-01 Guardián congela los fondos	Pausa con vencimiento: `pause()` guarda `pausedUntil = now + N días` y, pasado ese plazo, `whenNotPaused` deja operar salvo que el timelock la renueve. Alternativa: que el guardián no tenga `CANCELLER_ROLE` y cancele un Safe distinto.	`test-foundry/poc/GT01_GuardianCongela.t.sol:test_PoC_GT01_GuardianCancelaCadaUnpause`
RF-V2	GT-02 Proponente comprometido vacía la bóveda	Sin cambio de contrato: ejecutor separado y Safes (parte A). En la v2, además, un tope duro de `setLimits`: que no se puedan subir los límites más de X % por operación del timelock.	`test-foundry/poc/GT02_ProponenteVacia.t.sol:test_PoC_GT02_ProponenteSinVigilanciaVaciaLaBoveda`
RF-V3	GT-03 Medianoche UTC	Ventana deslizante de dos cubetas (día actual y día anterior ponderado). Cuesta un slot más por retiro.	`test-foundry/poc/GT03_Medianoche.t.sol:test_PoC_GT03_SeisMilEnDosMinutosCruzandoMedianoche`
RF-V4	GT-04 Token con comisión y tokens ajenos	`deposit` mide `balanceOf` antes y después y emite lo recibido. `rescue(token, to)` solo vía timelock, con `token != address(this.token)`.	`test-foundry/poc/GT04_TokenConComision.t.sol:test_PoC_GT04_DepositedNoCoincideConLoRecibido`
RF-V5	GT-05 Borde de expiresAt y umbral	`if (block.timestamp >= req.expiresAt) revert RequestExpired(...)`, y revalidar `amount >= approvalThreshold` al aprobar.	`test-foundry/poc/GT05_BordeVencimiento.t.sol:test_PoC_GT05_SeApruebaEnElSegundoExactoDelVencimiento`
RF-V6	GT-06 Roles combinables	Override de `_grantRole` que revierta si la cuenta ya tiene un rol incompatible (operador con aprobador o guardián, y viceversa).	Nueva PoC antes del fix: `grantRole(APPROVER_ROLE, operator)` vía timelock y comprobar que se aplica; en la v2, que revierte.

Requerimientos no funcionales de la parte B
- Spec propia aprobada antes de tocar `contracts/` (esta parte solo los enumera).
- Las 5 PoC invertidas pasan en CI como tests de regresión, y los 29 tests de Hardhat y los 8 fuzz/invariantes siguen pasando.
- Slither sin hallazgos nuevos sin triagiar.
- Deploy nuevo y migración de fondos a la vista: retiro vía doble firma del contrato viejo al nuevo, con hashes registrados.

Preguntas abiertas
1. ¿Cuántos firmantes y qué umbral por Safe (por ejemplo, 2-de-3)? ¿Quiénes son los firmantes en una entrega individual?
2. ¿N días para el vencimiento de la pausa (RF-V1)?
3. ¿Se rota el proponente antes de la v2? Si su clave estuviera comprometida, el atacante podría cancelar la rotación: ¿alcanza con el ejecutor separado mientras tanto?
4. ¿La v2 reemplaza al despliegue actual en el README o convive como "v2 en Sepolia"?

Validación
- [ ] Spec aprobada por el usuario (parte A y parte B por separado). Motivo: borrador; quedan las preguntas abiertas 1 a 4.
- [ ] RF-S1 a RF-S5: hashes de cada paso en `deployments/sepolia-rotacion.json`, con `hasRole` comprobado.
- [ ] RF-V1 a RF-V6: PoCs invertidas pasando en CI contra el contrato v2.
