# pages/1_Reportes_Lima.py
import streamlit as st
import pandas as pd
import io
import zipfile
from datetime import datetime
import re
import unicodedata
import string
from typing import List, Tuple, Optional

# ========= Normalización de TEXTO de cabeceras =========
def _normalizar_header_texto(texto: str) -> str:
    """
    Normaliza textos de cabeceras para comparaciones robustas:
    - NBSP -> espacio normal
    - Normaliza variantes visuales (％ -> %, –/— -> -, ，-> ,)
    - Quita/colapsa espacios extra
    - Pone en MAYÚSCULAS
    - Quita puntuación no esencial (mantiene %)
    """
    s = str(texto)

    # Unificar variantes comunes invisibles/parecidas
    s = s.replace('\u00A0', ' ')  # NBSP
    s = s.replace('％', '%')      # percent full-width -> ASCII
    s = s.replace('–', '-')       # ndash -> -
    s = s.replace('—', '-')       # mdash -> -
    s = s.replace('，', ',')      # coma full-width -> ASCII

    # Trim + UPPER + colapsar espacios
    s = s.strip().upper()
    s = re.sub(r"\s+", " ", s)

    # Quitar puntuación excepto %
    tabla = str.maketrans('', '', string.punctuation.replace('%', ''))
    s = s.translate(tabla)

    # Colapsar de nuevo por si removimos símbolos intermedios
    s = re.sub(r"\s+", " ", s).strip()
    return s

# ========= Utilidades para manejar streams / bytes =========
def _to_bio(archivo_data):
    """Devuelve un BytesIO fresco (evita puntero agotado)."""
    if isinstance(archivo_data, (bytes, bytearray)):
        return io.BytesIO(archivo_data)
    if hasattr(archivo_data, 'getvalue'):
        try:
            return io.BytesIO(archivo_data.getvalue())
        except Exception:
            pass
    try:
        pos = None
        if hasattr(archivo_data, 'tell'):
            try:
                pos = archivo_data.tell()
            except Exception:
                pos = None
        data = archivo_data.read()
        bio = io.BytesIO(data)
        if pos is not None and hasattr(archivo_data, 'seek'):
            try:
                archivo_data.seek(pos)
            except Exception:
                pass
        return bio
    except Exception:
        return io.BytesIO()

# ========= Validación de cabeceras =========
def validar_cabeceras(archivo_excel, nombre_hoja: str, cabeceras_esperadas: List[str]) -> bool:
    """Valida si TODAS las cabeceras_esperadas están en la PRIMERA fila (0) de la hoja."""
    try:
        df_primera_fila = pd.read_excel(
            _to_bio(archivo_excel),
            sheet_name=nombre_hoja,
            header=None,
            nrows=1,
            engine='openpyxl',
            dtype=str
        )
        cabeceras_reales = [_normalizar_header_texto(col) for col in df_primera_fila.iloc[0].values]
        for cabecera in cabeceras_esperadas:
            if _normalizar_header_texto(cabecera) not in cabeceras_reales:
                return False
        return True
    except Exception:
        return False

def detectar_fila_cabeceras(archivo_excel, nombre_hoja: str, cabeceras_esperadas: List[str], max_filas: int = 100, umbral_minimo: int = 1) -> Optional[int]:
    """
    Devuelve el índice (0-based) de la fila que mejor coincide con las cabeceras esperadas.
    Retorna None si no encuentra coincidencia suficiente.
    umbral_minimo: mínimo de coincidencias requeridas (por defecto 1 para ser tolerantes).
    """
    try:
        preview = pd.read_excel(
            _to_bio(archivo_excel),
            sheet_name=nombre_hoja,
            header=None,
            nrows=max_filas,
            engine='openpyxl',
            dtype=str
        )
    except Exception:
        return None

    esperadas_norm = {_normalizar_header_texto(c) for c in cabeceras_esperadas}
    mejor_idx, mejor_match = None, -1

    for i in range(len(preview)):
        fila_vals = [_normalizar_header_texto(v) for v in list(preview.iloc[i].values)]
        presentes = esperadas_norm.intersection(set(fila_vals))
        if len(presentes) > mejor_match:
            mejor_match = len(presentes)
            mejor_idx = i

    if mejor_match >= umbral_minimo:
        return mejor_idx
    return None

# ========= Normalización de nombres de HOJA =========
def _normalizar_nombre_hoja(nombre: str) -> str:
    """
    Normaliza radicalmente nombres de hoja:
    - NBSP -> espacio
    - Quita acentos (NFKD)
    - UPPER
    - Colapsa espacios
    - Elimina puntuación
    """
    if nombre is None:
        return ""
    s = str(nombre).replace('\xa0', ' ')
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = s.strip().upper()
    s = re.sub(r"\s+", " ", s)
    tabla = str.maketrans('', '', string.punctuation)
    s = s.translate(tabla)
    return s

def _sin_espacios(s: str) -> str:
    return s.replace(" ", "")

def encontrar_hoja(archivo_excel, candidatos: List[str]) -> Tuple[Optional[str], List[str]]:
    """
    Busca una hoja del archivo. Primero exacta (con normalización fuerte),
    luego comparación sin espacios, y finalmente 'contiene' (fuzzy).
    Devuelve (nombre_real, lista_de_hojas).
    """
    hojas = []
    # 1) Intentar con openpyxl
    try:
        xf = pd.ExcelFile(_to_bio(archivo_excel), engine='openpyxl')
        hojas = xf.sheet_names
    except Exception:
        # 2) Fallback: dejar que pandas elija motor
        try:
            xf = pd.ExcelFile(_to_bio(archivo_excel))
            hojas = xf.sheet_names
        except Exception:
            return None, []

    norm_map = {h: _normalizar_nombre_hoja(h) for h in hojas}
    cand_norm = [_normalizar_nombre_hoja(c) for c in candidatos]
    cand_norm_no_space = [_sin_espacios(c) for c in cand_norm]

    # 1) Coincidencia exacta normalizada
    for h, hn in norm_map.items():
        if hn in cand_norm:
            return h, hojas

    # 2) Coincidencia exacta “sin espacios”
    for h, hn in norm_map.items():
        if _sin_espacios(hn) in cand_norm_no_space:
            return h, hojas

    # 3) Fuzzy: candidato contenido en el nombre de hoja (con y sin espacios)
    for h, hn in norm_map.items():
        hn_ns = _sin_espacios(hn)
        if any(c in hn for c in cand_norm) or any(c in hn_ns for c in cand_norm_no_space):
            return h, hojas

    return None, hojas

# ========= Proceso principal =========
def procesar_archivos_excel(archivo_excel_cargado):
    log_output = []
    log_output.append("--- INICIO DEL PROCESO DE SEGMENTACIÓN Y VALIDACIÓN ---")

    # Capturar bytes una vez
    try:
        excel_bytes = archivo_excel_cargado.getvalue() if hasattr(archivo_excel_cargado, 'getvalue') else archivo_excel_cargado.read()
    except Exception:
        excel_bytes = None

    # Listar hojas disponibles + normalizadas
    try:
        xf_diag = pd.ExcelFile(_to_bio(excel_bytes if excel_bytes is not None else archivo_excel_cargado), engine='openpyxl')
        hojas_diag = xf_diag.sheet_names
        log_output.append(f"Hojas detectadas en el archivo: {hojas_diag}")
        log_output.append("Hojas (normalizadas): " + str([_normalizar_nombre_hoja(h) for h in hojas_diag]))
    except Exception as e:
        log_output.append(f"No se pudo leer las hojas del archivo (openpyxl). Error: {e}")
        # Fallback
        try:
            xf_diag = pd.ExcelFile(_to_bio(excel_bytes if excel_bytes is not None else archivo_excel_cargado))
            hojas_diag = xf_diag.sheet_names
            log_output.append(f"(Fallback) Hojas detectadas: {hojas_diag}")
            log_output.append("Hojas (normalizadas): " + str([_normalizar_nombre_hoja(h) for h in hojas_diag]))
        except Exception as e2:
            log_output.append(f"No se pudo leer las hojas del archivo (fallback). Error: {e2}")

    # ---- Hoja REPORTE ----
    cabeceras_esenciales_reporte = [
        'RUC', 'AGENCIA', 'META', 'GRUPO', 'ALTAS', 'ARPU SIN IGV',
        'CORTE 1', 'CUMPLIMIENTO ALTAS %', 'MARCHA BLANCA', 'MULTIPLICADOR',
        'BONO 1 ARPU', 'MULTIPLICADOR FINAL', 'TOTAL A PAGAR'
    ]
    candidatos_reporte = [
        'Reporte CORTE 1', 'CORTE 1', 'Reporte Corte1', 'CORTE1',
        'REPORTE CORTE 01', 'CORTE 01', 'REPORTE CORTE'
    ]

    nombre_hoja_reporte, hojas_disponibles = encontrar_hoja(
        excel_bytes if excel_bytes is not None else archivo_excel_cargado,
        candidatos_reporte
    )
    if not nombre_hoja_reporte:
        log_output.append("No se encontró una hoja de reporte que coincida con candidatos: " + str(candidatos_reporte))
        log_output.append(f"Hojas disponibles: {hojas_disponibles}")
        return None, log_output

    log_output.append(f"Hoja de reporte detectada: '{nombre_hoja_reporte}'. Hojas disponibles: {hojas_disponibles}")

    # Validación y autodetección de fila de cabeceras
    header_row_reporte = 0
    if not validar_cabeceras(excel_bytes if excel_bytes is not None else archivo_excel_cargado, nombre_hoja_reporte, cabeceras_esenciales_reporte):
        # Diagnóstico detallado y fallback de autodetección
        try:
            df_primera_fila_diag = pd.read_excel(
                _to_bio(excel_bytes if excel_bytes is not None else archivo_excel_cargado),
                sheet_name=nombre_hoja_reporte,
                header=None,
                nrows=3,
                engine='openpyxl',
                dtype=str
            )
            reales_diag = [_normalizar_header_texto(col) for col in df_primera_fila_diag.iloc[0].values]
        except Exception:
            reales_diag = []

        esperadas_norm = [_normalizar_header_texto(c) for c in cabeceras_esenciales_reporte]
        faltantes = [c for c in esperadas_norm if c not in reales_diag]
        log_output.append(f"ALERTA DE ARCHIVO: Las cabeceras esperadas no se detectaron en la primera fila de '{nombre_hoja_reporte}'.")
        log_output.append(f"Cabeceras detectadas (normalizadas): {reales_diag}")
        log_output.append(f"Cabeceras faltantes (normalizadas): {faltantes}")

        # Preview primeras filas (normalizadas)
        try:
            preview = pd.read_excel(
                _to_bio(excel_bytes),
                sheet_name=nombre_hoja_reporte,
                header=None,
                nrows=3,
                engine='openpyxl',
                dtype=str
            )
            filas_preview = [[_normalizar_header_texto(v) for v in list(preview.iloc[i].values)] for i in range(len(preview))]
            log_output.append(f"Preview primeras filas (normalizadas): {filas_preview}")
        except Exception:
            pass

        # Autodetección flexible (umbral 1)
        idx_auto = detectar_fila_cabeceras(excel_bytes, nombre_hoja_reporte, cabeceras_esenciales_reporte, umbral_minimo=1)
        if idx_auto is None:
            log_output.append(f"No fue posible identificar automáticamente la fila de cabeceras en '{nombre_hoja_reporte}'.")
            log_output.append("Sugerencias: verifique espacios dobles, nombre exacto de la hoja, celdas combinadas o filas de título antes de las cabeceras.")
            return None, log_output
        else:
            # Validar cabeceras en la fila detectada
            try:
                df_hdr = pd.read_excel(
                    _to_bio(excel_bytes),
                    sheet_name=nombre_hoja_reporte,
                    header=None,
                    skiprows=idx_auto,
                    nrows=1,
                    engine='openpyxl',
                    dtype=str
                )
                cabeceras_detectadas = [_normalizar_header_texto(c) for c in df_hdr.iloc[0].tolist()]
                presentes = set(esperadas_norm).intersection(set(cabeceras_detectadas))
                log_output.append(f"Autodetección: se usará la fila {idx_auto + 1} como cabeceras para '{nombre_hoja_reporte}'.")
                log_output.append(f"Cabeceras detectadas en esa fila (normalizadas): {cabeceras_detectadas}")
                log_output.append(f"Coincidencias con esperadas: {sorted(list(presentes))}")
            except Exception:
                pass
            header_row_reporte = idx_auto

    # ---- Hoja BASE ----
    nombre_hoja_base, hojas_disponibles_base = encontrar_hoja(
        excel_bytes if excel_bytes is not None else archivo_excel_cargado,
        ['BASE', 'BASE LIMA', 'BASE_']
    )
    if not nombre_hoja_base:
        log_output.append("No se encontró la hoja 'BASE' en el archivo (probado también 'BASE LIMA', 'BASE_').")
        log_output.append(f"Hojas disponibles: {hojas_disponibles_base}")
        return None, log_output

    log_output.append(f"Hoja BASE detectada: '{nombre_hoja_base}'.")

    # Para BASE exigimos que exista 'ASESOR'; si no, detectamos fila
    cabeceras_esenciales_base = ['ASESOR']
    header_row_base = 0
    if not validar_cabeceras(excel_bytes if excel_bytes is not None else archivo_excel_cargado, nombre_hoja_base, cabeceras_esenciales_base):
        idx_auto_base = detectar_fila_cabeceras(excel_bytes if excel_bytes is not None else archivo_excel_cargado, nombre_hoja_base, cabeceras_esenciales_base, umbral_minimo=1)
        if idx_auto_base is None:
            log_output.append(f"ALERTA DE ARCHIVO: No se encontró la cabecera 'ASESOR' en la primera fila ni fue posible autodetectarla en la hoja '{nombre_hoja_base}'.")
            return None, log_output
        else:
            header_row_base = idx_auto_base
            log_output.append(f"Autodetección: se usará la fila {header_row_base + 1} como cabeceras para '{nombre_hoja_base}'.")

    log_output.append("Validación de cabeceras exitosa (con autodetección si fue necesario).")
    try:
        log_output.append("Leyendo datos completos del archivo...")
        # Leer con header=header_row_* (0-based)
        df_reporte_total = pd.read_excel(
            _to_bio(excel_bytes if excel_bytes is not None else archivo_excel_cargado),
            sheet_name=nombre_hoja_reporte,
            header=header_row_reporte,
            engine='openpyxl'
        )
        df_base_total = pd.read_excel(
            _to_bio(excel_bytes if excel_bytes is not None else archivo_excel_cargado),
            sheet_name=nombre_hoja_base,
            header=header_row_base,
            engine='openpyxl'
        )

        # Estandarizar nombres (como ya hacías)
        df_reporte_total.columns = df_reporte_total.columns.str.strip().str.upper()
        df_base_total.columns = df_base_total.columns.str.strip().str.upper()
        log_output.append("Nombres de columnas estandarizados (sin espacios al borde y en mayúsculas).")
    except Exception as e:
        log_output.append(f"ERROR: No se pudo leer el archivo Excel. Error: {e}")
        return None, log_output

    # ---- Segmentación por AGENCIA ----
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Agencias únicas
        if 'AGENCIA' not in df_reporte_total.columns:
            log_output.append("ERROR: No existe la columna 'AGENCIA' en la hoja de reporte después de estandarizar columnas.")
            return None, log_output

        agencias_a_procesar = df_reporte_total['AGENCIA'].dropna().unique().tolist()
        log_output.append(f"Se encontraron {len(agencias_a_procesar)} agencias únicas para procesar.")

        # Alias de ejemplo
        mapeo_agencias_alias = {"EXPORTEL S.A.C.": ["EXPORTEL S.A.C.", "EXPORTEL PROVINCIA"]}

        # Usar TODAS las columnas de BASE
        columnas_a_mantener_en_base = df_base_total.columns.tolist()
        log_output.append(f"BASE: Se utilizarán todas las {len(columnas_a_mantener_en_base)} columnas disponibles.")

        for agencia in agencias_a_procesar:
            reporte_agencia = df_reporte_total[df_reporte_total['AGENCIA'] == agencia].copy()
            if reporte_agencia.empty:
                continue

            if 'ASESOR' not in df_base_total.columns:
                log_output.append(f"ERROR: La hoja BASE no tiene la columna 'ASESOR'. No se puede filtrar por '{agencia}'.")
                continue

            if agencia in mapeo_agencias_alias:
                nombres_a_buscar = mapeo_agencias_alias[agencia]
                base_agencia = df_base_total[df_base_total['ASESOR'].isin(nombres_a_buscar)]
            else:
                base_agencia = df_base_total[df_base_total['ASESOR'] == agencia]

            base_agencia_final = base_agencia[columnas_a_mantener_en_base]

            try:
                altas_reporte = int(pd.to_numeric(reporte_agencia.iloc[0].get('ALTAS', 0), errors='coerce') or 0)
                registros_base = len(base_agencia_final)
                if altas_reporte == registros_base:
                    log_output.append(f"ÉXITO    | {agencia:<40} | ALTAS: {altas_reporte:<5} | Registros BASE: {registros_base:<5} | OK")
                else:
                    log_output.append(f"DESCUADRE | {agencia:<40} | ALTAS: {altas_reporte:<5} | Registros BASE: {registros_base:<5} | REVISAR")
            except Exception as e:
                log_output.append(f"Error validando la agencia '{agencia}': {e}")

            # Escribir archivo individual
            output_buffer = io.BytesIO()
            with pd.ExcelWriter(output_buffer, engine='xlsxwriter') as writer:  # type: ignore
                reporte_agencia.to_excel(writer, sheet_name='Reporte Agencia', index=False)  # type: ignore
                base_agencia_final.to_excel(writer, sheet_name='BASE', index=False)         # type: ignore

                # Formatos adicionales
                try:
                    workbook = writer.book
                    worksheet = writer.sheets['Reporte Agencia']
                    percent_format = workbook.add_format({'num_format': '0.00%'})
                    number_format = workbook.add_format({'num_format': '#,##0.00'})
                    header = list(reporte_agencia.columns)
                    # Ajuste condicional si existen las columnas
                    if 'CUMPLIMIENTO ALTAS %' in header:
                        idx = header.index('CUMPLIMIENTO ALTAS %')
                        worksheet.set_column(idx, idx, 18, percent_format)
                    if 'TOTAL A PAGAR' in header:
                        idx = header.index('TOTAL A PAGAR')
                        worksheet.set_column(idx, idx, 18, number_format)
                except Exception:
                    pass

            nombre_archivo_limpio = "".join(c for c in str(agencia) if c.isalnum() or c in (' ', '_')).rstrip()
            zf.writestr(f"Reporte {nombre_archivo_limpio}.xlsx", output_buffer.getvalue())

    log_output.append("--- FIN DEL PROCESO ---")
    zip_buffer.seek(0)
    return zip_buffer, log_output


# =================== Interfaz de Usuario Streamlit ===================
st.title("Segmentador de Reportes - Lima")
st.markdown("Sube el archivo consolidado de Lima para generar los reportes individuales por agencia.")

uploaded_file = st.file_uploader("Sube tu archivo Excel de reportes de Lima", type=["xlsx"], key="lima_uploader")

if uploaded_file is not None:
    st.success(f"Archivo '{uploaded_file.name}' cargado exitosamente.")
    if st.button("Procesar y Generar Reportes", type="primary"):
        with st.spinner("Procesando... Esto puede tardar unos minutos para archivos grandes."):
            zip_file, log_data = procesar_archivos_excel(uploaded_file)
        if zip_file:
            st.success("¡Proceso completado!")
            st.subheader("Log de Validación del Proceso")
            st.text_area("Resultado de la validación:", "\n".join(log_data), height=300)
            st.subheader("Descargar Resultados")
            st.download_button(
                label="Descargar todos los reportes (.zip)",
                data=zip_file,
                file_name=f"Reportes_Lima_Segmentados_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
                mime="application/zip"
            )
        else:
            st.error("Ocurrió un error al validar o leer el archivo. Revisa los detalles a continuación.")
            st.subheader("Log de Errores")
            st.text_area("Detalles del error:", "\n".join(log_data), height=300)
