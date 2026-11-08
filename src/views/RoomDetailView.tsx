import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomMember, Message } from '../types';
import { INITIAL_ROOMS, INITIAL_MEMBERS, INITIAL_MESSAGES } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { playMessageSound, playNotificationSound } from '../utils/sound';
import {
  ArrowLeft,
  Users,
  Send,
  Search,
  X,
  MessageSquare,
  FileText,
  Sun,
  MapPin,
  Heart,
  Trees,
  Camera,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import ProfilePopupModal from '../components/ProfilePopupModal';
import BoardPostsSection from '../components/BoardPostsSection';
import ChangeAvatarModal from '../components/ChangeAvatarModal';

interface RoomDetailViewProps {
  roomId: string;
  onBack: () => void;
  onOpenDm?: (user: { id: string; name: string }) => void;
}

// Scenic monument, park, and heart scenes
const SCENIC_PARK_SCENES = [
  {
    id: 'monument',
    name: 'Monument Park',
    subtitle: 'Parisian Monument & Spring Lawns',
    image: '/scenes/monument_park.jpg',
    icon: MapPin,
  },
  {
    id: 'heart',
    name: 'Floral Heart Garden',
    subtitle: 'Sunlit Botanical Heart Arch',
    image: '/scenes/heart_garden.jpg',
    icon: Heart,
  },
  {
    id: 'park',
    name: 'Sunlit City Park',
    subtitle: 'Willow Pond & Stone Footbridge',
    image: '/scenes/city_park.jpg',
    icon: Trees,
  },
];

// Extra members used to test transitions above 13 members
const EXTRA_SIMULATED_MEMBERS: RoomMember[] = [
  {
    userId: 'bot-sim-1',
    username: 'pixel_kate',
    displayName: 'Pixel Kate',
    photoUrl: '/avatars/female2.png',
    level: 14,
    vipTier: 'pro',
    auraColor: '#f59e0b',
    auraType: 'flame',
    x: 14,
    y: 38,
  },
  {
    userId: 'bot-sim-2',
    username: 'neon_ray',
    displayName: 'Ray Cyber',
    photoUrl: '/avatars/male3.png',
    level: 19,
    vipTier: 'elite',
    auraColor: '#ec4899',
    auraType: 'rainbow',
    x: 84,
    y: 34,
  },
  {
    userId: 'bot-sim-3',
    username: 'zoey_vibez',
    displayName: 'Zoey V',
    photoUrl: '/avatars/female1.png',
    level: 8,
    x: 28,
    y: 82,
  },
  {
    userId: 'bot-sim-4',
    username: 'sam_beats',
    displayName: 'Sam Beats',
    photoUrl: '/avatars/male1.png',
    level: 11,
    x: 72,
    y: 80,
  },
  {
    userId: 'bot-sim-5',
    username: 'corgi_fan',
    displayName: 'Corgi Fan',
    photoUrl: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=300&h=300&fit=crop&crop=faces',
    level: 9,
    x: 42,
    y: 28,
  },
  {
    userId: 'bot-sim-6',
    username: 'maya_sky',
    displayName: 'Maya Sky',
    photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop&crop=faces',
    level: 16,
    vipTier: 'pro',
    auraColor: '#10b981',
    auraType: 'sparkle',
    x: 60,
    y: 42,
  },
  {
    userId: 'bot-sim-7',
    username: 'lucas_art',
    displayName: 'Lucas Art',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=faces',
    level: 12,
    x: 18,
    y: 62,
  },
  {
    userId: 'bot-sim-8',
    username: 'tara_vibez',
    displayName: 'Tara Star',
    photoUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=300&fit=crop&crop=faces',
    level: 15,
    x: 88,
    y: 88,
  },
];

export default function RoomDetailView({ roomId, onBack, onOpenDm }: RoomDetailViewProps) {
  const { user, addXp, posts } = useAuth();
  const room = INITIAL_ROOMS.find((r) => r.id === roomId) || INITIAL_ROOMS[0];

  const [activeTab, setActiveTab] = useState<'chat' | 'posts'>('chat');
  const roomPostsCount = posts.filter((p) => p.roomId === roomId).length;
  const [changeAvatarModalOpen, setChangeAvatarModalOpen] = useState(false);
  const [extraCrowd, setExtraCrowd] = useState(false);

  // Scenic scenery selection (picks monument/park/heart based on room or random)
  const [selectedSceneIndex, setSelectedSceneIndex] = useState(() => {
    if (roomId === 'room-world') return 0; // Monument
    if (roomId === 'room-bts') return 1; // Heart Garden
    if (roomId === 'room-games') return 2; // City Park
    return Math.floor(Math.random() * SCENIC_PARK_SCENES.length);
  });

  const currentDayScene = SCENIC_PARK_SCENES[selectedSceneIndex];

  // Distribute initial avatars across wide boundaries: left-most (3%), right-most (95%), bottom-most (92%)
  const [members, setMembers] = useState<RoomMember[]>(() => {
    const list = INITIAL_MEMBERS[roomId] || INITIAL_MEMBERS['room-world'];
    return [
      {
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        photoUrl: user.photoUrl,
        level: user.level,
        vipTier: user.vipTier,
        auraColor: user.auraColor,
        auraType: user.auraType,
        x: 48,
        y: 68,
        isSelf: true,
      },
      ...list,
    ];
  });

  // Keep self member's photoUrl, displayName, and vipTier updated when user updates their profile
  useEffect(() => {
    setMembers((prev) =>
      prev.map((m) =>
        m.isSelf
          ? {
              ...m,
              photoUrl: user.photoUrl,
              displayName: user.displayName,
              vipTier: user.vipTier,
            }
          : m
      )
    );
  }, [user.photoUrl, user.displayName, user.vipTier]);

  // Dynamic effective members list and < 13 sizing rule
  const displayMembers = extraCrowd ? [...members, ...EXTRA_SIMULATED_MEMBERS] : members;
  const isUnder13 = displayMembers.length < 13;

  const [messages, setMessages] = useState<Message[]>(() => {
    return INITIAL_MESSAGES[roomId] || INITIAL_MESSAGES['room-world'];
  });

  const [inputText, setInputText] = useState('');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [targetBeacon, setTargetBeacon] = useState<{ x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const filteredMessages = messages.filter((m) => {
    if (!chatSearchQuery.trim()) return true;
    const q = chatSearchQuery.toLowerCase();
    return (
      m.messageText.toLowerCase().includes(q) ||
      m.senderName.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle canvas click to move self avatar freely across the full space (2% to 98% X, 6% to 95% Y)
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // Allow avatars to roam completely to right most (98%), left most (2%), and bottom most (95%)
    const x = Math.min(98, Math.max(2, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(95, Math.max(6, ((e.clientY - rect.top) / rect.height) * 100));

    // Show gentle beacon (no borders)
    setTargetBeacon({ x, y });
    setTimeout(() => {
      setTargetBeacon(null);
    }, 1500);

    setMembers((prev) =>
      prev.map((m) => (m.isSelf ? { ...m, x, y } : m))
    );
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const text = inputText.trim();
    setInputText('');

    const newMsg: Message = {
      id: `m-${Date.now()}`,
      roomId,
      senderId: user.id,
      senderName: user.displayName,
      senderPhoto: user.photoUrl,
      senderVipTier: user.vipTier,
      messageText: text,
      createdAt: 'Just now',
    };

    setMessages((prev) => [...prev, newMsg]);
    playMessageSound();
    addXp(1);

    // Friendly reply from a room member
    setTimeout(() => {
      const otherMembers = members.filter((m) => !m.isSelf);
      if (otherMembers.length === 0) return;
      const responder = otherMembers[Math.floor(Math.random() * otherMembers.length)];

      const replies = [
        `Totally agree with you @${user.displayName}! 🙌`,
        `Loving the park vibez here in ${room.roomName}! ☀️`,
        `Awesome energy in the room! ✨`,
        `Welcome to the lounge @${user.displayName}!`,
        `Great seeing you here! 🌟`,
      ];
      const replyText = replies[Math.floor(Math.random() * replies.length)];

      const botMsg: Message = {
        id: `m-bot-${Date.now()}`,
        roomId,
        senderId: responder.userId,
        senderName: responder.displayName,
        senderPhoto: responder.photoUrl,
        senderVipTier: responder.vipTier,
        messageText: replyText,
        createdAt: 'Just now',
      };
      setMessages((prev) => [...prev, botMsg]);
      playNotificationSound();
    }, 1800);
  };

  return (
    <div className="flex flex-col space-y-4 pb-24 animate-fadeIn">
      {/* Top Header Bar - Smooth Light Themed, No Hard Borders */}
      <div className="p-3 bg-white/95 rounded-3xl flex items-center justify-between gap-2 shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors shrink-0 shadow-xs"
            title="Return to Rooms"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-base sm:text-lg text-slate-900 truncate tracking-tight">
                {room.roomName}
              </h2>
              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
                {room.roomCategory}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="flex items-center gap-1 font-bold text-slate-700">
                <Users className="w-3.5 h-3.5 text-purple-600" />
                {displayMembers.length}/{room.maxCapacity} members
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-semibold truncate flex items-center gap-1">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                {currentDayScene.name}
              </span>
              <span className="text-slate-300">•</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black ${
                isUnder13 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
              }`}>
                {isUnder13 ? '⭐ Big Avatars (<13)' : 'Standard (13+)'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setChangeAvatarModalOpen(true)}
            className="px-3 py-1.5 rounded-2xl bg-teal-500/10 text-teal-800 hover:bg-teal-500/20 text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs shrink-0"
            title="Change your profile picture"
          >
            <Camera className="w-3.5 h-3.5 text-teal-700" />
            <span className="hidden sm:inline">Change Photo</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: ROOM CHAT & POSTS (CREAM THEMED BACKGROUND, NO BORDERS) */}
      <div className="flex flex-col rounded-3xl overflow-hidden bg-[#FAF6EE] shadow-sm">
        {/* Chat / Posts Tabs Header - Warm Cream Tone */}
        <div className="p-2 sm:p-2.5 bg-[#F3ECE0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/30'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-white/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>Room Chat</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-200 font-bold">
                msg
              </span>
            </button>

            <button
              onClick={() => setActiveTab('posts')}
              className={`px-4 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'posts'
                  ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/30'
                  : 'text-stone-700 hover:text-stone-900 hover:bg-white/50'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Room Posts</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-pink-100 text-pink-700 font-black">
                {roomPostsCount}
              </span>
            </button>
          </div>

          {activeTab === 'chat' && (
            <div className="flex items-center gap-2 pr-1">
              <button
                onClick={() => {
                  setChatSearchOpen(!chatSearchOpen);
                  if (chatSearchOpen) setChatSearchQuery('');
                }}
                className={`p-2 rounded-xl transition-all shadow-xs ${
                  chatSearchOpen || chatSearchQuery
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-white text-stone-600 hover:text-stone-900'
                }`}
                title="Search messages"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-stone-500 hidden sm:inline font-semibold">
                {filteredMessages.length} msgs
              </span>
            </div>
          )}
        </div>

        {/* Tab 1: Room Chat View - Warm Cream Background */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[480px] sm:h-[540px] bg-[#FAF6EE]">
            {/* In-Room Chat Search */}
            {chatSearchOpen && (
              <div className="p-3 bg-white flex items-center gap-2 animate-fadeIn shadow-xs">
                <Search className="w-3.5 h-3.5 text-stone-400 shrink-0 ml-1" />
                <input
                  type="text"
                  placeholder="Search messages by sender or keyword..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none"
                  autoFocus
                />
                {chatSearchQuery && (
                  <button
                    onClick={() => setChatSearchQuery('')}
                    className="p-1 text-stone-400 hover:text-stone-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Messages Scroll Area - Cream Colored Background */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#FAF6EE]">
              {filteredMessages.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400">
                  No messages match "{chatSearchQuery}"
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isMine = msg.senderId === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
                    >
                      <img
                        src={msg.senderPhoto}
                        alt={msg.senderName}
                        className="w-8 h-8 rounded-lg aspect-square object-cover bg-stone-200 shrink-0 shadow-xs"
                      />
                      <div className={`max-w-[78%] ${isMine ? 'text-right' : ''}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[11px] font-black ${isMine ? 'text-purple-700' : 'text-stone-800'}`}>
                            {msg.senderName}
                          </span>
                          {msg.senderVipTier && (
                            <span className="text-[9px] uppercase font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded-full">
                              {msg.senderVipTier}
                            </span>
                          )}
                          <span className="text-[9px] text-stone-400">{msg.createdAt}</span>
                        </div>
                        <div
                          className={`p-3 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                            isMine
                              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-tr-none font-medium'
                              : 'bg-white text-stone-800 rounded-tl-none font-normal'
                          }`}
                        >
                          {msg.messageText}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input Bar - Warm Cream Tone, Borderless */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-[#F3ECE0] flex items-center gap-2 shadow-xs"
            >
              <input
                type="text"
                placeholder={`Send message to #${room.roomName}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-white text-stone-900 text-xs sm:text-sm placeholder:text-stone-400 focus:outline-none transition-colors shadow-xs"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:brightness-105 active:scale-95 transition-all disabled:opacity-40 disabled:hover:brightness-100 flex items-center gap-1.5 font-bold text-xs shadow-sm shadow-purple-600/30"
                title="Send message"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Room Board / Posts View */}
        {activeTab === 'posts' && (
          <div className="p-3 sm:p-4 min-h-[480px] max-h-[640px] overflow-y-auto bg-[#FAF6EE]">
            <BoardPostsSection roomId={roomId} roomName={room.roomName} />
          </div>
        )}
      </div>

      {/* SECTION 2: AVATAR SECTION (SMOOTH LIGHT THEMED, NO BORDERS, BIGGER PRO/ELITE AVATARS) */}
      <div className="rounded-3xl overflow-hidden bg-white shadow-sm flex flex-col">
        {/* Avatar Section Header - Smooth, Light Themed, No Borders */}
        <div className="px-4 py-3 bg-slate-50/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Park Avatars</span>
            </span>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
              {displayMembers.length}/{room.maxCapacity} live
            </span>
            <span
              className={`text-[10px] px-2.5 py-0.5 rounded-full font-black ${
                isUnder13 ? 'bg-amber-100 text-amber-900' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {isUnder13 ? '⭐ Big Avatars (<13 in room)' : 'Standard Size (13+ in room)'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Change Avatar Button */}
            <button
              onClick={() => setChangeAvatarModalOpen(true)}
              className="px-3 py-1 rounded-xl text-[11px] font-bold bg-teal-500/10 text-teal-800 hover:bg-teal-500/20 transition-all flex items-center gap-1.5 shadow-xs"
              title="Change your avatar or upload photo"
            >
              <Camera className="w-3.5 h-3.5 text-teal-700" />
              <span>Change Photo</span>
            </button>

            {/* Test Crowd Size Toggle (<13 vs 14+ members) */}
            <button
              onClick={() => setExtraCrowd(!extraCrowd)}
              className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                extraCrowd
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
              title="Toggle to test avatar size transition when crossing 13 members"
            >
              {extraCrowd ? <UserMinus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
              <span>{extraCrowd ? 'Reset to <13' : 'Test 14+ Members'}</span>
            </button>

            {/* Scene Switcher: Monument, Heart Garden, City Park (Borderless) */}
            <div className="flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl shadow-xs">
              {SCENIC_PARK_SCENES.map((scene, idx) => {
                const Icon = scene.icon;
                const isSelected = selectedSceneIndex === idx;
                return (
                  <button
                    key={scene.id}
                    onClick={() => setSelectedSceneIndex(idx)}
                    className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-white text-purple-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title={scene.subtitle}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{scene.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Spacious Canvas Surface with Real Monument / Park / Heart Photo Background */}
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="h-[480px] sm:h-[540px] lg:h-[600px] w-full relative overflow-hidden select-none cursor-crosshair"
          style={{
            backgroundImage: `url(${currentDayScene.image})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Subtle soft ambient overlay */}
          <div className="absolute inset-0 bg-white/10 pointer-events-none backdrop-blur-[0.5px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/15 pointer-events-none" />

          {/* Location label pill - Borderless */}
          <div className="absolute bottom-3 left-3 pointer-events-none px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md shadow-md flex items-center gap-2 z-10">
            <currentDayScene.icon className="w-4 h-4 text-purple-600" />
            <div className="text-left">
              <span className="text-[11px] font-black text-slate-900 block leading-tight">
                {currentDayScene.name}
              </span>
              <span className="text-[9px] text-slate-500 font-semibold block leading-tight">
                {currentDayScene.subtitle}
              </span>
            </div>
          </div>

          {/* Waypoint Beacon when user taps canvas to walk (No Borders) */}
          {targetBeacon && (
            <div
              style={{
                left: `${targetBeacon.x}%`,
                top: `${targetBeacon.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute pointer-events-none z-10 flex items-center justify-center"
            >
              <div className="w-12 h-12 rounded-full bg-purple-500/30 animate-ping shadow-lg" />
              <div className="absolute w-4 h-4 rounded-full bg-white shadow-xl shadow-purple-600" />
            </div>
          )}

          {/* Member Avatars - Dynamic sizing: BIG when < 13 members, standard when >= 13 members */}
          {displayMembers.map((member) => {
            const isElite = member.vipTier === 'elite';
            const isPro = member.vipTier === 'pro';

            // Dynamic size classes based on room member count:
            // Under 13 members: All avatars are BIG!
            // 13 members and above: standard size.
            const sizeClasses = isUnder13
              ? isElite
                ? 'w-32 h-32 sm:w-36 sm:h-36 p-1.5'
                : isPro
                ? 'w-28 h-28 sm:w-32 sm:h-32 p-1.5'
                : 'w-24 h-24 sm:w-28 sm:h-28 p-1'
              : isElite
                ? 'w-24 h-24 p-1.5'
                : isPro
                ? 'w-20 h-20 p-1.5'
                : 'w-16 h-16 p-1';

            const shadowSize = isUnder13
              ? isElite
                ? 'w-28 sm:w-32 h-5'
                : isPro
                ? 'w-24 sm:w-28 h-4.5'
                : 'w-20 sm:w-24 h-4'
              : isElite
                ? 'w-22 h-4'
                : isPro
                ? 'w-18 h-3.5'
                : 'w-14 h-3';

            const borderGradient = isElite
              ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shadow-pink-500/40 shadow-xl'
              : isPro
              ? 'bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 shadow-amber-400/40 shadow-lg'
              : 'bg-white shadow-md';

            return (
              <div
                key={member.userId}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedProfile(member);
                }}
                style={{
                  left: `${member.x}%`,
                  top: `${member.y}%`,
                  transform: 'translate(-50%, -50%)',
                  transition: 'left 1.4s cubic-bezier(0.25, 1, 0.5, 1), top 1.4s cubic-bezier(0.25, 1, 0.5, 1)',
                }}
                className={`absolute flex flex-col items-center group cursor-pointer ${
                  member.isSelf ? 'z-20' : 'z-10'
                }`}
              >
                {/* Scaled Avatar Ground Shadow (No borders) */}
                <div
                  className={`${shadowSize} rounded-full bg-black/35 blur-[3px] absolute -bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none transition-all duration-300`}
                />

                {/* Avatar Container: Square avatar (aspect-square, rounded-2xl outer, rounded-xl inner, NO CIRCLES) */}
                <div className="relative">
                  <div
                    className={`${sizeClasses} ${borderGradient} rounded-2xl aspect-square overflow-hidden transition-all duration-300 group-hover:scale-105`}
                  >
                    <img
                      src={member.photoUrl}
                      alt={member.displayName}
                      className="w-full h-full object-cover rounded-xl aspect-square bg-slate-100"
                    />
                  </div>

                  {/* VIP Badge */}
                  {member.vipTier && (
                    <div
                      className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-md shadow-md text-[9px] font-black uppercase ${
                        isElite ? 'bg-pink-500 text-white' : 'bg-amber-400 text-zinc-950'
                      }`}
                    >
                      {member.vipTier}
                    </div>
                  )}

                  {/* Self Tag Badge */}
                  {member.isSelf && (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-wider shadow-md">
                      You
                    </div>
                  )}
                </div>

                {/* Name Label with Clean Frosted Light styling - Borderless */}
                <div className="mt-2 text-center pointer-events-none">
                  <span
                    className={`text-[11px] font-black px-2.5 py-0.5 rounded-xl bg-white/95 backdrop-blur-md shadow-md ${
                      isElite
                        ? 'text-pink-600 font-black'
                        : isPro
                        ? 'text-amber-700 font-black'
                        : 'text-slate-800'
                    }`}
                  >
                    {member.displayName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Member Profile Popup Modal (when user taps an avatar) */}
      <ProfilePopupModal
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        targetUser={selectedProfile}
        onOpenDm={onOpenDm}
      />

      {/* Change Avatar Modal */}
      <ChangeAvatarModal
        isOpen={changeAvatarModalOpen}
        onClose={() => setChangeAvatarModalOpen(false)}
      />
    </div>
  );
}
