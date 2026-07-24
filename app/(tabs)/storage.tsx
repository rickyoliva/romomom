import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, ScrollView, Alert } from 'react-native';
import { importFileFromPicker, listDirectoryContents, getStorageStats, StorageStats } from '../../src/services/storageService';
import { launchGame, SupportedEmulator } from '../../src/services/emulatorLauncherService';
import * as FileSystem from 'expo-file-system';

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

  useEffect(() => {
    loadData();
  }, []);

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
              <Text style={styles.fileName}>{file}</Text>
              <Button title="Launch / Share" onPress={() => handleLaunch(file)} />
              <Button title="Del" color="red" onPress={async () => {
                const localFilePath = FileSystem.documentDirectory + 'roms/' + file;
                await FileSystem.deleteAsync(localFilePath, { idempotent: true });
                loadData();
              }} />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  fileName: {
    flex: 1,
    marginRight: 10,
  },
});
