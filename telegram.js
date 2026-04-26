const TelegramBot = require('node-telegram-bot-api');
const path = require('path');
const fs = require('fs');
const { saveSticker } = require('./database');
const { processMediaToSticker } = require('./processor');

async function initTelegramBot(token, db) {
    const bot = new TelegramBot(token, { polling: true });
    const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '5511999999999';

    console.log('Bot do Telegram iniciado...');

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        
        const isPhoto = msg.photo;
        const isVideo = msg.video || msg.animation;
        const isSticker = msg.sticker;

        if (!isPhoto && !isVideo && !isSticker) return;

        try {
            bot.sendMessage(chatId, 'Processando sua figurinha... ⏳');

            let fileId;
            let isAnimated = false;

            if (isPhoto) {
                fileId = msg.photo[msg.photo.length - 1].file_id;
            } else if (msg.video) {
                fileId = msg.video.file_id;
                isAnimated = true;
            } else if (msg.animation) {
                fileId = msg.animation.file_id;
                isAnimated = true;
            } else if (isSticker) {
                fileId = msg.sticker.file_id;
                isAnimated = msg.sticker.is_animated || msg.sticker.is_video;
            }

            const fileLink = await bot.getFileLink(fileId);
            const response = await fetch(fileLink);
            const buffer = Buffer.from(await response.arrayBuffer());

            const outputPath = await processMediaToSticker(buffer, isAnimated);
            const code = await saveSticker(db, outputPath);

            const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${code}`;
            bot.sendMessage(chatId, `✅ Figurinha gerada!\n\nCódigo: *${code}*\n\nClique no link abaixo para resgatar no WhatsApp:\n${waLink}`, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('Erro no Telegram Bot:', error);
            bot.sendMessage(chatId, `❌ Erro ao processar: ${error.message}`);
        }
    });

    return bot;
}

module.exports = { initTelegramBot };
