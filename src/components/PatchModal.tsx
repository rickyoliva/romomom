import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Game } from '../db/gameRepository';
import { patchRom } from '../services/patcherService';
import * as DocumentPicker from 'expo-document-picker';

interface PatchModalProps {
    visible: boolean;
    onClose: () => void;
    baseGame: Game;
    onPatchComplete: () => void;
}

export const PatchModal: React.FC<PatchModalProps> = ({ visible, onClose, baseGame, onPatchComplete }) => {
    const [patchUri, setPatchUri] = useState<string | null>(null);
    const [patchName, setPatchName] = useState<string>('');
    const [outputName, setOutputName] = useState<string>('');
    const [isPatching, setIsPatching] = useState(false);

    const pickPatchFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setPatchUri(asset.uri);
                setPatchName(asset.name);
                // Suggest output name based on patch name
                const baseName = asset.name.split('.').slice(0, -1).join('.');
                setOutputName(`${baseGame.title} - ${baseName}.${baseGame.console.toLowerCase()}`);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick patch file');
        }
    };

    const handlePatch = async () => {
        if (!patchUri) {
            Alert.alert('Missing Info', 'Please select a patch file.');
            return;
        }
        if (!outputName.trim()) {
            Alert.alert('Missing Info', 'Please enter an output name.');
            return;
        }
        if (!baseGame.localFilePath) {
            Alert.alert('Error', 'Base game does not have an attached ROM file.');
            return;
        }

        setIsPatching(true);
        const result = await patchRom(
            baseGame.localFilePath,
            patchUri,
            outputName,
            baseGame.id,
            baseGame.console
        );
        setIsPatching(false);

        if (result.success) {
            Alert.alert('Success', 'Game patched successfully!');
            onPatchComplete();
            resetAndClose();
        } else {
            Alert.alert('Error', result.error || 'Failed to patch ROM');
        }
    };

    const resetAndClose = () => {
        setPatchUri(null);
        setPatchName('');
        setOutputName('');
        onClose();
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={resetAndClose}>
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Patch Game</Text>
                    <Pressable onPress={resetAndClose}>
                        <Text style={styles.closeText}>Cancel</Text>
                    </Pressable>
                </View>

                <View style={styles.content}>
                    <Text style={styles.label}>Base ROM:</Text>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoText}>{baseGame.title}</Text>
                        <Text style={styles.subText}>{baseGame.console}</Text>
                    </View>

                    <Text style={styles.label}>Patch File (.ips, .bps):</Text>
                    <Pressable style={styles.pickerButton} onPress={pickPatchFile}>
                        <Text style={styles.pickerButtonText}>
                            {patchUri ? patchName : 'Select Patch File'}
                        </Text>
                    </Pressable>

                    <Text style={styles.label}>Output Filename:</Text>
                    <TextInput
                        style={styles.input}
                        value={outputName}
                        onChangeText={setOutputName}
                        placeholder="e.g. Pokemon - Kaizo.gba"
                        autoCapitalize="none"
                    />

                    <Pressable
                        style={[styles.patchButton, (!patchUri || !outputName || isPatching) && styles.patchButtonDisabled]}
                        onPress={handlePatch}
                        disabled={!patchUri || !outputName || isPatching}
                    >
                        {isPatching ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.patchButtonText}>Apply Patch</Text>
                        )}
                    </Pressable>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        marginTop: 40, // For notch/status bar spacing in modal
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    closeText: {
        color: '#007AFF',
        fontSize: 16,
    },
    content: {
        padding: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 8,
        marginTop: 16,
    },
    infoBox: {
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#eee',
    },
    infoText: {
        fontSize: 16,
        fontWeight: '500',
    },
    subText: {
        fontSize: 12,
        color: '#666',
        marginTop: 4,
    },
    pickerButton: {
        backgroundColor: '#f0f0f0',
        padding: 14,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ccc',
        alignItems: 'center',
    },
    pickerButtonText: {
        color: '#333',
        fontSize: 16,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    patchButton: {
        backgroundColor: '#34C759',
        padding: 16,
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
});
