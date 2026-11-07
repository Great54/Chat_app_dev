import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Bell, CheckCheck, Gift, Trophy, Sparkles, Heart, UserPlus, MessageSquare } from 'lucide-react';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationsModal({ isOpen, onClose }: NotificationsModalProps) {
  const { notifications, markNotificationsAsRead } = useAuth();
  const [filter, setFilter] = useState<'all' | 'likes' | 'friends'>('all');

  if (!isOpen) return null;

  const filtered = notifications.filter((n) => {
    if (filter === 'likes') return n.type === 'profile_like' || n.type === 'post_like';
    if (filter === 'friends') return n.type === 'friend_add' || n.type === 'friend';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#120e24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-purple-400" />
            <h3 className="font-extrabold text-base text-white">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={markNotificationsAsRead}
              className="text-xs text-purple-300 hover:text-purple-200 font-semibold flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 border border-purple-500/20"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-4 py-2 border-b border-white/5 flex gap-2 bg-zinc-950/40 text-xs">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-lg font-bold transition-all ${
              filter === 'all' ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('likes')}
            className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
              filter === 'likes' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Heart className="w-3 h-3 fill-pink-400 text-pink-400" />
            <span>Profile Likes</span>
          </button>
          <button
            onClick={() => setFilter('friends')}
            className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1 transition-all ${
              filter === 'friends' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <UserPlus className="w-3 h-3 text-indigo-300" />
            <span>Friend Adds</span>
          </button>
        </div>

        {/* List */}
        <div className="p-4 overflow-y-auto space-y-2.5">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No notifications in this tab.
            </div>
          ) : (
            filtered.map((notif) => {
              const isProfileLike = notif.type === 'profile_like';
              const isFriendAdd = notif.type === 'friend_add';

              return (
                <div
                  key={notif.id}
                  className={`p-3 rounded-xl border transition-all ${
                    notif.read
                      ? 'bg-zinc-900/40 border-white/5 opacity-80'
                      : isProfileLike
                      ? 'bg-pink-950/30 border-pink-500/40 shadow-sm shadow-pink-500/10'
                      : isFriendAdd
                      ? 'bg-indigo-950/30 border-indigo-500/40 shadow-sm shadow-indigo-500/10'
                      : 'bg-purple-950/30 border-purple-500/30 shadow-sm shadow-purple-500/10'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Actor Photo or Icon */}
                    {notif.actorPhoto ? (
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-800 border border-white/10">
                          <img src={notif.actorPhoto} alt={notif.actorName || 'User'} className="w-full h-full object-cover" />
                        </div>
                        <div
                          className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border border-black ${
                            isProfileLike
                              ? 'bg-pink-500 text-white'
                              : isFriendAdd
                              ? 'bg-indigo-500 text-white'
                              : 'bg-purple-500 text-white'
                          }`}
                        >
                          {isProfileLike ? (
                            <Heart className="w-2.5 h-2.5 fill-current" />
                          ) : isFriendAdd ? (
                            <UserPlus className="w-2.5 h-2.5" />
                          ) : (
                            <Sparkles className="w-2.5 h-2.5" />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 shrink-0 mt-0.5">
                        {notif.type === 'gift' ? (
                          <Gift className="w-4 h-4 text-pink-400" />
                        ) : notif.type === 'tournament' ? (
                          <Trophy className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Sparkles className="w-4 h-4 text-purple-400" />
                        )}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-extrabold text-xs text-white truncate">{notif.title}</h4>
                        <span className="text-[10px] text-zinc-500 shrink-0">{notif.time}</span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">{notif.message}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
