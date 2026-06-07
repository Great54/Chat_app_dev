import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * Premium social-community auth background.
 *
 * Pure RN primitives + Animated (no extra deps). Designed to feel alive —
 * soft purple/pink/blue/cyan galaxy gradients, glowing orb particles, and
 * subtle floating motion — without slowing down mobile devices.
 *
 * Performance notes:
 *  - All orbs use `transform: translate/scale` driven by `useNativeDriver: true`.
 *  - Number of orbs is capped (8) and they're absolutely-positioned blurred
 *    coloured circles — no per-frame React state changes, no heavy SVG.
 */

interface Orb {
  size: number;
  left: string;
  top: string;
  color: string;
  delay: number;
  drift: number; // px the orb drifts up/down
  duration: number;
}

const ORBS: Orb[] = [
  { size: 220, left: '-10%', top: '-8%',  color: 'rgba(168, 85, 247, 0.55)', delay: 0,    drift: 26, duration: 7200 },
  { size: 180, left: '70%',  top: '5%',   color: 'rgba(236, 72, 153, 0.50)', delay: 800,  drift: 22, duration: 8400 },
  { size: 260, left: '55%',  top: '55%',  color: 'rgba(59, 130, 246, 0.45)', delay: 1500, drift: 30, duration: 9200 },
  { size: 150, left: '-12%', top: '60%',  color: 'rgba(34, 211, 238, 0.45)', delay: 2200, drift: 18, duration: 7800 },
  { size: 120, left: '30%',  top: '35%',  color: 'rgba(251, 191, 36, 0.30)', delay: 1100, drift: 14, duration: 6800 },
  { size: 90,  left: '80%',  top: '78%',  color: 'rgba(192, 132, 252, 0.55)', delay: 600,  drift: 20, duration: 7200 },
  { size: 70,  left: '10%',  top: '85%',  color: 'rgba(244, 114, 182, 0.55)', delay: 1900, drift: 16, duration: 6200 },
  { size: 60,  left: '45%',  top: '12%',  color: 'rgba(125, 211, 252, 0.60)', delay: 2600, drift: 12, duration: 5800 },
];

// Crisp little sparkle dots — animated opacity only
const SPARKLES: { left: string; top: string; size: number; delay: number; duration: number }[] = [
  { left: '12%', top: '20%', size: 2, delay: 0,    duration: 2200 },
  { left: '88%', top: '30%', size: 3, delay: 400,  duration: 2600 },
  { left: '25%', top: '70%', size: 2, delay: 800,  duration: 1900 },
  { left: '60%', top: '22%', size: 2, delay: 1200, duration: 2400 },
  { left: '75%', top: '60%', size: 3, delay: 1600, duration: 2100 },
  { left: '40%', top: '80%', size: 2, delay: 2000, duration: 2300 },
  { left: '90%', top: '50%', size: 2, delay: 500,  duration: 2500 },
  { left: '20%', top: '40%', size: 2, delay: 900,  duration: 2700 },
  { left: '55%', top: '90%', size: 2, delay: 1300, duration: 2000 },
  { left: '70%', top: '15%', size: 2, delay: 1700, duration: 2400 },
];

function FloatingOrb({ orb }: { orb: Orb }) {
  const translate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translate, {
          toValue: 1,
          duration: orb.duration,
          delay: orb.delay,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translate, {
          toValue: 0,
          duration: orb.duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [translate, orb.delay, orb.duration]);

  const translateY = translate.interpolate({ inputRange: [0, 1], outputRange: [0, -orb.drift] });
  const scale = translate.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orb,
        {
          width: orb.size,
          height: orb.size,
          left: orb.left as any,
          top: orb.top as any,
          backgroundColor: orb.color,
          transform: [{ translateY }, { scale }],
        },
        Platform.OS === 'web'
          // Soft blur on web for the glowing/aura feel. RN native doesn't
          // support backdrop blur cheaply, so we lean on shadow there.
          ? ({ filter: 'blur(40px)' } as any)
          : { shadowColor: orb.color, shadowOpacity: 0.9, shadowRadius: 40, shadowOffset: { width: 0, height: 0 } },
      ]}
    />
  );
}

function Sparkle({ s }: { s: typeof SPARKLES[number] }) {
  const opacity = useRef(new Animated.Value(0.2)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: s.duration,
          delay: s.delay,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.2,
          duration: s.duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, s.delay, s.duration]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.sparkle,
        {
          width: s.size,
          height: s.size,
          borderRadius: s.size,
          left: s.left as any,
          top: s.top as any,
          opacity,
        },
      ]}
    />
  );
}

export default function CosmicAuthBackground({ style }: { style?: ViewStyle }) {
  // Memoize so animations don't get reset on parent re-render
  const orbs = useMemo(() => ORBS, []);
  const sparkles = useMemo(() => SPARKLES, []);

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, style]} testID="cosmic-auth-bg">
      {/* Deep cosmic base — solid dark colour so dark palette stays clean */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0b0820' }]} />

      {/* Diagonal galaxy gradient washes */}
      <LinearGradient
        colors={['#1e0b3a', '#2d0a4a', '#0b0820']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(236,72,153,0.18)', 'transparent', 'rgba(34,211,238,0.18)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating glowing orbs */}
      {orbs.map((o, i) => (
        <FloatingOrb key={`orb-${i}`} orb={o} />
      ))}

      {/* Tiny twinkling sparkles */}
      {sparkles.map((s, i) => (
        <Sparkle key={`sp-${i}`} s={s} />
      ))}

      {/* Bottom vignette for legibility of the bottom-anchored form footer */}
      <LinearGradient
        colors={['transparent', 'rgba(11,8,32,0.55)']}
        start={{ x: 0.5, y: 0.5 }}
        end={{ x: 0.5, y: 1 }}
        style={[StyleSheet.absoluteFill, { top: '50%' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  orb: {
    position: 'absolute',
    borderRadius: 999,
    // RN native shadow gives a soft glow; web uses CSS filter blur (see above)
    elevation: 12,
  },
  sparkle: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    // @ts-ignore RN web shadow
    boxShadow: '0 0 6px rgba(255,255,255,0.9)',
  },
});
