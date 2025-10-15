# pages/3_Reportes_Lima_Corte_2.py
import streamlit as st
import pandas as pd
import io
import zipfile
from datetime import datetime

def normalizar_nombre_agencia(nombre):
    """
    Normaliza el nombre de una agencia para comparaciones consistentes.
    Convierte a mayúsculas y elimina espacios extras.
    """
    if pd.isna(nombre) or not isinstance(nombre, str):
        return ""
    return nombre.strip().upper()

def procesar_reporte_corte_2(archivo_excel_cargado):
    """
    Procesa un archivo Excel con la estructura de "Corte 2", que contiene
    cabeceras de múltiples niveles, y lo segmenta por agencia.
    """
    log_output = []
    log_output.append("--- INICIO DEL PROCESO LIMA CORTE 2 ---")

    # --- 1. Validación de Cabeceras ---
    try:
        # Validación para 'Reporte CORTE 2' con cabeceras en dos filas
        df_headers_reporte = pd.read_excel(archivo_excel_cargado, sheet_name='Reporte CORTE 2', header=None, nrows=2)
        fila1_headers = [str(h).strip().upper() for h in df_headers_reporte.iloc[0].values]
        fila2_headers = [str(h).strip().upper() for h in df_headers_reporte.iloc[1].values]
        
        cabeceras_fila1_esperadas = ['PENALIDAD 1', 'CLAWBACK 1']
        # Validar algunas cabeceras clave del nivel 2
        cabeceras_fila2_esperadas = ['RUC', 'AGENCIA', 'META', 'GRUPO', 'ALTAS']

        if not all(h in fila1_headers for h in cabeceras_fila1_esperadas):
            log_output.append("⚠ ALERTA: No se encontraron las cabeceras de nivel 1 esperadas ('PENALIDAD 1', 'CLAWBACK 1')")
            return None, log_output
            
        if not all(h in fila2_headers for h in cabeceras_fila2_esperadas):
            log_output.append("⚠ ALERTA: No se encontraron las cabeceras clave del nivel 2 (RUC, AGENCIA, META, GRUPO, ALTAS)")
            log_output.append(f"  Cabeceras encontradas: {', '.join(fila2_headers[:10])}...")
            return None, log_output

        # Validación para 'BASE' (cabecera simple)
        df_headers_base = pd.read_excel(archivo_excel_cargado, sheet_name='BASE', header=None, nrows=1)
        base_headers = [str(h).strip().upper() for h in df_headers_base.iloc[0].values]
        if 'ASESOR' not in base_headers or 'COD_PEDIDO' not in base_headers:
            log_output.append("⚠ ALERTA: Las cabeceras 'ASESOR' y 'COD_PEDIDO' no se encontraron en la hoja 'BASE'")
            return None, log_output
        
        log_output.append("✓ Validación de cabeceras exitosa")

    except Exception as e:
        log_output.append(f"✗ ERROR al validar cabeceras: {e}")
        return None, log_output

    # --- 2. Lectura de Datos Completos ---
    try:
        log_output.append("✓ Leyendo datos completos del archivo...")
        # Leer el reporte con las dos primeras filas como cabecera
        df_reporte_total = pd.read_excel(archivo_excel_cargado, sheet_name='Reporte CORTE 2', header=[0, 1])
        df_base_total = pd.read_excel(archivo_excel_cargado, sheet_name='BASE')

        # Estandarizar cabeceras de la hoja BASE
        df_base_total.columns = df_base_total.columns.str.strip().str.upper()
        log_output.append("✓ Datos cargados y cabeceras de la BASE estandarizadas")

    except Exception as e:
        log_output.append(f"✗ ERROR: No se pudo leer el archivo Excel. Error: {e}")
        return None, log_output

    # --- 3. Normalizar nombres de agencias ---
    # La columna 'AGENCIA' está en el segundo nivel de la cabecera (tupla MultiIndex)
    columna_agencia = next((col for col in df_reporte_total.columns if 'AGENCIA' in str(col).upper()), None)
    if not columna_agencia:
        log_output.append("✗ ERROR: No se pudo encontrar la columna 'AGENCIA' en la hoja 'Reporte CORTE 2'")
        return None, log_output
    
    # Crear columnas normalizadas
    df_reporte_total[('AGENCIA_NORMALIZADA', '')] = df_reporte_total[columna_agencia].apply(normalizar_nombre_agencia)
    df_reporte_total[('AGENCIA_ORIGINAL', '')] = df_reporte_total[columna_agencia]
    
    if 'ASESOR' in df_base_total.columns:
        df_base_total['ASESOR_NORMALIZADO'] = df_base_total['ASESOR'].apply(normalizar_nombre_agencia)
    
    # --- 4. Proceso de Segmentación ---
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        col_agencia_norm = ('AGENCIA_NORMALIZADA', '')
        col_agencia_orig = ('AGENCIA_ORIGINAL', '')
        
        agencias_normalizadas = df_reporte_total[col_agencia_norm].dropna().unique().tolist()
        
        log_output.append(f"\n{'='*80}")
        log_output.append(f"📊 PROCESANDO {len(agencias_normalizadas)} AGENCIAS - CORTE 2")
        log_output.append(f"{'='*80}\n")

        columna_altas = next((col for col in df_reporte_total.columns if 'ALTAS' in str(col).upper()), None)
        
        # Alias opcional (normalizados)
        mapeo_agencias_alias = {
            normalizar_nombre_agencia("EXPORTEL S.A.C."): [
                normalizar_nombre_agencia("EXPORTEL S.A.C."), 
                normalizar_nombre_agencia("EXPORTEL PROVINCIA")
            ]
        }

        agencias_exitosas = 0
        agencias_con_descuadre = 0

        for agencia_norm in agencias_normalizadas:
            reporte_agencia = df_reporte_total[df_reporte_total[col_agencia_norm] == agencia_norm].copy()
            if reporte_agencia.empty:
                continue

            # Obtener el nombre original para el archivo
            nombre_original = reporte_agencia[col_agencia_orig].iloc[0]

            # Filtrar BASE por ASESOR normalizado
            if 'ASESOR_NORMALIZADO' in df_base_total.columns:
                if agencia_norm in mapeo_agencias_alias:
                    nombres = mapeo_agencias_alias[agencia_norm]
                    base_agencia = df_base_total[df_base_total['ASESOR_NORMALIZADO'].isin(nombres)]
                else:
                    base_agencia = df_base_total[df_base_total['ASESOR_NORMALIZADO'] == agencia_norm]
            else:
                base_agencia = df_base_total

            # Validación de consistencia
            try:
                if columna_altas:
                    altas_reporte = int(pd.to_numeric(reporte_agencia.iloc[0][columna_altas], errors='coerce') or 0)
                    registros_base = len(base_agencia)
                    if altas_reporte == registros_base:
                        log_output.append(f"✓ {nombre_original:<45} │ ALTAS: {altas_reporte:>5} │ BASE: {registros_base:>5} │ ✓ OK")
                        agencias_exitosas += 1
                    else:
                        log_output.append(f"⚠ {nombre_original:<45} │ ALTAS: {altas_reporte:>5} │ BASE: {registros_base:>5} │ ⚠ DESCUADRE")
                        agencias_con_descuadre += 1
                else:
                    log_output.append(f"ℹ {nombre_original:<45} │ No se pudo validar conteo de ALTAS")
            except Exception as e:
                log_output.append(f"✗ {nombre_original:<45} │ ERROR: {str(e)}")
                agencias_con_descuadre += 1

            # Remover columnas auxiliares antes de procesar
            cols_a_eliminar = [('AGENCIA_NORMALIZADA', ''), ('AGENCIA_ORIGINAL', '')]
            reporte_agencia_limpio = reporte_agencia.drop(columns=cols_a_eliminar, errors='ignore')
            
            # Remover columna auxiliar de BASE
            columnas_base = [col for col in base_agencia.columns if col != 'ASESOR_NORMALIZADO']
            base_agencia_final = base_agencia[columnas_base].copy()
            
            # Aplanar el MultiIndex de las columnas
            # Las columnas de PENALIDAD 1 y CLAWBACK 1 quedan identificadas
            new_cols = []
            columnas_penalidad = ['CHURN 4.5%', 'UMBRAL', 'ALTAS PENALIZADAS', 'PENALIDAD 1']
            columnas_clawback = ['UMBRAL 1', 'CUMPLIMIENTO CORTE 2 %', 'MULTIPLICADOR CORTE 2', 'CLAWBACK 1']
            
            for col in reporte_agencia_limpio.columns:
                level1 = str(col[0]).strip().upper()
                level2 = str(col[1]).strip().upper().replace('\n', ' ')
                
                # Si la cabecera superior es 'Unnamed' o vacía, usar solo la inferior
                if 'UNNAMED' in level1 or level1 == '' or level1 == level2:
                    new_cols.append(level2)
                # Si pertenece a PENALIDAD 1 o CLAWBACK 1
                elif level2 in columnas_penalidad:
                    new_cols.append(f"PENALIDAD 1 - {level2}")
                elif level2 in columnas_clawback:
                    new_cols.append(f"CLAWBACK 1 - {level2}")
                else:
                    new_cols.append(level2)
            
            reporte_agencia_limpio.columns = new_cols

            # Crear el archivo Excel para la agencia con formatos y colores
            output_buffer = io.BytesIO()
            with pd.ExcelWriter(output_buffer, engine='xlsxwriter') as writer: # type: ignore
                # Escribir datos SIN cabeceras (las escribiremos manualmente con formato)
                reporte_agencia_limpio.to_excel(writer, sheet_name='Reporte CORTE 2', index=False, startrow=1, header=False)
                base_agencia_final.to_excel(writer, sheet_name='BASE', index=False)
                
                # Aplicar formatos con colores en cabeceras
                try:
                    workbook = writer.book
                    worksheet_reporte = writer.sheets['Reporte CORTE 2']

                    # Formatos de datos
                    percent_format = workbook.add_format({'num_format': '0.00%'})
                    number_format = workbook.add_format({'num_format': '#,##0.00'})
                    
                    # Formatos de cabeceras con colores
                    header_penalidad_format = workbook.add_format({
                        'bold': True, 
                        'font_color': 'white', 
                        'bg_color': '#0070C0',
                        'align': 'center',
                        'valign': 'vcenter',
                        'border': 1
                    })
                    header_clawback_format = workbook.add_format({
                        'bold': True, 
                        'font_color': 'white', 
                        'bg_color': '#002060',
                        'align': 'center',
                        'valign': 'vcenter',
                        'border': 1
                    })
                    header_default_format = workbook.add_format({
                        'bold': True, 
                        'bg_color': '#FFC000',
                        'align': 'center',
                        'valign': 'vcenter',
                        'border': 1
                    })

                    header = reporte_agencia_limpio.columns.tolist()
                    
                    # Escribir cabeceras manualmente con formato y color en la fila 0
                    for col_idx, header_text in enumerate(header):
                        if header_text.startswith('PENALIDAD 1 -'):
                            worksheet_reporte.write(0, col_idx, header_text, header_penalidad_format)
                        elif header_text.startswith('CLAWBACK 1 -'):
                            worksheet_reporte.write(0, col_idx, header_text, header_clawback_format)
                        else:
                            worksheet_reporte.write(0, col_idx, header_text, header_default_format)
                    
                    # Aplicar formato de porcentaje a las columnas relevantes (empezando desde fila 1)
                    cols_porcentaje = ['CUMPLIMIENTO ALTAS %', 'CLAWBACK 1 - CUMPLIMIENTO CORTE 2 %']
                    for col_name in cols_porcentaje:
                        if col_name in header:
                            col_idx = header.index(col_name)
                            worksheet_reporte.set_column(col_idx, col_idx, 20, percent_format)
                    
                    # Aplicar formato numérico a columnas monetarias
                    cols_monetarias = ['TOTAL A PAGAR CORTE 2', 'PENALIDAD 1 - PENALIDAD 1', 'CLAWBACK 1 - CLAWBACK 1']
                    for col_name in cols_monetarias:
                        if col_name in header:
                            col_idx = header.index(col_name)
                            worksheet_reporte.set_column(col_idx, col_idx, 18, number_format)
                except Exception:
                    pass
            
            nombre_archivo_limpio = "".join(c for c in str(nombre_original) if c.isalnum() or c in (' ', '_')).rstrip()
            zf.writestr(f"Reporte Corte 2 {nombre_archivo_limpio}.xlsx", output_buffer.getvalue())

    # Resumen final del log
    log_output.append(f"\n{'='*80}")
    log_output.append(f"📋 RESUMEN DEL PROCESO - CORTE 2")
    log_output.append(f"{'='*80}")
    log_output.append(f"✓ Agencias procesadas exitosamente: {agencias_exitosas}")
    if agencias_con_descuadre > 0:
        log_output.append(f"⚠ Agencias con descuadre: {agencias_con_descuadre}")
    log_output.append(f"📁 Total de archivos generados: {len(agencias_normalizadas)}")
    log_output.append(f"{'='*80}\n")
    log_output.append("--- FIN DEL PROCESO ---")
    zip_buffer.seek(0)
    return zip_buffer, log_output


# --- Interfaz de Usuario para la página de Reportes Lima Corte 2 ---
st.title("Segmentador de Reportes - Lima Corte 2")
st.markdown("Sube el archivo consolidado de **Lima CORTE 2** para generar los reportes individuales por agencia.")
st.info("💡 El archivo debe tener cabeceras de dos niveles en la hoja 'Reporte CORTE 2'")

uploaded_file = st.file_uploader("Sube tu archivo Excel de CORTE 2", type=["xlsx"], key="lima_corte_2_uploader")

if uploaded_file is not None:
    st.success(f"✓ Archivo '{uploaded_file.name}' cargado exitosamente")
    if st.button("🚀 Procesar y Generar Reportes de Corte 2", type="primary"):
        with st.spinner("⏳ Procesando archivo... (cabeceras multinivel)"):
            zip_file, log_data = procesar_reporte_corte_2(uploaded_file)
        
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
                file_name=f"Reportes_Lima_Corte_2_Segmentados_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
                mime="application/zip",
                type="primary"
            )
        else:
            st.error("❌ Ocurrió un error al procesar el archivo")
            with st.expander("📋 Ver Log de Errores", expanded=True):
                st.code("\n".join(log_data), language=None) 