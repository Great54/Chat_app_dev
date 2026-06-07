import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/contexts/AuthContext';
import { VIP_STYLES } from '@/src/utils/vip';
import VipShopModal from '@/src/components/VipShopModal';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';
import { getAuraStyle, findBadge, VIP_PRO_AVATAR_SCALE } from '@/src/utils/vipProCustomization';
import type { ProfileCard } from '@/src/types/profile';

// Cursive font stack matching the profile popup look
const CURSIVE_FONT = Platform.select({
  web: '"Dancing Script", "Great Vibes", "Brush Script MT", cursive',
  default: 'System',
}) as string;

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [loading, setLoading] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);
  const [card, setCard] = useState<ProfileCard | null>(null);
  const vipStyle = user?.vipTier ? VIP_STYLES[user.vipTier] : null;

  // Fetch the profile-card for the logged-in user so we can show likes /
  // friends / posts counts on the own profile screen (same data the popup uses).
  const loadCard = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/users/${user.id}/profile-card`);
      setCard(res.data);
    } catch (e) {
      // soft-fail — the rest of the profile UI still works without these stats
    }
  }, [user?.id]);

  useEffect(() => {
    loadCard();
  }, [loadCard]);

  useEffect(() => {
    if (editing && user) {
      setDisplayName(user.displayName);
      setBio(user.bio || '');
    }
  }, [editing, user]);

  const pickImage = async (target: 'photoUrl' | 'bannerUrl') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: target === 'photoUrl' ? [1, 1] : [16, 9],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      try {
        await api.put('/users/profile', { [target]: base64Image });
        await refreshUser();
      } catch (error) {
        Alert.alert('Error', 'Failed to update image');
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/users/profile', { displayName, bio });
      await refreshUser();
      setEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to logout?')) logout();
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Banner / Background Image Section */}
        <View style={styles.bannerSection}>
          {user.bannerUrl ? (
            <Image source={{ uri: user.bannerUrl }} style={styles.banner} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent, COLORS.secondary]}
              style={styles.banner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', COLORS.background]}
            style={styles.bannerGradient}
          />
          <TouchableOpacity
            style={styles.bannerEditButton}
            onPress={() => pickImage('bannerUrl')}
            testID="edit-banner-btn"
          >
            <Ionicons name="image" size={16} color={COLORS.text} />
            <Text style={styles.bannerEditText}>Edit Banner</Text>
          </TouchableOpacity>
          {!editing && (
            <TouchableOpacity
              style={styles.headerEditButton}
              onPress={() => setEditing(true)}
              testID="edit-profile-btn"
            >
              <Ionicons name="pencil" size={18} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Popup-style peek card: avatar LEFT + identity RIGHT (matches ProfilePopupModal graphics) */}
        <View style={styles.peekCard} testID="profile-peek-card">
          <View style={styles.peekRow}>
            {/* Avatar — LEFT (tap to change photo) */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => pickImage('photoUrl')}
              testID="edit-avatar-btn"
              style={[
                styles.peekAvatarWrap,
                user?.enlargedAvatar && { transform: [{ scale: VIP_PRO_AVATAR_SCALE }] },
                getAuraStyle(user?.auraType, user?.auraColor, 116),
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
                    {user.photoUrl ? (
                      <Image source={{ uri: user.photoUrl }} style={styles.peekAvatarImg} />
                    ) : (
                      <Ionicons name="person" size={42} color="#9ca3af" />
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.avatarFrame, styles.avatarFramePlain]}>
                  <View style={styles.avatarFrameInner}>
                    {user.photoUrl ? (
                      <Image source={{ uri: user.photoUrl }} style={styles.peekAvatarImg} />
                    ) : (
                      <Ionicons name="person" size={42} color="#9ca3af" />
                    )}
                  </View>
                </View>
              )}
              {/* Online dot */}
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: user.onlineStatus ? '#22c55e' : '#94a3b8' },
                ]}
              />
              {/* Camera affordance */}
              <View style={styles.peekCameraIcon}>
                <Ionicons name="camera" size={12} color={COLORS.text} />
              </View>
            </TouchableOpacity>

            {/* Identity — RIGHT side */}
            <View style={styles.peekIdentity}>
              {user.vipTier === 'elite' && (
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
                  styles.peekName,
                  user.usernameColor ? { color: user.usernameColor } : null,
                ]}
                numberOfLines={1}
              >
                {user.displayName}
              </Text>
              <Text style={styles.peekUsername} numberOfLines={1}>@{user.username}</Text>

              {/* VIP badge pill (mirrors popup) */}
              {(() => {
                const customBadge = findBadge(user.vipBadgeId);
                if (customBadge) {
                  return (
                    <TouchableOpacity
                      onPress={() => setVipModalOpen(true)}
                      activeOpacity={0.85}
                      style={styles.peekBadgesRow}
                      testID="profile-vip-badge"
                    >
                      <View style={[styles.badgePill, { backgroundColor: customBadge.bg }]}>
                        <Text style={{ fontSize: 11 }}>{customBadge.emoji}</Text>
                        <Text style={styles.badgeText}>VIP</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }
                if (vipStyle) {
                  return (
                    <TouchableOpacity
                      onPress={() => setVipModalOpen(true)}
                      activeOpacity={0.85}
                      style={styles.peekBadgesRow}
                      testID="profile-vip-badge"
                    >
                      <View style={[styles.badgePill, { backgroundColor: vipStyle.crownColor }]}>
                        <Ionicons name={vipStyle.badgeIcon} size={10} color="#fff" />
                        <Text style={styles.badgeText}>{(user.vipTier || '').toUpperCase()}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                }
                return null;
              })()}

              {/* Coins pill */}
              <View style={styles.peekCoinsPill} testID="profile-peek-coins">
                <Ionicons name="logo-bitcoin" size={14} color="#a16207" />
                <Text style={styles.peekCoinsValue}>{user.coins}</Text>
                <Text style={styles.peekCoinsLabel}>coins</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Stats row: Likes / Friends / Posts — mirrors the View Profile page */}
        <View style={styles.statsCirclesRow}>
          <View style={[styles.statCircle, styles.statCircleLikes]} testID="profile-stat-likes">
            <Ionicons name="heart" size={16} color="#9d174d" />
            <Text style={[styles.statCircleValue, { color: '#9d174d' }]}>{card?.likesCount ?? 0}</Text>
            <Text style={[styles.statCircleLabel, { color: '#9d174d' }]}>Likes</Text>
          </View>
          <View style={[styles.statCircle, styles.statCircleFriends]} testID="profile-stat-friends">
            <Ionicons name="people" size={16} color="#1e40af" />
            <Text style={[styles.statCircleValue, { color: '#1e40af' }]}>{card?.friendCount ?? 0}</Text>
            <Text style={[styles.statCircleLabel, { color: '#1e40af' }]}>Friends</Text>
          </View>
          <TouchableOpacity
            onPress={() => setPostsOpen(true)}
            activeOpacity={0.85}
            style={[styles.statCircle, styles.statCirclePosts]}
            testID="profile-stat-posts"
          >
            <Ionicons name="newspaper" size={16} color="#166534" />
            <Text style={[styles.statCircleValue, { color: '#166534' }]}>{card?.postsCount ?? 0}</Text>
            <Text style={[styles.statCircleLabel, { color: '#166534' }]}>Posts</Text>
          </TouchableOpacity>
        </View>

        {/* View Posts pill — opens a modal listing this user's posts */}
        <TouchableOpacity
          onPress={() => setPostsOpen(true)}
          style={styles.viewPostsPill}
          testID="profile-view-posts"
          activeOpacity={0.85}
        >
          <Ionicons name="newspaper" size={15} color="#fde68a" />
          <Text style={styles.viewPostsText}>View Posts</Text>
          <View style={styles.viewPostsCount}>
            <Text style={styles.viewPostsCountText}>{card?.postsCount ?? 0}</Text>
          </View>
        </TouchableOpacity>

        {/* VIP subscription CTA — drives conversions */}
        <TouchableOpacity
          onPress={() => setVipModalOpen(true)}
          activeOpacity={0.9}
          style={styles.vipCtaWrap}
          testID="profile-vip-cta"
        >
          <LinearGradient
            colors={
              user.vipTier === 'elite'
                ? (['#fde68a', '#fbbf24', '#dc2626'] as [string, string, ...string[]])
                : user.vipTier === 'pro'
                  ? (['#a78bfa', '#7c3aed', '#4c1d95'] as [string, string, ...string[]])
                  : (['#f472b6', '#fb7185', '#fbbf24'] as [string, string, ...string[]])
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.vipCtaGradient}
          >
            <View style={styles.vipCtaIcon}>
              <Ionicons
                name={user.vipTier === 'elite' ? 'diamond' : user.vipTier === 'pro' ? 'star' : 'sparkles'}
                size={22}
                color="#1a0f2e"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vipCtaTitle}>
                {user.vipTier === 'elite'
                  ? 'VIP Elite — active'
                  : user.vipTier === 'pro'
                    ? 'VIP Pro — active'
                    : 'Unlock VIP'}
              </Text>
              <Text style={styles.vipCtaSubtitle}>
                {user.vipTier
                  ? 'Manage your subscription, perks & customizations'
                  : 'Custom aura, badges, name color, larger avatar and more'}
              </Text>
            </View>
            <View style={styles.vipCtaBadge}>
              <Text style={styles.vipCtaBadgeText}>
                {user.vipTier ? 'Manage' : 'Subscribe'}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#1a0f2e" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {editing ? (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholderTextColor={COLORS.textSecondary}
                testID="display-name-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                placeholderTextColor={COLORS.textSecondary}
                placeholder="Tell us about yourself..."
                testID="bio-input"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleSave}
                disabled={loading}
                testID="save-profile-btn"
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={styles.buttonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.infoSection}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Bio</Text>
              <Text style={styles.infoValue}>{user.bio || 'No bio yet'}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <VipShopModal visible={vipModalOpen} onClose={() => setVipModalOpen(false)} />

      {/* Posts sub-page — slide-up modal listing this user's posts */}
      <Modal visible={postsOpen} animationType="slide" onRequestClose={() => setPostsOpen(false)}>
        <SafeAreaView style={styles.container} edges={['top']}>
          <View style={styles.postsTopBar}>
            <TouchableOpacity
              onPress={() => setPostsOpen(false)}
              style={styles.postsBackBtn}
              testID="profile-posts-back"
            >
              <Ionicons name="arrow-back" size={22} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.postsTopTitle} numberOfLines={1}>My Posts</Text>
            <View style={styles.postsBackBtn} />
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: SPACING.xl * 2 }}>
            <MyPostsList userId={user.id} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Lightweight posts list for the own-profile Posts modal
function MyPostsList({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPosts(true);
        const res = await api.get(`/users/${userId}/posts`);
        if (!cancelled) setPosts(res.data || []);
      } catch (e) {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoadingPosts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loadingPosts) {
    return (
      <View style={styles.postsPlaceholder}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (posts.length === 0) {
    return (
      <View style={styles.postsPlaceholder}>
        <Ionicons name="newspaper-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.postsPlaceholderTitle}>No posts yet</Text>
        <Text style={styles.postsPlaceholderText}>
          Posts you share on a Board will show up here.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.postsList}>
      {posts.map((p) => (
        <View key={p.id} style={styles.postCard} testID={`my-post-${p.id}`}>
          {p.imageUrl ? (
            <Image source={{ uri: p.imageUrl }} style={styles.postImage} contentFit="cover" />
          ) : null}
          {p.text ? <Text style={styles.postText}>{p.text}</Text> : null}
          <View style={styles.postMetaRow}>
            <View style={styles.postMetaItem}>
              <Ionicons name="heart" size={14} color="#ec4899" />
              <Text style={styles.postMetaText}>{p.likeCount ?? 0}</Text>
            </View>
            <View style={styles.postMetaItem}>
              <Ionicons name="chatbubble" size={14} color="#7c3aed" />
              <Text style={styles.postMetaText}>{p.commentCount ?? 0}</Text>
            </View>
            <Text style={styles.postMetaTime}>
              {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const BANNER_HEIGHT = 180;
const AVATAR_SIZE = 110;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingBottom: SPACING.lg,
  },
  bannerSection: {
    width: '100%',
    height: BANNER_HEIGHT,
    position: 'relative',
    backgroundColor: COLORS.cardBg,
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  bannerEditButton: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  bannerEditText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  headerEditButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: -AVATAR_SIZE / 2,
    paddingHorizontal: SPACING.md,
  },
  // ---- Popup-style peek card (mirrors ProfilePopupModal graphics) ----
  peekCard: {
    marginTop: -AVATAR_SIZE / 2 - 10,
    marginHorizontal: SPACING.md,
    backgroundColor: '#fffaf3',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: SPACING.md,
    // @ts-ignore RN web shadow
    boxShadow: '0 18px 50px rgba(244,114,182,0.30), 0 8px 16px rgba(0,0,0,0.20)',
  },
  peekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  peekAvatarWrap: {
    position: 'relative',
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFrame: {
    width: 120,
    height: 120,
    borderRadius: 16,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFramePlain: {
    backgroundColor: '#ffffff',
    padding: 3,
    borderRadius: 14,
    // @ts-ignore
    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
  },
  avatarFrameInner: {
    width: '100%',
    height: '100%',
    borderRadius: 11,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  peekAvatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  peekCameraIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: COLORS.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  peekIdentity: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  peekName: {
    color: '#1f2937',
    fontFamily: CURSIVE_FONT,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
    // @ts-ignore — RN web textShadow
    textShadow: '0 2px 6px rgba(255,255,255,0.85), 0 4px 10px rgba(244,114,182,0.25)',
  },
  peekUsername: {
    color: '#7c2d12',
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.8,
  },
  peekBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
    alignSelf: 'flex-start',
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
  peekCoinsPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#facc15',
    marginTop: 6,
  },
  peekCoinsValue: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '900',
    fontFamily: CURSIVE_FONT,
  },
  peekCoinsLabel: {
    color: '#92400e',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  eliteRibbon: {
    marginBottom: 4,
    borderRadius: 10,
    overflow: 'hidden',
    alignSelf: 'flex-start',
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
  // ---- New: stats circles row (Likes / Friends / Posts) ----
  statsCirclesRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.md,
    gap: 8,
  },
  statCircle: {
    flex: 1,
    minWidth: 0,
    height: 78,
    borderRadius: 18,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  statCircleLikes: {
    backgroundColor: '#fce7f3',
    borderColor: '#f472b6',
  },
  statCircleFriends: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  statCirclePosts: {
    backgroundColor: '#dcfce7',
    borderColor: '#4ade80',
  },
  statCircleValue: {
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  statCircleLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // ---- View Posts pill ----
  viewPostsPill: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    marginTop: SPACING.md,
    backgroundColor: '#1f1226',
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#fbbf24',
    // @ts-ignore RN web shadow
    boxShadow: '0 6px 18px rgba(251,191,36,0.45)',
  },
  viewPostsText: {
    color: '#fde68a',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  viewPostsCount: {
    paddingHorizontal: 8,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: '#fbbf24',
    minWidth: 24,
    alignItems: 'center',
  },
  viewPostsCountText: { color: '#1f1226', fontSize: 11, fontWeight: '900' },
  // ---- VIP subscription CTA ----
  vipCtaWrap: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.md,
    borderRadius: 18,
    overflow: 'hidden',
    // @ts-ignore RN web shadow
    boxShadow: '0 10px 24px rgba(251,191,36,0.35)',
  },
  vipCtaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
  },
  vipCtaIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vipCtaTitle: {
    color: '#1a0f2e',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  vipCtaSubtitle: {
    color: '#1a0f2e',
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.85,
    marginTop: 2,
  },
  vipCtaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  vipCtaBadgeText: {
    color: '#1a0f2e',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  // ---- Posts modal ----
  postsTopBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
  },
  postsBackBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postsTopTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  postsList: {
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: SPACING.sm,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  postText: {
    color: '#1f2937',
    fontSize: 15,
    lineHeight: 21,
  },
  postMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  postMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postMetaText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
  postMetaTime: {
    color: '#94a3b8',
    fontSize: 12,
    marginLeft: 'auto',
  },
  postsPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  postsPlaceholderTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  postsPlaceholderText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: SPACING.lg,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: COLORS.background,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.background,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  vipCrownOnAvatar: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  vipTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  vipTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  username: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    gap: 8,
  },
  statBox: {
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  form: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondaryText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  infoSection: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  infoBox: {
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
  },
});
