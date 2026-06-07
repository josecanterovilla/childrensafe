# Estrategia de seguridad

## Autenticación

- **Tutores**: email + contraseña (hash **Argon2id**), o proveedor externo (Apple/Google) en fase posterior.
- **MFA opcional** (TOTP) para tutores; obligatoria para acciones muy sensibles si se activa.
- **Tokens**: JWT de **acceso** de vida corta (~15 min) + **refresh token** rotatorio de vida
  larga, almacenado *hasheado* en BD y revocable. Rotación en cada uso (detección de reuso ⇒
  revocación de toda la familia de tokens).
- **Sesiones revocables**: lista de sesiones por usuario; "cerrar sesión en todos los dispositivos".

## Autorización (RBAC)

| Rol | Capacidades |
|-----|-------------|
| `PARENT` | Control total dentro de su familia: ver ubicación, crear geocercas, reglas, gestionar miembros y dispositivos. |
| `GUARDIAN` | Permisos limitados configurables (p. ej. ver ubicación y alertas, sin borrar miembros). |
| `CHILD` | Ver zonas seguras, enviar SOS, ver contactos confiables y su propio registro de permisos. **No** ve datos de otros menores. |

- Guard de rol + verificación de **pertenencia a la familia** en cada recurso.
- Acciones sensibles (revocar vínculo, eliminar miembro, exportar/eliminar cuenta) exigen
  **reautenticación** (password/MFA reciente).

## Emparejamiento seguro (anti-fraude)

- Código de **un solo uso**, **temporal** (15 min) y de alta entropía; se guarda **hasheado**.
- Vinculado a una `family_id` y a un rol/menor objetivo; **un solo consumo** (transacción atómica).
- **Confirmación en ambos dispositivos** antes de activar el vínculo.
- **Rate limiting** por IP y por familia en generación y canje; bloqueo tras N intentos fallidos.
- QR contiene un *deep link* firmado con el mismo código (no datos sensibles).

## Protección de dispositivos

- Cada dispositivo registra un `device_uuid` + clave pública/atestación cuando esté disponible.
- **Detección de cambio/reinstalación**: si el `device_uuid` cambia para un menor, se genera
  alerta y se exige re-emparejamiento (anti-suplantación).
- Tokens de push rotados por dispositivo; un token revocado no recibe alertas.

## Cifrado

- **En tránsito**: TLS 1.3 obligatorio (HSTS). Certificate pinning en las apps (fase posterior).
- **En reposo**: cifrado de volumen de BD + cifrado de campo para secretos (refresh tokens,
  TOTP seeds) con una clave gestionada (KMS). Contraseñas con Argon2id.
- **En el dispositivo**: tokens en *secure storage* (Keychain iOS / Keystore Android).

## Endurecimiento de la API

- `helmet`, CORS restringido, límites de tamaño de payload.
- **Rate limiting** global y por endpoint sensible (login, pairing, sos).
- Validación estricta de DTO (whitelist + forbid unknown) para evitar *mass assignment*.
- Filtros de error que **no filtran** detalles internos.
- Protección anti *brute-force* en login (backoff + bloqueo temporal).

## Auditoría

- `audit_logs` registra: actor, acción, recurso, `family_id`, metadatos, IP/agente, timestamp.
- Acciones auditadas: login, cambios de rol/permiso, emparejar/revocar, crear/borrar geocerca,
  cambios de reglas, exportación y eliminación de cuenta, SOS.
- Los registros de auditoría son **inmutables** (append-only) y visibles para el tutor.

## Postura de seguridad en Supabase (base de datos)

El backend es **dueño** de la base: conecta directo a Postgres (rol owner) y aplica todo el
control de acceso en la capa de aplicación. **No** se usa el Data API (PostgREST) ni la anon key
de Supabase. Para cerrar esa superficie de ataque:

- **RLS activado deny-by-default** en las 15 tablas (sin políticas). Bloquea a los roles
  `anon`/`authenticated` del Data API; el rol owner del backend lo bypassa y opera con normalidad.
  Estado: ✅ aplicado y verificado (escáner de seguridad sin avisos críticos).
- **Recomendado además**: desactivar el Data API en el panel (*Settings → API → Data API*),
  ya que ChildrenSafe nunca lo usa. Defensa en profundidad.
- Si en el futuro se quisiera usar el Data API, habría que escribir políticas RLS explícitas por
  familia (no aplica al diseño actual).

## Gestión de secretos

- Variables en `.env` (nunca en el repo). En producción, gestor de secretos (Vault/SM/KMS).
- Rotación de claves de firma JWT con `kid` para rotación sin downtime.

## Respuesta a incidentes

- Logs estructurados centralizados, alertas por anomalías (ver ABUSE-PREVENTION.md).
- Procedimiento de revocación masiva de sesiones y rotación de claves documentado.
