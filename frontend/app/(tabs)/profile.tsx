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
import { SPACING } from '@/src/constants/theme';
import type { ProfileCard } from '@/src/types/profile';

// Cursive font stack for the dreamy display name
const CURSIVE_FONT = Platform.select({
  web: '"Dancing Script", "Great Vibes", "Brush Script MT", cursive',
  default: 'System',
}) as string;

// Light-themed pastel palette (matches the reference mock)
const PALETTE = {
  bg: '#fdf4ff',          // soft lavender page background
  card: '#ffffff',
  cardSubtle: '#fdf7ff',
  border: '#f3e8ff',
  borderStrong: '#e9d5ff',
  text: '#1f1d2b',
  textSub: '#6b7280',
  pink: '#ec4899',
  pinkSoft: '#fdf2f8',
  purple: '#a855f7',
  purpleSoft: '#f5f3ff',
  blue: '#3b82f6',
  blueSoft: '#eff6ff',
  green: '#22c55e',
  greenSoft: '#f0fdf4',
  gold: '#f59e0b',
  goldSoft: '#fffbeb',
  amber: '#fbbf24',
};

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const [postsOpen, setPostsOpen] = useState(false);
  const [card, setCard] = useState<ProfileCard | null>(null);
  const vipStyle = user?.vipTier ? VIP_STYLES[user.vipTier] : null;

  const loadCard = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await api.get(`/users/${user.id}/profile-card`);
      setCard(res.data);
    } catch (e) {
      // soft-fail — rest of UI still renders without remote stats
    }
  }, [user?.id]);

  useEffect(() => { loadCard(); }, [loadCard]);

  useEffect(() => {
    if (editing && user) {
      setDisplayName(user.displayName);
      setBio(user.bio || '');
    }
  }, [editing, user]);

  const pickImage = async (target: 'photoUrl' | 'bannerUrl') => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      showAlert('Permission Required', 'Please allow access to your photos');
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
      } catch (e) {
        showAlert('Error', 'Failed to update image');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/users/profile', { displayName, bio });
      await refreshUser();
      setEditing(false);
    } catch (e) {
      showAlert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
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

  const memberSince = (() => {
    const c: any = (card as any) || {};
    const raw = c.createdAt || (user as any)?.createdAt;
    if (!raw) return null;
    try {
      return new Date(raw).toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    } catch { return null; }
  })();

  const tierLabel = user.vipTier === 'elite' ? 'Elite Member' : user.vipTier === 'pro' ? 'Pro Member' : 'Member';
  const tierColor = user.vipTier === 'elite' ? '#dc2626' : user.vipTier === 'pro' ? '#7c3aed' : PALETTE.gold;
  const tierBg    = user.vipTier === 'elite' ? '#fff1f2' : user.vipTier === 'pro' ? PALETTE.purpleSoft : PALETTE.goldSoft;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ============ BANNER + HEADER CARD ============ */}
        <View style={styles.bannerWrap}>
          {user.bannerUrl ? (
            <Image source={{ uri: user.bannerUrl }} style={styles.bannerImg} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={['#fbcfe8', '#e9d5ff', '#bfdbfe']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          )}
          {/* Top action chips */}
          <TouchableOpacity
            onPress={() => pickImage('bannerUrl')}
            style={styles.bannerEditPill}
            testID="edit-banner-btn"
          >
            <Ionicons name="image" size={14} color="#fff" />
            <Text style={styles.bannerEditText}>Edit Banner</Text>
          </TouchableOpacity>
          {!editing && (
            <TouchableOpacity
              onPress={() => setEditing(true)}
              style={styles.pencilBtn}
              testID="edit-profile-btn"
            >
              <Ionicons name="pencil" size={16} color={PALETTE.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Floating identity card overlapping banner */}
        <View style={styles.identityCard}>
          <View style={styles.identityRow}>
            {/* Avatar with glowing aura */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => pickImage('photoUrl')}
              style={styles.avatarHalo}
              testID="edit-avatar-btn"
            >
              <View style={styles.avatarRing}>
                <View style={styles.avatarInner}>
                  {user.photoUrl ? (
                    <Image source={{ uri: user.photoUrl }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={56} color="#c4b5fd" />
                  )}
                </View>
              </View>
              <View style={styles.avatarCam}>
                <Ionicons name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Identity stack */}
            <View style={styles.identityCol}>
              {/* VIP ribbon */}
              {user.vipTier === 'elite' && (
                <View style={styles.vipRibbon}>
                  <LinearGradient
                    colors={['#fde68a', '#fbbf24', '#dc2626']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.vipRibbonGrad}
                  >
                    <Ionicons name="diamond" size={10} color="#1a0f2e" />
                    <Text style={styles.vipRibbonText}>VIP ELITE</Text>
                    <Ionicons name="star" size={9} color="#1a0f2e" />
                  </LinearGradient>
                </View>
              )}
              {user.vipTier === 'pro' && (
                <View style={[styles.vipRibbon]}>
                  <LinearGradient
                    colors={['#c4b5fd', '#8b5cf6', '#4c1d95']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.vipRibbonGrad}
                  >
                    <Ionicons name="star" size={10} color="#fff" />
                    <Text style={[styles.vipRibbonText, { color: '#fff' }]}>VIP PRO</Text>
                  </LinearGradient>
                </View>
              )}

              <View style={styles.nameLine}>
                <Text
                  style={[
                    styles.cursiveName,
                    user.usernameColor ? { color: user.usernameColor } : null,
                  ]}
                  numberOfLines={1}
                >
                  {user.displayName}
                </Text>
                <Ionicons name="checkmark-circle" size={16} color={PALETTE.blue} style={{ marginLeft: 4 }} />
              </View>

              <View style={styles.usernameRow}>
                <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
                {vipStyle && (
                  <TouchableOpacity onPress={() => setVipModalOpen(true)} style={[styles.vipPill, { backgroundColor: vipStyle.crownColor }]}>
                    <Ionicons name={vipStyle.badgeIcon} size={10} color="#fff" />
                    <Text style={styles.vipPillText}>VIP</Text>
                  </TouchableOpacity>
                )}
              </View>

              {!!user.bio && <Text style={styles.bioInline} numberOfLines={3}>{user.bio}</Text>}
            </View>
          </View>

          {/* Status chips row: tier / level / active */}
          <View style={styles.chipsRow}>
            <View style={[styles.chip, { backgroundColor: tierBg, borderColor: tierColor + '55' }]}>
              <Ionicons name="medal" size={12} color={tierColor} />
              <Text style={[styles.chipText, { color: tierColor }]}>{tierLabel}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: PALETTE.purpleSoft, borderColor: PALETTE.purple + '55' }]}>
              <Ionicons name="trophy" size={12} color={PALETTE.purple} />
              <Text style={[styles.chipText, { color: PALETTE.purple }]}>Level {(card as any)?.level ?? 1}</Text>
            </View>
            <View style={[styles.chip, { backgroundColor: PALETTE.greenSoft, borderColor: PALETTE.green + '55' }]}>
              <View style={[styles.greenDot, { backgroundColor: user.onlineStatus ? PALETTE.green : '#9ca3af' }]} />
              <Text style={[styles.chipText, { color: PALETTE.green }]}>{user.onlineStatus ? 'Active Now' : 'Offline'}</Text>
            </View>
          </View>
        </View>

        {/* ============ STATS CARD ============ */}
        <View style={styles.statsCard}>
          <StatItem
            icon="heart"
            color={PALETTE.pink}
            value={card?.likesCount ?? 0}
            label="Likes"
            testID="profile-stat-likes"
          />
          <View style={styles.statDivider} />
          <StatItem
            icon="people"
            color={PALETTE.blue}
            value={card?.friendCount ?? 0}
            label="Friends"
            testID="profile-stat-friends"
          />
          <View style={styles.statDivider} />
          <StatItem
            icon="newspaper"
            color={PALETTE.green}
            value={card?.postsCount ?? 0}
            label="Posts"
            onPress={() => setPostsOpen(true)}
            testID="profile-stat-posts"
          />
          <View style={styles.statDivider} />
          <StatItem
            icon="logo-bitcoin"
            color={PALETTE.gold}
            value={user.coins}
            label="Coins"
            testID="profile-stat-coins"
          />
        </View>

        {/* ============ VIP ELITE BANNER ============ */}
        <TouchableOpacity
          onPress={() => setVipModalOpen(true)}
          activeOpacity={0.92}
          style={styles.vipBanner}
          testID="profile-vip-cta"
        >
          <LinearGradient
            colors={
              user.vipTier === 'elite'
                ? ['#2a0e2e', '#7c2d12', '#fbbf24']
                : user.vipTier === 'pro'
                  ? ['#1e1b4b', '#4c1d95', '#a78bfa']
                  : ['#3b0764', '#7c3aed', '#fbbf24']
            }
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={styles.vipBannerGrad}
          >
            <View style={styles.vipDiamond}>
              <Ionicons name="diamond" size={22} color="#fde68a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.vipBannerTitle}>
                {user.vipTier === 'elite' ? 'VIP Elite' : user.vipTier === 'pro' ? 'VIP Pro' : 'Unlock VIP'}
                <Text style={styles.vipBannerStatus}>{user.vipTier ? ' — Active' : ''}</Text>
              </Text>
              <Text style={styles.vipBannerSub} numberOfLines={2}>
                {user.vipTier
                  ? 'Enjoy all premium perks and exclusive benefits.'
                  : 'Custom aura, badges, name color, larger avatar and more.'}
              </Text>
            </View>
            <LinearGradient
              colors={['#f472b6', '#ec4899']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.vipManageBtn}
            >
              <Text style={styles.vipManageText}>{user.vipTier ? 'Manage' : 'Subscribe'}</Text>
            </LinearGradient>
          </LinearGradient>
        </TouchableOpacity>

        {/* ============ VIEW POSTS PILL ============ */}
        <TouchableOpacity
          onPress={() => setPostsOpen(true)}
          activeOpacity={0.85}
          style={styles.viewPostsPill}
          testID="profile-view-posts"
        >
          <Ionicons name="newspaper" size={15} color="#fff" />
          <Text style={styles.viewPostsText}>View Posts</Text>
          <View style={styles.viewPostsCount}>
            <Text style={styles.viewPostsCountText}>{card?.postsCount ?? 0}</Text>
          </View>
        </TouchableOpacity>

        {/* ============ EDIT MODE FORM ============ */}
        {editing && (
          <View style={styles.editCard}>
            <Text style={styles.cardHeading}>Edit Profile</Text>
            <TouchableOpacity
              onPress={() => pickImage('bannerUrl')}
              activeOpacity={0.85}
              style={styles.changeBannerCta}
              testID="change-banner-cta"
            >
              <Ionicons name="image" size={18} color={PALETTE.pink} />
              <View style={{ flex: 1 }}>
                <Text style={styles.changeBannerTitle}>Change Banner</Text>
                <Text style={styles.changeBannerSub}>Upload any image from your gallery</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={PALETTE.textSub} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Display Name</Text>
            <TextInput
              style={styles.editInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholderTextColor={PALETTE.textSub}
              testID="display-name-input"
            />

            <Text style={styles.fieldLabel}>Bio</Text>
            <TextInput
              style={[styles.editInput, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={4}
              placeholder="Tell us about yourself..."
              placeholderTextColor={PALETTE.textSub}
              testID="bio-input"
            />

            <View style={styles.editBtnRow}>
              <TouchableOpacity
                style={[styles.editBtn, styles.editBtnSecondary]}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.editBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.editBtn, styles.editBtnPrimary]}
                onPress={handleSave}
                disabled={saving}
                testID="save-profile-btn"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.editBtnPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ============ ABOUT ME (read-only mode) ============ */}
        {!editing && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeaderRow}>
              <View style={styles.infoIcon}>
                <Ionicons name="person" size={14} color={PALETTE.pink} />
              </View>
              <Text style={styles.cardHeading}>About Me</Text>
            </View>
            <Text style={styles.aboutBio}>{user.bio || 'I love meeting new people and having fun conversations. Let\'s vibe together! 💜'}</Text>

            <InfoLine label="Email" value={user.email} />
            {memberSince && <InfoLine label="Member Since" value={memberSince} />}
            <InfoLine label="ID" value={`#GCV-${user.id.slice(-6).toUpperCase()}`} />
          </View>
        )}

        {/* ============ MY BADGES ============ */}
        {!!card?.badges?.length && (
          <View style={styles.infoCard}>
            <View style={styles.infoHeaderRow}>
              <View style={[styles.infoIcon, { backgroundColor: PALETTE.purpleSoft }]}>
                <Ionicons name="ribbon" size={14} color={PALETTE.purple} />
              </View>
              <Text style={styles.cardHeading}>My Badges</Text>
              <View style={{ flex: 1 }} />
              <Text style={styles.viewAll}>View All</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesScroll}>
              {card.badges.map((b) => (
                <View key={b.id} style={styles.badgeTile}>
                  <LinearGradient
                    colors={[(b.color || PALETTE.purple) + 'cc', (b.color || PALETTE.purple)]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.badgeShield}
                  >
                    <Ionicons name={b.icon as any} size={28} color="#fff" />
                  </LinearGradient>
                  <Text style={styles.badgeLabel} numberOfLines={1}>{b.label}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Logout (soft, secondary) */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <VipShopModal visible={vipModalOpen} onClose={() => setVipModalOpen(false)} />

      {/* Posts modal */}
      <Modal visible={postsOpen} animationType="slide" onRequestClose={() => setPostsOpen(false)}>
        <SafeAreaView style={[styles.container, { backgroundColor: PALETTE.bg }]} edges={['top']}>
          <View style={styles.postsTopBar}>
            <TouchableOpacity onPress={() => setPostsOpen(false)} style={styles.postsBackBtn} testID="profile-posts-back">
              <Ionicons name="arrow-back" size={22} color={PALETTE.text} />
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

/* ---------- Helpers ---------- */
function StatItem({
  icon, color, value, label, onPress, testID,
}: { icon: any; color: string; value: number | string; label: string; onPress?: () => void; testID?: string }) {
  const Container: any = onPress ? TouchableOpacity : View;
  return (
    <Container
      activeOpacity={0.85}
      onPress={onPress}
      style={styles.statItem}
      testID={testID}
    >
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.statValue, { color: PALETTE.text }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Container>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLineLabel}>{label}</Text>
      <View style={styles.infoLineDots} />
      <Text style={styles.infoLineValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

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
    return <View style={styles.postsPlaceholder}><ActivityIndicator color={PALETTE.pink} /></View>;
  }
  if (posts.length === 0) {
    return (
      <View style={styles.postsPlaceholder}>
        <Ionicons name="newspaper-outline" size={48} color={PALETTE.textSub} />
        <Text style={styles.postsPlaceholderTitle}>No posts yet</Text>
        <Text style={styles.postsPlaceholderText}>Posts you share on a Board will show up here.</Text>
      </View>
    );
  }
  return (
    <View style={styles.postsList}>
      {posts.map((p) => (
        <View key={p.id} style={styles.postCard} testID={`my-post-${p.id}`}>
          {p.imageUrl ? <Image source={{ uri: p.imageUrl }} style={styles.postImage} contentFit="cover" /> : null}
          {p.text ? <Text style={styles.postText}>{p.text}</Text> : null}
          <View style={styles.postMetaRow}>
            <View style={styles.postMetaItem}>
              <Ionicons name="heart" size={14} color={PALETTE.pink} />
              <Text style={styles.postMetaText}>{p.likeCount ?? 0}</Text>
            </View>
            <View style={styles.postMetaItem}>
              <Ionicons name="chatbubble" size={14} color={PALETTE.purple} />
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

/* ---------- Styles ---------- */
const BANNER_HEIGHT = 200;
const AVATAR_SIZE = 110;
const AVATAR_RADIUS = 18; // square with soft corners (matches chat avatar treatment)

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PALETTE.bg },
  scroll: { paddingBottom: SPACING.xl * 2 },

  /* Banner */
  bannerWrap: {
    width: '100%',
    height: BANNER_HEIGHT,
    backgroundColor: '#fbcfe8',
    overflow: 'hidden',
  },
  bannerImg: { width: '100%', height: '100%' },
  bannerEditPill: {
    position: 'absolute',
    top: SPACING.sm,
    left: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31,29,43,0.55)',
  },
  bannerEditText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pencilBtn: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    // @ts-ignore
    boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
  },

  /* Identity card overlapping the banner */
  identityCard: {
    marginTop: -56,
    marginHorizontal: SPACING.md,
    backgroundColor: PALETTE.card,
    borderRadius: 22,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: PALETTE.border,
    // @ts-ignore
    boxShadow: '0 18px 40px rgba(168,85,247,0.18), 0 4px 12px rgba(15,23,42,0.06)',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  avatarHalo: {
    width: AVATAR_SIZE + 14,
    height: AVATAR_SIZE + 14,
    borderRadius: AVATAR_RADIUS + 6,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarRing: {
    width: AVATAR_SIZE + 10,
    height: AVATAR_SIZE + 10,
    borderRadius: AVATAR_RADIUS + 4,
    padding: 4,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#f0abfc',
    // @ts-ignore — soft purple/pink aura glow
    boxShadow: '0 0 0 3px rgba(244,114,182,0.25), 0 0 28px rgba(168,85,247,0.45)',
  },
  avatarInner: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_RADIUS,
    backgroundColor: PALETTE.cardSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%', borderRadius: AVATAR_RADIUS },
  avatarCam: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: PALETTE.purple,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  identityCol: { flex: 1, minWidth: 0, gap: 4 },
  vipRibbon: { alignSelf: 'flex-start', borderRadius: 999, overflow: 'hidden', marginBottom: 4 },
  vipRibbonGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  vipRibbonText: { color: '#1a0f2e', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  nameLine: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  cursiveName: {
    color: PALETTE.pink,
    fontFamily: CURSIVE_FONT,
    fontSize: 30,
    fontWeight: '700',
    lineHeight: 34,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  username: { color: PALETTE.textSub, fontSize: 13, fontWeight: '700' },
  vipPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
  },
  vipPillText: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  bioInline: { color: PALETTE.text, fontSize: 13, lineHeight: 18, marginTop: 6 },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: SPACING.sm,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1,
  },
  chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },
  greenDot: { width: 6, height: 6, borderRadius: 3 },

  /* Stats card */
  statsCard: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.md,
    backgroundColor: PALETTE.card,
    borderRadius: 18,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: PALETTE.border,
    // @ts-ignore
    boxShadow: '0 8px 22px rgba(168,85,247,0.10)',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '900', marginTop: 2 },
  statLabel: { color: PALETTE.textSub, fontSize: 11, fontWeight: '700' },
  statDivider: { width: 1, height: 28, backgroundColor: PALETTE.border },

  /* VIP banner */
  vipBanner: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.md,
    borderRadius: 18,
    overflow: 'hidden',
    // @ts-ignore
    boxShadow: '0 14px 30px rgba(124,45,18,0.30)',
  },
  vipBannerGrad: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    paddingHorizontal: SPACING.md, paddingVertical: 14,
  },
  vipDiamond: {
    width: 46, height: 46, borderRadius: 12,
    backgroundColor: 'rgba(253,230,138,0.18)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(253,230,138,0.45)',
  },
  vipBannerTitle: { color: '#fde68a', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
  vipBannerStatus: { color: '#fff', fontWeight: '800' },
  vipBannerSub: { color: '#ffe4e6', fontSize: 11, opacity: 0.92, marginTop: 2 },
  vipManageBtn: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  vipManageText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  /* View posts pill */
  viewPostsPill: {
    flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8,
    marginTop: SPACING.md,
    paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: PALETTE.purple,
    // @ts-ignore
    boxShadow: '0 8px 18px rgba(168,85,247,0.40)',
  },
  viewPostsText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  viewPostsCount: {
    paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999,
    backgroundColor: '#fff', minWidth: 24, alignItems: 'center',
  },
  viewPostsCountText: { color: PALETTE.purple, fontSize: 11, fontWeight: '900' },

  /* Info / About card */
  infoCard: {
    marginTop: SPACING.md, marginHorizontal: SPACING.md,
    backgroundColor: PALETTE.card,
    borderRadius: 18, padding: SPACING.md,
    borderWidth: 1, borderColor: PALETTE.border,
    // @ts-ignore
    boxShadow: '0 6px 16px rgba(15,23,42,0.06)',
  },
  infoHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  infoIcon: {
    width: 24, height: 24, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: PALETTE.pinkSoft,
  },
  cardHeading: { color: PALETTE.text, fontSize: 14, fontWeight: '800' },
  viewAll: { color: PALETTE.purple, fontSize: 12, fontWeight: '800' },
  aboutBio: { color: PALETTE.text, fontSize: 13, lineHeight: 19, marginBottom: 10 },
  infoLine: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: PALETTE.border,
    gap: 8,
  },
  infoLineLabel: { color: PALETTE.textSub, fontSize: 12, fontWeight: '700' },
  infoLineDots: { flex: 1, borderBottomWidth: 1, borderBottomColor: PALETTE.border, borderStyle: 'dotted', height: 1 },
  infoLineValue: { color: PALETTE.text, fontSize: 12, fontWeight: '700' },

  /* Badges */
  badgesScroll: { gap: 10, paddingVertical: 4 },
  badgeTile: { alignItems: 'center', width: 78, gap: 6 },
  badgeShield: {
    width: 64, height: 70,
    borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    // @ts-ignore
    boxShadow: '0 6px 14px rgba(0,0,0,0.12)',
  },
  badgeLabel: { color: PALETTE.text, fontSize: 10, fontWeight: '800', textAlign: 'center' },

  /* Edit card */
  editCard: {
    marginTop: SPACING.md, marginHorizontal: SPACING.md,
    backgroundColor: PALETTE.card,
    borderRadius: 18, padding: SPACING.md,
    borderWidth: 1, borderColor: PALETTE.border,
    // @ts-ignore
    boxShadow: '0 6px 16px rgba(15,23,42,0.06)',
  },
  changeBannerCta: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingHorizontal: 12, paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: PALETTE.pinkSoft,
    borderWidth: 1.5, borderColor: PALETTE.pink + '55',
    marginVertical: 8,
  },
  changeBannerTitle: { color: PALETTE.pink, fontSize: 13, fontWeight: '900' },
  changeBannerSub: { color: PALETTE.textSub, fontSize: 11, marginTop: 2 },
  fieldLabel: { color: PALETTE.text, fontSize: 13, fontWeight: '800', marginTop: 8, marginBottom: 6 },
  editInput: {
    backgroundColor: PALETTE.cardSubtle,
    borderRadius: 12,
    padding: SPACING.md,
    color: PALETTE.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: PALETTE.border,
    // @ts-ignore
    outlineStyle: 'none',
  },
  textArea: { height: 100, textAlignVertical: 'top' },
  editBtnRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  editBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  editBtnPrimary: { backgroundColor: PALETTE.purple },
  editBtnSecondary: { backgroundColor: PALETTE.cardSubtle, borderWidth: 1, borderColor: PALETTE.border },
  editBtnPrimaryText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  editBtnSecondaryText: { color: PALETTE.textSub, fontSize: 14, fontWeight: '800' },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
    marginTop: SPACING.md, marginHorizontal: SPACING.md,
    borderRadius: 14,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#fee2e2',
  },
  logoutText: { color: '#ef4444', fontSize: 14, fontWeight: '800' },

  /* Posts modal */
  postsTopBar: {
    height: 48, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: SPACING.sm,
  },
  postsBackBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  postsTopTitle: { color: PALETTE.text, fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  postsList: { gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm },
  postCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: SPACING.md,
    borderWidth: 1, borderColor: PALETTE.border, gap: SPACING.sm,
  },
  postImage: { width: '100%', height: 200, borderRadius: 10, backgroundColor: '#f1f5f9' },
  postText: { color: PALETTE.text, fontSize: 15, lineHeight: 21 },
  postMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  postMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postMetaText: { color: PALETTE.textSub, fontSize: 13, fontWeight: '700' },
  postMetaTime: { color: '#94a3b8', fontSize: 12, marginLeft: 'auto' },
  postsPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: SPACING.xl * 2 },
  postsPlaceholderTitle: { color: PALETTE.text, fontSize: 16, fontWeight: '700', marginTop: SPACING.sm },
  postsPlaceholderText: { color: PALETTE.textSub, fontSize: 13, textAlign: 'center', marginTop: 4, paddingHorizontal: SPACING.lg },
});
