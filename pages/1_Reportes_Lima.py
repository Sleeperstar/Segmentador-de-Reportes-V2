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

def normalizar_nombre_agencia(nombre):
    """
    Normaliza el nombre de una agencia para comparaciones consistentes.
    Convierte a mayúsculas y elimina espacios extras.
    """
    if pd.isna(nombre) or not isinstance(nombre, str):
        return ""
    return nombre.strip().upper()

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
    log_output.append(f"✓ Cabeceras detectadas en la fila {fila_cabecera + 1} de la hoja 'Reporte CORTE 1'")

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
        log_output.append("✓ Columnas estandarizadas a mayúsculas")
        
        # Normalizar nombres de agencias para evitar problemas de mayúsculas/minúsculas
        if 'AGENCIA' in df_reporte_total.columns:
            df_reporte_total['AGENCIA_NORMALIZADA'] = df_reporte_total['AGENCIA'].apply(normalizar_nombre_agencia)
            df_reporte_total['AGENCIA_ORIGINAL'] = df_reporte_total['AGENCIA']  # Guardar original para el nombre del archivo
        
        if 'ASESOR' in df_base_total.columns:
            df_base_total['ASESOR_NORMALIZADO'] = df_base_total['ASESOR'].apply(normalizar_nombre_agencia)
        
        # Validar que las cabeceras esperadas existan
        cabeceras_reporte_esperadas = ['RUC', 'AGENCIA', 'META', 'GRUPO', 'ALTAS', 'ARPU SIN IGV', 
                                       'CORTE 1', 'CUMPLIMIENTO ALTAS %', 'MARCHA BLANCA', 
                                       'MULTIPLICADOR', 'BONO 1 ARPU', 'MULTIPLICADOR FINAL', 'TOTAL A PAGAR']
        cabeceras_faltantes = [cab for cab in cabeceras_reporte_esperadas if cab not in df_reporte_total.columns]
        if cabeceras_faltantes:
            log_output.append(f"⚠ ADVERTENCIA: Faltan cabeceras: {', '.join(cabeceras_faltantes)}")
            log_output.append(f"  Cabeceras encontradas: {', '.join(df_reporte_total.columns.tolist())}")
        else:
            log_output.append(f"✓ Todas las cabeceras esperadas fueron encontradas")
    except Exception as e:
        log_output.append(f"✗ ERROR al leer hojas 'Reporte CORTE 1' y/o 'BASE': {e}")
        return None, log_output

    # Zip con archivos por agencia
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Obtener agencias desde la hoja de reporte
        if 'AGENCIA_NORMALIZADA' not in df_reporte_total.columns:
            log_output.append("✗ ERROR: No se pudo normalizar la columna 'AGENCIA'")
            return None, log_output

        agencias_normalizadas = df_reporte_total['AGENCIA_NORMALIZADA'].dropna().unique().tolist()
        log_output.append(f"\n{'='*80}")
        log_output.append(f"📊 PROCESANDO {len(agencias_normalizadas)} AGENCIAS")
        log_output.append(f"{'='*80}\n")

        # Alias opcional (normalizados también)
        mapeo_agencias_alias = {
            normalizar_nombre_agencia("EXPORTEL S.A.C."): [
                normalizar_nombre_agencia("EXPORTEL S.A.C."), 
                normalizar_nombre_agencia("EXPORTEL PROVINCIA")
            ]
        }

        # Mantener todas las columnas de BASE (excluyendo la normalizada)
        columnas_base = [col for col in df_base_total.columns if col != 'ASESOR_NORMALIZADO']
        
        if 'ASESOR_NORMALIZADO' not in df_base_total.columns:
            log_output.append("⚠ ADVERTENCIA: No se pudo normalizar la columna 'ASESOR' en BASE")

        agencias_exitosas = 0
        agencias_con_descuadre = 0
        
        for agencia_norm in agencias_normalizadas:
            # Obtener datos del reporte para esta agencia
            reporte_agencia = df_reporte_total[df_reporte_total['AGENCIA_NORMALIZADA'] == agencia_norm].copy()
            if reporte_agencia.empty:
                continue

            # Obtener el nombre original para el archivo
            nombre_original = reporte_agencia['AGENCIA_ORIGINAL'].iloc[0]

            # Filtrar BASE por ASESOR normalizado
            if 'ASESOR_NORMALIZADO' in df_base_total.columns:
                if agencia_norm in mapeo_agencias_alias:
                    nombres = mapeo_agencias_alias[agencia_norm]
                    base_agencia = df_base_total[df_base_total['ASESOR_NORMALIZADO'].isin(nombres)]
                else:
                    base_agencia = df_base_total[df_base_total['ASESOR_NORMALIZADO'] == agencia_norm]
            else:
                base_agencia = df_base_total

            base_agencia_final = base_agencia[columnas_base].copy()

            # Log con validación mejorada
            try:
                altas_reporte = int(pd.to_numeric(reporte_agencia.iloc[0].get('ALTAS', 0), errors='coerce') or 0)
                registros_base = len(base_agencia_final)
                
                if altas_reporte == registros_base:
                    log_output.append(f"✓ {nombre_original:<45} │ ALTAS: {altas_reporte:>5} │ BASE: {registros_base:>5} │ ✓ OK")
                    agencias_exitosas += 1
                else:
                    log_output.append(f"⚠ {nombre_original:<45} │ ALTAS: {altas_reporte:>5} │ BASE: {registros_base:>5} │ ⚠ DESCUADRE")
                    agencias_con_descuadre += 1
            except Exception as e:
                log_output.append(f"✗ {nombre_original:<45} │ ERROR: {str(e)}")
                agencias_con_descuadre += 1

            # Remover columnas auxiliares antes de guardar
            reporte_para_guardar = reporte_agencia.drop(columns=['AGENCIA_NORMALIZADA', 'AGENCIA_ORIGINAL'], errors='ignore')
            
            # Crear Excel por agencia con formatos simplificados
            output_buffer = io.BytesIO()
            with pd.ExcelWriter(output_buffer, engine='xlsxwriter') as writer:  # type: ignore
                reporte_para_guardar.to_excel(writer, sheet_name='Reporte Agencia', index=False)  # type: ignore
                base_agencia_final.to_excel(writer, sheet_name='BASE', index=False)  # type: ignore

                # Aplicar solo formatos básicos para evitar errores de Excel
                try:
                    workbook = writer.book
                    ws = writer.sheets['Reporte Agencia']
                    
                    # Formato de porcentaje simple
                    percent_fmt = workbook.add_format({'num_format': '0.00%'})
                    # Formato de número con 2 decimales
                    number_fmt = workbook.add_format({'num_format': '#,##0.00'})
                    
                    headers = list(reporte_para_guardar.columns)
                    
                    # Aplicar formato solo a las columnas clave
                    if 'CUMPLIMIENTO ALTAS %' in headers:
                        idx = headers.index('CUMPLIMIENTO ALTAS %')
                        ws.set_column(idx, idx, 20, percent_fmt)
                    
                    if 'TOTAL A PAGAR' in headers:
                        idx = headers.index('TOTAL A PAGAR')
                        ws.set_column(idx, idx, 18, number_fmt)
                except Exception:
                    pass

            # Nombre limpio de archivo usando el nombre original
            nombre_archivo = "".join(c for c in str(nombre_original) if c.isalnum() or c in (' ', '_')).rstrip()
            zf.writestr(f"Reporte {nombre_archivo}.xlsx", output_buffer.getvalue())

    # Resumen final del log
    log_output.append(f"\n{'='*80}")
    log_output.append(f"📋 RESUMEN DEL PROCESO")
    log_output.append(f"{'='*80}")
    log_output.append(f"✓ Agencias procesadas exitosamente: {agencias_exitosas}")
    if agencias_con_descuadre > 0:
        log_output.append(f"⚠ Agencias con descuadre: {agencias_con_descuadre}")
    log_output.append(f"📁 Total de archivos generados: {len(agencias_normalizadas)}")
    log_output.append(f"{'='*80}\n")
    log_output.append("--- FIN DEL PROCESO ---")
    zip_buffer.seek(0)
    return zip_buffer, log_output

# =================== Interfaz Streamlit ===================
st.title("Segmentador de Reportes - Lima")
st.markdown("Sube el archivo consolidado de Lima para generar los reportes individuales por agencia.")
st.info("💡 El sistema detecta automáticamente si las cabeceras están en la fila 1 o fila 2.")

uploaded_file = st.file_uploader("Sube tu archivo Excel de reportes de Lima", type=["xlsx"], key="lima_uploader")

if uploaded_file is not None:
    st.success(f"✓ Archivo '{uploaded_file.name}' cargado exitosamente")
    if st.button("🚀 Procesar y Generar Reportes", type="primary"):
        with st.spinner("⏳ Procesando archivo..."):
            zip_file, log_data = procesar_archivos_excel(uploaded_file)
        
        if zip_file:
            st.success("✅ ¡Proceso completado exitosamente!")
            
            # Mostrar resumen en tarjetas
            col1, col2 = st.columns(2)
            
            # Contar éxitos y errores del log
            exitosas = sum(1 for line in log_data if "✓ OK" in line)
            descuadres = sum(1 for line in log_data if "⚠ DESCUADRE" in line)
            
            with col1:
                st.metric("Agencias Exitosas", exitosas, delta=None)
            with col2:
                if descuadres > 0:
                    st.metric("Agencias con Descuadre", descuadres, delta=f"-{descuadres}", delta_color="inverse")
                else:
                    st.metric("Agencias con Descuadre", 0, delta="Todo OK")
            
            # Log detallado
            with st.expander("📋 Ver Log Detallado", expanded=False):
                st.code("\n".join(log_data), language=None)
            
            # Botón de descarga prominente
            st.markdown("---")
            st.download_button(
                label="📥 Descargar todos los reportes (.zip)",
                data=zip_file,
                file_name=f"Reportes_Lima_Segmentados_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
                mime="application/zip",
                type="primary"
            )
        else:
            st.error("❌ Ocurrió un error al procesar el archivo")
            with st.expander("📋 Ver Log de Errores", expanded=True):
                st.code("\n".join(log_data), language=None)
