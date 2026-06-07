# Apps móviles (Flutter)

Dos apps que comparten un paquete común:

- **`parent/`** — app del tutor (padre/madre/tutor). Mapa, alertas, reglas, configuración.
- **`child/`** — app del menor. Estado seguro, botón SOS, "mis lugares", permisos visibles.
- **`shared/`** — paquete Dart compartido: cliente de API, modelos, almacenamiento seguro de
  tokens y *design system*. Mantiene la **lógica separada de la interfaz**.

## Por qué dos apps

La experiencia del tutor y la del menor son muy distintas (la del menor es simple, transparente
y no intimidante). Separarlas evita exponer controles de tutor en el dispositivo del menor y
permite políticas de tienda específicas (la app del menor debe cumplir requisitos extra).

## Estado de este scaffold

En esta máquina **no hay Flutter/Dart instalados**, por lo que aquí se entrega la **estructura y
los archivos clave** (no las carpetas nativas `android/` e `ios/`, que genera Flutter).

### Bootstrap cuando instales Flutter

```bash
# 1) Instala Flutter (https://docs.flutter.dev/get-started/install) y verifica
flutter --version

# 2) Genera las carpetas nativas dentro de cada app (sin sobreescribir el código de lib/)
cd apps/parent && flutter create . --org app.childrensafe --project-name childrensafe_parent
cd ../child  && flutter create . --org app.childrensafe --project-name childrensafe_child

# 3) Dependencias
cd ../parent && flutter pub get
cd ../child  && flutter pub get

# 4) Ejecuta (con el backend corriendo y la URL en --dart-define)
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api
```

> En el emulador de Android, `10.0.2.2` apunta al `localhost` de tu PC. En iOS Simulator usa
> `http://localhost:3000/api`.

## Arquitectura interna de cada app

```
lib/
├── main.dart                 # arranque + configuración (API_BASE_URL)
├── src/
│   ├── app.dart              # MaterialApp + router + tema
│   ├── router.dart           # rutas (go_router)
│   ├── state/                # providers (Riverpod): sesión, datos — LÓGICA
│   └── features/
│       ├── auth/             # pantallas + controladores
│       ├── dashboard/        # (parent) panel
│       ├── map/              # (parent) mapa familiar
│       ├── alerts/           # (parent) alertas
│       ├── home/             # (child) inicio + SOS
│       └── places/           # (child) mis lugares
```

Principio: los **widgets** solo renderizan estado y emiten intención; la **lógica** vive en los
*controllers/providers* y en el paquete `shared` (cliente de API, modelos). Así se cumple el
requisito de separar lógica de negocio e interfaz.

## Permisos (se piden en contexto, con explicación)

Ver [../docs/PLATFORM-CAPABILITIES.md](../docs/PLATFORM-CAPABILITIES.md). Cada permiso se
solicita con una pantalla previa que explica **por qué** se necesita y qué pasa si se deniega.
