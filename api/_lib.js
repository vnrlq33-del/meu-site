/* =====================================================================
   _lib.js — funções compartilhadas pelos endpoints.
   Arquivos que começam com "_" NÃO viram rota na Vercel.

   Contém:
   - um "armazém" (store) para guardar o estado das transações
   - a função que fala com a MisticPay
   - leitura das variáveis de ambiente (.env)
   ===================================================================== */

/* -------------------- STORE (estado das transações) --------------------
   Por padrão usa memória (ótimo para testar local com 1 servidor).
   Em produção na Vercel (serverless), a memória NÃO é compartilhada entre
   o endpoint que cria o PIX e o webhook — então você PRECISA de um store
   compartilhado. Se existir Upstash Redis / Vercel KV configurado
   (variáveis KV_REST_API_URL e KV_REST_API_TOKEN), ele é usado
   automaticamente. Veja o README.
------------------------------------------------------------------------ */
const KV_URL   = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const useKV = Boolean(KV_URL && KV_TOKEN);

// aviso útil se estiver em produção sem store compartilhado
if (process.env.NODE_ENV === "production" && !useKV) {
  console.warn(
    "[aviso] Sem KV/Redis configurado. Em serverless (Vercel) o webhook não " +
    "conseguirá encontrar a transação. Configure Upstash/Vercel KV ou use um " +
    "servidor único (server.js). Veja o README."
  );
}

const memory = new Map();

async function kv(path, options) {
  const res = await fetch(KV_URL + path, {
    ...options,
    headers: { Authorization: "Bearer " + KV_TOKEN, ...(options && options.headers) },
  });
  if (!res.ok) throw new Error("KV error " + res.status);
  return res.json();
}

export async function getTx(id) {
  id = String(id);
  if (useKV) {
    const data = await kv("/get/tx:" + encodeURIComponent(id));
    return data && data.result ? JSON.parse(data.result) : null;
  }
  return memory.get(id) || null;
}

export async function setTx(id, value) {
  id = String(id);
  if (useKV) {
    // guarda por 24h (86400s) para não acumular indefinidamente
    await kv("/set/tx:" + encodeURIComponent(id) + "?EX=86400", {
      method: "POST",
      body: JSON.stringify(value),
    });
    return;
  }
  memory.set(id, value);
}


/* -------------------- VARIÁVEIS DE AMBIENTE -------------------- */
export const env = {
  clientId:     process.env.MISTICPAY_CLIENT_ID || "",
  clientSecret: process.env.MISTICPAY_CLIENT_SECRET || "",
  apiBase:      process.env.MISTICPAY_API_BASE || "https://api.misticpay.com/api",

  // valores REAIS cobrados (em reais). Definidos aqui, no servidor,
  // para o navegador não conseguir alterar.
  priceChat: Number(process.env.PRICE_CHAT || 12.90),
  priceGift: Number(process.env.PRICE_GIFT || 12.90),

  // seu WhatsApp (só dígitos, com DDI). Ex.: 5511999999999
  whatsapp: (process.env.WHATSAPP_CONTACT || "").replace(/\D/g, ""),
  whatsappMsg: process.env.WHATSAPP_MESSAGE || "Oi! Acabei de liberar o chat 💬",

  // URL pública do site/API, usada para montar o endereço do webhook.
  // Ex.: https://seusite.vercel.app  (sem barra no final)
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, ""),

  // token opcional para proteger o webhook (recomendado). Se definido,
  // o webhook só aceita chamadas com ?token=ESSE_VALOR
  webhookToken: process.env.WEBHOOK_TOKEN || "",

  // conferência de valor no webhook. A doc da MisticPay é ambígua sobre a
  // unidade do campo "value" (parece centavos). Por padrão apenas AVISA se
  // divergir. Coloque STRICT_AMOUNT_CHECK=true para recusar em caso de
  // divergência (mais seguro, mas confirme a unidade antes). Veja README.
  strictAmount: String(process.env.STRICT_AMOUNT_CHECK || "false") === "true",
};


/* -------------------- CHAMADA À MISTICPAY -------------------- */
// Cria uma transação PIX. Usa EXATAMENTE os campos da documentação fornecida.
export async function misticCreateTransaction(payload) {
  if (!env.clientId || !env.clientSecret) {
    throw new Error("Credenciais da MisticPay ausentes. Configure o arquivo .env.");
  }

  const res = await fetch(env.apiBase + "/transactions/create", {
    method: "POST",
    headers: {
      ci: env.clientId,          // Client ID  (header exigido pela doc)
      cs: env.clientSecret,      // Client Secret (NUNCA vai pro navegador)
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }

  if (!res.ok) {
    // não vaza o secret; só o que a MisticPay respondeu
    const msg = (json && (json.message || json.error)) || ("Erro MisticPay " + res.status);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json; // { message, data: {...} }
}


/* -------------------- utilzinhos -------------------- */
export function readJsonBody(req) {
  // Na Vercel o req.body já vem parseado quando é JSON. Em outros ambientes
  // pode vir como string. Esta função cobre os dois casos.
  return new Promise((resolve) => {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    if (typeof req.body === "string") {
      try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
    }
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(JSON.parse(data || "{}")); } catch { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

export function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}
