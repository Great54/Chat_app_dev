import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomMember, Message } from '../types';
import { INITIAL_ROOMS, INITIAL_MEMBERS, INITIAL_MESSAGES } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { playMessageSound, playNotificationSound } from '../utils/sound';
import {
  ArrowLeft,
  Users,
  Dices,
  Trophy,
  Send,
  Sparkles,
  Crown,
  Diamond,
  Star,
  Info,
  Gift,
  Plus,
  Search,
  X,
  MessageSquare,
  FileText,
  MousePointerClick,
} from 'lucide-react';
import GamePanel from '../components/GamePanel';
import TournamentModal from '../components/TournamentModal';
import ProfilePopupModal from '../components/ProfilePopupModal';
import BoardPostsSection from '../components/BoardPostsSection';

interface RoomDetailViewProps {
  roomId: string;
  onBack: () => void;
  onOpenDm?: (user: { id: string; name: string }) => void;
}

export default function RoomDetailView({ roomId, onBack, onOpenDm }: RoomDetailViewProps) {
  const { user, addXp, addCoins, posts } = useAuth();
  const room = INITIAL_ROOMS.find((r) => r.id === roomId) || INITIAL_ROOMS[0];

  const [activeTab, setActiveTab] = useState<'chat' | 'posts'>('chat');
  const roomPostsCount = posts.filter((p) => p.roomId === roomId).length;

  const [members, setMembers] = useState<RoomMember[]>(() => {
    const list = INITIAL_MEMBERS[roomId] || INITIAL_MEMBERS['room-world'];
    // Insert user into members canvas
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
        x: 50,
        y: 50,
        isSelf: true,
      },
      ...list,
    ];
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    return INITIAL_MESSAGES[roomId] || INITIAL_MESSAGES['room-world'];
  });

  const [inputText, setInputText] = useState('');
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);
  const [gamePanelOpen, setGamePanelOpen] = useState(false);
  const [tournamentOpen, setTournamentOpen] = useState(false);
  const [targetBeacon, setTargetBeacon] = useState<{ x: number; y: number } | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [dragging, setDragging] = useState(false);
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

  // Auto-scroll chat on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle canvas click to move self avatar slowly and smoothly
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.min(90, Math.max(10, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(85, Math.max(15, ((e.clientY - rect.top) / rect.height) * 100));

    // Set waypoint beacon and moving status
    setTargetBeacon({ x, y });
    setIsMoving(true);
    setTimeout(() => {
      setTargetBeacon(null);
      setIsMoving(false);
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
    addXp(1); // 1 XP per message

    // Random response after 1.5s
    setTimeout(() => {
      const otherMembers = members.filter((m) => !m.isSelf);
      if (otherMembers.length === 0) return;
      const responder = otherMembers[Math.floor(Math.random() * otherMembers.length)];

      const replies = [
        `Totally agree with you @${user.displayName}! 🙌`,
        `Nice vibe! Who wants to play Higher Card next?`,
        `Welcome to ${room.roomName}! ✨`,
        `Let's go for the tournament pot! 🏆`,
        `Big energy today! Loving these vibez.`,
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
    <div className="flex flex-col space-y-3 pb-24 animate-room-enter">
      {/* Header Bar - Compact, Short, Dynamic display without unwanted spacing */}
      <div className="p-2 sm:p-2.5 bg-zinc-900/60 rounded-xl flex items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-white transition-colors shrink-0"
            title="Return to Rooms"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-sm sm:text-base text-white truncate">{room.roomName}</h2>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 shrink-0">
                {room.roomCategory}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
              <span className="flex items-center gap-1 text-[10px]">
                <Users className="w-3 h-3 text-purple-400" />
                {members.length}/{room.maxCapacity}
              </span>
              <span>•</span>
              <span className="text-zinc-500 text-[10px] truncate">Tap canvas to move</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setGamePanelOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-purple-600/30 text-purple-200 text-[11px] font-bold hover:bg-purple-600/50 transition-colors flex items-center gap-1 shadow-sm"
          >
            <Dices className="w-3.5 h-3.5 text-purple-300" />
            <span>Games</span>
          </button>

          <button
            onClick={() => setTournamentOpen(true)}
            className="px-2.5 py-1 rounded-lg bg-amber-500 text-zinc-950 text-[11px] font-black hover:bg-amber-400 transition-colors flex items-center gap-1 shadow-sm"
          >
            <Trophy className="w-3.5 h-3.5 fill-current" />
            <span>Tourney</span>
          </button>
        </div>
      </div>

      {/* Upper Area: Big Chat & Board Posts (Dynamic Display Without Borders) */}
      <div className="flex flex-col rounded-2xl overflow-hidden bg-gradient-to-b from-[#110d22]/90 to-[#0a0718]/95 shadow-xl">
        {/* Navigation Tabs for Chat vs Posts */}
        <div className="p-2 sm:p-2.5 bg-black/40 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'chat'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>💬 Room Chat</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-200 font-bold">
                msg
              </span>
            </button>

            <button
              onClick={() => setActiveTab('posts')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                activeTab === 'posts'
                  ? 'bg-pink-600 text-white shadow-md shadow-pink-600/40'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <FileText className="w-4 h-4 text-pink-300" />
              <span>📌 Room Posts</span>
              <span className="text-[10px] px-2 py-0.2 rounded-full bg-pink-500/30 text-white font-black">
                {roomPostsCount}
              </span>
            </button>
          </div>

          {activeTab === 'chat' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setChatSearchOpen(!chatSearchOpen);
                  if (chatSearchOpen) setChatSearchQuery('');
                }}
                className={`p-1.5 rounded-lg transition-colors ${
                  chatSearchOpen || chatSearchQuery
                    ? 'bg-purple-600/30 text-purple-300'
                    : 'bg-white/5 text-zinc-400 hover:text-white'
                }`}
                title="Search messages in this room"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] text-zinc-400 hidden sm:inline">{filteredMessages.length} msgs</span>
            </div>
          )}
        </div>

        {/* Tab 1: Room Chat View (Generous Big Height) */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[480px] sm:h-[540px]">
            {/* In-Room Chat Search Bar */}
            {chatSearchOpen && (
              <div className="p-2 bg-zinc-950/90 flex items-center gap-2 animate-fadeIn">
                <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0 ml-1" />
                <input
                  type="text"
                  placeholder="Search messages by sender or keyword..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  className="flex-1 bg-transparent text-xs text-white placeholder:text-zinc-500 focus:outline-none"
                  autoFocus
                />
                {chatSearchQuery && (
                  <button
                    onClick={() => setChatSearchQuery('')}
                    className="p-1 text-zinc-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {filteredMessages.length === 0 ? (
                <div className="py-8 text-center text-xs text-zinc-500">
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
                        className="w-8 h-8 rounded-xl object-cover bg-zinc-800 shrink-0"
                      />
                      <div className={`max-w-[78%] ${isMine ? 'text-right' : ''}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[11px] font-bold ${isMine ? 'text-purple-300' : 'text-zinc-300'}`}>
                            {msg.senderName}
                          </span>
                          {msg.senderVipTier && (
                            <span className="text-[9px] uppercase font-bold text-amber-400">
                              {msg.senderVipTier}
                            </span>
                          )}
                          <span className="text-[9px] text-zinc-500">{msg.createdAt}</span>
                        </div>
                        <div
                          className={`p-2.5 rounded-2xl text-xs leading-relaxed ${
                            isMine
                              ? 'bg-purple-600 text-white rounded-tr-none shadow-md'
                              : 'bg-zinc-900/90 text-zinc-200 rounded-tl-none'
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

            {/* Chat Input Bar - Borderless Dynamic Display */}
            <form onSubmit={handleSendMessage} className="p-2.5 sm:p-3 bg-black/40 backdrop-blur-md flex items-center gap-2">
              <input
                type="text"
                placeholder={`Send message to #${room.roomName}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400/70 transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:hover:brightness-100 flex items-center gap-1.5 font-bold text-xs"
                title="Send"
              >
                <Send className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Send</span>
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Room Board / Posts View */}
        {activeTab === 'posts' && (
          <div className="p-3 sm:p-4 min-h-[480px] max-h-[640px] overflow-y-auto">
            <BoardPostsSection roomId={roomId} roomName={room.roomName} />
          </div>
        )}
      </div>

      {/* Bottom Area: Big Interactive Avatar Canvas (Dynamic Display Without Borders) */}
      <div className="rounded-2xl overflow-hidden bg-gradient-to-b from-[#0b081a] to-[#04020c] shadow-xl flex flex-col">
        {/* Canvas Header */}
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-black/40 backdrop-blur-md flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
              <span>🎭 Room Avatars & Mascots</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                {members.length}/{room.maxCapacity} active
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
            <MousePointerClick className="w-3.5 h-3.5 text-purple-400" />
            <span className="hidden sm:inline">Tap canvas to move your mascot gently</span>
            <span className="sm:hidden">Tap to move mascot</span>
          </div>
        </div>

        {/* Big Canvas Surface */}
        <div
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="h-[420px] sm:h-[480px] lg:h-[540px] w-full relative overflow-hidden cursor-crosshair select-none"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.12) 0%, rgba(12, 10, 24, 0.98) 100%)`,
          }}
        >
          {/* Subtle grid background */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(#8b5cf6 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Target Waypoint Beacon when user taps canvas */}
          {targetBeacon && (
            <div
              style={{
                left: `${targetBeacon.x}%`,
                top: `${targetBeacon.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute pointer-events-none z-10 flex items-center justify-center"
            >
              <div className="w-9 h-9 rounded-full border-2 border-purple-400 bg-purple-500/20 animate-ping" />
              <div className="absolute w-3 h-3 rounded-full bg-purple-400 shadow-lg shadow-purple-500 ring-2 ring-white/60" />
            </div>
          )}

          {/* Hint Overlay */}
          <div className="absolute top-2 left-2 pointer-events-none px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md border border-white/10 text-[10px] text-zinc-300 flex items-center gap-1.5 z-10 shadow">
            <Info className="w-3 h-3 text-purple-400" />
            <span>Tap canvas to move mascot gently • Tap avatar to inspect or like</span>
          </div>

          {/* Member Avatars */}
          {members.map((member) => {
            const isElite = member.vipTier === 'elite';
            const isPro = member.vipTier === 'pro';

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
                {/* Aura Ring / Halo */}
                <div className="relative">
                  <div
                    className={`rounded-2xl p-1 transition-transform group-hover:scale-110 ${
                      isElite
                        ? 'w-14 h-14 bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shadow-lg shadow-pink-500/40 animate-pulse-glow'
                        : isPro
                        ? 'w-12 h-12 bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 shadow-md shadow-amber-400/30'
                        : 'w-11 h-11 bg-zinc-800 border-2 border-white/20'
                    }`}
                  >
                    <img
                      src={member.photoUrl}
                      alt={member.displayName}
                      className="w-full h-full object-cover rounded-xl bg-zinc-950"
                    />
                  </div>

                  {/* VIP Icon Badge */}
                  {member.vipTier && (
                    <div
                      className={`absolute -top-1 -right-1 p-0.5 rounded-md border shadow-md ${
                        isElite ? 'bg-pink-500 text-white' : 'bg-amber-400 text-zinc-950'
                      }`}
                    >
                      {isElite ? <Diamond className="w-3 h-3 fill-current" /> : <Crown className="w-3 h-3 fill-current" />}
                    </div>
                  )}

                  {/* Self Tag Badge */}
                  {member.isSelf && (
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded-full bg-purple-600 text-white text-[8px] font-black uppercase tracking-wider shadow">
                      You
                    </div>
                  )}
                </div>

                {/* Name & Level label */}
                <div className="mt-1 text-center pointer-events-none">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 ${
                      isElite
                        ? 'text-pink-300 font-extrabold'
                        : isPro
                        ? 'text-amber-300 font-extrabold'
                        : 'text-zinc-200'
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

      {/* Interactive Modals */}
      <GamePanel
        isOpen={gamePanelOpen}
        onClose={() => setGamePanelOpen(false)}
        roomId={roomId}
      />

      <TournamentModal
        isOpen={tournamentOpen}
        onClose={() => setTournamentOpen(false)}
        roomId={roomId}
      />

      <ProfilePopupModal
        isOpen={!!selectedProfile}
        onClose={() => setSelectedProfile(null)}
        targetUser={selectedProfile}
        onOpenDm={onOpenDm}
      />
    </div>
  );
}
