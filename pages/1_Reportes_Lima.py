# pages/1_Reportes_Lima.py
import streamlit as st
import pandas as pd
import io
import zipfile
from datetime import datetime
import re

# --- Las funciones de lógica no cambian ---
def _normalizar_header_texto(texto):
    # Reemplaza NBSP por espacio normal, elimina espacios al borde, pasa a mayúsculas y colapsa espacios múltiples
    s = str(texto).replace('\xa0', ' ')
    s = s.strip().upper()
    s = re.sub(r"\s+", " ", s)
    return s

def validar_cabeceras(archivo_excel, nombre_hoja, cabeceras_esperadas):
    try:
        df_primera_fila = pd.read_excel(archivo_excel, sheet_name=nombre_hoja, header=None, nrows=1)
        cabeceras_reales = [_normalizar_header_texto(col) for col in df_primera_fila.iloc[0].values]
        for cabecera in cabeceras_esperadas:
            if _normalizar_header_texto(cabecera) not in cabeceras_reales: return False
        return True
    except Exception: return False

def detectar_fila_cabeceras(archivo_excel, nombre_hoja, cabeceras_esperadas, max_filas=20):
    """Devuelve el índice (0-based) de la fila que mejor coincide con las cabeceras esperadas.
    Retorna None si no encuentra una coincidencia suficiente."""
    try:
        preview = pd.read_excel(archivo_excel, sheet_name=nombre_hoja, header=None, nrows=max_filas)
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
    # Umbral: al menos 3 cabeceras esperadas presentes
    if mejor_match >= 3:
        return mejor_idx
    return None

def procesar_archivos_excel(archivo_excel_cargado):
    log_output = []
    log_output.append("--- INICIO DEL PROCESO DE SEGMENTACIÓN Y VALIDACIÓN ---")
    cabeceras_esenciales_reporte = [
        'RUC', 'AGENCIA', 'META', 'GRUPO', 'ALTAS', 'ARPU SIN IGV',
        'CORTE 1', 'CUMPLIMIENTO ALTAS %', 'MARCHA BLANCA', 'MULTIPLICADOR',
        'BONO 1 ARPU', 'MULTIPLICADOR FINAL', 'TOTAL A PAGAR'
    ]
    # Validación y posible detección automática de fila de cabeceras para 'Reporte CORTE 1'
    header_row_reporte = 0
    if not validar_cabeceras(archivo_excel_cargado, 'Reporte CORTE 1', cabeceras_esenciales_reporte):
        # Diagnóstico detallado y fallback de autodetección
        try:
            df_primera_fila_diag = pd.read_excel(archivo_excel_cargado, sheet_name='Reporte CORTE 1', header=None, nrows=1)
            reales_diag = [_normalizar_header_texto(col) for col in df_primera_fila_diag.iloc[0].values]
        except Exception:
            reales_diag = []
        esperadas_norm = [_normalizar_header_texto(c) for c in cabeceras_esenciales_reporte]
        faltantes = [c for c in esperadas_norm if c not in reales_diag]
        log_output.append("ALERTA DE ARCHIVO: Las cabeceras esperadas no se detectaron en la primera fila de 'Reporte CORTE 1'.")
        log_output.append(f"Cabeceras detectadas (normalizadas): {reales_diag}")
        log_output.append(f"Cabeceras faltantes (normalizadas): {faltantes}")
        idx_auto = detectar_fila_cabeceras(archivo_excel_cargado, 'Reporte CORTE 1', cabeceras_esenciales_reporte)
        if idx_auto is None:
            log_output.append("No fue posible identificar automáticamente la fila de cabeceras en 'Reporte CORTE 1'.")
            log_output.append("Sugerencias: verifique espacios dobles, nombre exacto de la hoja, celdas combinadas o filas de título antes de las cabeceras.")
            return None, log_output
        else:
            header_row_reporte = idx_auto
            log_output.append(f"Autodetección: se usará la fila {header_row_reporte + 1} como cabeceras para 'Reporte CORTE 1'.")
    # Para BASE solo exigimos 'ASESOR'. Si no está en la primera fila, intentamos autodetectar la fila de cabeceras.
    cabeceras_esenciales_base = ['ASESOR']
    header_row_base = 0
    if not validar_cabeceras(archivo_excel_cargado, 'BASE', cabeceras_esenciales_base):
        idx_auto_base = detectar_fila_cabeceras(archivo_excel_cargado, 'BASE', cabeceras_esenciales_base)
        if idx_auto_base is None:
            log_output.append("ALERTA DE ARCHIVO: No se encontró la cabecera 'ASESOR' en la primera fila ni fue posible autodetectarla en la hoja 'BASE'.")
            return None, log_output
        else:
            header_row_base = idx_auto_base
            log_output.append(f"Autodetección: se usará la fila {header_row_base + 1} como cabeceras para 'BASE'.")
    log_output.append("Validación de cabeceras exitosa. Los encabezados se encontraron en la primera fila.")
    try:
        log_output.append("Leyendo datos completos del archivo...")
        df_reporte_total = pd.read_excel(archivo_excel_cargado, sheet_name='Reporte CORTE 1', header=header_row_reporte)
        df_base_total = pd.read_excel(archivo_excel_cargado, sheet_name='BASE', header=header_row_base)
        df_reporte_total.columns = df_reporte_total.columns.str.strip().str.upper()
        df_base_total.columns = df_base_total.columns.str.strip().str.upper()
        log_output.append("Nombres de columnas estandarizados (sin espacios y en mayúsculas).")
    except Exception as e:
        log_output.append(f"ERROR: No se pudo leer el archivo Excel. Error: {e}")
        return None, log_output
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        agencias_a_procesar = df_reporte_total['AGENCIA'].dropna().unique().tolist()
        log_output.append(f"Se encontraron {len(agencias_a_procesar)} agencias únicas para procesar.")
        mapeo_agencias_alias = {"EXPORTEL S.A.C.": ["EXPORTEL S.A.C.", "EXPORTEL PROVINCIA"]}
        # Usar TODAS las columnas de BASE sin recortar hasta 'RECIBO1_PAGADO'
        columnas_a_mantener_en_base = df_base_total.columns.tolist()
        log_output.append(f"BASE: Se utilizarán todas las {len(columnas_a_mantener_en_base)} columnas disponibles.")
        for agencia in agencias_a_procesar:
            reporte_agencia = df_reporte_total[df_reporte_total['AGENCIA'] == agencia].copy()
            if reporte_agencia.empty: continue
            if agencia in mapeo_agencias_alias:
                nombres_a_buscar = mapeo_agencias_alias[agencia]
                base_agencia = df_base_total[df_base_total['ASESOR'].isin(nombres_a_buscar)]
            else:
                base_agencia = df_base_total[df_base_total['ASESOR'] == agencia]
            base_agencia_final = base_agencia[columnas_a_mantener_en_base]
            try:
                altas_reporte = int(reporte_agencia.iloc[0]['ALTAS'])
                registros_base = len(base_agencia_final)
                if altas_reporte == registros_base: log_output.append(f"ÉXITO    | {agencia:<40} | ALTAS: {altas_reporte:<5} | Registros BASE: {registros_base:<5} | OK")
                else: log_output.append(f"DESCUADRE | {agencia:<40} | ALTAS: {altas_reporte:<5} | Registros BASE: {registros_base:<5} | REVISAR")
            except Exception as e: log_output.append(f"Error validando la agencia '{agencia}': {e}")
            output_buffer = io.BytesIO()
            with pd.ExcelWriter(output_buffer, engine='xlsxwriter') as writer: # type: ignore
                reporte_agencia.to_excel(writer, sheet_name='Reporte Agencia', index=False) # type: ignore
                base_agencia_final.to_excel(writer, sheet_name='BASE', index=False) # type: ignore
                workbook, worksheet = writer.book, writer.sheets['Reporte Agencia']
                percent_format, number_format = workbook.add_format({'num_format': '0.00%'}), workbook.add_format({'num_format': '#,##0.00'})
                header = list(reporte_agencia.columns)
                try:
                    worksheet.set_column(header.index('CUMPLIMIENTO ALTAS %'), header.index('CUMPLIMIENTO ALTAS %'), 18, percent_format)
                    worksheet.set_column(header.index('TOTAL A PAGAR'), header.index('TOTAL A PAGAR'), 18, number_format)
                except ValueError: pass
            nombre_archivo_limpio = "".join(c for c in agencia if c.isalnum() or c in (' ', '_')).rstrip()
            zf.writestr(f"Reporte {nombre_archivo_limpio}.xlsx", output_buffer.getvalue())
    log_output.append("--- FIN DEL PROCESO ---")
    zip_buffer.seek(0)
    return zip_buffer, log_output


# --- Interfaz de Usuario para la página de Reportes Lima ---
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
            st.download_button(label="Descargar todos los reportes (.zip)", data=zip_file,
                              file_name=f"Reportes_Lima_Segmentados_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
                              mime="application/zip")
        else:
            st.error("Ocurrió un error al validar el archivo. Por favor, revisa los detalles a continuación.")
            st.subheader("Log de Errores")
            st.text_area("Detalles del error:", "\n".join(log_data), height=300)