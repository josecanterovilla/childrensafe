# ChildrenSafe

**Plataforma de seguridad familiar transparente, ética y legal** para Android e iOS.
ChildrenSafe ayuda a madres, padres y tutores a proteger a niños y adolescentes frente a
riesgos reales (personas peligrosas, rutas inseguras, emergencias, contenido inapropiado),
**con el conocimiento del menor** y nunca como software de vigilancia oculta.

> Principio rector: **protección y acompañamiento, no espionaje.** Si una función solo puede
> implementarse de forma oculta, frágil o contraria a las políticas de la tienda o a la ley,
> **no se implementa**: se documenta y se propone una alternativa aprobada.

---

## 1. Estructura del repositorio (monorepo)

```
childrensafe/
├── backend/                 # API NestJS (Node + TypeScript + Prisma + PostgreSQL)
│   ├── prisma/              # Esquema y migraciones de base de datos
│   └── src/
│       ├── modules/         # auth, users, families, devices, pairing, location,
│       │                    # geofences, alerts, sos, notifications, audit
│       ├── common/          # guards, interceptors, decorators, filtros de error
│       └── config/          # configuración tipada y validada por entorno
├── apps/
│   ├── parent/              # App Flutter del tutor (padre/madre/tutor)
│   ├── child/               # App Flutter del menor
│   └── shared/              # Paquete Dart compartido (modelos, API client, design system)
├── docs/                    # Arquitectura, modelo de datos, API, seguridad, cumplimiento
│   ├── ARCHITECTURE.md
│   ├── DATA-MODEL.md
│   ├── API.md
│   ├── SECURITY.md
│   ├── COMPLIANCE.md            # COPPA, GDPR-K y políticas de tienda
│   ├── PLATFORM-CAPABILITIES.md # Qué SÍ y qué NO permite cada plataforma
│   ├── ABUSE-PREVENTION.md      # Anti-acoso / uso responsable
│   └── ROADMAP.md               # Plan por fases
└── infra/                   # docker-compose, despliegue, observabilidad
```

## 2. Stack técnico (recomendado y justificado)

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Apps móviles | **Flutter (Dart)** | Una base de código para Android e iOS, rendimiento casi nativo, menor costo de mantenimiento. Para tiempo de pantalla se usan canales nativos hacia las APIs oficiales. |
| Backend | **NestJS (Node + TypeScript)** | Arquitectura modular, inyección de dependencias, DTOs validados, separación clara lógica/transporte. |
| Base de datos | **PostgreSQL** | Relacional, transaccional, soporta PostGIS para geocercas. |
| Cache / colas | **Redis + BullMQ** | Rate limiting, sesiones, colas de eventos y notificaciones asíncronas. |
| Tiempo real | **WebSocket (Socket.IO) / push** | Ubicación y alertas casi en tiempo real con tolerancia a desconexión. |
| Notificaciones | **FCM (Android) + APNs (iOS)** | Vías push oficiales de cada plataforma. |
| Tiempo de pantalla iOS | **FamilyControls / ManagedSettings / DeviceActivity** | Única vía aprobada por Apple (requiere entitlement). |
| Tiempo de pantalla Android | **Google Family Link / Digital Wellbeing / DevicePolicyManager** | Vías aprobadas por Google. |

> **Importante sobre el entorno actual:** en esta máquina hay Node y Git, pero **no** Flutter/Dart
> ni Docker. Por eso el backend se entrega **ejecutable hoy** y las apps Flutter se entregan
> como **scaffold** listo para `flutter pub get` cuando instales el SDK.

## 3. Principios de privacidad por diseño

- **Minimización de datos:** se recolecta solo lo estrictamente necesario para proteger al menor.
- **Sin venta de datos. Sin identificadores publicitarios del menor. Sin grabaciones ocultas.**
- **Transparencia total para el menor:** la app del hijo nunca oculta su existencia ni su función.
- **Consentimiento explícito y verificable del tutor** antes de cualquier vínculo.
- **Retención limitada** con borrado automático (p. ej. trayectos recientes a 24–72 h por defecto).
- **Cifrado en tránsito (TLS 1.3) y en reposo (AES-256).**
- **Auditoría** de toda acción sensible, visible para el tutor y el menor.

## 4. Cómo empezar (backend)

```bash
cd backend
cp .env.example .env        # ajusta secretos y la URL de PostgreSQL
npm install
npm run prisma:generate
npm run prisma:migrate      # requiere una base PostgreSQL accesible
npm run start:dev           # API en http://localhost:3000  (Swagger en /docs)
```

Sin Docker/PostgreSQL local puedes usar una base PostgreSQL gestionada gratuita
(Neon, Supabase, Railway) y poner su URL en `DATABASE_URL`.

## 5. Plan por fases

Ver [docs/ROADMAP.md](docs/ROADMAP.md).

1. **Fase 1** — Cuentas, familias, emparejamiento seguro, ubicación básica, alertas básicas, panel del padre.
2. **Fase 2** — Tiempo de pantalla, horarios, geocercas avanzadas, comunicación segura, reportes.
3. **Fase 3** — Detección de riesgos por reglas, automatizaciones, analítica agregada.
4. **Fase 4** — Internacionalización, cumplimiento regional, monetización.

## 6. Documentación clave

- **Qué permite cada plataforma:** [docs/PLATFORM-CAPABILITIES.md](docs/PLATFORM-CAPABILITIES.md)
- **Cumplimiento legal y de tiendas:** [docs/COMPLIANCE.md](docs/COMPLIANCE.md)
- **Prevención de abuso / uso responsable:** [docs/ABUSE-PREVENTION.md](docs/ABUSE-PREVENTION.md)
- **Arquitectura:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Modelo de datos:** [docs/DATA-MODEL.md](docs/DATA-MODEL.md)
- **Seguridad:** [docs/SECURITY.md](docs/SECURITY.md)

## 7. Licencia y estado

Proyecto en construcción. Base de Fase 1 en desarrollo activo. Este software trata datos de
menores: **no lo despliegues en producción sin una revisión legal y de seguridad formal** en
cada jurisdicción donde operes.
