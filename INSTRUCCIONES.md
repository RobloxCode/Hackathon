# Cómo integrar los archivos nuevos en tu proyecto

## Archivos que debes agregar a tu carpeta

```
Tu carpeta/
├── Hackathon/
├── app.html                  ← ya existe (no modificar)
├── auth.html                 ← ya existe (no modificar)
├── estadisticas_vendedor.html
├── perfil_vendedor.html
├── vendedor_NEG_01.html      ← ya existe
├── vendedor_NEG_02.html      ...
│
├── firebase-config.js        ← NUEVO (copia aquí)
├── bigml.js                  ← NUEVO (copia aquí)
└── chatbot.js                ← NUEVO (copia aquí)
```

El archivo `firebase_credentials.json` (el JSON privado) NO va aquí.
Tu proyecto es frontend puro — ya conectas con Firebase desde el navegador
usando `firebaseConfig` en cada HTML. Eso es correcto y suficiente.

---

## Paso 1 — Agrega el chatbot a app.html (vista del turista)

Busca la línea `</body>` al final de `app.html` y agrega esto ANTES de ella:

```html
<!-- Chatbot IA -->
<div id="chat-widget"></div>
<script type="module" src="chatbot.js"></script>
```

Eso es todo. El botón 💬 aparecerá en la esquina inferior derecha.

---

## Paso 2 — Agrega el chatbot a vendedor_NEG_01.html (y los demás)

Igual que el paso anterior: busca `</body>` y agrega antes:

```html
<!-- Chatbot IA para vendedor -->
<div id="chat-widget"></div>
<script type="module" src="chatbot.js"></script>
```

El chatbot detecta automáticamente si el usuario es turista o admin
leyendo su rol desde Firestore, y cambia su comportamiento.

---

## Paso 3 — Configura tu API key de Gemini

1. Ve a https://aistudio.google.com/app/apikey
2. Crea una API key (es gratis)
3. Abre `chatbot.js` y reemplaza en la línea 17:
   ```js
   const GEMINI_KEY = "TU_API_KEY_GEMINI";  // ← pon tu key aquí
   ```

---

## Paso 4 — BigML (opcional, para predicciones)

Solo si quieres usar predicciones de ML en el panel del vendedor.

1. Regístrate en https://bigml.com
2. Sube un CSV con tus datos de ventas (exporta desde Firebase Console
   o arma uno con los datos de tu colección `ventas`)
3. Entrena un modelo en BigML
4. Copia el Model ID y ponlo en `bigml.js`:
   ```js
   const BIGML_USERNAME = "tu_usuario";
   const BIGML_API_KEY  = "tu_api_key";
   const MODELOS = {
       visitas:   "model/XXXXX",  // ← tu model ID
       promocion: "model/XXXXX",
   };
   ```

5. Llama a BigML desde tu panel del vendedor:
   ```html
   <script type="module">
     import { predecirVisitas } from './bigml.js';

     async function analizarNegocio() {
       const r = await predecirVisitas({
         categoria:       "Gastronomia",
         precio_promedio: 80,
         tiene_promo:     true
       });
       console.log("Predicción:", r.prediccion, "Confianza:", r.confianza + "%");
     }
   </script>
   ```

---

## Colecciones Firestore que ya usas (no necesitas crear nada nuevo)

| Colección       | Ya la usas en                  |
|----------------|-------------------------------|
| `usuarios`      | auth.html, app.html           |
| `negocios`      | perfil_vendedor.html          |
| `ventas`        | vendedor_NEG_0X.html          |
| `visitas`       | app.html                      |
| `codigos_venta` | app.html, vendedor_NEG_0X.html|
| `clientes`      | vendedor_NEG_0X.html          |

El chatbot lee de `ventas`, `visitas` y `negocios` para dar respuestas
contextuales. No crea colecciones nuevas.

---

## Resumen rápido

| Archivo             | Para qué sirve                                      | Dónde va      |
|--------------------|-----------------------------------------------------|---------------|
| `firebase-config.js`| Configuración compartida de Firebase               | raíz          |
| `chatbot.js`        | Botón 💬 flotante con Gemini AI, lee de Firestore  | raíz          |
| `bigml.js`          | Predicciones ML desde el navegador                 | raíz          |
