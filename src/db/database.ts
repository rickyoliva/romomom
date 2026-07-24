import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDb = async () => {
    if (db) return db;
    db = await SQLite.openDatabaseAsync('romomom.db');
    return db;
};

export const initDb = async () => {
    const database = await getDb();

    // Check if table exists and if migration is needed
    const pragma = await database.getAllAsync('PRAGMA table_info(games);');
    const tableExists = pragma.length > 0;

    if (tableExists) {
        const hasPatchFilePath = pragma.some((col: any) => col.name === 'patchFilePath');

        if (!hasPatchFilePath) {
            // Perform schema migration safely without data loss
            await database.execAsync(`
                BEGIN TRANSACTION;

                ALTER TABLE games RENAME TO games_old;

                CREATE TABLE games (
                    id TEXT PRIMARY KEY NOT NULL,
                    title TEXT NOT NULL,
                    displayType TEXT NOT NULL CHECK(displayType IN ('baseParent', 'standaloneHack', 'variant')),
                    parentGameId TEXT,
                    localFilePath TEXT,
                    patchFilePath TEXT,
                    customBoxArtPath TEXT,
                    console TEXT NOT NULL CHECK(console IN ('GBA', 'NDS', 'GBC', 'NES', 'SNES', 'Unknown')),
                    fileHash TEXT,
                    updatedAt INTEGER NOT NULL,
                    FOREIGN KEY (parentGameId) REFERENCES games (id) ON DELETE CASCADE
                );

                INSERT INTO games (id, title, displayType, parentGameId, localFilePath, customBoxArtPath, console, fileHash, updatedAt)
                SELECT id, title, displayType, parentGameId, localFilePath, customBoxArtPath, console, fileHash, updatedAt FROM games_old;

                DROP TABLE games_old;

                COMMIT;
            `);
        }
    } else {
        // Initial creation
        await database.execAsync(`
            CREATE TABLE IF NOT EXISTS games (
                id TEXT PRIMARY KEY NOT NULL,
                title TEXT NOT NULL,
                displayType TEXT NOT NULL CHECK(displayType IN ('baseParent', 'standaloneHack', 'variant')),
                parentGameId TEXT,
                localFilePath TEXT,
                patchFilePath TEXT,
                customBoxArtPath TEXT,
                console TEXT NOT NULL CHECK(console IN ('GBA', 'NDS', 'GBC', 'NES', 'SNES', 'Unknown')),
                fileHash TEXT,
                updatedAt INTEGER NOT NULL,
                FOREIGN KEY (parentGameId) REFERENCES games (id) ON DELETE CASCADE
            );
        `);
    }
};
