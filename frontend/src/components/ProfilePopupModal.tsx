import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
  Easing,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';
import { VIP_STYLES } from '@/src/utils/vip';
import type { ProfileCard } from '@/src/types/profile';
import { getCachedProfile, setCachedProfile, invalidateProfile } from '@/src/utils/profileCache';
import { useAuth } from '@/src/contexts/AuthContext';
import GiftSendModal from '@/src/components/GiftSendModal';
import PrivateMessagesModal from '@/src/components/PrivateMessagesModal';
import SendCoinsModal from '@/src/components/SendCoinsModal';
import { getAuraStyle, findBadge, VIP_PRO_AVATAR_SCALE } from '@/src/utils/vipProCustomization';

// Cursive font stack for premium/cursive look (loaded in +html.tsx on web)
const CURSIVE_FONT = Platform.select({
  web: '"Dancing Script", "Great Vibes", "Brush Script MT", cursive',
  default: 'System',
}) as string;
const ELITE_SCRIPT_FONT = CURSIVE_FONT;

interface Props {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
}

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam or scam' },
  { id: 'harassment', label: 'Harassment or bullying' },
  { id: 'inappropriate', label: 'Inappropriate content' },
  { id: 'fake', label: 'Fake / impersonation' },
  { id: 'other', label: 'Other' },
];

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const showConfirm = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: 'destructive', onPress: onConfirm },
    ]);
  }
};

const showReportPicker = (onPick: (label: string) => void) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const labels = REPORT_REASONS.map((r, i) => `${i + 1}. ${r.label}`).join('\n');
    const inp = window.prompt(`Report user — pick a reason (enter 1-5):\n\n${labels}`, '1');
    const n = parseInt(inp || '0', 10);
    if (n >= 1 && n <= REPORT_REASONS.length) onPick(REPORT_REASONS[n - 1].label);
  } else {
    Alert.alert('Report user', 'Select a reason', [
      ...REPORT_REASONS.map((r) => ({ text: r.label, onPress: () => onPick(r.label) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }
};

export default function ProfilePopupModal({ visible, userId, onClose }: Props) {
  const { user: currentUser, refreshUser } = useAuth();
  const [profile, setProfile] = useState<ProfileCard | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);
  const [sendCoinsOpen, setSendCoinsOpen] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  // Animate in/out
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, friction: 7, tension: 70 }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
    }
  }, [visible, fadeAnim, scaleAnim]);

  const loadProfile = useCallback(async (id: string, force = false) => {
    if (!force) {
      const cached = getCachedProfile(id);
      if (cached) {
        setProfile(cached);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await api.get(`/users/${id}/profile-card`);
      setProfile(res.data);
      setCachedProfile(id, res.data);
    } catch (e) {
      console.error('Failed to load profile card', e);
      showAlert('Error', 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible && userId) {
      setProfile(null);
      loadProfile(userId);
    }
  }, [visible, userId, loadProfile]);

  if (!visible) return null;

  const vipStyle = profile?.vipTier ? VIP_STYLES[profile.vipTier] : null;
  const isSelf = profile?.isSelf;
  const isElite = profile?.vipTier === 'elite';

  // --- Action handlers ---
  const handleAddFriend = async () => {
    if (!profile) return;
    setActionLoading('friend');
    try {
      if (profile.friendStatus === 'none') {
        await api.post('/friends/request', { receiverId: profile.id });
        showAlert('Sent', 'Friend request sent!');
      } else if (profile.friendStatus === 'received' && profile.friendRequestId) {
        await api.post(`/friends/accept/${profile.friendRequestId}`);
        showAlert('Accepted', `You and ${profile.displayName} are now friends.`);
      } else if (profile.friendStatus === 'friends') {
        showConfirm('Remove friend', `Remove ${profile.displayName} from your friends?`, async () => {
          try {
            await api.delete(`/friends/${profile.id}`);
            invalidateProfile(profile.id);
            await loadProfile(profile.id, true);
          } catch (e: any) {
            showAlert('Error', e?.response?.data?.detail || 'Failed to remove friend');
          }
        });
      } else if (profile.friendStatus === 'sent') {
        showAlert('Pending', 'Friend request already sent.');
      }
      invalidateProfile(profile.id);
      await loadProfile(profile.id, true);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMessage = () => {
    setDmOpen(true);
  };

  const handleGift = () => {
    if (!profile) return;
    setGiftOpen(true);
  };

  const handleReport = () => {
    if (!profile) return;
    showReportPicker(async (reason) => {
      setActionLoading('report');
      try {
        await api.post(`/users/${profile.id}/report`, { reason });
        showAlert('Reported', 'Thanks. Our team will review this report.');
      } catch (e: any) {
        showAlert('Error', e?.response?.data?.detail || 'Failed to submit report');
      } finally {
        setActionLoading(null);
      }
    });
  };

  const handleBlock = () => {
    if (!profile) return;
    const blockedNow = profile.isBlocked;
    const title = blockedNow ? 'Unblock user' : 'Block user';
    const msg = blockedNow
      ? `Unblock ${profile.displayName}?`
      : `Block ${profile.displayName}? They won't be able to message you. Existing friendship will be removed.`;
    showConfirm(title, msg, async () => {
      setActionLoading('block');
      try {
        if (blockedNow) {
          await api.delete(`/users/${profile.id}/block`);
        } else {
          await api.post(`/users/${profile.id}/block`);
        }
        invalidateProfile(profile.id);
        await loadProfile(profile.id, true);
      } catch (e: any) {
        showAlert('Error', e?.response?.data?.detail || 'Failed');
      } finally {
        setActionLoading(null);
      }
    });
  };

  const handleViewProfile = () => {
    if (!profile) return;
    onClose();
    setTimeout(() => router.push(`/profile/${profile.id}`), 200);
  };

  const friendBtnLabel = (() => {
    if (!profile) return 'Add Friend';
    switch (profile.friendStatus) {
      case 'friends': return 'Friends';
      case 'sent': return 'Requested';
      case 'received': return 'Accept';
      default: return 'Add Friend';
    }
  })();

  const friendBtnIcon: any = (() => {
    if (!profile) return 'person-add';
    switch (profile.friendStatus) {
      case 'friends': return 'checkmark-circle';
      case 'sent': return 'time';
      case 'received': return 'mail-open';
      default: return 'person-add';
    }
  })();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} testID="profile-popup-backdrop" />
        <Animated.View
          style={[
            styles.card,
            isElite && styles.cardElite,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {loading || !profile ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <>
              {/* Banner with avatar LEFT + name CENTER overlay */}
              <View style={styles.bannerWrap}>
                <View style={styles.banner}>
                  {profile.bannerUrl ? (
                    <Image source={{ uri: profile.bannerUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                  ) : (
                    <LinearGradient
                      colors={['#a7f3d0', '#fde68a', '#fbcfe8'] as [string, string, ...string[]]}
                      style={StyleSheet.absoluteFillObject}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                  )}
                  {/* Soft pastel veil for legibility */}
                  <LinearGradient
                    colors={['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.35)']}
                    style={StyleSheet.absoluteFillObject}
                  />

                  {/* Avatar — LEFT */}
                  <View
                    style={[
                      styles.avatarOverlayLeft,
                      profile.enlargedAvatar && { transform: [{ scale: VIP_PRO_AVATAR_SCALE }] },
                      getAuraStyle(profile.auraType, profile.auraColor, 84),
                    ]}
                  >
                    {vipStyle ? (
                      <LinearGradient
                        colors={vipStyle.borderColors as [string, string, ...string[]]}
                        style={styles.avatarFrame}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                      >
                        <View style={styles.avatarFrameInner}>
                          {profile.photoUrl ? (
                            <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} />
                          ) : (
                            <Ionicons name="person" size={40} color="#9ca3af" />
                          )}
                        </View>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.avatarFrame, styles.avatarFramePlain]}>
                        <View style={styles.avatarFrameInner}>
                          {profile.photoUrl ? (
                            <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} />
                          ) : (
                            <Ionicons name="person" size={40} color="#9ca3af" />
                          )}
                        </View>
                      </View>
                    )}
                    {/* Online dot */}
                    <View
                      style={[
                        styles.onlineDot,
                        { backgroundColor: profile.onlineStatus ? '#22c55e' : '#94a3b8' },
                      ]}
                    />
                    {/* VIP badge */}
                    {(() => {
                      const customBadge = findBadge(profile.vipBadgeId);
                      if (customBadge) {
                        return (
                          <View style={[styles.crown, { backgroundColor: customBadge.bg }]}>
                            <Text style={{ fontSize: 16 }}>{customBadge.emoji}</Text>
                          </View>
                        );
                      }
                      if (vipStyle) {
                        return (
                          <View style={[styles.crown, { backgroundColor: vipStyle.crownColor }]}>
                            <Ionicons name={vipStyle.badgeIcon} size={13} color="#fff" />
                          </View>
                        );
                      }
                      return null;
                    })()}
                  </View>

                  {/* Cursive name — CENTER overlay */}
                  <View style={styles.nameOverlay} pointerEvents="none">
                    {isElite && (
                      <View style={styles.eliteRibbon} testID="elite-ribbon">
                        <LinearGradient
                          colors={['#fde68a', '#fbbf24', '#dc2626'] as [string, string, ...string[]]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.eliteRibbonGrad}
                        >
                          <Ionicons name="diamond" size={10} color="#1a0f2e" />
                          <Text style={styles.eliteRibbonText}>VIP ELITE</Text>
                          <Ionicons name="star" size={9} color="#1a0f2e" />
                        </LinearGradient>
                      </View>
                    )}
                    <Text
                      style={[
                        styles.cursiveName,
                        profile.usernameColor ? { color: profile.usernameColor } : null,
                      ]}
                      numberOfLines={1}
                      testID="profile-popup-name"
                    >
                      {profile.displayName}
                    </Text>
                    <Text style={styles.usernameOverlay} numberOfLines={1}>
                      @{profile.username}
                    </Text>
                  </View>

                  <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="profile-popup-close">
                    <Ionicons name="close" size={18} color="#1f2937" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Identity block: badges row + bio */}
              <View style={styles.identityBlock}>
                <View style={styles.badgesRow}>
                  {profile.badges.map((b) => (
                    <View key={b.id} style={[styles.badgePill, { backgroundColor: b.color }]}>
                      <Ionicons name={b.icon as any} size={10} color="#fff" />
                      <Text style={styles.badgeText}>{b.label}</Text>
                    </View>
                  ))}
                  <View style={styles.statusInlineRow}>
                    <View
                      style={[
                        styles.statusDot,
                        { backgroundColor: profile.onlineStatus ? '#22c55e' : '#94a3b8' },
                      ]}
                    />
                    <Text style={styles.statusText}>
                      {profile.onlineStatus ? 'Online' : 'Offline'}
                    </Text>
                  </View>
                </View>

                {/* Stats row: Coins / Friends / Likes / Posts */}
                <View style={styles.statsRow} testID="profile-popup-stats">
                  <View style={[styles.statChip, styles.statCoins]} testID="stat-coins">
                    <Ionicons name="logo-bitcoin" size={14} color="#a16207" />
                    <Text style={styles.statValue}>{profile.coins}</Text>
                    <Text style={styles.statLabel}>Coins</Text>
                  </View>
                  <View style={[styles.statChip, styles.statFriends]} testID="stat-friends">
                    <Ionicons name="people" size={14} color="#1d4ed8" />
                    <Text style={[styles.statValue, { color: '#1e3a8a' }]}>{profile.friendCount}</Text>
                    <Text style={[styles.statLabel, { color: '#1e3a8a' }]}>Friends</Text>
                  </View>
                  <View style={[styles.statChip, styles.statLikes]} testID="stat-likes">
                    <Ionicons name="heart" size={14} color="#be185d" />
                    <Text style={[styles.statValue, { color: '#9d174d' }]}>{profile.likesCount ?? 0}</Text>
                    <Text style={[styles.statLabel, { color: '#9d174d' }]}>Likes</Text>
                  </View>
                  <View style={[styles.statChip, styles.statPosts]} testID="stat-posts">
                    <Ionicons name="newspaper" size={14} color="#15803d" />
                    <Text style={[styles.statValue, { color: '#166534' }]}>{profile.postsCount ?? 0}</Text>
                    <Text style={[styles.statLabel, { color: '#166534' }]}>Posts</Text>
                  </View>
                </View>

                {profile.bio ? (
                  <Text style={styles.bio} numberOfLines={3} testID="profile-popup-bio">
                    {profile.bio}
                  </Text>
                ) : null}
              </View>

              {/* View Profile primary CTA */}
              <TouchableOpacity
                style={styles.viewProfileBtn}
                onPress={handleViewProfile}
                testID="profile-popup-view"
              >
                <LinearGradient
                  colors={['#f472b6', '#fb7185', '#fbbf24'] as [string, string, ...string[]]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.viewProfileGradient}
                >
                  <Ionicons name="person-circle" size={18} color="#fff" />
                  <Text style={styles.viewProfileText}>View Profile</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Action grid */}
              {!isSelf && (
                <View style={styles.actionRow}>
                  <ActionButton
                    label={friendBtnLabel}
                    icon={friendBtnIcon}
                    loading={actionLoading === 'friend'}
                    onPress={handleAddFriend}
                    active={profile.friendStatus === 'friends'}
                    testID="profile-popup-friend"
                  />
                  <ActionButton
                    label="Message"
                    icon="chatbubble-ellipses"
                    onPress={handleMessage}
                    testID="profile-popup-message"
                  />
                  <ActionButton
                    label="Gift"
                    icon="gift"
                    color="#ec4899"
                    onPress={handleGift}
                    testID="profile-popup-gift"
                  />
                  <ActionButton
                    label="Coins"
                    icon="cash"
                    color="#f59e0b"
                    onPress={() => setSendCoinsOpen(true)}
                    testID="profile-popup-send-coins"
                  />
                </View>
              )}

              {!isSelf && (
                <View style={styles.secondaryRow}>
                  <TouchableOpacity
                    onPress={handleReport}
                    style={styles.secondaryBtn}
                    testID="profile-popup-report"
                    disabled={actionLoading === 'report'}
                  >
                    <Ionicons name="flag-outline" size={14} color={COLORS.warning} />
                    <Text style={[styles.secondaryText, { color: COLORS.warning }]}>Report</Text>
                  </TouchableOpacity>
                  <View style={styles.secondaryDivider} />
                  <TouchableOpacity
                    onPress={handleBlock}
                    style={styles.secondaryBtn}
                    testID="profile-popup-block"
                    disabled={actionLoading === 'block'}
                  >
                    <Ionicons
                      name={profile.isBlocked ? 'lock-open-outline' : 'ban-outline'}
                      size={14}
                      color={COLORS.error}
                    />
                    <Text style={[styles.secondaryText, { color: COLORS.error }]}>
                      {profile.isBlocked ? 'Unblock' : 'Block'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </Animated.View>

        {/* Gift sub-modal */}
        {profile && (
          <GiftSendModal
            visible={giftOpen}
            onClose={() => setGiftOpen(false)}
            receiverId={profile.id}
            receiverName={profile.displayName}
          />
        )}

        {/* DM sub-modal */}
        {profile && (
          <PrivateMessagesModal
            visible={dmOpen}
            onClose={() => setDmOpen(false)}
            initialUserId={profile.id}
          />
        )}

        {/* Send Coins sub-modal */}
        {profile && currentUser && (
          <SendCoinsModal
            visible={sendCoinsOpen}
            onClose={() => setSendCoinsOpen(false)}
            receiverId={profile.id}
            receiverName={profile.displayName}
            userCoins={currentUser.coins}
            onSuccess={refreshUser}
          />
        )}
      </Animated.View>
    </Modal>
  );
}

// --- Small button used in the action grid ---
function ActionButton({
  label,
  icon,
  onPress,
  loading,
  active,
  color,
  testID,
}: {
  label: string;
  icon: any;
  onPress: () => void;
  loading?: boolean;
  active?: boolean;
  color?: string;
  testID?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const handlePressIn = () =>
    Animated.timing(scale, { toValue: 0.92, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  const handlePressOut = () =>
    Animated.timing(scale, { toValue: 1, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();

  return (
    <Animated.View style={{ flex: 1, transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          actionBtnStyles.btn,
          active && { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
        ]}
        testID={testID}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#7c2d12" />
        ) : (
          <Ionicons name={icon} size={20} color={color || (active ? '#15803d' : '#7c2d12')} />
        )}
        <Text style={[actionBtnStyles.label, active && { color: '#15803d' }]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const actionBtnStyles = StyleSheet.create({
  btn: {
    backgroundColor: '#fff7ed',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderColor: '#fde68a',
  },
  label: {
    color: '#7c2d12',
    fontSize: 12,
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,11,25,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#fffaf3',
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingBottom: SPACING.md,
    // @ts-ignore RN web shadow
    boxShadow: '0 18px 50px rgba(244,114,182,0.30), 0 8px 16px rgba(0,0,0,0.20)',
  },
  cardElite: {
    borderWidth: 2,
    borderColor: '#fbbf24',
    // @ts-ignore – RN web boxShadow
    boxShadow: '0 0 0 2px rgba(251,191,36,0.55), 0 18px 60px rgba(251,191,36,0.35), 0 0 90px rgba(220,38,38,0.25)',
    shadowColor: '#fbbf24',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 26,
    elevation: 16,
  },
  bannerWrap: {
    backgroundColor: '#fef3c7',
  },
  banner: {
    height: 150,
    backgroundColor: '#fde68a',
    position: 'relative',
  },
  avatarOverlayLeft: {
    position: 'absolute',
    left: 14,
    bottom: 8,
  },
  nameOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 110,
  },
  cursiveName: {
    color: '#1f2937',
    fontFamily: CURSIVE_FONT,
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 46,
    textAlign: 'center',
    textShadowColor: 'rgba(255,255,255,0.85)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
    // @ts-ignore
    textShadow: '0 2px 6px rgba(255,255,255,0.85), 0 4px 14px rgba(244,114,182,0.35)',
  },
  usernameOverlay: {
    color: '#7c2d12',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.55)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  scallopRow: { display: 'none' },
  scallopDot: { display: 'none' },
  eliteRibbon: {
    marginBottom: 4,
    borderRadius: 10,
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '0 2px 10px rgba(251,191,36,0.55)',
  },
  eliteRibbonGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  eliteRibbonText: {
    color: '#1a0f2e',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  loadingBox: {
    padding: SPACING.xl * 2,
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  avatarFrame: {
    width: 96,
    height: 96,
    borderRadius: 48,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFramePlain: {
    backgroundColor: '#ffffff',
    padding: 3,
    // @ts-ignore
    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  },
  avatarFrameInner: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 46,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  crown: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  identityBlock: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  statusInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#9a3412',
    fontSize: 11,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: SPACING.md,
    alignSelf: 'stretch',
  },
  statChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 2,
  },
  statCoins: {
    backgroundColor: '#fef3c7',
    borderColor: '#facc15',
  },
  statFriends: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  statLikes: {
    backgroundColor: '#fce7f3',
    borderColor: '#f472b6',
  },
  statPosts: {
    backgroundColor: '#dcfce7',
    borderColor: '#4ade80',
  },
  statValue: {
    color: '#92400e',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: CURSIVE_FONT,
    lineHeight: 18,
  },
  statLabel: {
    color: '#92400e',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  bio: {
    color: '#7c2d12',
    fontSize: 18,
    fontFamily: CURSIVE_FONT,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.sm,
  },
  viewProfileBtn: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: 14,
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '0 6px 14px rgba(244,114,182,0.40)',
  },
  viewProfileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  viewProfileText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
  },
  secondaryRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  secondaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#fbcfe8',
  },
});
