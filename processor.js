const { Jimp } = require('jimp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);
const path = require('path');
const fs = require('fs');

const stickersDir = path.join(__dirname, 'stickers');
if (!fs.existsSync(stickersDir)) {
    fs.mkdirSync(stickersDir, { recursive: true });
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
                    .inputOptions(['-t', '10'])
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-vf', "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000",
                        '-lossless', '0',
                        '-q:v', '50',
                        '-loop', '0',
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
            
            // Redimensionar de forma simples
            image.contain({ w: 512, h: 512 });
            await image.write(pngPath);

            await new Promise((resolve, reject) => {
                ffmpeg(pngPath)
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-lossless', '0',
                        '-q:v', '75'
                    ])
                    .toFormat('webp')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });
            
            if (fs.existsSync(pngPath)) fs.unlinkSync(pngPath);
        }

        // REMOVIDO: addMetadata (Metadados de Autor/Pack removidos para evitar bugs)
        
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        return outputPath;
    } catch (error) {
        console.error('Erro no processamento de mídia:', error);
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        throw error;
    }
}

module.exports = { processMediaToSticker };
