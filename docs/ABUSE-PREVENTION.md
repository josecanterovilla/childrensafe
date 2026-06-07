# Prevención de abuso y uso responsable

ChildrenSafe es una herramienta de **protección entre tutor y menor**. No debe convertirse en
instrumento de acoso, control coercitivo, vigilancia de pareja ni invasión de privacidad. Este
documento define los límites del producto y los mecanismos para detectar y frenar el mal uso.

## 1. Límites de diseño que previenen el abuso

- **Supervisión siempre visible para el menor.** La app del menor no se puede ocultar y muestra
  qué se comparte y con quién. Esto impide el uso como *stalkerware*.
- **Solo relación tutor–menor.** El emparejamiento exige rol de menor; el producto no permite
  "rastrear" a un adulto. No hay modo de seguimiento entre adultos.
- **Sin lectura de mensajes ni grabaciones ocultas** (ver PLATFORM-CAPABILITIES.md).
- **Transparencia de permisos**: el menor ve, en su app, una lista clara de permisos otorgados y
  puede ver cuándo se accede a su ubicación.
- **Notificación persistente** en el dispositivo del menor mientras la ubicación está activa
  (también requisito anti-stalkerware de Google Play).

## 2. Señales de uso anómalo (a vigilar)

El backend marca y, según gravedad, limita o alerta cuando detecta patrones como:

| Señal | Posible riesgo | Respuesta |
|-------|----------------|-----------|
| Consultas de ubicación de altísima frecuencia | Vigilancia obsesiva | Throttling + aviso de uso responsable |
| Muchos intentos de emparejamiento fallidos | Fraude / fuerza bruta | Rate limit + bloqueo temporal + alerta |
| Cambios de reglas muy frecuentes o coercitivos | Control coercitivo | Registro en auditoría + recordatorio de buenas prácticas |
| Edad del "menor" incoherente / patrón de adulto | Uso indebido (rastrear adulto) | Revisión + posible suspensión |
| Geocercas excesivas o de tamaño mínimo sobre lugares sensibles | Acecho | Aviso + límites |

Estas señales alimentan el **panel administrativo** (soporte/abuso) y nunca exponen contenido
privado innecesario.

## 3. Controles visibles en la app

- **Centro de transparencia** para el menor (qué se comparte, historial de accesos).
- **Recordatorios educativos** que fomentan confianza, no miedo ("Tu familia puede ver tu
  ubicación para cuidarte. Puedes hablar con ellos si algo te incomoda.").
- **Canal de ayuda**: enlace a recursos de protección infantil y, donde exista, líneas de ayuda.

## 4. Guía de buenas prácticas familiares (incluida en la app)

1. **Habla con tu hijo** antes de activar la supervisión. El acuerdo construye confianza.
2. **Ajusta la supervisión a la edad**: menos intrusión a mayor edad.
3. **Revisa juntos** lo que se comparte; haz que sea una conversación, no un control secreto.
4. **Usa las alertas para cuidar, no para castigar.**
5. **Reduce permisos** a medida que el adolescente demuestra autonomía.

## 5. Gobernanza

- Política clara de uso aceptable en los Términos.
- Mecanismo para que un menor reporte uso indebido a soporte.
- Procedimiento interno de revisión de cuentas marcadas, con registro auditable.
