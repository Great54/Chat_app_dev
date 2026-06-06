/**
 * Maps an activity type → display config (icon, color, gradient).
 * Centralised so future activity types are easy to add.
 */
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/constants/theme';

export type ActivityType =
  | 'gift_received'
  | 'gift_sent'
  | 'coins_received'
  | 'coins_purchased'
  | 'vip_purchased'
  | 'elite_purchased'
  | 'vip_received'
  | 'friend_added'
  | 'friend_request_received'
  | 'post_liked'
  | 'post_commented'
  | 'comment_replied'
  | 'comment_liked';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

interface ActivityVisual {
  icon: IoniconName;
  color: string;
  gradient: [string, string];
  label: string;
}

const FALLBACK: ActivityVisual = {
  icon: 'sparkles',
  color: COLORS.primary,
  gradient: ['#6366f1', '#8b5cf6'],
  label: 'Activity',
};

const MAP: Record<string, ActivityVisual> = {
  gift_received: {
    icon: 'gift',
    color: '#ec4899',
    gradient: ['#ec4899', '#db2777'],
    label: 'Gift received',
  },
  gift_sent: {
    icon: 'paper-plane',
    color: '#f472b6',
    gradient: ['#f472b6', '#ec4899'],
    label: 'Gift sent',
  },
  coins_received: {
    icon: 'logo-bitcoin',
    color: '#fbbf24',
    gradient: ['#f59e0b', '#fbbf24'],
    label: 'Coins',
  },
  coins_purchased: {
    icon: 'cart',
    color: '#fbbf24',
    gradient: ['#f59e0b', '#fbbf24'],
    label: 'Coin purchase',
  },
  vip_purchased: {
    icon: 'star',
    color: '#FFD700',
    gradient: ['#fbbf24', '#FFD700'],
    label: 'VIP Pro',
  },
  elite_purchased: {
    icon: 'diamond',
    color: '#FF6B9D',
    gradient: ['#FF6B9D', '#a855f7'],
    label: 'VIP Elite',
  },
  vip_received: {
    icon: 'ribbon',
    color: '#FFD700',
    gradient: ['#fbbf24', '#FFD700'],
    label: 'VIP granted',
  },
  friend_added: {
    icon: 'people',
    color: '#22c55e',
    gradient: ['#16a34a', '#22c55e'],
    label: 'New friend',
  },
  friend_request_received: {
    icon: 'person-add',
    color: '#3b82f6',
    gradient: ['#2563eb', '#3b82f6'],
    label: 'Friend request',
  },
  post_liked: {
    icon: 'heart',
    color: '#ef4444',
    gradient: ['#dc2626', '#ef4444'],
    label: 'Post liked',
  },
  post_commented: {
    icon: 'chatbubble-ellipses',
    color: '#06b6d4',
    gradient: ['#0891b2', '#06b6d4'],
    label: 'New comment',
  },
  comment_replied: {
    icon: 'return-down-forward',
    color: '#06b6d4',
    gradient: ['#0891b2', '#06b6d4'],
    label: 'Comment reply',
  },
  comment_liked: {
    icon: 'heart-outline',
    color: '#f43f5e',
    gradient: ['#e11d48', '#f43f5e'],
    label: 'Comment liked',
  },
};

export function getActivityVisual(type: string): ActivityVisual {
  return MAP[type] || FALLBACK;
}

/**
 * Compact relative time formatter: "5m", "2h", "3d", "Jul 12"
 */
export function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
