import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import {
  getAuraStyle,
  findBadge,
  VIP_PRO_AVATAR_SCALE,
} from '@/src/utils/vipProCustomization';

interface Props {
  photoUrl?: string | null;
  displayName?: string;
  size: number;                      // base size in px
  vipTier?: string | null;
  vipBadgeId?: string | null;
  auraType?: string | null;
  auraColor?: string | null;
  enlargedAvatar?: boolean;
  showBadge?: boolean;
  // Optional override
  style?: any;
}

/**
 * Renders a circular avatar with optional VIP Pro aura effect and VIP badge.
 * Scales the avatar up by VIP_PRO_AVATAR_SCALE (1.25x) when `enlargedAvatar` is true.
 */
export default function AvatarWithAura({
  photoUrl,
  displayName,
  size,
  vipBadgeId,
  auraType,
  auraColor,
  enlargedAvatar,
  showBadge = true,
  style,
}: Props) {
  const finalSize = enlargedAvatar ? Math.round(size * VIP_PRO_AVATAR_SCALE) : size;
  const aura = getAuraStyle(auraType, auraColor, finalSize);
  const badge = showBadge ? findBadge(vipBadgeId) : undefined;
  const initial = (displayName || '?').charAt(0).toUpperCase();
  const badgeSize = Math.max(16, Math.round(finalSize * 0.42));

  return (
    <View style={[styles.container, { width: finalSize, height: finalSize }, style]}>
      <View
        style={[
          styles.avatarWrap,
          {
            width: finalSize,
            height: finalSize,
            borderRadius: finalSize / 2,
          },
          aura,
        ]}
        data-testid="avatar-with-aura"
      >
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={{ width: finalSize, height: finalSize, borderRadius: finalSize / 2 }}
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              { width: finalSize, height: finalSize, borderRadius: finalSize / 2 },
            ]}
          >
            <Text style={[styles.placeholderText, { fontSize: finalSize * 0.4 }]}>
              {initial}
            </Text>
          </View>
        )}
      </View>
      {badge && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: badge.bg,
              right: -4,
              bottom: -4,
            },
          ]}
          data-testid="vip-pro-badge"
        >
          <Text style={[styles.badgeEmoji, { fontSize: badgeSize * 0.6 }]}>
            {badge.emoji}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  avatarWrap: {
    overflow: 'hidden',
  },
  placeholder: {
    backgroundColor: '#312e81',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#fff',
    fontWeight: '700',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0f0a1f',
  },
  badgeEmoji: {
    lineHeight: undefined,
  },
});
