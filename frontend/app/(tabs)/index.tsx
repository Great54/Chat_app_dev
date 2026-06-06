import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RoomCard from '@/src/components/RoomCard';
import VipShopModal from '@/src/components/VipShopModal';
import AnimatedBackground from '@/src/components/AnimatedBackground';
import api from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { VIP_STYLES } from '@/src/utils/vip';
import { COLORS, SPACING } from '@/src/constants/theme';

interface Room {
  id: string;
  roomName: string;
  roomCategory: string;
  roomDescription: string;
  roomBanner?: string | null;
  currentUserCount: number;
  maxCapacity: number;
}

type ViewMode = 'all' | 'favorites';

export default function RoomsScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [loading, setLoading] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    (async () => {
      try { await api.post('/init/rooms'); } catch {}
      await loadRooms();
      await loadFavorites();
    })();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  const loadRooms = async () => {
    setLoading(true);
    try {
      const response = await api.get('/rooms');
      setRooms(response.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const loadFavorites = async () => {
    try {
      const res = await api.get('/users/me/favorites');
      setFavoriteIds(res.data.favoriteRoomIds || []);
    } catch {
      // Not signed in or no favorites yet — silent
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      await api.post(`/rooms/${roomId}/join`);
      await refreshUser();
      await loadRooms();
      router.push(`/room/${roomId}`);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to join room');
    }
  };

  const handleToggleFavorite = async (roomId: string) => {
    // Optimistic update
    const wasFav = favoriteIds.includes(roomId);
    setFavoriteIds((prev) =>
      wasFav ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
    try {
      const res = await api.post(`/rooms/${roomId}/favorite`);
      setFavoriteIds(res.data.favoriteRoomIds || []);
    } catch {
      // Revert on error
      setFavoriteIds((prev) =>
        wasFav ? [...prev, roomId] : prev.filter((id) => id !== roomId)
      );
    }
  };

  const visibleRooms =
    viewMode === 'favorites'
      ? rooms.filter((r) => favoriteIds.includes(r.id))
      : rooms;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AnimatedBackground variant="dark" />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={[
              styles.vipCrownBtn,
              user?.vipTier && {
                backgroundColor: VIP_STYLES[user.vipTier].crownColor + '30',
                borderColor: VIP_STYLES[user.vipTier].crownColor,
              },
            ]}
            onPress={() => setVipModalOpen(true)}
            testID="vip-crown-button"
          >
            <Ionicons
              name={
                user?.vipTier === 'elite'
                  ? 'diamond'
                  : user?.vipTier === 'pro'
                  ? 'star'
                  : 'diamond-outline'
              }
              size={20}
              color={user?.vipTier ? VIP_STYLES[user.vipTier].crownColor : COLORS.coin}
            />
            {user?.vipTier && (
              <Text
                style={[styles.vipLabel, { color: VIP_STYLES[user.vipTier].crownColor }]}
              >
                {user.vipTier === 'elite' ? 'ELITE' : 'PRO'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>GenC Vibez</Text>
            <Text style={styles.headerSubtitle}>Choose your vibe</Text>
          </View>

          <View style={styles.headerRight}>
            {user && (
              <View style={styles.statItem}>
                <Ionicons name="wallet" size={16} color={COLORS.coin} />
                <Text style={styles.statText}>{user.coins}</Text>
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.starButton,
                viewMode === 'favorites' && styles.starButtonActive,
              ]}
              onPress={() =>
                setViewMode((m) => (m === 'favorites' ? 'all' : 'favorites'))
              }
              testID="liked-rooms-star"
            >
              <Ionicons
                name={viewMode === 'favorites' ? 'star' : 'star-outline'}
                size={22}
                color={viewMode === 'favorites' ? COLORS.coin : COLORS.text}
              />
              {favoriteIds.length > 0 && (
                <View style={styles.starBadge}>
                  <Text style={styles.starBadgeText}>{favoriteIds.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.segmentRow}>
          <TouchableOpacity
            style={[styles.segment, viewMode === 'all' && styles.segmentActive]}
            onPress={() => setViewMode('all')}
            testID="seg-all"
          >
            <Text
              style={[
                styles.segmentText,
                viewMode === 'all' && styles.segmentTextActive,
              ]}
            >
              All rooms
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, viewMode === 'favorites' && styles.segmentActive]}
            onPress={() => setViewMode('favorites')}
            testID="seg-fav"
          >
            <Ionicons
              name="star"
              size={12}
              color={viewMode === 'favorites' ? COLORS.coin : COLORS.textSecondary}
            />
            <Text
              style={[
                styles.segmentText,
                viewMode === 'favorites' && styles.segmentTextActive,
                { marginLeft: 4 },
              ]}
            >
              Liked ({favoriteIds.length})
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <VipShopModal visible={vipModalOpen} onClose={() => setVipModalOpen(false)} />

      <FlatList
        data={visibleRooms}
        keyExtractor={(item) => item.id}
        numColumns={3}
        columnWrapperStyle={styles.row}
        renderItem={({ item }) => (
          <RoomCard
            room={item}
            isFavorite={favoriteIds.includes(item.id)}
            onPress={() => handleJoinRoom(item.id)}
            onToggleFavorite={() => handleToggleFavorite(item.id)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadRooms}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={viewMode === 'favorites' ? 'star-outline' : 'planet-outline'}
              size={48}
              color={COLORS.textSecondary}
            />
            <Text style={styles.emptyText}>
              {viewMode === 'favorites'
                ? 'No liked rooms yet — tap the ★ on any room'
                : 'No rooms available'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(12,12,18,0.55)',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  vipCrownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.coin,
  },
  vipLabel: {
    fontSize: 10,
    fontWeight: '800',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  statText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  starButton: {
    backgroundColor: COLORS.cardBg,
    width: 40,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  starButtonActive: {
    borderColor: COLORS.coin,
    backgroundColor: COLORS.coin + '20',
  },
  starBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.coin,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  starBadgeText: {
    color: '#1a1a1a',
    fontSize: 10,
    fontWeight: '800',
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: SPACING.sm,
  },
  segment: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  segmentActive: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: COLORS.primary,
  },
  segmentText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  segmentTextActive: {
    color: COLORS.text,
  },
  list: {
    padding: SPACING.md,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.md,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
});
