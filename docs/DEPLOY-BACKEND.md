# Desplegar el backend (público) en Render

Para que las apps funcionen desde cualquier teléfono (no solo en tu Wi-Fi), el backend debe ser
público. Usamos **Render** (plan gratuito) conectado a tu **Supabase** existente. Hay un blueprint
listo en [`render.yaml`](../render.yaml).

## Pasos

1. Ve a https://dashboard.render.com → **New → Blueprint**.
2. Conecta tu GitHub y elige el repo **`childrensafe`**. Render detecta `render.yaml`.
3. Render creará el servicio **`childrensafe-api`** y pedirá las variables `sync:false`:
   - **`DATABASE_URL`** → el **Session pooler** de Supabase (puerto **5432**, con tu contraseña):
     ```
     postgresql://postgres.hpyvgpxuctscsuoppgys:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres
     ```
     (usa 5432, no 6543: el pooler de sesión soporta mejor `prisma migrate deploy`).
   - **`GOOGLE_CLIENT_ID`** → tu Web Client ID (ver [GOOGLE-SIGNIN-SETUP.md](GOOGLE-SIGNIN-SETUP.md)).
     Si aún no usas Google, ponlo vacío por ahora.
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` los **genera Render** solo.
4. **Apply / Deploy**. En ~3–5 min tendrás:
   - API: `https://childrensafe-api.onrender.com/api`
   - Health: `https://childrensafe-api.onrender.com/api/health` → `{"status":"ok"}`

## Conectar las apps al backend público

En **Codemagic**, en el grupo de variables `childrensafe`:
```
API_BASE_URL = https://childrensafe-api.onrender.com/api
GOOGLE_SERVER_CLIENT_ID = <Web Client ID>
```
Recompila los workflows `parent-android` / `child-android` → los nuevos APK ya hablan con el backend
en la nube. **Listo: app funcional desde cualquier lugar.**

## Notas
- El plan free de Render **duerme** tras ~15 min de inactividad; la primera petición tarda ~30 s en
  despertar. Para producción real, sube de plan o usa Railway/Fly.
- Las migraciones ya están aplicadas en Supabase (baseline), así que `prisma migrate deploy` no hará
  cambios; solo verifica el estado.
- Rota la contraseña de la base antes de producción (se compartió en este chat).
- CORS está en `*` (no hay frontend web; las apps nativas no aplican CORS). Restríngelo si añades web.
