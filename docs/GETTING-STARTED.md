# Puesta en marcha y estrategia de pruebas/despliegue

## 1. Requisitos

- **Node 20+** (probado con Node 24). ✅ disponible en esta máquina.
- **PostgreSQL 14+**. Opciones:
  - Docker: `docker compose -f infra/docker-compose.yml up -d` (Postgres + Redis).
  - Sin Docker: base gestionada gratuita (Neon, Supabase, Railway) y pega la URL en `.env`.
- **Flutter 3.22+** (solo para las apps). ⚠️ no instalado en esta máquina.

## 2. Backend — desarrollo local

> **La base de datos YA está aprovisionada y migrada** en Supabase (proyecto `ChildrenSafe`,
> ref `hpyvgpxuctscsuoppgys`). Las 15 tablas, enums, índices y claves foráneas están aplicados y
> verificados (incl. borrado en cascada). Solo necesitas la **contraseña de la base** para conectar.

```bash
cd backend
cp .env.example .env
# 1) Contraseña de la base: Supabase → Project Settings → Database → (Reset) password.
#    Pégala en DATABASE_URL dentro de .env.
# 2) Genera secretos JWT fuertes y pégalos en .env:
node -e "console.log('access', require('crypto').randomBytes(48).toString('base64url'))"
node -e "console.log('refresh', require('crypto').randomBytes(48).toString('base64url'))"

npm install
npm run prisma:generate

# 3) Como las tablas ya existen, marca la migración como aplicada (baseline) en vez de re-crearla:
npx prisma migrate resolve --applied 20260605004900_init

npm run seed                # (opcional) tutor demo  -> demo@childrensafe.app / contraseña-demo-123
npm run start:dev           # API en http://localhost:3000/api  · Swagger en /docs
```

> Si en el futuro usas una base **vacía** (otro entorno), usa `npm run prisma:migrate` (o
> `prisma migrate deploy`) en lugar del paso 3 para crear las tablas desde cero.

### Prueba rápida con curl

```bash
# Registro de un tutor
curl -s http://localhost:3000/api/auth/register -H "Content-Type: application/json" \
  -d '{"email":"madre@ej.com","password":"contraseña-larga","displayName":"Ana","familyName":"Familia Ana"}'

# -> guarda accessToken y úsalo:
curl -s http://localhost:3000/api/families -H "Authorization: Bearer <accessToken>"
```

## 3. Apps Flutter

Ver [../apps/README.md](../apps/README.md). Resumen:

```bash
cd apps/parent && flutter create . --org app.childrensafe --project-name childrensafe_parent
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api   # emulador Android
```

## 4. Estrategia de pruebas

| Nivel | Qué cubre | Herramienta |
|-------|-----------|-------------|
| **Unitarias** | Lógica pura: hashing, geo (haversine/geocercas), generación/normalización de códigos. | Jest (`npm test`). ✅ 12 pruebas pasando. |
| **E2E** | Flujo completo por HTTP (registro → login → familia → código → join → ubicación idempotente → SOS → RBAC → alertas), con limpieza automática. | `supertest` (`npm run test:e2e`). ✅ 12 pruebas pasando contra Supabase. Ver [test/app.e2e-spec.ts](../backend/test/app.e2e-spec.ts). |
| **Integración** | Servicios contra una BD de prueba (rotación de tokens, aislamiento entre familias en profundidad). | Jest + Postgres de test (Testcontainers o BD efímera). |

> Nota: el e2e usa `testTimeout: 30000` porque, en desarrollo, cada consulta hace un round-trip a
> Supabase (us-east-1) y suma latencia. En producción el backend está junto a la base (<5 ms).
| **Apps** | Widgets y *controllers* (login, SOS hold 3 s, estados vacíos). | `flutter test`. |
| **Seguridad** | Rate limiting, fuerza bruta en login/pairing, intentos de acceso cruzado entre familias. | Pruebas dedicadas + revisión manual. |

Casos críticos a cubrir siempre:
- Un código de emparejamiento **no** puede canjearse dos veces (concurrencia).
- Un miembro de la familia A **no** puede leer datos de la familia B.
- Un `CHILD` **no** puede ver la ubicación de otro menor.
- El reuso de un refresh token revoca toda la cadena.

## 5. Estrategia de despliegue

1. **Entornos**: `dev` → `staging` → `prod`, cada uno con su base y secretos (gestor de secretos/KMS).
2. **Migraciones**: `npm run prisma:deploy` en el pipeline antes de arrancar la nueva versión.
3. **Contenedor**: imagen Node multi-stage; salud en `/api` (añadir endpoint `/health`).
4. **Escalado**: backend stateless tras balanceador; Redis para rate limit/colas; réplicas de
   lectura de Postgres para reportes; partición temporal de `locations`.
5. **CI/CD**: lint + test + build en cada PR; despliegue automatizado a staging; promoción manual a prod.
6. **Observabilidad**: logs estructurados, métricas (Prometheus), trazas (OpenTelemetry), alertas.
7. **Backups**: copias automáticas de Postgres y prueba periódica de restauración.

## 6. Antes de publicar en las tiendas

Ver [COMPLIANCE.md](COMPLIANCE.md) (checklist) y [PLATFORM-CAPABILITIES.md](PLATFORM-CAPABILITIES.md)
(entitlements de Apple, permisos de Android, requisitos anti-stalkerware).
