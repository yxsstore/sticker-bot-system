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
                    .inputOptions(['-t', '6'])
                    .outputOptions([
                        '-vcodec', 'libwebp',
                        '-vf', "scale=512:512:force_original_aspect_ratio=increase,crop=512:512",
                        '-q:v', '30',
                        '-loop', '0',
                        '-preset', 'picture',
                        '-an',
                        '-vsync', '0'
                    ])
                    .toFormat('webp')
                    .on('start', (cmd) => console.log('FFmpeg command:', cmd))
                    .on('end', resolve)
                    .on('error', (err) => {
                        console.error('FFmpeg Error:', err.message);
                        reject(err);
                    })
                    .save(outputPath);
            });

            const stats = fs.statSync(outputPath);
            if (stats.size > 1000000) {
                const smallPath = outputPath + '_small.webp';
                await new Promise((resolve, reject) => {
                    ffmpeg(outputPath)
                        .outputOptions(['-vcodec', 'libwebp', '-q:v', '15'])
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
            image.cover({ w: 512, h: 512 });
            await image.write(pngPath);

            await new Promise((resolve, reject) => {
                ffmpeg(pngPath)
                    .outputOptions(['-vcodec', 'libwebp', '-lossless', '1', '-q:v', '90'])
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
