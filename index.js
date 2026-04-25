require('dotenv').config();
const express = require('express');
const { setupDb } = require('./database');
const { initTelegramBot } = require('./telegram');
const { initWhatsAppBot } = require('./whatsapp');

const app = express();
const PORT = process.env.PORT || 3000;

// Rota simples para o Render manter o serviço ativo
app.get('/', (req, res) => {
    res.send('Sticker Bot System is running 24/7!');
});

async function start() {
    try {
        console.log('Iniciando sistema...');
        
        // 1. Configurar Banco de Dados
        const db = await setupDb();
        console.log('Banco de dados SQLite pronto.');

        // 2. Iniciar Bot do Telegram
        const telegramToken = process.env.TELEGRAM_TOKEN;
        if (!telegramToken) {
            console.error('ERRO: TELEGRAM_TOKEN não configurado no .env');
        } else {
            await initTelegramBot(telegramToken, db);
        }

        // 3. Iniciar Bot do WhatsApp
        await initWhatsAppBot(db);

        // 4. Iniciar Servidor Express
        app.listen(PORT, () => {
            console.log(`Servidor Express rodando na porta ${PORT}`);
        });

    } catch (error) {
        console.error('Erro ao iniciar o sistema:', error);
    }
}

start();
