import { getDb } from './database';

export interface Game {
    id: string;
    title: string;
    displayType: 'baseParent' | 'standaloneHack' | 'variant';
    parentGameId?: string | null;
    localFilePath: string;
    customBoxArtPath?: string | null;
    console: 'GBA' | 'NDS' | 'GBC' | 'NES' | 'SNES' | 'Unknown';
    fileHash?: string | null;
    updatedAt: number;
}

export const getAllGames = async (): Promise<Game[]> => {
    const db = await getDb();
    const result = await db.getAllAsync<Game>('SELECT * FROM games;');
    return result;
};

export const getVariantsForParent = async (parentId: string): Promise<Game[]> => {
    const db = await getDb();
    const result = await db.getAllAsync<Game>('SELECT * FROM games WHERE parentGameId = ?;', [parentId]);
    return result;
};

export const insertGame = async (game: Game): Promise<void> => {
    const db = await getDb();
    await db.runAsync(
        `INSERT INTO games (id, title, displayType, parentGameId, localFilePath, customBoxArtPath, console, fileHash, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
            game.id,
            game.title,
            game.displayType,
            game.parentGameId || null,
            game.localFilePath,
            game.customBoxArtPath || null,
            game.console,
            game.fileHash || null,
            game.updatedAt
        ]
    );
};

export const deleteGame = async (id: string): Promise<void> => {
    const db = await getDb();
    await db.runAsync('DELETE FROM games WHERE id = ?;', [id]);
};
