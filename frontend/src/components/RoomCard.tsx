import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

interface RoomCardProps {
  room: {
    id: string;
    roomName: string;
    roomCategory: string;
    roomDescription: string;
    roomBanner?: string | null;
    currentUserCount: number;
    maxCapacity: number;
  };
  isFavorite?: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  'World Vibez': 'globe',
  Games: 'game-controller',
  BTS: 'musical-notes',
  'Harry Potter': 'sparkles',
  Country: 'flag',
  Language: 'language',
  Vibe: 'flame',
};

export default function RoomCard({
  room,
  onPress,
  isFavorite = false,
  onToggleFavorite,
}: RoomCardProps) {
  const isFull = room.currentUserCount >= room.maxCapacity;
  const occupancyPercent = (room.currentUserCount / room.maxCapacity) * 100;
  const categoryIcon = categoryIcons[room.roomCategory] || 'planet';

  return (
    <TouchableOpacity
      style={[styles.card, isFull && styles.cardFull]}
      onPress={onPress}
      disabled={isFull}
      activeOpacity={0.85}
      testID={`room-card-${room.id}`}
    >
      <View style={styles.bannerContainer}>
        {room.roomBanner ? (
          <Image
            source={{ uri: room.roomBanner }}
            style={styles.banner}
            contentFit="cover"
            transition={300}
          />
        ) : (
          <LinearGradient
            colors={[COLORS.primary, COLORS.accent]}
            style={styles.bannerFallback}
          >
            <Ionicons name={categoryIcon} size={28} color={COLORS.text} />
          </LinearGradient>
        )}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.85)']}
          style={styles.bannerOverlay}
        />
        <View style={styles.occupancyChip}>
          <Ionicons name="people" size={9} color={COLORS.text} />
          <Text style={styles.occupancyText}>
            {room.currentUserCount}/{room.maxCapacity}
          </Text>
        </View>
        {onToggleFavorite && (
          <Pressable
            style={styles.favBtn}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleFavorite();
            }}
            hitSlop={6}
            testID={`fav-${room.id}`}
          >
            <Ionicons
              name={isFavorite ? 'star' : 'star-outline'}
              size={16}
              color={isFavorite ? COLORS.coin : '#fff'}
            />
          </Pressable>
        )}
        {isFull && (
          <View style={styles.fullBadge}>
            <Text style={styles.fullText}>FULL</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.roomName} numberOfLines={1}>
          {room.roomName}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${occupancyPercent}%` }]} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.7)',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: '33%',
  },
  cardFull: {
    opacity: 0.5,
  },
  bannerContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  occupancyChip: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  occupancyText: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: '700',
  },
  favBtn: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullBadge: {
    position: 'absolute',
    top: 32,
    left: 4,
    backgroundColor: COLORS.error,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  fullText: {
    color: COLORS.text,
    fontSize: 8,
    fontWeight: '700',
  },
  info: {
    padding: 6,
  },
  roomName: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 3,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
});
