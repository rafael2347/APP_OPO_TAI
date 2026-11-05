# OpoTAI

App móvil para preparar el test de la oposición **Técnico Auxiliar de Informática (TAI)** de la Administración del Estado. Hecha con React Native y Expo.

El progreso se guarda **solo en el móvil** de cada usuario: nadie ve lo que haces tú ni al revés.

## Funciones

- **Tests configurables:** aleatorio, por tema, preguntas falladas, peor ratio de acierto, las que menos han salido y las marcadas como importantes.
- **Modo estudio:** corrige al responder y muestra la explicación si la pregunta la tiene.
- **Contrarreloj:** tests de 5, 10 y 20 minutos.
- **Simulacro:** hasta 80 preguntas en 120 minutos, navegación libre, marcar dudosas y nota con penalización de 1/3. Al final enseña la nota que habrías sacado dejando las dudosas en blanco.
- **Flashcards:** método Leitner con 5 cajas (botones "Fallé" y "Acerté").
- **Marcas por pregunta:** importante y aprendida (las aprendidas no vuelven a salir).
- **Estadísticas:** acierto global, por tema e historial de tests.
- **Retos:** objetivos semanal y mensual, insignias y récords locales.

No incluye: supuestos prácticos, material de estudio, chuletas ni clasificación online (haría falta un servidor).

## Estructura

```
OpoTai/
├── App.js                  Toda la interfaz y la lógica
├── app.json                Configuración de Expo (nombre, icono, splash, paquete)
├── eas.json                Perfiles de compilación (preview = APK, production = AAB)
├── assets/IconTai.png      Icono (1024x1024, sin transparencia)
├── scripts/import-inap.js  Importador de exámenes oficiales
└── src/
    ├── data/questions.json Banco de preguntas
    ├── store.js            Guardado local (AsyncStorage)
    └── theme.js            Colores
```

## Arrancar en desarrollo

```bash
cd ~/Proyects/OpoTai
npm install
npx expo install @react-native-async-storage/async-storage @expo/vector-icons expo-splash-screen
npx expo start -c
```

Escanea el QR con Expo Go (móvil y Mac en la misma wifi). Si no conecta: `npx expo start --tunnel`.

Si `npx` da un error de permisos de la caché de npm:

```bash
sudo chown -R 501:20 "$HOME/.npm"
```

## Banco de preguntas

Está en `src/data/questions.json`. Cada pregunta tiene este formato:

```json
{"id":"2024-LI-A-1","tema":"Examen 2024-LI-A","q":"Enunciado","o":["a","b","c","d"],"c":1,"e":"Explicación (puede ir vacía)"}
```

`c` es el índice (0 a 3) de la opción correcta.

Contenido actual: **297 preguntas**.

| Tema | Preguntas |
|---|---|
| Preguntas de ejemplo (propias) | 24 |
| Examen 2019-LI (TAI libre, OEP 2019) | 80 |
| Examen OEP2022-LI (TAI libre, OEP 2022) | 76 |
| Examen 2024-LI-A (TAI libre, OEP 2023-2024, modelo A) | 77 |
| Examen 2025-HELLIN (Ayuntamiento de Hellín) | 40 |

Las preguntas anuladas por el tribunal no se importan. El modelo B de 2024 no se añadió porque son las mismas preguntas del A en otro orden.

### Importar un examen nuevo

Hace falta el cuestionario y la plantilla de respuestas en PDF (sede electrónica del INAP, Cuerpo TAI, ejercicios de convocatorias anteriores).

```bash
brew install poppler                       # una sola vez
pdftotext -layout cuestionario.pdf examen.txt
pdftotext plantilla.pdf plantilla.txt      # la plantilla SIN -layout
node scripts/import-inap.js examen.txt plantilla.txt "2025-LI"
```

- El último argumento es la etiqueta: pasa a ser el tema y el prefijo de los `id`.
- Importa solo la **primera parte** (las 80 preguntas de test). No importa supuestos ni reservas.
- Salta las preguntas ANULADAS y las que ya existen en el banco (aunque vengan en otro orden). Avisa si una repetida tiene otra respuesta correcta.
- Si imprime "No importadas", revisa esos números a mano.

Tras cambiar el banco hay que recargar la app; en una app instalada, volver a compilarla.

## Datos del usuario

Se guardan en el almacenamiento del móvil (AsyncStorage, clave `tai-app-v1`): respuestas, estadísticas, marcas y cajas de flashcards. Si se desinstala la app, se pierden.

## Compilar

Identificador de la app: `com.myapp.taiapp` (Android e iOS). Nombre: OpoTAI.

### Android, para instalar en tu móvil (APK)

```bash
npx eas-cli login
npx eas-cli build --platform android --profile preview
```

Abre el enlace que da EAS en el móvil, descarga el `.apk` e instálalo (hay que permitir orígenes desconocidos).

### Android, para Google Play (AAB)

```bash
npx eas-cli build --platform android --profile production
```

Notas importantes:

- La clave de firma la gestiona EAS. **Descarga una copia** con `npx eas-cli credentials --platform android` > production > Keystore > Download existing keystore. Guarda el `.jks` y sus contraseñas fuera de git (el `.gitignore` ya ignora `*.jks`).
- Si Play dice que el bundle está firmado con otra clave, hay que solicitar el **restablecimiento de la clave de subida** en Play Console (Configuración > Integridad de la app > Firma de la app) y subir el certificado `.pem` de la clave de EAS. Se exporta con:
  ```bash
  keytool -export -rfc -keystore "ARCHIVO.jks" -alias ALIAS -file upload_certificate.pem
  ```
- Google da una hora a partir de la cual se puede volver a subir. **Está en UTC** (España es UTC+1 en invierno).

### iPhone, sin cuenta de pago (caduca a los 7 días)

Con el iPhone conectado, desbloqueado y con el Modo desarrollador activo:

```bash
npx expo run:ios --device --configuration Release
```

`--configuration Release` hace que la app lleve el código dentro y funcione sin el Mac. Después, en el iPhone: Ajustes > General > VPN y gestión de dispositivos > tu Apple ID > Confiar.

A los 7 días deja de abrir; hay que repetir el comando.

Si Xcode se queja de la firma: `open ios/*.xcworkspace`, proyecto `tai` > Signing & Capabilities > Team = tu Apple ID.

### iPhone, TestFlight o App Store

Requiere cuenta de Apple Developer (99 $/año):

```bash
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios
```

## Problemas conocidos

| Síntoma | Causa y solución |
|---|---|
| `No script URL provided` en el iPhone | Se instaló una versión Debug. Reinstala con `--configuration Release`. |
| `Build input file cannot be found ... ReactCodegen` | Se borró `ios/build`. No lo borres a mano. Arregla con `rm -rf ios`, luego `npx expo prebuild --clean --platform ios`. |
| `ConfigError: ... package.json does not exist` | Estás dentro de `assets/`. Sube a la carpeta del proyecto. |
| `Unable to resolve module @expo/vector-icons` | `npx expo install @expo/vector-icons` y `npx expo start -c`. |
| No sale la splash nativa | En Expo Go no se ve. Hay que compilar la app (`run:ios` o `run:android`). La app tiene además una pantalla de bienvenida propia con el icono. |
| Mayúsculas en el icono | `IconTai.png` debe coincidir letra por letra en `app.json`, en `App.js` y en el disco. |



