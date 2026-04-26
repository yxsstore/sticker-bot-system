# Sticker Bot System (Telegram + WhatsApp)

Sistema integrado para criação de figurinhas via Telegram e WhatsApp.

## 🚀 Como manter o WhatsApp conectado (IMPORTANTE)

Para não precisar escanear o QR Code toda vez que o bot reiniciar no Render, você precisa configurar um **Disco Persistente**. Siga estes passos:

1.  No painel do seu serviço no **Render.com**, vá na aba **Disk**.
2.  Clique em **Add Disk**.
3.  Configure exatamente assim:
    *   **Name:** `bot-data`
    *   **Mount Path:** `/opt/render/project/src/data`
    *   **Size:** `1GB` (o mínimo já é suficiente)
4.  Clique em **Save**.

Isso criará uma pasta permanente que o Render **não apaga**. O bot salvará a sessão do WhatsApp e o banco de dados de figurinhas lá dentro. **Depois de adicionar o disco, você precisará escanear o QR Code uma última vez, e ele ficará salvo para sempre.**

## ⚙️ Configurações de Deploy no Render

*   **Build Command:** `npm install`
*   **Start Command:** `npm start`
*   **Node Version:** `20.11.0` (adicione como variável de ambiente `NODE_VERSION`)

## 📱 Comandos do WhatsApp
*   Envie uma imagem/vídeo com a legenda `+s` ou `+sticker` para criar instantaneamente.
*   Envie o código gerado no Telegram (ex: `CHA2B`) para resgatar uma figurinha.

## 🤖 Bot do Telegram
*   Envie qualquer mídia para receber o código de resgate e o link direto para o WhatsApp.

---
**Desenvolvido por Manus AI para YXS Store**
