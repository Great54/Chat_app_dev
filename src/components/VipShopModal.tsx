import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Crown, Star, Diamond, Sparkles, Check, X, Shield, Palette } from 'lucide-react';

interface VipShopModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function VipShopModal({ isOpen, onClose }: VipShopModalProps) {
  const { user, buyVip, customizeAura } = useAuth();
  const [selectedAuraType, setSelectedAuraType] = useState<any>(user.auraType || 'glow');
  const [selectedColor, setSelectedColor] = useState(user.auraColor || '#FFD700');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBuy = (tier: 'pro' | 'elite') => {
    setErrorMsg(null);
    const success = buyVip(tier);
    if (!success) {
      setErrorMsg(`Not enough coins! Need ${tier === 'elite' ? 250 : 100} coins.`);
    }
  };

  const handleSaveAura = () => {
    customizeAura(selectedAuraType, selectedColor);
  };

  const auraColors = ['#FFD700', '#FF6B9D', '#22D3EE', '#9D4EDD', '#10B981', '#EF4444'];
  const auraTypes: { id: any; label: string; desc: string }[] = [
    { id: 'glow', label: 'Neon Glow', desc: 'Soft radiant halo surrounding your avatar' },
    { id: 'sparkle', label: 'Cosmic Sparkles', desc: 'Twinkling particle aura for high energy' },
    { id: 'frame', label: 'Octagon Frame', desc: 'Cyberpunk geometric arena border' },
    { id: 'smoke', label: 'Nebula Mist', desc: 'Mystical ambient smoke pulsing around you' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#130f24] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/40 to-pink-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Crown className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="font-extrabold text-lg text-white">VIP Club & Customization</h2>
              <p className="text-xs text-zinc-400">Unlock auras, scale up avatar & stand out in rooms</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tier Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* VIP Pro */}
            <div
              className={`p-4 rounded-xl border relative flex flex-col justify-between transition-all ${
                user.vipTier === 'pro'
                  ? 'bg-amber-950/30 border-amber-400/80 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50'
                  : 'bg-zinc-900/80 border-white/10 hover:border-amber-500/40'
              }`}
            >
              {user.vipTier === 'pro' && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-amber-400 text-zinc-950 font-extrabold text-[10px] uppercase flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" /> Active
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                  <h3 className="font-extrabold text-base text-amber-300">VIP Pro</h3>
                </div>
                <div className="text-xs text-zinc-300 font-bold mb-3">100 Coins</div>
                <ul className="space-y-1.5 text-[11px] text-zinc-300">
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    +1.15× Avatar enlargement in room
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Gold crown & Star badge
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    Neon aura customization
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleBuy('pro')}
                disabled={user.vipTier === 'pro'}
                className={`mt-4 w-full py-2 rounded-xl text-xs font-extrabold transition-all ${
                  user.vipTier === 'pro'
                    ? 'bg-amber-500/20 text-amber-400 cursor-default'
                    : 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 hover:from-amber-300 hover:to-amber-400 shadow-md shadow-amber-500/20'
                }`}
              >
                {user.vipTier === 'pro' ? 'Purchased' : 'Upgrade (100 Coins)'}
              </button>
            </div>

            {/* VIP Elite */}
            <div
              className={`p-4 rounded-xl border relative flex flex-col justify-between transition-all ${
                user.vipTier === 'elite'
                  ? 'bg-pink-950/30 border-pink-400/80 shadow-md shadow-pink-500/20 ring-1 ring-pink-400/50'
                  : 'bg-zinc-900/80 border-white/10 hover:border-pink-500/40'
              }`}
            >
              {user.vipTier === 'elite' && (
                <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-pink-400 text-zinc-950 font-extrabold text-[10px] uppercase flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" /> Active
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Diamond className="w-5 h-5 text-pink-400 fill-pink-400" />
                  <h3 className="font-extrabold text-base text-pink-300">VIP Elite</h3>
                </div>
                <div className="text-xs text-zinc-300 font-bold mb-3">250 Coins</div>
                <ul className="space-y-1.5 text-[11px] text-zinc-300">
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    +1.35× Maximum avatar scale
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    Prismatic Diamond crown & badge
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    All aura styles & rainbow glow
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                    Priority table seat in Tournaments
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleBuy('elite')}
                disabled={user.vipTier === 'elite'}
                className={`mt-4 w-full py-2 rounded-xl text-xs font-extrabold transition-all ${
                  user.vipTier === 'elite'
                    ? 'bg-pink-500/20 text-pink-400 cursor-default'
                    : 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white hover:brightness-110 shadow-md shadow-pink-500/20'
                }`}
              >
                {user.vipTier === 'elite' ? 'Purchased' : 'Upgrade (250 Coins)'}
              </button>
            </div>
          </div>

          {/* Aura Customizer (Only for VIPs or preview) */}
          <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-purple-400" />
                <h4 className="font-bold text-sm text-white">Aura Styling</h4>
              </div>
              {!user.vipTier && (
                <span className="text-[10px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                  Requires VIP
                </span>
              )}
            </div>

            {/* Aura Types */}
            <div className="grid grid-cols-2 gap-2">
              {auraTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedAuraType(type.id)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selectedAuraType === type.id
                      ? 'bg-purple-950/40 border-purple-400 text-white shadow-sm shadow-purple-500/30'
                      : 'bg-zinc-950/60 border-white/5 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="font-extrabold text-xs text-white">{type.label}</div>
                  <div className="text-[10px] text-zinc-400 line-clamp-1">{type.desc}</div>
                </button>
              ))}
            </div>

            {/* Color Swatches */}
            <div>
              <span className="text-xs text-zinc-400 block mb-2 font-medium">Aura Color</span>
              <div className="flex items-center gap-3">
                {auraColors.map((col) => (
                  <button
                    key={col}
                    onClick={() => setSelectedColor(col)}
                    style={{ backgroundColor: col }}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      selectedColor === col ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleSaveAura}
              disabled={!user.vipTier}
              className={`w-full py-2 rounded-xl text-xs font-bold transition-all ${
                user.vipTier
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              Apply Aura
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
