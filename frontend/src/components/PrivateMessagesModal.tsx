import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING } from '@/src/constants/theme';
import api from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';

interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  receiverId: string;
  messageText: string;
  createdAt: string;
  readStatus: boolean;
  senderPmBoxColor?: string | null;
  senderChatColor?: string | null;
  senderUsernameColor?: string | null;
}

interface Conversation {
  userId: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  onlineStatus: boolean;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  initialUserId?: string | null;
}

export default function PrivateMessagesModal({ visible, onClose, initialUserId }: Props) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      loadConversations();
      // Refresh conversations every 3 seconds
      const interval = setInterval(loadConversations, 3000);
      return () => clearInterval(interval);
    } else {
      // Reset selection when modal is closed
      setSelectedConversation(null);
    }
  }, [visible]);

  // When opened with a specific user, auto-select that conversation
  useEffect(() => {
    if (visible && initialUserId) {
      openConversationWith(initialUserId);
    }
  }, [visible, initialUserId]);

  const openConversationWith = async (userId: string) => {
    try {
      const response = await api.get(`/users/${userId}`);
      const u = response.data;
      setSelectedConversation({
        userId: u.id || userId,
        username: u.username,
        displayName: u.displayName,
        photoUrl: u.photoUrl,
        lastMessage: '',
        lastMessageTime: new Date().toISOString(),
        unreadCount: 0,
        onlineStatus: u.onlineStatus ?? false,
      });
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.userId);
      // Refresh messages every 2 seconds
      const interval = setInterval(() => {
        loadMessages(selectedConversation.userId);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

  const loadConversations = async () => {
    try {
      const response = await api.get('/messages/direct/conversations/list');
      setConversations(response.data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadMessages = async (userId: string) => {
    try {
      setLoadingMessages(true);
      const response = await api.get(`/messages/direct/${userId}`);
      setMessages(response.data);
      // Auto-scroll to bottom
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation) return;

    setLoading(true);
    try {
      await api.post('/messages/direct/send', {
        receiverId: selectedConversation.userId,
        messageText: messageText.trim(),
      });
      setMessageText('');
      await loadMessages(selectedConversation.userId);
      await loadConversations();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isOwnMessage = item.senderId === user?.id;

    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}>
        {!isOwnMessage && (
          <View style={styles.avatar}>
            {item.senderPhoto ? (
              <Image source={{ uri: item.senderPhoto }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={16} color={COLORS.textSecondary} />
            )}
          </View>
        )}
        <View
          style={[
            styles.messageBubble,
            isOwnMessage && styles.ownMessageBubble,
            item.senderPmBoxColor ? { backgroundColor: item.senderPmBoxColor } : null,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              item.senderChatColor
                ? { color: item.senderChatColor }
                : item.senderPmBoxColor
                ? { color: '#0f0a1f' }
                : null,
            ]}
          >
            {item.messageText}
          </Text>
          <Text
            style={[
              styles.timestamp,
              item.senderPmBoxColor ? { color: '#0f0a1f99' } : null,
            ]}
          >
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
    );
  };

  const renderConversation = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[
        styles.conversationItem,
        selectedConversation?.userId === item.userId && styles.activeConversation,
      ]}
      onPress={() => setSelectedConversation(item)}
    >
      <View style={styles.conversationAvatar}>
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.conversationAvatarImg} />
        ) : (
          <Ionicons name="person" size={20} color={COLORS.textSecondary} />
        )}
        {item.onlineStatus && <View style={styles.onlineBadge} />}
      </View>

      <View style={styles.conversationInfo}>
        <View style={styles.conversationHeader}>
          <Text style={styles.conversationName}>{item.displayName}</Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.lastMessage} numberOfLines={1}>
          {item.lastMessage || 'No messages yet'}
        </Text>
        <Text style={styles.messageTime}>
          {new Date(item.lastMessageTime).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Direct Messages</Text>
          <View style={{ width: 28 }} />
        </View>

        {selectedConversation ? (
          // Chat View
          <KeyboardAvoidingView
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            {/* Chat Header */}
            <View style={styles.chatHeader}>
              <TouchableOpacity onPress={() => setSelectedConversation(null)}>
                <Ionicons name="arrow-back" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <View style={styles.chatHeaderInfo}>
                <Text style={styles.chatHeaderName}>{selectedConversation.displayName}</Text>
                <Text style={styles.chatHeaderStatus}>
                  {selectedConversation.onlineStatus ? '🟢 Online' : '🔴 Offline'}
                </Text>
              </View>
              <View style={{ width: 24 }} />
            </View>

            {/* Messages List */}
            {loadingMessages ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messagesList}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                ListEmptyComponent={
                  <View style={styles.emptyMessages}>
                    <Ionicons name="chatbubble-outline" size={36} color={COLORS.textSecondary} />
                    <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
                  </View>
                }
              />
            )}

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={messageText}
                onChangeText={setMessageText}
                placeholder="Type a message..."
                placeholderTextColor={COLORS.textSecondary}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={!messageText.trim() || loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color={COLORS.text} />
                ) : (
                  <Ionicons name="send" size={20} color={COLORS.text} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        ) : (
          // Conversations List
          <View style={styles.conversationsContainer}>
            {conversations.length > 0 ? (
              <FlatList
                data={conversations}
                keyExtractor={(item) => item.userId}
                renderItem={renderConversation}
                scrollEnabled
              />
            ) : (
              <View style={styles.emptyMessages}>
                <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textSecondary} />
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>Start chatting with friends!</Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
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
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  conversationsContainer: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.md,
  },
  activeConversation: {
    backgroundColor: COLORS.cardBg,
  },
  conversationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  conversationAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.success,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: SPACING.sm,
  },
  unreadText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  lastMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  messageTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  chatHeaderInfo: {
    flex: 1,
  },
  chatHeaderName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  chatHeaderStatus: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  messagesList: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
    alignItems: 'flex-end',
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.xs,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    backgroundColor: COLORS.cardBg,
    padding: SPACING.sm,
    borderRadius: 12,
    maxWidth: '70%',
  },
  ownMessageBubble: {
    backgroundColor: COLORS.primary,
  },
  messageText: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    textAlign: 'right',
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
    flex: 1,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '600',
    marginTop: SPACING.md,
  },
  emptySubtext: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: SPACING.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.text,
    fontSize: 15,
    maxHeight: 80,
    marginRight: SPACING.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
