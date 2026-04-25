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

    // Garantir que a pasta de figurinhas existe
    const stickersDir = path.join(__dirname, 'stickers');
    if (!fs.existsSync(stickersDir)) {
        fs.mkdirSync(stickersDir, { recursive: true });
    }

    console.log('Bot do Telegram iniciado...');

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        
        const isPhoto = msg.photo;
        const isVideo = msg.video || msg.animation;
        const isSticker = msg.sticker;

        if (!isPhoto && !isVideo && !isSticker) {
            return; // Ignorar mensagens que não são mídia
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
            const timestamp = Date.now();
            const tempInputPath = path.join(stickersDir, `temp_${timestamp}`);
            const outputPath = path.join(stickersDir, `${timestamp}.webp`);

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
                        .on('error', (err) => {
                            console.error('Erro FFmpeg:', err);
                            reject(err);
                        })
                        .save(outputPath);
                });
            } else {
                const image = await Jimp.read(tempInputPath);
                const pngPath = tempInputPath + '.png';
                await image
                    .contain(512, 512)
                    .writeAsync(pngPath);

                await new Promise((resolve, reject) => {
                    ffmpeg(pngPath)
                        .toFormat('webp')
                        .on('end', resolve)
                        .on('error', (err) => {
                            console.error('Erro FFmpeg (conversão webp):', err);
                            reject(err);
                        })
                        .save(outputPath);
                });
                
                if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            }

            const code = await saveSticker(db, outputPath);
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);

            const waLink = `https://wa.me/${WHATSAPP_NUMBER}?text=${code}`;
            bot.sendMessage(chatId, `✅ Figurinha gerada!\n\nCódigo: *${code}*\n\nClique no link abaixo para resgatar no WhatsApp:\n${waLink}`, { parse_mode: 'Markdown' });

        } catch (error) {
            console.error('Erro detalhado no Telegram Bot:', error);
            bot.sendMessage(chatId, `❌ Erro ao processar: ${error.message || 'Erro desconhecido'}`);
        }
    });

    return bot;
}

module.exports = { initTelegramBot };
