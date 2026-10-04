# ADR 001: Uso de Google Gemini como modelo de IA

## Estado

Aceptado (decisión ya tomada antes de este ADR — ver "Contexto").

## Contexto

Este documento se escribe en TASK 6 (integración real con Gemini), pero la
elección del modelo **no se decidió en este momento**: la SPEC y el PLAN del
proyecto ya mencionaban Gemini como el modelo a usar desde su redacción
inicial (`README-FASE3.md`: *"IA: Gemini API Pro (tu plan)"*).

**Honestidad sobre el alcance de este ADR:** no existe en el vault ni en el
código un análisis comparativo formal contra Claude (Anthropic) u OpenAI/GPT
que se haya hecho antes de elegir Gemini. Este documento no inventa esa
comparación retroactivamente — documenta las restricciones conocidas que
Gemini sí debe cumplir (ya definidas en la SPEC), y dejas explícito que la
comparación formal está pendiente si en algún momento se quiere revisar la
decisión.

## Restricciones que el modelo elegido debe cumplir (de la SPEC)

- Latencia P95 < 3s (por eso el timeout de `callGemini` es 5s: da margen
  sobre el objetivo de 3s antes de cortar la solicitud).
- Costo objetivo: < $50/mes en la API del modelo.

## Decisión

Se mantiene Gemini para TASK 6. Modelo específico: `gemini-2.5-flash`
(decisión tomada el 2026-09-26, ver `GEMINI_MODEL` en `.env.example` — el
código anterior tenía `gemini-pro` hardcodeado como default, un modelo
descontinuado).

## Consecuencias

- El proyecto depende de la disponibilidad y pricing de Google AI Studio /
  Vertex AI para el modelo elegido.
- `@rcp/shared/utils/gemini.ts` (`callGemini`, `formatGeminiPrompt`,
  `extractAnalysis`) queda acoplado específicamente al formato de payload de
  la API de Gemini (`contents`, `generationConfig`, etc.) — cambiar de
  proveedor de IA más adelante requeriría reescribir ese archivo, no solo
  cambiar una variable de entorno.
- Pendiente (fuera de alcance de este ADR): si se quiere validar la decisión
  con una comparación real, debería medirse costo y latencia reales en
  producción contra al menos una alternativa antes de comprometerse más
  (ej. antes de TASK 9/autenticación, cuando el tráfico real empiece a
  generar costo).

## Actualización 2026-10-03

- **Migración de modelo:** Google descontinuó `gemini-2.5-flash`. El modelo
  vigente del proyecto pasa a ser `gemini-3.8-flash` (`GEMINI_MODEL` en
  `.env.example`). La decisión de fondo (usar Gemini) no cambia.
- **`model` ahora es obligatorio:** `callGemini` ya no tiene modelo por
  defecto (antes caía en `gemini-pro`, también descontinuado). El tipo de sus
  opciones exige `model` en compilación y, en runtime, lanza `GeminiError`
  con code `MISSING_MODEL` antes de llamar a la API si el modelo falta o
  viene vacío. `extractAnalysis` recibe el modelo como parámetro obligatorio
  y `getDefaultGeminiConfig()` dejó de devolver un modelo. Así, el próximo
  modelo que se descontinúe solo requiere cambiar `GEMINI_MODEL`, sin riesgo
  de que un default oculto falle en silencio en producción.
