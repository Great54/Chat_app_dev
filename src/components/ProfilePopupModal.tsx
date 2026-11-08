import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Crown, Star, Diamond, Shield, Heart, UserPlus, Ban, Flag, Gift as GiftIcon, MessageSquare, Camera } from 'lucide-react';
import GiftModal from './GiftModal';
import ChangeAvatarModal from './ChangeAvatarModal';

interface ProfilePopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: {
    id: string;
    username: string;
    displayName: string;
    photoUrl: string;
    level: number;
    vipTier?: 'pro' | 'elite' | null;
    bio?: string;
  } | null;
  onOpenDm?: (user: { id: string; name: string }) => void;
}

export default function ProfilePopupModal({ isOpen, onClose, targetUser, onOpenDm }: ProfilePopupModalProps) {
  const { user, friends, addFriend, removeFriend, likeUserProfile } = useAuth();
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [avatarModalOpen, setAvatarModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hasLiked, setHasLiked] = useState(false);

  if (!isOpen || !targetUser) return null;

  const isSelf = targetUser.id === user.id;
  const isFriend = friends.some((f) => f.id === targetUser.id);

  const handleLikeProfile = () => {
    likeUserProfile(targetUser.id, targetUser.displayName);
    setHasLiked(true);
    setFeedback(`You liked ${targetUser.displayName}'s profile! ❤️`);
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleFriendAction = () => {
    if (isFriend) {
      removeFriend(targetUser.id);
      setFeedback('Removed from friends');
    } else {
      addFriend(targetUser.displayName);
      setFeedback('Friend added!');
    }
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleReport = () => {
    setFeedback('Report submitted. Thank you for keeping GenC safe.');
    setTimeout(() => setFeedback(null), 2500);
  };

  const handleBlock = () => {
    if (isFriend) removeFriend(targetUser.id);
    setFeedback('User blocked.');
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 1500);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
        <div className="bg-[#120e24] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
          {/* Top Banner */}
          <div className="h-24 bg-gradient-to-r from-purple-800 via-indigo-900 to-pink-900 relative">
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-zinc-300 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Profile Card Info */}
          <div className="px-5 pb-5 -mt-12 text-center flex flex-col items-center">
            {/* Avatar with VIP frame - Square Avatar */}
            <div className="relative mb-3">
              <div
                className={`w-24 h-24 rounded-xl overflow-hidden p-1 shadow-xl aspect-square ${
                  targetUser.vipTier === 'elite'
                    ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400'
                    : targetUser.vipTier === 'pro'
                    ? 'bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300'
                    : 'bg-zinc-800 shadow-md'
                }`}
              >
                <img
                  src={isSelf ? user.photoUrl : targetUser.photoUrl}
                  alt={targetUser.displayName}
                  className="w-full h-full object-cover rounded-lg bg-zinc-900 aspect-square"
                />
              </div>

              {/* VIP Icon Badge */}
              {targetUser.vipTier && (
                <div
                  className={`absolute -top-2 -right-2 p-1.5 rounded-lg border shadow-lg ${
                    targetUser.vipTier === 'elite'
                      ? 'bg-pink-500 border-white/40 text-white'
                      : 'bg-amber-400 border-white/40 text-zinc-950'
                  }`}
                >
                  {targetUser.vipTier === 'elite' ? (
                    <Diamond className="w-4 h-4 fill-current" />
                  ) : (
                    <Crown className="w-4 h-4 fill-current" />
                  )}
                </div>
              )}
            </div>

            {/* Change Profile Picture Button when viewing self */}
            {isSelf && (
              <button
                type="button"
                onClick={() => setAvatarModalOpen(true)}
                className="mb-2 text-xs font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-500/15 border border-teal-500/30 hover:bg-teal-500/25 transition-all shadow-xs"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Change Profile Picture</span>
              </button>
            )}

            {/* Names & VIP Chip */}
            <div className="flex items-center gap-1.5 justify-center">
              <h3 className="font-extrabold text-lg text-white">{isSelf ? user.displayName : targetUser.displayName}</h3>
              {targetUser.vipTier && (
                <span
                  className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded uppercase ${
                    targetUser.vipTier === 'elite'
                      ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  {targetUser.vipTier === 'elite' ? 'ELITE' : 'PRO'}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">@{targetUser.username}</p>

            {/* Level Pill */}
            <div className="mt-2.5 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
              <span>Level {targetUser.level}</span>
            </div>

            {/* Bio */}
            <p className="text-xs text-zinc-300 mt-3 px-2 line-clamp-3 italic">
              {targetUser.bio || 'Living the vibez life. Ready to game & chat! ✨'}
            </p>

            {feedback && (
              <div className="mt-3 w-full py-1.5 px-3 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-semibold animate-pulse">
                {feedback}
              </div>
            )}

            {/* Action Buttons */}
            {!isSelf && (
              <div className="mt-5 w-full space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={handleLikeProfile}
                    className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 border transition-all ${
                      hasLiked
                        ? 'bg-pink-600/30 border-pink-500 text-pink-300'
                        : 'bg-zinc-800 border-white/10 text-pink-300 hover:bg-pink-950/40 hover:border-pink-500/50'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${hasLiked ? 'fill-pink-400 text-pink-400' : ''}`} />
                    <span>{hasLiked ? 'Liked' : 'Like'}</span>
                  </button>

                  <button
                    onClick={handleFriendAction}
                    className={`py-2 px-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1 border transition-all ${
                      isFriend
                        ? 'bg-zinc-800 border-white/10 text-zinc-300 hover:border-red-500/30 hover:text-red-300'
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 border-purple-400/40 text-white shadow-md shadow-purple-600/20'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{isFriend ? 'Friends' : 'Add'}</span>
                  </button>

                  <button
                    onClick={() => setGiftModalOpen(true)}
                    className="py-2 px-2 rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 border border-pink-400/30 text-white font-extrabold text-xs flex items-center justify-center gap-1 shadow-md shadow-pink-500/20 hover:brightness-110 transition-all"
                  >
                    <GiftIcon className="w-3.5 h-3.5" />
                    <span>Gift</span>
                  </button>
                </div>

                {onOpenDm && (
                  <button
                    onClick={() => {
                      onOpenDm({ id: targetUser.id, name: targetUser.displayName });
                      onClose();
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-zinc-900 border border-white/10 hover:border-purple-500/40 text-zinc-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                    <span>Send Direct Message</span>
                  </button>
                )}

                <div className="flex items-center justify-center gap-4 pt-2 text-[11px] text-zinc-500">
                  <button onClick={handleBlock} className="hover:text-red-400 transition-colors flex items-center gap-1">
                    <Ban className="w-3 h-3" /> Block
                  </button>
                  <span>•</span>
                  <button onClick={handleReport} className="hover:text-amber-400 transition-colors flex items-center gap-1">
                    <Flag className="w-3 h-3" /> Report
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <GiftModal
        isOpen={giftModalOpen}
        onClose={() => setGiftModalOpen(false)}
        targetUser={{ id: targetUser.id, name: targetUser.displayName, photoUrl: targetUser.photoUrl }}
      />

      <ChangeAvatarModal
        isOpen={avatarModalOpen}
        onClose={() => setAvatarModalOpen(false)}
      />
    </>
  );
}
