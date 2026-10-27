Spec 009 — Lint del panel sin errores

Estado: aprobada por el usuario el 2026-10-27.

El problema
`npm run lint` en `frontend/` da 2 errores (corrida del 2026-10-27). Los dos son de código que ya estaba, no de un cambio nuevo:
- `src/components/Operate.jsx:39` — `no-useless-assignment`: en la rama "autorizar" se guarda el resultado de `run(...)` en `ok` y la función hace `return` enseguida, así que ese valor nunca se lee.
- `src/lib/tx.jsx:51` — `react-refresh/only-export-components`: el archivo exporta el componente `TxProvider` y también el hook `useTx`. Fast refresh (la recarga en caliente de Vite que conserva el estado) solo funciona bien si un archivo `.jsx` exporta únicamente componentes.

Qué es y qué no es
- Es un arreglo de estilo y estructura: los dos errores desaparecen sin cambiar lo que hace el panel.
- No es un cambio de funcionalidad, ni de contratos, ni de dependencias, ni de la configuración de ESLint (no se desactiva ninguna regla).

Cambios
- `Operate.jsx`: en la rama "autorizar" se llama `await run(...)` sin asignar a `ok`. El `let ok = false` inicial queda, porque si `tab` no coincide con ninguna rama ese es el valor que se lee.
- `useTx` y el contexto `TxContext` pasan a `src/lib/useTx.js`. `tx.jsx` importa el contexto de ahí y exporta solo `TxProvider`. Los componentes que usan `useTx` importan de `../lib/useTx.js`.

Criterios de aceptación
ID	Criterio
RF-L1	Dado el código de `frontend/`, cuando se corre `npm run lint`, entonces termina sin errores.
RF-L2	Dado el código de `frontend/`, cuando se corre `npm run build`, entonces el build termina bien.

Validación
- [x] RF-L1: `npm run lint` (2026-10-27): sin salida de ESLint, código de salida 0.
- [x] RF-L2: `npm run build` (2026-10-27): 1775 módulos, `✓ built`, código de salida 0. Sigue el aviso de siempre del bundle de más de 500 kB, que no es un error.
