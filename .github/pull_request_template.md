## Qué y por qué

<!-- 2-3 líneas. Enlaza la TASK o la sección de la SPEC. -->

TASK:

## Lo verifica el CI automáticamente (no marcar a mano)

`pnpm lint` · `pnpm typecheck` · `pnpm test:coverage` (mínimo 80%) · `pnpm audit --audit-level=high`.
Si el check **verificar** está en rojo, el PR no se mergea.

## Lo que el CI NO puede verificar (revisar a mano)

**Gobernanza**
- [ ] La rama nació de `origin/main` actualizado (`git fetch && git switch -c ... origin/main`)
- [ ] No contradice ninguna decisión D1–D6 del PLAN (o registra una decisión nueva)
- [ ] No crea una segunda versión de algo que ya existe (una sola fuente de verdad)

**SDD**
- [ ] Cumple los criterios de aceptación de la TASK, sin agregar alcance fuera de la SPEC
- [ ] Documentación actualizada (README, `docs/`, docstrings) si cambió el comportamiento
- [ ] Si cambió el esquema de datos: nueva migración SQL + tipos + `COLUMNAS_POR_TABLA`

**Seguridad**
- [ ] Ninguna clave secreta en el código ni con prefijo `NEXT_PUBLIC_`
- [ ] Toda entrada externa se valida con los esquemas Zod de `@rcp/shared`
- [ ] El código que usa `@rcp/shared/db` corre solo en el servidor

## Cómo lo probé

<!-- Además del CI: qué probaste con datos reales (frases, fechas, casos límite). -->
