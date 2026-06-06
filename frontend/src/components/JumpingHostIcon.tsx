import React, { useEffect, useRef } from 'react';
import { Animated, Easing, TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/theme';

interface Props {
  onPress: () => void;
  hasActiveGame?: boolean;
}

/**
 * Small controller icon that gently jumps up and down to draw attention.
 */
export default function JumpingHostIcon({ onPress, hasActiveGame }: Props) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: 500,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.delay(700),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t]);

  const translateY = t.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const scale = t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] });

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={styles.btn}
      testID="host-game-icon"
    >
      <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
        <Ionicons name="game-controller" size={22} color={COLORS.accent} />
      </Animated.View>
      {hasActiveGame ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>!</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 6,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: '800',
  },
});
