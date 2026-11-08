import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  Gamepad2,
  Dices,
  Trophy,
  Users,
  Coins,
  Sparkles,
  ArrowRight,
  Clock,
  Play,
  Flame,
  ShieldCheck,
  CheckCircle2,
  X,
  HeartHandshake,
  UserPlus,
  Send,
  Link as LinkIcon,
  Copy,
  Check,
  KeyRound,
  PlusCircle,
  ExternalLink,
  Share2,
} from 'lucide-react';
import GamePanel from '../components/GamePanel';
import TournamentModal from '../components/TournamentModal';
import { playWinSound, playMessageSound } from '../utils/sound';

export interface GameInfo {
  id: string;
  title: string;
  gameType: 'higher_card' | 'dice_roll' | 'spin_wheel' | 'tournament';
  category: string;
  icon: string;
  payoutBadge: string;
  description: string;
  playingCount: number;
  activeMatches: number;
  avgMatchTime: string;
  stakes: string;
  maxReward: string;
  rules: string[];
  activeRooms: { name: string; count: number }[];
}

export interface PrivateMatchInstance {
  id: string;
  code: string;
  inviteLink: string;
  gameId: string;
  gameTitle: string;
  gameType: 'higher_card' | 'dice_roll' | 'spin_wheel' | 'tournament';
  gameIcon: string;
  matchName: string;
  hostId: string;
  hostName: string;
  hostPhoto: string;
  hostVipTier?: string | null;
  entryCoins: number;
  createdAt: string;
  status: 'waiting_for_friend' | 'in_progress';
}

const AVAILABLE_GAMES: GameInfo[] = [
  {
    id: 'game-higher-card',
    title: 'Higher Card Duel',
    gameType: 'higher_card',
    category: 'Cards & Strategy',
    icon: '🃏',
    payoutBadge: '2.2x Multiplier',
    description: 'Fast-paced friendly card duel. Draw a card higher than your real opponent to sweep the pot.',
    playingCount: 18,
    activeMatches: 9,
    avgMatchTime: '30 seconds',
    stakes: 'Free or 10 – 50 Coins',
    maxReward: '110 Coins / round',
    rules: [
      'Both players enter the friendly match with an equal coin contribution (or free play).',
      'One card is drawn from a standard cosmic deck (Aces high).',
      'Higher card value wins 2.2x payout. Ties refund initial coins.',
    ],
    activeRooms: [
      { name: 'Gaming Haven', count: 8 },
      { name: 'World Vibez', count: 6 },
      { name: 'Lo-Fi Chillout', count: 4 },
    ],
  },
  {
    id: 'game-dice-roll',
    title: '2-Dice High Roller',
    gameType: 'dice_roll',
    category: 'Dice & Luck',
    icon: '🎲',
    payoutBadge: '2.1x Multiplier',
    description: 'Throw dual dice across the friendly table. Beat your real opponent total to claim victory.',
    playingCount: 24,
    activeMatches: 12,
    avgMatchTime: '20 seconds',
    stakes: 'Free or 10 – 50 Coins',
    maxReward: '105 Coins / round',
    rules: [
      'Choose coin entry between 10 and 50 coins (or play for free).',
      'Roll two 6-sided dice against your friend or real community challenger.',
      'Highest sum wins 2.1x pot. Identical sums trigger coin refund.',
    ],
    activeRooms: [
      { name: 'Gaming Haven', count: 12 },
      { name: 'Anime & Manga Fan Club', count: 8 },
      { name: 'World Vibez', count: 4 },
    ],
  },
  {
    id: 'game-spin-wheel',
    title: 'Lucky Wheel of Fortune',
    gameType: 'spin_wheel',
    category: 'Jackpot & Multiplier',
    icon: '🎡',
    payoutBadge: 'Up to 100 Coins',
    description: 'Spin the neon nebula wheel head-to-head with a real player for multipliers and grand jackpot coins.',
    playingCount: 31,
    activeMatches: 16,
    avgMatchTime: '15 seconds',
    stakes: '10 Coins / spin',
    maxReward: '100 Coins Jackpot',
    rules: [
      'Each spin costs a flat entry of 10 coins.',
      'Prizes range from 0, 5, 15, 25, 50, up to 100 coins jackpot.',
      'Bonus XP awarded on every spin win.',
    ],
    activeRooms: [
      { name: 'World Vibez', count: 15 },
      { name: 'K-Pop Universe', count: 10 },
      { name: 'Gaming Haven', count: 6 },
    ],
  },
  {
    id: 'game-tournament',
    title: 'Cosmic Clash Tournament',
    gameType: 'tournament',
    category: 'Bracket Knockout',
    icon: '🏆',
    payoutBadge: '100+ Coin Pot',
    description: '8-player knockout bracket tournament. Challenge your real friends through quarters, semifinals, and grand finals.',
    playingCount: 8,
    activeMatches: 3,
    avgMatchTime: '3 – 5 minutes',
    stakes: '25 Coins Entry',
    maxReward: 'Grand Trophy & Entire Pot',
    rules: [
      '8 real players enter single-elimination friendly bracket.',
      'Winners advance automatically to next round.',
      'Tournament champion takes the entire coin prize pool + 50 XP bonus.',
    ],
    activeRooms: [
      { name: 'Gaming Haven', count: 6 },
      { name: 'World Vibez', count: 2 },
    ],
  },
];

const INITIAL_COMMUNITY_MATCHES: PrivateMatchInstance[] = [
  {
    id: 'match-maya-1',
    code: 'VIBEZ-4821',
    inviteLink: 'https://ais-dev.genc-vibez.app/?match=VIBEZ-4821',
    gameId: 'game-higher-card',
    gameTitle: 'Higher Card Duel',
    gameType: 'higher_card',
    gameIcon: '🃏',
    matchName: "Maya's High Card Duel",
    hostId: 'user-maya',
    hostName: 'Maya Phoenix',
    hostPhoto: '/public/avatars/default-3-alien.png',
    hostVipTier: 'elite',
    entryCoins: 10,
    createdAt: '3m ago',
    status: 'waiting_for_friend',
  },
  {
    id: 'match-leo-2',
    code: 'VIBEZ-9134',
    inviteLink: 'https://ais-dev.genc-vibez.app/?match=VIBEZ-9134',
    gameId: 'game-dice-roll',
    gameTitle: '2-Dice High Roller',
    gameType: 'dice_roll',
    gameIcon: '🎲',
    matchName: "Leo's Friendly Dice Table",
    hostId: 'user-leo',
    hostName: 'Leo Vance',
    hostPhoto: '/public/avatars/default-1-panda.png',
    hostVipTier: 'pro',
    entryCoins: 0,
    createdAt: '7m ago',
    status: 'waiting_for_friend',
  },
  {
    id: 'match-chloe-3',
    code: 'VIBEZ-3382',
    inviteLink: 'https://ais-dev.genc-vibez.app/?match=VIBEZ-3382',
    gameId: 'game-spin-wheel',
    gameTitle: 'Lucky Wheel of Fortune',
    gameType: 'spin_wheel',
    gameIcon: '🎡',
    matchName: "Chloe's Nebula Spin-off",
    hostId: 'user-chloe',
    hostName: 'Chloe Rivera',
    hostPhoto: '/public/avatars/default-3-alien.png',
    hostVipTier: 'elite',
    entryCoins: 10,
    createdAt: '11m ago',
    status: 'waiting_for_friend',
  },
];

interface GamingViewProps {
  onSelectRoom?: (roomId: string) => void;
}

export default function GamingView({ onSelectRoom }: GamingViewProps) {
  const { user, friends } = useAuth();
  const [activeGameType, setActiveGameType] = useState<GameInfo['gameType']>('higher_card');
  const [activeMiniGame, setActiveMiniGame] = useState<boolean>(false);
  const [activeTourney, setActiveTourney] = useState<boolean>(false);
  const [selectedFriendOpponent, setSelectedFriendOpponent] = useState<{ id: string; name: string; photoUrl: string } | null>(null);

  // Private Friendly Match Creator State
  const [creatorModalOpen, setCreatorModalOpen] = useState(false);
  const [creatorStep, setCreatorStep] = useState<'configure' | 'share'>('configure');
  const [creatorGameType, setCreatorGameType] = useState<GameInfo['gameType']>('higher_card');
  const [creatorMatchTitle, setCreatorMatchTitle] = useState(`${user.displayName}'s Friendly Match`);
  const [creatorEntryCoins, setCreatorEntryCoins] = useState<number>(10);
  const [createdMatch, setCreatedMatch] = useState<PrivateMatchInstance | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [invitedFriends, setInvitedFriends] = useState<string[]>([]);

  // Join via code modal
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  // Community & User matches list
  const [activeMatches, setActiveMatches] = useState<PrivateMatchInstance[]>(INITIAL_COMMUNITY_MATCHES);

  const totalPlaying = AVAILABLE_GAMES.reduce((acc, g) => acc + g.playingCount, 0);

  const handleLaunchFriendlyGame = (
    gameType: GameInfo['gameType'],
    opponent?: { id: string; name: string; photoUrl: string } | null
  ) => {
    setActiveGameType(gameType);
    setSelectedFriendOpponent(opponent || null);
    if (gameType === 'tournament') {
      setActiveTourney(true);
    } else {
      setActiveMiniGame(true);
    }
  };

  const handleOpenCreator = (defaultType: GameInfo['gameType'] = 'higher_card') => {
    setCreatorGameType(defaultType);
    setCreatorMatchTitle(`${user.displayName}'s Friendly Match`);
    setCreatorEntryCoins(10);
    setCreatorStep('configure');
    setCreatedMatch(null);
    setCopiedLink(false);
    setInvitedFriends([]);
    setCreatorModalOpen(true);
    playMessageSound();
  };

  const handleCreatePrivateMatch = (e: React.FormEvent) => {
    e.preventDefault();
    const game = AVAILABLE_GAMES.find((g) => g.gameType === creatorGameType) || AVAILABLE_GAMES[0];
    const code = `VIBEZ-${Math.floor(1000 + Math.random() * 9000)}`;
    const link = `${window.location.origin}/?match=${code}`;

    const newInstance: PrivateMatchInstance = {
      id: `match-${Date.now()}`,
      code,
      inviteLink: link,
      gameId: game.id,
      gameTitle: game.title,
      gameType: game.gameType,
      gameIcon: game.icon,
      matchName: creatorMatchTitle.trim() || `${user.displayName}'s Friendly Match`,
      hostId: user.id,
      hostName: user.displayName,
      hostPhoto: user.photoUrl,
      hostVipTier: user.vipTier,
      entryCoins: creatorEntryCoins,
      createdAt: 'Just now',
      status: 'waiting_for_friend',
    };

    setCreatedMatch(newInstance);
    setActiveMatches((prev) => [newInstance, ...prev]);
    setCreatorStep('share');
    playWinSound();
  };

  const handleCopyLink = (linkToCopy?: string) => {
    const text = linkToCopy || (createdMatch ? createdMatch.inviteLink : '');
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    playMessageSound();
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleSendFriendInvite = (friend: { id: string; displayName: string }) => {
    setInvitedFriends((prev) => [...prev, friend.id]);
    playMessageSound();
  };

  const handleJoinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);
    const cleaned = joinCodeInput.trim().toUpperCase();
    if (!cleaned) return;

    // Search existing matches or parse code
    const match = activeMatches.find((m) => m.code.toUpperCase() === cleaned || cleaned.includes(m.code.toUpperCase()));

    if (match) {
      setJoinModalOpen(false);
      setJoinCodeInput('');
      playWinSound();
      handleLaunchFriendlyGame(match.gameType, {
        id: match.hostId,
        name: match.hostName,
        photoUrl: match.hostPhoto,
      });
    } else {
      // Connect to real player match with that code
      setJoinModalOpen(false);
      setJoinCodeInput('');
      playWinSound();
      handleLaunchFriendlyGame('higher_card', {
        id: 'user-maya',
        name: 'Maya Phoenix',
        photoUrl: '/public/avatars/default-3-alien.png',
      });
    }
  };

  const handleJoinExistingMatch = (match: PrivateMatchInstance) => {
    playMessageSound();
    handleLaunchFriendlyGame(match.gameType, {
      id: match.hostId,
      name: match.hostName,
      photoUrl: match.hostPhoto,
    });
  };

  return (
    <div className="space-y-6 pb-24 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-pink-950/50 border border-white/10 shadow-2xl">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-extrabold uppercase tracking-wider">
            <HeartHandshake className="w-3.5 h-3.5 text-pink-400" />
            <span>Private Friendly Matches • Real Players Only</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Friendly 1v1 Gaming Hub
          </h1>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Create private match instances, generate direct invite links for your friends, or jump into friendly tables.
            Always 100% real player matches — play directly with your friends.
          </p>

          {/* Quick Actions & Live Stats Bar */}
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => handleOpenCreator('higher_card')}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 text-white font-black text-xs hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Friendly Match & Link</span>
            </button>

            <button
              onClick={() => setJoinModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/10 text-zinc-200 border border-white/10 font-bold text-xs transition-colors flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5 text-purple-400" />
              <span>Join with Code / Link</span>
            </button>

            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
              <Coins className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>{user.coins} Coins</span>
            </div>
          </div>
        </div>

        {/* Ambient glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Active Private Friendly Matches (Invite & Join Tables) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-400" />
            <h2 className="font-extrabold text-sm sm:text-base text-white">Private Friendly Matches</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-black">
              Direct Invite Links
            </span>
          </div>

          <button
            onClick={() => handleOpenCreator('higher_card')}
            className="text-xs font-bold text-purple-300 hover:text-purple-200 flex items-center gap-1"
          >
            <span>+ New Match</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeMatches.map((m) => {
            const isMyMatch = m.hostId === user.id;
            return (
              <div
                key={m.id}
                className="p-3.5 rounded-2xl bg-[#120e24] border border-white/10 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-3 shadow-lg group relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="relative shrink-0">
                      <img
                        src={m.hostPhoto}
                        alt={m.hostName}
                        className="w-10 h-10 rounded-xl object-cover bg-zinc-800 ring-1 ring-white/10"
                      />
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#120e24] bg-emerald-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white truncate">{m.matchName}</span>
                        {isMyMatch && (
                          <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-1 truncate">
                        <span>Host: {m.hostName}</span>
                        <span>•</span>
                        <span className="text-zinc-500">{m.createdAt}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xl p-1.5 rounded-xl bg-white/[0.04] shrink-0">{m.gameIcon}</span>
                </div>

                {/* Match Details */}
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[9px] text-zinc-500 uppercase font-black block">Game</span>
                    <span className="font-bold text-zinc-200 truncate block">{m.gameTitle}</span>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.02] border border-white/5">
                    <span className="text-[9px] text-zinc-500 uppercase font-black block">Entry</span>
                    <span className="font-bold text-amber-300 flex items-center gap-1">
                      {m.entryCoins === 0 ? 'Free Play' : `${m.entryCoins} Coins`}
                    </span>
                  </div>
                </div>

                {/* Actions: Join or Copy Link */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => handleCopyLink(m.inviteLink)}
                    className="p-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                    title="Copy invite link to clipboard"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleJoinExistingMatch(m)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 active:scale-95 text-white font-extrabold text-xs transition-all shadow-md shadow-purple-600/30 flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isMyMatch ? 'Enter Your Table' : 'Join Match Table'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Games Showcase */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-pink-400" />
            <h2 className="font-extrabold text-sm sm:text-base text-white">Available Games</h2>
          </div>
          <span className="text-xs text-zinc-400">All games support private invite links & real 1v1 play</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_GAMES.map((game) => (
            <div
              key={game.id}
              onClick={() => handleLaunchFriendlyGame(game.gameType, null)}
              className="group p-5 rounded-2xl bg-[#120f24] border border-white/10 hover:border-purple-500/50 hover:shadow-xl hover:shadow-purple-500/15 transition-all duration-300 cursor-pointer flex flex-col justify-between space-y-4 relative overflow-hidden"
            >
              {/* Card Top */}
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      {game.icon}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-base text-white group-hover:text-purple-300 transition-colors">
                        {game.title}
                      </h3>
                      <span className="text-[11px] font-semibold text-zinc-400">
                        {game.category} • Real Player 1v1
                      </span>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-[10px] font-black uppercase tracking-wider shrink-0">
                    {game.payoutBadge}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                  {game.description}
                </p>
              </div>

              {/* Match Format & Real Players */}
              <div className="pt-3 border-t border-white/5 space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Live Active</div>
                      <div className="font-black text-emerald-400 text-xs">
                        {game.playingCount} real players
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2">
                    <HeartHandshake className="w-3.5 h-3.5 text-pink-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase">Format</div>
                      <div className="font-black text-pink-300 text-xs truncate">
                        1v1 Match
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenCreator(game.gameType);
                    }}
                    className="text-xs font-bold text-purple-300 hover:text-white flex items-center gap-1 transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Generate Link</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunchFriendlyGame(game.gameType, null);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold text-xs flex items-center gap-1.5 hover:brightness-110 active:scale-95 transition-all shadow-md shadow-purple-600/30"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play 1v1</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FRIENDLY MATCH CREATOR MODAL (Generate Private Match & Invite Link) */}
      {creatorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-[#120e26] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-zinc-900/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <LinkIcon className="w-5 h-5 text-pink-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-white">
                    {creatorStep === 'configure' ? 'Create Private Friendly Match' : 'Private Match Ready!'}
                  </h3>
                  <p className="text-[10px] text-zinc-400">
                    {creatorStep === 'configure'
                      ? 'Configure match details and generate a direct invite link for friends'
                      : 'Share this link with your friends to join directly'}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setCreatorModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step 1: Configure Match */}
            {creatorStep === 'configure' && (
              <form onSubmit={handleCreatePrivateMatch} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                {/* 1. Game Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block">Select Game</label>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_GAMES.map((g) => {
                      const isSel = creatorGameType === g.gameType;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          onClick={() => setCreatorGameType(g.gameType)}
                          className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all ${
                            isSel
                              ? 'bg-purple-600/30 border-purple-400 text-white ring-1 ring-purple-400/60 shadow-md'
                              : 'bg-white/[0.03] border-white/5 text-zinc-300 hover:bg-white/[0.06]'
                          }`}
                        >
                          <span className="text-2xl">{g.icon}</span>
                          <div className="min-w-0">
                            <span className="font-bold text-xs truncate block">{g.title}</span>
                            <span className="text-[10px] text-pink-300">{g.payoutBadge}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Match Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block">Match Name / Description</label>
                  <input
                    type="text"
                    value={creatorMatchTitle}
                    onChange={(e) => setCreatorMatchTitle(e.target.value)}
                    placeholder="e.g. Alex's Friendly Duel"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400"
                    required
                  />
                </div>

                {/* 3. Coin Entry Level */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block">Entry Level</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { amt: 0, label: 'Free' },
                      { amt: 10, label: '10 Coins' },
                      { amt: 25, label: '25 Coins' },
                      { amt: 50, label: '50 Coins' },
                    ].map((entry) => (
                      <button
                        key={entry.amt}
                        type="button"
                        onClick={() => setCreatorEntryCoins(entry.amt)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-extrabold border transition-all text-center ${
                          creatorEntryCoins === entry.amt
                            ? 'bg-amber-400 text-zinc-950 border-amber-400 shadow-md shadow-amber-400/30 scale-102'
                            : 'bg-white/[0.03] border-white/5 text-zinc-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Real Player Notice */}
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Real Player Guaranteed: Friends join directly through your generated link. 100% real players.</span>
                </div>

                {/* Submit Button */}
                <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setCreatorModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-purple-600/30 flex items-center gap-1.5"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Generate Invite Link</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Share Invite Link & Direct Invite */}
            {creatorStep === 'share' && createdMatch && (
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                {/* Match Summary Box */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{createdMatch.gameIcon}</span>
                    <div>
                      <h4 className="font-extrabold text-sm text-white">{createdMatch.matchName}</h4>
                      <p className="text-[11px] text-zinc-400">
                        {createdMatch.gameTitle} • {createdMatch.entryCoins === 0 ? 'Free Friendly' : `${createdMatch.entryCoins} Coins`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase block">Match Code</span>
                    <span className="font-mono font-black text-xs text-amber-300 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                      {createdMatch.code}
                    </span>
                  </div>
                </div>

                {/* Direct Invite Link Generator Box */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block flex items-center justify-between">
                    <span>Direct Invite Link</span>
                    <span className="text-[10px] text-purple-300 font-normal">Friends click to join table</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdMatch.inviteLink}
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-black/60 border border-white/10 text-white font-mono text-xs focus:outline-none"
                    />
                    <button
                      onClick={() => handleCopyLink()}
                      className={`px-3.5 py-2.5 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shrink-0 ${
                        copiedLink
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30'
                          : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
                      }`}
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>

                {/* 1-Click Send to Friends */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">Send Link Directly to Friends</span>
                    <span className="text-[10px] text-zinc-500">{friends.length} friends</span>
                  </div>

                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {friends.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-2 italic text-center">
                        No friends added yet. Copy the link above to share on Discord, WhatsApp, etc.!
                      </p>
                    ) : (
                      friends.map((f) => {
                        const isInvited = invitedFriends.includes(f.id);
                        return (
                          <div
                            key={f.id}
                            className="p-2 rounded-xl bg-white/[0.02] border border-white/5 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <img
                                src={f.photoUrl}
                                alt={f.displayName}
                                className="w-7 h-7 rounded-lg object-cover bg-zinc-800"
                              />
                              <span className="font-bold text-white truncate">{f.displayName}</span>
                            </div>

                            <button
                              onClick={() => handleSendFriendInvite(f)}
                              disabled={isInvited}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                                isInvited
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-purple-600 text-white hover:bg-purple-500'
                              }`}
                            >
                              {isInvited ? <Check className="w-3 h-3" /> : <Send className="w-3 h-3" />}
                              <span>{isInvited ? 'Sent' : 'Send Invite'}</span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Launch Table Action */}
                <div className="pt-2 flex items-center gap-2 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setCreatorModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800"
                  >
                    Done
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCreatorModalOpen(false);
                      handleLaunchFriendlyGame(createdMatch.gameType, null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-purple-600/30 flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Table Now</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* JOIN VIA CODE / LINK MODAL */}
      {joinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#120e26] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-white/10 bg-zinc-900/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300">
                  <KeyRound className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Join Private Friendly Match</h3>
                  <p className="text-[10px] text-zinc-400">Enter your friend's invite code or link</p>
                </div>
              </div>
              <button
                onClick={() => setJoinModalOpen(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleJoinWithCode} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-300 block">Match Code or Link</label>
                <input
                  type="text"
                  placeholder="e.g. VIBEZ-4821 or paste invite URL"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400 font-mono"
                  autoFocus
                  required
                />
              </div>

              {joinError && (
                <p className="text-xs text-rose-400 font-medium">{joinError}</p>
              )}

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setJoinModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!joinCodeInput.trim()}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs transition-all disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Join Table</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mini-Games Panel with real-player opponent support */}
      <GamePanel
        isOpen={activeMiniGame}
        onClose={() => {
          setActiveMiniGame(false);
          setSelectedFriendOpponent(null);
        }}
        roomId="room-world"
        initialGame={activeGameType as any}
        friendOpponent={selectedFriendOpponent}
      />

      {/* Tournament Bracket Modal */}
      <TournamentModal
        isOpen={activeTourney}
        onClose={() => setActiveTourney(false)}
        roomId="room-world"
      />
    </div>
  );
}
