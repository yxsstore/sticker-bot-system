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
                    .inputOptions(['-t', '6', '-err_detect', 'ignore_err'])
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        // Filtro para forçar 1:1 (quadrado) com preenchimento transparente
                        '-vf', "scale='if(gt(iw,ih),512,-1)':'if(gt(iw,ih),-1,512)',pad=512:512:(512-iw)/2:(512-ih)/2:color=#00000000",
                        '-lossless', '0',
                        '-q:v', '30',
                        '-compression_level', '6',
                        '-loop', '0',
                        '-an',
                        '-vsync', '0',
                        '-pix_fmt', 'yuva420p'
                    ])
                    .toFormat('webp')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outputPath);
            });

            const stats = fs.statSync(outputPath);
            if (stats.size > 1000000) {
                const smallPath = outputPath + '_small.webp';
                await new Promise((resolve, reject) => {
                    ffmpeg(outputPath)
                        .outputOptions(['-vcodec', 'libwebp', '-lossless', '0', '-q:v', '15', '-compression_level', '6'])
                        .toFormat('webp')
                        .on('end', resolve)
                        .on('error', reject)
                        .save(smallPath);
                });
                fs.renameSync(smallPath, outputPath);
            }
        } else {
            const image = await Jimp.read(tempInputPath);
            const pngPath = tempInputPath + '.png';
            
            // Forçar redimensionamento para quadrado perfeito 512x512
            // O método 'contain' garante que a imagem caiba no quadrado sem distorcer, preenchendo o resto com transparência
            image.contain({ w: 512, h: 512 });
            await image.write(pngPath);

            await new Promise((resolve, reject) => {
                ffmpeg(pngPath)
                    .outputOptions(['-vcodec', 'libwebp', '-lossless', '0', '-q:v', '75'])
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
