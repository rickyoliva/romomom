import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator, Image, Alert, TextInput, ScrollView, Modal } from 'react-native';
import { RemoteRepoItem } from '../../src/types/repository';
import { fetchRepositoryItems } from '../../src/services/apiService';
import { downloadItem } from '../../src/services/downloadService';
import { getAllGames, Game } from '../../src/db/gameRepository';
import { patchRom } from '../../src/services/patcherService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_REPO = 'https://db.universal-team.net/data/full.json';
const REPO_STORAGE_KEY = 'discover_repositories';

export default function DiscoverScreen() {
  const [items, setItems] = useState<RemoteRepoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  // Patching flow state
  const [matchingBases, setMatchingBases] = useState<Game[]>([]);
  const [pendingPatchGame, setPendingPatchGame] = useState<Game | null>(null);
  const [showBaseSelector, setShowBaseSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filters
  const [platformFilter, setPlatformFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [genreFilter, setGenreFilter] = useState('All');

  // Repositories
  const [repositories, setRepositories] = useState<string[]>([DEFAULT_REPO]);
  const [showRepoManager, setShowRepoManager] = useState(false);
  const [newRepoUrl, setNewRepoUrl] = useState('');

  useEffect(() => {
    loadRepositories().then((repos) => {
        loadItems(repos);
    });
  }, []);

  const loadRepositories = async () => {
    try {
        const storedRepos = await AsyncStorage.getItem(REPO_STORAGE_KEY);
        if (storedRepos) {
            const parsed = JSON.parse(storedRepos);
            setRepositories(parsed);
            return parsed;
        }
    } catch (e) {
        console.error('Failed to load repositories', e);
    }
    return repositories;
  };

  const saveRepositories = async (repos: string[]) => {
      try {
          await AsyncStorage.setItem(REPO_STORAGE_KEY, JSON.stringify(repos));
          setRepositories(repos);
      } catch (e) {
          console.error('Failed to save repositories', e);
      }
  };

  const loadItems = async (reposToLoad = repositories) => {
    setLoading(true);
    let allItems: RemoteRepoItem[] = [];
    for (const repoUrl of reposToLoad) {
        const fetchedItems = await fetchRepositoryItems(repoUrl);
        allItems = [...allItems, ...fetchedItems];
    }
    setItems(allItems);
    setLoading(false);
  };

  const addRepository = async () => {
      if (!newRepoUrl) return;
      if (repositories.includes(newRepoUrl)) {
          Alert.alert('Repository already exists');
          return;
      }
      const updatedRepos = [...repositories, newRepoUrl];
      await saveRepositories(updatedRepos);
      setNewRepoUrl('');
      loadItems(updatedRepos);
  };

  const removeRepository = async (repoToRemove: string) => {
      if (repositories.length <= 1) {
          Alert.alert('Cannot remove the last repository');
          return;
      }
      const updatedRepos = repositories.filter(repo => repo !== repoToRemove);
      await saveRepositories(updatedRepos);
      loadItems(updatedRepos);
  };

  const handleDownload = async (item: RemoteRepoItem) => {
    setDownloadingId(item.id);
    setProgress(0);

    const result = await downloadItem(item, (prog) => {
      setProgress(Math.round(prog));
    });

    setDownloadingId(null);
    setProgress(0);

    if (result.success && result.game) {
      if (item.fileType === 'patch') {
        await checkMatchingBaseRoms(result.game);
      } else {
        Alert.alert('Download Complete', `${item.title} has been downloaded and added to your library.`);
      }
    } else {
      Alert.alert('Download Failed', result.error || 'An unknown error occurred.');
    }
  };

  const checkMatchingBaseRoms = async (patchGame: Game) => {
    const allGames = await getAllGames();
    const bases = allGames.filter(g => g.displayType === 'baseParent' && g.console === patchGame.console && g.localFilePath);

    if (bases.length > 0) {
      setMatchingBases(bases);
      setPendingPatchGame(patchGame);
      Alert.alert(
        'Matching Base ROM Detected!',
        `You downloaded a ${patchGame.console} patch. Do you want to apply it to an existing base ROM now?`,
        [
          { text: 'Not Now', style: 'cancel' },
          { text: 'Apply Patch', onPress: () => setShowBaseSelector(true) }
        ]
      );
    } else {
      Alert.alert('Patch Downloaded', 'Patch downloaded successfully. You can apply it later in the Patcher tab.');
    }
  };

  const filteredItems = useMemo(() => {
    let result = items;

    if (platformFilter !== 'All') {
        result = result.filter(item => item.console === platformFilter);
    }

    if (typeFilter !== 'All') {
        result = result.filter(item => item.fileType === typeFilter.toLowerCase());
    }

    if (genreFilter !== 'All') {
        // Very basic mock checking since our remote structure is simple right now
        // It relies on keywords in description/title for filtering genres
        result = result.filter(item => {
           const searchArea = (item.description + ' ' + item.title).toLowerCase();
           const genre = genreFilter.toLowerCase();
           return searchArea.includes(genre);
        });
    }

    if (searchQuery.trim()) {
        result = result.filter(item =>
            item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.description.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    return result;
  }, [items, searchQuery, platformFilter, typeFilter, genreFilter]);

  const applyPatchToBase = async (baseGame: Game) => {
    if (!pendingPatchGame || !pendingPatchGame.localFilePath || !baseGame.localFilePath) return;

    setShowBaseSelector(false);

    const outputName = `${baseGame.title} - ${pendingPatchGame.title}.${baseGame.console.toLowerCase()}`;

    const res = await patchRom(
      baseGame.localFilePath,
      pendingPatchGame.localFilePath,
      outputName,
      baseGame.id,
      baseGame.console
    );

    if (res.success) {
       Alert.alert('Success', 'Patch applied successfully! Check your library.');
    } else {
       Alert.alert('Error', res.error || 'Failed to apply patch.');
    }

    setPendingPatchGame(null);
  };

  const renderItem = ({ item }: { item: RemoteRepoItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        {item.iconUrl ? (
          <Image source={{ uri: item.iconUrl }} style={styles.icon} />
        ) : (
          <View style={[styles.icon, styles.placeholderIcon]} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <Text style={styles.author} numberOfLines={1}>by {item.author}</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.console}</Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={3}>{item.description}</Text>

      <View style={styles.footer}>
        <Text style={styles.typeText}>{item.fileType.toUpperCase()}</Text>

        {downloadingId === item.id ? (
          <View style={styles.progressContainer}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.progressText}>{progress}%</Text>
          </View>
        ) : (
          <Pressable style={styles.downloadButton} onPress={() => handleDownload(item)}>
            <Text style={styles.downloadText}>Download</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  const FilterPill = ({ label, current, onSelect }: { label: string, current: string, onSelect: (val: string) => void }) => (
      <Pressable
          style={[styles.filterPill, current === label && styles.filterPillActive]}
          onPress={() => onSelect(label)}
      >
          <Text style={[styles.filterPillText, current === label && styles.filterPillTextActive]}>{label}</Text>
      </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.searchContainer}>
            <TextInput
                style={styles.searchInput}
                placeholder="Search repositories..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
            />
            <Pressable style={styles.manageRepoButton} onPress={() => setShowRepoManager(true)}>
                <Text style={styles.manageRepoText}>⚙️</Text>
            </Pressable>
        </View>

        <View style={styles.filtersWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                <Text style={styles.filterLabel}>Platform:</Text>
                <FilterPill label="All" current={platformFilter} onSelect={setPlatformFilter} />
                <FilterPill label="GBA" current={platformFilter} onSelect={setPlatformFilter} />
                <FilterPill label="NDS" current={platformFilter} onSelect={setPlatformFilter} />
                <FilterPill label="3DS" current={platformFilter} onSelect={setPlatformFilter} />
                <FilterPill label="NES" current={platformFilter} onSelect={setPlatformFilter} />
                <FilterPill label="SNES" current={platformFilter} onSelect={setPlatformFilter} />
            </ScrollView>
        </View>
        <View style={styles.filtersWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                <Text style={styles.filterLabel}>Content:</Text>
                <FilterPill label="All" current={typeFilter} onSelect={setTypeFilter} />
                <FilterPill label="Patch" current={typeFilter} onSelect={setTypeFilter} />
                <FilterPill label="Homebrew" current={typeFilter} onSelect={setTypeFilter} />
            </ScrollView>
        </View>
        <View style={styles.filtersWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
                <Text style={styles.filterLabel}>Genre:</Text>
                <FilterPill label="All" current={genreFilter} onSelect={setGenreFilter} />
                <FilterPill label="Tools" current={genreFilter} onSelect={setGenreFilter} />
                <FilterPill label="Games" current={genreFilter} onSelect={setGenreFilter} />
                <FilterPill label="Mods" current={genreFilter} onSelect={setGenreFilter} />
                <FilterPill label="Entertainment" current={genreFilter} onSelect={setGenreFilter} />
            </ScrollView>
        </View>
      </View>

      {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Loading repositories...</Text>
          </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>No items found</Text>
          <Pressable style={styles.retryButton} onPress={() => loadItems()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item, index) => item.id + index}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Repository Manager Modal */}
      <Modal visible={showRepoManager} transparent animationType="slide">
          <View style={styles.selectorOverlay}>
              <View style={styles.repoModal}>
                  <Text style={styles.selectorTitle}>Manage Repositories</Text>

                  <FlatList
                      data={repositories}
                      keyExtractor={item => item}
                      renderItem={({item}) => (
                          <View style={styles.repoItem}>
                              <Text style={styles.repoItemText} numberOfLines={1} ellipsizeMode="middle">{item}</Text>
                              <Pressable onPress={() => removeRepository(item)}>
                                  <Text style={styles.removeRepoText}>Remove</Text>
                              </Pressable>
                          </View>
                      )}
                  />

                  <View style={styles.addRepoContainer}>
                      <TextInput
                          style={styles.addRepoInput}
                          placeholder="https://...manifest.json"
                          value={newRepoUrl}
                          onChangeText={setNewRepoUrl}
                          autoCapitalize="none"
                      />
                      <Pressable style={styles.addRepoButton} onPress={addRepository}>
                          <Text style={styles.addRepoButtonText}>Add</Text>
                      </Pressable>
                  </View>

                  <Pressable style={styles.cancelButton} onPress={() => setShowRepoManager(false)}>
                      <Text style={styles.cancelText}>Close</Text>
                  </Pressable>
              </View>
          </View>
      </Modal>

      {/* Base ROM selector modal logic */}
      {showBaseSelector && (
        <View style={styles.selectorOverlay}>
          <View style={styles.selectorModal}>
            <Text style={styles.selectorTitle}>Select Base ROM</Text>
            <FlatList
              data={matchingBases}
              keyExtractor={(b) => b.id}
              renderItem={({item}) => (
                <Pressable style={styles.selectorItem} onPress={() => applyPatchToBase(item)}>
                  <Text style={styles.selectorItemText}>{item.title}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.cancelButton} onPress={() => setShowBaseSelector(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 16,
    color: '#333',
  },
  manageRepoButton: {
    marginLeft: 12,
    padding: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  manageRepoText: {
    fontSize: 18,
  },
  filtersWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filtersScroll: {
    alignItems: 'center',
    gap: 8,
  },
  filterLabel: {
    fontWeight: 'bold',
    marginRight: 4,
    color: '#666',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
  },
  filterPillActive: {
    backgroundColor: '#007AFF',
  },
  filterPillText: {
    color: '#333',
    fontWeight: '600',
    fontSize: 12,
  },
  filterPillTextActive: {
    color: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderIcon: {
    backgroundColor: '#eee',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  author: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  badge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#555',
  },
  description: {
    fontSize: 14,
    color: '#444',
    marginBottom: 16,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  typeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#888',
  },
  downloadButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  downloadText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f2ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  progressText: {
    marginLeft: 8,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  selectorOverlay: {
    position: 'absolute',
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  selectorModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
  },
  repoModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    height: '60%',
  },
  selectorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectorItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectorItemText: {
    fontSize: 16,
  },
  repoItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#eee',
      alignItems: 'center',
  },
  repoItemText: {
      flex: 1,
      marginRight: 8,
  },
  removeRepoText: {
      color: '#FF3B30',
      fontWeight: 'bold',
  },
  addRepoContainer: {
      flexDirection: 'row',
      marginTop: 16,
  },
  addRepoInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: '#ddd',
      borderRadius: 8,
      paddingHorizontal: 12,
      marginRight: 8,
  },
  addRepoButton: {
      backgroundColor: '#34C759',
      justifyContent: 'center',
      paddingHorizontal: 16,
      borderRadius: 8,
  },
  addRepoButtonText: {
      color: '#fff',
      fontWeight: 'bold',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
