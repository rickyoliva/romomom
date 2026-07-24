import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';

export type SupportedEmulator = 'delta' | 'retroarch' | 'ignited' | 'ppsspp' | 'folium';

export const EMULATOR_SCHEMES: Record<SupportedEmulator, string> = {
    delta: 'delta://',
    retroarch: 'retroarch://',
    ignited: 'ignited://',
    ppsspp: 'ppsspp://',
    folium: 'folium://'
};

export const canOpenEmulator = async (emulator: SupportedEmulator): Promise<boolean> => {
    try {
        const scheme = EMULATOR_SCHEMES[emulator];
        return await Linking.canOpenURL(scheme);
    } catch (e) {
        console.error(`Error checking if ${emulator} can be opened:`, e);
        return false;
    }
};

export const launchGame = async (localFilePath: string, emulator?: SupportedEmulator): Promise<{ success: boolean; error?: string }> => {
    try {
        if (emulator) {
            const canOpen = await canOpenEmulator(emulator);
            if (canOpen) {
                // Construct the deep link payload based on standard 'open?path=' format
                const encodedPath = encodeURIComponent(localFilePath);
                const scheme = EMULATOR_SCHEMES[emulator];
                const launchUrl = `${scheme}open?path=${encodedPath}`;

                await Linking.openURL(launchUrl);
                return { success: true };
            } else {
                console.warn(`${emulator} is not installed or cannot be opened. Falling back to share sheet.`);
            }
        }

        // Fallback to Sharing
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
            await Sharing.shareAsync(localFilePath);
            return { success: true };
        } else {
            return { success: false, error: 'Sharing is not available on this device.' };
        }
    } catch (e: any) {
        console.error('Error launching game:', e);
        return { success: false, error: e.message };
    }
};
