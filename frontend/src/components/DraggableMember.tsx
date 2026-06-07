import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, TouchableOpacity } from 'react-native';
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
    avatarScale: 1.25,
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
  const ITEMS_PER_ROW = Math.max(1, Math.floor(boundsWidth / (ITEM_SIZE + 8)));
  const SPACING = 4;

  // Compute initial grid position
  const row = Math.floor(initialIndex / ITEMS_PER_ROW);
  const col = initialIndex % ITEMS_PER_ROW;
  const initialX = col * (ITEM_SIZE + SPACING);
  const initialY = row * (ITEM_SIZE + SPACING);

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

  // Smooth animation to an externally-set target (tap-to-move)
  useEffect(() => {
    if (!isCurrentUser || !targetPosition) return;
    const clamped = clampPosition(targetPosition.x, targetPosition.y);
    offsetRef.current = clamped;
    Animated.spring(pan, {
      toValue: clamped,
      useNativeDriver: false,
      friction: 7,
      tension: 50,
    }).start();
  }, [targetPosition?.x, targetPosition?.y, isCurrentUser]);

  // Drag for current user only
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isCurrentUser,
      onMoveShouldSetPanResponder: (_, g) =>
        isCurrentUser && (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2),
      onPanResponderGrant: () => {
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
