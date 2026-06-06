import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/src/constants/theme';
import { VIP_TIERS } from '@/src/utils/vip';
import api from '@/src/api/client';
import { formatDistanceToNow } from 'date-fns';

interface RoomActivity {
  id: string;
  roomId: string;
  activityType: string;
  actorId: string;
  actorName: string;
  actorPhoto?: string;
  actorVipTier?: string;
  targetId?: string;
  targetName?: string;
  targetPhoto?: string;
  metadata?: {
    postText?: string;
    roomName?: string;
    tier?: string;
    tierName?: string;
    giftId?: string;
    giftName?: string;
    giftIcon?: string;
  };
  createdAt: string;
}

interface FeedTabProps {
  roomId: string;
  active: boolean;
}

export default function FeedTab({ roomId, active }: FeedTabProps) {
  const [activities, setActivities] = useState<RoomActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActivities = useCallback(async () => {
    try {
      const response = await api.get(`/rooms/${roomId}/activities?limit=50`);
      setActivities(response.data);
    } catch (error) {
      console.log('Error fetching activities:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (active) {
      fetchActivities();
    }
  }, [active, fetchActivities]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchActivities();
  }, [fetchActivities]);

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'post_created':
        return { name: 'create-outline', color: COLORS.primary };
      case 'post_liked':
        return { name: 'heart', color: '#EF4444' };
      case 'user_joined':
        return { name: 'enter-outline', color: '#10B981' };
      case 'vip_purchased':
        return { name: 'diamond', color: '#F59E0B' };
      case 'vip_gifted':
        return { name: 'gift', color: '#EC4899' };
      case 'friend_added':
        return { name: 'people', color: '#3B82F6' };
      default:
        return { name: 'ellipse', color: COLORS.textSecondary };
    }
  };

  const getActivityMessage = (activity: RoomActivity) => {
    switch (activity.activityType) {
      case 'post_created':
        return 'created a new post';
      case 'post_liked':
        return `liked ${activity.targetName ? `${activity.targetName}'s` : 'a'} post`;
      case 'user_joined':
        return 'joined the room';
      case 'vip_purchased':
        return `became a ${activity.metadata?.tierName || 'VIP'} member`;
      case 'vip_gifted':
        return `sent a gift to ${activity.targetName || 'someone'}`;
      case 'friend_added':
        return `added ${activity.targetName || 'someone'} as a friend`;
      default:
        return 'did something';
    }
  };

  const getVipStyle = (tier?: string) => {
    if (!tier) return null;
    const vipConfig = VIP_TIERS[tier as keyof typeof VIP_TIERS];
    if (!vipConfig) return null;
    return {
      color: vipConfig.color,
      fontWeight: '700' as const,
    };
  };

  const renderActivity = ({ item }: { item: RoomActivity }) => {
    const icon = getActivityIcon(item.activityType);
    const message = getActivityMessage(item);
    const vipStyle = getVipStyle(item.actorVipTier);
    const timeAgo = formatDistanceToNow(new Date(item.createdAt), { addSuffix: true });

    return (
      <View style={styles.activityItem}>
        <View style={styles.activityLeft}>
          {item.actorPhoto ? (
            <Image source={{ uri: item.actorPhoto }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={20} color={COLORS.textSecondary} />
            </View>
          )}
          <View style={[styles.iconBadge, { backgroundColor: icon.color + '20' }]}>
            <Ionicons name={icon.name as any} size={12} color={icon.color} />
          </View>
        </View>

        <View style={styles.activityContent}>
          <Text style={styles.activityText}>
            <Text style={[styles.actorName, vipStyle]}>{item.actorName}</Text>
            {' '}{message}
          </Text>
          
          {/* Show preview text for posts */}
          {item.activityType === 'post_created' && item.metadata?.postText && (
            <Text style={styles.previewText} numberOfLines={2}>
              "{item.metadata.postText}"
            </Text>
          )}

          {/* Show gift icon for gifts */}
          {item.activityType === 'vip_gifted' && item.metadata?.giftIcon && (
            <View style={styles.giftPreview}>
              <Text style={styles.giftIcon}>{item.metadata.giftIcon}</Text>
              <Text style={styles.giftName}>{item.metadata.giftName}</Text>
            </View>
          )}

          {/* Show target user for gifts */}
          {item.activityType === 'vip_gifted' && item.targetPhoto && (
            <View style={styles.targetUser}>
              <Image source={{ uri: item.targetPhoto }} style={styles.targetAvatar} />
              <Text style={styles.targetName}>{item.targetName}</Text>
            </View>
          )}

          <Text style={styles.timestamp}>{timeAgo}</Text>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="newspaper-outline" size={48} color={COLORS.textSecondary} />
      <Text style={styles.emptyTitle}>No Activity Yet</Text>
      <Text style={styles.emptyText}>
        Activities like posts, likes, joins, and gifts will appear here.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={activities.length === 0 ? styles.emptyList : styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityItem: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  activityLeft: {
    position: 'relative',
    marginRight: SPACING.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    backgroundColor: COLORS.cardBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  activityContent: {
    flex: 1,
    justifyContent: 'center',
  },
  activityText: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
  actorName: {
    fontWeight: '600',
    color: COLORS.text,
  },
  previewText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    marginTop: SPACING.xs,
    paddingLeft: SPACING.sm,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
  },
  giftPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  giftIcon: {
    fontSize: 18,
    marginRight: SPACING.xs,
  },
  giftName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  targetUser: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  targetAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: SPACING.xs,
  },
  targetName: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  timestamp: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
