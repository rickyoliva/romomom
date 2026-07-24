import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, ScrollView } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { patchRom } from '../../src/services/patcherService';

export default function PatcherTab() {
    const [baseRomUri, setBaseRomUri] = useState<string | null>(null);
    const [baseRomName, setBaseRomName] = useState<string>('');
    const [patchUri, setPatchUri] = useState<string | null>(null);
    const [patchName, setPatchName] = useState<string>('');
    const [outputName, setOutputName] = useState<string>('');
    const [isPatching, setIsPatching] = useState(false);

    const pickBaseRom = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets.length > 0) {
                setBaseRomUri(result.assets[0].uri);
                setBaseRomName(result.assets[0].name);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick Base ROM');
        }
    };

    const pickPatchFile = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets.length > 0) {
                setPatchUri(result.assets[0].uri);
                setPatchName(result.assets[0].name);
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick Patch File');
        }
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

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <Text style={styles.title}>Patch Workbench</Text>
            <Text style={styles.subtitle}>Apply IPS or BPS patches to your local ROMs.</Text>

            <View style={styles.card}>
                <Text style={styles.label}>1. Select Base ROM</Text>
                <Pressable style={styles.pickerButton} onPress={pickBaseRom}>
                    <Text style={styles.pickerText}>{baseRomUri ? baseRomName : 'Pick Base ROM'}</Text>
                </Pressable>

                <Text style={styles.label}>2. Select Patch File</Text>
                <Pressable style={styles.pickerButton} onPress={pickPatchFile}>
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
});
