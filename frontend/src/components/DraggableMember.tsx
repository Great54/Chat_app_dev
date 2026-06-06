import React, { useRef, useState } from 'react';
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
}

interface Props {
  member: Member;
  isCurrentUser: boolean;
  boundsWidth: number;
  boundsHeight: number;
  initialIndex: number;
}

const ITEM_SIZE = 48;
const ITEMS_PER_ROW = 6;
const SPACING = 4;

export default function DraggableMember({
  member,
  isCurrentUser,
  boundsWidth,
  boundsHeight,
  initialIndex,
}: Props) {
  // Compute initial grid position
  const row = Math.floor(initialIndex / ITEMS_PER_ROW);
  const col = initialIndex % ITEMS_PER_ROW;
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
        Animated.spring(scale, { toValue: 1.15, useNativeDriver: false, friction: 4 }).start();
        pan.setOffset({ x: offsetRef.current.x, y: offsetRef.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gesture) => {
        setIsDragging(false);
        Animated.spring(scale, { toValue: 1, useNativeDriver: false, friction: 4 }).start();
        let newX = offsetRef.current.x + gesture.dx;
        let newY = offsetRef.current.y + gesture.dy;
        newX = Math.max(0, Math.min(boundsWidth - ITEM_SIZE, newX));
        newY = Math.max(0, Math.min(boundsHeight - ITEM_SIZE, newY));
        offsetRef.current = { x: newX, y: newY };
        pan.flattenOffset();
        Animated.spring(pan, {
          toValue: { x: newX, y: newY },
          useNativeDriver: false,
          friction: 6,
          tension: 60,
        }).start();
      },
    })
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.container,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { scale },
          ],
          zIndex: isDragging ? 10 : 1,
        },
        isDragging && styles.dragging,
        isCurrentUser && styles.currentUser,
      ]}
      testID={`member-${member.userId}`}
    >
      <View style={styles.avatar}>
        {member.profilePhoto ? (
          <Image source={{ uri: member.profilePhoto }} style={styles.avatarImg} />
        ) : (
          <Ionicons name="person" size={20} color={COLORS.primary} />
        )}
        {member.onlineStatus && <View style={styles.onlineDot} />}
      </View>
      <Text style={styles.level} numberOfLines={1}>
        Lv{member.level}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: ITEM_SIZE,
    height: ITEM_SIZE,
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
    overflow: 'visible',
    position: 'relative',
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
  level: {
    fontSize: 8,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
