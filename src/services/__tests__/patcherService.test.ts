import { patchRom } from '../patcherService';
import * as FileSystem from 'expo-file-system/legacy';
import { insertGame } from '../../db/gameRepository';
import RomPatcher from '../vendor/RomPatcher';
import BinFile from '../vendor/BinFile';
import { Buffer } from 'buffer';

// Mock dependencies
jest.mock('expo-file-system/legacy', () => ({
    readAsStringAsync: jest.fn(),
    writeAsStringAsync: jest.fn(),
    EncodingType: { Base64: 'base64' },
    documentDirectory: 'file:///mock/document/dir/'
}));

jest.mock('../../db/gameRepository', () => ({
    insertGame: jest.fn()
}));

// Mock Math.random for deterministic ID generation
const mockMathRandom = jest.spyOn(Math, 'random');

// We don't mock RomPatcher because we want to test with real binary fixtures to verify integration
// with the vendor lib, or we can partially mock it. Since the rationale explicitly mentions:
// "providing valid/invalid binary fixtures for RomPatcher", we will use the real RomPatcher with small mocked buffers.

describe('patchRom', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockMathRandom.mockReturnValue(0.123456789); // For predictable random ID: 'xjylrx'
    });

    afterAll(() => {
        mockMathRandom.mockRestore();
    });

    // Helper to create small IPS patches and ROMs
    const createBaseRomBase64 = () => {
        const buffer = Buffer.from([0x41, 0x41, 0x41, 0x41]); // 'AAAA'
        return buffer.toString('base64');
    };

    const createValidIpsPatchBase64 = () => {
        // Minimal valid IPS patch: PATCH + [offset] + [size] + [data] + EOF
        const patchData = Buffer.concat([
            Buffer.from('PATCH'),
            Buffer.from([0x00, 0x00, 0x00]), // offset 0
            Buffer.from([0x00, 0x01]),       // size 1
            Buffer.from([0x42]),             // replace first byte with 'B' (0x42)
            Buffer.from('EOF')
        ]);
        return patchData.toString('base64');
    };

    const createInvalidPatchBase64 = () => {
        // Invalid patch, just random garbage not starting with 'PATCH'
        const patchData = Buffer.from([0x12, 0x34, 0x56]);
        return patchData.toString('base64');
    };

    it('should successfully patch a ROM and insert it into the database', async () => {
        (FileSystem.readAsStringAsync as jest.Mock)
            .mockResolvedValueOnce(createBaseRomBase64()) // First call: base ROM
            .mockResolvedValueOnce(createValidIpsPatchBase64()); // Second call: patch file

        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
        (insertGame as jest.Mock).mockResolvedValue(undefined);

        const result = await patchRom(
            'file:///path/to/base.gba',
            'file:///path/to/patch.ips',
            'patched_game.gba',
            undefined,
            'GBA'
        );

        expect(result.success).toBe(true);
        expect(result.outputPath).toBe('file:///mock/document/dir/patched_game.gba');

        expect(FileSystem.readAsStringAsync).toHaveBeenCalledTimes(2);
        expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
            'file:///mock/document/dir/patched_game.gba',
            expect.any(String),
            { encoding: 'base64' }
        );

        expect(insertGame).toHaveBeenCalledWith({
            id: 'xjylrx', // Predictable due to Math.random mock
            title: 'patched_game.gba',
            displayType: 'standaloneHack',
            parentGameId: null,
            localFilePath: 'file:///mock/document/dir/patched_game.gba',
            console: 'GBA',
            updatedAt: expect.any(Number)
        });
    });

    it('should successfully patch a ROM and link to parent if parentId is provided', async () => {
        (FileSystem.readAsStringAsync as jest.Mock)
            .mockResolvedValueOnce(createBaseRomBase64())
            .mockResolvedValueOnce(createValidIpsPatchBase64());

        (FileSystem.writeAsStringAsync as jest.Mock).mockResolvedValue(undefined);
        (insertGame as jest.Mock).mockResolvedValue(undefined);

        const result = await patchRom(
            'file:///path/to/base.gba',
            'file:///path/to/patch.ips',
            'variant_game.gba',
            'parent_123',
            'GBA'
        );

        expect(result.success).toBe(true);
        expect(insertGame).toHaveBeenCalledWith(expect.objectContaining({
            displayType: 'variant',
            parentGameId: 'parent_123'
        }));
    });

    it('should return failure if RomPatcher fails to parse an invalid patch', async () => {
        (FileSystem.readAsStringAsync as jest.Mock)
            .mockResolvedValueOnce(createBaseRomBase64())
            .mockResolvedValueOnce(createInvalidPatchBase64());

        const result = await patchRom(
            'file:///path/to/base.gba',
            'file:///path/to/patch.ips',
            'patched_game.gba'
        );

        expect(result.success).toBe(false);
        // Error string varies by library, but we expect an error property
        expect(result.error).toBeDefined();

        // Ensure write and insert were NOT called
        expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
        expect(insertGame).not.toHaveBeenCalled();
    });

    it('should return failure if file system read throws an error', async () => {
        (FileSystem.readAsStringAsync as jest.Mock).mockRejectedValue(new Error('File not found'));

        const result = await patchRom(
            'file:///path/to/base.gba',
            'file:///path/to/patch.ips',
            'patched_game.gba'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('File not found');
    });

    it('should return failure if applyPatch returns null', async () => {
        // Mocking RomPatcher directly for this test
        jest.spyOn(RomPatcher, 'parsePatchFile').mockReturnValue({} as any);
        jest.spyOn(RomPatcher, 'applyPatch').mockReturnValue(null as any);

        (FileSystem.readAsStringAsync as jest.Mock)
            .mockResolvedValueOnce(createBaseRomBase64())
            .mockResolvedValueOnce(createValidIpsPatchBase64());

        const result = await patchRom(
            'file:///path/to/base.gba',
            'file:///path/to/patch.ips',
            'patched_game.gba'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Failed to apply patch.');

        // Cleanup spies
        jest.restoreAllMocks();
    });
});
