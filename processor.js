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
                    .inputOptions(['-t', '6']) // Reduzido para 6 segundos para garantir tamanho < 1MB
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-vf', "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000",
                        '-lossless', '0',
                        '-q:v', '30', // Qualidade reduzida para garantir que fique abaixo de 1MB
                        '-compression_level', '6',
                        '-loop', '0',
                        '-an',
                        '-vsync', '0'
                    ])
                    .toFormat('webp')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            // Verificação de tamanho (WhatsApp limita a 1MB)
            const stats = fs.statSync(outputPath);
            if (stats.size > 1000000) {
                console.log('Figurinha muito grande, tentando compressão extra...');
                await new Promise((resolve, reject) => {
                    ffmpeg(outputPath)
                        .outputOptions([
                            '-vcodec', 'libwebp',
                            '-lossless', '0',
                            '-q:v', '15', // Compressão extrema se ainda estiver grande
                            '-compression_level', '6'
                        ])
                        .toFormat('webp')
                        .on('end', resolve)
                        .on('error', reject)
                        .save(outputPath + '_small.webp');
                });
                fs.renameSync(outputPath + '_small.webp', outputPath);
            }
        } else {
            const image = await Jimp.read(tempInputPath);
            const pngPath = tempInputPath + '.png';
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

        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        return outputPath;
    } catch (error) {
        console.error('Erro no processamento de mídia:', error);
        if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
        throw error;
    }
}

module.exports = { processMediaToSticker };
