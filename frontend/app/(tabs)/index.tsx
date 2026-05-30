import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import RoomCard from '@/src/components/RoomCard';
import api from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { COLORS, SPACING } from '@/src/constants/theme';

interface Room {
  id: string;
  roomName: string;
  roomCategory: string;
  roomDescription: string;
  currentUserCount: number;
  maxCapacity: number;
}

export default function RoomsScreen() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    loadRooms();
    initializeRooms();
  }, []);

  const initializeRooms = async () => {
    try {
      await api.post('/init/rooms');
    } catch (error) {
      // Rooms already exist, ignore error
    }
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>GenC Vibez</Text>
            <Text style={styles.headerSubtitle}>Choose your vibe</Text>
          </View>
          {user && (
            <View style={styles.stats}>
              <View style={styles.statItem}>
                <Ionicons name="wallet" size={16} color={COLORS.coin} />
                <Text style={styles.statText}>{user.coins}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="trending-up" size={16} color={COLORS.xp} />
                <Text style={styles.statText}>Lv {user.level}</Text>
              </View>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RoomCard room={item} onPress={() => handleJoinRoom(item.id)} />
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
            <Ionicons name="planet-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No rooms available</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  stats: {
    flexDirection: 'row',
    gap: SPACING.md,
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
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    padding: SPACING.md,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: SPACING.md,
  },
});