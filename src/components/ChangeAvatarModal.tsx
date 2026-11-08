import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { X, Upload, Check, Camera, Image, Sparkles, Link as LinkIcon, RefreshCw } from 'lucide-react';
import { playWinSound, playMessageSound } from '../utils/sound';

interface ChangeAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_AVATARS = [
  { id: 'panda', name: 'Cute Panda', url: '/public/avatars/default-1-panda.png' },
  { id: 'corgi', name: 'Space Corgi', url: '/public/avatars/default-2-corgi.png' },
  { id: 'alien', name: 'Friendly Alien', url: '/public/avatars/default-3-alien.png' },
  { id: 'gamer-guy', name: 'Neon Gamer', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=300&h=300&fit=crop&crop=faces' },
  { id: 'gamer-girl', name: 'Cyber Streamer', url: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=300&h=300&fit=crop&crop=faces' },
  { id: 'street-vibes', name: 'Urban Vibe', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=300&h=300&fit=crop&crop=faces' },
  { id: 'star-vibe', name: 'Aura Vibe', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop&crop=faces' },
  { id: 'creative-girl', name: 'Creative Soul', url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&h=300&fit=crop&crop=faces' },
];

export default function ChangeAvatarModal({ isOpen, onClose }: ChangeAvatarModalProps) {
  const { user, updateProfile } = useAuth();
  const [selectedUrl, setSelectedUrl] = useState<string>(user.photoUrl);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSelectAvatar = (url: string) => {
    setSelectedUrl(url);
    updateProfile({ photoUrl: url });
    playWinSound();
    setFeedback('Profile picture updated successfully!');
    setTimeout(() => {
      setFeedback(null);
      onClose();
    }, 1200);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image size exceeds 5MB. Please choose a smaller photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setSelectedUrl(base64);
        updateProfile({ photoUrl: base64 });
        playWinSound();
        setFeedback('Photo uploaded and set as profile picture!');
        setTimeout(() => {
          setFeedback(null);
          onClose();
        }, 1200);
      }
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file. Please try again.');
    };
    reader.readAsDataURL(file);
  };

  const handleCustomUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customUrlInput.trim();
    if (!trimmed) return;
    handleSelectAvatar(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#120e24] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300">
              <Camera className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">Change Profile Picture</h3>
              <p className="text-xs text-zinc-400">Square avatar format for room and profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Active Profile Picture Preview (Square Avatar) */}
          <div className="flex items-center gap-4 p-3.5 rounded-2xl bg-white/[0.04] border border-white/10">
            <div className="relative">
              {/* Square avatar container */}
              <div
                className={`w-20 h-20 rounded-xl overflow-hidden p-1 shadow-lg aspect-square ${
                  user.vipTier === 'elite'
                    ? 'bg-gradient-to-tr from-pink-500 via-purple-500 to-cyan-400'
                    : user.vipTier === 'pro'
                    ? 'bg-gradient-to-tr from-amber-400 via-amber-500 to-yellow-300'
                    : 'bg-zinc-800'
                }`}
              >
                <img
                  src={selectedUrl || user.photoUrl}
                  alt={user.displayName}
                  className="w-full h-full object-cover rounded-lg bg-zinc-900 aspect-square"
                />
              </div>
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-md bg-teal-500 text-zinc-950 font-black text-[9px] uppercase shadow-xs">
                Square
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <span className="text-xs font-black text-white block truncate">{user.displayName}</span>
              <span className="text-[11px] text-zinc-400 block mt-0.5">Active profile picture</span>
              <span className="inline-flex items-center gap-1 text-[10px] text-teal-400 font-bold mt-1">
                <Check className="w-3 h-3 stroke-[3]" /> Syncs across all rooms & chat
              </span>
            </div>
          </div>

          {/* Feedback & Error Alerts */}
          {feedback && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 stroke-[3]" />
              <span className="font-semibold">{feedback}</span>
            </div>
          )}
          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
              <X className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-semibold">{uploadError}</span>
            </div>
          )}

          {/* Option 1: Upload from Device */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide block">
              1. Upload Your Own Photo
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-[0.99] text-white font-extrabold text-xs transition-all shadow-md shadow-teal-700/20 flex items-center justify-center gap-2"
            >
              <Upload className="w-4 h-4" />
              <span>Choose Photo from Device</span>
            </button>
            <p className="text-[11px] text-zinc-500 text-center">
              Supports JPG, PNG, WebP up to 5MB. Automatically cropped to square.
            </p>
          </div>

          {/* Option 2: Choose from Square Preset Avatars */}
          <div className="space-y-2.5 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide">
                2. Choose a Square Avatar Mascot
              </span>
              <span className="text-[10px] text-zinc-500 font-medium">8 Presets</span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {PRESET_AVATARS.map((av) => {
                const isSelected = (selectedUrl || user.photoUrl) === av.url;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => handleSelectAvatar(av.url)}
                    className={`p-1.5 rounded-xl border flex flex-col items-center gap-1.5 transition-all group ${
                      isSelected
                        ? 'bg-teal-500/20 border-teal-400 ring-2 ring-teal-400/40 shadow-md shadow-teal-500/20 scale-105'
                        : 'bg-zinc-900/80 border-white/10 hover:border-white/30'
                    }`}
                  >
                    <div className="w-14 h-14 rounded-lg overflow-hidden bg-zinc-950 aspect-square">
                      <img
                        src={av.url}
                        alt={av.name}
                        className="w-full h-full object-cover rounded-md group-hover:scale-105 transition-transform aspect-square"
                      />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-300 truncate w-full text-center">
                      {av.name}
                    </span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Option 3: Custom Image URL */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-wide block">
              3. Or Paste Image URL
            </span>
            <form onSubmit={handleCustomUrlSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  placeholder="https://example.com/photo.png"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:border-teal-400"
                />
              </div>
              <button
                type="submit"
                className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-colors"
              >
                Apply
              </button>
            </form>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 border-t border-white/10 bg-zinc-950 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
