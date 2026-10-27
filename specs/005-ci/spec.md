## Spec 005 — Integración continua con GitHub Actions

**Estado:** Integracion revisada y aprobada por Jeronimo Nuñez el 2026-10-27. Workflow en `.github/workflows/ci.yml`.

**Qué es y qué no es**
- Es un workflow de GitHub Actions que, en cada push a main y en cada pull request, instala las dependencias y corre los tests de Hardhat y de Foundry en una máquina limpia de GitHub. Si algo se rompe, el commit o el PR queda marcado en rojo.
- No es un deploy: no toca Sepolia, no tiene claves, no usa secretos de GitHub y no puede escribir en el repo. Tampoco corre cobertura, gas ni Slither (quedan fuera de alcance, ver abajo).

**Cómo lee hardhat.config.js las variables (revisado sin abrir .env)**
- `require("dotenv").config()` carga `.env` si existe. En CI no existe (está en `.gitignore`), así que `SEPOLIA_RPC_URL`, `PRIVATE_KEY` y `ETHERSCAN_API_KEY` quedan `undefined`.
- La config ya tiene valores por defecto para ese caso: `url: SEPOLIA_RPC_URL || ""`, `accounts: PRIVATE_KEY ? [PRIVATE_KEY] : []` y `apiKey: ETHERSCAN_API_KEY || ""`. La red `sepolia` queda declarada pero vacía, y `npx hardhat test` usa la red local en memoria de Hardhat, que no lee nada de eso.
- Comprobado el 2026-10-26 en un clon limpio del repo (sin `.env`) y con esas tres variables borradas del entorno: `npx hardhat test` → 29 passing; `forge test` → 8 tests passed, 0 failed.

- **Conclusión:** la solución mínima es no hacer nada. No hace falta clave privada, ni la cuenta #0 pública de Hardhat, ni bloque `env:` en el workflow, ni tocar `hardhat.config.js`. Si en el futuro la config exigiera una clave para cargar, ahí sí se agregaría la cuenta #0 de Hardhat (pública, sin fondos reales) con un comentario que lo diga.

## Requerimientos funcionales
**ID	Requerimiento ~ Criterio de aceptación**
- **RF-C1	Disparadores:**	Dado un push a main o un pull request (a cualquier rama), cuando llega a GitHub, entonces el workflow corre.
- **RF-C2	Instalación reproducible:**	Dado el `package-lock.json` commiteado, cuando corre `npm ci` con Node 22, entonces instala exactamente las versiones del lock (incluido `forge-std` desde GitHub).
- **RF-C3	Tests de Hardhat:**	Cuando corre `npx hardhat test`, entonces pasan los 29 tests y el job queda en verde. Si uno falla, el job falla.
- **RF-C4	Tests de Foundry:**	Dado Foundry instalado con `foundry-rs/foundry-toolchain@v1` fijado en `v1.7.1` (stack fijo), cuando corre `forge test`, entonces pasan los 14 tests de Foundry: 4 de fuzzing, 4 invariantes, 5 PoC del red team y 1 de sanidad de su base (spec 008). Las PoC pasan cuando el ataque funciona: el verde dice que el hallazgo sigue reproducible, no que el sistema sea seguro. Se usa `forge test` y no `npm run fuzz`, porque ese script apunta al solc de Hardhat en macOS; en Linux forge baja el solc 0.8.24 que pide `foundry.toml`.
- **RF-C5	Badge:**	El README muestra debajo del título el badge del workflow, con link a la pestaña Actions del repo.
- **RF-C6	Check del monitor (spec 006):**	Después de `npx hardhat test` (que deja `artifacts/` compilado), cuando corre `node scripts/check-monitor-destino.js`, entonces pasan sus 6 casos. Si uno falla, el job falla. El script no carga `.env` ni usa la red.

## Requerimientos no funcionales
**ID	Requerimiento**
- **RNF-C1	Mínimo privilegio:** el workflow declara `permissions: contents: read`. El token de GitHub del job solo puede leer el código; no puede pushear, comentar PRs ni crear releases.
- **NF-C2	Sin secretos:** el workflow no referencia `secrets.` ni define variables con claves. Se revisa con `grep -nE "secrets\.|_KEY|PRIVATE|WEBHOOK|TOKEN" .github/workflows/ci.yml` y tiene que dar vacío.
- **RNF-C3	Sin red externa a la cadena:** ningún paso usa `--network sepolia` ni corre scripts que hablen con la red (`deploy.js`, `interact.js`, `monitor.js`). El único script que corre es `scripts/check-monitor-destino.js` (RF-C6), que no carga `.env` ni crea un provider.
- **RNF-C4	Archivo único y corto:** `.github/workflows/ci.yml`, un solo job, comentado en castellano para poder defender cada paso en vivo.

## Diseño propuesto (para aprobar junto con la spec)
- Un job `test` en `ubuntu-latest`.
- Pasos: `actions/checkout@v4` → `actions/setup-node@v4` (Node 22, caché de npm) → `npm ci` → `npx hardhat test` → `node scripts/check-monitor-destino.js` (agregado por la spec 006) → `foundry-rs/foundry-toolchain@v1` (`version: v1.7.1`) → `forge test`.
- Badge: `https://github.com/jeronimoenunez/governed-treasury/actions/workflows/ci.yml/badge.svg`.

## Fuera de alcance
- Cobertura, reporte de gas y Slither en CI (se pueden sumar en una spec aparte).
- Fijar las actions por hash de commit en vez de por tag (más seguro contra un tag movido; queda anotado como mejora).
- Correr el lint o el build del frontend.

## Riesgos y notas
- El badge muestra "no status" hasta el primer push con el workflow; commit y push los hace el usuario (regla 7 de AGENTS.md).
- `npm ci` necesita git para bajar `forge-std` (dependencia `github:`); los runners de GitHub lo traen.
- El CI corre sobre lo commiteado. Los archivos sin commitear (`AGENTS.md`, `specs/003-readme/`, etc.) no participan, pero no afectan los tests.

## Validación
- [x] Spec aprobada por el usuario (2026-10-27).
- [x] RNF-C1 y RNF-C2: `permissions: contents: read` en las líneas 12-13 de `ci.yml`; grep de RNF-C2 sin coincidencias (exit 1), 2026-10-27. RNF-C3 (versión original, antes de RF-C6): fuera de los comentarios no aparecía `sepolia` ni `scripts/` (grep exit 1). YAML válido (lo parseó `ruby -ryaml`).
- [x] RF-C1 (push), RF-C2, RF-C3, RF-C4 y RF-C6: corrida #2, https://github.com/jeronimoenunez/governed-treasury/actions/runs/40528929199 (commit `5f2998f`, Success, 29 s). Según la API pública de GitHub, todos los pasos dieron `success`: `npm ci`, `npx hardhat test`, `node scripts/check-monitor-destino.js` y `forge test`. Los conteos (29 Hardhat, 14 Foundry, 6 casos del monitor) están verificados en la corrida local de `docs/evidencia/` (`test.txt`, `fuzz.txt`, `monitor-destino.txt`); el CI terminó en verde. Antes, la corrida #1 (commit `2117e2e`) también terminó en verde: https://github.com/jeronimoenunez/governed-treasury/actions/runs/40523333072.
- [ ] RF-C1: una corrida disparada por un pull request (link). Motivo: todavía no se abrió ningún PR; la única corrida es la del push.
- [x] RF-C5: el badge del README apunta a `actions/workflows/ci.yml/badge.svg`, y ese SVG devuelve "passing" después de la corrida #2 (consultado con curl el 2026-10-27).
