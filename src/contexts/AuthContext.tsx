import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, VipTier, Friend, Notification, CoinTransaction, Gift, Post, PostComment } from '../types';
import { INITIAL_USER, INITIAL_FRIENDS, INITIAL_NOTIFICATIONS, INITIAL_ROOMS, GIFTS_CATALOG, INITIAL_POSTS } from '../utils/storage';
import { playNotificationSound, setSoundsEnabled, areSoundsEnabled, playWinSound, playMessageSound } from '../utils/sound';
import confetti from 'canvas-confetti';

interface AuthContextType {
  user: User;
  favoriteRoomIds: string[];
  notifications: Notification[];
  friends: Friend[];
  transactions: CoinTransaction[];
  posts: Post[];
  soundEnabled: boolean;
  toggleFavorite: (roomId: string) => void;
  updateProfile: (updates: Partial<User>) => void;
  addCoins: (amount: number, description: string, type?: CoinTransaction['type']) => boolean;
  addXp: (amount: number) => void;
  buyVip: (tier: 'pro' | 'elite') => boolean;
  customizeAura: (auraType: User['auraType'], auraColor: string) => void;
  sendGiftToUser: (gift: Gift, receiverName: string) => boolean;
  toggleMute: () => void;
  markNotificationsAsRead: () => void;
  autoJoin: () => { roomId: string; roomName: string } | null;
  addFriend: (usernameOrName: string) => boolean;
  removeFriend: (id: string) => void;
  createPost: (roomId: string, roomName: string, text: string, imageBase64?: string | null) => void;
  likePost: (postId: string) => void;
  commentOnPost: (postId: string, text: string) => void;
  likeUserProfile: (targetUserId: string, targetName: string) => void;
  reportPost: (postId: string, reason: string, details?: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(() => {
    const saved = localStorage.getItem('genc_user');
    return saved ? JSON.parse(saved) : INITIAL_USER;
  });

  const [favoriteRoomIds, setFavoriteRoomIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('genc_favorites');
    return saved ? JSON.parse(saved) : ['room-world', 'room-games'];
  });

  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('genc_notifications');
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [friends, setFriends] = useState<Friend[]>(() => {
    const saved = localStorage.getItem('genc_friends');
    return saved ? JSON.parse(saved) : INITIAL_FRIENDS;
  });

  const [transactions, setTransactions] = useState<CoinTransaction[]>(() => {
    const saved = localStorage.getItem('genc_transactions');
    return saved
      ? JSON.parse(saved)
      : [
          { id: 't1', userId: 'user-me', amount: 100, type: 'room_join', description: 'Welcome starter coins', createdAt: '2 days ago' },
          { id: 't2', userId: 'user-me', amount: 50, type: 'top_up', description: 'Daily login bonus', createdAt: 'Yesterday' },
        ];
  });

  const [posts, setPosts] = useState<Post[]>(() => {
    const saved = localStorage.getItem('genc_posts');
    return saved ? JSON.parse(saved) : INITIAL_POSTS;
  });

  const [soundEnabled, setSoundEnabledState] = useState(areSoundsEnabled());

  useEffect(() => {
    localStorage.setItem('genc_posts', JSON.stringify(posts));
  }, [posts]);

  useEffect(() => {
    localStorage.setItem('genc_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('genc_favorites', JSON.stringify(favoriteRoomIds));
  }, [favoriteRoomIds]);

  useEffect(() => {
    localStorage.setItem('genc_notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem('genc_friends', JSON.stringify(friends));
  }, [friends]);

  useEffect(() => {
    localStorage.setItem('genc_transactions', JSON.stringify(transactions));
  }, [transactions]);

  const toggleFavorite = (roomId: string) => {
    setFavoriteRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  const updateProfile = (updates: Partial<User>) => {
    setUser((prev) => ({ ...prev, ...updates }));
  };

  const addCoins = (amount: number, description: string, type: CoinTransaction['type'] = 'top_up'): boolean => {
    if (amount < 0 && user.coins + amount < 0) {
      return false; // Insufficient coins
    }
    const newCoins = Math.max(0, user.coins + amount);
    setUser((prev) => ({ ...prev, coins: newCoins }));

    const tx: CoinTransaction = {
      id: `tx-${Date.now()}`,
      userId: user.id,
      amount,
      type,
      description,
      createdAt: 'Just now',
    };
    setTransactions((prev) => [tx, ...prev]);
    return true;
  };

  const addXp = (amount: number) => {
    setUser((prev) => {
      const nextXp = prev.xp + amount;
      const nextLevel = Math.floor(nextXp / 100);
      if (nextLevel > prev.level) {
        // Level up celebration!
        playWinSound();
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#8b5cf6', '#ec4899', '#fbbf24'],
        });
        setNotifications((n) => [
          {
            id: `lvl-${Date.now()}`,
            title: `Level Up! Level ${nextLevel}`,
            message: `Congratulations! You unlocked level ${nextLevel} perks & status!`,
            type: 'reward',
            time: 'Just now',
            read: false,
          },
          ...n,
        ]);
      }
      return {
        ...prev,
        xp: nextXp,
        level: nextLevel,
      };
    });
  };

  const buyVip = (tier: 'pro' | 'elite'): boolean => {
    const cost = tier === 'elite' ? 250 : 100;
    if (user.coins < cost) {
      return false;
    }
    addCoins(-cost, `Upgraded to VIP ${tier.toUpperCase()}`, 'vip_purchase');
    setUser((prev) => ({
      ...prev,
      vipTier: tier,
      auraColor: tier === 'elite' ? '#FF6B9D' : '#FFD700',
      auraType: tier === 'elite' ? 'sparkle' : 'glow',
    }));
    playWinSound();
    confetti({
      particleCount: 120,
      spread: 90,
      colors: tier === 'elite' ? ['#FF6B9D', '#9D4EDD', '#4D96FF'] : ['#FFD700', '#FFA500', '#FFC700'],
    });
    setNotifications((prev) => [
      {
        id: `vip-${Date.now()}`,
        title: `VIP ${tier.toUpperCase()} Activated!`,
        message: `Your account is now crowned VIP ${tier.toUpperCase()} with special auras & podium perks!`,
        type: 'reward',
        time: 'Just now',
        read: false,
      },
      ...prev,
    ]);
    return true;
  };

  const customizeAura = (auraType: User['auraType'], auraColor: string) => {
    setUser((prev) => ({ ...prev, auraType, auraColor }));
  };

  const sendGiftToUser = (gift: Gift, receiverName: string): boolean => {
    if (user.coins < gift.price) {
      return false;
    }
    const success = addCoins(-gift.price, `Sent ${gift.name} to ${receiverName}`, 'gift_send');
    if (!success) return false;
    playNotificationSound();
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: [gift.color, '#fbbf24', '#ffffff'],
    });
    setNotifications((prev) => [
      {
        id: `gift-${Date.now()}`,
        title: `Gift Sent! ${gift.icon}`,
        message: `You sent a ${gift.name} to ${receiverName}!`,
        type: 'gift',
        time: 'Just now',
        read: false,
      },
      ...prev,
    ]);
    return true;
  };

  const toggleMute = () => {
    const next = !soundEnabled;
    setSoundsEnabled(next);
    setSoundEnabledState(next);
  };

  const markNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const autoJoin = () => {
    const available = INITIAL_ROOMS.find((r) => r.currentUserCount < r.maxCapacity);
    if (!available) return null;
    return { roomId: available.id, roomName: available.roomName };
  };

  const addFriend = (name: string): boolean => {
    if (!name.trim()) return false;
    const newFriend: Friend = {
      id: `friend-${Date.now()}`,
      username: name.toLowerCase().replace(/\s+/g, '_'),
      displayName: name,
      photoUrl: '/public/avatars/default-2-corgi.png',
      status: 'online',
      level: 1,
    };
    setFriends((prev) => [newFriend, ...prev]);
    playNotificationSound();
    // Notification for friend add
    setNotifications((prev) => [
      {
        id: `fn-${Date.now()}`,
        title: 'New Friend Added 🤝',
        message: `${name} is now in your friend circle!`,
        type: 'friend_add',
        actorName: name,
        actorPhoto: '/public/avatars/default-2-corgi.png',
        time: 'Just now',
        read: false,
      },
      ...prev,
    ]);
    return true;
  };

  const removeFriend = (id: string) => {
    setFriends((prev) => prev.filter((f) => f.id !== id));
  };

  const createPost = (roomId: string, roomName: string, text: string, imageBase64?: string | null) => {
    const newPost: Post = {
      id: `post-${Date.now()}`,
      roomId,
      roomName,
      authorId: user.id,
      authorUsername: user.username,
      authorDisplayName: user.displayName,
      authorPhotoUrl: user.photoUrl,
      authorVipTier: user.vipTier,
      text,
      imageBase64: imageBase64 || null,
      likesCount: 0,
      likedByMe: false,
      comments: [],
      createdAt: 'Just now',
    };
    setPosts((prev) => [newPost, ...prev]);
    addXp(10);
    playWinSound();
  };

  const likePost = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const wasLiked = p.likedByMe;
          return {
            ...p,
            likedByMe: !wasLiked,
            likesCount: wasLiked ? Math.max(0, p.likesCount - 1) : p.likesCount + 1,
          };
        }
        return p;
      })
    );
    playMessageSound();
  };

  const commentOnPost = (postId: string, text: string) => {
    if (!text.trim()) return;
    const newComment: PostComment = {
      id: `comment-${Date.now()}`,
      postId,
      authorId: user.id,
      authorName: user.displayName,
      authorPhoto: user.photoUrl,
      authorVipTier: user.vipTier,
      text: text.trim(),
      createdAt: 'Just now',
    };

    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            comments: [...p.comments, newComment],
          };
        }
        return p;
      })
    );
    addXp(2);
    playMessageSound();

    // Occasional simulated reply from other members on your comment
    setTimeout(() => {
      const replies = [
        'Awesome perspective!',
        'Totally agree with this! 🔥',
        'Vibing with this post ✨',
        'Let us meet in the room!',
      ];
      const botReply: PostComment = {
        id: `bot-c-${Date.now()}`,
        postId,
        authorId: 'user-maya',
        authorName: 'Maya Phoenix',
        authorPhoto: '/public/avatars/default-3-alien.png',
        authorVipTier: 'elite',
        text: replies[Math.floor(Math.random() * replies.length)],
        createdAt: 'Just now',
      };
      setPosts((p) =>
        p.map((post) =>
          post.id === postId ? { ...post, comments: [...post.comments, botReply] } : post
        )
      );
      playNotificationSound();
    }, 2000);
  };

  const likeUserProfile = (targetUserId: string, targetName: string) => {
    setNotifications((prev) => [
      {
        id: `like-${Date.now()}`,
        title: 'Profile Liked! ❤️',
        message: `${targetName} received your profile like!`,
        type: 'profile_like',
        actorName: targetName,
        actorPhoto: '/public/avatars/default-3-alien.png',
        time: 'Just now',
        read: false,
      },
      ...prev,
    ]);
    playNotificationSound();
  };

  const reportPost = (postId: string, reason: string, details?: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          return {
            ...p,
            isReportedByMe: true,
            reportReason: reason,
          };
        }
        return p;
      })
    );

    const post = posts.find((p) => p.id === postId);
    const authorName = post?.authorDisplayName || 'User';

    setNotifications((prev) => [
      {
        id: `rep-${Date.now()}`,
        title: 'Content Flagged for Moderation 🛡️',
        message: `Your report on ${authorName}'s post ("${reason}") has been received. Our moderation team will review this within 24 hours.`,
        type: 'system',
        time: 'Just now',
        read: false,
      },
      ...prev,
    ]);

    playNotificationSound();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        favoriteRoomIds,
        notifications,
        friends,
        transactions,
        posts,
        soundEnabled,
        toggleFavorite,
        updateProfile,
        addCoins,
        addXp,
        buyVip,
        customizeAura,
        sendGiftToUser,
        toggleMute,
        markNotificationsAsRead,
        autoJoin,
        addFriend,
        removeFriend,
        createPost,
        likePost,
        commentOnPost,
        likeUserProfile,
        reportPost,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
