# Constitución del frontend de GovernedTreasury

Principios que no se negocian. Toda especificación, plan o cambio del frontend tiene que cumplirlos.
Si algo los contradice, se cambia la especificación antes que el código.

## 1. El frontend no modifica lo existente
- Los contratos, los tests, los scripts y el deploy en Sepolia quedan fuera del alcance: el frontend solo los consume.
- Lo único que toma del proyecto son los ABI compilados y las direcciones del deploy, en modo lectura.
- Si el frontend necesitara un cambio en un contrato, se documenta como pedido aparte y no se implementa acá.

## 2. Seguridad antes que comodidad
- El frontend nunca pide, guarda ni transmite claves privadas. Todas las firmas pasan por la billetera del usuario.
- La interfaz ayuda, pero no protege: la seguridad real está en el contrato. Ningún control depende solo del frontend.
- Antes de firmar, el usuario ve qué va a firmar: acción, monto y destino.

## 3. Nada se afirma sin evidencia
- Cada requisito tiene un criterio de aceptación verificable.
- Cada tarea indica qué requisitos cubre y cómo se validó.

## 4. La especificación manda
- Flujo: constitución → especificación → clarificación → plan técnico → tareas → implementación → validación.
- Todo cambio vuelve primero a la especificación.

## 5. Claridad para quien usa la app
- Los errores se explican en castellano, con el motivo y qué hacer.
- Se nombran las cosas como las entiende el usuario, no como están en el código.

## 6. Simplicidad
- Sin backend: el frontend habla directo con la blockchain.
- Se usan librerías establecidas (wagmi, viem) en lugar de reimplementar conexión, firma o decodificación.
- No se agregan dependencias sin una necesidad documentada en el plan.