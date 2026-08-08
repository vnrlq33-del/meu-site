/* =====================================================================
   POST /api/misticpay-webhook
   A MisticPay chama este endereço quando o pagamento muda de estado.
   É AQUI (no backend) que o pagamento é confirmado de verdade — nunca
   confiamos no navegador dizendo que pagou.

   Corpo enviado pela MisticPay (conforme a documentação):
   {
     "transactionId": 31484480,
     "transactionType": "DEPOSITO",
     "transactionMethod": "PIX",
     "clientName": "...",
     "clientDocument": "...",
     "status": "COMPLETO",
     "value": 455,
     "fee": 23,
     "e2e": "..."
   }

   Regras aplicadas:
   - só libera se transactionType = DEPOSITO, transactionMethod = PIX e status = COMPLETO
   - confere se a transação existe (foi criada por nós)
   - confere o valor (com ressalva — ver TODO abaixo)
   - é idempotente: o mesmo webhook não libera o pagamento duas vezes
   ===================================================================== */
import { env, getTx, setTx, readJsonBody, setCors } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  // proteção opcional por token (?token=...). Recomendado configurar.
  // TODO: a documentação fornecida não descreve assinatura/HMAC do webhook.
  //       Se a MisticPay oferecer verificação de assinatura, adicione aqui.
  if (env.webhookToken) {
    const token = (req.query && req.query.token) ||
      new URL(req.url, "http://x").searchParams.get("token");
    if (token !== env.webhookToken) {
      console.warn("[webhook] token inválido");
      return res.status(401).json({ error: "não autorizado" });
    }
  }

  try {
    const body = await readJsonBody(req);

    const id = body.transactionId;
    if (id === undefined || id === null) {
      return res.status(400).json({ error: "transactionId ausente" });
    }

    const tx = await getTx(id);
    // se não conhecemos a transação, apenas confirmamos o recebimento
    // (200) para a MisticPay não ficar reenviando indefinidamente.
    if (!tx) {
      console.warn("[webhook] transação desconhecida:", String(id));
      return res.status(200).json({ ignored: true, reason: "desconhecida" });
    }

    // idempotência: já estava pago → não faz nada de novo
    if (tx.status === "COMPLETO") {
      return res.status(200).json({ ok: true, already: true });
    }

    // condições obrigatórias
    const okTipo   = body.transactionType === "DEPOSITO";
    const okMetodo = body.transactionMethod === "PIX";
    const okStatus = body.status === "COMPLETO";
    if (!okTipo || !okMetodo || !okStatus) {
      console.log("[webhook] ignorado (condições não atendidas):", {
        type: body.transactionType, method: body.transactionMethod, status: body.status,
      });
      return res.status(200).json({ ignored: true, reason: "condições" });
    }

    // conferência de valor.
    // TODO: a doc é ambígua sobre a unidade de "value" (parece centavos).
    //       Comparamos o valor esperado (em centavos) com body.value.
    //       Por padrão só AVISA se divergir; com STRICT_AMOUNT_CHECK=true, recusa.
    const esperadoCentavos = Math.round(Number(tx.amount) * 100);
    const recebido = Number(body.value);
    if (recebido !== esperadoCentavos) {
      console.warn(
        `[webhook] valor divergente: esperado ${esperadoCentavos} (centavos), ` +
        `recebido ${recebido}. tx=${tx.paymentId}`
      );
      if (env.strictAmount) {
        return res.status(200).json({ ignored: true, reason: "valor" });
      }
    }

    // tudo certo → marca como PAGO
    tx.status = "COMPLETO";
    tx.paidAt = Date.now();
    tx.e2e = body.e2e || null;
    await setTx(tx.paymentId, tx);

    console.log("[webhook] pagamento confirmado:", tx.paymentId, tx.purpose);
    return res.status(200).json({ ok: true });

  } catch (e) {
    console.error("[webhook]", e.message);
    // devolve 200 para evitar tempestade de reenvios; erro fica no log
    return res.status(200).json({ ok: false });
  }
}
