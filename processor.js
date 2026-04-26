const { Jimp } = require('jimp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const path = require('path');
const fs = require('fs');
const webpmux = require('node-webpmux');

const stickersDir = path.join(__dirname, 'stickers');
if (!fs.existsSync(stickersDir)) {
    fs.mkdirSync(stickersDir, { recursive: true });
}

async function addMetadata(imagePath, packname = 'StickerBot Pack', author = 'YXS Store') {
    try {
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
        
        exifData.writeUInt32LE(jsonPayload.length, 18);
        
        img.exif = exifData;
        await img.save(imagePath);
    } catch (e) {
        console.error('Erro ao adicionar metadados:', e);
    }
}

async function processMediaToSticker(inputBuffer, isAnimated) {
    const timestamp = Date.now();
    const tempInputPath = path.join(stickersDir, `temp_${timestamp}`);
    const outputPath = path.join(stickersDir, `${timestamp}.webp`);

    fs.writeFileSync(tempInputPath, inputBuffer);

    try {
        if (isAnimated) {
            await new Promise((resolve, reject) => {
                ffmpeg(tempInputPath)
                    .inputOptions(['-t', '10']) // Suporte a até 10 segundos
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

        await addMetadata(outputPath);
        
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        return outputPath;
    } catch (error) {
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        throw error;
    }
}

module.exports = { processMediaToSticker };
