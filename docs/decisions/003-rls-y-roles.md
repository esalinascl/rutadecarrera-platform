# ADR 003 — Roles de usuario y Row Level Security

- **Estado:** aceptada (2026-10-05)
- **Decisiones origen:** AD-9 → A y AD-10 → B1 (nota «DECISIÓN — AD-9 y AD-10» en el vault)
- **Implementa:** TASK 8, migración `003_auth_rls.sql`

## Contexto

Hasta la migración 001 las 4 tablas tenían RLS activado **sin políticas**: solo el backend con `service_role` accedía a los datos. Para que la app use sesiones de usuario (Magic Link, TASK 9) hace falta decidir quién puede qué.

## Decisión

1. **Roles (AD-9 → A).** `usuarios.rol` ∈ `cliente | consultor | admin`, por defecto `cliente`. Los créditos regulan el uso; el rol regula el acceso.
2. **Datos por sesión (AD-10 → B1).** Los datos de usuario se leen y escriben con la sesión del usuario y **RLS decide**: cada dueño ve lo suyo. `service_role` queda solo para créditos, pagos y administración. Que el consultor vea a sus clientes (B2) se decide después.
3. **Dos capas.** RLS limita las filas; `GRANT` por columna limita las columnas escribibles. Es lo que impide que un usuario cambie su `rol`, su `email`, el dueño de una conversación o `tokens_usage`.
4. **`anon` no tiene nada.** Sin privilegios ni políticas.
5. **Alta automática y email al día.** Un trigger sobre `auth.users` crea la fila en `usuarios` con rol `cliente` e ignora los metadatos del registro (los controla el usuario); otro copia el email cuando cambia. Un registro sin email se rechaza con mensaje claro (solo hay Magic Link).
6. **Sin DELETE desde el navegador.** Se agrega por TASK, con su política y su test.

## Consecuencias

- (+) Una política mal escrita no basta para escalar privilegios: la segunda capa (columnas) lo frena.
- (+) Probado con TDD: 46 tests sobre el SQL real, y se verificó que fallan si se rompe cada pieza.
- (−) Cada tabla futura necesita su propio `GRANT` explícito: es a propósito, pero es un paso fácil de olvidar.
- (−) Si una TASK futura necesita escribir una columna nueva desde el navegador, debe agregar su `GRANT`: es a propósito, pero es un paso fácil de olvidar. El test de «no puede escribir» lo avisa.
- (−) Las pruebas usan un Supabase emulado (PGlite). Cada migración se verifica además en staging antes de producción.

## Alternativas descartadas

- **Solo `service_role` y permisos en el código (AD-10 A):** un error de código expone datos de todos.
- **Tests contra Supabase real:** más fieles, pero escribirían en la nube desde el CI y exigirían secretos (regla: preview/PR nunca toca datos reales).
