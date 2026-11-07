import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Post } from '../types';
import {
  Heart,
  MessageCircle,
  Image as ImageIcon,
  Send,
  X,
  Sparkles,
  Share2,
  Crown,
  Diamond,
  Plus,
  ArrowLeft,
  Flag,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import ProfilePopupModal from './ProfilePopupModal';

interface BoardPostsSectionProps {
  roomId?: string;
  roomName?: string;
  filterAuthorId?: string; // If set, only show posts from this user (e.g. for ProfileView)
}

export default function BoardPostsSection({
  roomId,
  roomName = 'Room Lounge',
  filterAuthorId,
}: BoardPostsSectionProps) {
  const { user, posts, createPost, likePost, commentOnPost, reportPost } = useAuth();
  const [postText, setPostText] = useState('');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [modalCommentInput, setModalCommentInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [reportingPost, setReportingPost] = useState<Post | null>(null);
  const [reportReason, setReportReason] = useState<string>('Inappropriate content or NSFW');
  const [reportDetails, setReportDetails] = useState<string>('');
  const [reportSubmitted, setReportSubmitted] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter posts
  const displayedPosts = posts.filter((p) => {
    if (filterAuthorId) return p.authorId === filterAuthorId;
    if (roomId) return p.roomId === roomId;
    return true;
  });

  const activePost = selectedPostId ? posts.find((p) => p.id === selectedPostId) : null;

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setImageBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!postText.trim() && !imageBase64) return;
    createPost(roomId || 'room-world', roomName, postText.trim(), imageBase64);
    setPostText('');
    setImageBase64(null);
  };

  const handleAddModalComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPostId || !modalCommentInput.trim()) return;
    commentOnPost(selectedPostId, modalCommentInput.trim());
    setModalCommentInput('');
  };

  const handleOpenReport = (post: Post, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setReportingPost(post);
    setReportReason('Inappropriate content or NSFW');
    setReportDetails('');
    setReportSubmitted(false);
  };

  const handleSubmitReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingPost) return;
    reportPost(reportingPost.id, reportReason, reportDetails);
    setReportSubmitted(true);
    setTimeout(() => {
      setReportingPost(null);
      setReportSubmitted(false);
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* Create Post Card - Borderless Dynamic Display */}
      {(!filterAuthorId || filterAuthorId === user.id) && (
        <div className="p-3 sm:p-4 rounded-2xl bg-white/[0.04] backdrop-blur-md shadow-lg space-y-2.5">
          <div className="flex items-center justify-between pb-1.5">
            <span className="text-xs font-black text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-pink-400" />
              <span>{filterAuthorId ? 'Create Post on Profile' : `Create Post in #${roomName}`}</span>
            </span>
            <span className="text-[10px] text-zinc-400">Share text or photo</span>
          </div>

          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-zinc-800 shrink-0 mt-0.5">
              <img src={user.photoUrl} alt={user.displayName} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <textarea
                rows={2}
                placeholder={
                  filterAuthorId
                    ? "Share an update on your profile & room feeds... ✨"
                    : `Share an update or photo in #${roomName}... ✨`
                }
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                className="w-full bg-black/40 rounded-xl p-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400/70 transition-colors resize-none"
              />

              {/* Image Preview if selected */}
              {imageBase64 && (
                <div className="relative mt-2 rounded-xl overflow-hidden max-h-40 bg-zinc-950 w-fit">
                  <img src={imageBase64} alt="Upload preview" className="max-h-40 object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={() => setImageBase64(null)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-2 flex items-center justify-between gap-2 pt-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 px-2.5 rounded-xl bg-white/[0.05] text-zinc-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 text-[11px] font-semibold"
                    title="Attach image"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                    <span>Photo</span>
                  </button>

                  {/* Preset quick room themes */}
                  <button
                    type="button"
                    onClick={() => setImageBase64('/public/rooms/philippines.png')}
                    className="px-2 py-1 rounded-xl bg-white/[0.03] text-[10px] text-zinc-400 hover:text-purple-300 transition-colors hidden sm:inline"
                  >
                    + Philippines
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageBase64('/public/rooms/birthday.png')}
                    className="px-2 py-1 rounded-xl bg-white/[0.03] text-[10px] text-zinc-400 hover:text-purple-300 transition-colors hidden sm:inline"
                  >
                    + Arena
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCreatePost}
                  disabled={!postText.trim() && !imageBase64}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:brightness-110 active:scale-95 text-white font-black text-xs transition-all shadow-md shadow-purple-600/30 flex items-center gap-1 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Post</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3 Posts Per Row Grid (Dynamic Display Without Harsh Box Borders) */}
      {displayedPosts.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white/[0.02] p-6 space-y-2">
          <Sparkles className="w-8 h-8 text-purple-400 mx-auto opacity-50" />
          <h4 className="font-extrabold text-sm text-zinc-300">No posts in #{roomName} yet</h4>
          <p className="text-xs text-zinc-500 max-w-xs mx-auto">
            Be the first to share an update, question, or photo!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {displayedPosts.map((post) => {
            return (
              <div
                key={post.id}
                onClick={() => setSelectedPostId(post.id)}
                className="relative aspect-square sm:aspect-[4/5] rounded-xl sm:rounded-2xl overflow-hidden cursor-pointer group shadow-lg transition-transform duration-200 active:scale-95 hover:scale-[1.02] bg-[#120d24] select-none"
              >
                {/* Background Image if present, else dynamic cosmic gradient */}
                {post.imageBase64 ? (
                  <img
                    src={post.imageBase64}
                    alt={post.text || 'Post image'}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-900/40 via-indigo-950/50 to-zinc-950 p-2 sm:p-2.5 flex items-center justify-center text-center">
                    <p className="text-[10px] sm:text-xs text-zinc-300 line-clamp-3 font-medium italic">
                      "{post.text}"
                    </p>
                  </div>
                )}

                {/* Dark gradient overlay for readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent flex flex-col justify-between p-1.5 sm:p-2.5">
                  {/* Top Bar: Author Avatar & Name + Report Flag Button */}
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <img
                        src={post.authorPhotoUrl}
                        alt={post.authorDisplayName}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg object-cover ring-1 ring-white/20 shrink-0"
                      />
                      <span className="text-[10px] sm:text-[11px] font-bold text-white truncate drop-shadow">
                        {post.authorDisplayName.split(' ')[0]}
                      </span>
                    </div>

                    {/* Report / Moderation Flag Button on Tile */}
                    {post.isReportedByMe ? (
                      <span
                        onClick={(e) => e.stopPropagation()}
                        className="px-1.5 py-0.5 rounded-md bg-amber-500/80 text-zinc-950 text-[9px] font-black flex items-center gap-1 shadow-sm shrink-0"
                        title="Flagged for moderation review"
                      >
                        <Flag className="w-2.5 h-2.5 fill-current" />
                        <span className="hidden sm:inline">Flagged</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => handleOpenReport(post, e)}
                        className="p-1 sm:p-1.5 rounded-lg bg-black/50 text-zinc-300 hover:text-rose-400 hover:bg-black/80 transition-colors flex items-center gap-0.5 text-[9px] font-bold shrink-0"
                        title="Report inappropriate content"
                      >
                        <Flag className="w-2.5 h-2.5" />
                        <span className="hidden md:inline">Report</span>
                      </button>
                    )}
                  </div>

                  {/* Bottom: Title/Snippet & Likes/Comments count */}
                  <div className="space-y-1">
                    {post.text && (
                      <p className="text-[10px] sm:text-xs font-semibold text-white line-clamp-2 leading-tight drop-shadow">
                        {post.text}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-zinc-300 pt-0.5">
                      <span className="flex items-center gap-1 font-bold">
                        <Heart
                          className={`w-3 h-3 ${
                            post.likedByMe ? 'fill-pink-500 text-pink-500' : 'text-zinc-300'
                          }`}
                        />
                        <span>{post.likesCount}</span>
                      </span>
                      <span className="flex items-center gap-1 font-bold">
                        <MessageCircle className="w-3 h-3 text-purple-300" />
                        <span>{post.comments.length}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Full-Screen Post Detail Modal (Mobile-Compatible with Full Likes, Comments, and Info) */}
      {activePost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/90 backdrop-blur-xl animate-fadeIn">
          <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-2xl bg-[#0e0a1f] flex flex-col sm:rounded-2xl overflow-hidden shadow-2xl">
            {/* Modal Header Bar */}
            <div className="p-3 sm:p-4 bg-zinc-900/80 flex items-center justify-between border-b border-white/5">
              <div
                onClick={() =>
                  setSelectedUser({
                    id: activePost.authorId,
                    username: activePost.authorUsername,
                    displayName: activePost.authorDisplayName,
                    photoUrl: activePost.authorPhotoUrl,
                    vipTier: activePost.authorVipTier,
                    level: 5,
                  })
                }
                className="flex items-center gap-2.5 cursor-pointer min-w-0 group"
              >
                <div
                  className={`w-9 h-9 rounded-xl overflow-hidden p-0.5 shrink-0 ${
                    activePost.authorVipTier === 'elite'
                      ? 'bg-gradient-to-tr from-pink-500 to-purple-500'
                      : activePost.authorVipTier === 'pro'
                      ? 'bg-gradient-to-tr from-amber-400 to-yellow-300'
                      : 'bg-zinc-800'
                  }`}
                >
                  <img
                    src={activePost.authorPhotoUrl}
                    alt={activePost.authorDisplayName}
                    className="w-full h-full object-cover rounded-[9px]"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs sm:text-sm text-white group-hover:text-purple-300 transition-colors truncate">
                      {activePost.authorDisplayName}
                    </span>
                    {activePost.authorVipTier && (
                      <span className="text-[9px] uppercase font-black px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 shrink-0">
                        {activePost.authorVipTier}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 truncate">
                    <span>@{activePost.authorUsername}</span>
                    <span>•</span>
                    <span className="text-purple-300 font-semibold">#{activePost.roomName}</span>
                    <span>•</span>
                    <span>{activePost.createdAt}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {activePost.isReportedByMe ? (
                  <span
                    className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1.5"
                    title="This post has been reported for moderation review"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reported</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenReport(activePost)}
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20 text-[11px] font-bold flex items-center gap-1.5 transition-colors"
                    title="Flag inappropriate content for moderation"
                  >
                    <Flag className="w-3.5 h-3.5 text-rose-400" />
                    <span>Report</span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedPostId(null)}
                  className="p-2 rounded-xl bg-zinc-800 text-zinc-300 hover:text-white transition-colors shrink-0"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Post Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Full-size Image if present */}
              {activePost.imageBase64 && (
                <div className="rounded-xl overflow-hidden bg-black/60 max-h-96 flex items-center justify-center">
                  <img
                    src={activePost.imageBase64}
                    alt={activePost.text || 'Post photo'}
                    className="w-full h-auto max-h-96 object-contain"
                  />
                </div>
              )}

              {/* Complete Post Text */}
              {activePost.text && (
                <p className="text-sm sm:text-base text-zinc-100 leading-relaxed whitespace-pre-line">
                  {activePost.text}
                </p>
              )}

              {/* Like Button & Interaction Bar */}
              <div className="flex items-center justify-between py-2 border-y border-white/5 text-xs text-zinc-400">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => likePost(activePost.id)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all font-bold ${
                      activePost.likedByMe
                        ? 'bg-pink-600/20 text-pink-400'
                        : 'bg-white/[0.05] text-zinc-300 hover:text-white'
                    }`}
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        activePost.likedByMe ? 'fill-pink-500 text-pink-500' : ''
                      }`}
                    />
                    <span>{activePost.likesCount} Likes</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-xs text-zinc-300 font-bold">
                    <MessageCircle className="w-4 h-4 text-purple-400" />
                    <span>{activePost.comments.length} Comments</span>
                  </div>
                </div>

                {/* Secondary Report option */}
                {!activePost.isReportedByMe ? (
                  <button
                    type="button"
                    onClick={() => handleOpenReport(activePost)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-rose-400 transition-colors px-2 py-1 rounded-lg hover:bg-rose-500/10"
                    title="Flag inappropriate content"
                  >
                    <Flag className="w-3 h-3 text-rose-400" />
                    <span className="hidden sm:inline">Report Post</span>
                  </button>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] text-amber-300 font-bold">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Under Review</span>
                  </span>
                )}
              </div>

              {/* Comments Section */}
              <div className="space-y-2.5">
                <h4 className="text-xs font-black text-zinc-300">
                  Comments ({activePost.comments.length})
                </h4>

                {activePost.comments.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-3 italic">
                    No comments yet. Start the conversation!
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activePost.comments.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl bg-white/[0.03] flex items-start gap-2.5 text-xs"
                      >
                        <img
                          src={c.authorPhoto}
                          alt={c.authorName}
                          className="w-7 h-7 rounded-lg object-cover bg-zinc-800 shrink-0 mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-white text-[11px] truncate">
                              {c.authorName}
                            </span>
                            <span className="text-[10px] text-zinc-500 shrink-0">{c.createdAt}</span>
                          </div>
                          <p className="text-zinc-300 text-xs mt-0.5 leading-relaxed">{c.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Input Bar at Modal Bottom */}
            <form
              onSubmit={handleAddModalComment}
              className="p-3 bg-black/40 backdrop-blur-md flex items-center gap-2 border-t border-white/5"
            >
              <input
                type="text"
                placeholder="Write a comment..."
                value={modalCommentInput}
                onChange={(e) => setModalCommentInput(e.target.value)}
                className="flex-1 px-3.5 py-2.5 rounded-xl bg-white/[0.06] text-white text-xs placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-400"
              />
              <button
                type="submit"
                disabled={!modalCommentInput.trim()}
                className="px-4 py-2.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 active:scale-95 transition-all disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Moderation Report Modal */}
      {reportingPost && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md bg-[#130f26] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
                  <Flag className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-white">Report Content</h3>
                  <p className="text-[10px] text-zinc-400">Flag for room & community moderation</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReportingPost(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportSubmitted ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-extrabold text-sm text-white">Report Received 🛡️</h4>
                <p className="text-xs text-zinc-300 leading-relaxed max-w-xs mx-auto">
                  Thank you for keeping our room safe! Our moderation team will review this post and take appropriate action.
                </p>
                <div className="pt-2">
                  <span className="text-[10px] text-zinc-500">Closing automatically...</span>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="p-4 space-y-4">
                {/* Post Summary Preview */}
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center gap-2.5">
                  <img
                    src={reportingPost.authorPhotoUrl}
                    alt={reportingPost.authorDisplayName}
                    className="w-8 h-8 rounded-lg object-cover bg-zinc-800 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="font-bold text-xs text-zinc-200 truncate block">
                      Post by @{reportingPost.authorUsername}
                    </span>
                    <span className="text-[10px] text-zinc-400 line-clamp-1">
                      {reportingPost.text || 'Photo post'}
                    </span>
                  </div>
                </div>

                {/* Reason Selection */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block">
                    Select a reason for reporting:
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {[
                      'Inappropriate content or NSFW',
                      'Harassment, hate speech, or bullying',
                      'Spam, scams, or misleading info',
                      'Violence, self-harm, or illegal activity',
                      'Other community guideline violation',
                    ].map((reason) => {
                      const isSelected = reportReason === reason;
                      return (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => setReportReason(reason)}
                          className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition-all ${
                            isSelected
                              ? 'bg-rose-500/20 border-rose-500/50 text-rose-200 shadow-sm shadow-rose-500/10'
                              : 'bg-white/[0.02] border-white/5 text-zinc-300 hover:bg-white/[0.05]'
                          }`}
                        >
                          <span>{reason}</span>
                          <span
                            className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ml-2 ${
                              isSelected
                                ? 'border-rose-400 bg-rose-500'
                                : 'border-zinc-600'
                            }`}
                          >
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Optional Details Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-300 block">
                    Additional context <span className="text-zinc-500 font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Provide details to assist moderation review..."
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-400/60 resize-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5">
                  <button
                    type="button"
                    onClick={() => setReportingPost(null)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-black text-white bg-gradient-to-r from-rose-600 to-red-600 hover:brightness-110 active:scale-95 shadow-md shadow-rose-600/30 transition-all flex items-center gap-1.5"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>Submit Report</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Profile Popup Modal for inspected users */}
      <ProfilePopupModal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        targetUser={selectedUser}
      />
    </div>
  );
}
