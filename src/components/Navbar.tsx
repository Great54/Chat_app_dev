import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Coins, Bell, Volume2, VolumeX, Plus, Search, LogOut } from 'lucide-react';
import VipShopModal from './VipShopModal';
import NotificationsModal from './NotificationsModal';
import GlobalSearchModal from './GlobalSearchModal';

interface NavbarProps {
  onSelectRoom?: (roomId: string) => void;
  onSelectUser?: (user: any) => void;
  isLight?: boolean;
}

export default function Navbar({ onSelectRoom, onSelectUser, isLight = false }: NavbarProps) {
  const { user, addCoins, soundEnabled, toggleMute, notifications, logout } = useAuth();
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
      <header
        className={`sticky top-0 z-40 px-4 py-3 transition-colors duration-300 ${
          isLight
            ? 'bg-white/90 backdrop-blur-md shadow-xs text-slate-800'
            : 'bg-[#0c0c14]/90 backdrop-blur-md shadow-md text-white'
        }`}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-2xl overflow-hidden bg-gradient-to-tr from-purple-600 via-pink-600 to-amber-400 p-[2px] shadow-sm shadow-purple-500/20">
              <div
                className={`w-full h-full rounded-[14px] flex items-center justify-center ${
                  isLight ? 'bg-white' : 'bg-[#120f26]'
                }`}
              >
                <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 text-lg tracking-wider">
                  GV
                </span>
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1
                  className={`font-black text-base md:text-lg tracking-tight ${
                    isLight
                      ? 'bg-gradient-to-r from-purple-700 via-indigo-800 to-pink-600 bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-white via-purple-100 to-pink-200 bg-clip-text text-transparent'
                  }`}
                >
                  GenC Vibez
                </h1>
                <span
                  className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${
                    isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-500/20 text-purple-300'
                  }`}
                >
                  Web
                </span>
              </div>
              <p className={`text-[11px] hidden sm:block font-medium ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Room-based community & social arenas
              </p>
            </div>
          </div>

          {/* Right Actions - Clean & Smooth (No Hard Borders) */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* VIP Crown Button */}
            <button
              onClick={() => setVipModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold transition-all shadow-xs ${
                user.vipTier === 'elite'
                  ? 'bg-pink-500/15 text-pink-500 hover:bg-pink-500/25'
                  : user.vipTier === 'pro'
                  ? 'bg-amber-500/15 text-amber-600 hover:bg-amber-500/25'
                  : isLight
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700'
              }`}
              title="VIP Shop & Customization"
            >
              <Crown
                className={`w-4 h-4 ${
                  user.vipTier === 'elite'
                    ? 'text-pink-500 fill-pink-500'
                    : user.vipTier === 'pro'
                    ? 'text-amber-500 fill-amber-500'
                    : isLight
                    ? 'text-slate-400'
                    : 'text-zinc-400'
                }`}
              />
              <span className="hidden xs:inline">
                {user.vipTier === 'elite' ? 'VIP ELITE' : user.vipTier === 'pro' ? 'VIP PRO' : 'Get VIP'}
              </span>
            </button>

            {/* Coins Balance & Top Up */}
            <div
              className={`flex items-center rounded-2xl p-1 pl-3 gap-2 shadow-xs ${
                isLight ? 'bg-slate-100 text-slate-800' : 'bg-zinc-900/90 text-white'
              }`}
            >
              <div className="flex items-center gap-1 text-amber-500 font-black text-xs sm:text-sm">
                <Coins className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>{user.coins.toLocaleString()}</span>
              </div>
              <button
                onClick={handleTopUp}
                className="flex items-center gap-0.5 px-2 py-1 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 font-bold text-xs hover:from-amber-300 hover:to-amber-400 transition-all active:scale-95 shadow-xs"
                title="Top up 100 coins"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span className="hidden sm:inline">{topUpConfirm ? '+100!' : 'Top up'}</span>
              </button>
            </div>

            {/* Global Search Button */}
            <button
              onClick={() => setSearchModalOpen(true)}
              className={`p-2 sm:px-3 rounded-2xl transition-all flex items-center gap-1.5 shadow-xs ${
                isLight
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white'
              }`}
              title="Search rooms, members, games"
            >
              <Search className="w-4 h-4 text-purple-600" />
              <span className="hidden md:inline text-xs font-semibold">Search</span>
            </button>

            {/* Sound Toggle */}
            <button
              onClick={toggleMute}
              className={`p-2 rounded-2xl transition-all shadow-xs ${
                soundEnabled
                  ? 'bg-purple-100 text-purple-700'
                  : isLight
                  ? 'bg-slate-100 text-slate-400 hover:text-slate-700'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
              title={soundEnabled ? 'Mute synthesized sound effects' : 'Enable synthesized sound effects'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Notifications Bell */}
            <button
              onClick={() => setNotificationsOpen(true)}
              className={`relative p-2 rounded-2xl transition-all shadow-xs ${
                isLight
                  ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white'
              }`}
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-500 text-white font-extrabold text-[9px] flex items-center justify-center shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Profile & Log Out */}
            <div className="flex items-center gap-1.5 pl-1.5">
              <img
                src={user.photoUrl}
                alt={user.displayName}
                className="w-7 h-7 rounded-lg aspect-square object-cover bg-slate-200 shadow-xs shrink-0"
                title={`${user.displayName} (@${user.username})`}
              />
              <button
                onClick={logout}
                className={`p-1.5 rounded-xl transition-all shadow-xs ${
                  isLight
                    ? 'bg-slate-100 text-slate-500 hover:text-rose-600 hover:bg-rose-50'
                    : 'bg-zinc-900 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10'
                }`}
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
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
