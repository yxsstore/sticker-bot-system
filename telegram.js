const TelegramBot = require('node-telegram-bot-api');
const Jimp = require('jimp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const path = require('path');
const fs = require('fs');
const { saveSticker } = require('./database');

async function initTelegramBot(token, db) {
    const bot = new TelegramBot(token, { polling: true });
    const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '5511999999999';

    console.log('Bot do Telegram iniciado...');

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        
        const isPhoto = msg.photo;
        const isVideo = msg.video || msg.animation;
        const isSticker = msg.sticker;

        if (!isPhoto && !isVideo && !isSticker) {
            return bot.sendMessage(chatId, 'Por favor, envie uma imagem, vídeo ou GIF para transformar em figurinha.');
        }

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
            const tempInputPath = path.join(__dirname, 'stickers', `temp_${Date.now()}`);
            const outputPath = path.join(__dirname, 'stickers', `${Date.now()}.webp`);

            // Download do arquivo
            const response = await fetch(fileLink);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(tempInputPath, Buffer.from(buffer));

            if (isAnimated) {
                await new Promise((resolve, reject) => {
                    ffmpeg(tempInputPath)
                        .size('512x512')
                        .aspect('1:1')
                        .fps(15)
                        .duration(5)
                        .outputOptions([
                            '-vcodec', 'libwebp',
                            '-lossless', '0',
                            '-compression_level', '6',
                            '-q:v', '50',
                            '-loop', '0',
                            '-preset', 'picture',
                            '-an',
                            '-vsync', '0'
                        ])
                        .toFormat('webp')
                        .on('end', resolve)
                        .on('error', reject)
                        .save(outputPath);
                });
            } else {
                // Usar Jimp para redimensionar e salvar como PNG temporário, depois converter para WebP via ffmpeg
                // (Jimp não suporta WebP nativamente para escrita, mas ffmpeg sim)
                const image = await Jimp.read(tempInputPath);
                await image
                    .contain(512, 512)
                    .writeAsync(tempInputPath + '.png');

                await new Promise((resolve, reject) => {
                    ffmpeg(tempInputPath + '.png')
                        .toFormat('webp')
                        .on('end', resolve)
                        .on('error', reject)
                        .save(outputPath);
                });
                
                if (fs.existsSync(tempInputPath + '.png')) fs.unlinkSync(tempInputPath + '.png');
            }

            const code = await saveSticker(db, outputPath);
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);

            const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${code}`;
            bot.sendMessage(chatId, `✅ Figurinha gerada!\n\nCódigo: *${code}*\n\nClique no link abaixo para resgatar no WhatsApp:\n${waLink}`, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('Erro no Telegram Bot:', error);
            bot.sendMessage(chatId, 'Ocorreu um erro ao processar seu arquivo.');
        }
    });

    return bot;
}

module.exports = { initTelegramBot };
