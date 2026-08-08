/* =====================================================================
   CONFIG — EDITE APENAS ESTE BLOCO PARA PERSONALIZAR O SITE
   =====================================================================
   Quase tudo que aparece no site sai daqui. Você não precisa mexer
   em mais nada além deste bloco para trocar foto, nome, links e textos.
   --------------------------------------------------------------------- */
const CONFIG = {
  // Seu nome, exibido no topo e no cabeçalho do chat
  nome: "Lavínia Carraro",

  // Sua foto. Coloque o arquivo em assets/ e escreva o caminho aqui.
  // Ex.: "assets/modelo.jpg"
  foto: "assets/1.jpg",

  // Links das suas redes (troque pelos seus @)
  instagram: "https://instagram.com/_laviniacarraro",
  tiktok:    "https://www.tiktok.com/@_laviniacarraro",
  telegram:  "https://t.me/laviniacarrarobot",

  // Card do Pack (leva direto pro seu Telegram)
  packNome:  "GRUPINHO PRIVADO",
  packPreco: "",

  // Preço para liberar o contato pelo chat (em reais).
  // IMPORTANTE: o VALOR REAL cobrado é definido no backend (.env),
  // para ninguém conseguir alterar pelo navegador. Aqui é só o que aparece.
  chatPreco: 12.90,

  // Mensagens do chat (antes de liberar)
  mensagemInicial:   "Oii meu amor, tudo bem? vem conversar comigo ❤️",
  mensagemPagamento: "Pra falar comigo é só liberar aqui embaixo 👇 assim que confirmar eu te passo meu WhatsApp e a gente conversa 💬",

  // Mensagem mostrada DEPOIS que o pagamento é confirmado (chat)
  mensagemLiberado:  "Prontinho ❤️ agora é só me chamar no WhatsApp que eu te respondo assim que estiver online.",

  // Endereço da sua API. Deixe "" se o site e a API estiverem no mesmo domínio
  // (é o caso quando você publica tudo junto na Vercel). Se a API estiver em
  // outro lugar, coloque a URL, ex.: "https://minha-api.vercel.app"
  apiBase: "",

  // Ativar o somzinho de notificação quando chega mensagem no chat
  somNotificacao: true,
};
/* ===================== FIM DA CONFIGURAÇÃO ===================== */


/* =====================================================================
   Daqui pra baixo é o funcionamento do site. Você não precisa editar.
   ===================================================================== */

const $ = (sel) => document.querySelector(sel);

// ---- Preenche o site com os dados do CONFIG ----
function aplicarConfig() {
  document.title = CONFIG.nome;

  const setPhoto = (el) => { if (el) el.src = CONFIG.foto; };
  setPhoto($("#profilePhoto"));
  setPhoto($("#chatPhoto"));

  $("#profileName").textContent = CONFIG.nome;
  $("#modalName").textContent   = CONFIG.nome;

  $("#linkInstagram").href = CONFIG.instagram;
  $("#linkTiktok").href    = CONFIG.tiktok;

  $("#packCard").href           = CONFIG.telegram;
  $("#packName").textContent    = CONFIG.packNome;
  $("#packPrice").textContent   = CONFIG.packPreco;

  // Iniciais no avatar (fallback quando não há foto)
  const inicial = (CONFIG.nome.trim()[0] || "•").toUpperCase();
  document.querySelectorAll(".avatar__fallback").forEach((el) => el.textContent = inicial);
}

// ---- Formata número em reais ----
function reais(v) {
  return "R$ " + Number(v).toFixed(2).replace(".", ",");
}

// ---- Hora atual (HH:MM) ----
function agora() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ---- Somzinho de notificação (sem arquivo externo, via Web Audio) ----
let audioCtx = null;
function beep() {
  if (!CONFIG.somNotificacao) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    o.type = "sine";
    o.frequency.setValueAtTime(880, audioCtx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.08);
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.22);
    o.start();
    o.stop(audioCtx.currentTime + 0.24);
  } catch (e) { /* silêncio se o navegador bloquear */ }
}


/* ===================== MODAL ===================== */
const modal    = $("#modal");
const chatBody  = $("#chatBody");
const chatFooter = $("#chatFooter");

// estado do pedido atual
let pedido = { purpose: null, paymentId: null, polling: null };

function abrirModal() {
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}
function fecharModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  if (pedido.polling) { clearInterval(pedido.polling); pedido.polling = null; }
}
modal.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", fecharModal));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") fecharModal(); });

function limparChat() {
  chatBody.innerHTML = "";
  chatFooter.innerHTML = "";
}

// adiciona bolha de mensagem
function addMsg(texto, tipo = "in", comHora = true) {
  const el = document.createElement("div");
  el.className = "msg msg--" + tipo;
  el.textContent = texto;
  if (comHora) {
    const t = document.createElement("span");
    t.className = "msg__time";
    t.textContent = agora();
    el.appendChild(t);
  }
  chatBody.appendChild(el);
  chatBody.scrollTop = chatBody.scrollHeight;
  return el;
}

// mostra "digitando..." e resolve depois de X ms
function digitando(ms = 1400) {
  const t = document.createElement("div");
  t.className = "typing";
  t.innerHTML = "<span></span><span></span><span></span>";
  chatBody.appendChild(t);
  chatBody.scrollTop = chatBody.scrollHeight;
  return new Promise((resolve) => {
    setTimeout(() => { t.remove(); resolve(); }, ms);
  });
}


/* ===================== FLUXO DO CHAT ===================== */
async function iniciarChat() {
  limparChat();
  abrirModal();

  await digitando(1500);
  addMsg(CONFIG.mensagemInicial, "in");
  beep();

  await digitando(1400);
  addMsg(CONFIG.mensagemPagamento, "in");
  beep();

  mostrarBotaoLiberar();
}

function mostrarBotaoLiberar() {
  chatFooter.innerHTML = `
    <button class="btn" id="unlockBtn" type="button">
      Liberar chat — ${reais(CONFIG.chatPreco)}
    </button>
    <p class="muted">Pagamento via PIX. Seu contato é liberado assim que o pagamento é confirmado.</p>
  `;
  $("#unlockBtn").addEventListener("click", () => mostrarFormulario("chat"));
}


/* ===================== FORMULÁRIO NOME + CPF ===================== */
function mostrarFormulario(purpose) {
  pedido.purpose = "chat";
  const preco = CONFIG.chatPreco;

  chatFooter.innerHTML = `
    <form class="form" id="payerForm" novalidate>
      <div class="field">
        <label for="fName">Nome completo</label>
        <input id="fName" name="name" type="text" autocomplete="name" placeholder="Seu nome" />
      </div>
      <div class="field">
        <label for="fCpf">CPF</label>
        <input id="fCpf" name="cpf" type="text" inputmode="numeric" autocomplete="off" placeholder="000.000.000-00" maxlength="14" />
      </div>
      <p class="form__hint">Necessário para gerar o PIX. Não guardamos seu CPF no navegador.</p>
      <p class="form__error" id="formError"></p>
      <button class="btn" type="submit" id="continueBtn">Continuar para pagamento — ${reais(preco)}</button>
    </form>
  `;

  const cpfInput = $("#fCpf");
  cpfInput.addEventListener("input", () => { cpfInput.value = mascaraCpf(cpfInput.value); });

  $("#payerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = $("#fName").value.trim();
    const cpf  = onlyDigits($("#fCpf").value);
    const err  = $("#formError");

    if (nome.length < 3) { err.textContent = "Digite seu nome completo."; return; }
    if (cpf.length !== 11) { err.textContent = "CPF inválido. Digite os 11 números."; return; }
    if (!cpfValido(cpf)) { err.textContent = "Esse CPF não é válido. Confira os números."; return; }

    err.textContent = "";
    criarPagamento(nome, cpf);
  });
}

function mascaraCpf(v) {
  v = onlyDigits(v).slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
function onlyDigits(s) { return (s || "").replace(/\D/g, ""); }

// validação real de CPF (dígitos verificadores)
function cpfValido(cpf) {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(cpf[i]) * (10 - i);
  let d1 = (soma * 10) % 11; if (d1 === 10) d1 = 0;
  if (d1 !== parseInt(cpf[9])) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(cpf[i]) * (11 - i);
  let d2 = (soma * 10) % 11; if (d2 === 10) d2 = 0;
  return d2 === parseInt(cpf[10]);
}


/* ===================== CRIAR PAGAMENTO (chama o backend) ===================== */
async function criarPagamento(nome, cpf) {
  chatFooter.innerHTML = `
    <div class="pix">
      <div class="pix__waiting"><span class="spinner"></span> Gerando seu PIX...</div>
    </div>`;

  try {
    const resp = await fetch(CONFIG.apiBase + "/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purpose: "chat",
        payerName: nome,
        payerDocument: cpf,        // só dígitos
      }),
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data && data.error ? data.error : "Falha ao gerar o pagamento.");
    }

    pedido.paymentId = data.paymentId;
    mostrarPix(data);
    iniciarPolling();

  } catch (e) {
    // "Failed to fetch" = o navegador não conseguiu alcançar o backend.
    const erroDeRede = (e instanceof TypeError) || /fetch|network|conex/i.test(e.message || "");
    const msg = erroDeRede
      ? "Não consegui falar com o servidor de pagamento. Confira se o backend está no ar e se você abriu o site por um endereço http (ex.: http://localhost:3000) — não abrindo o arquivo direto."
      : (e.message || "Não foi possível gerar o pagamento.");
    mostrarErro(msg);
  }
}

function mostrarErro(msg) {
  chatFooter.innerHTML = `
    <div class="pix">
      <p class="form__error" style="text-align:center">${msg}</p>
      <button class="btn btn--ghost" id="retryBtn" type="button">Tentar novamente</button>
    </div>`;
  $("#retryBtn").addEventListener("click", () => mostrarFormulario(pedido.purpose));
}


/* ===================== TELA DO PIX ===================== */
function mostrarPix(data) {
  const preco = CONFIG.chatPreco;
  const qr = data.qrCodeBase64 || data.qrcodeUrl || "";
  const copia = data.copyPaste || "";

  chatFooter.innerHTML = `
    <div class="pix">
      <div class="pix__title">Pagamento via PIX</div>
      <div class="pix__amount">${reais(preco)}</div>
      <div class="pix__qr">${qr ? `<img src="${qr}" alt="QR Code do PIX" />` : "QR indisponível"}</div>
      <div class="pix__label">PIX Copia e Cola</div>
      <div class="pix__code" id="pixCode">${copia || "—"}</div>
      <button class="btn" id="copyBtn" type="button">Copiar código PIX</button>
      <div class="pix__waiting"><span class="spinner"></span> Aguardando pagamento...</div>
      <button class="btn btn--ghost" id="checkBtn" type="button" style="margin-top:4px">Já paguei, verificar</button>
    </div>`;

  $("#copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(copia);
    } catch (e) {
      // fallback antigo
      const tmp = document.createElement("textarea");
      tmp.value = copia; document.body.appendChild(tmp); tmp.select();
      document.execCommand("copy"); tmp.remove();
    }
    const b = $("#copyBtn");
    b.textContent = "PIX copiado!";
    setTimeout(() => { b.textContent = "Copiar código PIX"; }, 2000);
  });

  $("#checkBtn").addEventListener("click", verificarStatus);
}


/* ===================== VERIFICAÇÃO DO PAGAMENTO (polling) ===================== */
// A confirmação REAL acontece no backend, via webhook da MisticPay.
// Aqui o navegador só PERGUNTA ao backend se já foi confirmado.
function iniciarPolling() {
  if (pedido.polling) clearInterval(pedido.polling);
  pedido.polling = setInterval(verificarStatus, 3500);
}

async function verificarStatus() {
  if (!pedido.paymentId) return;
  try {
    const resp = await fetch(CONFIG.apiBase + "/api/payment-status?paymentId=" + encodeURIComponent(pedido.paymentId));
    const data = await resp.json();
    if (data && data.status === "COMPLETO") {
      if (pedido.polling) { clearInterval(pedido.polling); pedido.polling = null; }
      pagamentoConfirmado(data);
    }
  } catch (e) { /* tenta de novo no próximo ciclo */ }
}


/* ===================== APÓS CONFIRMAÇÃO ===================== */
async function pagamentoConfirmado(data) {
  // mostra confirmação e libera o WhatsApp (vindo do backend, só após pago)
  chatFooter.innerHTML = `
    <div class="done">
      <div class="done__check">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"></path></svg>
      </div>
      <div class="done__title">Pagamento confirmado!</div>
      <div class="done__text">Pronto ❤️ agora podemos conversar.</div>
    </div>`;
  beep();

  // mensagem liberada no corpo do chat
  await digitando(1200);
  addMsg(CONFIG.mensagemLiberado, "in");
  beep();

  // botão de WhatsApp (o link vem do backend, só depois de pago)
  const wa = data.whatsapp; // ex.: https://wa.me/55XXXXXXXXXXX?text=...
  setTimeout(() => {
    chatFooter.innerHTML = `
      ${wa ? `<a class="btn btn--wa" href="${wa}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.5 15.2L2 22l4.9-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-2.9.8.8-2.8-.2-.3A8 8 0 1 1 12 20zm4.4-6c-.2-.1-1.4-.7-1.6-.8s-.4-.1-.5.1-.6.8-.8 1-.3.2-.5.1a6.5 6.5 0 0 1-1.9-1.2 7.2 7.2 0 0 1-1.3-1.7c-.1-.2 0-.4.1-.5l.4-.4.2-.4v-.4l-.8-1.9c-.2-.5-.4-.4-.5-.4h-.5a1 1 0 0 0-.7.3A2.8 2.8 0 0 0 6 8.9a4.9 4.9 0 0 0 1 2.6 11.2 11.2 0 0 0 4.3 3.8c1.9.7 1.9.5 2.3.5.5 0 1.4-.6 1.6-1.1a2 2 0 0 0 .1-1.1c0-.1-.2-.2-.4-.3z"></path></svg>
        Abrir conversa no WhatsApp
      </a>
      <p class="muted">Respondo assim que estiver online 💬</p>`
      : `<p class="muted">Pagamento confirmado, mas o contato não foi configurado. Defina WHATSAPP_CONTACT no backend.</p>`}
    `;
  }, 1600);
}


/* ===================== LIGA OS BOTÕES DA PÁGINA ===================== */
document.addEventListener("DOMContentLoaded", () => {
  aplicarConfig();
  $("#onlineBtn").addEventListener("click", iniciarChat);
  // Avisa no console se o site foi aberto pelo arquivo direto (file://),
  // caso em que o pagamento não consegue falar com o backend.
  if (location.protocol === "file:") {
    console.warn("Abra o site por http://localhost:3000 (npm run dev), não pelo arquivo direto, senão o pagamento não conecta.");
  }
  // O card do Pack e as redes já abrem pelos próprios links (href).
});
