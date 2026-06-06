import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';
import { VIP_STYLES } from '@/src/utils/vip';
import { getActivityVisual, formatRelativeTime } from '@/src/utils/activity';
import { useProfilePopup } from '@/src/contexts/ProfilePopupContext';

interface FeedActivityUser {
  id: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  vipTier?: 'pro' | 'elite' | null;
}

interface FeedActivity {
  id: string;
  type: string;
  message: string;
  metadata: Record<string, any>;
  audience: 'self' | 'friends';
  createdAt: string;
  user: FeedActivityUser;
  actor: {
    id: string;
    displayName: string;
    photoUrl?: string;
    vipTier?: 'pro' | 'elite' | null;
  } | null;
  isOwn: boolean;
}

const POLL_INTERVAL = 15000;

export default function FeedTab({ active }: { active: boolean }) {
  const { openProfile } = useProfilePopup();
  const [items, setItems] = useState<FeedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadFeed = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const res = await api.get('/feed', { params: { limit: 40 } });
      setItems(Array.isArray(res.data) ? res.data : []);
      setError(null);
      try { await api.post('/feed/mark-seen'); } catch { /* non-fatal */ }
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Could not load feed');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load + polling when active
  useEffect(() => {
    if (!active) return;
    loadFeed(items.length === 0);
    pollRef.current = setInterval(() => loadFeed(false), POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFeed(false);
  }, [loadFeed]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Ionicons name="cloud-offline-outline" size={42} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>{error}</Text>
        <TouchableOpacity onPress={() => loadFeed(true)} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="sparkles-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.emptyTitle}>Your feed is quiet</Text>
        <Text style={styles.emptyText}>
          Friend activities, gifts, and VIP upgrades will appear here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(it) => it.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      renderItem={({ item, index }) => (
        <FeedCard item={item} index={index} onTapUser={openProfile} />
      )}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
        />
      }
    />
  );
}

// --- Card ---
function FeedCard({
  item,
  index,
  onTapUser,
}: {
  item: FeedActivity;
  index: number;
  onTapUser: (id: string) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const transY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.spring(transY, {
        toValue: 0,
        delay: index * 40,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      }),
    ]).start();
  }, [fadeAnim, transY, index]);

  const visual = getActivityVisual(item.type);
  // Defensive check: item.user could be {} (empty object) if user lookup failed
  const fallbackUser: FeedActivityUser = { id: '', displayName: 'Unknown', username: '', photoUrl: undefined, vipTier: null };
  const subject = (item.user && item.user.displayName) ? item.user : fallbackUser;
  const vipStyle = subject.vipTier ? VIP_STYLES[subject.vipTier] : null;
  const subtitle = item.message || '';
  // Ensure createdAt is valid before formatting
  const ts = item.createdAt ? formatRelativeTime(item.createdAt) : 'just now';
  const meta = item.metadata || {};

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: transY }] }}>
      <View style={styles.card}>
        {/* Left rail with type icon */}
        <LinearGradient
          colors={visual.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.typeBadge}
        >
          <Ionicons name={visual.icon} size={18} color={COLORS.text} />
        </LinearGradient>

        {/* Body */}
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              onPress={() => onTapUser(subject.id)}
              activeOpacity={0.7}
              style={styles.avatarWrap}
              testID={`feed-avatar-${item.id}`}
            >
              <View
                style={[
                  styles.avatar,
                  vipStyle && { borderColor: vipStyle.borderColor, borderWidth: 2 },
                ]}
              >
                {subject.photoUrl ? (
                  <Image source={{ uri: subject.photoUrl }} style={styles.avatarImg} />
                ) : (
                  <Ionicons name="person" size={16} color={COLORS.textSecondary} />
                )}
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <View style={styles.titleLine}>
                <TouchableOpacity onPress={() => onTapUser(subject.id)} activeOpacity={0.7}>
                  <Text
                    style={[
                      styles.displayName,
                      vipStyle && { color: vipStyle.nameColor },
                    ]}
                    numberOfLines={1}
                  >
                    {item.isOwn ? 'You' : subject.displayName}
                  </Text>
                </TouchableOpacity>
                {vipStyle && (
                  <View style={[styles.vipPill, { backgroundColor: vipStyle.crownColor }]}>
                    <Ionicons name={vipStyle.badgeIcon} size={9} color={COLORS.background} />
                    <Text style={styles.vipPillText}>{subject.vipTier?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.subtitle} numberOfLines={3}>
                {item.isOwn
                  ? subtitle.charAt(0).toUpperCase() + subtitle.slice(1)
                  : subtitle}
              </Text>
              {/* Metadata pill / preview */}
              {meta.giftIcon && meta.giftName && (
                <View style={styles.metaPill}>
                  <View
                    style={[
                      styles.metaIconBox,
                      { backgroundColor: (meta.giftColor || visual.color) + '33' },
                    ]}
                  >
                    <Ionicons
                      name={meta.giftIcon}
                      size={14}
                      color={meta.giftColor || visual.color}
                    />
                  </View>
                  <Text style={styles.metaText}>{meta.giftName}</Text>
                  {typeof meta.price === 'number' && (
                    <View style={styles.priceTag}>
                      <Ionicons name="logo-bitcoin" size={10} color={COLORS.coin} />
                      <Text style={styles.priceText}>{meta.price}</Text>
                    </View>
                  )}
                </View>
              )}
              {meta.tierName && (
                <View style={styles.metaPill}>
                  <View
                    style={[
                      styles.metaIconBox,
                      { backgroundColor: visual.color + '33' },
                    ]}
                  >
                    <Ionicons name={visual.icon} size={14} color={visual.color} />
                  </View>
                  <Text style={styles.metaText}>{meta.tierName}</Text>
                </View>
              )}
              {meta.friendName && (
                <View style={styles.metaPill}>
                  <View
                    style={[
                      styles.metaIconBox,
                      { backgroundColor: visual.color + '33' },
                    ]}
                  >
                    <Ionicons name="people" size={14} color={visual.color} />
                  </View>
                  <Text style={styles.metaText}>{meta.friendName}</Text>
                </View>
              )}
            </View>
            <Text style={styles.ts}>{ts}</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: '#15101f',
    borderRadius: 14,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: '#2a2240',
    gap: SPACING.sm,
  },
  typeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  body: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
  },
  avatarWrap: {
    width: 36,
    height: 36,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  displayName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  vipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  vipPillText: {
    color: COLORS.background,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: COLORS.text,
    opacity: 0.85,
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  ts: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginLeft: 4,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#1a1226',
    borderRadius: 10,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#2a2240',
  },
  metaIconBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: '#2a2010',
    borderRadius: 6,
    marginLeft: 4,
  },
  priceText: {
    color: COLORS.coin,
    fontSize: 11,
    fontWeight: '700',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: SPACING.lg,
  },
  retryBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  retryText: {
    color: COLORS.text,
    fontWeight: '700',
  },
});
