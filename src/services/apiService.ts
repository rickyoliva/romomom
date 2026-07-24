import { RemoteRepoItem } from '../types/repository';

const API_URL = 'https://db.universal-team.net/data/full.json';

const mapSystemToConsole = (systems: string[]): RemoteRepoItem['console'] => {
  if (!systems || systems.length === 0) return 'Unknown';

  for (const sys of systems) {
    const s = sys.toUpperCase();
    if (s.includes('GBA')) return 'GBA';
    if (s.includes('NDS') || s.includes('DS')) return 'NDS';
    if (s.includes('GBC')) return 'GBC';
    if (s.includes('NES') && !s.includes('SNES')) return 'NES';
    if (s.includes('SNES')) return 'SNES';
  }
  return 'Unknown';
};

const determineFileType = (url: string): 'patch' | 'homebrew' => {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.endsWith('.ips') || lowerUrl.endsWith('.bps') || lowerUrl.endsWith('.xdelta')) {
    return 'patch';
  }
  return 'homebrew'; // Defaulting to homebrew for generic roms/archives
};

export const fetchRepositoryItems = async (): Promise<RemoteRepoItem[]> => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      console.warn('Network request failed:', response.statusText);
      return [];
    }

    const data = await response.json();
    const items: RemoteRepoItem[] = [];

    // The data is an array of objects
    for (const entry of data) {
      if (!entry.downloads) continue;

      // Find a primary download URL (first one available)
      let downloadUrl = '';
      let urlKey = '';
      for (const key in entry.downloads) {
        if (entry.downloads[key].url) {
          downloadUrl = entry.downloads[key].url;
          urlKey = key;
          break; // We'll just grab the first one for simplicity
        }
      }

      if (!downloadUrl) continue;

      const fileType = determineFileType(urlKey || downloadUrl);
      const consoleType = mapSystemToConsole(entry.systems);

      const item: RemoteRepoItem = {
        id: entry.slug || Math.random().toString(36).substring(7),
        title: entry.title || 'Unknown Title',
        author: entry.author || 'Unknown Author',
        description: entry.description || '',
        console: consoleType,
        downloadUrl,
        fileType,
        version: entry.version,
        iconUrl: entry.icon,
        updatedAt: entry.updated,
      };

      items.push(item);
    }

    return items;
  } catch (error) {
    console.warn('Error fetching remote repository items:', error);
    return [];
  }
};