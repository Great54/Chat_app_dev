import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
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
  vipTier?: string | null;
  pointsEarned?: number;
  gameWins?: number;
  gameRunnerUps?: number;
  tournamentsWon?: number;
  coinsSpent?: number;
}

type LeaderboardType = 'points' | 'coins-spent';

const TAB_META: { id: LeaderboardType; label: string; icon: any; testId: string }[] = [
  { id: 'points', label: 'Points Earned', icon: 'trophy', testId: 'leaderboard-tab-points' },
  { id: 'coins-spent', label: 'Coins Spent', icon: 'wallet', testId: 'leaderboard-tab-spent' },
];

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('points');
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

  const renderEntry = (entry: LeaderboardEntry) => {
    const medal = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;
    return (
      <View key={entry.id} style={[styles.entryCard, entry.rank <= 3 && styles.entryCardTop]} testID={`leaderboard-row-${entry.rank}`}>
        <View style={[styles.rankBadge, entry.rank === 1 && styles.rankGold, entry.rank === 2 && styles.rankSilver, entry.rank === 3 && styles.rankBronze]}>
          <Text style={[styles.rankText, entry.rank <= 3 && styles.rankTextTop]}>{medal}</Text>
        </View>

        <View style={styles.avatar}>
          <Ionicons name="person" size={24} color={COLORS.textSecondary} />
        </View>

        <View style={styles.entryInfo}>
          <Text style={styles.entryName} numberOfLines={1}>{entry.displayName}</Text>
          <Text style={styles.entryUsername} numberOfLines={1}>@{entry.username}</Text>
          {activeTab === 'points' && (
            <Text style={styles.entryBreakdown}>
              {entry.gameWins || 0}W · {entry.gameRunnerUps || 0}RU
              {entry.tournamentsWon ? ` · ${entry.tournamentsWon}🏆` : ''}
            </Text>
          )}
        </View>

        <View style={styles.entryStats}>
          {activeTab === 'points' ? (
            <>
              <Ionicons name="trophy" size={16} color={COLORS.coin} />
              <Text style={styles.statValue}>{entry.pointsEarned || 0}</Text>
              <Text style={styles.statUnit}>pts</Text>
            </>
          ) : (
            <>
              <Ionicons name="wallet" size={16} color={COLORS.accent} />
              <Text style={styles.statValue}>{entry.coinsSpent || 0}</Text>
              <Text style={styles.statUnit}>🪙</Text>
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leaderboard</Text>
        <Text style={styles.headerSubtitle}>
          {activeTab === 'points'
            ? 'Win games to earn points · 10 for win, 5 for runner-up'
            : 'Top spenders across the platform'}
        </Text>
      </View>

      <View style={styles.tabs}>
        {TAB_META.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.tab, activeTab === t.id && styles.tabActive]}
            onPress={() => setActiveTab(t.id)}
            testID={t.testId}
          >
            <Ionicons
              name={t.icon}
              size={18}
              color={activeTab === t.id ? COLORS.text : COLORS.textSecondary}
            />
            <Text style={[styles.tabText, activeTab === t.id && styles.tabTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Loading…</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={48} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>
              {activeTab === 'points'
                ? 'No points yet — play a game to start earning!'
                : 'No spending recorded yet'}
            </Text>
          </View>
        ) : (
          data.map(renderEntry)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: COLORS.text },
  headerSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  tabs: { flexDirection: 'row', padding: SPACING.sm, gap: SPACING.sm },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.sm, borderRadius: 10,
    backgroundColor: COLORS.cardBg, gap: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '700' },
  tabTextActive: { color: COLORS.text },
  content: { padding: SPACING.md, gap: SPACING.sm },
  entryCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.cardBg, padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.border,
  },
  entryCardTop: { borderColor: COLORS.coin + '55' },
  rankBadge: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm,
    borderWidth: 1, borderColor: COLORS.border,
  },
  rankGold: { backgroundColor: '#fef3c7', borderColor: '#fbbf24' },
  rankSilver: { backgroundColor: '#e5e7eb', borderColor: '#9ca3af' },
  rankBronze: { backgroundColor: '#fde6d3', borderColor: '#d97706' },
  rankText: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  rankTextTop: { fontSize: 20 },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  entryInfo: { flex: 1, marginRight: SPACING.sm },
  entryName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  entryUsername: { fontSize: 11, color: COLORS.textSecondary, marginTop: 1 },
  entryBreakdown: { fontSize: 10, color: COLORS.primary, marginTop: 2, fontWeight: '600' },
  entryStats: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  statUnit: { fontSize: 10, color: COLORS.textSecondary, fontWeight: '600', marginLeft: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl * 2 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, marginTop: SPACING.md, textAlign: 'center', paddingHorizontal: SPACING.lg },
});
