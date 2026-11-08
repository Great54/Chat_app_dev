import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  User,
  Crown,
  Diamond,
  Coins,
  Sparkles,
  Volume2,
  VolumeX,
  Edit3,
  History,
  Check,
  Plus,
  Shield,
  Palette,
  FileText,
  Users,
  UserPlus,
  MessageSquare,
  Gift,
  Search,
  Send,
  X,
  Trash2,
  LogOut,
  Camera,
  Upload,
} from 'lucide-react';
import VipShopModal from '../components/VipShopModal';
import BoardPostsSection from '../components/BoardPostsSection';
import ProfilePopupModal from '../components/ProfilePopupModal';
import GiftModal from '../components/GiftModal';
import ChangeAvatarModal from '../components/ChangeAvatarModal';
import { playMessageSound } from '../utils/sound';

interface ProfileViewProps {
  initialDmUser?: { id: string; name: string } | null;
  onClearDm?: () => void;
}

export default function ProfileView({ initialDmUser, onClearDm }: ProfileViewProps = {}) {
  const {
    user,
    updateProfile,
    addCoins,
    transactions,
    soundEnabled,
    toggleMute,
    posts,
    friends,
    addFriend,
    removeFriend,
    logout,
  } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user.displayName);
  const [bioInput, setBioInput] = useState(user.bio);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [changeAvatarOpen, setChangeAvatarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'friends' | 'avatars' | 'transactions'>(
    initialDmUser ? 'friends' : 'posts'
  );

  // Friends & DM state inside profile
  const [newFriendName, setNewFriendName] = useState('');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [giftingUser, setGiftingUser] = useState<any>(null);
  const [activeDm, setActiveDm] = useState<{ id: string; name: string } | null>(initialDmUser || null);
  const [dmText, setDmText] = useState('');
  const [dmHistory, setDmHistory] = useState<{ sender: 'me' | 'them'; text: string; time: string }[]>([
    { sender: 'them', text: 'Hey Alex! Ready for the next game tournament?', time: '10:15 AM' },
    { sender: 'me', text: 'Hey! Definitely, stacking up some coins right now.', time: '10:16 AM' },
  ]);

  useEffect(() => {
    if (initialDmUser) {
      setActiveTab('friends');
      setActiveDm(initialDmUser);
    }
  }, [initialDmUser]);

  const filteredFriends = friends.filter(
    (f) =>
      f.displayName.toLowerCase().includes(friendSearchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(friendSearchQuery.toLowerCase())
  );

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;
    addFriend(newFriendName.trim());
    setNewFriendName('');
  };

  const handleSendDm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dmText.trim() || !activeDm) return;
    const msg = dmText.trim();
    setDmText('');
    setDmHistory((prev) => [...prev, { sender: 'me', text: msg, time: 'Just now' }]);
    playMessageSound();

    setTimeout(() => {
      setDmHistory((prev) => [
        ...prev,
        {
          sender: 'them',
          text: `Awesome! Let's team up in the Gaming Arena or meet in the room.`,
          time: 'Just now',
        },
      ]);
      playMessageSound();
    }, 1200);
  };

  const myPostsCount = posts.filter((p) => p.authorId === user.id).length;

  const avatars = [
    { id: 'panda', name: 'Cute Panda', url: '/public/avatars/default-1-panda.png' },
    { id: 'corgi', name: 'Space Corgi', url: '/public/avatars/default-2-corgi.png' },
    { id: 'alien', name: 'Friendly Alien', url: '/public/avatars/default-3-alien.png' },
  ];

  const currentLevel = user.level;
  const currentXp = user.xp;
  const xpInCurrentLevel = currentXp % 100;
  const xpNeeded = 100 - xpInCurrentLevel;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      displayName: nameInput.trim() || user.displayName,
      bio: bioInput.trim() || user.bio,
    });
    setEditing(false);
  };

  return (
    <div className="space-y-6 pb-24 max-w-3xl mx-auto animate-fadeIn">
      {/* Top Profile Card */}
      <div className="relative rounded-2xl overflow-hidden bg-[#120e24] border border-white/10 shadow-2xl">
        {/* Banner Cover */}
        <div className="h-32 bg-gradient-to-r from-purple-800 via-indigo-900 to-pink-900 relative" />

        {/* User Info Bar */}
        <div className="px-6 pb-6 -mt-16 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-left">
            {/* Avatar with VIP ring - Square Avatar with Change Photo overlay */}
            <div className="relative group">
              <div
                onClick={() => setChangeAvatarOpen(true)}
                className={`w-28 h-28 rounded-xl p-1 shadow-2xl overflow-hidden aspect-square cursor-pointer transition-transform group-hover:scale-102 ${
                  user.vipTier === 'elite'
                    ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shadow-pink-500/40 animate-pulse-glow'
                    : user.vipTier === 'pro'
                    ? 'bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 shadow-amber-400/30'
                    : 'bg-zinc-800 shadow-md'
                }`}
                title="Click to change profile picture"
              >
                <img
                  src={user.photoUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover rounded-lg bg-zinc-950 aspect-square"
                />
              </div>

              {/* Camera Change Icon Overlay */}
              <button
                type="button"
                onClick={() => setChangeAvatarOpen(true)}
                className="absolute bottom-1 right-1 p-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 shadow-md transition-all group-hover:scale-110 flex items-center justify-center"
                title="Change Profile Picture"
              >
                <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>

              {user.vipTier && (
                <div
                  className={`absolute -top-2 -right-2 p-1.5 rounded-lg border shadow-lg ${
                    user.vipTier === 'elite'
                      ? 'bg-pink-500 border-white/40 text-white'
                      : 'bg-amber-400 border-white/40 text-zinc-950'
                  }`}
                >
                  {user.vipTier === 'elite' ? (
                    <Diamond className="w-4 h-4 fill-current" />
                  ) : (
                    <Crown className="w-4 h-4 fill-current" />
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white">{user.displayName}</h2>
                {user.vipTier && (
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      user.vipTier === 'elite'
                        ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    {user.vipTier === 'elite' ? 'VIP ELITE' : 'VIP PRO'}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">@{user.username}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setChangeAvatarOpen(true)}
              className="px-3 py-2 rounded-xl bg-teal-500/15 border border-teal-500/30 hover:bg-teal-500/25 text-teal-300 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Camera className="w-3.5 h-3.5 text-teal-400" />
              <span>Change Photo</span>
            </button>
            <button
              onClick={() => setEditing(!editing)}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 hover:border-purple-500/40 text-zinc-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-purple-400" />
              <span>{editing ? 'Cancel' : 'Edit Profile'}</span>
            </button>
            <button
              onClick={() => setVipModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-amber-400 transition-all"
            >
              <Crown className="w-3.5 h-3.5 fill-current" />
              <span>VIP Club</span>
            </button>
            <button
              onClick={logout}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 text-rose-300 text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Log out of GenC Vibez"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        {/* Bio text */}
        <div className="px-6 pb-6 pt-2 border-t border-white/5">
          {editing ? (
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 font-semibold block mb-1">Display Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 font-semibold block mb-1">Bio</label>
                <textarea
                  rows={3}
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:outline-none focus:border-purple-400"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
              >
                Save Changes
              </button>
            </form>
          ) : (
            <p className="text-xs text-zinc-300 leading-relaxed max-w-xl">
              {user.bio || 'Living the vibez life. Ready to game & chat! ✨'}
            </p>
          )}
        </div>
      </div>

      {/* Stats Grid: Level, Coins, Sound */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Level Progression */}
        <div className="p-4 rounded-2xl bg-[#120e24] border border-white/10 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Level Status</span>
            <span className="text-xs font-black text-purple-400">Level {currentLevel}</span>
          </div>
          <div className="text-lg font-black text-white">{currentXp} Total XP</div>
          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${xpInCurrentLevel}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-zinc-400">
              <span>{xpInCurrentLevel}/100 XP</span>
              <span>{xpNeeded} XP to Level {currentLevel + 1}</span>
            </div>
          </div>
        </div>

        {/* Coins Wallet */}
        <div className="p-4 rounded-2xl bg-[#120e24] border border-white/10 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Coin Balance</span>
            <Coins className="w-4 h-4 text-amber-400 fill-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 flex items-center gap-1.5">
            <span>{user.coins.toLocaleString()}</span>
            <span className="text-xs text-zinc-400 font-semibold">Coins</span>
          </div>
          <button
            onClick={() => addCoins(100, 'Free Dev Coins Top-up')}
            className="w-full py-1.5 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border border-amber-400/30 text-xs font-bold transition-colors flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Top up +100 Coins</span>
          </button>
        </div>

        {/* Synthesized Audio Settings */}
        <div className="p-4 rounded-2xl bg-[#120e24] border border-white/10 shadow-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Web Audio SFX</span>
            {soundEnabled ? <Volume2 className="w-4 h-4 text-purple-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
          </div>
          <div className="text-sm font-bold text-white">
            {soundEnabled ? 'Synthesized SFX On' : 'Muted'}
          </div>
          <button
            onClick={toggleMute}
            className={`w-full py-1.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-1.5 ${
              soundEnabled
                ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                : 'bg-zinc-800 border-white/10 text-zinc-400'
            }`}
          >
            <span>{soundEnabled ? 'Disable Sounds' : 'Enable Sounds'}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs for Profile Content */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'posts'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>My Board Posts</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-500/30 text-pink-200 font-black">
            {myPostsCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('friends')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'friends'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Friends & Crew</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/30 text-indigo-200 font-black">
            {friends.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('avatars')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'avatars'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Mascot Icons</span>
        </button>

        <button
          onClick={() => setActiveTab('transactions')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
            activeTab === 'transactions'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-zinc-900/60 text-zinc-400 hover:text-white border border-white/5'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Coin History</span>
          <span className="text-[10px] text-zinc-400">({transactions.length})</span>
        </button>
      </div>

      {/* Tab 1: User's Board Posts (can post, view, like, comment) */}
      {activeTab === 'posts' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400 px-1">
            <span>Posts you created from any room or from your profile appear here.</span>
          </div>
          <BoardPostsSection filterAuthorId={user.id} />
        </div>
      )}

      {/* Tab 2: Friends & Social Crew in Profile Section */}
      {activeTab === 'friends' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header & Add Friend Bar */}
          <div className="p-4 sm:p-5 rounded-2xl bg-[#120e24] border border-white/10 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>My Friends & Social Circle ({friends.length})</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Direct message, send coin gifts, and see who is online across rooms
                </p>
              </div>

              {/* Add Friend Form */}
              <form onSubmit={handleAddFriend} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Add friend by username..."
                  value={newFriendName}
                  onChange={(e) => setNewFriendName(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400"
                />
                <button
                  type="submit"
                  disabled={!newFriendName.trim()}
                  className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-extrabold text-xs transition-all shadow-md shadow-purple-600/30 disabled:opacity-40 flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </form>
            </div>

            {/* Filter Input */}
            <div className="relative max-w-sm">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search friends..."
                value={friendSearchQuery}
                onChange={(e) => setFriendSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-900/90 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Friends List Grid */}
          {filteredFriends.length === 0 ? (
            <div className="py-12 text-center rounded-2xl bg-white/[0.02] p-6 space-y-2">
              <Users className="w-8 h-8 text-zinc-600 mx-auto" />
              <h4 className="font-bold text-sm text-zinc-300">
                {friendSearchQuery ? 'No friends match your search' : 'No friends in your list yet'}
              </h4>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Add friends using their username or tap any member avatar in rooms to connect!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredFriends.map((friend) => (
                <div
                  key={friend.id}
                  className="p-3.5 rounded-2xl bg-[#120e24] border border-white/10 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-3 shadow-lg group"
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar with online status dot */}
                    <div
                      onClick={() => setSelectedUser(friend)}
                      className="relative cursor-pointer shrink-0"
                    >
                      <div
                        className={`w-12 h-12 rounded-xl p-0.5 overflow-hidden ${
                          friend.vipTier === 'elite'
                            ? 'bg-gradient-to-tr from-pink-500 to-purple-500'
                            : friend.vipTier === 'pro'
                            ? 'bg-gradient-to-tr from-amber-400 to-yellow-300'
                            : 'bg-zinc-800 border border-white/10'
                        }`}
                      >
                        <img
                          src={friend.photoUrl}
                          alt={friend.displayName}
                          className="w-full h-full object-cover rounded-[10px]"
                        />
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
                        <h4 className="font-extrabold text-sm text-white truncate group-hover:text-purple-300 transition-colors">
                          {friend.displayName}
                        </h4>
                        {friend.vipTier && (
                          <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 shrink-0">
                            {friend.vipTier}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate">@{friend.username}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px]">
                        <span className="text-purple-300 font-semibold">Level {friend.level}</span>
                        <span>•</span>
                        <span className={friend.status === 'online' ? 'text-emerald-400 font-bold' : 'text-zinc-500'}>
                          {friend.status === 'online' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
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
                      title="Send Coin Gift"
                    >
                      <Gift className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => removeFriend(friend.id)}
                      className="p-1.5 rounded-xl bg-white/[0.04] hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition-colors"
                      title="Remove Friend"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Choose Avatar 3-Pack */}
      {activeTab === 'avatars' && (
        <div className="p-5 rounded-2xl bg-[#120e24] border border-white/10 shadow-xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-sm text-white">Choose Avatar Mascot</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Pick a default mascot or upload your own square picture:
              </p>
            </div>
            <button
              type="button"
              onClick={() => setChangeAvatarOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 hover:bg-teal-500/25 text-teal-300 font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Custom Photo</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {avatars.map((av) => {
              const isSelected = user.photoUrl === av.url;
              return (
                <button
                  key={av.id}
                  onClick={() => updateProfile({ photoUrl: av.url })}
                  className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-purple-950/40 border-purple-400 shadow-md shadow-purple-500/30 scale-102 ring-1 ring-purple-400/60'
                      : 'bg-zinc-900/60 border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-950 p-1 aspect-square">
                    <img src={av.url} alt={av.name} className="w-full h-full object-cover rounded-lg aspect-square" />
                  </div>
                  <span className="text-xs font-bold text-white line-clamp-1">{av.name}</span>
                  {isSelected && (
                    <span className="text-[10px] font-black text-purple-300 flex items-center gap-1">
                      <Check className="w-3 h-3 stroke-[3]" /> Active
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-teal-400" />
              <span className="text-xs text-zinc-300">Want more avatars or device upload?</span>
            </div>
            <button
              type="button"
              onClick={() => setChangeAvatarOpen(true)}
              className="text-xs font-bold text-teal-400 hover:text-teal-300 underline"
            >
              Open Avatar Studio →
            </button>
          </div>
        </div>
      )}

      {/* Tab 3: Coin Transactions History */}
      {activeTab === 'transactions' && (
        <div className="p-5 rounded-2xl bg-[#120e24] border border-white/10 shadow-xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-purple-400" />
              <h3 className="font-extrabold text-sm text-white">Coin Transactions</h3>
            </div>
            <span className="text-[10px] text-zinc-400">{transactions.length} records</span>
          </div>

          <div className="divide-y divide-white/5 max-h-60 overflow-y-auto">
            {transactions.map((tx) => {
              const isPositive = tx.amount >= 0;
              return (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-zinc-200">{tx.description}</div>
                    <span className="text-[10px] text-zinc-500">{tx.createdAt}</span>
                  </div>
                  <div
                    className={`font-black flex items-center gap-1 ${
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5 fill-current" />
                    <span>
                      {isPositive ? `+${tx.amount}` : tx.amount}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <VipShopModal isOpen={vipModalOpen} onClose={() => setVipModalOpen(false)} />

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
                onClick={() => {
                  setActiveDm(null);
                  if (onClearDm) onClearDm();
                }}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
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

      {/* Inspect Profile Modal */}
      <ProfilePopupModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        targetUser={selectedUser}
      />

      {/* Gift Modal */}
      {giftingUser && (
        <GiftModal
          isOpen={!!giftingUser}
          onClose={() => setGiftingUser(null)}
          targetUser={{ id: giftingUser.id, name: giftingUser.displayName, photoUrl: giftingUser.photoUrl }}
        />
      )}

      {/* Change Avatar Modal */}
      <ChangeAvatarModal
        isOpen={changeAvatarOpen}
        onClose={() => setChangeAvatarOpen(false)}
      />
    </div>
  );
}
