import { COLORS } from '../constants/theme';

export type VipTier = 'pro' | 'elite' | null | undefined;

export const VIP_STYLES: Record<string, {
  name: string;
  borderColor: string;
  borderColors: string[]; // for gradient borders
  nameColor: string;
  nameColors: string[]; // for gradient names
  avatarScale: number;
  badgeIcon: 'star' | 'diamond';
  crownColor: string;
}> = {
  pro: {
    name: 'VIP Pro',
    borderColor: '#FFD700',
    borderColors: ['#FFC700', '#FFA500', '#FFD700'],
    nameColor: '#FFD700',
    nameColors: ['#FFD700', '#FFA500'],
    avatarScale: 1.15,
    badgeIcon: 'star',
    crownColor: '#FFD700',
  },
  elite: {
    name: 'VIP Elite',
    borderColor: '#E0E0E0',
    borderColors: ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#9D4EDD'],
    nameColor: '#FF6B9D',
    nameColors: ['#FF6B9D', '#9D4EDD', '#4D96FF'],
    avatarScale: 1.35,
    badgeIcon: 'diamond',
    crownColor: '#FF6B9D',
  },
};

export function getVipStyle(tier: VipTier) {
  if (tier === 'pro' || tier === 'elite') {
    return VIP_STYLES[tier];
  }
  return null;
}

export function getNameColor(tier: VipTier): string {
  const style = getVipStyle(tier);
  return style?.nameColor || COLORS.text;
}

export function getNameWeight(tier: VipTier): '700' | '800' {
  return tier ? '800' : '700';
}
