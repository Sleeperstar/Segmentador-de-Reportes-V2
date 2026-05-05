# Segmentador de Reportes — Web App

Aplicación web generalista para segmentar reportes de comisiones por agencia. Reemplaza la app Streamlit de la carpeta raíz del repo.

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Estilos**: Tailwind CSS v4 + shadcn/ui
- **Backend**: Supabase (Auth, Postgres con RLS, Storage)
- **Procesamiento Excel**: `exceljs` (a implementar en fases siguientes)

## Identidad visual (WIN Empresas)

- **Primario** — Naranja Vibrante: `#FF6B00`
- **Secundario** — Ámbar / Oro: `#FFB800`

Configurados como tokens Tailwind (`bg-brand-primary-500`, `text-brand-secondary-500`, etc.) y como variables shadcn (`--primary`, `--secondary`, `--ring`).

## Cómo ejecutar en local

```bash
cd webapp
npm install
cp .env.example .env.local
# Edita .env.local con las credenciales del proyecto Supabase
npm run dev
```

Abre http://localhost:3000

## Variables de entorno

Ver `.env.example`. Al menos necesitas:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Estructura

```
webapp/
  app/
    (auth)/        # Login, signup
    (dashboard)/   # Panel principal autenticado
    admin/         # UI de admin (a implementar)
    api/           # Route handlers
    auth/callback  # Callback de OAuth/magic link de Supabase
  components/
    ui/            # Primitivas shadcn/ui
    layout/        # Sidebar, top-bar
    brand/         # Logo y marca
  lib/
    supabase/      # Clientes server/browser/middleware
    utils.ts       # Helpers (cn)
  middleware.ts    # Auth guard + refresh de sesión
```

## Tests

```bash
npm run test         # ejecuta tests unitarios (vitest)
npm run test:watch   # modo watch
```

## Despliegue en Vercel

1. **Importa el proyecto** desde GitHub. Como root del proyecto en Vercel, selecciona la carpeta `webapp/` (no la raíz del repo).
2. **Variables de entorno** (settings → Environment Variables): copia las claves del `.env.example`. La app necesita al menos:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SUPABASE_PROJECT_ID`
3. **Plan**: el `vercel.json` configura `maxDuration=60s` y `memory=1024MB` para `/api/process`. En plan Hobby el cap es 60s; si necesitas más, sube a Pro y ajusta a 300s.
4. **Región**: configurada como `gru1` (São Paulo) para minimizar latencia con Supabase `sa-east-1`.
5. **Supabase Auth**: en el proyecto Supabase, agrega la URL de Vercel a *Authentication → URL Configuration → Redirect URLs* (ej: `https://tu-app.vercel.app/auth/callback`).

## Mantenimiento (cron jobs)

- `cleanup-old-storage-and-runs` — pg_cron diario a las 03:15 UTC. Borra archivos de los buckets `inputs`/`outputs` con más de 7 días y registros de `process_runs` con más de 30 días.
- Verificar manualmente: `select * from cron.job where jobname='cleanup-old-storage-and-runs';`
- Ejecutar de inmediato: `select public.cleanup_old_runs_and_storage();`

## Rate limiting

Las APIs sensibles tienen límites por usuario por hora:
- `/api/process` — 10 procesamientos/hora
- `/api/upload-url` — 30 generaciones/hora

Implementado vía función Postgres `public.check_rate_limit` con tabla `api_rate_limits`.

## Roadmap completado

- [x] Fase 1 — Motor de pipeline declarativo (`lib/pipeline/`)
- [x] Fase 2 — Pantalla de ejecución (subida + procesamiento + descarga)
- [x] Fase 3 — Wizard de admin de 6 pasos para crear/editar plantillas
- [x] Fase 4 — Optimizaciones (TTL via pg_cron, rate limiting)
- [x] Fase 5 — Configuración de despliegue a Vercel
