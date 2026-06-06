import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/theme';

interface Member {
  userId: string;
  username: string;
  profilePhoto?: string;
  level: number;
  onlineStatus: boolean;
  vipTier?: string | null;
}

interface Props {
  member: Member;
  isCurrentUser: boolean;
  boundsWidth: number;
  boundsHeight: number;
  initialIndex: number;
  totalMembers: number;
}

const VIP_STYLES: Record<string, any> = {
  pro: {
    borderColor: '#FFD700',
    crownColor: '#FFD700',
    badgeIcon: 'star',
    avatarScale: 1.1,
    nameColor: '#FFD700',
  },
  elite: {
    borderColor: '#FF69B4',
    crownColor: '#FF69B4',
    badgeIcon: 'diamond',
    avatarScale: 1.25,
    nameColor: '#FF69B4',
  },
};

export default function DraggableMember({
  member,
  isCurrentUser,
  boundsWidth,
  boundsHeight,
  initialIndex,
  totalMembers,
}: Props) {
  // Calculate dynamic sizing based on room occupancy
  const calculateAvatarSize = () => {
    // Base size: 48px for 1-10 people, scale down as more join
    if (totalMembers <= 10) return 48;
    if (totalMembers <= 20) return 42;
    if (totalMembers <= 30) return 36;
    return 32; // Min size for full rooms
  };

  const ITEM_SIZE = calculateAvatarSize();
  const ITEMS_PER_ROW = Math.floor(boundsWidth / (ITEM_SIZE + 8));
  const SPACING = 4;

  // Compute initial grid position
  const row = Math.floor(initialIndex / Math.max(ITEMS_PER_ROW, 1));
  const col = initialIndex % Math.max(ITEMS_PER_ROW, 1);
  const initialX = col * (ITEM_SIZE + SPACING);
  const initialY = row * (ITEM_SIZE + SPACING);

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;
  const scale = useRef(new Animated.Value(1)).current;
  const offsetRef = useRef({ x: initialX, y: initialY });
  const [isDragging, setIsDragging] = useState(false);

  // Only current user's avatar is draggable
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isCurrentUser,
      onMoveShouldSetPanResponder: () => isCurrentUser,
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

        // Smooth animation to final position
        let newX = offsetRef.current.x + gesture.dx;
        let newY = offsetRef.current.y + gesture.dy;
        newX = Math.max(0, Math.min(boundsWidth - ITEM_SIZE, newX));
        newY = Math.max(0, Math.min(boundsHeight - ITEM_SIZE, newY));
        offsetRef.current = { x: newX, y: newY };
        pan.flattenOffset();

        // Smooth spring animation for drop
        Animated.spring(pan, {
          toValue: { x: newX, y: newY },
          useNativeDriver: false,
          friction: 6,
          tension: 60,
        }).start();
      },
    })
  ).current;

  const vipStyle = member.vipTier ? VIP_STYLES[member.vipTier] : null;
  const effectiveScale = vipStyle ? vipStyle.avatarScale : 1;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          width: ITEM_SIZE,
          height: ITEM_SIZE,
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
          zIndex: isDragging ? 10 : vipStyle ? 5 : 1,
        },
        isDragging && styles.dragging,
        isCurrentUser && styles.currentUser,
      ]}
      testID={`member-${member.userId}`}
    >
      <View
        style={[
          styles.avatar,
          { width: ITEM_SIZE - 8, height: ITEM_SIZE - 8 },
          vipStyle && { borderColor: vipStyle.borderColor, borderWidth: 3 },
        ]}
      >
        {member.profilePhoto ? (
          <Image
            source={{ uri: member.profilePhoto }}
            style={{
              width: ITEM_SIZE - 14,
              height: ITEM_SIZE - 14,
              borderRadius: (ITEM_SIZE - 14) / 2,
            }}
          />
        ) : (
          <Ionicons
            name="person"
            size={ITEM_SIZE / 2.4}
            color={vipStyle?.crownColor || COLORS.primary}
          />
        )}
        {member.onlineStatus && <View style={styles.onlineDot} />}
        {vipStyle && (
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
        )}
      </View>
      {vipStyle ? (
        <Text
          style={[
            styles.vipLabel,
            { color: vipStyle.crownColor, fontSize: Math.max(7, ITEM_SIZE / 10) },
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
  currentUser: {
    // Distinct visual cue for own avatar (draggable)
  },
  avatar: {
    borderRadius: 999,
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
    bottom: 0,
    right: 0,
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
    borderWidth: 1.5,
    borderColor: COLORS.cardBg,
  },
});
