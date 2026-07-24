import * as FileSystem from 'expo-file-system/legacy';
import BinFile from './vendor/BinFile';
import RomPatcher from './vendor/RomPatcher';
import { insertGame, Game } from '../db/gameRepository';
import { Buffer } from 'buffer';

export const patchRom = async (
    baseRomUri: string,
    patchUri: string,
    outputFileName: string,
    parentId?: string,
    consoleType: 'GBA' | 'NDS' | 'GBC' | 'NES' | 'SNES' | 'Unknown' = 'GBA'
): Promise<{ success: boolean; outputPath?: string; error?: string }> => {
    try {
        // Read base ROM
        const baseRomBase64 = await FileSystem.readAsStringAsync(baseRomUri, { encoding: FileSystem.EncodingType.Base64 });
        const baseRomBuffer = Buffer.from(baseRomBase64, 'base64');
        const baseRomFile = new BinFile(new Uint8Array(baseRomBuffer));

        // Read patch
        const patchBase64 = await FileSystem.readAsStringAsync(patchUri, { encoding: FileSystem.EncodingType.Base64 });
        const patchBuffer = Buffer.from(patchBase64, 'base64');
        const patchFile = new BinFile(new Uint8Array(patchBuffer));

        // Apply patch
        const patchedRomFile = RomPatcher.applyPatch(baseRomFile, patchFile);
        if (!patchedRomFile) {
            return { success: false, error: 'Failed to apply patch.' };
        }

        // Save patched ROM
        const patchedRomUint8Array = patchedRomFile._u8array;
        const outputPath = `${FileSystem.documentDirectory}${outputFileName}`;
        const patchedRomBase64 = Buffer.from(patchedRomUint8Array).toString('base64');

        await FileSystem.writeAsStringAsync(outputPath, patchedRomBase64, { encoding: FileSystem.EncodingType.Base64 });

        // Insert into DB
        const newGameId = Math.random().toString(36).substring(7);
        const game: Game = {
            id: newGameId,
            title: outputFileName,
            displayType: parentId ? 'variant' : 'standaloneHack',
            parentGameId: parentId || null,
            localFilePath: outputPath,
            console: consoleType,
            updatedAt: Date.now()
        };

        await insertGame(game);

        return { success: true, outputPath: outputPath };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
};
