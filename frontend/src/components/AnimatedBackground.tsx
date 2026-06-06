import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Floating, blurred orbs over an animated gradient. Gives the screen
 * a soft "3D depth" feel without requiring a 3D engine.
 */

interface OrbCfg {
  size: number;
  color: string;
  startX: string;
  startY: string;
  duration: number;
  delay: number;
  amplitude: number;
}

const ORBS: OrbCfg[] = [
  { size: 320, color: 'rgba(139,92,246,0.35)', startX: '-10%', startY: '-15%', duration: 14000, delay: 0, amplitude: 90 },
  { size: 260, color: 'rgba(236,72,153,0.30)', startX: '70%', startY: '5%', duration: 17000, delay: 1200, amplitude: 70 },
  { size: 380, color: 'rgba(99,102,241,0.28)', startX: '20%', startY: '60%', duration: 19000, delay: 2400, amplitude: 100 },
  { size: 220, color: 'rgba(251,191,36,0.22)', startX: '60%', startY: '70%', duration: 13000, delay: 600, amplitude: 60 },
  { size: 300, color: 'rgba(16,185,129,0.20)', startX: '-5%', startY: '85%', duration: 21000, delay: 1800, amplitude: 120 },
];

function FloatingOrb({ cfg }: { cfg: OrbCfg }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, {
          toValue: 1,
          duration: cfg.duration,
          delay: cfg.delay,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(t, {
          toValue: 0,
          duration: cfg.duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [cfg, t]);

  const translateX = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, cfg.amplitude],
  });
  const translateY = t.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -cfg.amplitude * 0.7],
  });
  const scale = t.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.15, 1],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: cfg.size,
          height: cfg.size,
          left: cfg.startX as any,
          top: cfg.startY as any,
          backgroundColor: cfg.color,
          transform: [{ translateX }, { translateY }, { scale }],
        },
        Platform.OS === 'web' && ({ filter: 'blur(60px)' } as any),
      ]}
    />
  );
}

interface Props {
  variant?: 'dark' | 'light';
}

export default function AnimatedBackground({ variant = 'dark' }: Props) {
  const baseColors =
    variant === 'dark'
      ? (['#0c0c12', '#150b1f', '#0a0a12'] as const)
      : (['#fdf2f8', '#f0f9ff', '#fefce8'] as const);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={baseColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {ORBS.map((o, i) => (
        <FloatingOrb key={i} cfg={o} />
      ))}
      {/* Subtle matte/grain veil */}
      <View
        style={[
          styles.veil,
          variant === 'dark'
            ? { backgroundColor: 'rgba(0,0,0,0.25)' }
            : { backgroundColor: 'rgba(255,255,255,0.18)' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 9999,
    opacity: 0.95,
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
  },
});
