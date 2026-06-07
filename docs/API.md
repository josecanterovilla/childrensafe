# Referencia de API (Fase 1)

Base URL: `/api` · Documentación interactiva (no producción): `GET /docs` (Swagger).
Autenticación: `Authorization: Bearer <accessToken>` salvo los endpoints marcados como públicos.
Todos los recursos están aislados por **familia**; debes pertenecer a la familia indicada.

## Convenciones

- Errores: `{ statusCode, error, message, path, timestamp }`. `message` puede ser lista (validación).
- Roles: `PARENT`, `GUARDIAN`, `CHILD`. Las acciones de mutación suelen requerir `PARENT`.
- Rate limiting: límites por endpoint sensible (login, pairing, sos, location).

## Auth (público salvo indicación)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/auth/register` | público | Crea un tutor y su familia. Devuelve `{ userId, accessToken, refreshToken, expiresIn }`. |
| POST | `/auth/login` | público | Inicia sesión (con `mfaCode` si la cuenta tiene MFA). |
| POST | `/auth/google` | público | Inicia con Google (ID token); crea o enlaza la cuenta del tutor. Ver [GOOGLE-SIGNIN-SETUP.md](GOOGLE-SIGNIN-SETUP.md). |
| POST | `/auth/refresh` | público | Rota el par de tokens (rotación + detección de reuso). |
| POST | `/auth/logout` | público | Revoca el refresh token. |
| POST | `/auth/forgot-password` | público | Solicita recuperación (responde 200 siempre, anti-enumeración). |
| POST | `/auth/reset-password` | público | Restablece la contraseña con el token recibido; revoca sesiones. |
| POST | `/auth/change-password` | sí | Cambia la contraseña reautenticando con la actual; revoca sesiones. |
| POST | `/auth/mfa/setup` | sí | Genera secreto TOTP + `otpauthUrl` (aún sin activar). |
| POST | `/auth/mfa/enable` | sí | Activa MFA verificando un código TOTP. |
| POST | `/auth/mfa/disable` | sí | Desactiva MFA (reautentica con contraseña + código). |

## Cuenta (GDPR)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/account/export` | sí | Exporta los datos del usuario y sus familias (derecho de acceso/portabilidad). |
| POST | `/account/delete` | sí | Elimina la cuenta (reautentica con contraseña). Si es el único tutor, borra la familia en cascada. |

## Familias

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/families` | cualquiera | Familias del usuario y su rol. |
| POST | `/families` | cualquiera | Crea una familia (creador = PARENT). |
| GET | `/families/:familyId` | miembro | Detalle (miembros + menores). |
| PATCH | `/families/:familyId` | PARENT | Renombra. |
| GET | `/families/:familyId/members` | miembro | Lista miembros. |
| GET | `/families/:familyId/children` | miembro | Lista perfiles de menores. |
| PATCH | `/families/:familyId/members/:memberId` | PARENT | Cambia rol/permisos. |
| DELETE | `/families/:familyId/members/:memberId` | PARENT | Elimina miembro (protege al último PARENT). |

## Emparejamiento

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/families/:familyId/pairing-codes` | PARENT | Genera código (se muestra una sola vez) + `qrPayload`. |
| GET | `/families/:familyId/pairing-codes` | PARENT | Lista códigos (sin revelar el código). |
| POST | `/families/:familyId/pairing-codes/:codeId/revoke` | PARENT | Anula un código. |
| POST | `/pairing/join` | **público** | El menor canjea el código; crea su perfil, registra el dispositivo y devuelve tokens. |

## Dispositivos

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/families/:familyId/devices` | miembro | Registra/reactiva el propio dispositivo. |
| GET | `/families/:familyId/devices` | miembro | Lista (CHILD solo ve los suyos). |
| PATCH | `/families/:familyId/devices/:deviceId/heartbeat` | dueño | Batería, push token, última conexión. |
| PATCH | `/families/:familyId/devices/:deviceId/revoke` | PARENT | Revoca un dispositivo. |

## Ubicación

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/families/:familyId/location` | CHILD | Reporta ubicación (idempotente por `clientEventId`); evalúa geocercas. |
| GET | `/families/:familyId/children/:childId/location/latest` | tutor / propio | Última ubicación. |
| GET | `/families/:familyId/children/:childId/location/history?limit=` | tutor / propio | Historial (retención limitada). |

## Geocercas

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/families/:familyId/geofences` | miembro | Lista. |
| POST | `/families/:familyId/geofences` | PARENT/GUARDIAN | Crea (zona segura o peligrosa). |
| PATCH | `/families/:familyId/geofences/:geofenceId` | PARENT/GUARDIAN | Actualiza. |
| DELETE | `/families/:familyId/geofences/:geofenceId` | PARENT | Elimina. |

## Alertas

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/families/:familyId/alerts?status=` | miembro | Lista alertas. |
| POST | `/families/:familyId/alerts/:alertId/acknowledge` | miembro | Marca como vista. |

## SOS y "llegué bien"

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/families/:familyId/sos` | CHILD | Activa SOS (alerta CRÍTICA + push a tutores). |
| POST | `/families/:familyId/arrived` | CHILD | Avisa que llegó bien (alerta INFO). |
| GET | `/families/:familyId/sos` | miembro | Historial de SOS. |
| POST | `/families/:familyId/sos/:sosId/resolve` | PARENT/GUARDIAN | Marca SOS resuelto. |

## Tiempo real (WebSocket · Socket.IO)

Namespace **`/realtime`**. El cliente se conecta pasando el access JWT en el handshake:

```js
const socket = io('https://<host>/realtime', { auth: { token: accessToken } });
socket.on('ready',    ({ families }) => { /* salas unidas */ });
socket.on('location', (p) => { /* { childProfileId, latitude, longitude, batteryLevel, recordedAt } */ });
socket.on('alert',    (a) => { /* { id, type, severity, title, message, childProfileId, createdAt } */ });
socket.on('unauthorized', () => { /* token inválido: el servidor cierra la conexión */ });
```

- Al conectar, el servidor valida el token y une al cliente a una sala por cada familia a la que
  pertenece (`family:<id>`). Un cliente **solo** recibe eventos de sus familias (aislamiento).
- `location` se emite cuando el menor reporta ubicación; `alert` cuando se genera cualquier alerta
  (incluido **SOS**, que llega en tiempo real al tutor conectado).

## Eventos de dominio más importantes

`PAIRING_CONSUMED`, `SOS_TRIGGERED`, `GEOFENCE_ENTER` / `GEOFENCE_EXIT`,
`LEFT_SAFE_PERIMETER`, `LOW_BATTERY`, `LOCATION_PERMISSION_OFF`, `DEVICE_CHANGED`,
`ARRIVED_SAFELY`, `ABUSE_SIGNAL`. Cada uno puede generar una alerta y/o una notificación push.
