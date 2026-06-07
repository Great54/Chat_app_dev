import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '@/src/api/client';
import AvatarWithAura from './AvatarWithAura';
import { findBadge } from '@/src/utils/vipProCustomization';

export interface PriorityWelcome {
  id: string;
  tier: string;
  tierLabel: string;
  userId: string;
  username: string;
  displayName: string;
  photoUrl?: string | null;
  vipBadgeId?: string | null;
  auraType?: string | null;
  auraColor?: string | null;
  usernameColor?: string | null;
  message: string;
  durationMs: number;
  createdAt: string;
}

interface Props {
  roomId: string;
  /** Polling interval in ms. Defaults to 1500ms. */
  pollIntervalMs?: number;
}

// Cursive premium font stack — Great Vibes is loaded in +html.tsx for web.
const CURSIVE_FONT = Platform.select({
  web: '"Great Vibes", "Dancing Script", "Pinyon Script", cursive',
  default: 'System',
}) as string;

const SCRIPT_FONT = Platform.select({
  web: '"Dancing Script", "Brush Script MT", cursive',
  default: 'System',
}) as string;

/**
 * Renders any active VIP Elite priority welcome notifications at the top of a room.
 * Notifications slide-down (350ms), hold (~3300ms), then slide-up + fade-out (350ms).
 * pointerEvents='box-none' so the banner never blocks chat interaction underneath.
 */
export default function VipEliteWelcomeBanner({ roomId, pollIntervalMs = 1500 }: Props) {
  const [active, setActive] = useState<PriorityWelcome[]>([]);
  const seenIds = useRef<Set<string>>(new Set());
  const timers = useRef<Record<string, any>>({});

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}/priority-welcomes`, {
          params: { since_ms: 6000 },
        });
        if (cancelled || !Array.isArray(data)) return;
        const fresh = data.filter((w: PriorityWelcome) => !seenIds.current.has(w.id));
        if (fresh.length === 0) return;
        fresh.forEach((w: PriorityWelcome) => seenIds.current.add(w.id));
        setActive((prev) => [...prev, ...fresh]);
      } catch (e) {
        // Non-critical UX; log for dev visibility but don't break the room.
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[VipEliteWelcomeBanner] poll failed:', e);
        }
      }
    };
    poll();
    const interval = setInterval(poll, pollIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(interval);
      Object.values(timers.current).forEach(clearTimeout);
      timers.current = {};
    };
  }, [roomId, pollIntervalMs]);

  const handleDismiss = (id: string) => {
    setActive((prev) => prev.filter((p) => p.id !== id));
  };

  if (active.length === 0) return null;

  return (
    <View
      style={styles.container}
      pointerEvents="box-none"
      testID="vip-elite-welcome-banner"
    >
      {active.map((w) => (
        <WelcomeCard
          key={w.id}
          welcome={w}
          onDismiss={() => handleDismiss(w.id)}
        />
      ))}
    </View>
  );
}

function WelcomeCard({
  welcome,
  onDismiss,
}: {
  welcome: PriorityWelcome;
  onDismiss: () => void;
}) {
  const slideAnim = useRef(new Animated.Value(-90)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide-down + fade-in (useNativeDriver:false because react-native-web has no RCTAnimation module)
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();

    // Looping shimmer across the banner
    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: false,
      })
    ).start();

    // After ~3500ms, slide back up + fade out, then notify parent to remove
    const totalMs = welcome.durationMs || 4000;
    const holdMs = Math.max(800, totalMs - 500);
    const exitTimer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -90,
          duration: 400,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: false,
        }),
      ]).start(() => onDismiss());
    }, holdMs);

    return () => clearTimeout(exitTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const badge = findBadge(welcome.vipBadgeId);

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-260, 260],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        { transform: [{ translateY: slideAnim }], opacity },
      ]}
      pointerEvents="none"
      testID={`vip-elite-welcome-${welcome.userId}`}
    >
      <LinearGradient
        colors={['#fde68a', '#fbbf24', '#dc2626', '#7c2d12'] as [string, string, ...string[]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={styles.cardInner}>
          {/* Subtle radial-style inner glow */}
          <LinearGradient
            colors={['rgba(251,191,36,0.18)', 'rgba(124,58,237,0.10)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Animated shimmer streak */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shimmer,
              { transform: [{ translateX: shimmerTranslate }, { skewX: '-20deg' }] },
            ]}
          />

          <AvatarWithAura
            photoUrl={welcome.photoUrl}
            displayName={welcome.displayName}
            size={40}
            vipTier={welcome.tier}
            vipBadgeId={welcome.vipBadgeId}
            auraType={welcome.auraType || 'glow'}
            auraColor={welcome.auraColor || '#fbbf24'}
            enlargedAvatar={false}
            showBadge
          />

          <View style={styles.body}>
            <View style={styles.nameRow}>
              <Text
                style={[
                  styles.name,
                  { fontFamily: SCRIPT_FONT },
                  welcome.usernameColor ? { color: welcome.usernameColor } : null,
                ]}
                numberOfLines={1}
              >
                {welcome.displayName}
              </Text>
              <View style={styles.eliteChip}>
                <Ionicons name="star" size={9} color="#0f0a1f" />
                <Text style={styles.eliteChipText}>{welcome.tierLabel || 'ELITE'}</Text>
              </View>
            </View>
            <Text
              style={[styles.message, { fontFamily: CURSIVE_FONT }]}
              numberOfLines={1}
            >
              {welcome.message || 'has graced the room'}
            </Text>
          </View>

          {badge && (
            <View style={[styles.bigBadge, { backgroundColor: badge.bg }]}>
              <Text style={{ fontSize: 20 }}>{badge.emoji}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 6,
    left: 0,
    right: 0,
    zIndex: 999,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    marginBottom: 6,
  },
  gradientBorder: {
    borderRadius: 14,
    padding: 2,
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
    // @ts-ignore – RN web supports boxShadow
    boxShadow: '0 6px 22px rgba(251,191,36,0.45), 0 0 0 1px rgba(255,255,255,0.08) inset',
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a0f2e',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  shimmer: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  body: {
    flex: 1,
    marginLeft: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    color: '#fff7ed',
    fontWeight: '700',
    fontSize: 20,
    lineHeight: 24,
    flexShrink: 1,
    // text-shadow for that glowy gold look
    // @ts-ignore – RN web supports textShadow shorthand
    textShadow: '0 1px 6px rgba(251,191,36,0.55)',
  },
  eliteChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  eliteChipText: {
    color: '#0f0a1f',
    fontWeight: '900',
    fontSize: 9,
    letterSpacing: 0.6,
  },
  message: {
    color: '#fde68a',
    fontSize: 16,
    lineHeight: 18,
    marginTop: 1,
    // @ts-ignore
    textShadow: '0 1px 4px rgba(0,0,0,0.4)',
  },
  bigBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fbbf24',
  },
});
