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

    return (
      <TouchableOpacity
        style={styles.gridCard}
        activeOpacity={0.85}
        onPress={() => openComments(item)}
        testID={`post-${item.id}`}
      >
        {/* Likes badge */}
        <View style={styles.gridLikesBadge}>
          <Text style={styles.gridLikesNum}>{item.likesCount}</Text>
          <Ionicons
            name={item.likedByMe ? 'heart' : 'happy'}
            size={12}
            color={item.likedByMe ? COLORS.error : '#7c3aed'}
          />
        </View>

        {/* Image OR text preview */}
        <View style={styles.gridPreviewWrap}>
          {item.imageBase64 ? (
            <Image
              source={{ uri: item.imageBase64 }}
              style={styles.gridPreviewImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.gridTextPreview}>
              <Text style={styles.gridTextPreviewText} numberOfLines={3}>
                {item.text || '(No text)'}
              </Text>
            </View>
          )}
        </View>

        {/* Footer: avatar + by name + comments count */}
        <View style={styles.gridFooter}>
          <View style={styles.gridAvatar}>
            {item.authorPhotoUrl ? (
              <Image source={{ uri: item.authorPhotoUrl }} style={styles.gridAvatarImg} />
            ) : (
              <Ionicons name="person" size={12} color="#7c3aed" />
            )}
          </View>
          <Text
            style={[styles.gridAuthor, vipStyle && { color: vipStyle.nameColor }]}
            numberOfLines={1}
          >
            by {item.authorDisplayName}
          </Text>
        </View>
        {item.commentsCount > 0 && (
          <View style={styles.gridCommentsRow}>
            <Text style={styles.gridCommentsNum}>{item.commentsCount}</Text>
            <Ionicons name="return-down-forward" size={11} color="#10b981" />
          </View>
        )}
      </TouchableOpacity>
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

      {/* Posts list — 3 column grid */}
      {loading && posts.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlashList
          data={posts}
          renderItem={renderPost}
          numColumns={3}
          estimatedItemSize={140}
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

      {/* Create Post Modal — light themed with cursive script */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainerLight}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeaderLight}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)} testID="create-post-cancel">
              <Text style={styles.modalCancelLight}>Cancel</Text>
            </TouchableOpacity>
            <View style={styles.modalTitlePill}>
              <Text style={styles.modalTitleCursive}>Create Post</Text>
            </View>
            <TouchableOpacity 
              onPress={handleCreatePost}
              disabled={isSubmitting || !newPostText.trim()}
              testID="create-post-submit"
            >
              <Text style={[
                styles.modalPostLight, 
                (!newPostText.trim() || isSubmitting) && styles.modalPostDisabled
              ]}>
                {isSubmitting ? 'Posting…' : 'Post'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.createFormLight}>
            <View style={styles.createInputBox}>
              <TextInput
                style={styles.createInputLight}
                placeholder="What's on your mind?"
                placeholderTextColor="#94a3b8"
                value={newPostText}
                onChangeText={setNewPostText}
                multiline
                maxLength={2000}
                autoFocus
                testID="create-post-input"
              />
            </View>

            {newPostImage && (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: newPostImage }} style={styles.imagePreview} />
                <TouchableOpacity 
                  style={styles.removeImageButton}
                  onPress={() => setNewPostImage(null)}
                >
                  <Ionicons name="close-circle" size={28} color="#ef4444" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.createActionsLight}>
            <TouchableOpacity style={styles.addImageButtonLight} onPress={pickImage} testID="create-post-add-photo">
              <Ionicons name="image" size={22} color="#7c3aed" />
              <Text style={styles.addImageTextLight}>Add Photo</Text>
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
              ListHeaderComponent={
                selectedPost ? (
                  <View style={styles.detailHeader}>
                    <View style={styles.detailAuthorRow}>
                      <TouchableOpacity onPress={() => openProfile(selectedPost.authorId)}>
                        <View style={styles.detailAvatar}>
                          {selectedPost.authorPhotoUrl ? (
                            <Image source={{ uri: selectedPost.authorPhotoUrl }} style={styles.detailAvatarImg} />
                          ) : (
                            <Ionicons name="person" size={22} color="#7c3aed" />
                          )}
                        </View>
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.detailAuthorName} onPress={() => openProfile(selectedPost.authorId)}>
                          {selectedPost.authorDisplayName}
                        </Text>
                        <Text style={styles.detailTimestamp}>{formatTimeAgo(selectedPost.createdAt)}</Text>
                      </View>
                      {selectedPost.authorId === user?.id && (
                        <TouchableOpacity
                          onPress={() => handleDeletePost(selectedPost.id)}
                          testID={`detail-delete-${selectedPost.id}`}
                        >
                          <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                        </TouchableOpacity>
                      )}
                    </View>
                    {!!selectedPost.text && (
                      <Text style={styles.detailText}>{selectedPost.text}</Text>
                    )}
                    {!!selectedPost.imageBase64 && (
                      <View style={styles.detailImageWrap}>
                        <Image
                          source={{ uri: selectedPost.imageBase64 }}
                          style={styles.detailImage}
                          contentFit="cover"
                        />
                      </View>
                    )}
                    <View style={styles.detailActions}>
                      <TouchableOpacity
                        style={styles.actionPill}
                        onPress={() => handleLikePost(selectedPost.id)}
                        testID={`detail-like-${selectedPost.id}`}
                      >
                        <Ionicons
                          name={selectedPost.likedByMe ? 'heart' : 'heart-outline'}
                          size={20}
                          color={selectedPost.likedByMe ? COLORS.error : '#7c3aed'}
                        />
                        <Text style={[styles.actionCount, selectedPost.likedByMe && styles.likedCount]}>
                          {selectedPost.likesCount}
                        </Text>
                      </TouchableOpacity>
                      <View style={styles.actionPill}>
                        <Ionicons name="chatbubble-ellipses-outline" size={20} color="#7c3aed" />
                        <Text style={styles.actionCount}>{selectedPost.commentsCount}</Text>
                      </View>
                    </View>
                    <Text style={styles.commentsDivider}>Comments</Text>
                  </View>
                ) : null
              }
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
    backgroundColor: '#fdf2f8',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.sm,
  },
  createPostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fbcfe8',
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
    color: '#9ca3af',
    fontSize: 14,
  },
  postCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    borderRadius: 14,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#fbcfe8',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  // ---- Grid card (3 per row) ----
  gridCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    margin: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fbcfe8',
    overflow: 'hidden',
    position: 'relative',
    paddingBottom: 4,
    minHeight: 150,
  },
  gridLikesBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    zIndex: 2,
  },
  gridLikesNum: { fontSize: 10, fontWeight: '800', color: '#fbbf24' },
  gridPreviewWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#f3e8ff' },
  gridPreviewImage: { width: '100%', height: '100%' },
  gridTextPreview: {
    flex: 1,
    backgroundColor: '#a7f3d0',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTextPreviewText: { fontSize: 11, color: '#065f46', fontWeight: '700', textAlign: 'center' },
  gridFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingTop: 4,
    gap: 4,
  },
  gridAvatar: {
    width: 18,
    height: 18,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gridAvatarImg: { width: 18, height: 18 },
  gridAuthor: { flex: 1, fontSize: 11, fontWeight: '700', color: '#2563eb' },
  gridCommentsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingTop: 1,
  },
  gridCommentsNum: { fontSize: 10, fontWeight: '700', color: '#10b981' },
  // ---- Detail header (in comments modal) ----
  detailHeader: {
    backgroundColor: '#ffffff',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    marginBottom: 4,
  },
  detailAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  detailAvatar: {
    width: 44, height: 44, backgroundColor: '#ede9fe',
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  detailAvatarImg: { width: 44, height: 44 },
  detailAuthorName: { color: '#2563eb', fontSize: 16, fontWeight: '800' },
  detailTimestamp: { color: '#9ca3af', fontSize: 12, marginTop: 2 },
  detailText: { color: '#1f2937', fontSize: 15, lineHeight: 22, marginBottom: SPACING.sm },
  detailImageWrap: {
    width: '100%', aspectRatio: 1, borderRadius: 10,
    overflow: 'hidden', backgroundColor: '#f3f4f6', marginBottom: SPACING.sm,
  },
  detailImage: { width: '100%', height: '100%' },
  detailActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: 4 },
  commentsDivider: {
    fontSize: 11, color: '#7c3aed', fontWeight: '800',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: SPACING.md,
  },
  postTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  postAvatar: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(124,58,237,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  postAvatarImage: {
    width: 48,
    height: 48,
  },
  postTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  postNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  postAuthorName: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '800',
  },
  postTimestamp: {
    color: '#9ca3af',
    fontSize: 11,
    marginLeft: 8,
  },
  postDelete: {
    marginLeft: 'auto',
    padding: 2,
  },
  postText: {
    color: '#1f2937',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 2,
  },
  postImageCenter: {
    alignSelf: 'center',
    marginTop: SPACING.sm,
    borderRadius: 10,
    overflow: 'hidden',
    width: '78%',
    backgroundColor: '#f3f4f6',
  },
  postImage: {
    width: '100%',
  },
  postImageContainer: {
    borderRadius: SIZES.borderRadius,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  actionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f3ff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ede9fe',
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
    color: '#1f2937',
    fontSize: 18,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
    marginTop: SPACING.xs,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  // ---- Light + cursive Create Post modal ----
  modalContainerLight: {
    flex: 1,
    backgroundColor: '#fff8f0',
  },
  modalHeaderLight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#f1d9b5',
    backgroundColor: '#fff8f0',
  },
  modalCancelLight: {
    color: '#64748b',
    fontSize: 16,
    fontWeight: '600',
  },
  modalTitlePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#fde68a',
    borderWidth: 1,
    borderColor: '#facc15',
    shadowColor: '#f59e0b',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  modalTitleCursive: {
    fontFamily: Platform.select({ web: '"Dancing Script", "Great Vibes", cursive', default: undefined }) as any,
    color: '#7c2d12',
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalPostLight: {
    color: '#ec4899',
    fontSize: 17,
    fontWeight: '800',
  },
  createFormLight: {
    flex: 1,
    padding: SPACING.md,
  },
  createInputBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#facc15',
    padding: SPACING.md,
    shadowColor: '#f59e0b',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  createInputLight: {
    flex: 1,
    color: '#1f2937',
    fontSize: 18,
    lineHeight: 26,
    minHeight: 200,
    textAlignVertical: 'top',
    fontFamily: Platform.select({ web: '"Dancing Script", cursive', default: undefined }) as any,
  },
  createActionsLight: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#f1d9b5',
    backgroundColor: '#fff8f0',
  },
  addImageButtonLight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#f3e8ff',
    borderWidth: 1,
    borderColor: '#c4b5fd',
  },
  addImageTextLight: {
    color: '#7c3aed',
    fontSize: 15,
    fontWeight: '700',
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
