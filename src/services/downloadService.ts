import * as FileSystem from 'expo-file-system/legacy';
import JSZip from 'jszip';
import { Buffer } from 'buffer';
import { Game, insertGame } from '../db/gameRepository';
import { RemoteRepoItem } from '../types/repository';
import * as Crypto from 'expo-crypto';

const ROMS_DIR = FileSystem.documentDirectory + 'roms/';
const PATCHES_DIR = FileSystem.documentDirectory + 'patches/';

export const initDownloadStorage = async () => {
  const dirs = [ROMS_DIR, PATCHES_DIR];
  for (const dir of dirs) {
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }
};

const generateId = () => {
  return Date.now().toString() + Math.random().toString(36).substring(2, 9);
};

const isSupportedRomExtension = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['gba', 'nds', 'gbc', 'nes', 'snes', 'smc', 'sfc'].includes(ext || '');
};

const getExtensionFromUrl = (url: string): string => {
  const urlParts = url.split('/');
  const filename = urlParts[urlParts.length - 1];
  const parts = filename.split('.');
  if (parts.length > 1) {
    return '.' + parts[parts.length - 1].split('?')[0].toLowerCase();
  }
  return '';
};

export const downloadItem = async (
  item: RemoteRepoItem,
  onProgress?: (progress: number) => void
): Promise<{ success: boolean; game?: Game; error?: string }> => {
  try {
    await initDownloadStorage();

    const urlExt = getExtensionFromUrl(item.downloadUrl);
    const downloadFileName = `${item.id}_${Date.now()}${urlExt}`;
    const tempDownloadPath = FileSystem.cacheDirectory + downloadFileName;

    const downloadResumable = FileSystem.createDownloadResumable(
      item.downloadUrl,
      tempDownloadPath,
      {},
      (downloadProgress) => {
        const progress = downloadProgress.totalBytesExpectedToWrite !== -1
          ? downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite
          : 0;
        if (onProgress) {
          onProgress(progress * 100);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();

    if (!result || result.status !== 200) {
       return { success: false, error: 'Download failed from remote server.' };
    }

    let finalUri = tempDownloadPath;
    let finalFileName = `${item.title.replace(/[^a-zA-Z0-9 -]/g, '')}${urlExt}`;
    let extractedFilePath: string | null = null;
    let isZip = urlExt === '.zip';

    // Extract zip if necessary
    if (isZip) {
      try {
        const fileContentBase64 = await FileSystem.readAsStringAsync(tempDownloadPath, { encoding: FileSystem.EncodingType.Base64 });
        const zip = await JSZip.loadAsync(fileContentBase64, { base64: true });

        let foundRom: string | null = null;
        let foundRomData: Uint8Array | null = null;

        for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
            // Find a rom if it's homebrew, or find a patch if it's a patch
            const entryExt = '.' + (relativePath.split('.').pop()?.toLowerCase() || '');
            if (!zipEntry.dir && (
                (item.fileType === 'homebrew' && isSupportedRomExtension(relativePath)) ||
                (item.fileType === 'patch' && ['.ips', '.bps', '.xdelta'].includes(entryExt))
            )) {
                foundRom = relativePath;
                foundRomData = await zipEntry.async('uint8array');
                break;
            }
        }

        if (foundRom && foundRomData) {
            extractedFilePath = FileSystem.cacheDirectory + 'ext_' + foundRom.split('/').pop();
            const base64Data = Buffer.from(foundRomData).toString('base64');
            await FileSystem.writeAsStringAsync(extractedFilePath, base64Data, { encoding: FileSystem.EncodingType.Base64 });
            finalUri = extractedFilePath;
            finalFileName = foundRom.split('/').pop() || finalFileName;
        } else {
            console.warn('No relevant files found in zip, saving zip directly.');
        }
      } catch (zipErr) {
        console.warn('Failed to extract zip, saving zip directly', zipErr);
      }
    }

    const targetDir = item.fileType === 'patch' ? PATCHES_DIR : ROMS_DIR;
    const destUri = targetDir + finalFileName;

    // Copy to final location
    await FileSystem.copyAsync({
        from: finalUri,
        to: destUri
    });

    // Cleanup
    if (extractedFilePath) {
        await FileSystem.deleteAsync(extractedFilePath, { idempotent: true });
    }
    await FileSystem.deleteAsync(tempDownloadPath, { idempotent: true });

    // Hash calculation for base games
    let fileHash: string | undefined;
    if (item.fileType === 'homebrew') {
       const fileContentStr = await FileSystem.readAsStringAsync(destUri, { encoding: FileSystem.EncodingType.Base64 });
       fileHash = await Crypto.digestStringAsync(
           Crypto.CryptoDigestAlgorithm.MD5,
           fileContentStr
       );
    }

    // Register item
    const newGame: Game = {
        id: generateId(),
        title: item.title,
        displayType: item.fileType === 'patch' ? 'variant' : 'baseParent',
        localFilePath: destUri,
        console: item.console,
        fileHash: fileHash,
        updatedAt: Date.now()
    };

    if (item.fileType === 'patch') {
       newGame.displayType = 'standaloneHack';
    }

    await insertGame(newGame);

    return { success: true, game: newGame };

  } catch (error: any) {
    console.error('Download error:', error);
    return { success: false, error: error.message };
  }
};