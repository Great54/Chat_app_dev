import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  readStatus: boolean;
  createdAt: string;
}

const showConfirm = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'OK', onPress: onConfirm },
    ]);
  }
};

const formatTime = (dateString: string): string => {
  const now = new Date();
  const date = new Date(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
};

const getIconForType = (type: string): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'friend_request':
      return 'person-add';
    case 'friend_accepted':
      return 'people';
    case 'room_invite':
      return 'planet';
    case 'achievement':
      return 'trophy';
    case 'game':
      return 'game-controller';
    case 'coin':
      return 'wallet';
    case 'xp':
      return 'trending-up';
    default:
      return 'notifications';
  }
};

const getColorForType = (type: string): string => {
  switch (type) {
    case 'friend_request':
    case 'friend_accepted':
      return COLORS.primary;
    case 'achievement':
      return COLORS.warning;
    case 'game':
      return COLORS.accent;
    case 'coin':
      return COLORS.coin;
    case 'xp':
      return COLORS.xp;
    default:
      return COLORS.primary;
  }
};

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleMarkRead = async (notif: Notification) => {
    if (notif.readStatus) {
      // Navigate based on type
      handleNotificationAction(notif);
      return;
    }
    try {
      await api.post(`/notifications/${notif.id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notif.id ? { ...n, readStatus: true } : n))
      );
      handleNotificationAction(notif);
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const handleNotificationAction = (notif: Notification) => {
    if (notif.type === 'friend_request' || notif.type === 'friend_accepted') {
      router.push('/(tabs)/friends');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, readStatus: true })));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleDelete = (notifId: string) => {
    showConfirm('Delete', 'Delete this notification?', async () => {
      try {
        await api.delete(`/notifications/${notifId}`);
        setNotifications((prev) => prev.filter((n) => n.id !== notifId));
      } catch (error) {
        console.error('Failed to delete:', error);
      }
    });
  };

  const unreadCount = notifications.filter((n) => !n.readStatus).length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          testID="notif-back-button"
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            style={styles.markAllButton}
            testID="mark-all-read-btn"
          >
            <Text style={styles.markAllText}>Mark all</Text>
          </TouchableOpacity>
        )}
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
        {loading ? (
          <View style={styles.empty}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={64} color={COLORS.textSecondary} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyText}>You're all caught up!</Text>
          </View>
        ) : (
          notifications.map((notif) => (
            <TouchableOpacity
              key={notif.id}
              style={[styles.notifCard, !notif.readStatus && styles.notifCardUnread]}
              onPress={() => handleMarkRead(notif)}
              onLongPress={() => handleDelete(notif.id)}
              testID={`notif-${notif.id}`}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: getColorForType(notif.type) + '20' },
                ]}
              >
                <Ionicons
                  name={getIconForType(notif.type)}
                  size={20}
                  color={getColorForType(notif.type)}
                />
              </View>

              <View style={styles.notifInfo}>
                <View style={styles.notifHeader}>
                  <Text style={styles.notifTitle} numberOfLines={1}>
                    {notif.title}
                  </Text>
                  {!notif.readStatus && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notifBody} numberOfLines={2}>
                  {notif.body}
                </Text>
                <Text style={styles.notifTime}>{formatTime(notif.createdAt)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}

        {notifications.length > 0 && (
          <Text style={styles.hint}>Long-press to delete</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    marginRight: SPACING.sm,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
    fontWeight: '600',
  },
  markAllButton: {
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
  },
  markAllText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  notifCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
    opacity: 0.7,
  },
  notifCardUnread: {
    opacity: 1,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifInfo: {
    flex: 1,
  },
  notifHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: 4,
  },
  notifTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  notifBody: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 3,
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
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.md,
    fontStyle: 'italic',
  },
});
