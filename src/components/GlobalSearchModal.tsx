import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Globe, Users, Dices, Trophy, Crown, ArrowRight, Sparkles } from 'lucide-react';
import { INITIAL_ROOMS, INITIAL_FRIENDS, GIFTS_CATALOG } from '../utils/storage';
import { Room, Friend } from '../types';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRoom: (roomId: string) => void;
  onSelectUser: (user: any) => void;
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  onSelectRoom,
  onSelectUser,
}: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle keyboard escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  const matchedRooms = INITIAL_ROOMS.filter(
    (r) =>
      !q ||
      r.roomName.toLowerCase().includes(q) ||
      r.roomDescription.toLowerCase().includes(q) ||
      r.roomCategory.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q))
  );

  const matchedFriends = INITIAL_FRIENDS.filter(
    (f) =>
      !q ||
      f.displayName.toLowerCase().includes(q) ||
      f.username.toLowerCase().includes(q)
  );

  const games = [
    { id: 'higher_card', name: 'Higher Card Duel', desc: 'Card game with 2.2x pot multiplier', icon: '🃏' },
    { id: 'dice_roll', name: '2-Dice High Roller', desc: 'Roll dice higher than opponent', icon: '🎲' },
    { id: 'spin_wheel', name: 'Wheel of Fortune', desc: '10-coin spin for up to 100 coins', icon: '🎡' },
    { id: 'tourney', name: 'Knockout Tournament', desc: '8-Player championship bracket', icon: '🏆' },
  ].filter((g) => !q || g.name.toLowerCase().includes(q) || g.desc.toLowerCase().includes(q));

  const totalResults = matchedRooms.length + matchedFriends.length + games.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#120e24] border border-white/10 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-zinc-900/60">
          <Search className="w-5 h-5 text-purple-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search rooms, members, games, or vibes... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-white text-sm placeholder:text-zinc-500 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-400 hover:text-white"
          >
            Esc
          </button>
        </div>

        {/* Results Area */}
        <div className="p-4 overflow-y-auto space-y-5">
          {totalResults === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No results found for "{query}". Try searching "World", "Maya", or "Card".
            </div>
          ) : (
            <>
              {/* Rooms Category */}
              {matchedRooms.length > 0 && (
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-purple-400 mb-2 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>Rooms ({matchedRooms.length})</span>
                  </div>
                  <div className="space-y-1.5">
                    {matchedRooms.map((room) => (
                      <div
                        key={room.id}
                        onClick={() => {
                          onSelectRoom(room.id);
                          onClose();
                        }}
                        className="p-2.5 rounded-xl bg-zinc-900/70 border border-white/5 hover:border-purple-500/40 hover:bg-purple-950/20 transition-all flex items-center justify-between cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                            {room.roomBanner && (
                              <img src={room.roomBanner} alt={room.roomName} className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-xs text-white group-hover:text-purple-300">
                              {room.roomName}
                            </div>
                            <div className="text-[10px] text-zinc-400 line-clamp-1">
                              {room.roomDescription}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-zinc-400">
                            {room.currentUserCount}/{room.maxCapacity}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-purple-300 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* People / Members */}
              {matchedFriends.length > 0 && (
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-pink-400 mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>Members & Friends ({matchedFriends.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {matchedFriends.map((friend) => (
                      <div
                        key={friend.id}
                        onClick={() => {
                          onSelectUser(friend);
                          onClose();
                        }}
                        className="p-2 rounded-xl bg-zinc-900/70 border border-white/5 hover:border-pink-500/40 hover:bg-pink-950/20 transition-all flex items-center gap-2.5 cursor-pointer group"
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                          <img src={friend.photoUrl} alt={friend.displayName} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-white group-hover:text-pink-300 truncate">
                            {friend.displayName}
                          </div>
                          <div className="text-[10px] text-zinc-400">@{friend.username}</div>
                        </div>
                        {friend.vipTier && (
                          <span className="text-[9px] font-extrabold uppercase px-1 rounded bg-amber-400/20 text-amber-300">
                            {friend.vipTier}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Games & Activities */}
              {games.length > 0 && (
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                    <Dices className="w-3.5 h-3.5" />
                    <span>Games & Tournaments ({games.length})</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {games.map((g) => (
                      <div
                        key={g.id}
                        onClick={() => {
                          onSelectRoom('room-games');
                          onClose();
                        }}
                        className="p-2 rounded-xl bg-zinc-900/70 border border-white/5 hover:border-amber-400/40 hover:bg-amber-950/20 transition-all flex items-center gap-2.5 cursor-pointer group"
                      >
                        <span className="text-xl">{g.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-xs text-white group-hover:text-amber-300">
                            {g.name}
                          </div>
                          <div className="text-[10px] text-zinc-400 line-clamp-1">{g.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
