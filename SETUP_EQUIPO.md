# Guía para el equipo — API keys seguras con Cloud Functions

## Por qué esto importa al trabajar en equipo

Sin Cloud Functions, cada desarrollador necesitaría la API key de Gemini
en su código. Eso significa que tarde o temprano alguien la sube a GitHub
y queda expuesta para siempre en el historial de commits.

Con esta arquitectura:
- Las keys viven solo en Google Secret Manager
- El código no tiene ninguna key — es seguro subirlo a GitHub
- Solo un miembro del equipo necesita hacer el setup inicial
- Los demás solo clonan el repo y trabajan normal

---

## Setup inicial (solo una persona del equipo, una sola vez)

### 1. Instalar Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

### 2. Inicializar Functions en el proyecto
```bash
# Desde la raíz de tu carpeta del proyecto
firebase init functions
# Selecciona: Use existing project → hackathon-c1121
# Language: JavaScript
# No instales ESLint
# Sí instala dependencias con npm
```

Esto crea la carpeta `functions/`. Copia el archivo `functions/index.js`
que te generamos dentro de esa carpeta (reemplaza el que crea Firebase).

### 3. Guardar las keys en Secret Manager
```bash
# Ejecuta cada comando y escribe el valor cuando te lo pida

firebase functions:secrets:set GEMINI_KEY
# → pega tu API key de Google AI Studio

firebase functions:secrets:set BIGML_USERNAME
# → tu usuario de BigML

firebase functions:secrets:set BIGML_API_KEY
# → tu API key de BigML

firebase functions:secrets:set BIGML_MODEL_VISITAS
# → el model ID de BigML (ej: model/64a3c1d9...)
```

### 4. Instalar dependencias y hacer deploy
```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

Cuando termine verás las URLs de tus funciones. Ejemplo:
```
✓ functions[chatGemini]:    https://us-central1-hackathon-c1121.cloudfunctions.net/chatGemini
✓ functions[predecirBigML]: https://us-central1-hackathon-c1121.cloudfunctions.net/predecirBigML
✓ functions[exportarCSV]:   https://us-central1-hackathon-c1121.cloudfunctions.net/exportarCSV
```

---

## Para los demás desarrolladores del equipo

Solo necesitan clonar el repo y abrir los archivos. No necesitan ninguna
key. El chatbot funciona porque llama a las Cloud Functions que ya están
desplegadas en Google Cloud.

```bash
git clone <url-del-repo>
# Abrir los .html directamente — ya funciona
```

---

## Actualizar una key si cambia

```bash
firebase functions:secrets:set GEMINI_KEY
# escribe el nuevo valor
firebase deploy --only functions
```

---

## Probar en local antes de hacer deploy

```bash
firebase emulators:start --only functions
```

Esto levanta las funciones en `localhost:5001`. Para que el chatbot
apunte al emulador local, agrega esto temporalmente en `chatbot.js`:

```js
// Solo para desarrollo local — quitar antes de subir
import { connectFunctionsEmulator } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-functions.js";
connectFunctionsEmulator(fns, "localhost", 5001);
```

---

## Estructura de archivos final

```
Tu carpeta/
├── app.html
├── auth.html
├── vendedor_NEG_01.html  ...
├── firebase-config.js     ← config pública de Firebase (sin keys privadas)
├── chatbot.js             ← chatbot seguro, sin keys
├── bigml.js               ← predicciones seguras, sin keys
├── functions/
│   ├── index.js           ← Cloud Functions (aquí van las keys, en Secret Manager)
│   └── package.json
└── .gitignore
```

## .gitignore recomendado

```
# Nunca subir
functions/.secret.*
.env
firebase_credentials.json

# Firebase auto-genera estos, no son necesarios en el repo
functions/node_modules/
.firebase/
```
