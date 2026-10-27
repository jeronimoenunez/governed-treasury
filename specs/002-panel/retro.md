Retrospectiva — Spec 002 (Panel de tesorería)

Qué pasó
La spec 002 se escribió y se aprobó antes de implementar, como pide la constitución. Después se priorizó la implementación: el panel se construyó directamente desde la spec, sin escribir `plan.md` ni `tasks.md` por separado, como sí se hizo en la 001.

Qué funcionó
- La spec tenía requisitos concretos (RNF-10 a RNF-14: sin backend, tolerancia al RPC, sin dependencias nuevas, hora de la cadena, accesibilidad). Alcanzó para guiar el código: el panel no suma librerías de gráficos y achica el rango de `eth_getLogs` cuando el RPC lo limita (`frontend/src/lib/useHistory.js`).
- Reusar la infraestructura de la 001 (configuración, lecturas en lote, manejo de transacciones) redujo el trabajo nuevo.

Qué no funcionó
- Sin `tasks.md`, no hubo una lista para tildar contra la cual validar. La sección Validación de la spec quedó con dos casillas generales (local y Sepolia) que todavía no tienen evidencia.
- Sin `plan.md`, las decisiones de diseño (cómo agrupar los eventos por día, qué hacer si el RPC falla) quedaron solo en el código y en los comentarios, no en un documento revisable.
- El README afirmaba que todo se había trabajado con el ciclo completo de SDD. Hubo que aclararlo después.

Lección aprendida
El plan y las tareas no son burocracia: son lo que permite decir "esto está terminado" con evidencia. Un archivo de tareas corto, con un criterio de validación por tarea como en `specs/001-frontend/tasks.md`, cuesta poco escribirlo antes y ahorra discutir después qué falta. Desde la spec 005, cada spec trae su sección Validación con criterios concretos, y se tildan solo con la salida de un comando, una captura o un hash.

Qué queda pendiente
- Validar la spec 002 con evidencia: una captura o un registro del panel con actividad de varios días en la red local, y los gráficos con los movimientos reales del contrato en Sepolia.
