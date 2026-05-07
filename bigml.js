// bigml.js
// Predicciones BigML desde el navegador (sin backend Python)
// Usa la API REST de BigML directamente con fetch()
//
// CÓMO USARLO en cualquier .html:
//
//   <script type="module">
//     import { predecirNegocio } from './bigml.js';
//     const resultado = await predecirNegocio({ categoria: "Gastronomia", visitas: 12 });
//     console.log(resultado.prediccion);
//   </script>

// ── CREDENCIALES BigML ────────────────────────────────────────────────────
// Regístrate en https://bigml.com → Settings → API Key
const BIGML_USERNAME = "TU_USUARIO_BIGML";       // ← reemplaza
const BIGML_API_KEY  = "TU_API_KEY_BIGML";        // ← reemplaza
const BIGML_AUTH     = `username=${BIGML_USERNAME};api_key=${BIGML_API_KEY}`;

// IDs de tus modelos en BigML (los obtienes al entrenar, ver instrucciones abajo)
const MODELOS = {
    // Predice cuántas visitas puede atraer un negocio con ciertas características
    visitas:    "model/XXXXXXXXXXXXXXXXXXXXXXXX",  // ← reemplaza con tu model ID
    // Predice si una promoción será exitosa
    promocion:  "model/XXXXXXXXXXXXXXXXXXXXXXXX",  // ← reemplaza
};

const BASE_URL = "https://bigml.io/andromeda";


// ── PREDICCIÓN GENÉRICA ───────────────────────────────────────────────────

/**
 * Llama a un modelo BigML con los datos dados.
 *
 * @param {string} modelId   - ID del modelo (ej: "model/64a3c...")
 * @param {object} inputData - Campos de entrada del modelo
 * @returns {object}         - { prediccion, confianza, error }
 *
 * Ejemplo:
 *   const r = await predecir("model/abc123", { categoria: "Gastronomia", precio_promedio: 80 });
 */
export async function predecir(modelId, inputData) {
    try {
        const res = await fetch(`${BASE_URL}/prediction?${BIGML_AUTH}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: modelId,
                input_data: inputData
            })
        });

        if (!res.ok) throw new Error(`BigML HTTP ${res.status}`);

        const data = await res.json();
        return {
            prediccion: data.output,
            confianza:  Math.round((data.confidence || 0) * 100),
            crudo:      data,
            error:      null
        };

    } catch (err) {
        console.error("BigML error:", err);
        return { prediccion: null, confianza: 0, error: err.message };
    }
}


// ── PREDICCIONES ESPECÍFICAS PARA TU PROYECTO ────────────────────────────

/**
 * Predice el potencial de visitas de un negocio.
 * Usa esto en el panel del vendedor (vendedor_NEG_0X.html).
 *
 * @param {object} datosNegocio - Ej: { categoria, precio_promedio, tiene_promo, hora_pico }
 */
export async function predecirVisitas(datosNegocio) {
    return predecir(MODELOS.visitas, datosNegocio);
}

/**
 * Predice si una promoción va a generar buenas ventas.
 * @param {object} datosPromo - Ej: { descuento_pct, categoria, mes, dia_semana }
 */
export async function predecirExitoPromo(datosPromo) {
    return predecir(MODELOS.promocion, datosPromo);
}


// ── ENTRENAR UN MODELO (guía, ejecutar una sola vez) ─────────────────────
//
// Para crear tu modelo BigML con datos de Firestore:
//
// 1. Exporta tus datos de Firestore como CSV (Firebase Console → Firestore → Exportar)
//    O genera el CSV manualmente desde tus colecciones `ventas` y `visitas`.
//
// 2. Sube el CSV en https://bigml.com/dashboard
//    Sources → Upload → selecciona tu archivo
//
// 3. Crea el Dataset desde el Source subido
//
// 4. Crea el Modelo desde el Dataset
//    Elige la columna que quieres predecir (ej: "total_ventas" o "exitosa")
//
// 5. Copia el ID del modelo (ej: "model/64a3c1d9e3f0a12345678901")
//    y pégalo en la constante MODELOS arriba.
//
// ─────────────────────────────────────────────────────────────────────────
