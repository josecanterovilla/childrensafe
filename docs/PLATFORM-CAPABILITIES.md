# Capacidades por plataforma: qué SÍ y qué NO se puede hacer

Este documento es la fuente de verdad sobre **qué funciones son técnica y legalmente
posibles** mediante APIs oficiales. Toda la app se diseña alrededor de estos límites. No se
prometen funciones imposibles ni se inventan APIs.

Leyenda: ✅ posible con API oficial · ⚠️ posible con condiciones/entitlements · ❌ no posible
de forma aprobada (evitar; sería *stalkerware* o causa de rechazo en la tienda).

---

## 1. Ubicación

| Función | iOS | Android | Notas |
|--------|-----|---------|-------|
| Ubicación en tiempo real / por intervalos | ✅ | ✅ | iOS: `CoreLocation` con `Always` requiere justificación y revisión de App Store. Android: `ACCESS_BACKGROUND_LOCATION` requiere flujo de permiso separado y justificación en Play Console. |
| Geocercas (entrada/salida) | ✅ `CLRegion` (máx. 20 regiones monitorizadas/app) | ✅ `GeofencingClient` (máx. 100/app) | El límite de iOS (20) obliga a priorizar geocercas activas en el cliente. |
| Trayecto/historial | ✅ | ✅ | Recolectar con **retención limitada** y consentimiento visible. |
| Ubicación en segundo plano continua de alta frecuencia | ⚠️ | ⚠️ | El SO puede limitar la frecuencia para ahorrar batería. No se puede garantizar 1 fix/seg en background. Diseñar con intervalos adaptativos + `significant-change`. |

**Implicación de diseño:** la ubicación se envía por **intervalos adaptativos** (más espaciados
con batería baja) y por **eventos** (cruce de geocerca, SOS), no como streaming continuo.

## 2. Tiempo de pantalla, límites de apps y bloqueo de contenido

Esta es el área con más malentendidos. **No existe forma aprobada de que una app de terceros
lea, controle o blosquee libremente otras apps.** Solo a través de los frameworks oficiales:

### iOS — `Screen Time API` (familia FamilyControls)
| Capacidad | Estado | Detalle |
|-----------|--------|---------|
| Límites de tiempo por categoría/app | ✅ con entitlement | Frameworks `FamilyControls`, `ManagedSettings`, `DeviceActivity`. |
| Bloqueo de apps / sitios | ⚠️ | Se "ocultan/escudan" apps y se filtran categorías web. **No** se obtiene la lista de mensajes ni el contenido. |
| Requisito | ⚠️ **Entitlement especial** | Hay que solicitar a Apple `com.apple.developer.family-controls`. Sin él, estas APIs no funcionan en producción. La selección de apps la hace el usuario vía `FamilyActivityPicker` (Apple no entrega identificadores de apps a tu servidor; los tokens son opacos y locales). |
| Datos que recibe tu backend | Mínimos | Por diseño de Apple, los nombres/identificadores de apps **no salen del dispositivo**. Solo manejas tokens opacos y agregados de uso. |

### Android — controles parentales
| Capacidad | Estado | Detalle |
|-----------|--------|---------|
| Límites y supervisión "de fábrica" | ✅ vía **Google Family Link** | Integración/derivación a Family Link para cuentas de menores de 13 (o edad local). |
| Tiempo de uso por app | ⚠️ `UsageStatsManager` | Requiere permiso especial `PACKAGE_USAGE_STATS` que el usuario concede en Ajustes; da estadísticas de uso, **no** bloqueo. |
| Bloqueo real de apps | ⚠️ **Device Policy Controller (Android Management API)** | Control fuerte solo si el dispositivo se inscribe como gestionado (perfil/propietario). Es intrusivo; reservar para casos claros y con consentimiento. |
| Filtrado web | ⚠️ | Vía navegador propio dentro de la app o DNS/VPN local con consentimiento. No se puede filtrar Chrome de terceros sin gestión del dispositivo. |

**Implicación de diseño:** "Control de tiempo de pantalla / bloqueo" se entrega como **integración
con los frameworks oficiales** (iOS Screen Time, Android Family Link/Management). En el MVP se
implementa la **capa de reglas y reportes**; la aplicación efectiva del bloqueo se delega a la
plataforma. Esto se comunica con claridad al tutor en la propia app.

## 3. Lo que NO haremos (deliberadamente)

| Petición común | Por qué NO |
|----------------|-----------|
| Leer mensajes de WhatsApp/Instagram/SMS de otras apps | ❌ Imposible vía API oficial y es *stalkerware*. Rechazo seguro de la tienda y posible ilegalidad. |
| Grabar micrófono/cámara en oculto | ❌ Vigilancia encubierta. Prohibido por políticas y ética del producto. |
| Ocultar el ícono de la app del menor | ❌ Contra políticas de Apple/Google y contra el principio de transparencia. La app del menor **siempre es visible**. |
| Keylogging / capturas de pantalla automáticas | ❌ No permitido. |
| Localizar a alguien sin su consentimiento | ❌ Requiere consentimiento del tutor y conocimiento del menor (modelo de "supervisión visible"). |

## 4. Comunicación segura (rediseño honesto)

Como no podemos (ni debemos) leer apps de terceros, "comunicación segura" se implementa como:
- **Libreta de contactos confiables** dentro de ChildrenSafe (aprobados por el tutor).
- **Solicitud de aprobación** del tutor para añadir un contacto nuevo.
- **Botón de emergencia** que contacta a un adulto de confianza (llamada/SMS nativos del sistema).
- **Registro visible** de qué se comparte y con quién.

No se interceptan ni se leen conversaciones de otras plataformas.

## 5. Notificaciones push

| Plataforma | Servicio | Notas |
|-----------|----------|-------|
| Android | **FCM** | Estándar; tokens rotables por dispositivo. |
| iOS | **APNs** | Requiere certificados/keys; entrega "best-effort", no garantizada en tiempo real. |
| Alertas críticas (SOS) | ⚠️ | iOS ofrece `Critical Alerts` y `Time Sensitive` pero **Critical Alerts requiere entitlement** de Apple. Diseñar SOS con redundancia (push + intento de SMS/llamada desde el dispositivo del menor). |

## 6. Resumen de permisos solicitados (y su justificación visible en la app)

| Permiso | Plataforma | Por qué se pide | Cuándo se pide |
|---------|-----------|-----------------|----------------|
| Ubicación (always/background) | iOS/Android | Mostrar ubicación y geocercas de seguridad | Onboarding del menor, con pantalla explicativa |
| Notificaciones | iOS/Android | Alertas de seguridad y SOS | Onboarding |
| Bluetooth/Cámara (QR) | iOS/Android | Escanear el código de emparejamiento | Solo durante el emparejamiento |
| Screen Time / FamilyControls | iOS | Reportes y límites de uso | Solo si el tutor activa la función |
| Usage Access / Family Link | Android | Reportes de uso | Solo si el tutor activa la función |
| Contactos | iOS/Android | (Opcional) elegir contactos confiables | Solo si el tutor lo activa |

> Regla de oro: **cada permiso se pide en contexto, con una explicación humana de por qué se
> necesita, y la app funciona de forma degradada y honesta si se deniega** (mostrando qué deja
> de estar disponible, sin insistir de forma coercitiva).
