# Plan de implementación por fases

Cada fase es entregable y aporta valor por sí sola. La arquitectura no cambia entre fases; se
añaden módulos.

## Fase 1 — Núcleo de seguridad (MVP)
**Meta:** una familia puede vincularse, ver ubicación y recibir alertas básicas.

- Cuentas de tutor (registro/login/refresh, recuperación de cuenta).
- Familias, miembros y roles (PARENT/GUARDIAN/CHILD).
- **Emparejamiento seguro** (código único temporal de un solo uso + QR, confirmación en ambos
  dispositivos, revocación, historial de dispositivos).
- Registro de dispositivos y estado (batería, última conexión).
- **Ubicación** por intervalos + última ubicación + historial con retención limitada.
- **Geocercas básicas** (entrada/salida) y **botón SOS** + "llegué bien".
- **Alertas básicas** (salida de perímetro, batería baja, permiso de ubicación desactivado).
- Panel del tutor: dashboard, mapa, lista de alertas.
- Notificaciones push (FCM/APNs).
- Auditoría, consentimiento, exportación y eliminación de cuenta.

> Estado: **backend en construcción en este repositorio.**

## Fase 2 — Bienestar digital y comunicación
- **Tiempo de pantalla**: integración con iOS Screen Time (FamilyControls) y Android Family
  Link/Usage Access. Reportes de uso resumidos.
- Horarios de descanso y límites por categoría (vía frameworks oficiales).
- **Geocercas avanzadas** (múltiples, horarios, prioridades por límite de iOS).
- **Comunicación segura**: contactos confiables, aprobación de nuevos contactos, emergencia.
- Reportes diario/semanal/mensual descargables.

## Fase 3 — Inteligencia y automatización
- **Motor de reglas** ampliado y alertas contextuales (p. ej. "salió del colegio antes de hora").
- Detección de comportamiento inusual (configurable por reglas, sin perfilar de más).
- Modos: **escuela**, **viaje**, **vacaciones**; compartir ubicación temporal.
- Analítica **agregada** y anonimizada para mejorar el producto (sin vender datos).
- Historial de incidentes.

## Fase 4 — Escala internacional y negocio
- **Localización** (i18n) y **cumplimiento regional** por país.
- Planes de suscripción (Gratuito / Premium / Family Plus) y facturación.
- Soporte, retención, centro de ayuda, integración opcional con servicios de asistencia.
- Hardening de escalabilidad (réplicas, particionado, CDN, observabilidad completa).

## Modelo de suscripción (Fase 4)

| Plan | Incluye |
|------|---------|
| **Gratuito** | 1 menor, 1 tutor, SOS, ubicación básica |
| **Premium** | Varios menores, historial extendido, geocercas avanzadas, reglas, reportes |
| **Family Plus** | Familias grandes, varios tutores, funciones avanzadas, soporte prioritario |
