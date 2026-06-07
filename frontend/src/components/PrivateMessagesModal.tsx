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
  Switch,
  Pressable,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

type Tab = 'messages' | 'settings';

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs > 1 ? 's' : ''} ago`;
    const days = Math.floor(hrs / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } catch {
    return '';
  }
}

export default function PrivateMessagesModal({ visible, onClose, initialUserId }: Props) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('messages');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [optionsFor, setOptionsFor] = useState<string | null>(null); // conversation userId showing options panel
  const [allowMessagesFrom, setAllowMessagesFrom] = useState<'everyone' | 'friends' | 'nobody'>('everyone');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible) {
      loadConversations();
      loadSettings();
      const interval = setInterval(loadConversations, 3000);
      return () => clearInterval(interval);
    } else {
      setSelectedConversation(null);
      setOptionsFor(null);
      setActiveTab('messages');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && initialUserId) {
      openConversationWith(initialUserId);
    }
  }, [visible, initialUserId]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.userId);
      const interval = setInterval(() => {
        loadMessages(selectedConversation.userId);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [selectedConversation]);

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
      setTimeout(() => flatListRef.current?.scrollToEnd(), 100);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadSettings = async () => {
    try {
      const res = await api.get('/users/me/dm-settings');
      setAllowMessagesFrom(res.data.allowMessagesFrom || 'everyone');
      setNotificationsEnabled(res.data.notificationsEnabled !== false);
    } catch {}
  };

  const updateSetting = async (patch: Partial<{ allowMessagesFrom: string; notificationsEnabled: boolean }>) => {
    try {
      await api.put('/users/me/dm-settings', patch);
    } catch (e) {
      console.error('Failed to update DM settings', e);
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

  // ---- Options popup actions ----
  const handleViewProfile = (conv: Conversation) => {
    setOptionsFor(null);
    onClose();
    setTimeout(() => router.push(`/profile/${conv.userId}` as any), 50);
  };

  const handleViewMessage = (conv: Conversation) => {
    setOptionsFor(null);
    setSelectedConversation(conv);
  };

  const handleReportBlock = (conv: Conversation) => {
    setOptionsFor(null);
    Alert.alert(
      `Report or Block ${conv.displayName}?`,
      'Choose an action:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          onPress: async () => {
            try {
              await api.post(`/users/${conv.userId}/report`, { reason: 'private_message' });
              Alert.alert('Reported', `${conv.displayName} has been reported.`);
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.detail || 'Could not report.');
            }
          },
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/users/${conv.userId}/block`);
              Alert.alert('Blocked', `${conv.displayName} has been blocked.`);
              await loadConversations();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.detail || 'Could not block.');
            }
          },
        },
      ],
    );
  };

  const handleDelete = (conv: Conversation) => {
    setOptionsFor(null);
    Alert.alert(
      'Delete conversation?',
      `All messages with ${conv.displayName} will be permanently deleted.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/messages/direct/conversation/${conv.userId}`);
              await loadConversations();
            } catch (e: any) {
              Alert.alert('Error', e?.response?.data?.detail || 'Could not delete.');
            }
          },
        },
      ],
    );
  };

  // ---- Renderers ----
  const renderConversation = ({ item }: { item: Conversation }) => {
    const isOptionsOpen = optionsFor === item.userId;
    const isUnread = item.unreadCount > 0;
    return (
      <View>
        <TouchableOpacity
          style={[styles.convoRow, isOptionsOpen && styles.convoRowActive]}
          activeOpacity={0.85}
          onPress={() => setOptionsFor(isOptionsOpen ? null : item.userId)}
          testID={`dm-conv-row-${item.userId}`}
        >
          <View style={styles.convoAvatar}>
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={styles.convoAvatarImg} />
            ) : (
              <View style={[styles.convoAvatarImg, styles.convoAvatarFallback]}>
                <Ionicons name="person" size={22} color="#fff" />
              </View>
            )}
            {item.onlineStatus && <View style={styles.onlineBadge} />}
          </View>

          <View style={styles.convoInfo}>
            <Text style={styles.convoMessage} numberOfLines={1}>
              {item.lastMessage || 'Tap to start chatting'}
            </Text>
            <Text style={styles.convoFromLine} numberOfLines={1}>
              <Text style={styles.convoFromPrefix}>from </Text>
              {item.displayName}
            </Text>
            <Text style={styles.convoTime}>{timeAgo(item.lastMessageTime)}</Text>
          </View>

          {/* Unread dot — pink (incoming) or green (active) */}
          {isUnread && (
            <View style={styles.unreadDot} testID={`dm-unread-dot-${item.userId}`} />
          )}
        </TouchableOpacity>

        {isOptionsOpen && (
          <View style={styles.optionsPanel} testID={`dm-options-${item.userId}`}>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionBtn, styles.optionBtnProfile]}
                onPress={() => handleViewProfile(item)}
                testID="dm-opt-view-profile"
              >
                <Ionicons name="person-circle" size={18} color="#f59e0b" />
                <Text style={styles.optionBtnText}>View Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, styles.optionBtnMessage]}
                onPress={() => handleViewMessage(item)}
                testID="dm-opt-view-message"
              >
                <Ionicons name="mail" size={18} color="#22c55e" />
                <Text style={styles.optionBtnText}>View Message</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optionBtn, styles.optionBtnReport]}
                onPress={() => handleReportBlock(item)}
                testID="dm-opt-report-block"
              >
                <View style={styles.reportBadge}>
                  <Text style={styles.reportBadgeText}>!</Text>
                </View>
                <Text style={styles.optionBtnText}>Report|Block</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optionBtn, styles.optionBtnDelete]}
                onPress={() => handleDelete(item)}
                testID="dm-opt-delete"
              >
                <Ionicons name="close" size={18} color="#ef4444" />
                <Text style={styles.optionBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isOwn = item.senderId === user?.id;
    return (
      <View style={[styles.chatBubbleRow, isOwn && styles.chatBubbleRowOwn]}>
        {!isOwn && (
          <View style={styles.chatBubbleAvatar}>
            {item.senderPhoto ? (
              <Image source={{ uri: item.senderPhoto }} style={styles.chatBubbleAvatarImg} />
            ) : (
              <Ionicons name="person" size={16} color="#666" />
            )}
          </View>
        )}
        <View style={[styles.chatBubble, isOwn ? styles.chatBubbleOwn : styles.chatBubbleOther]}>
          <Text style={[styles.chatBubbleText, isOwn && styles.chatBubbleTextOwn]}>
            {item.messageText}
          </Text>
          <Text style={styles.chatBubbleTime}>
            {timeAgo(item.createdAt)}
          </Text>
        </View>
        {isOwn && (
          <View style={styles.chatBubbleAvatar}>
            {user?.photoUrl ? (
              <Image source={{ uri: user.photoUrl }} style={styles.chatBubbleAvatarImg} />
            ) : (
              <Ionicons name="person" size={16} color="#666" />
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Top blue tab bar (Messages / Settings) */}
        <View style={styles.topBar}>
          <View style={styles.tabsWrap}>
            <TouchableOpacity
              onPress={() => setActiveTab('messages')}
              style={styles.tab}
              testID="dm-tab-messages"
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'messages' && styles.tabTextActive,
                ]}
              >
                Messages
              </Text>
              {activeTab === 'messages' && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('settings')}
              style={styles.tab}
              testID="dm-tab-settings"
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === 'settings' && styles.tabTextActive,
                ]}
              >
                Settings
              </Text>
              {activeTab === 'settings' && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          </View>
          <View style={styles.topBarActions}>
            <Ionicons name="resize" size={22} color="#f59e0b" />
            <TouchableOpacity onPress={onClose} testID="dm-close-btn" style={{ marginLeft: 14 }}>
              <Ionicons name="close" size={26} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>

        {activeTab === 'messages' ? (
          selectedConversation ? (
            // Chat view
            <KeyboardAvoidingView
              style={styles.chatView}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
              <View style={styles.chatHeader}>
                <TouchableOpacity
                  onPress={() => setSelectedConversation(null)}
                  testID="dm-chat-back"
                >
                  <Ionicons name="arrow-back" size={22} color="#0f172a" />
                </TouchableOpacity>
                <View style={styles.chatHeaderAvatar}>
                  {selectedConversation.photoUrl ? (
                    <Image source={{ uri: selectedConversation.photoUrl }} style={styles.chatHeaderAvatarImg} />
                  ) : (
                    <Ionicons name="person" size={18} color="#666" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatHeaderName}>{selectedConversation.displayName}</Text>
                  <Text style={styles.chatHeaderStatus}>
                    {selectedConversation.onlineStatus ? '● Online' : '○ Offline'}
                  </Text>
                </View>
              </View>

              {loadingMessages && messages.length === 0 ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color="#3b82f6" />
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(it) => it.id}
                  renderItem={renderMessage}
                  contentContainerStyle={styles.chatList}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
                  ListEmptyComponent={
                    <View style={styles.emptyMessages}>
                      <Ionicons name="chatbubble-outline" size={42} color="#9ca3af" />
                      <Text style={styles.emptyText}>No messages yet. Say hi!</Text>
                    </View>
                  }
                />
              )}

              <View style={styles.composer}>
                <TextInput
                  style={styles.composerInput}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Write your message here"
                  placeholderTextColor="#9ca3af"
                  multiline
                  maxLength={500}
                  testID="dm-composer-input"
                />
                <TouchableOpacity
                  style={[styles.composerSend, !messageText.trim() && { opacity: 0.5 }]}
                  onPress={handleSendMessage}
                  disabled={!messageText.trim() || loading}
                  testID="dm-composer-send"
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="chatbubble" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          ) : (
            // Conversation list
            <View style={styles.listWrap}>
              {conversations.length > 0 ? (
                <FlatList
                  data={conversations}
                  keyExtractor={(it) => it.userId}
                  renderItem={renderConversation}
                  contentContainerStyle={{ paddingVertical: 6 }}
                />
              ) : (
                <View style={styles.emptyMessages}>
                  <Ionicons name="chatbubbles-outline" size={48} color="#9ca3af" />
                  <Text style={styles.emptyText}>No conversations yet</Text>
                  <Text style={styles.emptySubtext}>Tap an avatar in chat to start one</Text>
                </View>
              )}

              {/* New message FAB */}
              <View style={styles.fabWrap}>
                <View style={styles.fab}>
                  <Ionicons name="mail" size={26} color="#fff" />
                  <View style={styles.fabPlus}>
                    <Ionicons name="add" size={14} color="#fff" />
                  </View>
                </View>
              </View>
            </View>
          )
        ) : (
          // Settings tab
          <ScrollView style={styles.settingsWrap} contentContainerStyle={{ paddingBottom: 40 }}>
            <Text style={styles.settingsSectionTitle}>Who can message me</Text>
            <View style={styles.settingsChips}>
              {(['everyone', 'friends', 'nobody'] as const).map((opt) => {
                const active = allowMessagesFrom === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => {
                      setAllowMessagesFrom(opt);
                      updateSetting({ allowMessagesFrom: opt });
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                    testID={`dm-allow-${opt}`}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.settingsSectionTitle}>Notifications</Text>
            <View style={styles.settingsRow}>
              <Text style={styles.settingsLabel}>New message alerts</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={(v) => {
                  setNotificationsEnabled(v);
                  updateSetting({ notificationsEnabled: v });
                }}
                trackColor={{ false: '#64748b', true: '#22c55e' }}
                thumbColor="#ffffff"
                ios_backgroundColor="#64748b"
                testID="dm-toggle-notifications"
              />
            </View>

            <Text style={[styles.settingsSectionTitle, { marginTop: 6 }]}>About</Text>
            <View style={styles.aboutCard}>
              <Text style={styles.aboutText}>
                Manage who can reach you, mute alerts, and review blocked users
                via the Report|Block option on any conversation.
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const TAB_BLUE = '#5cc1f2';
const ROW_BLUE = '#3aa6e0';
const ROW_BLUE_DARK = '#2d8fc9';
const SEP_GREY = '#e5e7eb';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: TAB_BLUE,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#cfeefd',
  },
  tabsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 28,
  },
  tab: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0c4a6e',
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabUnderline: {
    marginTop: 4,
    height: 3,
    width: '100%',
    backgroundColor: '#facc15',
    borderRadius: 2,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // List
  listWrap: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginHorizontal: 8,
    marginVertical: 4,
    backgroundColor: ROW_BLUE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: ROW_BLUE_DARK,
    gap: 12,
  },
  convoRowActive: {
    backgroundColor: ROW_BLUE_DARK,
  },
  convoAvatar: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0ea5e9',
    position: 'relative',
  },
  convoAvatarImg: {
    width: 56,
    height: 56,
    borderRadius: 10,
  },
  convoAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#fff',
  },
  convoInfo: {
    flex: 1,
  },
  convoMessage: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  convoFromLine: {
    color: '#bef264',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  convoFromPrefix: {
    color: '#86efac',
    fontStyle: 'italic',
  },
  convoTime: {
    color: '#e0f2fe',
    fontSize: 11,
    marginTop: 2,
  },
  unreadDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ec4899',
    marginLeft: 6,
    marginRight: 4,
    shadowColor: '#ec4899',
    shadowOpacity: 0.7,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },

  // Options panel
  optionsPanel: {
    marginHorizontal: 12,
    marginTop: -8,
    marginBottom: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 8,
    gap: 8,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  optionBtnProfile: {},
  optionBtnMessage: {},
  optionBtnReport: {},
  optionBtnDelete: {},
  optionBtnText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  reportBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportBadgeText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },

  // FAB
  fabWrap: {
    position: 'absolute',
    bottom: 18,
    right: 18,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#4ade80',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
    position: 'relative',
  },
  fabPlus: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#facc15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },

  // Empty
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingBottom: 24,
    flex: 1,
  },
  emptyText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  emptySubtext: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 6,
  },

  // Chat view (when conversation selected)
  chatView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: SEP_GREY,
    gap: 10,
  },
  chatHeaderAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatHeaderAvatarImg: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  chatHeaderName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  chatHeaderStatus: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 1,
  },
  chatList: {
    padding: 12,
    flexGrow: 1,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    gap: 6,
  },
  chatBubbleRowOwn: {
    justifyContent: 'flex-end',
  },
  chatBubbleAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBubbleAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  chatBubble: {
    maxWidth: '74%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  chatBubbleOther: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chatBubbleOwn: {
    backgroundColor: '#bfdbfe',
  },
  chatBubbleText: {
    fontSize: 15,
    color: '#0f172a',
    lineHeight: 20,
  },
  chatBubbleTextOwn: {
    color: '#0c4a6e',
  },
  chatBubbleTime: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'right',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Composer
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: SEP_GREY,
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f1f5f9',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: '#0f172a',
    fontSize: 14,
  },
  composerSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ec4899',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Settings tab
  settingsWrap: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  settingsSectionTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginTop: 12,
  },
  settingsChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
  },
  chipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#1d4ed8',
  },
  chipText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#ffffff',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingsLabel: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '700',
  },
  aboutCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  aboutText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
});
