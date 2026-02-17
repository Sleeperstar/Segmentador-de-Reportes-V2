# pages/4_Reportes_Provincia_Corte_2.py
import streamlit as st
import pandas as pd
import io
import zipfile
import re
from datetime import datetime

# --- Mapa fijo de Homologación de Zonas ---
HOMOLOGACION_ZONAS = {
    'AREQUIPA':    'SUR',
    'JUNIN':       'SUR',
    'CUSCO':       'SUR',
    'LA LIBERTAD': 'NORTE',
    'LAMBAYEQUE':  'NORTE',
    'PIURA':       'NORTE',
    'ANCASH':      'NORTE',
}

def quitar_tildes(texto):
    """Elimina tildes y caracteres diacríticos de un string."""
    import unicodedata
    return ''.join(
        c for c in unicodedata.normalize('NFD', texto)
        if unicodedata.category(c) != 'Mn'
    )

def get_zona_departamento(depto):
    """Retorna la zona (NORTE/SUR) de un departamento, normalizando el nombre."""
    if not isinstance(depto, str):
        return None
    depto_norm = quitar_tildes(depto.upper().strip().replace('.', '').replace(',', ''))
    return HOMOLOGACION_ZONAS.get(depto_norm, None)

# --- Funciones de ayuda ---
def normalizar_nombre(nombre):
    """Convierte un nombre a formato estándar: mayúsculas, sin puntos/comas y con espacios simples."""
    if not isinstance(nombre, str): return ""
    nombre_limpio = nombre.upper().replace('.', '').replace(',', '').replace('-', '')
    return re.sub(r'\s+', ' ', nombre_limpio).strip()

def get_agencia_base(nombre_completo, lista_departamentos):
    """
    Separa el nombre base de la agencia del departamento de forma robusta.
    Ej: 'MI AGENCIA PIURA' -> 'MI AGENCIA'
    """
    if not isinstance(nombre_completo, str):
        return ""
    for depto in lista_departamentos:
        pattern = r'\s+' + re.escape(depto) + '$'
        cleaned_name, num_subs = re.subn(pattern, '', nombre_completo, flags=re.IGNORECASE)
        if num_subs > 0:
            return cleaned_name.strip()
    return nombre_completo.strip()

def procesar_provincia_corte_2(archivo_excel_cargado, zona_seleccionada):
    log_output = []
    log_output.append(f"--- INICIO DEL PROCESO: PROVINCIA CORTE 2 | ZONA: {zona_seleccionada} ---")

    mapeo_asesor_alias = {
        'EXPORTEL SAC': ['EXPORTEL SAC', 'EXPORTEL PROVINCIA']
    }
    log_output.append(f"Usando mapa de alias para: {', '.join(mapeo_asesor_alias.keys())}")

    # --- 1. Validación de Cabeceras ---
    try:
        df_headers_reporte = pd.read_excel(archivo_excel_cargado, sheet_name='Reporte CORTE 2', header=None, nrows=2)
        fila2_headers = [str(h).strip().upper() for h in df_headers_reporte.iloc[1].values]
        if 'AGENCIA' not in fila2_headers or 'RUC' not in fila2_headers:
            log_output.append("ALERTA: Cabeceras 'AGENCIA' o 'RUC' no encontradas en 'Reporte CORTE 2'.")
            return None, log_output

        df_headers_base = pd.read_excel(archivo_excel_cargado, sheet_name='BASE', header=None, nrows=1)
        base_headers = [str(h).strip().upper() for h in df_headers_base.iloc[0].values]
        if 'ASESOR' not in base_headers or 'DEPARTAMENTO' not in base_headers:
            log_output.append("ALERTA: Cabeceras 'ASESOR' o 'DEPARTAMENTO' no encontradas en la hoja 'BASE'.")
            return None, log_output
        log_output.append("Validación de cabeceras exitosa.")

    except Exception as e:
        log_output.append(f"ERROR al validar cabeceras: {e}")
        return None, log_output

    # --- 2. Lectura y Preparación de Datos ---
    try:
        log_output.append("Leyendo datos completos...")
        df_reporte_total = pd.read_excel(archivo_excel_cargado, sheet_name='Reporte CORTE 2', header=[0, 1])
        df_base_total = pd.read_excel(archivo_excel_cargado, sheet_name='BASE')
        df_base_total.columns = df_base_total.columns.str.strip().str.upper()

        # --- FILTRO DE ZONA en la BASE ---
        df_base_total['ZONA'] = df_base_total['DEPARTAMENTO'].apply(get_zona_departamento)

        base_sin_zona = df_base_total['ZONA'].isna().sum()
        if base_sin_zona > 0:
            deptos_sin_zona = df_base_total[df_base_total['ZONA'].isna()]['DEPARTAMENTO'].unique().tolist()
            log_output.append(f"ALERTA: {base_sin_zona} registros no tienen zona asignada. Departamentos: {deptos_sin_zona}")

        df_base_filtrada = df_base_total[df_base_total['ZONA'] == zona_seleccionada].copy()
        log_output.append(f"BASE filtrada por zona '{zona_seleccionada}': {len(df_base_filtrada)} de {len(df_base_total)} registros.")

        # Obtener lista de asesores válidos en la zona para filtrar el reporte
        asesores_en_zona = set(df_base_filtrada['ASESOR'].apply(normalizar_nombre).tolist())

        lista_departamentos = df_base_total['DEPARTAMENTO'].dropna().unique().tolist()
        lista_departamentos.sort(key=len, reverse=True)
        log_output.append(f"Detectados {len(lista_departamentos)} departamentos para limpieza de nombres.")

        col_agencia_reporte = next((col for col in df_reporte_total.columns if 'AGENCIA' in col[1]), None)
        if not col_agencia_reporte:
            log_output.append("ERROR: No se encontró la columna 'AGENCIA' en 'Reporte CORTE 2'.")
            return None, log_output

        df_reporte_total['AGENCIA_BASE'] = df_reporte_total[col_agencia_reporte].apply(
            lambda x: get_agencia_base(x, lista_departamentos)
        )
        df_reporte_total['AGENCIA_BASE_NORMALIZADA'] = df_reporte_total['AGENCIA_BASE'].apply(normalizar_nombre)
        df_base_filtrada['ASESOR_NORMALIZADO'] = df_base_filtrada['ASESOR'].apply(normalizar_nombre)

        # --- FILTRO DE ZONA en el REPORTE ---
        # Obtenemos las agencias que tienen registros en la BASE filtrada por zona,
        # incluyendo alias del mapa
        agencias_en_zona = set(df_base_filtrada['ASESOR_NORMALIZADO'].tolist())
        # Agregar también los alias inversos
        for agencia_principal, aliases in mapeo_asesor_alias.items():
            aliases_norm = [normalizar_nombre(a) for a in aliases]
            if any(a in agencias_en_zona for a in aliases_norm):
                agencias_en_zona.add(normalizar_nombre(agencia_principal))

        df_reporte_filtrado = df_reporte_total[
            df_reporte_total['AGENCIA_BASE_NORMALIZADA'].isin(agencias_en_zona)
        ].copy()
        log_output.append(f"REPORTE filtrado por zona '{zona_seleccionada}': {len(df_reporte_filtrado)} de {len(df_reporte_total)} filas.")

    except Exception as e:
        log_output.append(f"ERROR al leer o preparar datos: {e}")
        return None, log_output

    # --- 3. Proceso de Segmentación ---
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        agencias_a_procesar = df_reporte_filtrado['AGENCIA_BASE_NORMALIZADA'].dropna().unique().tolist()
        log_output.append(f"Se encontraron {len(agencias_a_procesar)} agencias en zona '{zona_seleccionada}' para procesar.")

        for agencia_norm in agencias_a_procesar:
            reporte_agencia = df_reporte_filtrado[
                df_reporte_filtrado['AGENCIA_BASE_NORMALIZADA'] == agencia_norm
            ].copy()

            # --- Lógica de cruce con mapa de alias ---
            if agencia_norm in mapeo_asesor_alias:
                nombres_a_buscar = mapeo_asesor_alias[agencia_norm]
                base_agencia = df_base_filtrada[
                    df_base_filtrada['ASESOR_NORMALIZADO'].isin(nombres_a_buscar)
                ].copy()
            else:
                base_agencia = df_base_filtrada[
                    df_base_filtrada['ASESOR_NORMALIZADO'] == agencia_norm
                ].copy()

            if reporte_agencia.empty:
                continue

            # --- Bloque de validación ---
            try:
                col_altas = next((col for col in reporte_agencia.columns if 'ALTAS' in col[1]), None)
                if col_altas:
                    altas_reporte = pd.to_numeric(reporte_agencia[col_altas], errors='coerce').fillna(0).sum()
                    registros_base = len(base_agencia)
                    if int(altas_reporte) == registros_base:
                        log_output.append(f"ÉXITO    | {agencia_norm:<40} | ALTAS: {int(altas_reporte):<5} | Registros BASE: {registros_base:<5} | OK")
                    else:
                        log_output.append(f"DESCUADRE | {agencia_norm:<40} | ALTAS: {int(altas_reporte):<5} | Registros BASE: {registros_base:<5} | REVISAR")
                else:
                    log_output.append(f"INFO     | {agencia_norm:<40} | No se pudo encontrar la columna ALTAS para validar.")
            except Exception as e:
                log_output.append(f"Error validando la agencia '{agencia_norm}': {e}")

            # --- Corrección de formato de cabeceras ---
            nombre_original_agencia = reporte_agencia[('AGENCIA_BASE', '')].iloc[0]
            reporte_agencia = reporte_agencia.drop(
                columns=[('AGENCIA_BASE', ''), ('AGENCIA_BASE_NORMALIZADA', '')], errors='ignore'
            )

            new_cols = []
            for col in reporte_agencia.columns:
                level1 = str(col[0]).strip()
                level2 = str(col[1]).strip().replace('\n', ' ')
                if 'unnamed' in level1.lower() or level1 == level2:
                    new_cols.append(level2)
                else:
                    new_cols.append(f"{level1} - {level2}")
            reporte_agencia.columns = new_cols
            reporte_agencia_final = reporte_agencia

            # --- Generación del archivo Excel ---
            output_buffer = io.BytesIO()
            with pd.ExcelWriter(output_buffer, engine='xlsxwriter') as writer:
                reporte_agencia_final.to_excel(writer, sheet_name='Reporte CORTE 2', index=False)
                base_agencia.drop(
                    columns=['ASESOR_NORMALIZADO', 'ZONA'], errors='ignore'
                ).to_excel(writer, sheet_name='BASE', index=False)

                workbook = writer.book
                worksheet = writer.sheets['Reporte CORTE 2']
                percent_format = workbook.add_format({'num_format': '0.00%'})
                header_penalidad = workbook.add_format({'bold': True, 'font_color': 'white', 'fg_color': '#0070C0', 'border': 1})
                header_clawback  = workbook.add_format({'bold': True, 'font_color': 'white', 'fg_color': '#002060', 'border': 1})
                default_header   = workbook.add_format({'bold': True, 'fg_color': '#FFC000', 'border': 1})

                header = reporte_agencia_final.columns.tolist()
                for i, h_text in enumerate(header):
                    if h_text.startswith('PENALIDAD 1 -'):
                        worksheet.write(0, i, h_text, header_penalidad)
                    elif h_text.startswith('CLAWBACK 1 -'):
                        worksheet.write(0, i, h_text, header_clawback)
                    else:
                        worksheet.write(0, i, h_text, default_header)

                for col_name in ['Cumplimiento Altas %', 'CLAWBACK 1 - Cumplimiento Corte 2 %']:
                    try:
                        worksheet.set_column(header.index(col_name), header.index(col_name), 18, percent_format)
                    except ValueError:
                        pass

            nombre_archivo_limpio = "".join(
                c for c in nombre_original_agencia if c.isalnum() or c in (' ', '_')
            ).rstrip()
            zf.writestr(
                f"Reporte Provincia Corte 2 {nombre_archivo_limpio}.xlsx",
                output_buffer.getvalue()
            )

    log_output.append("--- FIN DEL PROCESO ---")
    zip_buffer.seek(0)
    return zip_buffer, log_output


# --- Interfaz de Usuario ---
st.title("Segmentador de Reportes - Provincia Corte 2")
st.markdown("Sube el archivo consolidado de **Provincia CORTE 2** para generar los reportes individuales.")
st.warning("El archivo debe contener las hojas 'Reporte CORTE 2' y 'BASE'.")

# --- Selector de Zona ---
zona = st.selectbox(
    "Selecciona la Zona a procesar:",
    options=["NORTE", "SUR"],
    index=0,
    help="Filtra tanto el Reporte como la BASE por la zona geográfica seleccionada."
)

# Mostrar los departamentos correspondientes a la zona seleccionada
deptos_zona = [d for d, z in HOMOLOGACION_ZONAS.items() if z == zona]
st.info(f"Departamentos incluidos en zona **{zona}**: {', '.join(sorted(deptos_zona))}")

uploaded_file = st.file_uploader(
    "Sube tu archivo Excel de Provincia CORTE 2",
    type=["xlsx"],
    key="provincia_corte_2_uploader"
)

if uploaded_file:
    st.success(f"Archivo '{uploaded_file.name}' cargado.")
    if st.button("Procesar y Generar Reportes", type="primary"):
        with st.spinner(f"Procesando archivo de Provincia Corte 2 - Zona {zona}..."):
            zip_file, log_data = procesar_provincia_corte_2(uploaded_file, zona)

        if zip_file:
            st.success("¡Proceso completado!")
            st.subheader("Log de Validación")
            st.text_area("Resultado:", "\n".join(log_data), height=300)
            st.subheader("Descargar Resultados")
            st.download_button(
                label="Descargar todos los reportes (.zip)",
                data=zip_file,
                file_name=f"Reportes_Provincia_Corte_2_{zona}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip",
                mime="application/zip"
            )
        else:
            st.error("Ocurrió un error al procesar el archivo.")
            st.text_area("Log de Errores:", "\n".join(log_data), height=300)