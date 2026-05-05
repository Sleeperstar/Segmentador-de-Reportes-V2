# Historial de cambios — Segmentador de Reportes Web

Este documento registra los cambios más importantes realizados en el proyecto desde su inicio.

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
