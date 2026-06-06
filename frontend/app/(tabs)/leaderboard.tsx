import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  coins?: number;
  messageCount?: number;
  level: number;
}

type LeaderboardType = 'coins' | 'active';

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('coins');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/leaderboard/${activeTab}`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderEntry = (entry: LeaderboardEntry) => (
    <View key={entry.id} style={styles.entryCard}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{entry.rank}</Text>
      </View>
      
      <View style={styles.avatar}>
        {entry.photoUrl ? (
          <Text>Photo</Text>
        ) : (
          <Ionicons name="person" size={24} color={COLORS.textSecondary} />
        )}
      </View>
      
      <View style={styles.entryInfo}>
        <Text style={styles.entryName}>{entry.displayName}</Text>
        <Text style={styles.entryUsername}>@{entry.username}</Text>
      </View>
      
      <View style={styles.entryStats}>
        {activeTab === 'coins' && (
          <>
            <Ionicons name="wallet" size={16} color={COLORS.coin} />
            <Text style={styles.statValue}>{entry.coins}</Text>
          </>
        )}
        {activeTab === 'active' && (
          <>
            <Ionicons name="chatbubbles" size={16} color={COLORS.primary} />
            <Text style={styles.statValue}>{entry.messageCount}</Text>
          </>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'coins' && styles.tabActive]}
          onPress={() => setActiveTab('coins')}
        >
          <Ionicons
            name="wallet"
            size={20}
            color={activeTab === 'coins' ? COLORS.text : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'coins' && styles.tabTextActive]}>
            Coins
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Ionicons
            name="chatbubbles"
            size={20}
            color={activeTab === 'active' ? COLORS.text : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Active
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>No data yet</Text>
          </View>
        ) : (
          data.map(renderEntry)
        )}
      </ScrollView>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  tabs: {
    flexDirection: 'row',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.cardBg,
    gap: 4,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.text,
  },
  content: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderRadius: 12,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  rankText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  entryUsername: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  entryStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
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