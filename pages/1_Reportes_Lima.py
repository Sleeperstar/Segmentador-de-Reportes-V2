# pages/1_Reportes_Lima.py
import streamlit as st
import pandas as pd
import io
import zipfile
from datetime import datetime

# ================= Utilidad para manejar el archivo =================
def _to_bio(archivo_data):
    """Devuelve un BytesIO fresco (evita puntero agotado)."""
    if isinstance(archivo_data, (bytes, bytearray)):
        return io.BytesIO(archivo_data)
    if hasattr(archivo_data, 'getvalue'):
        # UploadedFile de Streamlit
        try:
            return io.BytesIO(archivo_data.getvalue())
        except Exception:
            pass
    # Último recurso: leer todo y crear BytesIO
    try:
        data = archivo_data.read()
        return io.BytesIO(data)
    except Exception:
        return io.BytesIO()

def detectar_fila_cabecera(archivo_data, nombre_hoja):
    """
    Detecta si las cabeceras están en la fila 0 o fila 1.
    Retorna el número de fila (0 o 1) donde están las cabeceras.
    """
    cabeceras_esperadas = ['RUC', 'AGENCIA', 'META', 'GRUPO', 'ALTAS', 'ARPU SIN IGV', 'CORTE 1']
    
    # Intentar fila 0
    try:
        df_test = pd.read_excel(_to_bio(archivo_data), sheet_name=nombre_hoja, header=0, nrows=0)
        cols_fila_0 = [str(col).strip().upper() for col in df_test.columns]
        if all(cab in cols_fila_0 for cab in cabeceras_esperadas[:3]):  # Verificar al menos las primeras 3
            return 0
    except Exception:
        pass
    
    # Intentar fila 1
    try:
        df_test = pd.read_excel(_to_bio(archivo_data), sheet_name=nombre_hoja, header=1, nrows=0)
        cols_fila_1 = [str(col).strip().upper() for col in df_test.columns]
        if all(cab in cols_fila_1 for cab in cabeceras_esperadas[:3]):
            return 1
    except Exception:
        pass
    
    # Por defecto, asumir fila 0
    return 0

# ================= Proceso principal =================
def procesar_archivos_excel(archivo_excel_cargado):
    log_output = []
    log_output.append("--- INICIO DEL PROCESO DE REPORTES LIMA ---")

    # Capturar bytes una sola vez
    try:
        excel_bytes = archivo_excel_cargado.getvalue() if hasattr(archivo_excel_cargado, 'getvalue') else archivo_excel_cargado.read()
    except Exception:
        excel_bytes = None

    # Detectar en qué fila están las cabeceras
    fila_cabecera = detectar_fila_cabecera(excel_bytes if excel_bytes is not None else archivo_excel_cargado, 'Reporte CORTE 1')
    log_output.append(f"Cabeceras detectadas en la fila {fila_cabecera + 1} de la hoja 'Reporte CORTE 1'")

    # Leer hojas con el header correcto
    try:
        df_reporte_total = pd.read_excel(
            _to_bio(excel_bytes if excel_bytes is not None else archivo_excel_cargado),
            sheet_name='Reporte CORTE 1',
            header=fila_cabecera,
            engine='openpyxl'
        )
        df_base_total = pd.read_excel(
            _to_bio(excel_bytes if excel_bytes is not None else archivo_excel_cargado),
            sheet_name='BASE',
            engine='openpyxl'
        )

        # Estandarizar nombres de columnas
        df_reporte_total.columns = df_reporte_total.columns.str.strip().str.upper()
        df_base_total.columns = df_base_total.columns.str.strip().str.upper()
        log_output.append("Columnas estandarizadas a mayúsculas sin espacios al borde.")
        
        # Validar que las cabeceras esperadas existan
        cabeceras_reporte_esperadas = ['RUC', 'AGENCIA', 'META', 'GRUPO', 'ALTAS', 'ARPU SIN IGV', 
                                       'CORTE 1', 'CUMPLIMIENTO ALTAS %', 'MARCHA BLANCA', 
                                       'MULTIPLICADOR', 'BONO 1 ARPU', 'MULTIPLICADOR FINAL', 'TOTAL A PAGAR']
        cabeceras_faltantes = [cab for cab in cabeceras_reporte_esperadas if cab not in df_reporte_total.columns]
        if cabeceras_faltantes:
            log_output.append(f"ADVERTENCIA: Faltan las siguientes cabeceras: {', '.join(cabeceras_faltantes)}")
            log_output.append(f"Cabeceras encontradas: {', '.join(df_reporte_total.columns.tolist())}")
    except Exception as e:
        log_output.append(f"ERROR al leer hojas 'Reporte CORTE 1' y/o 'BASE': {e}")
        return None, log_output

    # Zip con archivos por agencia
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Obtener agencias desde la hoja de reporte
        if 'AGENCIA' not in df_reporte_total.columns:
            log_output.append("ERROR: La hoja 'Reporte CORTE 1' no tiene columna 'AGENCIA'.")
            return None, log_output

        agencias = df_reporte_total['AGENCIA'].dropna().unique().tolist()
        log_output.append(f"Agencias encontradas: {len(agencias)}")

        # Alias opcional (si lo usas)
        mapeo_agencias_alias = {
            "EXPORTEL S.A.C.": ["EXPORTEL S.A.C.", "EXPORTEL PROVINCIA"]
        }

        # Mantener todas las columnas de BASE
        columnas_base = df_base_total.columns.tolist()
        if 'ASESOR' not in df_base_total.columns:
            log_output.append("ADVERTENCIA: La hoja 'BASE' no tiene columna 'ASESOR'. No se filtrará por agencia en BASE.")

        for agencia in agencias:
            reporte_agencia = df_reporte_total[df_reporte_total['AGENCIA'] == agencia].copy()
            if reporte_agencia.empty:
                continue

            # Filtrar BASE por ASESOR (si existe)
            if 'ASESOR' in df_base_total.columns:
                if agencia in mapeo_agencias_alias:
                    nombres = mapeo_agencias_alias[agencia]
                    base_agencia = df_base_total[df_base_total['ASESOR'].isin(nombres)]
                else:
                    base_agencia = df_base_total[df_base_total['ASESOR'] == agencia]
            else:
                base_agencia = df_base_total

            base_agencia_final = base_agencia[columnas_base]

            # (Opcional) Log simple de conteos
            try:
                altas_reporte = int(pd.to_numeric(reporte_agencia.iloc[0].get('ALTAS', 0), errors='coerce') or 0)
                registros_base = len(base_agencia_final)
                status = "OK" if altas_reporte == registros_base else "REVISAR"
                log_output.append(f"{agencia} | ALTAS: {altas_reporte} | BASE: {registros_base} | {status}")
            except Exception:
                pass

            # Crear Excel por agencia
            output_buffer = io.BytesIO()
            with pd.ExcelWriter(output_buffer, engine='xlsxwriter') as writer:  # type: ignore
                reporte_agencia.to_excel(writer, sheet_name='Reporte Agencia', index=False)  # type: ignore
                base_agencia_final.to_excel(writer, sheet_name='BASE', index=False)         # type: ignore

                # Formatos bonitos si existen las columnas
                try:
                    workbook = writer.book
                    ws = writer.sheets['Reporte Agencia']
                    
                    # Definir formatos
                    percent_fmt = workbook.add_format({'num_format': '0.00%'})
                    number_fmt = workbook.add_format({'num_format': '#,##0.00'})
                    currency_fmt = workbook.add_format({'num_format': 'S/ #,##0.00'})
                    
                    headers = list(reporte_agencia.columns)
                    
                    # Aplicar formato de porcentaje
                    if 'CUMPLIMIENTO ALTAS %' in headers:
                        idx = headers.index('CUMPLIMIENTO ALTAS %')
                        ws.set_column(idx, idx, 20, percent_fmt)
                    
                    # Aplicar formato de moneda/número a las columnas monetarias
                    columnas_monetarias = ['ARPU SIN IGV', 'CORTE 1', 'BONO 1 ARPU', 'TOTAL A PAGAR']
                    for col_name in columnas_monetarias:
                        if col_name in headers:
                            idx = headers.index(col_name)
                            ws.set_column(idx, idx, 18, currency_fmt)
                    
                    # Aplicar formato numérico a multiplicadores
                    columnas_numericas = ['MULTIPLICADOR', 'MULTIPLICADOR FINAL']
                    for col_name in columnas_numericas:
                        if col_name in headers:
                            idx = headers.index(col_name)
                            ws.set_column(idx, idx, 18, number_fmt)
                except Exception:
                    pass

            # Nombre limpio de archivo
            nombre_archivo = "".join(c for c in str(agencia) if c.isalnum() or c in (' ', '_')).rstrip()
            zf.writestr(f"Reporte {nombre_archivo}.xlsx", output_buffer.getvalue())

    log_output.append("--- FIN DEL PROCESO ---")
    zip_buffer.seek(0)
    return zip_buffer, log_output

# =================== Interfaz Streamlit ===================
st.title("Segmentador de Reportes - Lima")
st.markdown("Sube el archivo consolidado de Lima para generar los reportes individuales por agencia.")
st.info("💡 El sistema detecta automáticamente si las cabeceras están en la fila 1 o fila 2.")

uploaded_file = st.file_uploader("Sube tu archivo Excel de reportes de Lima", type=["xlsx"], key="lima_uploader")

if uploaded_file is not None:
    st.success(f"Archivo '{uploaded_file.name}' cargado exitosamente.")
    if st.button("Procesar y Generar Reportes", type="primary"):
        with st.spinner("Procesando..."):
            zip_file, log_data = procesar_archivos_excel(uploaded_file)
        if zip_file:
            st.success("¡Proceso completado!")
            st.subheader("Log")
            st.text_area("Detalle:", "\n".join(log_data), height=300)
            st.subheader("Descargar Resultados")
            st.download_button(
                label="Descargar todos los reportes (.zip)",
                data=zip_file,
                file_name=f"Reportes_Lima_Segmentados_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
                mime="application/zip"
            )
        else:
            st.error("Ocurrió un error al leer o procesar el archivo.")
            st.subheader("Log")
            st.text_area("Detalle del error:", "\n".join(log_data), height=300)
