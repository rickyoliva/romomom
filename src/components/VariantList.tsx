import React from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Game } from '../db/gameRepository';
import { launchGame, SupportedEmulator } from '../services/emulatorLauncherService';

interface VariantListProps {
    variants: Game[];
    onDeleteVariant: (id: string, localFilePath?: string | null) => void;
}

export const VariantList: React.FC<VariantListProps> = ({ variants, onDeleteVariant }) => {
    if (!variants || variants.length === 0) {
        return null;
    }

    const handleLaunch = async (filePath: string) => {
        const result = await launchGame(filePath);
        if (!result.success) {
            Alert.alert('Launch Error', result.error);
        }
    };

    return (
        <View style={styles.container}>
            {variants.map(variant => (
                <View key={variant.id} style={styles.variantItem}>
                    <View style={styles.variantInfo}>
                        <Text style={styles.variantTitle}>{variant.title}</Text>
                        <Text style={styles.variantMeta}>Variant • {variant.console}</Text>
                    </View>
                    <View style={styles.actions}>
                        <Pressable
                            style={styles.actionButton}
                            onPress={() => {
                                if (variant.localFilePath) {
                                    handleLaunch(variant.localFilePath);
                                } else {
                                    Alert.alert('Error', 'No file attached to this variant.');
                                }
                            }}
                        >
                            <Text style={styles.actionText}>Launch</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.actionButton, styles.deleteButton]}
                            onPress={() => onDeleteVariant(variant.id, variant.localFilePath)}
                        >
                            <Text style={[styles.actionText, styles.deleteText]}>Delete</Text>
                        </Pressable>
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingLeft: 20,
        paddingVertical: 10,
        backgroundColor: '#f9f9f9',
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
    },
    variantItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    variantInfo: {
        flex: 1,
    },
    variantTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    variantMeta: {
        fontSize: 12,
        color: '#666',
        marginTop: 2,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    actionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: '#007AFF',
        borderRadius: 4,
    },
    deleteButton: {
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#FF3B30',
    },
    actionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    deleteText: {
        color: '#FF3B30',
    },
});
