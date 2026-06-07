# Arquitectura

## Visión general

```
┌────────────────────┐        ┌────────────────────┐
│  App Tutor (Flutter)│        │  App Menor (Flutter)│
│  parent             │        │  child              │
└─────────┬──────────┘        └──────────┬─────────┘
          │  HTTPS (TLS 1.3) / WebSocket  │
          ▼                               ▼
        ┌───────────────────────────────────────┐
        │           API NestJS (backend)         │
        │  Auth · Families · Pairing · Devices   │
        │  Location · Geofences · Alerts · SOS    │
        │  Notifications · Audit · Rules engine   │
        └───────┬───────────────┬────────────────┘
                │               │
        ┌───────▼──────┐ ┌──────▼───────┐ ┌──────────────┐
        │ PostgreSQL   │ │ Redis +      │ │ FCM / APNs   │
        │ (+ PostGIS)  │ │ BullMQ colas │ │ push         │
        └──────────────┘ └──────────────┘ └──────────────┘
```

## Principios

1. **Lógica separada de la interfaz.** El backend concentra reglas de negocio; las apps son
   clientes "tontos" que renderizan estado y capturan intención. En Flutter, la lógica de
   presentación vive en *controllers/blocs*, separada de los *widgets*.
2. **Modularidad (NestJS).** Cada dominio es un módulo con su controlador, servicio y DTOs.
   Las dependencias entre módulos son explícitas y mínimas.
3. **Seguridad por defecto.** Validación de entrada en todos los endpoints (DTO + `class-validator`),
   guards de autenticación y rol, rate limiting, auditoría de acciones críticas.
4. **Tolerancia a desconexión.** Las apps encolan eventos localmente (ubicación, SOS) y
   sincronizan al recuperar red; el backend es idempotente ante reenvíos (claves de idempotencia).
5. **Tiempo real con degradación.** WebSocket para actualizaciones en vivo; si falla, *polling*
   con backoff y push como respaldo.

## Capas del backend (por petición)

```
HTTP/WS ─▶ Guard(JWT) ─▶ Guard(Roles) ─▶ ValidationPipe(DTO)
        ─▶ Controller ─▶ Service (lógica) ─▶ Prisma (datos)
        ─▶ AuditInterceptor (registra acción crítica)
        ─▶ Exception filter (errores uniformes)
```

## Tiempo real y colas

- **Eventos de dominio** (cruce de geocerca, SOS, batería baja, permiso desactivado) se publican
  a una cola Redis/BullMQ.
- El **motor de reglas** consume eventos y decide alertas/notificaciones.
- El **servicio de notificaciones** entrega push (FCM/APNs) y persiste la alerta.

## Idempotencia y offline

- Cada evento del cliente lleva un `client_event_id` (UUID). El backend deduplica por
  `(device_id, client_event_id)` para que los reenvíos tras reconexión no dupliquen.
- Las apps mantienen una cola local persistente (SQLite/Hive) de eventos pendientes.

## Multi-tenant lógico

- La unidad de aislamiento es la **familia**. Todo recurso pertenece a una `family_id` y el
  acceso se filtra siempre por la membresía del usuario en esa familia (defensa en profundidad:
  el guard de rol valida pertenencia, y las consultas Prisma filtran por `family_id`).

## Escalabilidad

- Backend **stateless** detrás de un balanceador; sesión en JWT + Redis para revocación.
- PostgreSQL con réplicas de lectura para reportes; particionado de `locations` por tiempo.
- Colas para desacoplar picos (p. ej. muchas actualizaciones de ubicación simultáneas).
- Observabilidad: logs estructurados, métricas (Prometheus) y trazas (OpenTelemetry).
