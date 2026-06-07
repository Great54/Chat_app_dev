import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, Easing, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/theme';
import { getAuraStyle, findBadge, VIP_PRO_AVATAR_SCALE } from '@/src/utils/vipProCustomization';

interface Member {
  userId: string;
  username: string;
  profilePhoto?: string;
  level: number;
  onlineStatus: boolean;
  vipTier?: string | null;
  vipBadgeId?: string | null;
  auraType?: string | null;
  auraColor?: string | null;
  usernameColor?: string | null;
  enlargedAvatar?: boolean;
}

interface Props {
  member: Member;
  isCurrentUser: boolean;
  boundsWidth: number;
  boundsHeight: number;
  initialIndex: number;
  totalMembers: number;
  // External target: when set, current user's avatar smoothly animates to this position
  targetPosition?: { x: number; y: number } | null;
  // Tap handler (used to start a private chat with another user)
  onAvatarPress?: (member: Member) => void;
}

const VIP_STYLES: Record<string, any> = {
  pro: {
    borderColor: '#FFD700',
    crownColor: '#FFD700',
    badgeIcon: 'star',
    avatarScale: 1.1,
    nameColor: '#FFD700',
    gradientColors: ['#FFD700', '#FFA500'],
    haloColor: 'rgba(255,215,0,0.55)',
  },
  elite: {
    borderColor: '#fbbf24',
    crownColor: '#fbbf24',
    badgeIcon: 'diamond',
    avatarScale: 1.18,
    nameColor: '#fde68a',
    // Premium golden→crimson→violet gradient frame
    gradientColors: ['#fde68a', '#fbbf24', '#dc2626', '#7c2d12', '#4c1d95'],
    haloColor: 'rgba(251,191,36,0.85)',
  },
};

export default function DraggableMember({
  member,
  isCurrentUser,
  boundsWidth,
  boundsHeight,
  initialIndex,
  totalMembers,
  targetPosition,
  onAvatarPress,
}: Props) {
  // Dynamic sizing: bigger when room is sparse, shrink as it fills up
  const calculateAvatarSize = () => {
    if (totalMembers <= 6) return 80;
    if (totalMembers <= 10) return 70;
    if (totalMembers <= 16) return 56;
    if (totalMembers <= 24) return 44;
    if (totalMembers <= 32) return 36;
    return 30; // Min size for full rooms
  };

  const ITEM_SIZE = calculateAvatarSize();

  // Scattered (but stable per-user) initial placement.
  //
  // We previously placed avatars on a strict grid using `initialIndex`, which
  // made everyone appear in a perfect line/row when they joined. The user
  // asked for them to "pop in any part of the room" while still being
  // arranged in the join order (i.e. positions deterministic, not random
  // each render).
  //
  // Implementation: a Halton low-discrepancy sequence indexed by
  // `initialIndex` (preserves join order — earlier members get earlier,
  // well-spread cells) lightly jittered by a hash of the userId so two users
  // who happen to land on the same Halton point still drift apart.
  const halton = (i: number, base: number) => {
    let f = 1;
    let r = 0;
    let idx = i + 1; // 1-based
    while (idx > 0) {
      f /= base;
      r += f * (idx % base);
      idx = Math.floor(idx / base);
    }
    return r; // 0..1
  };

  const hashStr = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return h;
  };

  const MARGIN = Math.max(8, Math.round(ITEM_SIZE * 0.15));
  const maxX = Math.max(0, boundsWidth - ITEM_SIZE - MARGIN * 2);
  const maxY = Math.max(0, boundsHeight - ITEM_SIZE - MARGIN * 2);

  const hashU = hashStr(member.userId || `idx-${initialIndex}`);
  // Small jitter (±12% of an avatar cell) so identical Halton coords still
  // separate visually.
  const jitterX = (((hashU & 0xffff) / 0xffff) - 0.5) * ITEM_SIZE * 0.24;
  const jitterY = ((((hashU >>> 16) & 0xffff) / 0xffff) - 0.5) * ITEM_SIZE * 0.24;

  const initialX = Math.max(
    0,
    Math.min(maxX, Math.round(MARGIN + halton(initialIndex, 2) * maxX + jitterX)),
  );
  const initialY = Math.max(
    0,
    Math.min(maxY, Math.round(MARGIN + halton(initialIndex, 3) * maxY + jitterY)),
  );

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const offsetRef = useRef({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);

  const clampPosition = (x: number, y: number) => {
    const maxX = Math.max(0, boundsWidth - ITEM_SIZE);
    const maxY = Math.max(0, boundsHeight - ITEM_SIZE);
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y)),
    };
  };

  // Track the currently-running tap-to-move animation so we can interrupt it
  // cleanly if the user taps another spot mid-glide.
  const moveAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Smooth animation to an externally-set target (tap-to-move).
  // Slower, easy-to-follow timing curve (~900ms). Interruptible: any in-flight
  // animation is stopped before kicking off the new one so the avatar glides
  // toward the LATEST tap point only, not chains them.
  useEffect(() => {
    if (!isCurrentUser || !targetPosition) return;
    const clamped = clampPosition(targetPosition.x, targetPosition.y);

    // Stop the previous glide so it doesn't fight the new one.
    if (moveAnimRef.current) {
      moveAnimRef.current.stop();
      moveAnimRef.current = null;
    }
    // Distance-aware duration: small hop = quicker, long traverse = longer
    // but always perceptibly slow (>= 900ms, up to 2000ms for a long sweep).
    // We read pan's current value via __getValue() so chained taps measure
    // the *current* position, not the original cell.
    // @ts-ignore — internal but supported on web + native
    const cur = (pan as any).__getValue?.() ?? offsetRef.current;
    const dx = clamped.x - (cur.x ?? offsetRef.current.x);
    const dy = clamped.y - (cur.y ?? offsetRef.current.y);
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = Math.max(900, Math.min(2000, 900 + dist * 1.8));

    offsetRef.current = clamped;
    const anim = Animated.timing(pan, {
      toValue: clamped,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    moveAnimRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) moveAnimRef.current = null;
    });
  }, [targetPosition?.x, targetPosition?.y, isCurrentUser]);

  // Drag for current user only
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isCurrentUser,
      onMoveShouldSetPanResponder: (_, g) =>
        isCurrentUser && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      onPanResponderGrant: () => {
        // If a tap-to-move glide is in flight, stop it so the drag takes over.
        if (moveAnimRef.current) {
          moveAnimRef.current.stop();
          moveAnimRef.current = null;
        }
        setIsDragging(true);
        Animated.spring(scale, {
          toValue: 1.15,
          useNativeDriver: false,
          friction: 4,
        }).start();
        pan.setOffset({ x: offsetRef.current.x, y: offsetRef.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        setIsDragging(false);
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: false,
          friction: 4,
        }).start();

        const clamped = clampPosition(
          offsetRef.current.x + gesture.dx,
          offsetRef.current.y + gesture.dy
        );
        offsetRef.current = clamped;
        pan.flattenOffset();

        Animated.spring(pan, {
          toValue: clamped,
          useNativeDriver: false,
          friction: 6,
          tension: 60,
        }).start();
      },
    })
  ).current;

  const vipStyle = member.vipTier ? VIP_STYLES[member.vipTier] : null;
  const enlargedScale = member.enlargedAvatar ? VIP_PRO_AVATAR_SCALE : 1;
  const effectiveScale = (vipStyle ? vipStyle.avatarScale : 1) * enlargedScale;
  const auraStyle = getAuraStyle(member.auraType, member.auraColor, ITEM_SIZE);
  const customBadge = findBadge(member.vipBadgeId);
  const isElite = member.vipTier === 'elite';

  const avatarInner = (
    <View
      style={[
        styles.avatar,
        { width: ITEM_SIZE - 8, height: ITEM_SIZE - 8 },
        vipStyle && !isElite && { borderColor: vipStyle.borderColor, borderWidth: 3 },
        isElite && { borderWidth: 0 },
        isCurrentUser && styles.currentUserRing,
        auraStyle,
        // Premium golden halo for Elite (web boxShadow + RN shadow)
        isElite && {
          // @ts-ignore – RN web supports boxShadow
          boxShadow: `0 0 14px 3px ${vipStyle.haloColor}, 0 0 26px 8px rgba(251,191,36,0.35)`,
          shadowColor: '#fbbf24',
          shadowOpacity: 0.9,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 },
          elevation: 12,
        },
      ]}
    >
      {member.profilePhoto ? (
        <Image
          source={{ uri: member.profilePhoto }}
          style={{
            width: ITEM_SIZE - 14,
            height: ITEM_SIZE - 14,
            borderRadius: 0,
          }}
        />
      ) : (
        <Ionicons
          name="person"
          size={ITEM_SIZE / 2.4}
          color={vipStyle?.crownColor || COLORS.primary}
        />
      )}
      {customBadge ? (
        <View
          style={[
            styles.customBadge,
            { backgroundColor: customBadge.bg, width: ITEM_SIZE * 0.42, height: ITEM_SIZE * 0.42, borderRadius: ITEM_SIZE * 0.21 },
          ]}
        >
          <Text style={{ fontSize: ITEM_SIZE * 0.24 }}>{customBadge.emoji}</Text>
        </View>
      ) : vipStyle ? (
        <View
          style={[
            styles.vipBadge,
            { backgroundColor: vipStyle.crownColor },
          ]}
        >
          <Ionicons
            name={vipStyle.badgeIcon}
            size={8}
            color={COLORS.background}
          />
        </View>
      ) : null}
    </View>
  );

  // Wrap Elite in a multi-stop gradient ring for premium look
  const avatarVisual = isElite ? (
    <LinearGradient
      colors={vipStyle.gradientColors as [string, string, ...string[]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        padding: 2.5,
        borderRadius: 4,
        // @ts-ignore
        boxShadow: '0 0 12px 2px rgba(251,191,36,0.55)',
      }}
    >
      {avatarInner}
    </LinearGradient>
  ) : (
    avatarInner
  );

  return (
    <Animated.View
      {...(isCurrentUser ? panResponder.panHandlers : {})}
      style={[
        styles.container,
        {
          width: ITEM_SIZE,
          height: ITEM_SIZE + (vipStyle ? 14 : 0),
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            {
              scale: Animated.multiply(
                scale,
                new Animated.Value(effectiveScale)
              ),
            },
          ],
          zIndex: isDragging ? 10 : isCurrentUser ? 6 : vipStyle ? 5 : 1,
        },
        isDragging && styles.dragging,
      ]}
      testID={`member-${member.userId}`}
    >
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onAvatarPress?.(member)}
        testID={`avatar-tap-${member.userId}`}
      >
        {avatarVisual}
      </TouchableOpacity>
      {vipStyle ? (
        <Text
          style={[
            styles.vipLabel,
            { color: member.usernameColor || vipStyle.crownColor, fontSize: Math.max(7, ITEM_SIZE / 10) },
          ]}
          numberOfLines={1}
        >
          {member.vipTier === 'elite' ? 'ELITE' : 'PRO'}
        </Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragging: {
    elevation: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  currentUserRing: {
    borderColor: COLORS.accent,
    borderWidth: 2.5,
  },
  avatar: {
    borderRadius: 0,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    overflow: 'visible',
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.cardBg,
  },
  vipLabel: {
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  vipBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,    borderColor: COLORS.cardBg,
  },
  customBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.cardBg,
  },
});
