/* =====================================================================
   server.js — servidor para rodar TUDO localmente (site + API) com um
   único processo. Assim você testa o fluxo completo na sua máquina.

   Rode com:  npm run dev
   Depois abra:  http://localhost:3000

   Observação: com um único servidor sempre ligado, o armazém em memória
   funciona (o webhook encontra a transação). Em produção na Vercel
   (serverless) use Upstash/Vercel KV — veja o README.
   ===================================================================== */
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import createPayment from "./api/create-payment.js";
import paymentStatus from "./api/payment-status.js";
import misticpayWebhook from "./api/misticpay-webhook.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// endpoints da API (mesmos arquivos usados na Vercel)
app.post("/api/create-payment", createPayment);
app.get("/api/payment-status", paymentStatus);
app.post("/api/misticpay-webhook", misticpayWebhook);

// serve os arquivos do site (index.html, style.css, script.js, assets/)
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n  Site rodando em: http://localhost:${PORT}\n`);
});
