import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { GIFTS_CATALOG } from '../utils/storage';
import { Gift } from '../types';
import { X, Gift as GiftIcon, Coins, Sparkles, AlertCircle } from 'lucide-react';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: { id: string; name: string; photoUrl: string };
}

export default function GiftModal({ isOpen, onClose, targetUser }: GiftModalProps) {
  const { user, sendGiftToUser } = useAuth();
  const [selectedGift, setSelectedGift] = useState<Gift>(GIFTS_CATALOG[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [sentSuccess, setSentSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSend = () => {
    setErrorMsg(null);
    if (user.coins < selectedGift.price) {
      setErrorMsg(`You need ${selectedGift.price} coins (you have ${user.coins})`);
      return;
    }
    const success = sendGiftToUser(selectedGift, targetUser.name);
    if (success) {
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#130f24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/40 to-pink-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <GiftIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Send Gift</h3>
              <p className="text-xs text-zinc-400">Gifting {targetUser.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Gift Grid */}
        <div className="p-4 sm:p-5 space-y-4">
          {sentSuccess ? (
            <div className="py-8 text-center space-y-3">
              <div className="text-6xl animate-bounce">{selectedGift.icon}</div>
              <h4 className="font-extrabold text-lg text-white">Gift Sent!</h4>
              <p className="text-xs text-zinc-400">
                You sent a {selectedGift.name} to {targetUser.name}!
              </p>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2.5">
                {GIFTS_CATALOG.map((gift) => {
                  const isSelected = selectedGift.id === gift.id;
                  const canAfford = user.coins >= gift.price;
                  return (
                    <button
                      key={gift.id}
                      onClick={() => {
                        setSelectedGift(gift);
                        setErrorMsg(null);
                      }}
                      className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                        isSelected
                          ? 'bg-purple-950/50 border-purple-400 shadow-md shadow-purple-500/30 scale-105'
                          : 'bg-zinc-900/80 border-white/5 hover:border-white/20'
                      } ${!canAfford ? 'opacity-60' : ''}`}
                    >
                      <span className="text-2xl sm:text-3xl">{gift.icon}</span>
                      <span className="text-[11px] font-bold text-white line-clamp-1">{gift.name}</span>
                      <div className="flex items-center gap-1 text-[10px] font-extrabold text-amber-400">
                        <Coins className="w-3 h-3 text-amber-400 fill-amber-400" />
                        <span>{gift.price}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Gift Preview */}
              <div className="p-3.5 rounded-xl bg-zinc-900/90 border border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedGift.icon}</span>
                  <div>
                    <h4 className="font-extrabold text-sm text-white">{selectedGift.name}</h4>
                    <p className="text-[11px] text-zinc-400">{selectedGift.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-zinc-400 block">Price</span>
                  <div className="flex items-center gap-1 text-sm font-extrabold text-amber-400">
                    <Coins className="w-3.5 h-3.5 fill-amber-400" />
                    <span>{selectedGift.price}</span>
                  </div>
                </div>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 text-white font-extrabold text-sm hover:brightness-110 shadow-lg shadow-purple-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Send {selectedGift.name} ({selectedGift.price} Coins)</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
