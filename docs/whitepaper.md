# GovernedTreasury: una tesorería con controles de banco que no depende de confiar en nadie

**Autor:** Jerónimo Núñez · Proyecto final del Ethereum Developer Pack (ETH Kipu · Talento Tech) · Octubre de 2026

**Repositorio:** [github.com/jeronimoenunez/governed-treasury](https://github.com/jeronimoenunez/governed-treasury) · **Contrato verificado:** [GovernedTreasury en Etherscan (Sepolia)](https://sepolia.etherscan.io/address/0x027EB81f2cb5686707fF0dF75b9013661F058aD0#code)

## 1. El problema

Toda organización que maneja dinero termina armando las mismas reglas. Quien pide un pago no es quien lo aprueba. Los montos grandes necesitan una segunda firma. Hay un máximo por operación y otro por día. Solo se le paga a proveedores que ya están dados de alta. Y si alguien quiere cambiar esas reglas, el cambio no puede aplicarse de un minuto para el otro. Los bancos lo llaman control interno, y existe porque el riesgo más común no es un ladrón de afuera: es una persona de adentro que se equivoca, o una cuenta que alguien roba.

En los sistemas tradicionales, esas reglas viven en un software que administra alguien. Y quien lo administra, en el fondo, puede saltearlas: un acceso privilegiado a la base de datos, un permiso mal dado, un cambio de configuración un viernes a la noche. Las reglas se cumplen mientras confiemos en quien las opera.

En el mundo de las criptomonedas el problema se repite de otra forma. Muchos contratos que guardan fondos tienen un "dueño": una sola clave privada que puede mover todo o cambiar las reglas en una sola operación, sin segunda firma, sin espera y sin que nadie pueda frenarla. Si roban esa clave, se pierde todo. Hubo casos reales de este tipo, y casi siempre la causa no fue un error sofisticado de programación, sino un poder concentrado en una sola llave.

GovernedTreasury parte de una pregunta simple: ¿se pueden tener los controles internos de un banco sin depender de que el operador sea honesto?

## 2. Por qué blockchain

Una blockchain como Ethereum permite publicar un programa, llamado contrato inteligente, que nadie puede modificar una vez desplegado y que se ejecuta exactamente como fue escrito. Eso cambia quién garantiza las reglas.

La primera ventaja es que las reglas se cumplen sin un intermediario de confianza. Los topes, la doble firma y la espera para los cambios no son una configuración que alguien puede tocar: son parte del contrato. Ni el administrador de un servidor, ni un proveedor de software, ni el propio autor del proyecto pueden saltearlas, porque no hay una base de datos detrás que editar.

La segunda es la trazabilidad. Cada depósito, cada pedido de pago, cada aprobación, cada rechazo y cada intento de cambiar las reglas queda registrado en la cadena, con fecha y con la identidad de quien lo firmó. Ese historial no se puede borrar ni reescribir.

La tercera es que cualquiera puede verificar los controles. El código del contrato está publicado y verificado en un explorador público. Un auditor, un socio o un regulador puede leer las reglas y comprobar, mirando operaciones reales, que se cumplen, sin pedirle permiso ni acceso a nadie.

Pero no todo son ventajas, y vale la pena decirlo. Todo es público: el saldo, los montos, los destinatarios y los horarios. Una empresa que no quiere mostrar sus pagos necesita otra solución. Cada operación cuesta una comisión de red, así que para muchos pagos chicos y frecuentes puede no convenir. Y aunque el contrato elimina al administrador todopoderoso, cada rol sigue siendo una clave privada: si se pierde, no hay "recuperar contraseña"; si la roban, el atacante actúa con ese rol. GovernedTreasury no elimina el problema de las claves: lo reparte y lo acota.

## 3. La solución

GovernedTreasury es una bóveda para un token digital que aplica cinco ideas, las mismas que usaría un banco.

**Funciones separadas.** Hay tres roles con tareas distintas. El operador hace los pagos chicos y pide los grandes. El aprobador revisa y firma los pedidos grandes. El guardián actúa en emergencias: puede pausar todo o sacar a un destinatario de la lista de inmediato. El contrato no deja que operador y aprobador sean la misma cuenta al arrancar, y nadie puede aprobar un pedido que hizo él mismo.

**Doble firma para los montos grandes.** Desde cierto monto (en la versión desplegada, 500 unidades), el operador no puede pagar directamente: tiene que crear un pedido, y otra persona, con el rol de aprobador, lo tiene que firmar. Los pedidos vencen a los tres días para que nadie apruebe semanas después algo fuera de contexto.

**Topes.** Hay un máximo por operación (1.000), un máximo diario total (3.000) y un máximo diario para los pagos que se hacen sin doble firma (1.000). Este último cierra una trampa clásica: partir un pago grande en muchos chicos para esquivar la segunda firma.

**Lista de destinatarios.** Solo se le puede pagar a direcciones que ya están agendadas. Si un destinatario se da de baja mientras un pedido espera aprobación, ese pedido ya no se paga.

**Cambios lentos, frenos rápidos.** Ninguna cuenta es dueña del contrato. El único administrador es un segundo contrato, un timelock, que obliga a que todo cambio de reglas (dar de alta un destinatario, cambiar los topes, dar un rol) se anuncie y espere 72 horas a la vista de todos antes de aplicarse. Durante esa espera, el guardián lo puede cancelar. En cambio, las medidas que restringen, como pausar o dar de baja un destinatario, son instantáneas. Ampliar permisos es lento; restringirlos es rápido.

## 4. Arquitectura

El sistema tiene tres contratos desplegados en Sepolia, la red de pruebas pública de Ethereum, y dos herramientas que los rodean.

La bóveda es el contrato principal: custodia los fondos y aplica todos los controles. El timelock es su único administrador, y por él pasa cualquier cambio de reglas, con la espera obligatoria. El token de prueba es la "moneda" que custodia la bóveda; no tiene valor real y existe solo para demostrar el funcionamiento.

Alrededor hay dos piezas fuera de la cadena. La primera es un panel web desde el que cada rol opera con su propia billetera digital. El panel nunca pide ni guarda claves: arma la operación y le pide a la billetera que la firme. Esto importa porque el panel no decide nada; decide el contrato. Si alguien alterara el panel, lo peor que podría hacer es pedir firmas para operaciones que el contrato acepta de todos modos, siempre dentro de los topes y hacia destinatarios agendados.

La segunda pieza es un monitor que recorre la cadena bloque por bloque y avisa por consola, Slack o Telegram cuando pasa algo importante: un cambio de reglas programado, una pausa, un rol otorgado o un intento de operación que el contrato rechazó. El monitor no protege por sí mismo, pero es lo que le permite al guardián enterarse a tiempo para cancelar un cambio sospechoso dentro de las 72 horas.

## 5. Seguridad

Un sistema que guarda dinero tiene que mostrar no solo que funciona, sino también qué pasa cuando alguien intenta romperlo. GovernedTreasury pasó por varias capas de revisión, y los resultados están publicados con la evidencia de cada una.

Hay una batería de pruebas automáticas que cubre el funcionamiento normal y los ataques más evidentes: una cuenta sin rol que intenta retirar, un operador que se intenta aprobar a sí mismo, un pago a una dirección no agendada, un intento de esquivar la doble firma partiendo un pago, un token malicioso que intenta reingresar en la bóveda en medio de un pago. Además se usaron pruebas aleatorias masivas, que prueban miles de combinaciones de montos, cuentas y momentos buscando una que rompa las reglas, y una herramienta de análisis automático de código. Ninguna encontró una forma de que una cuenta sin permiso mueva fondos o cambie reglas.

Después hubo una revisión de seguridad asistida por inteligencia artificial, en la que cada hallazgo se verificó contra el código y se demostró con una prueba ejecutable. No es una auditoría externa, y el informe lo dice. Los hallazgos no están en lo que puede hacer un desconocido, sino en lo que puede hacer alguien que ya tiene un rol privilegiado, y en algunos bordes de diseño. Los más importantes:

- **Un guardián malicioso puede congelar los fondos sin límite.** Puede pausar la bóveda y, como también puede cancelar cambios programados, cancelar cada intento de reanudarla o de quitarle el rol. No puede robar, pero puede dejar los fondos inmovilizados.
- **Un proponente con la clave robada podría vaciar la bóveda si nadie reacciona en 72 horas.** Podría programar darse los roles, agendar su propia dirección y subir los topes. La defensa es justamente la espera a la vista y el guardián que cancela, pero depende de que alguien esté mirando.
- **El tope diario se calcula por día calendario.** Quien tenga los dos roles necesarios puede usar el tope un minuto antes de la medianoche y otra vez un minuto después.
- **Hay bordes menores:** un token que cobre comisión haría que los registros de depósito no coincidan con lo recibido, y un pedido se puede aprobar en el segundo exacto en que vence.

Cada uno de estos hallazgos tiene una prueba que hoy se ejecuta y demuestra que el problema existe. La idea es que, cuando se corrijan en una versión nueva del contrato, esas pruebas fallen y se conviertan en controles que impidan que el problema vuelva. El contrato desplegado no se modificó: en una blockchain, un contrato publicado no se cambia, y corregirlo implica desplegar uno nuevo y mover los fondos a la vista.

También se corrigieron dos problemas que no requerían tocar el contrato. El monitor describía mal ciertas operaciones programadas, porque no mostraba a qué contrato apuntaban. Y una de las reglas que las pruebas aleatorias tenían que vigilar no podía fallar nunca. Para comprobar que la regla corregida sirve, se probó contra una versión del contrato modificada a propósito con una falla: la regla vieja no la detectaba y la nueva sí.

## 6. Evidencia

Nada de lo anterior pide que se le crea al autor. Los tres contratos están desplegados en Sepolia y verificados en Etherscan, con el código fuente publicado. Sobre ellos se ejecutó un guion de prueba que dejó once operaciones reales registradas en la cadena: siete acciones legítimas (un pago directo, un pedido grande con su aprobación, otro pedido rechazado por el guardián, un cambio de reglas programado y su cancelación) y cuatro ataques que el contrato rechazó (una cuenta sin rol que intenta retirar, un pago a un destino no agendado, un operador que intenta aprobar sin tener el rol y un intento de aplicar un cambio de reglas antes de las 72 horas). Cada una tiene su enlace público.

Los resultados de las pruebas automáticas, de la medición de cobertura, del costo de cada operación y del análisis automático también están publicados, tal como salieron de ejecutarlos, junto con el informe de la revisión de seguridad. Además, un sistema de integración continua vuelve a ejecutar las pruebas cada vez que se modifica el proyecto.

## 7. Limitaciones

GovernedTreasury es un producto mínimo viable para una red de pruebas, y tiene límites claros:

- Si el operador y el aprobador se ponen de acuerdo o los dos pierden sus claves, pueden sacar hasta el tope diario hacia destinatarios ya agendados. Los topes acotan el daño, no lo evitan.
- La bóveda confía en el token que custodia. Un token con errores o con un dueño malicioso queda fuera de lo que el contrato puede controlar.
- Cada rol es hoy una sola clave. Cómo se custodian esas claves no lo resuelve el código.
- El token de prueba tiene un dueño que puede emitir unidades nuevas. Está bien para una demostración, no para producción.
- Todo es público: no sirve para quien necesite reservar montos o destinatarios.
- Los hallazgos de la revisión de seguridad siguen abiertos en el contrato desplegado hasta que exista una versión nueva.

## 8. Roadmap

Los próximos pasos apuntan a cerrar esas limitaciones. El primero es que cada rol crítico (el proponente, el aprobador y el guardián) pase a ser una billetera multifirma, donde una operación necesita varias firmas de un grupo, de modo que comprometer un rol exija robar varias claves y no una. Junto con eso, hay un procedimiento para reemplazar, a través del mismo timelock y a la vista de todos, las cuentas usadas durante el desarrollo.

El segundo es una versión nueva del contrato que corrija los hallazgos de la revisión: una pausa que se levanta sola si nadie la renueva, un tope diario calculado sobre las últimas 24 horas, depósitos que registren lo realmente recibido y roles que no se puedan combinar en una misma cuenta.

Más adelante: topes distintos por destinatario, una referencia de factura en cada pago para facilitar la conciliación, un analista automático de solo lectura que explique la actividad y señale patrones de riesgo sin poder firmar nada, y la publicación del panel para que cualquiera pueda usarlo sin instalar nada.

La idea de fondo no cambia: que las reglas de una tesorería no dependan de la buena fe de quien la opera, sino de un código que cualquiera puede leer y de un historial que nadie puede borrar.
