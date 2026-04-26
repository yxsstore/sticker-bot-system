const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { getStickerByCode } = require('./database');
const { processMediaToSticker } = require('./processor');

async function initWhatsAppBot(db, handlers = {}) {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadContentFromMessage } = await import('@whiskeysockets/baileys');
    const { Boom } = await import('@hapi/boom');

    const authPath = path.join(__dirname, 'data', 'auth_info_baileys');
    
    const clearSession = () => {
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
        }
    };

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177'],
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            if (handlers.onQR) handlers.onQR(qr);
            qrcode.generate(qr, { small: true });
        }
        if (connection === 'close') {
            if (handlers.onDisconnected) handlers.onDisconnected();
            const statusCode = (lastDisconnect?.error instanceof Boom) ? lastDisconnect.error.output.statusCode : 0;
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                clearSession();
                setTimeout(() => initWhatsAppBot(db, handlers), 3000);
            } else {
                setTimeout(() => initWhatsAppBot(db, handlers), 5000);
            }
        } else if (connection === 'open') {
            if (handlers.onConnected) handlers.onConnected();
            console.log('✅ WhatsApp Conectado!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const messageType = Object.keys(msg.message)[0];
        
        // Obter texto da mensagem (legenda ou conversa)
        const caption = msg.message[messageType]?.caption || 
                        msg.message.conversation || 
                        msg.message.extendedTextMessage?.text || 
                        '';

        const isStickerCommand = caption.trim().toLowerCase() === '+s' || caption.trim().toLowerCase() === '+sticker';

        // 1. Lógica de Criação Direta (+s ou +sticker)
        if (isStickerCommand && (messageType === 'imageMessage' || messageType === 'videoMessage')) {
            try {
                console.log(`Comando de figurinha direta recebido de ${remoteJid}`);
                await sock.sendMessage(remoteJid, { text: 'Processando sua figurinha... ⏳' });

                const isAnimated = messageType === 'videoMessage';
                const stream = await downloadContentFromMessage(msg.message[messageType], isAnimated ? 'video' : 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }

                const outputPath = await processMediaToSticker(buffer, isAnimated);
                await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(outputPath) });
                
            } catch (error) {
                console.error('Erro ao criar figurinha direta no WhatsApp:', error);
                await sock.sendMessage(remoteJid, { text: '❌ Erro ao processar figurinha direta.' });
            }
            return;
        }

        // 2. Lógica de Resgate por Código (CHA2B)
        const codeMatch = caption.trim().toUpperCase().match(/^[A-Z0-9]{5}$/);
        if (codeMatch) {
            const code = codeMatch[0];
            try {
                const stickerData = await getStickerByCode(db, code);
                if (stickerData && fs.existsSync(stickerData.file_path)) {
                    await sock.sendMessage(remoteJid, { sticker: fs.readFileSync(stickerData.file_path) });
                } else {
                    await sock.sendMessage(remoteJid, { text: '❌ Código não encontrado.' });
                }
            } catch (error) {
                console.error('Erro ao enviar figurinha por código:', error);
            }
        }
    });

    return sock;
}

module.exports = { initWhatsAppBot };
