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
let lastError = null;

// Rota para visualizar o QR Code ou status
app.get('/', async (req, res) => {
    console.log(`Acesso à raiz. Status: Conectado=${isConnected}, QR=${!!currentQR}`);
    
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
                <p>O sistema está iniciando ou tentando gerar um novo código.</p>
                ${lastError ? `<p style="color:red;">Erro recente: ${lastError}</p>` : ''}
                <p>Esta página irá atualizar automaticamente.</p>
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
                <img src="${qrImage}" style="border: 10px solid #fff; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: 300px;" />
                <p style="color: #666;">A página irá atualizar automaticamente após a conexão.</p>
                <script>
                    setInterval(async () => {
                        try {
                            const res = await fetch('/status');
                            const data = await res.json();
                            if (data.connected) location.reload();
                        } catch (e) {}
                    }, 3000);
                </script>
            </div>
        `);
    } catch (err) {
        res.status(500).send('Erro ao gerar imagem do QR Code');
    }
});

app.get('/status', (req, res) => {
    res.json({ connected: isConnected, hasQR: !!currentQR });
});

async function start() {
    try {
        console.log('--- INICIANDO SISTEMA ---');
        
        // 1. Iniciar Servidor Express PRIMEIRO para garantir que a URL responda
        app.listen(PORT, () => {
            console.log(`✅ Servidor Web rodando na porta ${PORT}`);
        });

        // 2. Configurar Banco de Dados
        const db = await setupDb();
        console.log('✅ Banco de dados pronto.');

        // 3. Iniciar Bot do Telegram
        const telegramToken = process.env.TELEGRAM_TOKEN;
        if (telegramToken) {
            await initTelegramBot(telegramToken, db);
            console.log('✅ Bot do Telegram pronto.');
        }

        // 4. Iniciar WhatsApp
        const waHandlers = {
            onQR: (qr) => {
                currentQR = qr;
                isConnected = false;
                console.log('👉 Novo QR Code disponível para o site.');
            },
            onConnected: () => {
                currentQR = null;
                isConnected = true;
                console.log('🚀 WhatsApp Conectado com sucesso!');
            },
            onDisconnected: (reason) => {
                isConnected = false;
                lastError = reason || 'Desconectado';
                console.log('❌ WhatsApp Desconectado:', reason);
            }
        };

        console.log('Iniciando conexão com WhatsApp...');
        await initWhatsAppBot(db, waHandlers);

    } catch (error) {
        console.error('💥 Erro fatal na inicialização:', error);
        lastError = error.message;
    }
}

start();
