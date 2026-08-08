/* =====================================================================
   GET /api/payment-status?paymentId=XXXX
   O navegador chama isto de tempos em tempos para saber se o pagamento
   já foi confirmado. A confirmação REAL é feita pelo webhook (backend),
   nunca pelo navegador.

   Retorna:
   - { status: "PENDENTE" }  enquanto não pago
   - { status: "COMPLETO", whatsapp: "https://wa.me/..." }  quando pago (chat)
   - { status: "COMPLETO" }  quando pago (presentinho)
   O link do WhatsApp SÓ é devolvido depois de confirmado o pagamento.
   ===================================================================== */
import { env, getTx, setCors } from "./_lib.js";

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  const paymentId = (req.query && req.query.paymentId) ||
    new URL(req.url, "http://x").searchParams.get("paymentId");

  if (!paymentId) return res.status(400).json({ error: "paymentId ausente." });

  const tx = await getTx(paymentId);
  if (!tx) return res.status(200).json({ status: "NAO_ENCONTRADO" });

  if (tx.status === "COMPLETO" && tx.purpose === "chat") {
    let whatsapp = null;
    if (env.whatsapp) {
      const texto = encodeURIComponent(env.whatsappMsg);
      whatsapp = "https://wa.me/" + env.whatsapp + "?text=" + texto;
    }
    return res.status(200).json({ status: "COMPLETO", purpose: "chat", whatsapp });
  }

  return res.status(200).json({ status: tx.status, purpose: tx.purpose });
}
