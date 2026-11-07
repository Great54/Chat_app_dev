import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Coins, Bell, Volume2, VolumeX, Sparkles, Plus, Search } from 'lucide-react';
import VipShopModal from './VipShopModal';
import NotificationsModal from './NotificationsModal';
import GlobalSearchModal from './GlobalSearchModal';

interface NavbarProps {
  onSelectRoom?: (roomId: string) => void;
  onSelectUser?: (user: any) => void;
}

export default function Navbar({ onSelectRoom, onSelectUser }: NavbarProps) {
  const { user, addCoins, soundEnabled, toggleMute, notifications } = useAuth();
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [topUpConfirm, setTopUpConfirm] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleTopUp = () => {
    addCoins(100, 'Free Dev Coins Top-up');
    setTopUpConfirm(true);
    setTimeout(() => setTopUpConfirm(false), 2000);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-[#0c0c14]/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-400 p-[2px] shadow-lg shadow-purple-500/20">
              <div className="w-full h-full bg-[#120f26] rounded-[10px] flex items-center justify-center">
                <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 text-lg tracking-wider">
                  GV
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-extrabold text-base md:text-lg tracking-tight bg-gradient-to-r from-white via-purple-100 to-pink-200 bg-clip-text text-transparent">
                  GenC Vibez
                </h1>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Web
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 hidden sm:block">Room-based community & social gaming</p>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* VIP Crown Button */}
            <button
              onClick={() => setVipModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                user.vipTier === 'elite'
                  ? 'bg-pink-500/15 border-pink-500/60 text-pink-300 shadow-sm shadow-pink-500/30 hover:bg-pink-500/25'
                  : user.vipTier === 'pro'
                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm shadow-amber-500/30 hover:bg-amber-500/25'
                  : 'bg-zinc-800/80 border-white/10 text-zinc-300 hover:border-purple-500/40 hover:text-white'
              }`}
              title="VIP Shop & Customization"
            >
              <Crown
                className={`w-4 h-4 ${
                  user.vipTier === 'elite'
                    ? 'text-pink-400 fill-pink-400'
                    : user.vipTier === 'pro'
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-zinc-400'
                }`}
              />
              <span className="hidden xs:inline">
                {user.vipTier === 'elite' ? 'VIP ELITE' : user.vipTier === 'pro' ? 'VIP PRO' : 'Get VIP'}
              </span>
            </button>

            {/* Coins Balance & Top Up */}
            <div className="flex items-center bg-zinc-900/90 border border-amber-500/30 rounded-xl p-1 pl-2.5 gap-2 shadow-inner">
              <div className="flex items-center gap-1 text-amber-400 font-extrabold text-xs sm:text-sm">
                <Coins className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>{user.coins.toLocaleString()}</span>
              </div>
              <button
                onClick={handleTopUp}
                className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-bold text-xs hover:from-amber-300 hover:to-amber-400 transition-all active:scale-95 shadow-sm shadow-amber-500/30"
                title="Top up 100 coins"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden sm:inline">{topUpConfirm ? '+100!' : 'Top up'}</span>
              </button>
            </div>

            {/* Global Search Button */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className="p-2 sm:px-3 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:border-purple-500/40 transition-all flex items-center gap-1.5"
              title="Search rooms, members, games (Cmd+K)"
            >
              <Search className="w-4 h-4 text-purple-400" />
              <span className="hidden md:inline text-xs font-semibold text-zinc-400">Search</span>
              <kbd className="hidden lg:inline text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono border border-white/5">
                ⌘K
              </kbd>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-xl border transition-all ${
                soundEnabled
                  ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 hover:bg-purple-900/40'
                  : 'bg-zinc-900 border-white/10 text-zinc-500 hover:text-zinc-300'
              }`}
              title={soundEnabled ? 'Mute synthesized sound effects' : 'Enable synthesized sound effects'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative p-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:border-purple-500/40 transition-all"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white font-extrabold text-[9px] flex items-center justify-center shadow-lg shadow-pink-500/50">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Modals */}
      <VipShopModal isOpen={vipModalOpen} onClose={() => setVipModalOpen(false)} />
      <NotificationsModal isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
      <GlobalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        onSelectRoom={(id) => {
          if (onSelectRoom) onSelectRoom(id);
        }}
        onSelectUser={(u) => {
          if (onSelectUser) onSelectUser(u);
        }}
      />
    </>
  );
}
