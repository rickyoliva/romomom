import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
    if (db) return db;
    db = await SQLite.openDatabaseAsync('romomom.db');
    return db;
};

export const initDb = async () => {
    const database = await getDb();
    await database.execAsync(`
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY NOT NULL,
            title TEXT NOT NULL,
            displayType TEXT NOT NULL CHECK(displayType IN ('baseParent', 'standaloneHack', 'variant')),
            parentGameId TEXT,
            localFilePath TEXT NOT NULL,
            customBoxArtPath TEXT,
            console TEXT NOT NULL CHECK(console IN ('GBA', 'NDS', 'GBC', 'NES', 'SNES', 'Unknown')),
            fileHash TEXT,
            updatedAt INTEGER NOT NULL,
            FOREIGN KEY (parentGameId) REFERENCES games (id) ON DELETE CASCADE
        );
    `);
};
