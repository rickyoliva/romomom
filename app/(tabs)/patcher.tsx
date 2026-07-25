import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, ScrollView, Modal, FlatList } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { patchRom } from '../../src/services/patcherService';
import { getAllGames, Game } from '../../src/db/gameRepository';
import { listDirectoryContents } from '../../src/services/storageService';
import * as FileSystem from 'expo-file-system/legacy';

export default function PatcherTab() {
    const [baseRomUri, setBaseRomUri] = useState<string | null>(null);
    const [baseRomName, setBaseRomName] = useState<string>('');
    const [patchUri, setPatchUri] = useState<string | null>(null);
    const [patchName, setPatchName] = useState<string>('');
    const [outputName, setOutputName] = useState<string>('');
    const [isPatching, setIsPatching] = useState(false);

    // Modal state
    const [showPickerModal, setShowPickerModal] = useState<'base' | 'patch' | null>(null);
    const [games, setGames] = useState<Game[]>([]);
    const [localFiles, setLocalFiles] = useState<string[]>([]);

    const loadPickerData = async () => {
        try {
            const allGames = await getAllGames();
            setGames(allGames.filter(g => g.localFilePath));

            const dirFiles = await listDirectoryContents();
            setLocalFiles(dirFiles);
        } catch (e) {
            console.error('Failed to load picker data', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadPickerData();
        }, [])
    );

    const pickDocument = async (type: 'base' | 'patch') => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets.length > 0) {
                if (type === 'base') {
                    setBaseRomUri(result.assets[0].uri);
                    setBaseRomName(result.assets[0].name);
                } else {
                    setPatchUri(result.assets[0].uri);
                    setPatchName(result.assets[0].name);
                }
                setShowPickerModal(null);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick file');
        }
    };

    const handleSelectLibrary = (game: Game, type: 'base' | 'patch') => {
        if (!game.localFilePath) return;
        if (type === 'base') {
            setBaseRomUri(game.localFilePath);
            setBaseRomName(game.title);
        } else {
            setPatchUri(game.localFilePath);
            setPatchName(game.title);
        }
        setShowPickerModal(null);
    };

    const handleSelectLocalFile = (fileName: string, type: 'base' | 'patch') => {
        const fileUri = `${FileSystem.documentDirectory}roms/${fileName}`;
        if (type === 'base') {
            setBaseRomUri(fileUri);
            setBaseRomName(fileName);
        } else {
            setPatchUri(fileUri);
            setPatchName(fileName);
        }
        setShowPickerModal(null);
    };

    const handlePatch = async () => {
        if (!baseRomUri || !patchUri || !outputName) {
            Alert.alert('Missing Fields', 'Please select both files and enter an output name.');
            return;
        }

        setIsPatching(true);
        // We assume GBA for standalone patcher, or user can add a picker later
        const result = await patchRom(baseRomUri, patchUri, outputName);
        setIsPatching(false);

        if (result.success) {
            Alert.alert('Success', 'Patch applied and saved to library!');
            setBaseRomUri(null);
            setBaseRomName('');
            setPatchUri(null);
            setPatchName('');
            setOutputName('');
        } else {
            Alert.alert('Error', result.error || 'Failed to apply patch.');
        }
    };

    const renderPickerModal = () => {
        if (!showPickerModal) return null;

        return (
            <Modal visible={true} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select {showPickerModal === 'base' ? 'Base ROM' : 'Patch File'}</Text>

                        <Pressable style={styles.modalOption} onPress={() => pickDocument(showPickerModal)}>
                            <Text style={styles.modalOptionTitle}>📁 Import from Files App</Text>
                            <Text style={styles.modalOptionSub}>Browse your device storage</Text>
                        </Pressable>

                        <Text style={styles.sectionTitle}>📚 Select from Library</Text>
                        <FlatList
                            data={games}
                            keyExtractor={(item) => 'lib_' + item.id}
                            style={{maxHeight: 150}}
                            renderItem={({ item }) => (
                                <Pressable style={styles.listItem} onPress={() => handleSelectLibrary(item, showPickerModal)}>
                                    <Text style={styles.listItemText}>{item.title}</Text>
                                    <Text style={styles.listItemSub}>{item.console}</Text>
                                </Pressable>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>No games in library</Text>}
                        />

                        <Text style={styles.sectionTitle}>🌐 Select from Discover Downloads</Text>
                        <FlatList
                            data={localFiles}
                            keyExtractor={(item) => 'loc_' + item}
                            style={{maxHeight: 150}}
                            renderItem={({ item }) => (
                                <Pressable style={styles.listItem} onPress={() => handleSelectLocalFile(item, showPickerModal)}>
                                    <Text style={styles.listItemText}>{item}</Text>
                                </Pressable>
                            )}
                            ListEmptyComponent={<Text style={styles.emptyText}>No local files</Text>}
                        />

                        <Pressable style={styles.cancelButton} onPress={() => setShowPickerModal(null)}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        );
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Patch Workbench</Text>
            <Text style={styles.subtitle}>Apply patches to your local ROMs. Supports IPS, BPS, UPS, APS, PPF, VCDIFF, RUP formats.</Text>

            <View style={styles.card}>
                <Text style={styles.label}>1. Select Base ROM</Text>
                <Pressable style={styles.pickerButton} onPress={() => setShowPickerModal('base')}>
                    <Text style={styles.pickerText}>{baseRomUri ? baseRomName : 'Pick Base ROM'}</Text>
                </Pressable>

                <Text style={styles.label}>2. Select Patch File</Text>
                <Pressable style={styles.pickerButton} onPress={() => setShowPickerModal('patch')}>
                    <Text style={styles.pickerText}>{patchUri ? patchName : 'Pick Patch File'}</Text>
                </Pressable>

                <Text style={styles.label}>3. Output Filename</Text>
                <TextInput
                    style={styles.input}
                    placeholder="e.g. MyPatchedGame.gba"
                    value={outputName}
                    onChangeText={setOutputName}
                    autoCapitalize="none"
                />

                <Pressable
                    style={[styles.patchButton, (!baseRomUri || !patchUri || !outputName || isPatching) && styles.patchButtonDisabled]}
                    onPress={handlePatch}
                    disabled={!baseRomUri || !patchUri || !outputName || isPatching}
                >
                    {isPatching ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.patchButtonText}>Apply Patch</Text>
                    )}
                </Pressable>
            </View>
            {renderPickerModal()}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flexGrow: 1,
        padding: 20,
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        marginBottom: 24,
    },
    card: {
        backgroundColor: '#fff',
        padding: 20,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
    },
    pickerButton: {
        backgroundColor: '#f0f0f0',
        padding: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
    },
    pickerText: {
        fontSize: 16,
        color: '#333',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 16,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    patchButton: {
        backgroundColor: '#34C759',
        padding: 18,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 32,
    },
    patchButtonDisabled: {
        backgroundColor: '#A1D6B2',
    },
    patchButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        padding: 20,
        maxHeight: '80%',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalOption: {
        padding: 16,
        backgroundColor: '#f0f0f0',
        borderRadius: 8,
        marginBottom: 16,
    },
    modalOptionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    modalOptionSub: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 8,
        marginBottom: 8,
        color: '#333',
    },
    listItem: {
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    listItemText: {
        fontSize: 16,
        flex: 1,
    },
    listItemSub: {
        fontSize: 12,
        color: '#888',
        backgroundColor: '#f0f0f0',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    emptyText: {
        color: '#999',
        fontStyle: 'italic',
        paddingVertical: 8,
    },
    cancelButton: {
        marginTop: 20,
        padding: 16,
        alignItems: 'center',
        backgroundColor: '#FF3B30',
        borderRadius: 8,
    },
    cancelButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    }
});
