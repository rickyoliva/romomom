export interface RemoteRepoItem {
  id: string;
  title: string;
  author: string;
  description: string;
  console: 'GBA' | 'NDS' | '3DS' | 'GBC' | 'NES' | 'SNES' | 'Unknown';
  downloadUrl: string;
  fileType: 'patch' | 'homebrew';
  version?: string;
  iconUrl?: string;
  updatedAt?: string;
}
