# Alta de miembros de la Red

SPEC «Web de la Red y área de miembros» v1.0 (R6). El registro en `/auth/login`
está **cerrado**: solo entran las cuentas que se dan de alta con este script.

## Lista

CSV con coma o punto y coma (sirve el que exporta Excel). **No va al repo**:
tiene datos personales. Encabezado:

```
correo,nombre,codigo_disc
ana@ejemplo.cl,Ana Pérez,CODIGO-DE-ANA
```

`codigo_disc` es opcional y debe ser un código válido del test DISC (lo entrega
el hilo del DISC). Un código no puede repetirse entre dos miembros.

## Uso

Siempre con Doppler (las claves nunca pasan por la terminal). Primero simular:

```bash
doppler run --config dev -- node packages/shared/scripts/alta-miembros.ts lista.csv --simular
doppler run --config dev -- node packages/shared/scripts/alta-miembros.ts lista.csv
```

Producción, **solo con el OK de Eduardo** (el script se niega sin `--produccion`
y también si `--produccion` no coincide con el entorno de Doppler):

```bash
doppler run --config prd -- node packages/shared/scripts/alta-miembros.ts lista.csv --produccion
```

## Qué hace

- Crea la cuenta con el correo ya confirmado, **sin enviar correo** (la
  invitación va aparte, con la regla de envíos).
- Deja el rol `consultor`. Nunca baja el rol de nadie (un `admin` sigue `admin`).
- Asigna el código DISC en la tabla `codigos_disc` (migración 004).
- Es idempotente: correrlo dos veces deja todo igual.
- Imprime solo correos y acciones.

## Requisito

La migración `004_codigos_disc.sql` aplicada en el entorno (primero staging).
