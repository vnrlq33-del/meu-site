/* =====================================================================
   POST /api/create-payment
   Recebe do navegador: { purpose, payerName, payerDocument }
   - purpose: "chat" ou "gift"
   - payerName: nome completo do cliente
   - payerDocument: CPF (só dígitos)

   O VALOR cobrado é decidido AQUI (no servidor), nunca vem do navegador.
   Fala com a MisticPay, guarda a transação como PENDENTE e devolve ao
   navegador apenas os dados do PIX (QR code e copia-e-cola).
   ===================================================================== */
import { randomUUID } from "crypto";
import {
  env, getTx, setTx, misticCreateTransaction, readJsonBody, setCors,
} from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const body = await readJsonBody(req);

    const purpose = body.purpose === "gift" ? "gift" : "chat";
    const payerName = String(body.payerName || "").trim();
    const payerDocument = String(body.payerDocument || "").replace(/\D/g, "");

    // validações do servidor (não confie só no navegador)
    if (payerName.length < 3) {
      return res.status(400).json({ error: "Nome completo é obrigatório." });
    }
    if (payerDocument.length !== 11) {
      return res.status(400).json({ error: "CPF inválido." });
    }

    // valor definido no servidor conforme a finalidade
    const amount = purpose === "gift" ? env.priceGift : env.priceChat;
    const description = purpose === "gift" ? "Presentinho" : "Liberação do chat";

    // referência única nossa (enviada como transactionId à MisticPay)
    const ref = randomUUID();

    // monta o endereço do webhook (opcional). Se PUBLIC_BASE_URL não estiver
    // definido, não enviamos projectWebhook (ele é opcional na doc).
    let projectWebhook;
    if (env.publicBaseUrl) {
      projectWebhook = env.publicBaseUrl + "/api/misticpay-webhook";
      if (env.webhookToken) {
        projectWebhook += "?token=" + encodeURIComponent(env.webhookToken);
      }
    }

    // corpo EXATO conforme a documentação da MisticPay
    const payload = {
      amount,                       // número em reais (ex.: 12.90)
      payerName,
      payerDocument,
      transactionId: ref,           // nossa referência única
      description,
    };
    if (projectWebhook) payload.projectWebhook = projectWebhook;

    const result = await misticCreateTransaction(payload);
    const d = (result && result.data) || {};

    // id da transação na MisticPay — é ele que volta no webhook
    const paymentId = String(d.transactionId || ref);

    // guarda o estado inicial: PENDENTE
    await setTx(paymentId, {
      paymentId,
      ref,
      purpose,
      amount,                       // reais, para conferência no webhook
      status: "PENDENTE",
      createdAt: Date.now(),
    });

    // devolve ao navegador SOMENTE o necessário (nada de secret)
    return res.status(200).json({
      paymentId,
      amount,
      qrCodeBase64: d.qrCodeBase64 || null,
      qrcodeUrl: d.qrcodeUrl || null,
      copyPaste: d.copyPaste || null,
    });

  } catch (e) {
    // erro amigável; detalhes só no log do servidor
    console.error("[create-payment]", e.message);
    return res.status(e.status || 500).json({
      error: "Não foi possível gerar o pagamento. Tente novamente.",
    });
  }
}
