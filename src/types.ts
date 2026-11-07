export type VipTier = 'pro' | 'elite' | null;

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  photoUrl: string;
  bio: string;
  coins: number;
  xp: number;
  level: number;
  vipTier: VipTier;
  auraType?: 'glow' | 'sparkle' | 'frame' | 'smoke' | null;
  auraColor?: string | null;
  currentRoomId?: string | null;
  onlineStatus: boolean;
  createdAt: string;
}

export interface Room {
  id: string;
  roomName: string;
  roomCategory: string;
  roomDescription: string;
  roomBanner?: string | null;
  currentUserCount: number;
  maxCapacity: number;
  tags?: string[];
}

export interface RoomMember {
  userId: string;
  username: string;
  displayName: string;
  photoUrl: string;
  level: number;
  vipTier?: VipTier;
  auraColor?: string | null;
  auraType?: string | null;
  x: number; // percentage 5-90%
  y: number; // percentage 10-85%
  isSelf?: boolean;
}

export interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  senderVipTier?: VipTier;
  messageText: string;
  createdAt: string;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  createdAt: string;
}

export interface GameSession {
  id: string;
  roomId: string;
  gameType: 'higher_card' | 'dice_roll' | 'spin_wheel';
  hostId: string;
  hostName: string;
  entryFee: number;
  pot: number;
  status: 'waiting' | 'active' | 'completed' | 'aborted';
  players: {
    userId: string;
    username: string;
    displayName: string;
    photoUrl: string;
    choice?: number | string;
  }[];
  winnerId?: string;
  winnerName?: string;
  createdAt: string;
}

export interface TournamentMatch {
  id: string;
  round: 'quarters' | 'semis' | 'final';
  player1: { id: string; name: string; photoUrl: string; score?: number };
  player2: { id: string; name: string; photoUrl: string; score?: number };
  winnerId?: string;
}

export interface Tournament {
  id: string;
  name: string;
  roomId: string;
  gameType: string;
  entryFee: number;
  pot: number;
  status: 'registration' | 'in_progress' | 'completed';
  isPrivate: boolean;
  joinCode?: string;
  playersCount: number;
  maxPlayers: number;
  matches: TournamentMatch[];
  champion?: { id: string; name: string };
  createdBy: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  username: string;
  displayName: string;
  photoUrl: string;
  vipTier?: VipTier;
  pointsEarned: number;
  gameWins: number;
  gameRunnerUps: number;
  tournamentsWon: number;
  coinsSpent: number;
}

export interface Friend {
  id: string;
  username: string;
  displayName: string;
  photoUrl: string;
  status: 'online' | 'offline';
  level: number;
  vipTier?: VipTier;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'gift' | 'reward' | 'tournament' | 'system' | 'friend' | 'profile_like' | 'friend_add' | 'post_like' | 'post_comment';
  actorName?: string;
  actorPhoto?: string;
  time: string;
  read: boolean;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string;
  authorVipTier?: VipTier;
  text: string;
  createdAt: string;
}

export interface Post {
  id: string;
  roomId: string;
  roomName: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoUrl: string;
  authorVipTier?: VipTier;
  text: string;
  imageBase64?: string | null;
  likesCount: number;
  likedByMe: boolean;
  comments: PostComment[];
  createdAt: string;
  isReportedByMe?: boolean;
  reportReason?: string;
}

export interface Gift {
  id: string;
  name: string;
  icon: string;
  price: number;
  color: string;
  description: string;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'room_join' | 'chat_reward' | 'game_bet' | 'game_win' | 'top_up' | 'vip_purchase' | 'gift_send' | 'gift_receive';
  description: string;
  createdAt: string;
}
