require('dotenv').config();
const express = require('express');
const { setupDb } = require('./database');
const { initTelegramBot } = require('./telegram');
const { initWhatsAppBot } = require('./whatsapp');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;

let currentQR = null;
let isConnected = false;

// Rota para visualizar o QR Code ou status
app.get('/', async (req, res) => {
    if (isConnected) {
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h1 style="color:green;">✅ WhatsApp Conectado!</h1>
                <p>O sistema está operando 24/7.</p>
                <p>Envie mídias no Telegram para gerar figurinhas.</p>
            </div>
        `);
    }

    if (!currentQR) {
        return res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h1>⏳ Aguardando QR Code...</h1>
                <p>O sistema está iniciando. Atualize a página em alguns segundos.</p>
                <script>setTimeout(() => location.reload(), 5000);</script>
            </div>
        `);
    }

    try {
        const qrImage = await QRCode.toDataURL(currentQR);
        res.send(`
            <div style="text-align:center; font-family:sans-serif; margin-top:50px;">
                <h1>📱 Conectar WhatsApp</h1>
                <p>Escaneie o QR Code abaixo com seu WhatsApp:</p>
                <img src="${qrImage}" style="border: 10px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1);" />
                <p style="color: #666;">A página irá atualizar automaticamente após a conexão.</p>
                <script>
                    setInterval(async () => {
                        const res = await fetch('/status');
                        const data = await res.json();
                        if (data.connected) location.reload();
                    }, 3000);
                </script>
            </div>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar QR Code');
    }
});

// Rota de status para o frontend
app.get('/status', (req, res) => {
    res.json({ connected: isConnected });
});

async function start() {
    try {
        console.log('Iniciando sistema...');
        const db = await setupDb();

        const telegramToken = process.env.TELEGRAM_TOKEN;
        if (telegramToken) {
            await initTelegramBot(telegramToken, db);
        }

        // Iniciar WhatsApp e capturar eventos de QR e Conexão
        const waHandlers = {
            onQR: (qr) => {
                currentQR = qr;
                isConnected = false;
                console.log('Novo QR Code gerado.');
            },
            onConnected: () => {
                currentQR = null;
                isConnected = true;
                console.log('WhatsApp Conectado via Web!');
            },
            onDisconnected: () => {
                isConnected = false;
                console.log('WhatsApp Desconectado.');
            }
        };

        await initWhatsAppBot(db, waHandlers);

        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });

    } catch (error) {
        console.error('Erro ao iniciar:', error);
    }
}

start();
