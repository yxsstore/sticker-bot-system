const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

async function setupDb() {
    const db = await open({
        filename: path.join(__dirname, 'data', 'database.sqlite'),
        driver: sqlite3.Database
    });

    await db.exec(`
        CREATE TABLE IF NOT EXISTS stickers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE,
            file_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    return db;
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
    let code;
    let exists = true;
    
    // Garantir que o código seja único
    while (exists) {
        code = generateCode();
        const row = await db.get('SELECT id FROM stickers WHERE code = ?', [code]);
        if (!row) exists = false;
    }

    await db.run('INSERT INTO stickers (code, file_path) VALUES (?, ?)', [code, filePath]);
    return code;
}

async function getStickerByCode(db, code) {
    return await db.get('SELECT file_path FROM stickers WHERE code = ?', [code]);
}

module.exports = { setupDb, saveSticker, getStickerByCode };
