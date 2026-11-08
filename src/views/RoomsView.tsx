import React, { useState } from 'react';
import { Room } from '../types';
import { INITIAL_ROOMS, INITIAL_MEMBERS } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { playRoomEnterSound } from '../utils/sound';
import {
  Star,
  Users,
  ArrowRight,
  Search,
  Compass,
  X,
  Sun,
  Radio,
  Eye,
  Heart,
  Trees,
  MapPin,
  MessageCircle,
} from 'lucide-react';

interface RoomsViewProps {
  onSelectRoom: (roomId: string) => void;
}

export type RoomCategoryFilter = 'all' | 'gaming' | 'global' | 'music' | 'fandom' | 'favorites';

export default function RoomsView({ onSelectRoom }: RoomsViewProps) {
  const { favoriteRoomIds, toggleFavorite, autoJoin } = useAuth();
  const [rooms] = useState<Room[]>(INITIAL_ROOMS);
  const [categoryFilter, setCategoryFilter] = useState<RoomCategoryFilter>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'active' | 'popular'>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoJoining, setAutoJoining] = useState(false);
  const [peekingRoomId, setPeekingRoomId] = useState<string | null>(null);

  // Dynamic vibe metadata for rooms
  const ROOM_DAY_METADATA: Record<string, { scene: string; sceneIcon: any; vibeTag: string; chatRate: string }> = {
    'room-world': {
      scene: 'Paris Monument Park',
      sceneIcon: MapPin,
      vibeTag: 'High Energy',
      chatRate: '18 msgs/min',
    },
    'room-games': {
      scene: 'Sunlit City Park & Pond',
      sceneIcon: Trees,
      vibeTag: 'Gaming Arenas',
      chatRate: '24 msgs/min',
    },
    'room-bts': {
      scene: 'Floral Heart Garden',
      sceneIcon: Heart,
      vibeTag: 'Chill & Warm',
      chatRate: '12 msgs/min',
    },
    'room-hp': {
      scene: 'Castle Monument Lawn',
      sceneIcon: MapPin,
      vibeTag: 'Community Hangout',
      chatRate: '9 msgs/min',
    },
  };

  const filteredRooms = rooms
    .filter((r) => {
      let matchesCategory = true;
      if (categoryFilter === 'favorites') {
        matchesCategory = favoriteRoomIds.includes(r.id);
      } else if (categoryFilter === 'gaming') {
        matchesCategory =
          r.roomCategory.toLowerCase().includes('gaming') ||
          Boolean(r.tags?.some((t) => t.toLowerCase().includes('game')));
      } else if (categoryFilter === 'global') {
        matchesCategory =
          r.roomCategory.toLowerCase().includes('global') ||
          Boolean(r.tags?.some((t) => t.toLowerCase().includes('global')));
      } else if (categoryFilter === 'music') {
        matchesCategory =
          r.roomCategory.toLowerCase().includes('music') ||
          Boolean(r.tags?.some((t) => t.toLowerCase().includes('k-pop') || t.toLowerCase().includes('music')));
      } else if (categoryFilter === 'fandom') {
        matchesCategory =
          r.roomCategory.toLowerCase().includes('fandom') ||
          Boolean(r.tags?.some((t) => t.toLowerCase().includes('fantasy') || t.toLowerCase().includes('trivia')));
      }

      const matchesSearch =
        !searchQuery.trim() ||
        r.roomName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.roomDescription.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.roomCategory.toLowerCase().includes(searchQuery.toLowerCase()) ||
        Boolean(r.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      return Boolean(matchesCategory && matchesSearch);
    })
    .sort((a, b) => {
      if (sortBy === 'active') return b.currentUserCount - a.currentUserCount;
      if (sortBy === 'popular') return (favoriteRoomIds.includes(b.id) ? 1 : 0) - (favoriteRoomIds.includes(a.id) ? 1 : 0);
      return 0; // default trending
    });

  // Direct room entry: ZERO popups, ZERO delays
  const handleJoin = (roomId: string) => {
    playRoomEnterSound();
    onSelectRoom(roomId);
  };

  const handleAutoJoin = () => {
    setAutoJoining(true);
    setTimeout(() => {
      const res = autoJoin();
      setAutoJoining(false);
      if (res) {
        handleJoin(res.roomId);
      }
    }, 400);
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Top Dynamic Vibe Hero - Smooth Light Themed, No Borders */}
      <div className="relative rounded-3xl overflow-hidden p-6 sm:p-8 bg-gradient-to-r from-violet-100/90 via-indigo-50/80 to-pink-100/90 shadow-sm text-slate-800">
        <div className="relative z-10 max-w-xl space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/90 text-purple-700 text-xs font-black uppercase tracking-wider shadow-xs">
            <Sun className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
            <span>Social Arenas • Live Now</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Drop into social rooms & scenic worlds
          </h2>

          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
            Wander across famous monuments, botanical heart gardens, and city parks. Move your avatar anywhere and chat with members in real time.
          </p>

          {/* Dynamic Live Ticker - Borderless */}
          <div className="py-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 font-semibold">
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              186 Active Online
            </span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="flex items-center gap-1 text-purple-700 bg-purple-100/80 px-2.5 py-0.5 rounded-full shadow-xs">
              <Radio className="w-3 h-3 text-purple-600" />
              4 Live Arenas
            </span>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={handleAutoJoin}
              disabled={autoJoining}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs sm:text-sm hover:brightness-105 active:scale-95 transition-all shadow-md shadow-purple-600/25 flex items-center gap-2"
            >
              <Compass className={`w-4 h-4 ${autoJoining ? 'animate-spin' : ''}`} />
              <span>{autoJoining ? 'Finding vibe...' : 'Quick Join Any Room'}</span>
            </button>
            <span className="text-xs text-slate-500 font-medium">Up to 36 avatars per room</span>
          </div>
        </div>

        {/* Ambient decorative light sunburst */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Filter, Dynamic Sorter & Search Bar - Borderless & Smooth */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 p-1.5 bg-slate-100/90 rounded-2xl overflow-x-auto shadow-xs">
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
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all ${
                categoryFilter === cat.id
                  ? 'bg-white text-purple-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Dynamic Sort Selector */}
          <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl shadow-xs text-xs">
            <button
              onClick={() => setSortBy('trending')}
              className={`px-3 py-1 rounded-xl font-black transition-all ${
                sortBy === 'trending' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              🔥 Trending
            </button>
            <button
              onClick={() => setSortBy('active')}
              className={`px-3 py-1 rounded-xl font-black transition-all ${
                sortBy === 'active' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              👥 Most Active
            </button>
          </div>

          {/* Search Input - Borderless */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search rooms, tags, vibes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 rounded-2xl bg-white text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none shadow-xs transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Rooms Grid - Borderless, Smooth Shadow Elevation */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
        {filteredRooms.map((room) => {
          const isFav = favoriteRoomIds.includes(room.id);
          const isPeeking = peekingRoomId === room.id;
          const meta = ROOM_DAY_METADATA[room.id] || {
            scene: 'Park',
            sceneIcon: Trees,
            vibeTag: 'Active Vibe',
            chatRate: '15 msgs/min',
          };
          const SceneIcon = meta.sceneIcon;
          const roomMembers = INITIAL_MEMBERS[room.id] || INITIAL_MEMBERS['room-world'] || [];

          return (
            <div
              key={room.id}
              className="group bg-white rounded-3xl overflow-hidden transition-all duration-300 flex flex-col justify-between relative shadow-sm hover:shadow-xl cursor-pointer"
              onClick={() => handleJoin(room.id)}
            >
              {/* Room Banner Area */}
              <div className="relative h-40 bg-slate-100 overflow-hidden">
                {room.roomBanner ? (
                  <img
                    src={room.roomBanner}
                    alt={room.roomName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-purple-200 via-indigo-100 to-pink-100" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                {/* Favorite Star Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(room.id);
                  }}
                  className="absolute top-3 right-3 p-2 rounded-2xl bg-white/90 backdrop-blur-md text-slate-700 hover:text-amber-500 transition-all active:scale-90 shadow-sm"
                  title="Bookmark Room"
                >
                  <Star
                    className={`w-4 h-4 ${isFav ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`}
                  />
                </button>

                {/* Category & Scene Badge - Borderless */}
                <div className="absolute top-3 left-3 flex items-center gap-1.5">
                  <span className="px-3 py-1 rounded-full bg-white/95 backdrop-blur-md text-[10px] font-black text-purple-700 shadow-sm">
                    {room.roomCategory}
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black shadow-sm flex items-center gap-1">
                    <SceneIcon className="w-3 h-3" />
                    <span>{meta.scene}</span>
                  </span>
                </div>

                {/* Room Title in banner */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="font-black text-lg drop-shadow tracking-tight">
                    #{room.roomName}
                  </h3>
                </div>
              </div>

              {/* Content Body */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {room.roomDescription}
                </p>

                {/* Dynamic Stats Row - Borderless */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 font-bold text-slate-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {room.currentUserCount}/{room.maxCapacity} live
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] font-bold text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full">
                      {meta.vibeTag}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <MessageCircle className="w-3.5 h-3.5 text-slate-400" />
                    <span>{meta.chatRate}</span>
                  </div>
                </div>

                {/* Interactive Peek Inside Drawer */}
                {isPeeking && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="p-3 rounded-2xl bg-slate-50 animate-fadeIn space-y-2 shadow-inner"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <span>Avatars Inside ({roomMembers.length}):</span>
                      </span>
                      <button
                        onClick={() => setPeekingRoomId(null)}
                        className="text-[10px] text-slate-400 hover:text-slate-700"
                      >
                        Close
                      </button>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {roomMembers.map((m) => (
                        <div
                          key={m.userId}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white rounded-xl shrink-0 shadow-xs"
                        >
                          <img
                            src={m.photoUrl}
                            alt={m.displayName}
                            className="w-5 h-5 rounded-lg object-cover bg-slate-100"
                          />
                          <span className="text-[11px] font-bold text-slate-800">{m.displayName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Bottom Actions */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPeekingRoomId(isPeeking ? null : room.id);
                    }}
                    className="px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{isPeeking ? 'Hide Peek' : 'Peek Inside'}</span>
                  </button>

                  <button
                    onClick={() => handleJoin(room.id)}
                    className="flex-1 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-105 active:scale-[0.98] text-white text-xs font-black transition-all shadow-sm shadow-purple-600/25 flex items-center justify-center gap-1.5"
                  >
                    <span>Enter Room</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
