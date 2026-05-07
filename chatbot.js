// chatbot.js — versión compatible con vendedor_NEG_0X.html
// No inicializa Firebase propio, usa el que ya existe en la página

(function() {

// Espera a que Firebase esté listo en la página
function esperarFirebase(callback) {
    if (window._chatbotListo) return;
    if (typeof firebase !== 'undefined' && firebase.auth) {
        callback();
    } else {
        setTimeout(() => esperarFirebase(callback), 300);
    }
}

function iniciarChatbot() {
    window._chatbotListo = true;

    const GEMINI_KEY = window.GEMINI_KEY || "";
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`;

    let historial       = [];
    let rolUsuario      = "admin";
    let negocioIdActual = null;
    let chatAbierto     = false;

    // Detectar negocio del usuario actual
    firebase.auth().onAuthStateChanged(async (user) => {
        if (!user) return;
        try {
            const snap = await firebase.firestore().collection("usuarios").doc(user.uid).get();
            if (snap.exists) {
                const d = snap.data();
                rolUsuario      = d.rol       || "admin";
                negocioIdActual = d.negocioId || null;
            }
        } catch(e) { console.warn("chatbot: no se pudo leer usuario", e); }
        crearWidget();
    });

    async function obtenerContexto() {
        try {
            if (negocioIdActual) {
                const snap = await firebase.firestore().collection("ventas")
                    .where("negocioId", "==", negocioIdActual)
                    .orderBy("fecha", "desc").limit(10).get();
                const ventas   = snap.docs.map(d => d.data());
                const total    = ventas.reduce((s, v) => s + (v.total    || 0), 0);
                const ganancia = ventas.reduce((s, v) => s + (v.ganancia || 0), 0);
                return `[Negocio ${negocioIdActual}: ${ventas.length} ventas recientes, ` +
                       `total $${total.toLocaleString("es-MX")}, ganancia $${ganancia.toLocaleString("es-MX")}]`;
            }
        } catch(e) {}
        return "";
    }

    async function preguntarGemini(mensaje) {
        const contexto = await obtenerContexto();
        const system   = `Eres un asistente de negocios para Tesoros de Morelia. 
Hablas con el dueño del negocio ${negocioIdActual || ""}. 
Ayúdale con análisis de ventas, estrategias y promociones. 
Responde en español, profesional pero cercano. ${contexto}`;

        const mensajes = historial.slice(-10).concat([
            { role: "user", parts: [{ text: mensaje }] }
        ]);

        const res = await fetch(GEMINI_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                system_instruction: { parts: [{ text: system }] },
                contents: mensajes,
                generationConfig: { temperature: 0.7, maxOutputTokens: 500 }
            })
        });

        if (!res.ok) throw new Error("Error Gemini: " + res.status);
        const data      = await res.json();
        const respuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta.";

        historial.push({ role: "user",  parts: [{ text: mensaje }] });
        historial.push({ role: "model", parts: [{ text: respuesta }] });
        return respuesta;
    }

    function crearWidget() {
        // Evitar crear el widget dos veces
        if (document.getElementById("chat-btn")) return;

        const style = document.createElement("style");
        style.textContent = `
            #chat-btn{position:fixed;bottom:24px;right:24px;z-index:9990;width:56px;height:56px;border-radius:50%;background:#7D1520;color:white;border:none;font-size:26px;cursor:pointer;box-shadow:0 4px 16px rgba(125,21,32,0.4);transition:transform 0.2s;}
            #chat-btn:hover{transform:scale(1.08);}
            #chat-panel{display:none;position:fixed;bottom:90px;right:24px;width:320px;max-height:460px;background:#FDFAF5;border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,0.18);flex-direction:column;z-index:9989;border:2px solid #E8E0D0;overflow:hidden;font-family:'DM Sans',sans-serif;}
            #chat-panel.open{display:flex;}
            #chat-header{background:#7D1520;color:white;padding:13px 16px;display:flex;justify-content:space-between;align-items:center;font-weight:600;font-size:14px;}
            #chat-header button{background:none;border:none;color:white;font-size:20px;cursor:pointer;line-height:1;}
            #chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}
            .cm-user{max-width:82%;padding:10px 13px;border-radius:12px;font-size:13px;line-height:1.5;background:#7D1520;color:white;align-self:flex-end;border-bottom-right-radius:3px;}
            .cm-bot{max-width:82%;padding:10px 13px;border-radius:12px;font-size:13px;line-height:1.5;background:white;color:#1a1a1a;align-self:flex-start;border-bottom-left-radius:3px;border:1px solid #E8E0D0;}
            .cm-loading span{display:inline-block;animation:cbounce 1s infinite;}
            .cm-loading span:nth-child(2){animation-delay:.2s;}.cm-loading span:nth-child(3){animation-delay:.4s;}
            @keyframes cbounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
            #chat-sugs{display:flex;flex-wrap:wrap;gap:6px;padding:0 12px 10px;}
            .chat-sug{background:white;border:1px solid #E8E0D0;color:#7D1520;border-radius:16px;padding:5px 10px;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif;}
            .chat-sug:hover{background:#F8EDEE;}
            #chat-input-row{display:flex;gap:8px;padding:10px 12px;border-top:1px solid #E8E0D0;background:white;}
            #chat-input{flex:1;border:1px solid #E8E0D0;border-radius:8px;padding:8px 10px;font-size:13px;outline:none;font-family:'DM Sans',sans-serif;}
            #chat-send{background:#7D1520;color:white;border:none;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:600;font-size:13px;}
            #chat-send:hover{background:#5C0F19;}
        `;
        document.head.appendChild(style);

        // Botón flotante
        const btn = document.createElement("button");
        btn.id        = "chat-btn";
        btn.innerHTML = "💬";
        btn.title     = "Asistente IA";
        btn.onclick   = toggleChat;
        document.body.appendChild(btn);

        // Panel
        const panel = document.createElement("div");
        panel.id        = "chat-panel";
        panel.innerHTML = `
            <div id="chat-header">
                <span>🤖 Asistente de negocios</span>
                <button onclick="document.getElementById('chat-panel').classList.remove('open')">×</button>
            </div>
            <div id="chat-messages"></div>
            <div id="chat-sugs"></div>
            <div id="chat-input-row">
                <input id="chat-input" type="text" placeholder="Escribe tu pregunta...">
                <button id="chat-send">➤</button>
            </div>`;
        document.body.appendChild(panel);

        // Sugerencias
        ["📊 ¿Cómo van mis ventas?", "💡 Ideas para atraer más clientes", "🏷️ ¿Qué promo funciona mejor?", "📦 ¿Qué productos vendo más?"]
        .forEach(s => {
            const b = document.createElement("button");
            b.className = "chat-sug"; b.textContent = s;
            b.onclick = () => { document.getElementById("chat-input").value = s; enviarChat(); };
            document.getElementById("chat-sugs").appendChild(b);
        });

        document.getElementById("chat-input").addEventListener("keydown", e => {
            if (e.key === "Enter") enviarChat();
        });
        document.getElementById("chat-send").addEventListener("click", enviarChat);

        agregarMsg("¡Hola! Soy tu asistente de negocios 🏪 Puedo ayudarte a analizar tus ventas y encontrar oportunidades. ¿En qué te ayudo?", "bot");
    }

    function toggleChat() {
        chatAbierto = !chatAbierto;
        document.getElementById("chat-panel").classList.toggle("open", chatAbierto);
        if (chatAbierto) document.getElementById("chat-input").focus();
    }

    function agregarMsg(texto, tipo) {
        const el = document.createElement("div");
        el.className = tipo === "user" ? "cm-user" : "cm-bot";
        el.innerHTML  = texto.replace(/\n/g, "<br>");
        const msgs = document.getElementById("chat-messages");
        msgs.appendChild(el);
        msgs.scrollTop = 9999;
        return el;
    }

    async function enviarChat() {
        const input = document.getElementById("chat-input");
        const texto = input.value.trim();
        if (!texto) return;
        input.value = "";
        document.getElementById("chat-sugs").style.display = "none";
        agregarMsg(texto, "user");
        const loading = agregarMsg("💭 <span>.</span><span>.</span><span>.</span>", "bot");
        loading.className += " cm-loading";
        try {
            const r = await preguntarGemini(texto);
            loading.remove();
            agregarMsg(r, "bot");
        } catch(e) {
            loading.remove();
            agregarMsg("⚠️ Error al conectar. Revisa tu GEMINI_KEY en keys.js", "bot");
            console.error("Gemini error:", e);
        }
    }
}

// Espera a que el DOM esté listo y luego a Firebase
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => esperarFirebase(iniciarChatbot));
} else {
    esperarFirebase(iniciarChatbot);
}

})();