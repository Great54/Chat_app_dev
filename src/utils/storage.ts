import { Room, User, RoomMember, Message, LeaderboardEntry, Gift, Tournament, Friend, Notification, Post, PostComment } from '../types';

export const GIFTS_CATALOG: Gift[] = [
  { id: 'gift-rose', name: 'Rose', icon: '🌹', price: 10, color: '#f43f5e', description: 'A sweet rose to show appreciation' },
  { id: 'gift-heart', name: 'Heart', icon: '💖', price: 20, color: '#ec4899', description: 'Sparkling love and good vibes' },
  { id: 'gift-coffee', name: 'Coffee', icon: '☕', price: 30, color: '#d97706', description: 'Warm coffee for long late-night chats' },
  { id: 'gift-cake', name: 'Birthday Cake', icon: '🎂', price: 50, color: '#8b5cf6', description: 'Celebrate good times together' },
  { id: 'gift-diamond', name: 'Diamond', icon: '💎', price: 100, color: '#06b6d4', description: 'Precious sparkling diamond' },
  { id: 'gift-crown', name: 'Royal Crown', icon: '👑', price: 250, color: '#fbbf24', description: 'For true royalty and champions' },
  { id: 'gift-rocket', name: 'Rocket', icon: '🚀', price: 500, color: '#ef4444', description: 'Send good vibes to the moon' },
  { id: 'gift-car', name: 'Sports Car', icon: '🏎️', price: 1000, color: '#3b82f6', description: 'Ultimate luxury showstopper' },
];

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'room-world',
    roomName: 'World Vibez',
    roomCategory: 'Global & General',
    roomDescription: 'Global chat & community hub for vibing, chill music, and meeting friends from everywhere.',
    roomBanner: '/public/rooms/philippines.png',
    currentUserCount: 16,
    maxCapacity: 36,
    tags: ['Trending', 'Global', 'Active Chat'],
  },
  {
    id: 'room-games',
    roomName: 'Games Hub',
    roomCategory: 'Gaming & High Stakes',
    roomDescription: 'Play Higher Card, Dice Roll, and 8-player Knockout Tournaments with real pot stakes!',
    roomBanner: '/public/rooms/birthday.png',
    currentUserCount: 22,
    maxCapacity: 36,
    tags: ['Mini Games', 'Tournaments', 'High Stakes'],
  },
  {
    id: 'room-bts',
    roomName: 'BTS Army',
    roomCategory: 'Music & K-Pop',
    roomDescription: 'K-pop fans, stan talk, track drops, concert stories, and purring purple heart vibes.',
    roomBanner: '/public/rooms/philippines.png',
    currentUserCount: 12,
    maxCapacity: 36,
    tags: ['K-Pop', 'Music', 'Borahae'],
  },
  {
    id: 'room-hp',
    roomName: 'Harry Potter Fans',
    roomCategory: 'Fandom & Lounge',
    roomDescription: 'Wizarding lounge, Hogwarts house sorting, spell debates, and butterbeer chatter.',
    roomBanner: '/public/rooms/birthday.png',
    currentUserCount: 14,
    maxCapacity: 36,
    tags: ['Fantasy', 'Trivia', 'Hogwarts'],
  },
];

export const INITIAL_USER: User = {
  id: 'user-me',
  email: 'alex@gencvibez.io',
  username: 'vibe_alex',
  displayName: 'Alex Rivera',
  photoUrl: '/public/avatars/default-1-panda.png',
  bio: 'Vibing across rooms, hosting Higher Card games 🚀 Always ready for a tournament match!',
  coins: 240,
  xp: 350,
  level: 3,
  vipTier: 'pro',
  auraType: 'glow',
  auraColor: '#FFD700',
  currentRoomId: null,
  onlineStatus: true,
  createdAt: '2026-01-15T12:00:00Z',
};

export const INITIAL_MEMBERS: Record<string, RoomMember[]> = {
  'room-world': [
    { userId: 'user-luna', username: 'luna_star', displayName: 'Luna Star', photoUrl: '/avatars/default-3-alien.png', level: 14, vipTier: 'elite', auraColor: '#FF6B9D', auraType: 'sparkle', x: 4, y: 68 },
    { userId: 'user-kai', username: 'kai_nova', displayName: 'Kai Nova', photoUrl: '/avatars/default-2-corgi.png', level: 8, vipTier: 'pro', auraColor: '#FFD700', auraType: 'glow', x: 95, y: 45 },
    { userId: 'user-zack', username: 'zack_blaze', displayName: 'Zack Blaze', photoUrl: '/avatars/default-1-panda.png', level: 6, x: 18, y: 92 },
    { userId: 'user-sam', username: 'sammy_g', displayName: 'Sammy G', photoUrl: '/avatars/default-2-corgi.png', level: 4, x: 92, y: 91 },
    { userId: 'user-maya', username: 'maya_p', displayName: 'Maya Phoenix', photoUrl: '/avatars/default-3-alien.png', level: 19, vipTier: 'elite', auraColor: '#22d3ee', auraType: 'frame', x: 50, y: 93 },
  ],
  'room-games': [
    { userId: 'user-maya', username: 'maya_p', displayName: 'Maya Phoenix', photoUrl: '/avatars/default-3-alien.png', level: 19, vipTier: 'elite', auraColor: '#22d3ee', auraType: 'frame', x: 5, y: 70 },
    { userId: 'user-kai', username: 'kai_nova', displayName: 'Kai Nova', photoUrl: '/avatars/default-2-corgi.png', level: 8, vipTier: 'pro', auraColor: '#FFD700', auraType: 'glow', x: 94, y: 60 },
    { userId: 'user-zack', username: 'zack_blaze', displayName: 'Zack Blaze', photoUrl: '/avatars/default-1-panda.png', level: 6, x: 50, y: 92 },
  ],
  'room-bts': [
    { userId: 'user-luna', username: 'luna_star', displayName: 'Luna Star', photoUrl: '/avatars/default-3-alien.png', level: 14, vipTier: 'elite', auraColor: '#FF6B9D', auraType: 'sparkle', x: 5, y: 50 },
    { userId: 'user-sam', username: 'sammy_g', displayName: 'Sammy G', photoUrl: '/avatars/default-2-corgi.png', level: 4, x: 94, y: 88 },
  ],
  'room-hp': [
    { userId: 'user-kai', username: 'kai_nova', displayName: 'Kai Nova', photoUrl: '/avatars/default-2-corgi.png', level: 8, vipTier: 'pro', auraColor: '#FFD700', auraType: 'glow', x: 6, y: 85 },
    { userId: 'user-zack', username: 'zack_blaze', displayName: 'Zack Blaze', photoUrl: '/avatars/default-1-panda.png', level: 6, x: 93, y: 72 },
  ],
};

export const INITIAL_MESSAGES: Record<string, Message[]> = {
  'room-world': [
    { id: 'm1', roomId: 'room-world', senderId: 'user-luna', senderName: 'Luna Star', senderPhoto: '/public/avatars/default-3-alien.png', senderVipTier: 'elite', messageText: 'Welcome everyone to World Vibez! 🌟', createdAt: '10:42 AM' },
    { id: 'm2', roomId: 'room-world', senderId: 'user-kai', senderName: 'Kai Nova', senderPhoto: '/public/avatars/default-2-corgi.png', senderVipTier: 'pro', messageText: 'Who is ready for the gaming tournament later today?', createdAt: '10:44 AM' },
    { id: 'm3', roomId: 'room-world', senderId: 'user-maya', senderName: 'Maya Phoenix', senderPhoto: '/public/avatars/default-3-alien.png', senderVipTier: 'elite', messageText: 'Count me in! I am defending my champions title 👑', createdAt: '10:45 AM' },
  ],
  'room-games': [
    { id: 'm10', roomId: 'room-games', senderId: 'user-kai', senderName: 'Kai Nova', senderPhoto: '/public/avatars/default-2-corgi.png', senderVipTier: 'pro', messageText: 'Anyone up for a 20-coin Higher Card duel? 🃏', createdAt: '11:00 AM' },
    { id: 'm11', roomId: 'room-games', senderId: 'user-maya', senderName: 'Maya Phoenix', senderPhoto: '/public/avatars/default-3-alien.png', senderVipTier: 'elite', messageText: 'Join my table! May the highest card win.', createdAt: '11:02 AM' },
  ],
  'room-bts': [
    { id: 'm20', roomId: 'room-bts', senderId: 'user-luna', senderName: 'Luna Star', senderPhoto: '/public/avatars/default-3-alien.png', senderVipTier: 'elite', messageText: 'Streaming the new playlist today 💜', createdAt: '09:30 AM' },
  ],
  'room-hp': [
    { id: 'm30', roomId: 'room-hp', senderId: 'user-sam', senderName: 'Sammy G', senderPhoto: '/public/avatars/default-2-corgi.png', messageText: 'Ravenclaw or Gryffindor? Vote in chat!', createdAt: '08:15 AM' },
  ],
};

export const INITIAL_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, id: 'user-maya', username: 'maya_p', displayName: 'Maya Phoenix', photoUrl: '/public/avatars/default-3-alien.png', vipTier: 'elite', pointsEarned: 1850, gameWins: 34, gameRunnerUps: 12, tournamentsWon: 5, coinsSpent: 4200 },
  { rank: 2, id: 'user-luna', username: 'luna_star', displayName: 'Luna Star', photoUrl: '/public/avatars/default-3-alien.png', vipTier: 'elite', pointsEarned: 1420, gameWins: 27, gameRunnerUps: 9, tournamentsWon: 3, coinsSpent: 3800 },
  { rank: 3, id: 'user-kai', username: 'kai_nova', displayName: 'Kai Nova', photoUrl: '/public/avatars/default-2-corgi.png', vipTier: 'pro', pointsEarned: 980, gameWins: 18, gameRunnerUps: 14, tournamentsWon: 2, coinsSpent: 2900 },
  { rank: 4, id: 'user-me', username: 'vibe_alex', displayName: 'Alex Rivera (You)', photoUrl: '/public/avatars/default-1-panda.png', vipTier: 'pro', pointsEarned: 760, gameWins: 15, gameRunnerUps: 8, tournamentsWon: 1, coinsSpent: 1650 },
  { rank: 5, id: 'user-zack', username: 'zack_blaze', displayName: 'Zack Blaze', photoUrl: '/public/avatars/default-1-panda.png', vipTier: null, pointsEarned: 520, gameWins: 11, gameRunnerUps: 5, tournamentsWon: 0, coinsSpent: 4500 },
  { rank: 6, id: 'user-sam', username: 'sammy_g', displayName: 'Sammy G', photoUrl: '/public/avatars/default-2-corgi.png', vipTier: null, pointsEarned: 340, gameWins: 7, gameRunnerUps: 4, tournamentsWon: 0, coinsSpent: 850 },
];

export const INITIAL_FRIENDS: Friend[] = [
  { id: 'user-luna', username: 'luna_star', displayName: 'Luna Star', photoUrl: '/public/avatars/default-3-alien.png', status: 'online', level: 14, vipTier: 'elite' },
  { id: 'user-kai', username: 'kai_nova', displayName: 'Kai Nova', photoUrl: '/public/avatars/default-2-corgi.png', status: 'online', level: 8, vipTier: 'pro' },
  { id: 'user-maya', username: 'maya_p', displayName: 'Maya Phoenix', photoUrl: '/public/avatars/default-3-alien.png', status: 'online', level: 19, vipTier: 'elite' },
  { id: 'user-zack', username: 'zack_blaze', displayName: 'Zack Blaze', photoUrl: '/public/avatars/default-1-panda.png', status: 'offline', level: 6 },
  { id: 'user-sam', username: 'sammy_g', displayName: 'Sammy G', photoUrl: '/public/avatars/default-2-corgi.png', status: 'offline', level: 4 },
];

export const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 'n-like-1',
    title: 'New Profile Like ❤️',
    message: 'Maya Phoenix liked your profile!',
    type: 'profile_like',
    actorName: 'Maya Phoenix',
    actorPhoto: '/public/avatars/default-3-alien.png',
    time: '2m ago',
    read: false,
  },
  {
    id: 'n-friend-1',
    title: 'New Friend Added 🤝',
    message: 'Kai Nova added you to their friend circle!',
    type: 'friend_add',
    actorName: 'Kai Nova',
    actorPhoto: '/public/avatars/default-2-corgi.png',
    time: '8m ago',
    read: false,
  },
  {
    id: 'n-like-2',
    title: 'New Profile Like ❤️',
    message: 'Luna Star liked your profile!',
    type: 'profile_like',
    actorName: 'Luna Star',
    actorPhoto: '/public/avatars/default-3-alien.png',
    time: '22m ago',
    read: false,
  },
  { id: 'n1', title: 'Daily Login Reward', message: 'You earned 50 coins for logging in today!', type: 'reward', time: '45m ago', read: true },
  { id: 'n2', title: 'New Room Member', message: 'Luna Star joined World Vibez', type: 'system', time: '1h ago', read: true },
  { id: 'n3', title: 'Tournament Crown', message: 'Higher Card Arena knockout bracket is open!', type: 'tournament', time: '2h ago', read: true },
];

export const INITIAL_POSTS: Post[] = [
  {
    id: 'post-1',
    roomId: 'room-world',
    roomName: 'World Vibez',
    authorId: 'user-maya',
    authorUsername: 'maya_p',
    authorDisplayName: 'Maya Phoenix',
    authorPhotoUrl: '/public/avatars/default-3-alien.png',
    authorVipTier: 'elite',
    text: 'Welcome to World Vibez! Setting up a custom game room for all high rollers tonight. Drop a comment below if you want an invite code 🚀✨',
    imageBase64: '/public/rooms/philippines.png',
    likesCount: 14,
    likedByMe: false,
    createdAt: '15m ago',
    comments: [
      {
        id: 'c1',
        postId: 'post-1',
        authorId: 'user-kai',
        authorName: 'Kai Nova',
        authorPhoto: '/public/avatars/default-2-corgi.png',
        authorVipTier: 'pro',
        text: 'Count me in Maya! Bringing 100 coins to the pot 🃏',
        createdAt: '10m ago',
      },
      {
        id: 'c2',
        postId: 'post-1',
        authorId: 'user-luna',
        authorName: 'Luna Star',
        authorPhoto: '/public/avatars/default-3-alien.png',
        authorVipTier: 'elite',
        text: 'Save me a seat right next to the trophy stage 👑',
        createdAt: '5m ago',
      },
    ],
  },
  {
    id: 'post-2',
    roomId: 'room-games',
    roomName: 'Games Hub',
    authorId: 'user-me',
    authorUsername: 'vibe_alex',
    authorDisplayName: 'Alex Rivera (You)',
    authorPhotoUrl: '/public/avatars/default-1-panda.png',
    authorVipTier: 'pro',
    text: 'Just pulled a King against a Jack in Higher Card for +55 coins! Loving the games hub action today 🔥🃏 Who is challenging next?',
    imageBase64: '/public/rooms/birthday.png',
    likesCount: 9,
    likedByMe: true,
    createdAt: '30m ago',
    comments: [
      {
        id: 'c3',
        postId: 'post-2',
        authorId: 'user-zack',
        authorName: 'Zack Blaze',
        authorPhoto: '/public/avatars/default-1-panda.png',
        text: 'Great streak Alex! Let us duel on 2-dice next round.',
        createdAt: '18m ago',
      },
    ],
  },
  {
    id: 'post-3',
    roomId: 'room-bts',
    roomName: 'BTS Army',
    authorId: 'user-luna',
    authorUsername: 'luna_star',
    authorDisplayName: 'Luna Star',
    authorPhotoUrl: '/public/avatars/default-3-alien.png',
    authorVipTier: 'elite',
    text: 'Streaming the new track playlist! Drop your favorite album track in the comments below 💜🎵',
    imageBase64: null,
    likesCount: 21,
    likedByMe: false,
    createdAt: '1h ago',
    comments: [],
  },
];

export const INITIAL_TOURNAMENTS: Tournament[] = [
  {
    id: 'tourney-1',
    name: 'Neon Cup Knockout',
    roomId: 'room-games',
    gameType: 'Higher Card',
    entryFee: 30,
    pot: 240,
    status: 'in_progress',
    isPrivate: false,
    playersCount: 8,
    maxPlayers: 8,
    createdBy: 'Maya Phoenix',
    matches: [
      { id: 'm1', round: 'quarters', player1: { id: 'user-maya', name: 'Maya Phoenix', photoUrl: '/public/avatars/default-3-alien.png', score: 14 }, player2: { id: 'user-sam', name: 'Sammy G', photoUrl: '/public/avatars/default-2-corgi.png', score: 8 }, winnerId: 'user-maya' },
      { id: 'm2', round: 'quarters', player1: { id: 'user-kai', name: 'Kai Nova', photoUrl: '/public/avatars/default-2-corgi.png', score: 11 }, player2: { id: 'user-zack', name: 'Zack Blaze', photoUrl: '/public/avatars/default-1-panda.png', score: 7 }, winnerId: 'user-kai' },
      { id: 'm3', round: 'quarters', player1: { id: 'user-luna', name: 'Luna Star', photoUrl: '/public/avatars/default-3-alien.png', score: 13 }, player2: { id: 'p6', name: 'Player Neo', photoUrl: '/public/avatars/default-1-panda.png', score: 10 }, winnerId: 'user-luna' },
      { id: 'm4', round: 'quarters', player1: { id: 'user-me', name: 'Alex Rivera (You)', photoUrl: '/public/avatars/default-1-panda.png', score: 12 }, player2: { id: 'p8', name: 'Vibe King', photoUrl: '/public/avatars/default-2-corgi.png', score: 9 }, winnerId: 'user-me' },
      { id: 'm5', round: 'semis', player1: { id: 'user-maya', name: 'Maya Phoenix', photoUrl: '/public/avatars/default-3-alien.png', score: 13 }, player2: { id: 'user-kai', name: 'Kai Nova', photoUrl: '/public/avatars/default-2-corgi.png', score: 9 }, winnerId: 'user-maya' },
      { id: 'm6', round: 'semis', player1: { id: 'user-luna', name: 'Luna Star', photoUrl: '/public/avatars/default-3-alien.png', score: 10 }, player2: { id: 'user-me', name: 'Alex Rivera (You)', photoUrl: '/public/avatars/default-1-panda.png', score: 14 }, winnerId: 'user-me' },
      { id: 'm7', round: 'final', player1: { id: 'user-maya', name: 'Maya Phoenix', photoUrl: '/public/avatars/default-3-alien.png' }, player2: { id: 'user-me', name: 'Alex Rivera (You)', photoUrl: '/public/avatars/default-1-panda.png' } },
    ],
  },
];
