import { getDb } from './database';

export interface Game {
    id: string;
    title: string;
    displayType: 'baseParent' | 'standaloneHack' | 'variant';
    parentGameId?: string | null;
    localFilePath?: string | null;
    patchFilePath?: string | null;
    customBoxArtPath?: string | null;
    console: 'GBA' | 'NDS' | 'GBC' | 'NES' | 'SNES' | 'Unknown';
    fileHash?: string | null;
    updatedAt: number;
}

export const getAllGames = async (): Promise<Game[]> => {
    try {
        const db = await getDb();
        const result = await db.getAllAsync<Game>('SELECT * FROM games;');
        return result;
    } catch (e) {
        console.warn('getAllGames failed, possibly db not initialized:', e);
        return [];
    }
};

export const getVariantsForParent = async (parentId: string): Promise<Game[]> => {
    try {
        const db = await getDb();
        const result = await db.getAllAsync<Game>('SELECT * FROM games WHERE parentGameId = ?;', [parentId]);
        return result;
    } catch (e) {
        console.warn('getVariantsForParent failed:', e);
        return [];
    }
};

export const insertGame = async (game: Game): Promise<void> => {
    try {
        const db = await getDb();
        await db.runAsync(
            `INSERT INTO games (id, title, displayType, parentGameId, localFilePath, patchFilePath, customBoxArtPath, console, fileHash, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
                game.id,
                game.title,
                game.displayType,
                game.parentGameId || null,
                game.localFilePath || null,
                game.patchFilePath || null,
                game.customBoxArtPath || null,
                game.console,
                game.fileHash || null,
                game.updatedAt
            ]
        );
    } catch (e) {
        console.warn('insertGame failed:', e);
    }
};

export const updateGame = async (game: Game): Promise<void> => {
    try {
        const db = await getDb();
        await db.runAsync(
            `UPDATE games SET title = ?, displayType = ?, parentGameId = ?, localFilePath = ?, patchFilePath = ?, customBoxArtPath = ?, console = ?, fileHash = ?, updatedAt = ? WHERE id = ?;`,
            [
                game.title,
                game.displayType,
                game.parentGameId || null,
                game.localFilePath || null,
                game.patchFilePath || null,
                game.customBoxArtPath || null,
                game.console,
                game.fileHash || null,
                game.updatedAt,
                game.id
            ]
        );
    } catch (e) {
        console.warn('updateGame failed:', e);
    }
};

export const deleteGame = async (id: string): Promise<void> => {
    try {
        const db = await getDb();
        await db.runAsync('DELETE FROM games WHERE id = ?;', [id]);
    } catch (e) {
        console.warn('deleteGame failed:', e);
    }
};
