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
              {/* Banner */}
              <View style={styles.banner}>
                {profile.bannerUrl ? (
                  <Image source={{ uri: profile.bannerUrl }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                ) : (
                  <LinearGradient
                    colors={vipStyle ? (vipStyle.borderColors as [string, string, ...string[]]) : [COLORS.primary, COLORS.accent, COLORS.secondary]}
                    style={StyleSheet.absoluteFillObject}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.7)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="profile-popup-close">
                  <Ionicons name="close" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Avatar + frame */}
              <View
                style={[
                  styles.avatarWrap,
                  profile.enlargedAvatar && { transform: [{ scale: VIP_PRO_AVATAR_SCALE }] },
                  getAuraStyle(profile.auraType, profile.auraColor, 96),
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
                        <Ionicons name="person" size={48} color={COLORS.textSecondary} />
                      )}
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={[styles.avatarFrame, { backgroundColor: COLORS.cardBg, padding: 3 }]}>
                    <View style={styles.avatarFrameInner}>
                      {profile.photoUrl ? (
                        <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} />
                      ) : (
                        <Ionicons name="person" size={48} color={COLORS.textSecondary} />
                      )}
                    </View>
                  </View>
                )}
                {/* Online status dot */}
                <View
                  style={[
                    styles.onlineDot,
                    { backgroundColor: profile.onlineStatus ? COLORS.success : '#666' },
                  ]}
                />
                {/* Custom VIP Pro badge (overrides crown) */}
                {(() => {
                  const customBadge = findBadge(profile.vipBadgeId);
                  if (customBadge) {
                    return (
                      <View style={[styles.crown, { backgroundColor: customBadge.bg, width: 30, height: 30, borderRadius: 15 }]}>
                        <Text style={{ fontSize: 18 }}>{customBadge.emoji}</Text>
                      </View>
                    );
                  }
                  if (vipStyle) {
                    return (
                      <View style={[styles.crown, { backgroundColor: vipStyle.crownColor }]}>
                        <Ionicons name={vipStyle.badgeIcon} size={14} color={COLORS.background} />
                      </View>
                    );
                  }
                  return null;
                })()}
              </View>

              {/* Name + badges */}
              <View style={styles.identityBlock}>
                <View style={styles.nameRow}>
                  <Text
                    style={[
                      styles.displayName,
                      vipStyle && { color: vipStyle.nameColor },
                      profile.usernameColor ? { color: profile.usernameColor } : null,
                    ]}
                    numberOfLines={1}
                  >
                    {profile.displayName}
                  </Text>
                  {profile.badges.map((b) => (
                    <View key={b.id} style={[styles.badgePill, { backgroundColor: b.color }]}>
                      <Ionicons name={b.icon as any} size={10} color={COLORS.background} />
                      <Text style={styles.badgeText}>{b.label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.username}>@{profile.username}</Text>
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: profile.onlineStatus ? COLORS.success : '#666' },
                    ]}
                  />
                  <Text style={styles.statusText}>
                    {profile.onlineStatus ? 'Online now' : 'Offline'}
                  </Text>
                  <Text style={styles.dotSeparator}>·</Text>
                  <Ionicons name="people" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.statusText}>{profile.friendCount} friends</Text>
                </View>
                {profile.bio ? (
                  <Text style={styles.bio} numberOfLines={2}>
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
                  colors={[COLORS.primary, COLORS.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.viewProfileGradient}
                >
                  <Ionicons name="person-circle" size={18} color={COLORS.text} />
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
                    color={COLORS.accent}
                    onPress={handleGift}
                    testID="profile-popup-gift"
                  />
                  <ActionButton
                    label="Send Coins"
                    icon="cash"
                    color={COLORS.coin}
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
          active && { backgroundColor: '#1f2a1f', borderColor: COLORS.success },
        ]}
        testID={testID}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.text} />
        ) : (
          <Ionicons name={icon} size={20} color={color || (active ? COLORS.success : COLORS.text)} />
        )}
        <Text style={[actionBtnStyles.label, active && { color: COLORS.success }]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const actionBtnStyles = StyleSheet.create({
  btn: {
    backgroundColor: '#1a1226',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#2a2240',
  },
  label: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.md,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#15101f',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2a2240',
    paddingBottom: SPACING.md,
  },
  loadingBox: {
    padding: SPACING.xl * 2,
    alignItems: 'center',
  },
  banner: {
    height: 100,
    backgroundColor: COLORS.cardBg,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrap: {
    marginTop: -50,
    alignSelf: 'center',
    position: 'relative',
  },
  avatarFrame: {
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFrameInner: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#15101f',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 48,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#15101f',
  },
  crown: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#15101f',
  },
  identityBlock: {
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  displayName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  badgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  username: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  dotSeparator: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginHorizontal: 2,
  },
  bio: {
    color: COLORS.text,
    fontSize: 13,
    textAlign: 'center',
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    opacity: 0.85,
  },
  viewProfileBtn: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: 12,
    overflow: 'hidden',
  },
  viewProfileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  viewProfileText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
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
    fontWeight: '600',
  },
  secondaryDivider: {
    width: 1,
    height: 14,
    backgroundColor: '#2a2240',
  },
});
