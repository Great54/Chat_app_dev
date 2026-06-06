import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, SIZES } from '../constants/theme';
import { getVipStyle, VipTier } from '../utils/vip';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useProfilePopup } from '../contexts/ProfilePopupContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface BoardPost {
  id: string;
  roomId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoUrl?: string;
  authorVipTier?: VipTier;
  text: string;
  imageBase64?: string;
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  createdAt: string;
}

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoUrl?: string;
  authorVipTier?: VipTier;
  text: string;
  createdAt: string;
}

interface BoardTabProps {
  roomId: string;
  active: boolean;
}

export default function BoardTab({ roomId, active }: BoardTabProps) {
  const { user } = useAuth();
  const { openProfile } = useProfilePopup();
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Create post modal
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Comments modal
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<BoardPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);

  useEffect(() => {
    if (active && roomId) {
      loadPosts();
    }
  }, [active, roomId]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/rooms/${roomId}/posts`);
      console.log('Loaded posts:', JSON.stringify(response.data, null, 2));
      setPosts(response.data);
    } catch (error) {
      console.error('Failed to load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await api.get(`/rooms/${roomId}/posts`);
      setPosts(response.data);
    } catch (error) {
      console.error('Failed to refresh posts:', error);
    } finally {
      setRefreshing(false);
    }
  }, [roomId]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please allow access to your photo library');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setNewPostImage(base64);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostText.trim()) {
      Alert.alert('Error', 'Please write something for your post');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await api.post(`/rooms/${roomId}/posts`, {
        text: newPostText.trim(),
        imageBase64: newPostImage,
      });
      setPosts(prev => [response.data, ...prev]);
      setNewPostText('');
      setNewPostImage(null);
      setCreateModalVisible(false);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLikePost = async (postId: string) => {
    try {
      const response = await api.post(`/posts/${postId}/like`);
      setPosts(prev => prev.map(post => 
        post.id === postId 
          ? { ...post, likedByMe: response.data.liked, likesCount: response.data.likesCount }
          : post
      ));
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const openComments = async (post: BoardPost) => {
    setSelectedPost(post);
    setCommentsModalVisible(true);
    setLoadingComments(true);
    try {
      const response = await api.get(`/posts/${post.id}/comments`);
      setComments(response.data);
    } catch (error) {
      console.error('Failed to load comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !selectedPost) return;

    try {
      const response = await api.post(`/posts/${selectedPost.id}/comments`, {
        text: newComment.trim()
      });
      setComments(prev => [...prev, response.data]);
      setNewComment('');
      // Update comment count in posts
      setPosts(prev => prev.map(post =>
        post.id === selectedPost.id
          ? { ...post, commentsCount: post.commentsCount + 1 }
          : post
      ));
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add comment');
    }
  };

  const handleDeletePost = async (postId: string) => {
    Alert.alert('Delete Post', 'Are you sure you want to delete this post?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/posts/${postId}`);
            setPosts(prev => prev.filter(p => p.id !== postId));
          } catch (error) {
            Alert.alert('Error', 'Failed to delete post');
          }
        }
      }
    ]);
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return '';
    
    // Handle ISO date format from backend
    let date: Date;
    try {
      // Try parsing as ISO string
      date = new Date(dateString);
      // If invalid, try with Z suffix
      if (isNaN(date.getTime())) {
        date = new Date(dateString + 'Z');
      }
    } catch {
      return '';
    }
    
    if (isNaN(date.getTime())) return '';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderVipBorder = (tier: VipTier) => {
    const style = getVipStyle(tier);
    if (!style) return { borderWidth: 2, borderColor: 'transparent' };
    return { borderWidth: 2, borderColor: style.borderColor };
  };

  const renderPost = ({ item }: { item: BoardPost }) => {
    const vipStyle = getVipStyle(item.authorVipTier);
    const isOwn = item.authorId === user?.id;

    return (
      <View style={styles.postCard}>
        {/* Author header */}
        <View style={styles.postHeader}>
          <TouchableOpacity 
            style={styles.authorRow}
            onPress={() => openProfile(item.authorId)}
          >
            <View style={[styles.avatar, renderVipBorder(item.authorVipTier)]}>
              {item.authorPhotoUrl ? (
                <Image source={{ uri: item.authorPhotoUrl }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={20} color={COLORS.textSecondary} />
              )}
            </View>
            <View style={styles.authorInfo}>
              <View style={styles.nameRow}>
                <Text style={[styles.authorName, vipStyle && { color: vipStyle.nameColor }]}>
                  {item.authorDisplayName}
                </Text>
                {vipStyle && (
                  <Ionicons 
                    name={vipStyle.badgeIcon === 'diamond' ? 'diamond' : 'star'} 
                    size={12} 
                    color={vipStyle.crownColor}
                    style={styles.vipIcon}
                  />
                )}
              </View>
              <Text style={styles.timestamp}>{formatTimeAgo(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
          {isOwn && (
            <TouchableOpacity 
              style={styles.deleteButton}
              onPress={() => handleDeletePost(item.id)}
            >
              <Ionicons name="trash-outline" size={18} color={COLORS.error} />
            </TouchableOpacity>
          )}
        </View>

        {/* Post content */}
        <Text style={styles.postText}>{item.text || '(No text)'}</Text>

        {/* Post image */}
        {item.imageBase64 && (
          <View style={styles.postImageContainer}>
            <Image 
              source={{ uri: item.imageBase64 }} 
              style={styles.postImage}
              contentFit="cover"
            />
          </View>
        )}

        {/* Actions bar */}
        <View style={styles.actionsBar}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleLikePost(item.id)}
          >
            <Ionicons 
              name={item.likedByMe ? 'heart' : 'heart-outline'} 
              size={22} 
              color={item.likedByMe ? COLORS.error : COLORS.textSecondary}
            />
            <Text style={[styles.actionCount, item.likedByMe && styles.likedCount]}>
              {item.likesCount}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => openComments(item)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} />
            <Text style={styles.actionCount}>{item.commentsCount}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderComment = ({ item }: { item: Comment }) => {
    const vipStyle = getVipStyle(item.authorVipTier);
    return (
      <View style={styles.commentCard}>
        <TouchableOpacity onPress={() => openProfile(item.authorId)}>
          <View style={[styles.commentAvatar, renderVipBorder(item.authorVipTier)]}>
            {item.authorPhotoUrl ? (
              <Image source={{ uri: item.authorPhotoUrl }} style={styles.commentAvatarImage} />
            ) : (
              <Ionicons name="person" size={14} color={COLORS.textSecondary} />
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.commentContent}>
          <View style={styles.commentHeader}>
            <Text style={[styles.commentAuthor, vipStyle && { color: vipStyle.nameColor }]}>
              {item.authorDisplayName}
            </Text>
            <Text style={styles.commentTime}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
        </View>
      </View>
    );
  };

  if (!active) return null;

  return (
    <View style={styles.container}>
      {/* Create post button */}
      <TouchableOpacity 
        style={styles.createPostButton}
        onPress={() => setCreateModalVisible(true)}
      >
        <View style={styles.createPostInner}>
          <View style={styles.createAvatar}>
            {user?.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={styles.createAvatarImage} />
            ) : (
              <Ionicons name="person" size={18} color={COLORS.textSecondary} />
            )}
          </View>
          <Text style={styles.createPlaceholder}>Share something with the room...</Text>
        </View>
        <Ionicons name="image-outline" size={22} color={COLORS.primary} />
      </TouchableOpacity>

      {/* Posts list */}
      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlashList
          data={posts}
          renderItem={renderPost}
          estimatedItemSize={200}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyTitle}>No posts yet</Text>
              <Text style={styles.emptyText}>Be the first to share something!</Text>
            </View>
          }
        />
      )}

      {/* Create Post Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Post</Text>
            <TouchableOpacity 
              onPress={handleCreatePost}
              disabled={isSubmitting || !newPostText.trim()}
            >
              <Text style={[
                styles.modalPost, 
                (!newPostText.trim() || isSubmitting) && styles.modalPostDisabled
              ]}>
                {isSubmitting ? 'Posting...' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.createForm}>
            <TextInput
              style={styles.createInput}
              placeholder="What's on your mind?"
              placeholderTextColor={COLORS.textSecondary}
              value={newPostText}
              onChangeText={setNewPostText}
              multiline
              maxLength={2000}
              autoFocus
            />

            {newPostImage && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: newPostImage }} style={styles.imagePreview} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setNewPostImage(null)}
                >
                  <Ionicons name="close-circle" size={28} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.createActions}>
            <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
              <Ionicons name="image" size={24} color={COLORS.primary} />
              <Text style={styles.addImageText}>Add Photo</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCommentsModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Comments</Text>
            <View style={{ width: 24 }} />
          </View>

          {loadingComments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlashList
              data={comments}
              renderItem={renderComment}
              estimatedItemSize={80}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.commentsListContent}
              ListEmptyComponent={
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyCommentsText}>No comments yet</Text>
                </View>
              }
            />
          )}

          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          >
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={COLORS.textSecondary}
                value={newComment}
                onChangeText={setNewComment}
                maxLength={500}
              />
              <TouchableOpacity 
                style={styles.sendCommentButton}
                onPress={handleAddComment}
                disabled={!newComment.trim()}
              >
                <Ionicons 
                  name="send" 
                  size={20} 
                  color={newComment.trim() ? COLORS.primary : COLORS.textSecondary} 
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: SPACING.xl,
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    padding: SPACING.md,
    borderRadius: SIZES.borderRadius,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  createPostInner: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  createAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  createAvatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  createPlaceholder: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  postCard: {
    backgroundColor: COLORS.cardBg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    borderRadius: SIZES.borderRadius,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  authorInfo: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  vipIcon: {
    marginLeft: 4,
  },
  timestamp: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    padding: SPACING.xs,
  },
  postText: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  postImageContainer: {
    borderRadius: SIZES.borderRadius,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  postImage: {
    width: '100%',
    height: 200,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: SPACING.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  actionCount: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  likedCount: {
    color: COLORS.error,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalCancel: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
  },
  modalPost: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalPostDisabled: {
    opacity: 0.5,
  },
  createForm: {
    flex: 1,
    padding: SPACING.md,
  },
  createInput: {
    color: COLORS.text,
    fontSize: 17,
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imagePreviewContainer: {
    marginTop: SPACING.md,
    borderRadius: SIZES.borderRadius,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: SIZES.borderRadius,
  },
  removeImageButton: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
  },
  createActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
  },
  addImageText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  commentCard: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
  },
  commentAvatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  commentContent: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: 2,
  },
  commentAuthor: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  commentTime: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  commentText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
  },
  commentsListContent: {
    paddingBottom: SPACING.xl,
  },
  emptyComments: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyCommentsText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: 15,
    marginRight: SPACING.sm,
    maxHeight: 80,
  },
  sendCommentButton: {
    padding: SPACING.sm,
  },
});
