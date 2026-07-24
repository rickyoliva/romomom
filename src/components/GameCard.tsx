import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Game } from '../db/gameRepository';
import { launchGame } from '../services/emulatorLauncherService';
import { VariantList } from './VariantList';
import { PatchModal } from './PatchModal';
import * as DocumentPicker from 'expo-document-picker';

interface GameCardProps {
    game: Game;
    variants?: Game[];
    onDeleteGame: (id: string, deleteType: 'all' | 'baseOnly') => void;
    onRefresh: () => void;
    onAttachBaseRom: (id: string, fileUri: string, fileName: string) => Promise<boolean>;
}

export const GameCard: React.FC<GameCardProps> = ({ game, variants = [], onDeleteGame, onRefresh, onAttachBaseRom }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [patchModalVisible, setPatchModalVisible] = useState(false);
    const isMissingBaseRom = !game.localFilePath;

    const handleLaunch = async () => {
        if (isMissingBaseRom) {
            Alert.alert('Cannot Launch', 'The base ROM file is missing.');
            return;
        }
        const result = await launchGame(game.localFilePath!);
        if (!result.success) {
            Alert.alert('Launch Error', result.error);
        }
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Game',
            'How would you like to delete this game?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Base ROM Only',
                    onPress: () => onDeleteGame(game.id, 'baseOnly'),
                    style: 'destructive'
                },
                {
                    text: 'Delete Everything',
                    onPress: () => onDeleteGame(game.id, 'all'),
                    style: 'destructive'
                }
            ]
        );
    };

    const handleAttachBase = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                copyToCacheDirectory: true,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                const success = await onAttachBaseRom(game.id, asset.uri, asset.name);
                if (success) {
                    if (variants.length > 0) {
                        Alert.alert(
                            'Base ROM Attached',
                            'Re-patch existing variants now?',
                            [
                                { text: 'Skip', style: 'cancel' },
                                { text: 'Select Specific Variants', onPress: () => {
                                    Alert.alert('Info', 'Specific variant selection will be implemented in a future update.');
                                } },
                                { text: 'Re-patch All', onPress: () => {
                                    Alert.alert('Info', 'Bulk re-patching not implemented yet.');
                                } }
                            ]
                        );
                    }
                }
            }
        } catch (e) {
            Alert.alert('Error', 'Failed to pick file');
        }
    };

    return (
        <View style={styles.container}>
            <View style={[styles.card, isMissingBaseRom && styles.cardDisabled]}>
                <View style={styles.cardHeader}>
                    <View style={styles.titleContainer}>
                        <Text style={[styles.title, isMissingBaseRom && styles.textDisabled]}>{game.title}</Text>
                        <Text style={[styles.consoleTag, isMissingBaseRom && styles.textDisabled]}>{game.console}</Text>
                        {isMissingBaseRom && (
                            <View style={styles.warningBadge}>
                                <Text style={styles.warningText}>No Base ROM</Text>
                            </View>
                        )}
                    </View>
                    <Pressable onPress={handleDelete}>
                        <Text style={styles.deleteText}>Delete</Text>
                    </Pressable>
                </View>

                <View style={styles.actions}>
                    {isMissingBaseRom ? (
                        <Pressable style={[styles.button, styles.attachButton]} onPress={handleAttachBase}>
                            <Text style={styles.buttonText}>Attach Base ROM</Text>
                        </Pressable>
                    ) : (
                        <>
                            <Pressable style={[styles.button, styles.launchButton]} onPress={handleLaunch}>
                                <Text style={styles.buttonText}>Launch</Text>
                            </Pressable>
                            <Pressable style={[styles.button, styles.patchButton]} onPress={() => setPatchModalVisible(true)}>
                                <Text style={styles.buttonText}>Patch</Text>
                            </Pressable>
                        </>
                    )}

                    {variants.length > 0 && (
                        <Pressable
                            style={[styles.button, styles.variantButton]}
                            onPress={() => setIsExpanded(!isExpanded)}
                        >
                            <Text style={styles.variantButtonText}>
                                Variants ({variants.length}) {isExpanded ? '▲' : '▼'}
                            </Text>
                        </Pressable>
                    )}
                </View>
            </View>

            {isExpanded && variants.length > 0 && (
                <VariantList
                    variants={variants}
                    onDeleteVariant={(id, path) => {
                        // Defer to parent component logic, handled by onDeleteGame ideally, but we need variant specific
                        // Assuming parent provides a way or we just emit an event. For now, calling onDeleteGame with 'all'
                        // since a variant is a single entity.
                        onDeleteGame(id, 'all');
                    }}
                />
            )}

            <PatchModal
                visible={patchModalVisible}
                onClose={() => setPatchModalVisible(false)}
                baseGame={game}
                onPatchComplete={() => {
                    onRefresh();
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginHorizontal: 16,
        marginVertical: 8,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#eee',
    },
    cardDisabled: {
        backgroundColor: '#f5f5f5',
        borderColor: '#ddd',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    titleContainer: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    consoleTag: {
        fontSize: 12,
        color: '#666',
        backgroundColor: '#eee',
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    textDisabled: {
        color: '#999',
    },
    warningBadge: {
        backgroundColor: '#FFF3CD',
        borderColor: '#FFEEBA',
        borderWidth: 1,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginTop: 6,
    },
    warningText: {
        color: '#856404',
        fontSize: 10,
        fontWeight: 'bold',
    },
    deleteText: {
        color: '#FF3B30',
        fontSize: 14,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    button: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    launchButton: {
        backgroundColor: '#007AFF',
    },
    patchButton: {
        backgroundColor: '#34C759',
    },
    attachButton: {
        backgroundColor: '#FF9500',
    },
    variantButton: {
        backgroundColor: '#E5E5EA',
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
    },
    variantButtonText: {
        color: '#333',
        fontWeight: '600',
    },
});
