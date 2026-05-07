// functions/index.js — versión para plan Spark (sin Secret Manager)
// Las keys se leen del archivo functions/.env

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp }      = require("firebase-admin/app");
const { getFirestore }       = require("firebase-admin/firestore");

initializeApp();
const db = getFirestore();

// Las keys vienen del archivo .env (Firebase las carga automáticamente)
const GEMINI_KEY     = process.env.GEMINI_KEY;
const BIGML_USERNAME = process.env.BIGML_USERNAME;
const BIGML_API_KEY  = process.env.BIGML_API_KEY;
const BIGML_MODEL    = process.env.BIGML_MODEL_VISITAS;


// ════════════════════════════════════════════════════════════
//  FUNCIÓN 1: chatGemini
// ════════════════════════════════════════════════════════════
exports.chatGemini = onCall(
  { region: "us-central1" },
  async (request) => {

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const { mensaje, historial = [], rol = "turista", negocioId } = request.data;
    if (!mensaje) throw new HttpsError("invalid-argument", "Falta el mensaje.");

    // Contexto desde Firestore
    let contexto = "";
    try {
      if (rol === "admin" && negocioId) {
        const snap   = await db.collection("ventas")
          .where("negocioId", "==", negocioId)
          .orderBy("fecha", "desc").limit(10).get();
        const ventas   = snap.docs.map(d => d.data());
        const total    = ventas.reduce((s, v) => s + (v.total    || 0), 0);
        const ganancia = ventas.reduce((s, v) => s + (v.ganancia || 0), 0);
        contexto = `[Negocio ${negocioId}: ${ventas.length} ventas recientes, ` +
                   `total $${total.toLocaleString("es-MX")}, ganancia $${ganancia.toLocaleString("es-MX")}]`;
      } else {
        const snap   = await db.collection("negocios").limit(8).get();
        const nombres = snap.docs.map(d => d.data().nombre || d.id).join(", ");
        contexto = `[Negocios en la app: ${nombres}]`;
      }
    } catch(e) { console.warn("Sin contexto:", e.message); }

    const systemPrompt = rol === "admin"
      ? `Eres asistente de negocios de Tesoros de Morelia. Hablas con el dueño de ${negocioId || "un negocio"}. Ayuda con ventas y estrategias. Responde en español. ${contexto}`
      : `Eres TurismoBot de Tesoros de Morelia, Michoacán. Ayudas a turistas a descubrir negocios locales. Responde en español con entusiasmo. ${contexto}`;

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: (historial || []).slice(-10).concat([{ role: "user", parts: [{ text: mensaje }] }]),
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new HttpsError("internal", "Error Gemini: " + (err.error?.message || res.status));
    }

    const data      = await res.json();
    const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";
    return { respuesta };
  }
);


// ════════════════════════════════════════════════════════════
//  FUNCIÓN 2: predecirBigML
// ════════════════════════════════════════════════════════════
exports.predecirBigML = onCall(
  { region: "us-central1" },
  async (request) => {

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const { inputData } = request.data;
    if (!inputData) throw new HttpsError("invalid-argument", "Falta inputData.");

    const auth = `username=${BIGML_USERNAME};api_key=${BIGML_API_KEY}`;
    const res  = await fetch(`https://bigml.io/andromeda/prediction?${auth}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: BIGML_MODEL, input_data: inputData })
    });

    if (!res.ok) throw new HttpsError("internal", `Error BigML: HTTP ${res.status}`);

    const data = await res.json();
    return {
      prediccion: data.output,
      confianza:  Math.round((data.confidence || 0) * 100)
    };
  }
);


// ════════════════════════════════════════════════════════════
//  FUNCIÓN 3: exportarCSV
// ════════════════════════════════════════════════════════════
exports.exportarCSV = onCall(
  { region: "us-central1" },
  async (request) => {

    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const { coleccion = "ventas" } = request.data;
    if (!["ventas","visitas","clientes"].includes(coleccion)) {
      throw new HttpsError("invalid-argument", "Colección no permitida.");
    }

    const snap = await db.collection(coleccion).limit(1000).get();
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (docs.length === 0) return { csv: "", total: 0 };

    const serial = v => {
      if (v == null) return "";
      if (typeof v === "object" && v.toDate) return v.toDate().toISOString();
      if (typeof v === "object") return JSON.stringify(v).replace(/,/g, ";");
      return String(v).includes(",") ? `"${v}"` : String(v);
    };

    const cols = [...new Set(docs.flatMap(Object.keys))];
    const csv  = [cols.join(","), ...docs.map(r => cols.map(c => serial(r[c])).join(","))].join("\n");
    return { csv, total: docs.length };
  }
);