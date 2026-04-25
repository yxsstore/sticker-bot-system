const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { getStickerByCode } = require('./database');

async function initWhatsAppBot(db) {
    const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'data', 'auth_info_baileys'));

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        browser: ['StickerBot', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('Escaneie o QR Code abaixo para conectar o WhatsApp:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom) ? 
                lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut : true;
            console.log('Conexão fechada devido a ', lastDisconnect.error, ', reconectando: ', shouldReconnect);
            if (shouldReconnect) {
                initWhatsAppBot(db);
            }
        } else if (connection === 'open') {
            console.log('Conexão com WhatsApp aberta com sucesso!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     '';

        // Verificar se a mensagem é um código (5 caracteres, letras e números)
        const codeMatch = text.trim().toUpperCase().match(/^[A-Z0-9]{5}$/);
        
        if (codeMatch) {
            const code = codeMatch[0];
            console.log(`Código recebido: ${code} de ${remoteJid}`);

            try {
                const stickerData = await getStickerByCode(db, code);

                if (stickerData && fs.existsSync(stickerData.file_path)) {
                    await sock.sendMessage(remoteJid, { 
                        sticker: fs.readFileSync(stickerData.file_path) 
                    });
                    console.log(`Figurinha enviada para ${code}`);
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '❌ Código não encontrado ou figurinha expirada.' 
                    });
                }
            } catch (error) {
                console.error('Erro ao enviar figurinha no WhatsApp:', error);
            }
        }
    });

    return sock;
}

module.exports = { initWhatsAppBot };
