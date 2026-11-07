import React, { useState } from 'react';
import { Room } from '../types';
import { INITIAL_ROOMS } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { playRoomEnterSound } from '../utils/sound';
import { Star, Users, ArrowRight, Sparkles, Search, Compass, Shield, X, Tag } from 'lucide-react';

interface RoomsViewProps {
  onSelectRoom: (roomId: string) => void;
}

export type RoomCategoryFilter = 'all' | 'gaming' | 'global' | 'music' | 'fandom' | 'favorites';

export default function RoomsView({ onSelectRoom }: RoomsViewProps) {
  const { favoriteRoomIds, toggleFavorite, autoJoin } = useAuth();
  const [rooms] = useState<Room[]>(INITIAL_ROOMS);
  const [categoryFilter, setCategoryFilter] = useState<RoomCategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoJoining, setAutoJoining] = useState(false);
  const [enteringRoomId, setEnteringRoomId] = useState<string | null>(null);

  const filteredRooms = rooms.filter((r) => {
    // Category or favorite match
    let matchesCategory = true;
    if (categoryFilter === 'favorites') {
      matchesCategory = favoriteRoomIds.includes(r.id);
    } else if (categoryFilter === 'gaming') {
      matchesCategory = r.roomCategory.toLowerCase().includes('gaming') || Boolean(r.tags?.some((t) => t.toLowerCase().includes('game')));
    } else if (categoryFilter === 'global') {
      matchesCategory = r.roomCategory.toLowerCase().includes('global') || Boolean(r.tags?.some((t) => t.toLowerCase().includes('global')));
    } else if (categoryFilter === 'music') {
      matchesCategory = r.roomCategory.toLowerCase().includes('music') || Boolean(r.tags?.some((t) => t.toLowerCase().includes('k-pop') || t.toLowerCase().includes('music')));
    } else if (categoryFilter === 'fandom') {
      matchesCategory = r.roomCategory.toLowerCase().includes('fandom') || Boolean(r.tags?.some((t) => t.toLowerCase().includes('fantasy') || t.toLowerCase().includes('trivia')));
    }

    const matchesSearch =
      !searchQuery.trim() ||
      r.roomName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.roomDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.roomCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
      Boolean(r.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    return Boolean(matchesCategory && matchesSearch);
  });

  const handleJoin = (roomId: string) => {
    if (enteringRoomId) return;
    setEnteringRoomId(roomId);
    playRoomEnterSound();
    // Smooth transition animation before mounting RoomDetailView
    setTimeout(() => {
      onSelectRoom(roomId);
      setEnteringRoomId(null);
    }, 280);
  };

  const handleAutoJoin = () => {
    setAutoJoining(true);
    setTimeout(() => {
      const res = autoJoin();
      setAutoJoining(false);
      if (res) {
        handleJoin(res.roomId);
      }
    }, 600);
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Top Vibe Hero */}
      <div className="relative rounded-2xl overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-pink-900/30 border border-white/10 shadow-2xl">
        <div className="relative z-10 max-w-xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-extrabold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>GenC Social Rooms</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Drop into interactive vibes & live gaming arenas
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300">
            Scatter your avatar, drag to move on canvas, challenge members to mini-games, and compete in tournaments!
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleAutoJoin}
              disabled={autoJoining}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-extrabold text-xs sm:text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-purple-500/25 flex items-center gap-2"
            >
              <Compass className={`w-4 h-4 ${autoJoining ? 'animate-spin' : ''}`} />
              <span>{autoJoining ? 'Finding vibe...' : 'Quick Join Any Room'}</span>
            </button>
            <span className="text-xs text-zinc-400">Up to 36 avatars per room</span>
          </div>
        </div>

        {/* Ambient background glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-white/10 rounded-xl overflow-x-auto">
          {[
            { id: 'all', label: `All (${rooms.length})` },
            { id: 'gaming', label: '🎮 Gaming' },
            { id: 'global', label: '🌐 Global' },
            { id: 'music', label: '🎵 Music' },
            { id: 'fandom', label: '🪄 Fandom' },
            { id: 'favorites', label: `★ Liked (${favoriteRoomIds.length})` },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategoryFilter(cat.id as RoomCategoryFilter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition-all ${
                categoryFilter === cat.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, description, or tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400 transition-colors"
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

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {filteredRooms.map((room) => {
          const isFav = favoriteRoomIds.includes(room.id);
          const isEntering = enteringRoomId === room.id;

          return (
            <div
              key={room.id}
              onClick={() => handleJoin(room.id)}
              className={`group bg-[#120f22] border rounded-2xl overflow-hidden transition-all duration-300 flex flex-col justify-between cursor-pointer relative ${
                isEntering
                  ? 'border-purple-400 ring-2 ring-purple-400/80 shadow-2xl shadow-purple-500/50 scale-[1.02] z-20 brightness-110'
                  : 'border-white/10 hover:border-purple-500/40 hover:shadow-xl hover:shadow-purple-500/10 active:scale-[0.99]'
              }`}
            >
              {/* Portal transition animation overlay when entering */}
              {isEntering && (
                <div className="absolute inset-0 z-30 bg-purple-950/80 backdrop-blur-sm flex items-center justify-center animate-portal-pulse p-4 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-purple-500/30 border border-purple-400 flex items-center justify-center animate-spin">
                      <Sparkles className="w-5 h-5 text-purple-200" />
                    </div>
                    <span className="text-xs font-black text-white tracking-wide drop-shadow">
                      Entering #{room.roomName}...
                    </span>
                  </div>
                </div>
              )}

              {/* Room Banner */}
              <div className="relative h-36 bg-zinc-900 overflow-hidden">
                {room.roomBanner ? (
                  <img
                    src={room.roomBanner}
                    alt={room.roomName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-purple-900 to-indigo-900" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#120f22] via-[#120f22]/40 to-transparent" />

                {/* Favorite Star */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(room.id);
                  }}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-zinc-300 hover:text-white transition-transform active:scale-90"
                  title="Bookmark Room"
                >
                  <Star
                    className={`w-4 h-4 ${isFav ? 'text-amber-400 fill-amber-400' : 'text-zinc-400'}`}
                  />
                </button>

                {/* Category Pill */}
                <div className="absolute bottom-3 left-3 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-bold text-purple-300">
                  {room.roomCategory}
                </div>
              </div>

              {/* Room Details */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="font-extrabold text-lg text-white group-hover:text-purple-300 transition-colors">
                      {room.roomName}
                    </h3>
                    <div className="flex items-center gap-1 text-xs font-bold text-zinc-300 bg-zinc-800/80 px-2 py-0.5 rounded-lg border border-white/5">
                      <Users className="w-3.5 h-3.5 text-purple-400" />
                      <span>
                        {room.currentUserCount}/{room.maxCapacity}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {room.roomDescription}
                  </p>
                </div>

                {/* Tags & Join Button */}
                <div className="pt-2 flex items-center justify-between gap-2 border-t border-white/5">
                  <div className="flex flex-wrap gap-1.5">
                    {room.tags?.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleJoin(room.id);
                    }}
                    className={`px-4 py-2 rounded-xl text-white font-extrabold text-xs transition-all shadow-md flex items-center gap-1.5 ${
                      isEntering
                        ? 'bg-purple-500 brightness-125 scale-105 shadow-purple-500/40'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 active:scale-95 shadow-purple-600/20'
                    }`}
                  >
                    <span>{isEntering ? 'Entering...' : 'Enter Room'}</span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isEntering ? 'translate-x-1 transition-transform' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredRooms.length === 0 && (
        <div className="py-16 text-center space-y-3">
          <Compass className="w-12 h-12 text-zinc-600 mx-auto" />
          <h4 className="font-bold text-base text-zinc-300">No rooms match your search</h4>
          <p className="text-xs text-zinc-500">Try searching for other vibes or switch to All Rooms.</p>
        </div>
      )}
    </div>
  );
}
