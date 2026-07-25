import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { importFileFromPicker, listDirectoryContents, getStorageStats, StorageStats } from '../../src/services/storageService';
import { launchGame, SupportedEmulator } from '../../src/services/emulatorLauncherService';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export default function StorageTab() {
  const [files, setFiles] = useState<string[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);

  const loadData = async () => {
    const dirFiles = await listDirectoryContents();
    // Filter to only show actual ROM files (files not ending with db or other internal types, optional depending on listDirectoryContents implementation)
    // listDirectoryContents already strictly looks at ROMS_DIR so this is clean.
    setFiles(dirFiles);
    const storageStats = await getStorageStats();
    setStats(storageStats);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleImport = async () => {
    const result = await importFileFromPicker();
    if (result.success) {
      Alert.alert('Success', `Imported ${result.game?.title}`);
      loadData();
    } else {
      Alert.alert('Error', result.error || 'Failed to import file');
    }
  };

  const handleLaunch = async (fileName: string) => {
    const localFilePath = FileSystem.documentDirectory + 'roms/' + fileName;
    // Launching without a specific emulator scheme will fall back to Share Sheet for testing purposes
    const result = await launchGame(localFilePath);
    if (!result.success) {
      Alert.alert('Launch Error', result.error);
    }
  };

  const handleShare = async (fileName: string) => {
    const localFilePath = FileSystem.documentDirectory + 'roms/' + fileName;
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(localFilePath);
      } else {
        Alert.alert('Sharing Unavailable', 'Sharing is not available on this device.');
      }
    } catch (e) {
      Alert.alert('Share Error', 'Could not share file.');
    }
  };

  const getFileBadge = (fileName: string) => {
    const parts = fileName.split('.');
    if (parts.length > 1) {
      const ext = parts[parts.length - 1].toUpperCase();
      return ext;
    }
    return 'FILE';
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Storage Manager</Text>

      <View style={styles.section}>
        <Button title="Import File" onPress={handleImport} />
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Storage Stats:</Text>
        {stats ? (
          <>
            <Text>Free Space: {formatBytes(stats.freeSpace)}</Text>
            <Text>Total Space: {formatBytes(stats.totalSpace)}</Text>
          </>
        ) : (
          <Text>Loading stats...</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.subtitle}>Local ROMs Directory:</Text>
        {files.length === 0 ? (
          <Text>No files found.</Text>
        ) : (
          files.map((file, index) => (
            <View key={index} style={styles.fileItem}>
              <View style={styles.fileInfo}>
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>{getFileBadge(file)}</Text>
                </View>
                <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">{file}</Text>
              </View>
              <View style={styles.fileActions}>
                <Button title="Share" onPress={() => handleShare(file)} />
                <Button title="Launch" onPress={() => handleLaunch(file)} />
                <Button title="Del" color="red" onPress={async () => {
                  const localFilePath = FileSystem.documentDirectory + 'roms/' + file;
                  await FileSystem.deleteAsync(localFilePath, { idempotent: true });
                  loadData();
                }} />
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingTop: 50,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  fileItem: {
    flexDirection: 'column',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeContainer: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  fileName: {
    flex: 1,
    fontSize: 16,
  },
  fileActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
});
