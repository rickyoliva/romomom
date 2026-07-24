import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, TextInput, Button, Alert } from 'react-native';
import { Stack, useFocusEffect, router } from 'expo-router';
import { getAllGames, getVariantsForParent, Game, deleteGame, updateGame } from '../../src/db/gameRepository';
import { importFileFromPicker, deleteStoredFile } from '../../src/services/storageService';
import { GameCard } from '../../src/components';
import * as FileSystem from 'expo-file-system';

export default function LibraryTab() {
  const [games, setGames] = useState<Game[]>([]);
  const [variantsMap, setVariantsMap] = useState<Record<string, Game[]>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = async () => {
    try {
      const allGames = await getAllGames();
      // Filter out raw variants from the main list (they are children)
      const baseGames = allGames.filter(g => g.displayType === 'baseParent' || g.displayType === 'standaloneHack');

      const vMap: Record<string, Game[]> = {};
      for (const game of baseGames) {
        if (game.displayType === 'baseParent') {
          const variants = await getVariantsForParent(game.id);
          vMap[game.id] = variants;
        }
      }

      setGames(baseGames);
      setVariantsMap(vMap);
    } catch (e) {
      console.error('Failed to load games:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleImport = async () => {
    const result = await importFileFromPicker();
    if (result.success) {
      loadData();
    } else if (result.error && result.error !== 'User canceled file picker') {
      Alert.alert('Import Error', result.error);
    }
  };

  const handleDeleteGame = async (id: string, deleteType: 'all' | 'baseOnly') => {
    try {
      const gameToDelete = games.find(g => g.id === id);
      if (!gameToDelete) {
          // Check variants
          let foundVariant: Game | null = null;
          Object.values(variantsMap).forEach(variants => {
              const v = variants.find(v => v.id === id);
              if (v) foundVariant = v;
          });
          if (foundVariant) {
              const v = foundVariant as Game;
              if (v.localFilePath) await deleteStoredFile(v.localFilePath);
              await deleteGame(id);
              await loadData();
          }
          return;
      }

      if (deleteType === 'all') {
        if (gameToDelete.localFilePath) {
          await deleteStoredFile(gameToDelete.localFilePath);
        }
        // Delete all variants physically
        const variants = variantsMap[id] || [];
        for (const v of variants) {
          if (v.localFilePath) {
            await deleteStoredFile(v.localFilePath);
          }
        }
        // DB handles cascade deletion via foreign key
        await deleteGame(id);
      } else if (deleteType === 'baseOnly') {
        if (gameToDelete.localFilePath) {
          await deleteStoredFile(gameToDelete.localFilePath);
          gameToDelete.localFilePath = null;
          await updateGame(gameToDelete);
        }
      }
      await loadData();
    } catch (e) {
      console.error('Failed to delete game:', e);
      Alert.alert('Error', 'Failed to delete game');
    }
  };

  const handleAttachBaseRom = async (id: string, fileUri: string, fileName: string): Promise<boolean> => {
    try {
        const gameToUpdate = games.find(g => g.id === id);
        if (!gameToUpdate) return false;

        const ROMS_DIR = FileSystem.documentDirectory + 'roms/';
        const destUri = ROMS_DIR + fileName;

        await FileSystem.copyAsync({
            from: fileUri,
            to: destUri
        });

        gameToUpdate.localFilePath = destUri;
        await updateGame(gameToUpdate);
        await loadData();
        return true;
    } catch (e: any) {
        Alert.alert('Error attaching ROM', e.message);
        return false;
    }
  };

  const filteredGames = games.filter(g => g.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Button title="+ Import" onPress={handleImport} />
          )
        }}
      />

      <TextInput
        style={styles.searchInput}
        placeholder="Search games..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      <FlatList
        data={filteredGames}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <GameCard
            game={item}
            variants={variantsMap[item.id]}
            onDeleteGame={handleDeleteGame}
            onRefresh={loadData}
            onAttachBaseRom={handleAttachBaseRom}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No games found in your library.</Text>
            <Button title="Import a Game" onPress={handleImport} />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  searchInput: {
    margin: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
  },
});
