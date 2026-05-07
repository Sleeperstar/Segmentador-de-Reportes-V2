# Manual de usuario — Segmentador de Reportes

## ¿Qué hace esta aplicación?

El Segmentador de Reportes es una aplicación web que toma archivos Excel de comisiones (reportes mensuales de cortes), los divide por agencia y genera un archivo ZIP con un Excel por cada agencia. Esto reemplaza el proceso manual de copiar y filtrar hojas en Excel.

---

## Acceso al sistema

1. Abre la URL de la aplicación en tu navegador (ej: `https://segmentador.vercel.app`).
2. Ingresa con tu correo y contraseña en la pantalla de inicio de sesión.
3. Si no tienes cuenta, contacta al administrador del sistema para que te registre.

> **Nota**: Solo el personal autorizado tiene acceso. Las cuentas son administradas por el equipo de TI/WIN Empresas.

---

## Pantalla principal — Plantillas de reporte

Al iniciar sesión verás una cuadrícula con las plantillas de reporte disponibles. Cada tarjeta muestra:

- **Nombre** del reporte (ej: "Lima Corte 1 (multi-hoja)")
- **Versión** actual de la plantilla
- Botón **Ejecutar**

Para procesar un reporte, haz clic en el botón **Ejecutar** de la plantilla que corresponde al archivo que quieres procesar.

---

## Procesar un reporte (paso a paso)

### Paso 1 — Seleccionar el archivo

En la pantalla de ejecución de la plantilla:

1. Arrastra el archivo Excel directamente a la zona azul, o haz clic en ella para abrir el explorador de archivos.
2. El archivo debe ser `.xlsx` y el nombre debe seguir el formato esperado por la plantilla. Por ejemplo, para Lima Corte 1:

   ```
   Reportes AGENCIA LIMA Corte 1 MARZO 2026.xlsx
   ```

   > El nombre del archivo importa porque el sistema extrae el período (`PERIODO_COMI`) del nombre automáticamente.

3. Verifica que aparezca el nombre y el tamaño del archivo en la zona de subida.

### Paso 2 — Iniciar el procesamiento

Haz clic en el botón **Procesar reporte**. El sistema mostrará dos barras de progreso:

- **Subiendo...**: el archivo se carga a la nube (Supabase Storage).
- **Procesando...**: el servidor segmenta el Excel por agencia y genera el ZIP.

Este proceso puede tomar entre 10 y 60 segundos dependiendo del tamaño del archivo.

### Paso 3 — Descargar el resultado

Cuando termine, aparecerá el panel de resultados con:

- **Validaciones por agencia**: una fila por agencia indicando si el conteo de altas cuadra (✓ verde) o si hay una diferencia (⚠ amarillo).
- **Logs del proceso**: registro detallado con información de cada paso (hojas cargadas, filtros aplicados, grupos generados).
- **Botón de descarga**: descarga el archivo ZIP con todos los reportes segmentados.

> Si alguna agencia muestra advertencia (⚠) en validación, revisa manualmente ese archivo dentro del ZIP antes de enviarlo.

### Paso 4 — Revisar el ZIP

El ZIP descargado contiene un archivo Excel por cada agencia, por ejemplo:

```
Reportes AGENCIA LIMA Corte 1 202603.zip
  ├── Reporte ALIV TELECOM S.A.C. Corte 1 202603.xlsx
  ├── Reporte AZOTEC REPRESENTACIONES E.I.R. Corte 1 202603.xlsx
  ├── Reporte BELFECOM E.I.R.L. Corte 1 202603.xlsx
  └── ...
```

Cada Excel contiene las hojas correspondientes a esa agencia (Horizontal, Vertical, Marcha Blanca y BASE, según lo que le aplique). Si una agencia no tuvo actividad en una hoja de reporte (ej: sin Marcha Blanca), esa hoja **no aparecerá** en su archivo.

---

## Historial de procesamientos

En el menú lateral, haz clic en **Últimos procesos** para ver el historial de los archivos procesados recientemente.

Desde ahí puedes:
- Ver el estado de cada procesamiento (éxito, parcial, error).
- Re-descargar el ZIP si lo necesitas (disponible por **7 días** desde la fecha de procesamiento).

> Después de 7 días, el archivo se elimina automáticamente del servidor. Guarda el ZIP en tu computadora si lo necesitas a largo plazo.

---

## Errores comunes y soluciones

| Error | Causa probable | Solución |
|---|---|---|
| "Plantilla no encontrada o inactiva" | La plantilla fue desactivada | Contacta al administrador |
| "El nombre del archivo no coincide" | El nombre del Excel no sigue el formato esperado | Renombra el archivo según el ejemplo de la plantilla |
| "El dataset X no tiene la columna Y" | El Excel tiene un formato diferente al esperado | Verifica que las hojas tengan los nombres correctos y las columnas requeridas |
| "Demasiadas solicitudes" (error 429) | Se superó el límite de 10 procesamientos por hora | Espera unos minutos y vuelve a intentar |
| El proceso demora más de 60 segundos | Archivo muy grande o servidor ocupado | Vuelve a intentar; si persiste, contacta a TI |
| El ZIP está vacío | Ninguna agencia pasó los filtros | Verifica que el nombre del archivo tenga el mes/año correcto y que el Excel tenga datos para ese período |

---

## Convenciones importantes del archivo Excel

Para que el sistema procese correctamente el reporte, el archivo Excel debe cumplir:

### Nombre del archivo
- Debe seguir exactamente el formato definido en la plantilla.
- Ejemplo: `Reportes AGENCIA LIMA Corte 1 MARZO 2026.xlsx`
- El mes debe estar en español y en mayúsculas: `ENERO`, `FEBRERO`, `MARZO`, `ABRIL`, `MAYO`, `JUNIO`, `JULIO`, `AGOSTO`, `SEPTIEMBRE`, `OCTUBRE`, `NOVIEMBRE`, `DICIEMBRE`.

### Hojas del Excel (para Lima Corte 1)
El archivo debe tener estas hojas con exactamente estos nombres:

| Hoja | Descripción |
|---|---|
| `Reporte CORTE 1 Horizontal` | Reporte de ventas horizontal |
| `Reporte CORTE 1 Vertical` | Reporte de ventas vertical |
| `Reporte CORTE 1 Marcha Blanca` | Reporte marcha blanca (solo agencias que aplican) |
| `BASE` | Base detallada con todas las filas del período |

> Si falta alguna hoja, el sistema reportará un error. Si hay hojas adicionales, simplemente se ignoran.

### Columnas requeridas (hoja BASE)
La hoja `BASE` debe tener al menos estas columnas:

| Columna | Descripción |
|---|---|
| `ASESOR` | Nombre de la agencia (columna que se usa para segmentar) |
| `COD_PEDIDO` | Código del pedido (se cuenta para validar altas) |
| `CANAL` | Canal de venta (se filtra por `"Agencias"`) |
| `TIPO_ESTADO` | Estado del pedido (se filtra por `"Validado"` y `"Rescate"`) |
| `PERIODO_COMI` | Período de comisión en formato `YYYYMM` (ej: `202603`) |

### Columnas requeridas (hojas de reporte)
Las hojas Horizontal, Vertical y Marcha Blanca deben tener:

| Columna | Descripción |
|---|---|
| `AGENCIA` | Nombre de la agencia |
| `ALTAS` | Cantidad de altas (se suma para validar) |

---

## Para administradores del sistema

### Acceder al panel de administración

Si tu cuenta tiene rol de **administrador**, verás en el menú lateral la opción **Administrar plantillas**.

Desde ahí puedes:
- Ver todas las plantillas (activas e inactivas).
- Crear nuevas plantillas con el wizard.
- Editar plantillas existentes (cada guardado crea una nueva versión).
- Duplicar una plantilla para crear variantes sin afectar la original.
- Activar o desactivar plantillas (las inactivas no aparecen para usuarios regulares).
- Eliminar plantillas (acción irreversible, con confirmación).

### Crear o editar una plantilla — Wizard de 6 pasos

El editor tiene 7 pestañas:

#### 1. Datos básicos
- **Nombre**: nombre visible para los usuarios.
- **Descripción**: descripción opcional del reporte.
- **Activa**: si está marcada, los usuarios pueden verla y ejecutarla.

#### 2. Inputs
- **Expresión regular del nombre de archivo**: define el patrón que debe tener el nombre del archivo subido. Usa grupos nombrados para capturar variables.

  Ejemplo: `Reportes AGENCIA LIMA Corte (?<corte>\d+) (?<mes>\w+) (?<anio>\d{4})`

  Los símbolos `\d+`, `\w+`, `\d{4}` son sintaxis de regex estándar:
  - `\d` = dígito (0-9)
  - `\w` = letra o dígito
  - `+` = uno o más
  - `{4}` = exactamente 4 veces

- **Variables derivadas**: transforma lo capturado en la regex para generar variables adicionales. Ejemplo: la transformación `monthYearToYYYYMM` convierte `mes=MARZO` + `anio=2026` en `PERIODO_COMI=202603`.

#### 3. Hojas
Define qué hojas del Excel se cargan como datasets. Para cada hoja:
- **ID del dataset**: nombre interno para referenciar en otros pasos.
- **Nombre de la hoja**: nombre exacto tal como aparece en el Excel.
- **Detección de cabecera**:
  - `auto`: busca la fila que contenga las columnas esperadas (recomendado).
  - `fixed_row`: la cabecera siempre está en una fila específica.
  - `multi_level`: cabecera en múltiples filas (reportes complejos).

#### 4. Transformaciones
Pasos opcionales que se aplican sobre los datasets:
- **filter_rows**: filtra filas por condición. Ejemplo: `CANAL = "Agencias"`.
- **derive_column**: crea una columna calculada a partir de otras.

#### 5. Segmentar + Validar
- **Segmentación**: define qué datasets se dividen por agencia y qué columna usarla.
  - **Datasets de reporte**: los datasets de las hojas de reporte (ej: `horizontal, vertical, marcha_blanca`).
  - **Dataset base**: el dataset BASE que también se segmenta por agencia (columna puede ser distinta, ej: `ASESOR`).
  - **Alias**: si una agencia tiene nombres distintos en reportes vs. base, agrégala aquí. Ejemplo: `EXPORTEL S.A.C.` y `EXPORTEL PROVINCIA` se agrupan como `EXPORTEL S.A.C.`
  - **Unificar agencias por RUC (opcional)**: úsalo cuando la columna de agencia del reporte trae valores compuestos que deben ir en un único archivo por agencia real. Ejemplo: en "Provincias Norte Corte 1" la columna `AGENCIA` del reporte trae `ALIV TELECOM S.A.C. Áncash`, `ALIV TELECOM S.A.C. La Libertad`, `ALIV TELECOM S.A.C. Lambayeque` y `ALIV TELECOM S.A.C. Piura`, pero todas comparten el mismo RUC y el negocio quiere un solo `Reporte ALIV TELECOM S.A.C. Corte 1 202603.xlsx`.
    - **Columna RUC en reportes**: nombre de la columna en las hojas de reporte que contiene el RUC (ej: `RUC`).
    - **Columna RUC en base**: nombre de la columna en la hoja BASE que contiene el RUC (ej: `DNI_ASESOR`).
    - **Columna nombre canónico en base**: nombre de la columna en BASE que contiene el nombre limpio de la agencia, sin departamento (ej: `ASESOR`).
    - Si los 3 campos están vacíos, la plantilla **no unifica** (comportamiento estándar).
    - La validación sigue mostrando una fila por sub-agencia para que sigas detectando descuadres por departamento, aunque el ZIP entregue un único archivo por agencia canónica.
- **Validaciones**: reglas que verifican que los totales cuadren entre datasets.
  - `per_agency`: compara el total por agencia (recomendado).
  - `global`: compara el total global (usar con cuidado).
  - Cada regla tiene dos lados: **Hoja Reporte** (típicamente `sum(ALTAS)` de una hoja de reporte) y **Hoja Base** (típicamente `count(COD_PEDIDO)` de la hoja BASE).
  - `onMismatch: warn` muestra advertencia sin detener; `error` detiene el proceso.

#### 6. Salida
Configura el archivo ZIP generado:
- **Plantilla del nombre del ZIP**: ej: `Reportes AGENCIA LIMA Corte 1 {PERIODO_COMI}.zip`
- **Plantilla de nombre por agencia**: ej: `Reporte {AGENCIA} Corte 1 {PERIODO_COMI}.xlsx`
- **Hojas del archivo por agencia**: qué datasets incluir en cada Excel de agencia. La opción "Filtrar a agencia" (activa por defecto) incluye solo los datos de esa agencia; desactivarla pondría todos los datos.
- **Formatos de columnas**: aplica formato numérico a columnas específicas (`integer`, `currency`, `percent`, `number`).
- **Resaltado de cabeceras**: pinta celdas de cabecera con un color específico cuando el nombre de la columna contiene determinados términos.
  - **Defaults globales** (siempre activos): columnas que contengan **"Penalidad"** se pintan de azul claro `#0070C0`, y las que contengan **"Clawback"** de azul oscuro `#002060`. Ambas con letra blanca. No requieren configuración.
  - **Reglas custom**: para añadir más términos (ej: "Multa", "Bono") o sobrescribir los defaults con otros colores, agrega reglas con el botón "+ Regla". Cada una define:
    - **Términos** (separados por coma): el match es **case-insensitive**, **sin tildes** y por **substring** (la columna `PENALIZACIÓN MENSUAL` matchea con el término `penalizacion`).
    - **Color de relleno** y **color de fuente** en hex `#RRGGBB`.
  - **Prioridad**: las reglas custom se evalúan antes que los defaults; la primera que matchea gana. Si ninguna matchea, la cabecera usa el naranja institucional `#FF6B00`.

#### 7. JSON (avanzado)
Edita el pipeline directamente en formato JSON. Útil para configuraciones que el wizard no cubre. El sistema valida el JSON antes de aplicar.

### Límites del sistema

| Límite | Valor |
|---|---|
| Tamaño máximo del archivo Excel | 50 MB |
| Tiempo máximo de procesamiento | 60 segundos |
| Procesamientos por hora (por usuario) | 10 |
| Generaciones de URL de subida por hora | 30 |
| Tiempo de retención de archivos en servidor | 7 días |
| Historial de procesamientos | 30 días |

---

## Glosario

| Término | Significado |
|---|---|
| **Plantilla** | Configuración que define cómo procesar un tipo de reporte. |
| **Pipeline** | Secuencia de pasos declarativos que el sistema sigue para procesar el archivo. |
| **Dataset** | Tabla en memoria que resulta de cargar una hoja o aplicar un filtro. |
| **Corte** | Período de comisiones (hay 4 cortes por año). |
| **PERIODO_COMI** | Período en formato `YYYYMM` (ej: `202603` para marzo 2026). |
| **Marcha Blanca** | Tipo de reporte especial, aplica solo a algunas agencias. |
| **ZIP** | Archivo comprimido que contiene los Excels segmentados por agencia. |
| **Agencia** | Empresa distribuidora (ej: ALIV TELECOM S.A.C., DATANTENNA S.A.C.). |
| **Alias** | Configuración que agrupa variantes del nombre de una misma agencia. |
| **RLS** | Row Level Security — política de base de datos que garantiza que cada usuario solo accede a sus propios datos. |
