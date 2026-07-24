import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import JSZip from 'jszip';
import { Buffer } from 'buffer';
import { Game, insertGame } from '../db/gameRepository';

export interface StorageStats {
    totalSpace: number;
    freeSpace: number;
}

const ROMS_DIR = FileSystem.documentDirectory + 'roms/';
const TEMP_DIR = FileSystem.cacheDirectory + 'temp/';

export const initStorage = async () => {
    const romsDirInfo = await FileSystem.getInfoAsync(ROMS_DIR);
    if (!romsDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(ROMS_DIR, { intermediates: true });
    }
    const tempDirInfo = await FileSystem.getInfoAsync(TEMP_DIR);
    if (!tempDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(TEMP_DIR, { intermediates: true });
    }
};

const getConsoleFromExtension = (filename: string): Game['console'] => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'gba': return 'GBA';
        case 'nds': return 'NDS';
        case 'gbc': return 'GBC';
        case 'nes': return 'NES';
        case 'snes':
        case 'smc':
        case 'sfc': return 'SNES';
        default: return 'Unknown';
    }
};

const isSupportedRomExtension = (filename: string): boolean => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['gba', 'nds', 'gbc', 'nes', 'snes', 'smc', 'sfc', 'bps', 'ips'].includes(ext || '');
};

const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

export const importFileFromPicker = async (): Promise<{ success: boolean; game?: Game; error?: string }> => {
    try {
        await initStorage();

        const result = await DocumentPicker.getDocumentAsync({
            copyToCacheDirectory: true,
            type: ['*/*'], // Allow all types, we will filter below
        });

        if (result.canceled) {
            return { success: false, error: 'User canceled file picker' };
        }

        const pickedFile = result.assets[0];
        const filename = pickedFile.name;
        let sourceUri = pickedFile.uri;
        let targetFilename = filename;

        const ext = filename.split('.').pop()?.toLowerCase();
        let extractedFilePath: string | null = null;
        let isArchive = false;

        if (['zip', '7z', 'rar'].includes(ext || '')) {
            isArchive = true;
            // Only zip is supported out of the box with jszip easily.
            // In a real app we'd add support for 7z and rar properly, or use a native module.
            // We'll focus on ZIP extraction here using jszip
            if (ext === 'zip') {
                 const fileContentBase64 = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
                 const zip = await JSZip.loadAsync(fileContentBase64, { base64: true });

                 let foundRom: string | null = null;
                 let foundRomData: Uint8Array | null = null;

                 for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
                     if (!zipEntry.dir && isSupportedRomExtension(relativePath)) {
                         foundRom = relativePath;
                         foundRomData = await zipEntry.async('uint8array');
                         break; // Just take the first valid rom found for now
                     }
                 }

                 if (foundRom && foundRomData) {
                     // Save extracted rom temporarily
                     extractedFilePath = TEMP_DIR + foundRom.split('/').pop();

                     // Buffer to base64 using Buffer
                     const base64Data = Buffer.from(foundRomData).toString('base64');

                     await FileSystem.writeAsStringAsync(extractedFilePath, base64Data, { encoding: FileSystem.EncodingType.Base64 });

                     sourceUri = extractedFilePath;
                     targetFilename = foundRom.split('/').pop() || filename;
                 } else {
                     return { success: false, error: 'No supported ROM found in archive' };
                 }
            } else {
                 return { success: false, error: 'Only ZIP extraction is currently supported' };
            }
        }

        if (!isArchive && !isSupportedRomExtension(filename)) {
            return { success: false, error: 'Unsupported file type selected' };
        }

        // Calculate Hash
        const fileContentStr = await FileSystem.readAsStringAsync(sourceUri, { encoding: FileSystem.EncodingType.Base64 });
        const fileHash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.MD5,
            fileContentStr
        );

        const destUri = ROMS_DIR + targetFilename;

        // Copy to final location
        await FileSystem.copyAsync({
            from: sourceUri,
            to: destUri
        });

        // Clean up temp extracted file
        if (extractedFilePath) {
            await FileSystem.deleteAsync(extractedFilePath, { idempotent: true });
        }

        const consoleType = getConsoleFromExtension(targetFilename);

        const newGame: Game = {
            id: generateId(),
            title: targetFilename.split('.').slice(0, -1).join('.') || targetFilename,
            displayType: 'baseParent',
            localFilePath: destUri,
            console: consoleType,
            fileHash: fileHash,
            updatedAt: Date.now()
        };

        await insertGame(newGame);

        return { success: true, game: newGame };
    } catch (e: any) {
        console.error('Import error:', e);
        return { success: false, error: e.message };
    }
};

export const listDirectoryContents = async (): Promise<string[]> => {
    try {
        await initStorage();
        return await FileSystem.readDirectoryAsync(ROMS_DIR);
    } catch (e) {
        console.error('List dir error:', e);
        return [];
    }
};

export const getStorageStats = async (): Promise<StorageStats | null> => {
    try {
        const free = await FileSystem.getFreeDiskStorageAsync();
        const total = await FileSystem.getTotalDiskCapacityAsync();
        return {
            freeSpace: free,
            totalSpace: total
        };
    } catch (e) {
        console.error('Stats error:', e);
        return null;
    }
};

export const deleteStoredFile = async (filePath: string): Promise<boolean> => {
    try {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        return true;
    } catch (e) {
        console.error('Delete error:', e);
        return false;
    }
};
