const TelegramBot = require('node-telegram-bot-api');
const { Jimp } = require('jimp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const path = require('path');
const fs = require('fs');
const { saveSticker } = require('./database');
const webpmux = require('node-webpmux');

async function addMetadata(imagePath, packname = 'StickerBot', author = 'YXS Store') {
    const img = new webpmux.Image();
    await img.load(imagePath);
    
    const exif = {
        "sticker-pack-id": "com.yxsstore.stickerbot",
        "sticker-pack-name": packname,
        "sticker-pack-publisher": author,
        "emojis": ["✅"]
    };

    const exifHeader = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
    const jsonPayload = Buffer.from(JSON.stringify(exif), 'utf-8');
    const exifData = Buffer.concat([exifHeader, jsonPayload]);
    
    // Ajustar o tamanho no header EXIF
    exifData.writeUInt32LE(jsonPayload.length, 18);
    
    img.exif = exifData;
    await img.save(imagePath);
}

async function initTelegramBot(token, db) {
    const bot = new TelegramBot(token, { polling: true });
    const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || '5511999999999';

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
            const timestamp = Date.now();
            const tempInputPath = path.join(stickersDir, `temp_${timestamp}`);
            const outputPath = path.join(stickersDir, `${timestamp}.webp`);

            const response = await fetch(fileLink);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(tempInputPath, Buffer.from(buffer));

            if (isAnimated) {
                await new Promise((resolve, reject) => {
                    ffmpeg(tempInputPath)
                        .inputOptions(['-t', '5'])
                        .outputOptions([
                            '-vcodec', 'libwebp',
                            '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
                            '-lossless', '0',
                            '-q:v', '40',
                            '-loop', '0',
                            '-preset', 'default',
                            '-an',
                            '-vsync', '0'
                        ])
                        .toFormat('webp')
                        .on('end', resolve)
                        .on('error', reject)
                        .save(outputPath);
                });
            } else {
                const image = await Jimp.read(tempInputPath);
                const pngPath = tempInputPath + '.png';
                image.contain({ w: 512, h: 512 });
                await image.write(pngPath);

                await new Promise((resolve, reject) => {
                    ffmpeg(pngPath)
                        .toFormat('webp')
                        .on('end', resolve)
                        .on('error', reject)
                        .save(outputPath);
                });
                
                if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
            }

            // Adicionar Metadados (Pack e Autor)
            try {
                await addMetadata(outputPath, 'StickerBot Pack', 'YXS Store');
            } catch (metaErr) {
                console.error('Erro ao adicionar metadados:', metaErr);
            }

            const code = await saveSticker(db, outputPath);
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);

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
