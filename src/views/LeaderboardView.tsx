import React, { useState } from 'react';
import { LeaderboardEntry } from '../types';
import { INITIAL_LEADERBOARD } from '../utils/storage';
import { Trophy, Coins, Crown, Diamond, Star, Sparkles, Flame, Shield, Search, X } from 'lucide-react';
import ProfilePopupModal from '../components/ProfilePopupModal';

interface LeaderboardViewProps {
  onOpenDm?: (user: { id: string; name: string }) => void;
}

export default function LeaderboardView({ onOpenDm }: LeaderboardViewProps) {
  const [activeTab, setActiveTab] = useState<'points' | 'coins-spent'>('points');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Sort based on active tab
  const sortedEntries = [...INITIAL_LEADERBOARD]
    .sort((a, b) => {
      if (activeTab === 'points') {
        return b.pointsEarned - a.pointsEarned;
      }
      return b.coinsSpent - a.coinsSpent;
    })
    .map((entry, idx) => ({ ...entry, rank: idx + 1 }));

  const filteredEntries = sortedEntries.filter(
    (e) =>
      !searchQuery.trim() ||
      e.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const top3 = sortedEntries.slice(0, 3);
  const remaining = searchQuery.trim() ? filteredEntries : sortedEntries.slice(3);

  // Octagon Neon Frame
  const renderOctagonAvatar = (entry: LeaderboardEntry, rank: number) => {
    const isFirst = rank === 1;
    const isSecond = rank === 2;
    const size = isFirst ? 'w-24 h-24' : 'w-20 h-20';

    const glowClass = isFirst
      ? 'border-amber-400 shadow-amber-400/40 from-amber-400 to-yellow-300'
      : isSecond
      ? 'border-cyan-400 shadow-cyan-400/40 from-cyan-400 to-blue-400'
      : 'border-pink-400 shadow-pink-400/40 from-pink-400 to-purple-400';

    return (
      <div className="relative flex flex-col items-center">
        {/* Crown on 1st place */}
        {isFirst && (
          <div className="absolute -top-6 animate-bounce">
            <Crown className="w-8 h-8 text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          </div>
        )}

        {/* Avatar with glowing ring */}
        <div
          className={`${size} rounded-2xl p-1 bg-gradient-to-tr ${glowClass} shadow-xl shadow-current/20 transition-transform group-hover:scale-105`}
        >
          <img
            src={entry.photoUrl}
            alt={entry.displayName}
            className="w-full h-full object-cover rounded-xl bg-zinc-900"
          />
        </div>

        {/* Rank Chip */}
        <div
          className={`absolute -bottom-2 px-2.5 py-0.5 rounded-full text-xs font-black shadow-lg ${
            isFirst
              ? 'bg-amber-400 text-zinc-950'
              : isSecond
              ? 'bg-cyan-400 text-zinc-950'
              : 'bg-pink-400 text-zinc-950'
          }`}
        >
          #{rank}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden p-6 bg-gradient-to-r from-[#170a2c] via-[#100720] to-[#1e0a24] border border-white/10 shadow-2xl text-center space-y-2">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-extrabold uppercase tracking-widest">
          <Flame className="w-3.5 h-3.5 fill-amber-400" />
          <span>Gaming Arena Champions</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-white">GenC Hall of Fame</h2>
        <p className="text-xs text-zinc-400 max-w-md mx-auto">
          Tournament victories, Higher Card streaks, and coin spent glory. Climb the arena podium!
        </p>

        {/* Tab Switcher */}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-center gap-3">
          <div className="inline-flex p-1 rounded-xl bg-zinc-900/90 border border-white/10 gap-1">
            <button
              onClick={() => setActiveTab('points')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                activeTab === 'points'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Trophy className="w-4 h-4" />
              <span>Points Leaderboard</span>
            </button>
            <button
              onClick={() => setActiveTab('coins-spent')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold flex items-center gap-2 transition-all ${
                activeTab === 'coins-spent'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>Coins Spent</span>
            </button>
          </div>

          {/* Search Player Input */}
          <div className="relative w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Find player on board..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-amber-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top 3 Arena Podium */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 max-w-2xl mx-auto pt-6 items-end">
        {/* Rank 2 (Left) */}
        {top3[1] && (
          <div
            onClick={() => setSelectedUser(top3[1])}
            className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-zinc-900/60 border border-cyan-400/30 hover:border-cyan-400/60 cursor-pointer transition-all shadow-lg shadow-cyan-400/10 group"
          >
            {renderOctagonAvatar(top3[1], 2)}
            <div className="mt-4 text-center">
              <h4 className="font-extrabold text-xs sm:text-sm text-white line-clamp-1">
                {top3[1].displayName}
              </h4>
              <div className="flex items-center justify-center gap-1 text-xs font-bold text-cyan-300 mt-1">
                {activeTab === 'points' ? (
                  <>
                    <Trophy className="w-3.5 h-3.5" />
                    <span>{top3[1].pointsEarned.toLocaleString()} pts</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{top3[1].coinsSpent.toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Rank 1 (Center - Elevated) */}
        {top3[0] && (
          <div
            onClick={() => setSelectedUser(top3[0])}
            className="flex flex-col items-center p-4 sm:p-6 rounded-2xl bg-gradient-to-b from-amber-950/30 via-zinc-900/90 to-zinc-950 border-2 border-amber-400/60 hover:border-amber-400 cursor-pointer transition-all shadow-2xl shadow-amber-400/20 group -translate-y-4"
          >
            {renderOctagonAvatar(top3[0], 1)}
            <div className="mt-5 text-center">
              <h4 className="font-black text-sm sm:text-base text-white line-clamp-1">
                {top3[0].displayName}
              </h4>
              <div className="flex items-center justify-center gap-1 text-sm font-extrabold text-amber-300 mt-1">
                {activeTab === 'points' ? (
                  <>
                    <Trophy className="w-4 h-4 fill-amber-400 text-amber-400" />
                    <span>{top3[0].pointsEarned.toLocaleString()} pts</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-4 h-4 fill-amber-400" />
                    <span>{top3[0].coinsSpent.toLocaleString()}</span>
                  </>
                )}
              </div>
              <div className="mt-1 text-[10px] text-zinc-400 font-semibold">
                {top3[0].tournamentsWon} Crowns • {top3[0].gameWins} Wins
              </div>
            </div>
          </div>
        )}

        {/* Rank 3 (Right) */}
        {top3[2] && (
          <div
            onClick={() => setSelectedUser(top3[2])}
            className="flex flex-col items-center p-3 sm:p-4 rounded-2xl bg-zinc-900/60 border border-pink-400/30 hover:border-pink-400/60 cursor-pointer transition-all shadow-lg shadow-pink-400/10 group"
          >
            {renderOctagonAvatar(top3[2], 3)}
            <div className="mt-4 text-center">
              <h4 className="font-extrabold text-xs sm:text-sm text-white line-clamp-1">
                {top3[2].displayName}
              </h4>
              <div className="flex items-center justify-center gap-1 text-xs font-bold text-pink-300 mt-1">
                {activeTab === 'points' ? (
                  <>
                    <Trophy className="w-3.5 h-3.5" />
                    <span>{top3[2].pointsEarned.toLocaleString()} pts</span>
                  </>
                ) : (
                  <>
                    <Coins className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{top3[2].coinsSpent.toLocaleString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Ranks 4+ Table */}
      <div className="bg-[#110d22] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-white/5 bg-zinc-900/60 flex items-center justify-between text-xs font-bold text-zinc-400">
          <span>Rank & Player</span>
          <span>{activeTab === 'points' ? 'Arena Points' : 'Coins Spent'}</span>
        </div>

        <div className="divide-y divide-white/5">
          {remaining.map((entry) => (
            <div
              key={entry.id}
              onClick={() => setSelectedUser(entry)}
              className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-white/5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-xs font-black text-zinc-500">
                  #{entry.rank}
                </span>
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 bg-zinc-900 shrink-0">
                  <img src={entry.photoUrl} alt={entry.displayName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs sm:text-sm text-white">
                      {entry.displayName}
                    </span>
                    {entry.vipTier && (
                      <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300">
                        {entry.vipTier}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-zinc-400">@{entry.username}</span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs sm:text-sm font-black text-amber-400 flex items-center gap-1 justify-end">
                  {activeTab === 'points' ? (
                    <>
                      <Trophy className="w-3.5 h-3.5" />
                      <span>{entry.pointsEarned.toLocaleString()}</span>
                    </>
                  ) : (
                    <>
                      <Coins className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{entry.coinsSpent.toLocaleString()}</span>
                    </>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500">
                  {entry.gameWins} wins • {entry.tournamentsWon} tourneys
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ProfilePopupModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        targetUser={selectedUser}
        onOpenDm={onOpenDm}
      />
    </div>
  );
}
