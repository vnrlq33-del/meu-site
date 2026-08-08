# Bio Site — Lavínia Carraro

Bio site premium, minimalista e responsivo, com pagamento **PIX real via MisticPay**.
O contato do WhatsApp é liberado **somente depois** que o pagamento é confirmado
pelo **webhook** (no backend) — nunca só porque o navegador disse que pagou.

- **Frontend:** HTML + CSS + JavaScript puro (sem React/Vue/Next).
- **Backend mínimo:** apenas para proteger o *Client Secret* da MisticPay e
  confirmar o pagamento com segurança.

---

## 📁 Estrutura

```
/
├── index.html                 # a página
├── style.css                  # o visual
├── script.js                  # a lógica + o bloco CONFIG (edite aqui!)
├── server.js                  # servidor para rodar tudo localmente
├── assets/
│   └── modelo.jpg             # sua foto (troque este arquivo)
├── api/
│   ├── _lib.js                # funções compartilhadas (não é uma rota)
│   ├── create-payment.js      # cria o PIX na MisticPay
│   ├── payment-status.js      # o site pergunta se já foi pago
│   └── misticpay-webhook.js   # a MisticPay confirma o pagamento aqui
├── package.json
├── .env.example               # modelo das credenciais (sem valores reais)
├── .gitignore
└── README.md
```

---

## ✏️ Como editar (sem saber programar)

Abra o arquivo **`script.js`** e edite **somente** o bloco `const CONFIG = { ... }`
lá no começo. É de lá que sai quase tudo:

| O que você quer trocar        | Campo no CONFIG        |
|-------------------------------|------------------------|
| Sua foto                      | `foto`                 |
| Seu nome                      | `nome`                 |
| Instagram                     | `instagram`            |
| TikTok                        | `tiktok`               |
| Telegram (card do Pack)       | `telegram`             |
| Nome do Pack                  | `packNome`             |
| Preço do Pack (texto exibido) | `packPreco`            |
| Preço do chat (exibido)       | `chatPreco`            |
| Mensagens do chat             | `mensagemInicial`, `mensagemPagamento`, `mensagemLiberado` |

### Trocar a foto
Coloque sua imagem na pasta `assets/` e ajuste o campo `foto` no CONFIG,
por exemplo: `foto: "assets/minhafoto.jpg"`. O jeito mais simples é substituir
o arquivo `assets/modelo.jpg` pela sua foto, mantendo o mesmo nome.

> ⚠️ **Importante sobre preços:** os campos de preço no CONFIG são apenas o que
> **aparece** na tela. O valor **realmente cobrado** é definido no backend, no
> arquivo `.env` (`PRICE_CHAT` e `PRICE_GIFT`). Isso é de propósito: impede que
> alguém altere o valor pelo navegador. Sempre deixe os dois iguais.

---

## 💬 Como o chat funciona (importante)

Quando a cliente abre o site e toca em **ONLINE AGORA**, aparece a animação de
"digitando", sua mensagem de boas-vindas e o somzinho de notificação. Em seguida,
para falar com você, ela paga o PIX. **Assim que o pagamento é confirmado**, o
site mostra o botão do seu **WhatsApp** (que fica guardado no backend e só é
revelado depois de pago) e a mensagem de que você responde quando estiver online.

Ou seja: é um serviço real. A pessoa paga e recebe, de fato, seu contato para
conversar com você.

---

## ▶️ Rodar localmente (na sua máquina)

Você precisa do **Node.js 18 ou superior** instalado.

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Crie o arquivo de credenciais a partir do modelo:
   ```bash
   cp .env.example .env
   ```
   Abra o `.env` e preencha (veja a seção MisticPay abaixo).
3. Inicie:
   ```bash
   npm run dev
   ```
4. Abra no navegador: **http://localhost:3000**

O visual do site já funciona sem backend. A parte de pagamento precisa das
credenciais no `.env`.

---

## 🔑 Configurar a MisticPay

No painel da MisticPay você tem um **Client ID** e um **Client Secret**.
Coloque-os no `.env`:

```
MISTICPAY_CLIENT_ID=seu_client_id
MISTICPAY_CLIENT_SECRET=seu_client_secret
PRICE_CHAT=12.90
PRICE_GIFT=12.90
WHATSAPP_CONTACT=5511999999999
```

- `WHATSAPP_CONTACT` = seu número só com números, com DDI e DDD
  (ex.: `55` + `11` + `999999999`).

O backend envia os headers exigidos pela documentação (`ci`, `cs`,
`Content-Type`) e chama `POST https://api.misticpay.com/api/transactions/create`
com os campos: `amount`, `payerName`, `payerDocument`, `transactionId`,
`description` e, opcionalmente, `projectWebhook`.

---

## 🔔 Configurar o webhook

O webhook é como a MisticPay avisa o seu backend que o pagamento foi pago.
Endereço do webhook do projeto:

```
https://SEU_DOMINIO/api/misticpay-webhook
```

O backend monta esse endereço sozinho a partir de `PUBLIC_BASE_URL` no `.env`.
Preencha, por exemplo:

```
PUBLIC_BASE_URL=https://seusite.vercel.app
WEBHOOK_TOKEN=um_texto_secreto_qualquer
```

Com `WEBHOOK_TOKEN` preenchido, o endereço do webhook vira
`.../api/misticpay-webhook?token=um_texto_secreto_qualquer` e chamadas sem esse
token são recusadas (proteção simples e recomendada).

### Testar o webhook localmente
Como o webhook precisa de um endereço público, use um túnel enquanto testa na
sua máquina (ex.: **ngrok**):

```bash
npx ngrok http 3000
```

Copie a URL `https://...ngrok...app` que aparecer e use como `PUBLIC_BASE_URL`
no `.env`. Reinicie o `npm run dev` depois de alterar o `.env`.

> **TODO / atenção:** a documentação fornecida **não descreve assinatura (HMAC)**
> do webhook. A proteção por `WEBHOOK_TOKEN` é uma medida simples. Se a MisticPay
> oferecer verificação de assinatura, adicione-a em `api/misticpay-webhook.js`.

---

## 🧠 Como a confirmação é feita com segurança

1. O site chama `POST /api/create-payment` → o backend cria a transação na
   MisticPay e a guarda como **PENDENTE**.
2. O site mostra o QR Code / copia-e-cola e fica **perguntando** ao backend
   (`GET /api/payment-status`) se já foi pago.
3. Quando a MisticPay chama `POST /api/misticpay-webhook`, o backend confere:
   - `transactionType === "DEPOSITO"`
   - `transactionMethod === "PIX"`
   - `status === "COMPLETO"`
   - se a transação existe (foi criada por nós) e se o valor bate;
   e só então muda o estado para **COMPLETO**.
4. É **idempotente**: o mesmo webhook não libera o pagamento duas vezes.
5. Só depois de **COMPLETO** o `payment-status` devolve o link do WhatsApp.

> **TODO / atenção:** a doc é ambígua sobre a **unidade** do campo `value` do
> webhook (parece estar em centavos). Por padrão o backend apenas **avisa** no
> log se o valor divergir. Depois de confirmar a unidade, você pode ativar a
> checagem estrita com `STRICT_AMOUNT_CHECK=true` no `.env`.

---

## 🚀 Publicar

### Opção A — Vercel (recomendada; site + API juntos)

A pasta `api/` já está no formato de funções da Vercel.

1. Suba o projeto para um repositório no GitHub (o `.env` **não** vai junto).
2. Em vercel.com, importe o repositório.
3. Em **Settings → Environment Variables**, cadastre as mesmas variáveis do
   `.env` (Client ID/Secret, preços, WhatsApp, `PUBLIC_BASE_URL`, `WEBHOOK_TOKEN`).
4. **Store compartilhado (obrigatório na Vercel):** em serverless, cada função
   roda isolada, então o webhook não enxerga a memória de quem criou o PIX.
   Crie um **Redis grátis no Upstash** (ou use o **Vercel KV**) e adicione:
   ```
   KV_REST_API_URL=...
   KV_REST_API_TOKEN=...
   ```
   O backend passa a usar esse armazém automaticamente. Sem isso, o pagamento
   é criado mas nunca "libera".
5. Defina `PUBLIC_BASE_URL` com a URL final da Vercel e configure o webhook na
   MisticPay para `https://SEU_DOMINIO/api/misticpay-webhook?token=...`.

### Opção B — Servidor único (Render, Railway, VPS)

Se preferir um servidor sempre ligado, rode `npm start` (usa `server.js`).
Nesse caso o armazém em memória já funciona e o Upstash é opcional. Basta
apontar `PUBLIC_BASE_URL` para o domínio do serviço.

---

## 🔒 Segurança (resumo)

- O **Client Secret** fica **apenas** no `.env` / variáveis de ambiente do
  servidor. Nunca no `index.html`, nunca no `script.js`, nunca no GitHub.
- O `.env` está no `.gitignore`.
- O backend **não** imprime o secret no log e **não** o devolve ao navegador.
- O valor cobrado é definido no servidor, não no navegador.
- O WhatsApp só é revelado após a confirmação do pagamento.

---

## ✅ Checklist antes de publicar

- [ ] Troquei a foto (`assets/modelo.jpg`) e preenchi o `CONFIG`.
- [ ] Coloquei Client ID/Secret no `.env` (ou nas variáveis da Vercel).
- [ ] `PRICE_CHAT` / `PRICE_GIFT` com o valor certo (e iguais ao CONFIG).
- [ ] `WHATSAPP_CONTACT` correto.
- [ ] `PUBLIC_BASE_URL` e webhook configurados na MisticPay.
- [ ] (Vercel) Upstash/Vercel KV configurado.
- [ ] Fiz um pagamento de teste e o chat liberou só após a confirmação.
