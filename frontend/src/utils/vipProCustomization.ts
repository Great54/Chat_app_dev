/**
 * VIP Pro Customization utilities.
 * Mirrors the static catalog served from the backend (`/api/vip-pro/catalog`)
 * so the UI can render selectors immediately without an extra round-trip.
 */

export interface VipBadge {
  id: string;
  label: string;
  emoji: string;
  bg: string;
}

export interface AuraType {
  id: 'none' | 'glow' | 'sparkle' | 'frame' | 'smoke';
  label: string;
}

export const VIP_PRO_BADGES: VipBadge[] = [
  { id: 'badge_lady_vip',   label: 'Lady VIP',      emoji: '👸',  bg: '#7c2d12' },
  { id: 'badge_octopus',    label: 'Octopus',       emoji: '🐙',  bg: '#581c87' },
  { id: 'badge_skull',      label: 'Skull King',    emoji: '💀',  bg: '#1f1f1f' },
  { id: 'badge_bunny',      label: 'Bunny',         emoji: '🐰',  bg: '#78350f' },
  { id: 'badge_flowers',    label: 'Flowers',       emoji: '💐',  bg: '#86198f' },
  { id: 'badge_cat',        label: 'Cat',           emoji: '🐱',  bg: '#a16207' },
  { id: 'badge_giraffe',    label: 'Cool Giraffe',  emoji: '🦒',  bg: '#854d0e' },
  { id: 'badge_umbrella',   label: 'Magic Umbrella',emoji: '☂️',  bg: '#3730a3' },
  { id: 'badge_detective',  label: 'Detective',     emoji: '🕵️', bg: '#171717' },
  { id: 'badge_angel',      label: 'Guardian',      emoji: '👼',  bg: '#a16207' },
  { id: 'badge_otter',      label: 'Otter',         emoji: '🦦',  bg: '#1e40af' },
  { id: 'badge_witch',      label: 'Witch',         emoji: '🧙',  bg: '#581c87' },
  { id: 'badge_heart',      label: 'Sweet Heart',   emoji: '💗',  bg: '#fce7f3' },
  { id: 'badge_demon',      label: 'Dark Demon',    emoji: '👹',  bg: '#7f1d1d' },
  { id: 'badge_puppy',      label: 'Puppy',         emoji: '🐶',  bg: '#fde68a' },
  { id: 'badge_tiger',      label: 'Tiger Cub',     emoji: '🐯',  bg: '#fbbf24' },
  { id: 'badge_cross',      label: 'Blessed',       emoji: '✝️',  bg: '#fbcfe8' },
  { id: 'badge_sword',      label: 'Ice Sword',     emoji: '⚔️',  bg: '#1e3a8a' },
  { id: 'badge_dog_cool',   label: 'Cool Dog',      emoji: '🐕',  bg: '#1e293b' },
  { id: 'badge_frog',       label: 'Rainbow Frog',  emoji: '🐸',  bg: '#15803d' },
  { id: 'badge_rabbit_punk',label: 'Punk Rabbit',   emoji: '🐇',  bg: '#0f172a' },
  { id: 'badge_bear',       label: 'Hoodie Bear',   emoji: '🐻',  bg: '#0e7490' },
  { id: 'badge_phoenix',    label: 'Phoenix',       emoji: '🔥',  bg: '#9a3412' },
  { id: 'badge_rose',       label: 'Rose VIP',      emoji: '🌹',  bg: '#831843' },
  { id: 'badge_chest',      label: 'Treasure',      emoji: '💰',  bg: '#78350f' },
  { id: 'badge_easter',     label: 'Easter Bunny',  emoji: '🐇',  bg: '#fef3c7' },
  { id: 'badge_butterfly',  label: 'Butterfly VIP', emoji: '🦋',  bg: '#7f1d1d' },
  { id: 'badge_shark',      label: 'Shark VIP',     emoji: '🦈',  bg: '#0ea5e9' },
  { id: 'badge_bird',       label: 'Kingfisher',    emoji: '🐦',  bg: '#0c4a6e' },
  { id: 'badge_mubarak',    label: 'Mubarak',       emoji: '🕌',  bg: '#713f12' },
  { id: 'badge_moon',       label: 'Moon VIP',      emoji: '🌙',  bg: '#1e3a8a' },
  { id: 'badge_crown',      label: 'Royal Crown',   emoji: '👑',  bg: '#3f3f46' },
];

export const VIP_PRO_AURAS: AuraType[] = [
  { id: 'none',    label: 'No Aura' },
  { id: 'glow',    label: 'Glow Aura' },
  { id: 'sparkle', label: 'Sparkle Aura' },
  { id: 'frame',   label: 'Frame Aura' },
  { id: 'smoke',   label: 'Smoke Aura' },
];

export const CHAT_COLORS: string[] = [
  '#FF6B6B', '#F59E0B', '#FBCFE8', '#FDBA74', '#FFFFFF',
  '#FEF08A', '#FCA5A5', '#FBBF24', '#E9D5FF', '#FB923C', '#EC4899',
  '#D946EF', '#EF4444', '#DDD6FE', '#FACC15', '#EAB308', '#BEF264',
  '#D6BCFA', '#F472B6', '#CA8A04', '#A78BFA', '#A3E635', '#FCA5A5',
  '#C4B5FD', '#D97706', '#67E8F9', '#84CC16', '#A7F3D0', '#BAE6FD',
  '#3B82F6', '#34D399', '#22C55E', '#2DD4BF', '#7C3AED', '#22D3EE',
  '#16A34A', '#06B6D4', '#0EA5E9', '#14B8A6', '#10B981',
];

export const USERNAME_COLORS: string[] = [
  '#FFFFFF', '#FFD700', '#FF6B9D', '#FF6B6B', '#FACC15', '#FB923C',
  '#22D3EE', '#34D399', '#A78BFA', '#F472B6', '#EF4444', '#10B981',
  '#3B82F6', '#EC4899', '#FBBF24', '#06B6D4',
];

export const AURA_COLORS: string[] = [
  '#FF6B35', '#EC4899', '#FB923C', '#F59E0B', '#FFFFFF',
  '#DDD6FE', '#D9F99D', '#FDE68A', '#FEF08A', '#FBBF24', '#FBCFE8',
  '#CA8A04', '#BEF264', '#F9A8D4', '#D946EF', '#EF4444', '#E5E7EB',
  '#A7F3D0', '#A3E635', '#67E8F9', '#93C5FD', '#A8A29E', '#FECDD3',
  '#D4D4AA', '#A16207', '#DC2626', '#5EEAD4', '#C4B5FD', '#D97706',
  '#7C3AED', '#22C55E', '#B91C1C', '#84CC16', '#BE185D', '#991B1B',
  '#1D4ED8', '#1E3A8A', '#14532D', '#52525B', '#3F3F46',
  '#0F766E', '#0E7490', '#22C55E', '#22D3EE', '#0EA5E9',
];

export const PM_BOX_COLORS: string[] = [
  '#FBCFE8', '#FFFFFF', '#FEF08A', '#FBBF24', '#FB923C',
  '#E9D5FF', '#FECACA', '#D9F99D', '#BEF264', '#D6BCFA',
  '#CDB76E', '#FCE7A7', '#93C5FD', '#A7F3D0', '#BAE6FD', '#D9F99D', '#C4B5FD',
];

export const VIP_PRO_MONTHLY_COINS = 2000;
export const VIP_PRO_AVATAR_SCALE = 1.25; // confirmed by user

/** Find a badge by id (returns undefined if not found) */
export function findBadge(id?: string | null): VipBadge | undefined {
  if (!id) return undefined;
  return VIP_PRO_BADGES.find((b) => b.id === id);
}

/** True if user has access to VIP Pro customization */
export function canCustomizeVipPro(tier?: string | null): boolean {
  return tier === 'pro' || tier === 'elite';
}

/**
 * Build a React Native style object for an aura effect.
 * On native this uses shadow (iOS) + elevation (Android). On web it uses CSS box-shadow.
 */
export function getAuraStyle(
  auraType?: string | null,
  color?: string | null,
  size: number = 48,
): Record<string, any> {
  if (!auraType || auraType === 'none') return {};
  const c = color || '#FFD700';
  switch (auraType) {
    case 'glow':
      return {
        shadowColor: c,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 18,
        elevation: 12,
        // Web fallback
        // @ts-ignore – RN web supports boxShadow
        boxShadow: `0 0 18px 4px ${c}, 0 0 30px 8px ${c}55`,
      };
    case 'sparkle':
      return {
        shadowColor: c,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 10,
        elevation: 8,
        // @ts-ignore
        boxShadow: `0 0 8px 2px ${c}, 0 0 14px 4px ${c}88`,
      };
    case 'frame':
      return {
        borderWidth: 3,
        borderColor: c,
        // @ts-ignore
        boxShadow: `0 0 0 2px ${c}55`,
      };
    case 'smoke':
      return {
        shadowColor: c,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 22,
        elevation: 10,
        // @ts-ignore
        boxShadow: `0 0 24px 10px ${c}66, 0 0 38px 14px ${c}33`,
      };
    default:
      return {};
  }
}
