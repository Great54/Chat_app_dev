import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

interface Friend {
  id: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  level: number;
  onlineStatus: boolean;
}

interface FriendRequest {
  requestId: string;
  senderId?: string;
  receiverId?: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  level: number;
  createdAt: string;
}

interface SearchUser {
  id: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  level: number;
  onlineStatus: boolean;
  friendStatus: 'none' | 'sent' | 'received' | 'friends';
}

type TabType = 'friends' | 'requests' | 'search';

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
      { text: 'OK', onPress: onConfirm, style: 'destructive' },
    ]);
  }
};

export default function FriendsScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('friends');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [friendsRes, pendingRes, sentRes] = await Promise.all([
        api.get('/friends/list'),
        api.get('/friends/pending'),
        api.get('/friends/sent'),
      ]);
      setFriends(friendsRes.data);
      setPendingRequests(pendingRes.data);
      setSentRequests(sentRes.data);
    } catch (error) {
      console.error('Failed to load friends data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    if (searchQuery.length >= 2) await handleSearch(searchQuery);
    setRefreshing(false);
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/search/users?q=${encodeURIComponent(query)}`);
      setSearchResults(res.data);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleSendRequest = async (userId: string) => {
    try {
      await api.post('/friends/request', { receiverId: userId });
      showAlert('Success', 'Friend request sent!');
      await handleSearch(searchQuery);
      await loadData();
    } catch (error: any) {
      showAlert('Error', error.response?.data?.detail || 'Failed to send request');
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await api.post(`/friends/accept/${requestId}`);
      showAlert('Success', 'Friend request accepted!');
      await loadData();
    } catch (error: any) {
      showAlert('Error', error.response?.data?.detail || 'Failed to accept');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await api.post(`/friends/reject/${requestId}`);
      await loadData();
    } catch (error: any) {
      showAlert('Error', error.response?.data?.detail || 'Failed to reject');
    }
  };

  const handleRemoveFriend = (friendId: string, name: string) => {
    showConfirm('Remove Friend', `Remove ${name} from your friends?`, async () => {
      try {
        await api.delete(`/friends/${friendId}`);
        await loadData();
      } catch (error: any) {
        showAlert('Error', error.response?.data?.detail || 'Failed to remove friend');
      }
    });
  };

  const renderAvatar = (photoUrl?: string, size: number = 48) => (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name="person" size={size * 0.5} color={COLORS.primary} />
    </View>
  );

  const renderFriendsList = () => (
    <>
      {friends.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptyText}>
            Search for users or accept requests to build your network!
          </Text>
        </View>
      ) : (
        friends.map((friend) => (
          <View key={friend.id} style={styles.userCard} testID={`friend-${friend.id}`}>
            {renderAvatar(friend.photoUrl)}
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>{friend.displayName}</Text>
              <Text style={styles.username}>@{friend.username} · Lv {friend.level}</Text>
            </View>
            <View style={styles.statusContainer}>
              <View
                style={[
                  styles.onlineDot,
                  { backgroundColor: friend.onlineStatus ? COLORS.success : COLORS.textSecondary },
                ]}
              />
              <TouchableOpacity
                onPress={() => handleRemoveFriend(friend.id, friend.displayName)}
                style={styles.iconButton}
                testID={`remove-friend-${friend.id}`}
              >
                <Ionicons name="person-remove" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </>
  );

  const renderRequests = () => (
    <>
      {pendingRequests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Received ({pendingRequests.length})</Text>
          {pendingRequests.map((req) => (
            <View key={req.requestId} style={styles.userCard} testID={`pending-${req.requestId}`}>
              {renderAvatar(req.photoUrl)}
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{req.displayName}</Text>
                <Text style={styles.username}>@{req.username} · Lv {req.level}</Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAccept(req.requestId)}
                  testID={`accept-${req.requestId}`}
                >
                  <Ionicons name="checkmark" size={18} color={COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => handleReject(req.requestId)}
                  testID={`reject-${req.requestId}`}
                >
                  <Ionicons name="close" size={18} color={COLORS.text} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </>
      )}

      {sentRequests.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Sent ({sentRequests.length})</Text>
          {sentRequests.map((req) => (
            <View key={req.requestId} style={styles.userCard}>
              {renderAvatar(req.photoUrl)}
              <View style={styles.userInfo}>
                <Text style={styles.displayName}>{req.displayName}</Text>
                <Text style={styles.username}>@{req.username} · Lv {req.level}</Text>
              </View>
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {pendingRequests.length === 0 && sentRequests.length === 0 && (
        <View style={styles.empty}>
          <Ionicons name="mail-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>No requests</Text>
          <Text style={styles.emptyText}>Friend requests will appear here</Text>
        </View>
      )}
    </>
  );

  const renderSearch = () => (
    <>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by username..."
          placeholderTextColor={COLORS.textSecondary}
          value={searchQuery}
          onChangeText={handleSearch}
          autoCapitalize="none"
          testID="search-input"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchQuery('');
              setSearchResults([]);
            }}
          >
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {searchQuery.length < 2 ? (
        <View style={styles.empty}>
          <Ionicons name="search-outline" size={64} color={COLORS.textSecondary} />
          <Text style={styles.emptyTitle}>Find friends</Text>
          <Text style={styles.emptyText}>Type at least 2 characters to search</Text>
        </View>
      ) : searchResults.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No users found for "{searchQuery}"</Text>
        </View>
      ) : (
        searchResults.map((user) => (
          <View key={user.id} style={styles.userCard} testID={`search-${user.id}`}>
            {renderAvatar(user.photoUrl)}
            <View style={styles.userInfo}>
              <Text style={styles.displayName}>{user.displayName}</Text>
              <Text style={styles.username}>@{user.username} · Lv {user.level}</Text>
            </View>
            {user.friendStatus === 'none' && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => handleSendRequest(user.id)}
                testID={`add-${user.id}`}
              >
                <Ionicons name="person-add" size={16} color={COLORS.text} />
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            )}
            {user.friendStatus === 'sent' && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Sent</Text>
              </View>
            )}
            {user.friendStatus === 'received' && (
              <View style={[styles.pendingBadge, { backgroundColor: COLORS.warning }]}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
            {user.friendStatus === 'friends' && (
              <View style={[styles.pendingBadge, { backgroundColor: COLORS.success }]}>
                <Ionicons name="checkmark" size={14} color={COLORS.text} />
              </View>
            )}
          </View>
        ))
      )}
    </>
  );

  const totalRequests = pendingRequests.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'friends' && styles.tabActive]}
          onPress={() => setActiveTab('friends')}
          testID="tab-friends"
        >
          <Ionicons
            name="people"
            size={18}
            color={activeTab === 'friends' ? COLORS.text : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'friends' && styles.tabTextActive]}>
            Friends {friends.length > 0 ? `(${friends.length})` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
          onPress={() => setActiveTab('requests')}
          testID="tab-requests"
        >
          <Ionicons
            name="mail"
            size={18}
            color={activeTab === 'requests' ? COLORS.text : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Requests
          </Text>
          {totalRequests > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalRequests}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.tabActive]}
          onPress={() => setActiveTab('search')}
          testID="tab-search"
        >
          <Ionicons
            name="search"
            size={18}
            color={activeTab === 'search' ? COLORS.text : COLORS.textSecondary}
          />
          <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
            Find
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
      >
        {loading && !refreshing ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <>
            {activeTab === 'friends' && renderFriendsList()}
            {activeTab === 'requests' && renderRequests()}
            {activeTab === 'search' && renderSearch()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  tabs: {
    flexDirection: 'row',
    padding: SPACING.sm,
    gap: SPACING.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    backgroundColor: COLORS.cardBg,
    gap: 4,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: COLORS.text,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '700',
  },
  content: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    textTransform: 'uppercase',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    padding: SPACING.sm,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  avatar: {
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  username: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  iconButton: {
    padding: 6,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  acceptButton: {
    backgroundColor: COLORS.success,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectButton: {
    backgroundColor: COLORS.error,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  pendingBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pendingText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.lg,
  },
});
