# Historial de cambios — Segmentador de Reportes Web

Este documento registra los cambios más importantes realizados en el proyecto desde su inicio.

---

## [v0.7] — 2026-05-07

### Editor de plantillas más amigable para usuarios no técnicos

Cambios solo en la UI del wizard de administración (`/admin/templates`). El motor del pipeline, los tipos y el formato JSON guardado en BD **no cambian**: las plantillas existentes se cargan y guardan exactamente igual.

- **Traducciones inglés→español**: nuevos helpers en `webapp/lib/wizard/labels.ts` cubren `FilterOp`, `DeriveOp`, agregados (`sum`, `count`, …), `scope`, `onMismatch`, formato de columnas, estrategia de cabecera, transformaciones de variable y tipos de step. El JSON sigue guardando los mismos códigos en inglés; solo cambia la presentación.
- **Selects con nombres amigables en lugar de IDs sueltos**:
  - `<DatasetSelect>` reemplaza el input de "ID del dataset origen" por un select que muestra `Reporte CORTE 1 (Cargar hoja Excel)`, `Filtrar filas: base`, etc.
  - `<DatasetMultiSelect>` reemplaza los inputs `coma-separados` para listas de datasets (reportSources, datasets de validación). IDs huérfanos (apuntan a steps inexistentes) se muestran con tag amarillo "no encontrado" para que el admin los corrija sin perderlos.
- **Preview de regex en vivo**: el campo "Expresión regular del nombre de archivo" (paso 2) ahora ofrece un campo de prueba; al tipear un nombre de ejemplo se muestran las capturas en pills verdes (`corte=1`, `mes=MARZO`) o un mensaje rojo si la regex no compila o no matchea.
- **Editor visual de tabla de equivalencias**: la operación `lookup` en transforms cambió el campo JSON crudo por un editor key-value con filas "valor original" → "valor destino" y botones para agregar/eliminar.
- **Inserción de variables por click**: en el paso 6, panel lateral con las variables disponibles (`{AGENCIA}`, `{PERIODO_COMI}`, etc.) que se insertan en el campo de nombre de archivo activo con un click.
- **ID interno auto-generado para pasos nuevos**: al crear una hoja, filtro o columna calculada, el identificador interno se genera desde el nombre (`reporte_corte_1`, `derive_agencia_normalizada`). Botón "Personalizar" para cambiarlo manualmente. **Plantillas existentes con IDs custom se respetan**: la auto-generación no se aplica si el ID ya viene asignado.
- **Multi-cabecera sin sensación de "no guardó"**: el input de filas de `multi_level` ahora actualiza el valor en `onChange` además de `onBlur`.
- **Mensajes de error humanos**: `humanizePath()` traduce paths técnicos (ej: `$.steps[3].agencyColumn.report`) a frases como "Paso 4 'segmenta' (Segmentar por agencia) → falta la columna de agencia del reporte". El path técnico se mantiene como detalle expandible para soporte. Se aplica tanto en la pantalla principal del editor como en la pestaña Avanzado.
- **Pestaña JSON marcada como "Avanzado (JSON)"** con icono de llave y banner naranja de advertencia: *"Edición técnica. Cambios incorrectos pueden romper la plantilla."*. Botón "Reset" renombrado a "Restaurar".
- **Cambios técnicos**:
  - Nuevos archivos: `webapp/lib/wizard/labels.ts`, `webapp/lib/wizard/path-translator.ts` (+ tests), `webapp/lib/wizard/describe-dataset.ts`.
  - Nuevos componentes: `wizard/components/{dataset-select, dataset-multi-select, regex-preview, lookup-table-editor, variables-panel}.tsx`.
  - Refactor de las 7 pestañas existentes para usar los componentes y labels nuevos.
  - 12 tests adicionales en `lib/wizard/path-translator.test.ts` (106 tests verdes en total).
- **Migración**: ninguna. Las 4 plantillas en BD se cargan y guardan sin alterar el JSON.

---

## [v0.6] — 2026-05-06

### Nueva funcionalidad: Unificar agencias por RUC

- **Problema**: en plantillas como "Provincias Norte Corte 1", la columna `AGENCIA` de la hoja `Reporte CORTE 1` traía valores compuestos (ej: `ALIV TELECOM S.A.C. Áncash`, `ALIV TELECOM S.A.C. La Libertad`, etc.). Esto generaba 4 archivos en el ZIP cuando el negocio espera un único archivo por agencia real.
- **Solución**: nuevo campo opcional `unifyByLookup` en `split_by_column` que, después de `validate` y antes de `write_output`, fusiona los grupos que comparten el mismo RUC bajo un único nombre canónico tomado de la base.
  - Estructura:
    ```json
    "unifyByLookup": {
      "report": { "rucColumn": "RUC" },
      "base": { "rucColumn": "DNI_ASESOR", "canonicalNameColumn": "ASESOR" }
    }
    ```
  - El motor construye en runtime el mapa `RUC → nombre canónico` desde la hoja base; los grupos cuyo RUC no aparece en el mapa se conservan tal cual y se emite un `warn`.
  - La validación per_agency sigue operando sobre los grupos pre-fusión, así que los descuadres por sub-agencia (ej: Áncash vs La Libertad) siguen siendo visibles aunque el ZIP entregue un único archivo por agencia canónica.
- **Wizard del admin (paso 5)**: nueva sección plegable "Unificar agencias por RUC (opcional)" con 3 inputs. Si los 3 campos están vacíos al guardar, el campo `unifyByLookup` se omite del JSON y la plantilla se comporta como antes.
- **Validador**: si `unifyByLookup` está presente, se exige que los 3 campos sean strings no vacíos y que `baseSource` esté definido.
- **Plantilla "Provincias Norte Corte 1"** actualizada:
  - `agencyColumn.base` se mantiene como `"AGENCIA DEPARTAMENTO"` para que la validación per_agency siga cuadrando reporte y base por sub-agencia (departamento) ANTES de la unificación.
  - Añadido `unifyByLookup` con `RUC` / `DNI_ASESOR` / `ASESOR`.
  - Añadido `DNI_ASESOR` a `expectedColumns` del load_sheet de BASE.
- **Cambios técnicos**:
  - Nuevo tipo `UnifyByLookup` y campo `SplitByColumnStep.unifyByLookup` en `lib/pipeline/types.ts`.
  - Nuevo módulo `lib/pipeline/steps/unify-groups.ts` con helper `unifyGroupsByRuc`.
  - `engine.ts` invoca el helper una sola vez antes del primer `write_output` cuando hay un `split_by_column` con `unifyByLookup`.
  - 7 tests adicionales en `lib/pipeline/steps/unify-groups.test.ts` (94 tests verdes en total).
- **Migración**: ninguna para plantillas existentes sin `unifyByLookup`. Solo "Provincias Norte Corte 1" cambia su comportamiento (genera 1 archivo por agencia en lugar de uno por departamento).

### Cambio cosmético: labels más descriptivos en validaciones

- Wizard del admin (paso 5, reglas de validación): los `SideEditor` ahora se llaman **"Hoja Reporte"** y **"Hoja Base"** en lugar de "Lado izquierdo" y "Lado derecho".
- Pantalla de resultado de ejecución: las columnas de la tabla de descuadres ahora se llaman **"Hoja Reporte"** y **"Hoja Base"** en lugar de "Izq" y "Der".
- Logs del backend: los mensajes de validación ahora dicen `Hoja Reporte X vs Hoja Base Y` y `OK (Hoja Reporte = Hoja Base = X)` en lugar de `X vs Y` y `OK (X)`.

---

## [v0.5] — 2026-05-05

### Nueva funcionalidad: Resaltado de cabeceras

- **Defaults globales**: en todas las hojas generadas, las columnas cuyo nombre contenga:
  - `Penalidad` → fondo `#0070C0` (azul claro), letra blanca.
  - `Clawback` → fondo `#002060` (azul oscuro), letra blanca.
- **Reglas custom por plantilla**: nueva sección **"Resaltado de cabeceras"** en el paso 6 del wizard de admin permite añadir reglas adicionales o sobrescribir los defaults. Cada regla define:
  - Lista de términos (case-insensitive, sin tildes, match por substring).
  - Color de relleno y de fuente en formato hex `#RRGGBB`.
- **Prioridad**: las reglas custom se evalúan antes que los defaults; la primera que matchea gana. Sin match → naranja institucional `#FF6B00`.
- **Cambios técnicos**:
  - Nuevo tipo `HeaderHighlight` y campo `WriteOutputStep.perAgency.headerHighlights` en `lib/pipeline/types.ts`.
  - Eliminado el campo huérfano `OutputFormat.headerStyle` que nunca se implementó.
  - Helpers `resolveHeaderStyle` y `hexToArgb` en `lib/pipeline/steps/write-output.ts`.
  - Validación de formato de hex en `lib/pipeline/validator.ts`.
  - 6 tests adicionales en `lib/pipeline/steps/write-output.test.ts` (87 tests verdes en total).
- **Migración**: ninguna. Las plantillas existentes funcionan sin tocarse; los defaults aplican automáticamente desde la próxima ejecución.

---

## [v0.4] — 2026-04-28 (FASE 4 y FASE 5)

### Optimizaciones (FASE 4)

- **TTL automático de archivos (pg_cron)**: se creó un job en Supabase que se ejecuta diariamente a las 03:15 UTC, eliminando:
  - Archivos del bucket `inputs` y `outputs` con más de **7 días** de antigüedad.
  - Registros de `process_runs` con más de **30 días**.
  - Función: `public.cleanup_old_runs_and_storage()`.
  - Migración: `006_storage_ttl_cron.sql`.

- **Rate limiting por usuario**: se implementó un límite de llamadas por hora para proteger los endpoints pesados:
  - `/api/process`: máximo **10 procesamientos por hora** por usuario.
  - `/api/upload-url`: máximo **30 generaciones de URL** por hora por usuario.
  - Implementado con función Postgres `public.check_rate_limit()` y tabla `api_rate_limits`.
  - Migración: `007_rate_limiting.sql`.
  - El API retorna HTTP `429 Too Many Requests` con cabecera `Retry-After` cuando se supera el límite.

- **Seguridad de funciones SECURITY DEFINER**: se revocaron los permisos de `anon` en todas las funciones internas de la base de datos:
  - `cleanup_old_runs_and_storage`: solo `postgres` (para pg_cron).
  - `handle_new_user`: solo vía trigger, sin grants externos.
  - `check_rate_limit` e `is_admin`: solo rol `authenticated`.
  - Migración: `008_lockdown_security_definer_functions.sql`.

### Deploy (FASE 5)

- **`vercel.json` creado** con configuración para producción:
  - Función `/api/process`: `maxDuration=60s`, `memory=1024MB`.
  - Región: `gru1` (São Paulo) para minimizar latencia con Supabase `sa-east-1`.
- **`.env.example` actualizado** con descripción de cada variable.
- **`README.md` actualizado** con instrucciones completas de deploy a Vercel.

---

## [v0.3] — 2026-04-28 (FASE 3)

### Administración de plantillas — Wizard de 6 pasos

- **Nueva sección `/admin/templates`** (solo visible para administradores):
  - Lista de todas las plantillas con estado (activa/inactiva), versión y fecha de actualización.
  - Acciones: editar, duplicar, activar/desactivar, eliminar (con confirmación).

- **Editor de plantillas con 7 tabs**:
  1. **Datos básicos** — nombre, descripción, estado activo.
  2. **Inputs** — expresión regular del nombre de archivo y variables derivadas (ej: `monthYearToYYYYMM` para convertir "MARZO 2026" → "202603").
  3. **Hojas** — carga de hojas Excel con detección de cabecera (`auto`, `fixed_row`, `multi_level`).
  4. **Transformaciones** — pasos de `filter_rows` y `derive_column` con todas las operaciones disponibles.
  5. **Segmentar + Validar** — configuración de `split_by_column` (alias de agencias) y reglas de validación (`per_agency` o `global`).
  6. **Salida** — configuración de `write_output`: hojas por agencia, plantillas de nombre de archivo/ZIP, formatos de columnas.
  7. **JSON** — edición directa del pipeline con validación antes de aplicar.

- **API routes de administración**:
  - `POST /api/templates` — crear plantilla.
  - `PUT /api/templates/:id` — actualizar (incrementa versión automáticamente).
  - `PATCH /api/templates/:id` — activar/desactivar.
  - `DELETE /api/templates/:id` — eliminar.
  - `POST /api/templates/:id/duplicate` — clonar como inactiva para editar libremente.

- **Validador de pipeline** (`lib/pipeline/validator.ts`): valida la estructura antes de guardar en Supabase, tanto desde el editor JSON como desde la API.

- **Nuevos componentes UI**: `Tabs`, `Textarea`, `Dialog` (para confirmaciones).

---

## [v0.2] — 2026-04-22 (FASE 2)

### Flujo de ejecución

- **Pantalla `/execute/[templateId]`**: interfaz con drag & drop para subir archivos Excel.
- **Subida directa a Supabase Storage** (bucket `inputs`) mediante URL firmada, evitando pasar archivos grandes por Vercel (solución al límite de 4.5 MB del body).
- **API `/api/upload-url`**: genera la URL firmada con path `{userId}/{runId}/{fileName}`.
- **API `/api/process`**: descarga el archivo de Storage, ejecuta el pipeline declarativo, sube el ZIP al bucket `outputs`, registra el procesamiento en `process_runs` y devuelve URL de descarga firmada.
- **Panel de resultados**: muestra validaciones por agencia (éxito/advertencia), logs del procesamiento y enlace de descarga del ZIP.
- **Historial `/runs`**: lista los últimos procesamientos con estado, plantilla usada y botón para re-descargar el ZIP (válido 7 días).

### Correcciones de bugs

- **Status constraint**: corregido valor de estado de `"processing"` a `"running"` para cumplir el `CHECK` de la tabla `process_runs`.
- **Hoja BASE**: actualizada referencia de hoja `"Detalle"` a `"BASE"` en la plantilla Lima Corte 1.
- **Columna ASESOR**: corregida columna de agencia en hoja BASE de `"AGENCIA"` a `"ASESOR"` con `agencyColumn: { report: "AGENCIA", base: "ASESOR" }`.
- **Hojas incorrectas en ZIP**: solucionado bug donde se incluía el dataset global de todas las agencias en hojas de reportes cuando una agencia no tenía filas en esa hoja. Ahora la hoja se omite en lugar de rellenarse con datos incorrectos.
- **Validación `altas_totales_global` engañosa**: eliminada regla global que comparaba suma de tres hojas (Horizontal + Vertical + Marcha Blanca) contra count de BASE, que generaba un warn incorrecto. Solo se mantiene la validación `per_agency`.
- **Alias EXPORTEL**: añadido alias para que "EXPORTEL S.A.C." y "EXPORTEL PROVINCIA" se traten como la misma agencia.

---

## [v0.1] — 2026-04-20 (FASE 1)

### Motor de pipeline declarativo

- **`lib/pipeline/types.ts`**: tipos TypeScript de todo el sistema (Dataset, Pipeline, Steps, Context, etc.).
- **`lib/pipeline/engine.ts`**: orquestador principal que ejecuta los pasos en secuencia.
- **Pasos implementados**:
  - `load_sheet`: carga hojas de Excel con detección automática, fija o multi-nivel de cabecera.
  - `filter_rows`: filtra filas con operadores `equals`, `in`, `contains`, `gt`, `lt`, `between`, etc. Soporta referencias a variables con prefijo `$`.
  - `derive_column`: crea columnas derivadas con operaciones `strip_suffix`, `lookup`, `normalize_name`, `concat`, `regex_replace`, `constant`.
  - `split_by_column`: segmenta datasets por agencia, manejando alias y diferencias de columnas entre reportes y base.
  - `join`: une dos datasets por columna clave.
  - `validate`: valida agregados entre datasets (`sum`, `count`, `count_distinct`) a nivel global o por agencia.
  - `write_output`: genera un XLSX por agencia, comprime en ZIP.
- **`lib/excel/reader.ts`**: lectura de archivos Excel con normalización de celdas y estrategias de detección de cabecera.
- **`lib/pipeline/utils/normalize.ts`**: normalización de texto (tildes, mayúsculas, espacios).
- **`lib/pipeline/utils/filename-parser.ts`**: extracción de variables de nombres de archivo con regex y transformaciones.

### Infraestructura

- **Supabase**: proyecto `segmentador-reportes` creado en región `sa-east-1`.
- **Tablas**: `report_templates`, `user_roles`, `process_runs`, `process_run_logs` con RLS habilitado.
- **Storage buckets**: `inputs` (50 MB máx) y `outputs` (100 MB máx) con políticas por usuario.
- **Autenticación**: login/signup con Supabase Auth, sesión gestionada via middleware.
- **Dashboard**: sidebar con roles (el enlace "Administrar plantillas" solo aparece para admins).

### Tests

- **Vitest** configurado con 77 tests unitarios e integración que cubren todos los pasos del pipeline.
- Test de integración `lima-corte-1.test.ts` simula el flujo completo con datos ficticios.
