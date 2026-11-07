import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Friend } from '../types';
import { Users, UserPlus, MessageSquare, Gift, Crown, Diamond, Search, Check, Send } from 'lucide-react';
import ProfilePopupModal from '../components/ProfilePopupModal';
import GiftModal from '../components/GiftModal';
import { playMessageSound } from '../utils/sound';

interface FriendsViewProps {
  initialDmUser?: { id: string; name: string } | null;
}

export default function FriendsView({ initialDmUser }: FriendsViewProps) {
  const { friends, addFriend, user } = useAuth();
  const [newFriendName, setNewFriendName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [giftingUser, setGiftingUser] = useState<any>(null);
  const [activeDm, setActiveDm] = useState<{ id: string; name: string } | null>(initialDmUser || null);
  const [dmText, setDmText] = useState('');
  const [dmHistory, setDmHistory] = useState<{ sender: 'me' | 'them'; text: string; time: string }[]>([
    { sender: 'them', text: 'Hey Alex! Ready for the next game tournament?', time: '10:15 AM' },
    { sender: 'me', text: 'Hey! Definitely, stacking up some coins right now.', time: '10:16 AM' },
  ]);

  const filteredFriends = friends.filter((f) =>
    f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;
    addFriend(newFriendName.trim());
    setNewFriendName('');
  };

  const handleSendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmText.trim()) return;
    const msg = dmText.trim();
    setDmText('');
    setDmHistory((prev) => [...prev, { sender: 'me', text: msg, time: 'Just now' }]);
    playMessageSound();

    setTimeout(() => {
      setDmHistory((prev) => [
        ...prev,
        { sender: 'them', text: `Sounds awesome! Let me know when you jump into World Vibez.`, time: 'Just now' },
      ]);
      playMessageSound();
    }, 1200);
  };

  return (
    <div className="space-y-6 pb-20 animate-fadeIn">
      {/* Top Header & Search */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-zinc-900/40 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-white">Friends & Social Circle</h2>
            <p className="text-xs text-zinc-400">Stay connected with your crew across all Vibez rooms</p>
          </div>

          {/* Add Friend Form */}
          <form onSubmit={handleAddFriend} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Add by username..."
              value={newFriendName}
              onChange={(e) => setNewFriendName(e.target.value)}
              className="px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400"
            />
            <button
              type="submit"
              disabled={!newFriendName.trim()}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold text-xs transition-all shadow-md shadow-purple-600/30 disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>

        {/* Filter Input */}
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search friends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-zinc-900/90 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400"
          />
        </div>
      </div>

      {/* Friends Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredFriends.map((friend) => (
          <div
            key={friend.id}
            className="p-4 rounded-2xl bg-[#120e24] border border-white/10 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-4 shadow-lg group"
          >
            <div className="flex items-start gap-3">
              {/* Avatar with status indicator */}
              <div
                onClick={() => setSelectedUser(friend)}
                className="relative cursor-pointer"
              >
                <div
                  className={`w-14 h-14 rounded-2xl p-0.5 overflow-hidden ${
                    friend.vipTier === 'elite'
                      ? 'bg-gradient-to-tr from-pink-500 to-purple-500'
                      : friend.vipTier === 'pro'
                      ? 'bg-gradient-to-tr from-amber-400 to-yellow-300'
                      : 'bg-zinc-800 border border-white/10'
                  }`}
                >
                  <img src={friend.photoUrl} alt={friend.displayName} className="w-full h-full object-cover rounded-xl" />
                </div>
                <div
                  className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-[#120e24] ${
                    friend.status === 'online' ? 'bg-emerald-400' : 'bg-zinc-600'
                  }`}
                  title={friend.status}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="font-extrabold text-sm text-white truncate">{friend.displayName}</h4>
                  {friend.vipTier && (
                    <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300">
                      {friend.vipTier}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-400">@{friend.username}</p>
                <div className="mt-1 text-[10px] font-semibold text-purple-300">Level {friend.level}</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <button
                onClick={() => setActiveDm({ id: friend.id, name: friend.displayName })}
                className="flex-1 py-1.5 px-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 border border-purple-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-purple-300" />
                <span>Message</span>
              </button>

              <button
                onClick={() => setGiftingUser(friend)}
                className="p-1.5 rounded-xl bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 transition-colors"
                title="Send Gift"
              >
                <Gift className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Direct Message Overlay / Sheet */}
      {activeDm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#120e24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col h-[480px]">
            {/* DM Header */}
            <div className="p-3.5 border-b border-white/10 bg-zinc-900/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl overflow-hidden bg-purple-500/20 border border-purple-400/40">
                  <img
                    src="/public/avatars/default-2-corgi.png"
                    alt={activeDm.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h4 className="font-extrabold text-xs sm:text-sm text-white">{activeDm.name}</h4>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Online
                  </span>
                </div>
              </div>
              <button
                onClick={() => setActiveDm(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* DM Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {dmHistory.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.sender === 'me' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-2.5 rounded-2xl text-xs leading-relaxed ${
                      m.sender === 'me'
                        ? 'bg-purple-600 text-white rounded-tr-none'
                        : 'bg-zinc-900 border border-white/10 text-zinc-200 rounded-tl-none'
                    }`}
                  >
                    {m.text}
                  </div>
                  <span className="text-[9px] text-zinc-500 mt-1 px-1">{m.time}</span>
                </div>
              ))}
            </div>

            {/* DM Input */}
            <form onSubmit={handleSendDm} className="p-3 border-t border-white/10 bg-zinc-900/80 flex items-center gap-2">
              <input
                type="text"
                placeholder={`Message ${activeDm.name}...`}
                value={dmText}
                onChange={(e) => setDmText(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400"
              />
              <button
                type="submit"
                disabled={!dmText.trim()}
                className="p-2.5 rounded-xl bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modals */}
      <ProfilePopupModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        targetUser={selectedUser}
      />

      {giftingUser && (
        <GiftModal
          isOpen={!!giftingUser}
          onClose={() => setGiftingUser(null)}
          targetUser={{ id: giftingUser.id, name: giftingUser.displayName, photoUrl: giftingUser.photoUrl }}
        />
      )}
    </div>
  );
}
