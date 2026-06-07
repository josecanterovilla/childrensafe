# Configurar "Entrar con Google"

El código ya está listo (backend `/api/auth/google` verificado con 4 pruebas, y el botón en la app del
tutor). Falta **crear las credenciales OAuth en Google Cloud** — esto solo lo puedes hacer tú, con tu
cuenta. Sigue estos pasos (10–15 min).

> Solo el **tutor** usa Google. El **menor** nunca inicia con Google: se vincula con el código de
> emparejamiento. No pidas cuentas de Google a menores.

## Datos de tu proyecto (ya calculados)
- **applicationId (package) de la app tutor:** `app.childrensafe.childrensafe_parent`
- **SHA-1 (debug) de tu máquina:** `3F:40:51:54:CD:72:A9:BB:C3:00:C4:6B:FF:DC:13:25:22:7C:D9:6B`
  - Para publicar en Play necesitarás también el SHA-1 de la **clave de release** (cuando firmes).

## 1. Crear proyecto y pantalla de consentimiento
1. Entra a https://console.cloud.google.com/ → crea un proyecto (p. ej. "ChildrenSafe").
2. Menú → **APIs y servicios → Pantalla de consentimiento de OAuth**.
   - Tipo de usuario: **Externo** → Crear.
   - Completa nombre de la app, correo de soporte y de contacto.
   - En **Usuarios de prueba**, añade tu propio correo de Gmail (mientras esté en modo "Testing",
     solo esos usuarios podrán entrar).

## 2. Crear los Client ID OAuth
Menú → **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.

### a) Aplicación **Web** (la usa el backend para verificar el token)
- Tipo: **Aplicación web** → nombre: "ChildrenSafe backend".
- No necesitas URIs de redirección para verificar ID tokens.
- **Copia el "ID de cliente"** → este valor es:
  - `GOOGLE_CLIENT_ID` en `backend/.env`
  - `GOOGLE_SERVER_CLIENT_ID` al compilar la app (paso 4).

### b) **Android** (autoriza a tu app a pedir el token)
- Tipo: **Android** → nombre: "ChildrenSafe Android (tutor)".
- **Nombre del paquete:** `app.childrensafe.childrensafe_parent`
- **Huella SHA-1:** `3F:40:51:54:CD:72:A9:BB:C3:00:C4:6B:FF:DC:13:25:22:7C:D9:6B`

> (Opcional, futuro) Para iOS crearás un Client ID de tipo iOS con tu Bundle ID, en un Mac.

## 3. Configurar el backend
En `backend/.env` pon el **Client ID Web** del paso 2a:
```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```
y reinicia el backend (`npm run start:dev`).

## 4. Recompilar la app con el Client ID Web
```powershell
cd "C:\Users\ingec\OneDrive - BYU-Pathway Worldwide\PROJECTS\childrensafe\apps\parent"
flutter build apk --debug `
  --dart-define=API_BASE_URL=http://10.114.18.49:3000/api `
  --dart-define=GOOGLE_SERVER_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```
Instala el nuevo APK en tu teléfono y pulsa **"Continuar con Google"**.

## Cómo funciona (resumen técnico)
1. La app abre el selector de cuentas de Google y obtiene un **ID token** (audiencia = tu Client ID Web).
2. La app envía ese token a `POST /api/auth/google`.
3. El backend lo **verifica** contra las claves públicas de Google (`google-auth-library`), exige
   `email_verified`, y entonces **crea el tutor + su familia** (o enlaza/inicia si ya existía).
4. El backend devuelve los **tokens propios de ChildrenSafe** (JWT) como en el login normal.

## Problemas comunes
- **No vuelve idToken / `ApiException 401`**: falta `GOOGLE_SERVER_CLIENT_ID` al compilar, o el SHA-1
  / package no coinciden con el Client ID Android.
- **`Token de Google inválido`**: el `GOOGLE_CLIENT_ID` del backend no es el mismo Client ID **Web**
  usado como `serverClientId` en la app.
- **`acceso bloqueado` / app no verificada**: añade tu correo como **usuario de prueba** en la
  pantalla de consentimiento (o publica la app).
