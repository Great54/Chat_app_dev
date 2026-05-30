import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, SIZES } from '../constants/theme';

interface RoomCardProps {
  room: {
    id: string;
    roomName: string;
    roomCategory: string;
    roomDescription: string;
    currentUserCount: number;
    maxCapacity: number;
  };
  onPress: () => void;
}

export default function RoomCard({ room, onPress }: RoomCardProps) {
  const isFull = room.currentUserCount >= room.maxCapacity;
  const occupancyPercent = (room.currentUserCount / room.maxCapacity) * 100;
  
  return (
    <TouchableOpacity 
      style={[styles.card, isFull && styles.cardFull]} 
      onPress={onPress}
      disabled={isFull}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Ionicons name="people" size={24} color={COLORS.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.roomName}>{room.roomName}</Text>
          <Text style={styles.category}>{room.roomCategory}</Text>
        </View>
      </View>
      
      <Text style={styles.description} numberOfLines={2}>
        {room.roomDescription}
      </Text>
      
      <View style={styles.footer}>
        <View style={styles.occupancy}>
          <Ionicons name="person" size={16} color={COLORS.textSecondary} />
          <Text style={styles.occupancyText}>
            {room.currentUserCount}/{room.maxCapacity}
          </Text>
        </View>
        
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${occupancyPercent}%` }]} />
        </View>
        
        {isFull && (
          <View style={styles.fullBadge}>
            <Text style={styles.fullText}>FULL</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: SIZES.borderRadius,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardFull: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  headerText: {
    flex: 1,
  },
  roomName: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  occupancy: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  occupancyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 4,
    fontWeight: '600',
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  fullBadge: {
    marginLeft: SPACING.sm,
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  fullText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '700',
  },
});