export type FriendStatus = 'none' | 'sent' | 'received' | 'friends';

export interface ProfileBadge {
  id: string;
  label: string;
  color: string;
  icon: string;
}

export interface ProfileCard {
  id: string;
  username: string;
  displayName: string;
  photoUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string;
  vipTier?: 'pro' | 'elite' | null;
  onlineStatus: boolean;
  lastSeen?: string | null;
  createdAt?: string | null;
  coins: number;
  level: number;
  badges: ProfileBadge[];
  friendCount: number;
  friendStatus: FriendStatus;
  friendRequestId?: string | null;
  isBlocked: boolean;
  isSelf: boolean;
  // VIP Pro customization
  vipBadgeId?: string | null;
  auraType?: 'glow' | 'sparkle' | 'frame' | 'smoke' | null;
  auraColor?: string | null;
  chatColor?: string | null;
  usernameColor?: string | null;
  pmBoxColor?: string | null;
  enlargedAvatar?: boolean;
}

export interface Gift {
  id: string;
  name: string;
  icon: string;
  price: number;
  color: string;
}
