const loki = require('lokijs');
const path = require('path');
const fs = require('fs');

async function setupDb() {
    const dbPath = path.join(__dirname, 'data', 'database.json');
    
    // Garantir que a pasta data existe
    if (!fs.existsSync(path.join(__dirname, 'data'))) {
        fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
    }

    const db = new loki(dbPath, {
        autoload: true,
        autoloadCallback: databaseInitialize,
        autosave: true, 
        autosaveInterval: 4000
    });

    function databaseInitialize() {
        let stickers = db.getCollection("stickers");
        if (stickers === null) {
            stickers = db.addCollection("stickers", { unique: ['code'] });
        }
    }

    // Promisify o carregamento do banco
    return new Promise((resolve) => {
        const check = () => {
            if (db.getCollection("stickers")) {
                resolve(db);
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

function generateCode(length = 5) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function saveSticker(db, filePath) {
    const stickers = db.getCollection("stickers");
    let code;
    let exists = true;
    
    while (exists) {
        code = generateCode();
        const row = stickers.findOne({ code: code });
        if (!row) exists = false;
    }

    stickers.insert({ code: code, file_path: filePath, created_at: new Date() });
    db.saveDatabase();
    return code;
}

async function getStickerByCode(db, code) {
    const stickers = db.getCollection("stickers");
    return stickers.findOne({ code: code });
}

module.exports = { setupDb, saveSticker, getStickerByCode };
