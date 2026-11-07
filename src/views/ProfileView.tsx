import React, { useState } from 'react';
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
} from 'lucide-react';
import VipShopModal from '../components/VipShopModal';
import BoardPostsSection from '../components/BoardPostsSection';

export default function ProfileView() {
  const { user, updateProfile, addCoins, transactions, soundEnabled, toggleMute, posts } = useAuth();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState(user.displayName);
  const [bioInput, setBioInput] = useState(user.bio);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'avatars' | 'transactions'>('posts');

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
            {/* Avatar with VIP ring */}
            <div className="relative">
              <div
                className={`w-28 h-28 rounded-2xl p-1 shadow-2xl overflow-hidden ${
                  user.vipTier === 'elite'
                    ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400 shadow-pink-500/40 animate-pulse-glow'
                    : user.vipTier === 'pro'
                    ? 'bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300 shadow-amber-400/30'
                    : 'bg-zinc-800 border-2 border-white/10'
                }`}
              >
                <img
                  src={user.photoUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover rounded-xl bg-zinc-950"
                />
              </div>

              {user.vipTier && (
                <div
                  className={`absolute -top-2 -right-2 p-1.5 rounded-xl border shadow-lg ${
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
          <div className="flex items-center justify-center gap-2">
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
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => setActiveTab('posts')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
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
          onClick={() => setActiveTab('avatars')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
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
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
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

      {/* Tab 2: Choose Avatar 3-Pack */}
      {activeTab === 'avatars' && (
        <div className="p-5 rounded-2xl bg-[#120e24] border border-white/10 shadow-xl space-y-3 animate-fadeIn">
          <h3 className="font-extrabold text-sm text-white">Choose Avatar Mascot</h3>
          <p className="text-xs text-zinc-400">
            Pick any of the 3 illustrated default space mascots:
          </p>
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
                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-950 p-1">
                    <img src={av.url} alt={av.name} className="w-full h-full object-cover rounded-lg" />
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
    </div>
  );
}
