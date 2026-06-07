import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { SPACING } from '@/src/constants/theme';

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
  { id: 'points', label: 'Points', icon: 'trophy', testId: 'leaderboard-tab-points' },
  { id: 'coins-spent', label: 'Coins Spent', icon: 'wallet', testId: 'leaderboard-tab-spent' },
];

// Gaming Arena Champions palette (Option 3)
const ARENA = {
  bg: '#070512',
  bgDeep: '#0b0820',
  surface: 'rgba(16,12,40,0.78)',
  surfaceSolid: '#15102e',
  border: 'rgba(255,255,255,0.08)',
  borderHot: 'rgba(255, 64, 96, 0.55)',
  text: '#ffffff',
  textDim: '#b9b3d6',
  red: '#ff2e5b',
  redGlow: 'rgba(255, 46, 91, 0.55)',
  cyan: '#22d3ee',
  cyanGlow: 'rgba(34, 211, 238, 0.55)',
  gold: '#ffcd3d',
  goldGlow: 'rgba(255, 205, 61, 0.6)',
  magenta: '#ff5fd8',
  magentaGlow: 'rgba(255, 95, 216, 0.55)',
  vipGold: '#f5b301',
  vipPro: '#7c3aed',
  vip: '#22d3ee',
};

const podiumAccent = (rank: number) => {
  if (rank === 1) return { color: ARENA.gold, glow: ARENA.goldGlow };
  if (rank === 2) return { color: ARENA.cyan, glow: ARENA.cyanGlow };
  return { color: ARENA.magenta, glow: ARENA.magentaGlow };
};

function VipBadge({ tier }: { tier?: string | null }) {
  if (!tier) return null;
  const t = String(tier).toLowerCase();
  const isElite = t.includes('elite');
  const isPro = t.includes('pro');
  const bg = isElite ? ARENA.vipGold : isPro ? ARENA.vipPro : ARENA.vip;
  const label = isElite ? 'VIP ELITE' : isPro ? 'VIP PRO' : 'VIP';
  return (
    <View style={[s.vipBadge, { backgroundColor: bg + '22', borderColor: bg }]}>
      <Ionicons name="diamond" size={9} color={bg} />
      <Text style={[s.vipBadgeText, { color: bg }]}>{label}</Text>
    </View>
  );
}

function Octagon({ size, color, glow, children }: { size: number; color: string; glow: string; children: React.ReactNode }) {
  // Achieves an "octagonal" neon framed look using rotated squares + radius.
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size * 0.28,
          borderWidth: 2,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 0 },
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size - 8,
          height: size - 8,
          borderRadius: (size - 8) * 0.28,
          borderWidth: 1,
          borderColor: glow,
          transform: [{ rotate: '45deg' }],
        }}
      />
      <View style={{ width: size - 14, height: size - 14, borderRadius: (size - 14) / 2, overflow: 'hidden', backgroundColor: '#0b0820' }}>
        {children}
      </View>
    </View>
  );
}

function Avatar({ uri, size }: { uri?: string; size: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />;
  }
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1438' }}>
      <Ionicons name="person" size={size * 0.55} color={ARENA.textDim} />
    </View>
  );
}

function PodiumCard({
  entry,
  metricLabel,
  metricValue,
}: {
  entry: LeaderboardEntry;
  metricLabel: string;
  metricValue: number;
}) {
  const accent = podiumAccent(entry.rank);
  const isFirst = entry.rank === 1;
  const octSize = isFirst ? 92 : 72;
  return (
    <View style={[s.podiumCol, isFirst && s.podiumColFirst]} testID={`leaderboard-podium-${entry.rank}`}>
      <View style={{ alignItems: 'center', marginBottom: 8 }}>
        <Octagon size={octSize} color={accent.color} glow={accent.glow}>
          <Avatar uri={entry.photoUrl} size={octSize - 14} />
        </Octagon>
        {/* Rank chip */}
        <View
          style={[
            s.rankChip,
            {
              backgroundColor: accent.color,
              shadowColor: accent.color,
              top: octSize - 16,
            },
          ]}
        >
          <Text style={s.rankChipText}>{entry.rank}</Text>
        </View>
        {isFirst && (
          <View style={s.crownWrap}>
            <Ionicons name="trophy" size={22} color={ARENA.gold} style={{ textShadowColor: ARENA.goldGlow, textShadowRadius: 12 }} />
          </View>
        )}
      </View>

      {/* Podium block */}
      <View
        style={[
          s.podiumBlock,
          { borderColor: accent.color, shadowColor: accent.color },
          isFirst && s.podiumBlockFirst,
        ]}
      >
        <Text style={s.podiumName} numberOfLines={1}>{entry.displayName}</Text>
        <VipBadge tier={entry.vipTier} />
        <View style={s.podiumMetric}>
          <Ionicons name={metricLabel === 'pts' ? 'trophy' : 'wallet'} size={13} color={ARENA.gold} />
          <Text style={s.podiumMetricValue}>{metricValue.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const [activeTab, setActiveTab] = useState<LeaderboardType>('points');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const metricFor = (e: LeaderboardEntry) =>
    activeTab === 'points' ? e.pointsEarned || 0 : e.coinsSpent || 0;
  const metricUnit = activeTab === 'points' ? 'pts' : '🪙';

  const podium = useMemo(() => {
    const top3 = data.filter((e) => e.rank <= 3);
    // Reorder so that #2 is left, #1 center, #3 right (gaming arena layout)
    const byRank = new Map(top3.map((e) => [e.rank, e]));
    return [byRank.get(2), byRank.get(1), byRank.get(3)].filter(Boolean) as LeaderboardEntry[];
  }, [data]);

  const rest = data.filter((e) => e.rank > 3);

  const renderRow = (entry: LeaderboardEntry) => (
    <View key={entry.id} style={s.row} testID={`leaderboard-row-${entry.rank}`}>
      <View style={s.rowRank}>
        <Text style={s.rowRankText}>{entry.rank}</Text>
      </View>
      <View style={s.rowAvatar}>
        <Avatar uri={entry.photoUrl} size={32} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={s.rowName} numberOfLines={1}>{entry.displayName}</Text>
        {activeTab === 'points' ? (
          <Text style={s.rowSub} numberOfLines={1}>
            {entry.gameWins || 0}W · {entry.gameRunnerUps || 0}RU
            {entry.tournamentsWon ? ` · ${entry.tournamentsWon}🏆` : ''}
          </Text>
        ) : (
          <Text style={s.rowSub} numberOfLines={1}>@{entry.username}</Text>
        )}
      </View>
      <VipBadge tier={entry.vipTier} />
      <View style={s.rowMetric}>
        <Ionicons name={activeTab === 'points' ? 'trophy' : 'wallet'} size={12} color={ARENA.gold} />
        <Text style={s.rowMetricText}>{metricFor(entry).toLocaleString()}</Text>
      </View>
    </View>
  );

  return (
    <View style={s.root}>
      {/* Arena background layers */}
      <View style={s.bgGradient} />
      <View style={s.bgGridLeft} />
      <View style={s.bgGridRight} />
      <View style={[s.scanlineGlow, { top: 90, backgroundColor: ARENA.redGlow }]} />
      <View style={[s.scanlineGlow, { top: 220, backgroundColor: ARENA.cyanGlow, opacity: 0.4 }]} />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerEyebrow}>GAMING ARENA</Text>
            <Text style={s.headerTitle}>Leaderboard</Text>
          </View>
          <View style={s.headerBadge}>
            <Ionicons name="game-controller" size={16} color={ARENA.red} />
          </View>
        </View>

        {/* Tabs */}
        <View style={s.tabs}>
          {TAB_META.map((t) => {
            const active = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.tab, active && s.tabActive]}
                onPress={() => setActiveTab(t.id)}
                testID={t.testId}
                activeOpacity={0.85}
              >
                <Ionicons name={t.icon} size={15} color={active ? '#fff' : ARENA.textDim} />
                <Text style={[s.tabText, active && s.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={s.empty}><Text style={s.emptyText}>Loading…</Text></View>
          ) : data.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="trophy-outline" size={48} color={ARENA.textDim} />
              <Text style={s.emptyText}>
                {activeTab === 'points'
                  ? 'No points yet — play a game to start earning!'
                  : 'No spending recorded yet'}
              </Text>
            </View>
          ) : (
            <>
              {/* Podium */}
              {podium.length > 0 && (
                <View style={s.podiumRow}>
                  {podium.map((p) => (
                    <PodiumCard
                      key={p.id}
                      entry={p}
                      metricLabel={metricUnit}
                      metricValue={metricFor(p)}
                    />
                  ))}
                </View>
              )}

              {/* Rest of list */}
              {rest.length > 0 && (
                <View style={s.listCard}>
                  {rest.map(renderRow)}
                </View>
              )}

              <Text style={s.footerNote}>
                {activeTab === 'points'
                  ? 'Win games to earn points · 10 for win, 5 for runner-up'
                  : 'Top spenders across the platform'}
              </Text>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: ARENA.bg },

  // Background gaming-arena layers
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ARENA.bgDeep,
  },
  bgGridLeft: {
    position: 'absolute',
    left: -120,
    top: -80,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: ARENA.red,
    opacity: 0.18,
    transform: [{ scaleX: 1.6 }],
  },
  bgGridRight: {
    position: 'absolute',
    right: -140,
    bottom: -120,
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: ARENA.cyan,
    opacity: 0.14,
    transform: [{ scaleX: 1.4 }],
  },
  scanlineGlow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    opacity: 0.55,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerEyebrow: {
    color: ARENA.red,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3,
    textShadowColor: ARENA.redGlow,
    textShadowRadius: 8,
  },
  headerTitle: {
    color: ARENA.text,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  headerBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ARENA.borderHot,
    backgroundColor: 'rgba(255,46,91,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ARENA.red,
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    gap: 10,
    marginBottom: SPACING.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: ARENA.border,
  },
  tabActive: {
    backgroundColor: ARENA.red,
    borderColor: ARENA.red,
    shadowColor: ARENA.red,
    shadowOpacity: 0.8,
    shadowRadius: 12,
  },
  tabText: { color: ARENA.textDim, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#fff', fontWeight: '800' },

  scroll: { paddingHorizontal: SPACING.md, paddingBottom: 40 },

  // Podium
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 24,
    paddingBottom: 8,
    gap: 8,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
  },
  podiumColFirst: {
    paddingTop: 0,
    transform: [{ translateY: -10 }],
  },
  rankChip: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.9,
    shadowRadius: 10,
    borderWidth: 2,
    borderColor: '#0b0820',
  },
  rankChipText: {
    color: '#0b0820',
    fontSize: 13,
    fontWeight: '900',
  },
  crownWrap: {
    position: 'absolute',
    top: -14,
  },
  podiumBlock: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    backgroundColor: 'rgba(11,8,32,0.85)',
    alignItems: 'center',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    marginTop: 14,
  },
  podiumBlockFirst: {
    paddingVertical: 14,
    backgroundColor: 'rgba(255, 205, 61, 0.08)',
  },
  podiumName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    maxWidth: '100%',
  },
  podiumMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,205,61,0.4)',
  },
  podiumMetricValue: {
    color: ARENA.gold,
    fontSize: 12,
    fontWeight: '800',
  },

  // List rows
  listCard: {
    marginTop: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ARENA.border,
    backgroundColor: ARENA.surface,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ARENA.border,
    gap: 8,
  },
  rowRank: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: ARENA.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowRankText: {
    color: ARENA.text,
    fontSize: 13,
    fontWeight: '800',
  },
  rowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: ARENA.border,
  },
  rowName: {
    color: ARENA.text,
    fontSize: 14,
    fontWeight: '700',
  },
  rowSub: {
    color: ARENA.textDim,
    fontSize: 11,
    marginTop: 1,
  },
  rowMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,205,61,0.3)',
  },
  rowMetricText: {
    color: ARENA.gold,
    fontSize: 12,
    fontWeight: '800',
  },

  // VIP badge
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 4,
  },
  vipBadgeText: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  footerNote: {
    color: ARENA.textDim,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },

  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    color: ARENA.textDim,
    fontSize: 14,
    marginTop: SPACING.md,
    textAlign: 'center',
    paddingHorizontal: SPACING.lg,
  },
});
