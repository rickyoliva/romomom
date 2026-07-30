import { getAllGames, getVariantsForParent, insertGame, updateGame, deleteGame, Game } from './gameRepository';
import { getDb } from './database';

// Mock the database module
jest.mock('./database', () => ({
    getDb: jest.fn(),
}));

describe('gameRepository', () => {
    let mockDb: {
        getAllAsync: jest.Mock;
        runAsync: jest.Mock;
        execAsync: jest.Mock;
    };

    beforeEach(() => {
        // Reset mocks before each test
        jest.clearAllMocks();

        // Create a new mock database object
        mockDb = {
            getAllAsync: jest.fn(),
            runAsync: jest.fn(),
            execAsync: jest.fn(),
        };

        // Setup getDb to return our mock
        (getDb as jest.Mock).mockResolvedValue(mockDb);

        // Mock console.warn to suppress output during tests, but we can also assert on it if needed
        jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        (console.warn as jest.Mock).mockRestore();
    });

    const mockGame: Game = {
        id: '1',
        title: 'Super Mario Bros',
        displayType: 'baseParent',
        console: 'NES',
        updatedAt: 1234567890
    };

    describe('getAllGames', () => {
        it('should return all games successfully', async () => {
            const expectedGames = [mockGame];
            mockDb.getAllAsync.mockResolvedValueOnce(expectedGames);

            const result = await getAllGames();

            expect(getDb).toHaveBeenCalled();
            expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT * FROM games;');
            expect(result).toEqual(expectedGames);
        });

        it('should return an empty array and warn if an error occurs', async () => {
            const error = new Error('DB Error');
            mockDb.getAllAsync.mockRejectedValueOnce(error);

            const result = await getAllGames();

            expect(console.warn).toHaveBeenCalledWith('getAllGames failed, possibly db not initialized:', error);
            expect(result).toEqual([]);
        });
    });

    describe('getVariantsForParent', () => {
        it('should return variants for a given parent successfully', async () => {
            const parentId = '1';
            const expectedVariants = [{ ...mockGame, id: '2', displayType: 'variant', parentGameId: parentId }];
            mockDb.getAllAsync.mockResolvedValueOnce(expectedVariants);

            const result = await getVariantsForParent(parentId);

            expect(getDb).toHaveBeenCalled();
            expect(mockDb.getAllAsync).toHaveBeenCalledWith('SELECT * FROM games WHERE parentGameId = ?;', [parentId]);
            expect(result).toEqual(expectedVariants);
        });

        it('should return an empty array and warn if an error occurs', async () => {
            const error = new Error('DB Error');
            const parentId = '1';
            mockDb.getAllAsync.mockRejectedValueOnce(error);

            const result = await getVariantsForParent(parentId);

            expect(console.warn).toHaveBeenCalledWith('getVariantsForParent failed:', error);
            expect(result).toEqual([]);
        });
    });

    describe('insertGame', () => {
        it('should insert a game successfully with minimal fields', async () => {
            await insertGame(mockGame);

            expect(getDb).toHaveBeenCalled();
            expect(mockDb.runAsync).toHaveBeenCalledWith(
                `INSERT INTO games (id, title, displayType, parentGameId, localFilePath, patchFilePath, customBoxArtPath, console, fileHash, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
                [
                    mockGame.id,
                    mockGame.title,
                    mockGame.displayType,
                    null,
                    null,
                    null,
                    null,
                    mockGame.console,
                    null,
                    mockGame.updatedAt
                ]
            );
        });

        it('should insert a game successfully with all fields', async () => {
            const fullGame: Game = {
                ...mockGame,
                parentGameId: 'parent-1',
                localFilePath: '/path/to/rom.nes',
                patchFilePath: '/path/to/patch.ips',
                customBoxArtPath: '/path/to/art.png',
                fileHash: 'abcd123'
            };

            await insertGame(fullGame);

            expect(mockDb.runAsync).toHaveBeenCalledWith(
                expect.any(String),
                [
                    fullGame.id,
                    fullGame.title,
                    fullGame.displayType,
                    fullGame.parentGameId,
                    fullGame.localFilePath,
                    fullGame.patchFilePath,
                    fullGame.customBoxArtPath,
                    fullGame.console,
                    fullGame.fileHash,
                    fullGame.updatedAt
                ]
            );
        });

        it('should warn if an error occurs during insert', async () => {
            const error = new Error('Insert Error');
            mockDb.runAsync.mockRejectedValueOnce(error);

            await insertGame(mockGame);

            expect(console.warn).toHaveBeenCalledWith('insertGame failed:', error);
        });
    });

    describe('updateGame', () => {
        it('should update a game successfully', async () => {
            await updateGame(mockGame);

            expect(getDb).toHaveBeenCalled();
            expect(mockDb.runAsync).toHaveBeenCalledWith(
                `UPDATE games SET title = ?, displayType = ?, parentGameId = ?, localFilePath = ?, patchFilePath = ?, customBoxArtPath = ?, console = ?, fileHash = ?, updatedAt = ? WHERE id = ?;`,
                [
                    mockGame.title,
                    mockGame.displayType,
                    null,
                    null,
                    null,
                    null,
                    mockGame.console,
                    null,
                    mockGame.updatedAt,
                    mockGame.id
                ]
            );
        });

        it('should warn if an error occurs during update', async () => {
            const error = new Error('Update Error');
            mockDb.runAsync.mockRejectedValueOnce(error);

            await updateGame(mockGame);

            expect(console.warn).toHaveBeenCalledWith('updateGame failed:', error);
        });
    });

    describe('deleteGame', () => {
        it('should delete a game successfully', async () => {
            const id = '1';
            await deleteGame(id);

            expect(getDb).toHaveBeenCalled();
            expect(mockDb.runAsync).toHaveBeenCalledWith('DELETE FROM games WHERE id = ?;', [id]);
        });

        it('should warn if an error occurs during delete', async () => {
            const id = '1';
            const error = new Error('Delete Error');
            mockDb.runAsync.mockRejectedValueOnce(error);

            await deleteGame(id);

            expect(console.warn).toHaveBeenCalledWith('deleteGame failed:', error);
        });
    });
});
