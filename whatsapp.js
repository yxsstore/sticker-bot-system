const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { getStickerByCode } = require('./database');

async function initWhatsAppBot(db, handlers = {}) {
    const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = await import('@whiskeysockets/baileys');
    const { Boom } = await import('@hapi/boom');

    const authPath = path.join(__dirname, 'data', 'auth_info_baileys');
    
    // Função para limpar sessão em caso de erro crítico
    const clearSession = () => {
        if (fs.existsSync(authPath)) {
            console.log('Limpando sessão antiga para gerar novo QR Code...');
            fs.rmSync(authPath, { recursive: true, force: true });
        }
    };

    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    console.log(`Usando versão do WhatsApp Web: ${version.join('.')}`);

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        browser: ['Ubuntu', 'Chrome', '110.0.5481.177'], // Browser mais comum para evitar bloqueios
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            if (handlers.onQR) handlers.onQR(qr);
            qrcode.generate(qr, { small: true });
            console.log('QR Code gerado com sucesso.');
        }

        if (connection === 'close') {
            const statusCode = (lastDisconnect?.error instanceof Boom) ? 
                lastDisconnect.error.output.statusCode : 0;
            
            console.log('Conexão fechada. Status:', statusCode);

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log('Sessão inválida ou deslogada. Resetando...');
                if (handlers.onDisconnected) handlers.onDisconnected('Sessão inválida. Gerando novo QR...');
                clearSession();
                setTimeout(() => initWhatsAppBot(db, handlers), 3000);
            } else {
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log('Tentando reconectar:', shouldReconnect);
                if (shouldReconnect) {
                    setTimeout(() => initWhatsAppBot(db, handlers), 5000);
                }
            }
        } else if (connection === 'open') {
            if (handlers.onConnected) handlers.onConnected();
            console.log('✅ WhatsApp Conectado e pronto!');
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || 
                     msg.message.extendedTextMessage?.text || 
                     '';

        const codeMatch = text.trim().toUpperCase().match(/^[A-Z0-9]{5}$/);
        
        if (codeMatch) {
            const code = codeMatch[0];
            try {
                const stickerData = await getStickerByCode(db, code);
                if (stickerData && fs.existsSync(stickerData.file_path)) {
                    await sock.sendMessage(remoteJid, { 
                        sticker: fs.readFileSync(stickerData.file_path) 
                    });
                } else {
                    await sock.sendMessage(remoteJid, { 
                        text: '❌ Código não encontrado ou figurinha expirada.' 
                    });
                }
            } catch (error) {
                console.error('Erro ao enviar figurinha:', error);
            }
        }
    });

    return sock;
}

module.exports = { initWhatsAppBot };
