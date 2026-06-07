import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';
import { VIP_STYLES } from '@/src/utils/vip';
import type { ProfileCard } from '@/src/types/profile';
import { getCachedProfile, setCachedProfile, invalidateProfile } from '@/src/utils/profileCache';
import { useProfilePopup } from '@/src/contexts/ProfilePopupContext';
import { useAuth } from '@/src/contexts/AuthContext';
import GiftSendModal from '@/src/components/GiftSendModal';
import PrivateMessagesModal from '@/src/components/PrivateMessagesModal';

const ALL_TABS = [
  { id: 'about',   label: 'About',   icon: 'information-circle-outline' as const },
  { id: 'friends', label: 'Friends', icon: 'people-outline' as const },
  { id: 'photos',  label: 'Photos',  icon: 'images-outline' as const },
  { id: 'posts',   label: 'Posts',   icon: 'newspaper-outline' as const },
];

type TabId = typeof ALL_TABS[number]['id'];

interface FriendListItem {
  id: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  vipTier?: 'pro' | 'elite' | null;
  onlineStatus: boolean;
}

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function ProfileViewScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const userId = params.id;
  const { user: me } = useAuth();
  const { openProfile } = useProfilePopup();

  const [profile, setProfile] = useState<ProfileCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('about');
  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [dmOpen, setDmOpen] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const tabAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;

  const loadProfile = useCallback(async (id: string) => {
    const cached = getCachedProfile(id);
    if (cached) {
      setProfile(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const res = await api.get(`/users/${id}/profile-card`);
      setProfile(res.data);
      setCachedProfile(id, res.data);
    } catch (e) {
      console.error('Failed to load profile', e);
      showAlert('Error', 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFriends = useCallback(async (id: string) => {
    setFriendsLoading(true);
    try {
      const res = await api.get(`/users/${id}/friends`);
      setFriends(res.data);
    } catch (e) {
      console.error('Failed to load friends', e);
    } finally {
      setFriendsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userId) loadProfile(userId);
  }, [userId, loadProfile]);

  useEffect(() => {
    if (!loading && profile) {
      Animated.stagger(80, [
        Animated.spring(headerAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 50 }),
        Animated.spring(tabAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 50 }),
        Animated.spring(contentAnim, { toValue: 1, useNativeDriver: true, friction: 8, tension: 50 }),
      ]).start();
    }
  }, [loading, profile, headerAnim, tabAnim, contentAnim]);

  useEffect(() => {
    if (activeTab === 'friends' && profile && friends.length === 0) {
      loadFriends(profile.id);
    }
  }, [activeTab, profile, friends.length, loadFriends]);

  const handleTabChange = (tab: TabId) => {
    if (tab === activeTab) return;
    Animated.timing(contentAnim, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setActiveTab(tab);
      Animated.spring(contentAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 60,
      }).start();
    });
  };

  // --- Quick actions ---
  const handleAddFriend = async () => {
    if (!profile) return;
    try {
      if (profile.friendStatus === 'none') {
        await api.post('/friends/request', { receiverId: profile.id });
      } else if (profile.friendStatus === 'received' && profile.friendRequestId) {
        await api.post(`/friends/accept/${profile.friendRequestId}`);
      }
      invalidateProfile(profile.id);
      await loadProfile(profile.id);
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed');
    }
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const vipStyle = profile.vipTier ? VIP_STYLES[profile.vipTier] : null;
  const headerTranslate = headerAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] });
  const tabTranslate = tabAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  const contentTranslate = contentAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });

  // Privacy: only the profile owner can see the Friends list tab.
  const TABS = profile.isSelf ? ALL_TABS : ALL_TABS.filter((t) => t.id !== 'friends');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="profile-back">
          <Ionicons name="arrow-back" size={22} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{profile.displayName}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Animated.View style={{ opacity: headerAnim, transform: [{ translateY: headerTranslate }] }}>
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
              colors={['transparent', 'rgba(0,0,0,0.6)', COLORS.background]}
              style={StyleSheet.absoluteFillObject}
            />
          </View>

          <View style={styles.avatarRow}>
            {vipStyle ? (
              <LinearGradient
                colors={vipStyle.borderColors as [string, string, ...string[]]}
                style={styles.avatarFrame}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.avatarInner}>
                  {profile.photoUrl ? (
                    <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={56} color={COLORS.textSecondary} />
                  )}
                </View>
              </LinearGradient>
            ) : (
              <View style={[styles.avatarFrame, { backgroundColor: COLORS.cardBg, padding: 4 }]}>
                <View style={styles.avatarInner}>
                  {profile.photoUrl ? (
                    <Image source={{ uri: profile.photoUrl }} style={styles.avatarImg} />
                  ) : (
                    <Ionicons name="person" size={56} color={COLORS.textSecondary} />
                  )}
                </View>
              </View>
            )}
            <View
              style={[
                styles.bigOnlineDot,
                { backgroundColor: profile.onlineStatus ? COLORS.success : '#666' },
              ]}
            />
            {vipStyle && (
              <View style={[styles.crown, { backgroundColor: vipStyle.crownColor }]}>
                <Ionicons name={vipStyle.badgeIcon} size={16} color={COLORS.background} />
              </View>
            )}
          </View>

          <View style={styles.identity}>
            <View style={styles.nameLine}>
              <Text style={[styles.displayName, vipStyle && { color: vipStyle.nameColor }]} numberOfLines={1}>
                {profile.displayName}
              </Text>
              {profile.badges.map((b) => (
                <View key={b.id} style={[styles.badge, { backgroundColor: b.color }]}>
                  <Ionicons name={b.icon as any} size={11} color={COLORS.background} />
                  <Text style={styles.badgeText}>{b.label}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.username}>@{profile.username}</Text>

            <View style={styles.statsRow}>
              <View style={[styles.statCircle, styles.statCircleCoins]} testID="profile-stat-coins">
                <Text style={[styles.statCircleValue, { color: '#a16207' }]}>{profile.coins}</Text>
                <Text style={[styles.statCircleLabel, { color: '#a16207' }]}>Coins</Text>
              </View>
              <View style={[styles.statCircle, styles.statCircleFriends]} testID="profile-stat-friends">
                <Text style={[styles.statCircleValue, { color: '#1e40af' }]}>{profile.friendCount}</Text>
                <Text style={[styles.statCircleLabel, { color: '#1e40af' }]}>Friends</Text>
              </View>
              <View style={[styles.statCircle, styles.statCircleLikes]} testID="profile-stat-likes">
                <Text style={[styles.statCircleValue, { color: '#9d174d' }]}>{profile.likesCount ?? 0}</Text>
                <Text style={[styles.statCircleLabel, { color: '#9d174d' }]}>Likes</Text>
              </View>
              <View style={[styles.statCircle, styles.statCirclePosts]} testID="profile-stat-posts">
                <Text style={[styles.statCircleValue, { color: '#166534' }]}>{profile.postsCount ?? 0}</Text>
                <Text style={[styles.statCircleLabel, { color: '#166534' }]}>Posts</Text>
              </View>
            </View>

            {/* Quick action bar */}
            {!profile.isSelf && (
              <View style={styles.quickActions}>
                <TouchableOpacity
                  onPress={handleAddFriend}
                  style={[
                    styles.quickBtn,
                    profile.friendStatus === 'friends' && { backgroundColor: '#1f2a1f', borderColor: COLORS.success },
                  ]}
                  testID="profile-quick-friend"
                >
                  <Ionicons
                    name={
                      profile.friendStatus === 'friends'
                        ? 'checkmark-circle'
                        : profile.friendStatus === 'sent'
                          ? 'time'
                          : 'person-add'
                    }
                    size={16}
                    color={profile.friendStatus === 'friends' ? COLORS.success : COLORS.text}
                  />
                  <Text
                    style={[
                      styles.quickBtnText,
                      profile.friendStatus === 'friends' && { color: COLORS.success },
                    ]}
                  >
                    {profile.friendStatus === 'friends'
                      ? 'Friends'
                      : profile.friendStatus === 'sent'
                        ? 'Requested'
                        : profile.friendStatus === 'received'
                          ? 'Accept'
                          : 'Add Friend'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setDmOpen(true)} style={styles.quickBtn} testID="profile-quick-msg">
                  <Ionicons name="chatbubble-ellipses" size={16} color={COLORS.text} />
                  <Text style={styles.quickBtnText}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setGiftOpen(true)} style={styles.quickBtn} testID="profile-quick-gift">
                  <Ionicons name="gift" size={16} color={COLORS.accent} />
                  <Text style={styles.quickBtnText}>Gift</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Tabs */}
        <Animated.View
          style={[
            styles.tabsRow,
            { opacity: tabAnim, transform: [{ translateY: tabTranslate }] },
          ]}
        >
          {TABS.map((t) => {
            const isActive = t.id === activeTab;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => handleTabChange(t.id)}
                style={[styles.tab, isActive && styles.tabActive]}
                testID={`profile-tab-${t.id}`}
              >
                <Ionicons
                  name={t.icon}
                  size={16}
                  color={isActive ? COLORS.primary : COLORS.textSecondary}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>

        {/* Tab content */}
        <Animated.View
          style={[
            styles.tabContent,
            { opacity: contentAnim, transform: [{ translateY: contentTranslate }] },
          ]}
        >
          {activeTab === 'about' && <AboutTab profile={profile} />}

          {activeTab === 'friends' && (
            <FriendsTab
              loading={friendsLoading}
              friends={friends}
              onTapFriend={(id) => openProfile(id)}
            />
          )}

          {activeTab === 'photos' && (
            <View style={styles.placeholder}>
              <Ionicons name="images-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.placeholderTitle}>Photos coming soon</Text>
              <Text style={styles.placeholderText}>This user hasn't added any photos yet.</Text>
            </View>
          )}

          {activeTab === 'posts' && <PostsTab userId={profile.id} />}
        </Animated.View>
      </ScrollView>

      <GiftSendModal
        visible={giftOpen}
        onClose={() => setGiftOpen(false)}
        receiverId={profile.id}
        receiverName={profile.displayName}
      />
      <PrivateMessagesModal
        visible={dmOpen}
        onClose={() => setDmOpen(false)}
        initialUserId={profile.id}
      />
    </SafeAreaView>
  );
}

// ----- Sub-views -----
function AboutTab({ profile }: { profile: ProfileCard }) {
  const joined = profile.createdAt ? new Date(profile.createdAt) : null;
  return (
    <View style={styles.aboutWrap}>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Bio</Text>
        <Text style={styles.bioCursive}>{profile.bio || 'No bio yet.'}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoLabel}>Member since</Text>
        <Text style={styles.infoValue}>
          {joined ? joined.toLocaleDateString(undefined, { year: 'numeric', month: 'long' }) : 'Unknown'}
        </Text>
      </View>
      {profile.badges.length > 0 && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Badges</Text>
          <View style={styles.aboutBadgeRow}>
            {profile.badges.map((b) => (
              <View key={b.id} style={[styles.aboutBadge, { borderColor: b.color }]}>
                <Ionicons name={b.icon as any} size={14} color={b.color} />
                <Text style={[styles.aboutBadgeText, { color: b.color }]}>{b.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function PostsTab({ userId }: { userId: string }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await api.get(`/users/${userId}/posts`);
        if (!cancelled) setPosts(res.data || []);
      } catch (e) {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (posts.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="newspaper-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.placeholderTitle}>No posts yet</Text>
        <Text style={styles.placeholderText}>When this user posts on a Board, it'll show up here.</Text>
      </View>
    );
  }
  return (
    <View style={styles.postsWrap}>
      {posts.map((p) => (
        <View key={p.id} style={styles.postCard} testID={`post-card-${p.id}`}>
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

function FriendsTab({
  loading,
  friends,
  onTapFriend,
}: {
  loading: boolean;
  friends: FriendListItem[];
  onTapFriend: (id: string) => void;
}) {
  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }
  if (friends.length === 0) {
    return (
      <View style={styles.placeholder}>
        <Ionicons name="people-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.placeholderTitle}>No friends to show</Text>
        <Text style={styles.placeholderText}>Their friend list is empty.</Text>
      </View>
    );
  }

  return (
    <View style={styles.friendsList}>
      {friends.map((f) => {
        const vs = f.vipTier ? VIP_STYLES[f.vipTier] : null;
        return (
          <TouchableOpacity
            key={f.id}
            style={styles.friendCard}
            activeOpacity={0.8}
            onPress={() => onTapFriend(f.id)}
            testID={`friend-card-${f.id}`}
          >
            <View style={[styles.friendAvatar, vs && { borderColor: vs.borderColor, borderWidth: 2 }]}>
              {f.photoUrl ? (
                <Image source={{ uri: f.photoUrl }} style={styles.friendAvatarImg} />
              ) : (
                <Ionicons name="person" size={20} color={COLORS.textSecondary} />
              )}
              {f.onlineStatus && <View style={styles.friendOnlineDot} />}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.friendName} numberOfLines={1}>
                {f.displayName}
              </Text>
              <Text style={styles.friendUsername} numberOfLines={1}>@{f.username}</Text>
            </View>
            {vs && (
              <View style={[styles.friendBadge, { backgroundColor: vs.crownColor }]}>
                <Ionicons name={vs.badgeIcon} size={10} color={COLORS.background} />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ----- Styles -----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  topBar: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.sm,
    zIndex: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  scroll: {
    paddingBottom: SPACING.xl,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  banner: {
    width: '100%',
    height: 160,
    backgroundColor: COLORS.cardBg,
    position: 'relative',
    marginTop: -48, // Pull behind top bar
  },
  avatarRow: {
    alignSelf: 'center',
    marginTop: -65,
    position: 'relative',
  },
  avatarFrame: {
    width: 130,
    height: 130,
    borderRadius: 65,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.background,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
  },
  bigOnlineDot: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: COLORS.background,
  },
  crown: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: COLORS.background,
  },
  identity: {
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  displayName: {
    color: COLORS.text,
    fontSize: 38,
    fontWeight: '800',
    fontFamily: Platform.select({ web: '"Dancing Script", "Great Vibes", cursive', default: undefined }) as any,
    lineHeight: 44,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  username: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    justifyContent: 'space-around',
    alignItems: 'center',
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
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  statCircleCoins: {
    backgroundColor: '#fef3c7',
    borderColor: '#facc15',
    shadowColor: '#f59e0b',
  },
  statCircleFriends: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
    shadowColor: '#3b82f6',
  },
  statCircleLikes: {
    backgroundColor: '#fce7f3',
    borderColor: '#f472b6',
    shadowColor: '#ec4899',
  },
  statCirclePosts: {
    backgroundColor: '#dcfce7',
    borderColor: '#4ade80',
    shadowColor: '#22c55e',
  },
  statCircleValue: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  statCircleLabel: {
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.4,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValueSmall: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  smallStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2a2240',
    marginVertical: 4,
  },
  quickActions: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#1a1226',
    borderWidth: 1,
    borderColor: '#2a2240',
  },
  quickBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    backgroundColor: '#15101f',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2240',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#1f1830',
  },
  tabLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '800',
  },
  tabContent: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    minHeight: 200,
  },
  aboutWrap: {
    gap: SPACING.sm,
  },
  infoCard: {
    backgroundColor: '#15101f',
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#2a2240',
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  bioCursive: {
    color: '#fde68a',
    fontSize: 22,
    lineHeight: 30,
    fontFamily: Platform.select({ web: '"Dancing Script", "Great Vibes", cursive', default: undefined }) as any,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  postsWrap: {
    gap: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
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
  aboutBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: 4,
  },
  aboutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  aboutBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  placeholderTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.sm,
  },
  placeholderText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: SPACING.lg,
  },
  friendsList: {
    gap: SPACING.sm,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#15101f',
    borderRadius: 12,
    padding: SPACING.sm,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: '#2a2240',
  },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  friendAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  friendOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: '#15101f',
  },
  friendName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  friendUsername: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  friendBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
