# Cumplimiento legal y de tiendas

ChildrenSafe trata datos personales de **menores**. Esto eleva el nivel de exigencia legal. Este
documento resume las obligaciones que el producto debe cumplir y cómo el diseño las respeta.
**No sustituye asesoría legal**: antes de lanzar en cualquier país, obtén revisión jurídica local.

---

## 1. Marcos legales principales

### COPPA (EE. UU. — menores de 13)
- **Consentimiento verificable del padre/madre** antes de recolectar datos de un menor de 13.
- **Minimización**: solo datos necesarios para la función de seguridad.
- **Derecho del tutor** a revisar, eliminar y revocar el consentimiento.
- **Prohibido** condicionar el uso a recolectar más datos de los necesarios.
- **Prohibido** la publicidad comportamental dirigida a menores.

### GDPR / GDPR-K (UE y EEE — menores, umbral 13–16 según país)
- Base legal clara (consentimiento del titular de la responsabilidad parental).
- **Privacidad por diseño y por defecto** (Art. 25).
- Derechos: acceso, rectificación, **supresión**, portabilidad, oposición.
- **Minimización** y limitación de finalidad y de plazo de conservación.
- Evaluación de impacto (DPIA) por tratar datos de menores y ubicación.

### Otros (diseñar para ser compatibles)
- **UK Age Appropriate Design Code (Children's Code)**.
- **LGPD** (Brasil), **LFPDPPP** (México), normativas locales de cada mercado de Fase 4.

## 2. Cómo el diseño cumple

| Obligación | Implementación en ChildrenSafe |
|-----------|--------------------------------|
| Consentimiento verificable | Cuenta de adulto autenticada (email/teléfono/MFA opcional) + pantalla de consentimiento explícita antes del emparejamiento. Registro auditable (`audit_logs`). |
| Transparencia con el menor | La app del menor es **visible**, explica qué se comparte y muestra un "registro de permisos otorgados". |
| Minimización | El esquema no guarda número de teléfono del menor salvo que sea imprescindible; sin identificadores publicitarios; ubicación con retención limitada. |
| Derecho de supresión | Endpoints de **exportación** y **eliminación de cuenta** con borrado en cascada y verificación. |
| Limitación de plazo | `location.recorded_at` con purga automática (job programado); retención configurable por familia. |
| Seguridad | Cifrado en tránsito/reposo, RBAC, auditoría, MFA opcional (ver SECURITY.md). |
| Portabilidad | Exportación de datos de la familia en formato JSON. |

## 3. Políticas de las tiendas

### Apple App Store
- **Guideline 5.1.1 / 5.1.2**: datos de menores y permisos requieren justificación y consentimiento.
- **Family Controls / Screen Time**: requiere el entitlement `com.apple.developer.family-controls`
  (se solicita a Apple con justificación del caso de uso). Sin él, no se publican esas funciones.
- **Location Always**: requiere descripción clara (`NSLocationAlwaysAndWhenInUseUsageDescription`)
  y revisión; Apple rechaza apps que piden ubicación de fondo sin justificación sólida.
- **Prohibido**: apps de vigilancia encubierta. La transparencia del menor es obligatoria.
- **Critical Alerts**: entitlement separado, se solicita a Apple para alertas SOS.

### Google Play
- **Política de datos del usuario** + **Data safety form** obligatorio y veraz.
- **Background location**: declaración y revisión específica; justificar la necesidad continua.
- **Política de apps de seguimiento (stalkerware)**: prohíbe rastrear personas sin su
  conocimiento. ChildrenSafe cumple porque la supervisión es **visible y consentida** y se
  limita a relación tutor–menor. La app del menor debe mostrar una notificación persistente
  cuando la ubicación esté activa (requisito anti-stalkerware).
- **Permisos sensibles** (`ACCESS_BACKGROUND_LOCATION`, `PACKAGE_USAGE_STATS`): declaración y
  flujo de concesión correcto.
- **Apps para niños / Designed for Families**: requisitos adicionales de contenido y privacidad.

## 4. Edad y verificación

- El **tutor** crea la cuenta (cuenta de adulto). El menor se vincula mediante emparejamiento.
- Se registra el **rango de edad** del menor (no necesariamente la fecha exacta) para aplicar
  perfiles por etapa (ver ROADMAP, configuración por edad).
- Para menores bajo el umbral local, se exige el flujo de consentimiento parental reforzado.

## 5. Documentos de cara al usuario (obligatorios antes de lanzar)

- **Política de privacidad** (clara, también en versión "para niños").
- **Términos de servicio**.
- **Aviso de uso responsable y buenas prácticas familiares** (ver ABUSE-PREVENTION.md).
- **Pantallas de consentimiento** dentro del onboarding.

## 6. Checklist previo a lanzamiento (resumen)

- [ ] Revisión legal por jurisdicción de lanzamiento.
- [ ] DPIA documentada (tratamiento de menores + ubicación).
- [ ] Política de privacidad y términos publicados y enlazados en la app.
- [ ] Data safety form (Play) y privacy nutrition labels (App Store) completados y veraces.
- [ ] Entitlements de Apple solicitados (Family Controls, Critical Alerts si aplica).
- [ ] Flujos de exportación y eliminación de cuenta probados.
- [ ] Retención y purga automática verificadas.
- [ ] Notificación persistente anti-stalkerware en Android verificada.
