# Instalación de Flutter en Windows (para ejecutar las apps)

> En **Windows** puedes compilar y ejecutar las apps **Android** (y web/desktop). Las apps **iOS
> requieren un Mac con Xcode** — eso queda para cuando tengas un Mac; el producto se valida igual
> con la versión Android.

## Lo que ya tienes (verificado)
- winget ✅ · choco ✅ · git ✅ · ~134 GB libres ✅
- Java 26 instalado — **no lo usaremos para Android** (es muy nuevo para Gradle). Flutter usará el
  JDK que trae Android Studio. No hace falta que toques tu Java.

## Carril A — SDK de Flutter (lo instala Claude por `git clone`, sin admin)
Queda en `C:\Users\ingec\flutter`. Sirve para `flutter pub get`, `flutter analyze` y `flutter build`.
Para que quede en tu PATH permanentemente (y puedas usar `flutter` en cualquier terminal):

1. Menú Inicio → "Editar las variables de entorno del sistema" → **Variables de entorno**.
2. En *Variables de usuario* → selecciona **Path** → **Editar** → **Nuevo** →
   `C:\Users\ingec\flutter\bin` → Aceptar todo.
3. Abre una **terminal nueva** y comprueba: `flutter --version`.

## Carril B — Android Studio (lo instalas tú; da el SDK de Android y el emulador)

Abre **PowerShell como Administrador** (clic derecho → *Ejecutar como administrador*) y:

```powershell
winget install -e --id Google.AndroidStudio
```
(o `choco install androidstudio -y`)

Luego:
1. Abre **Android Studio** una vez. En el asistente, deja que instale el **Android SDK**,
   **Android SDK Platform-Tools** y un **Android Virtual Device (emulador)**.
2. En una terminal nueva, ejecuta:
   ```powershell
   flutter doctor
   ```
   Te dirá qué falta. Lo normal tras instalar Android Studio es que solo falte aceptar licencias:
   ```powershell
   flutter doctor --android-licenses
   ```
   Pulsa `y` en todas.
3. Si `flutter doctor` se queja del **JDK/Gradle** (por tu Java 26), apúntalo al JDK de Android Studio:
   ```powershell
   flutter config --jdk-dir "C:\Program Files\Android\Android Studio\jbr"
   ```

### Probar en un dispositivo
- **Emulador**: Android Studio → *Device Manager* → crea/inicia un dispositivo virtual.
- **Tu teléfono Android** (más simple): Ajustes → *Acerca del teléfono* → toca 7 veces *Número de
  compilación* para activar *Opciones de desarrollador* → activa **Depuración por USB** → conéctalo
  por USB y acepta el aviso. Verifica con `flutter devices`.

## Ejecutar las apps (cuando A y B estén listos)
```powershell
# Genera las carpetas nativas (una vez por app)
cd "C:\Users\ingec\OneDrive - BYU-Pathway Worldwide\PROJECTS\childrensafe\apps\parent"
flutter create . --org app.childrensafe --project-name childrensafe_parent
flutter pub get

# El backend debe estar corriendo (npm run start:dev). En emulador Android, 10.0.2.2 = tu PC:
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
# En teléfono físico por USB, usa la IP de tu PC en la red local, p. ej.:
# flutter run --dart-define=API_BASE_URL=http://192.168.1.50:3000/api
```
Lo mismo para `apps\child`.

## ¿Qué hará Claude por ti?
En cuanto el SDK termine de clonar, Claude ejecuta `flutter pub get` y `flutter analyze` sobre
`apps/shared`, `apps/parent` y `apps/child` para **verificar que el código Dart compila** y corregir
lo que haga falta — así, cuando instales Android Studio, solo tendrás que `flutter run`.
