import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
  LayoutChangeEvent,
  GestureResponderEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import GamePanel, { GamePanelHandle } from '@/src/components/GamePanel';
import DraggableMember from '@/src/components/DraggableMember';
import PrivateMessagesModal from '@/src/components/PrivateMessagesModal';
import JumpingHostIcon from '@/src/components/JumpingHostIcon';
import { COLORS, SPACING } from '@/src/constants/theme';
import { useProfilePopup } from '@/src/contexts/ProfilePopupContext';
import BoardTab from '@/src/components/BoardTab';
import FeedTab from '@/src/components/FeedTab';
import TournamentModal from '@/src/components/TournamentModal';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  messageText: string;
  createdAt: string;
}

interface Member {
  userId: string;
  username: string;
  profilePhoto?: string;
  level: number;
  onlineStatus: boolean;
  vipTier?: string | null;
}

interface Room {
  id: string;
  roomName: string;
  roomCategory: string;
  roomBanner?: string;
  roomBackground?: string;
  currentUserCount: number;
  maxCapacity: number;
}

export default function RoomScreen() {
  const { id } = useLocalSearchParams();
  const { user, refreshUser } = useAuth();
  const { openProfile } = useProfilePopup();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [memberSectionLayout, setMemberSectionLayout] = useState({ width: 0, height: 0 });
  const [messagesModalVisible, setMessagesModalVisible] = useState(false);
  const [dmInitialUserId, setDmInitialUserId] = useState<string | null>(null);
  const [activeRoomTab, setActiveRoomTab] = useState<'feed' | 'chat' | 'board'>('chat');
  const [tournamentModalOpen, setTournamentModalOpen] = useState(false);
  const [currentUserTarget, setCurrentUserTarget] = useState<{ x: number; y: number } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const gameRef = useRef<GamePanelHandle>(null);

  useEffect(() => {
    loadRoomData();
    const interval = setInterval(() => {
      refreshRoomData();
    }, 3000);
    return () => {
      clearInterval(interval);
      handleLeaveRoom();
    };
  }, [id]);

  const loadRoomData = async () => {
    try {
      const [roomResponse, messagesResponse, membersResponse] = await Promise.all([
        api.get('/rooms'),
        api.get(`/messages/${id}`),
        api.get(`/rooms/${id}/members`),
      ]);
      const currentRoom = roomResponse.data.find((r: Room) => r.id === id);
      setRoom(currentRoom);
      setMessages(Array.isArray(messagesResponse.data) ? messagesResponse.data : []);
      setMembers(membersResponse.data);
    } catch (error) {
      Alert.alert('Error', 'Failed to load room data');
    }
  };

  const refreshRoomData = async () => {
    try {
      const [messagesResponse, membersResponse, roomsResponse] = await Promise.all([
        api.get(`/messages/${id}`),
        api.get(`/rooms/${id}/members`),
        api.get('/rooms'),
      ]);
      setMessages(Array.isArray(messagesResponse.data) ? messagesResponse.data : []);
      setMembers(Array.isArray(membersResponse.data) ? membersResponse.data : []);
      const roomsData = Array.isArray(roomsResponse.data) ? roomsResponse.data : [];
      const currentRoom = roomsData.find((r: Room) => r.id === id);
      setRoom(currentRoom);
    } catch (error) {
      console.error('Failed to refresh room:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    setLoading(true);
    try {
      await api.post(`/messages/${id}`, { messageText: messageText.trim() });
      setMessageText('');
      await refreshRoomData();
      await refreshUser();
      flatListRef.current?.scrollToEnd();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveRoom = async () => {
    try {
      await api.post(`/rooms/${id}/leave`);
      await refreshUser();
    } catch (error) {
      console.error('Failed to leave room:', error);
    }
  };

  const handleBack = async () => {
    await handleLeaveRoom();
    router.back();
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isSystem = item.senderId === 'system';

    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.messageText}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={styles.messageRow}
        activeOpacity={0.7}
        onPress={() => openProfile(item.senderId)}
        testID={`msg-row-${item.id}`}
      >
        <View
          style={styles.avatar}
          testID={`msg-avatar-${item.senderId}`}
        >
          {item.senderPhoto ? (
            <Image source={{ uri: item.senderPhoto }} style={styles.avatarImg} />
          ) : (
            <Ionicons name="person" size={12} color="#7c3aed" />
          )}
        </View>
        <Text style={styles.messageLine} numberOfLines={0}>
          <Text style={styles.senderName}>{item.senderName}</Text>
          <Text style={styles.messageText}>{'  '}{item.messageText}</Text>
        </Text>
      </TouchableOpacity>
    );
  };

  const onMemberSectionLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMemberSectionLayout({ width, height });
  };

  // Tap empty space → smoothly move current user's avatar to that point
  const handleGridTap = (e: GestureResponderEvent) => {
    const native: any = e.nativeEvent;
    let x = native.locationX;
    let y = native.locationY;
    // Web fallback: react-native-web passes synthetic events whose nativeEvent is the MouseEvent
    if (typeof x !== 'number' || isNaN(x)) {
      x = native.offsetX ?? native.layerX ?? 0;
      y = native.offsetY ?? native.layerY ?? 0;
    }
    setCurrentUserTarget({ x: x - 24, y: y - 24 });
  };

  // Tap on another user's avatar → open profile popup
  const handleAvatarPress = (member: Member) => {
    if (member.userId === user?.id) return;
    openProfile(member.userId);
  };

  const handleCloseDmModal = () => {
    setMessagesModalVisible(false);
    setDmInitialUserId(null);
  };

  const renderProfileSection = () => {
    return (
      <View style={styles.profileSection} onLayout={onMemberSectionLayout}>
        {/* Light-colored room background image with soft white veil */}
        {room?.roomBackground ? (
          <Image
            source={{ uri: room.roomBackground }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : null}
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.10)', 'rgba(255,255,255,0.22)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.profileSectionHeader}>
          <View style={styles.profileSectionHeaderPill}>
            <Ionicons name="people" size={12} color="#fff" />
            <Text style={styles.profileSectionTitle}>
              In the room ({members.length}/{room?.maxCapacity || 36})
            </Text>
          </View>
          <Text style={styles.profileSectionHint}>Tap empty space to move • Tap avatar to chat</Text>
        </View>
        <View style={styles.profileGrid} testID="profile-grid-tap-area">
          {/* Backdrop captures clicks on empty space. Avatars render above and consume taps on themselves. */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleGridTap}
            testID="profile-grid-backdrop"
          />
          {(Array.isArray(members) ? members : []).map((member, idx) => (
            <DraggableMember
              key={member.userId}
              member={member}
              isCurrentUser={member.userId === user?.id}
              boundsWidth={memberSectionLayout.width - SPACING.sm * 2}
              boundsHeight={memberSectionLayout.height - 40}
              initialIndex={idx}
              totalMembers={members.length}
              targetPosition={member.userId === user?.id ? currentUserTarget : null}
              onAvatarPress={handleAvatarPress}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton} testID="room-back-btn">
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTournamentModalOpen(true)}
            style={styles.tournamentBtn}
            testID="open-tournaments-btn"
          >
            <Ionicons name="trophy" size={18} color={COLORS.coin} />
            <Text style={styles.tournamentBtnText}>Tournaments</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.headerInfo, { pointerEvents: 'none' }]}>
          <Text style={styles.headerTitle} numberOfLines={1}>{room?.roomName}</Text>
          <Text style={styles.headerSubtitle}>
            {room?.currentUserCount || 0}/{room?.maxCapacity || 36} members
          </Text>
        </View>
        <View style={styles.headerRight}>
          <JumpingHostIcon onPress={() => gameRef.current?.openHost()} />
          <TouchableOpacity
            style={styles.messagesButton}
            onPress={() => { setDmInitialUserId(null); setMessagesModalVisible(true); }}
            testID="direct-messages-btn"
          >
            <Ionicons name="chatbox" size={22} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </View>

      {user && (
        <GamePanel
          ref={gameRef}
          roomId={id as string}
          currentUserId={user.id}
          userCoins={user.coins}
          onGameUpdate={refreshUser}
          compact
        />
      )}

      {/* Feed / Chat / Board tab bar (room-scoped) */}
      <View style={styles.roomTabs}>
        <TouchableOpacity
          onPress={() => setActiveRoomTab('feed')}
          style={[styles.roomTab, activeRoomTab === 'feed' && styles.roomTabActive]}
          activeOpacity={0.8}
          testID="room-tab-feed"
        >
          <Ionicons
            name={activeRoomTab === 'feed' ? 'home' : 'home-outline'}
            size={16}
            color={activeRoomTab === 'feed' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text style={[styles.roomTabText, activeRoomTab === 'feed' && styles.roomTabTextActive]}>
            Feed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveRoomTab('chat')}
          style={[styles.roomTab, activeRoomTab === 'chat' && styles.roomTabActive]}
          activeOpacity={0.8}
          testID="room-tab-chat"
        >
          <Ionicons
            name={activeRoomTab === 'chat' ? 'chatbubbles' : 'chatbubbles-outline'}
            size={16}
            color={activeRoomTab === 'chat' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text style={[styles.roomTabText, activeRoomTab === 'chat' && styles.roomTabTextActive]}>
            Chat
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveRoomTab('board')}
          style={[styles.roomTab, activeRoomTab === 'board' && styles.roomTabActive]}
          activeOpacity={0.8}
          testID="room-tab-board"
        >
          <Ionicons
            name={activeRoomTab === 'board' ? 'clipboard' : 'clipboard-outline'}
            size={16}
            color={activeRoomTab === 'board' ? COLORS.primary : COLORS.textSecondary}
          />
          <Text style={[styles.roomTabText, activeRoomTab === 'board' && styles.roomTabTextActive]}>
            Board
          </Text>
        </TouchableOpacity>
      </View>

      {activeRoomTab === 'feed' ? (
        <View style={styles.feedWrap}>
          <FeedTab roomId={id as string} active={activeRoomTab === 'feed'} />
        </View>
      ) : activeRoomTab === 'board' ? (
        <View style={styles.boardWrap}>
          <BoardTab roomId={id as string} active={activeRoomTab === 'board'} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          {/* Messages section - TOP (matte aesthetic) */}
          <View style={styles.messagesWrap}>
            <LinearGradient
              colors={['#fff7ed', '#fef3c7', '#fde6d3']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.matteVeil} pointerEvents="none" />
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              contentContainerStyle={styles.messagesList}
              style={styles.messagesContainer}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
              ListEmptyComponent={
                <View style={styles.emptyMessages}>
                  <Ionicons name="chatbubbles-outline" size={36} color={COLORS.textSecondary} />
                  <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
                </View>
              }
            />
          </View>

          {/* Profile section - BELOW messages (light room background image) */}
          {renderProfileSection()}

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
              testID="chat-input"
            />
            <TouchableOpacity
              style={[styles.sendButton, !messageText.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || loading}
              testID="send-message-btn"
            >
              <Ionicons name="send" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <PrivateMessagesModal 
        visible={messagesModalVisible}
        onClose={handleCloseDmModal}
        initialUserId={dmInitialUserId}
      />

      {user && (
        <TournamentModal
          visible={tournamentModalOpen}
          roomId={id as string}
          currentUserId={user.id}
          userCoins={user.coins}
          onClose={() => setTournamentModalOpen(false)}
          onUserUpdate={refreshUser}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  roomTabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: '#15101f',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2a2240',
  },
  roomTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  roomTabActive: {
    backgroundColor: '#1f1830',
  },
  roomTabText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  roomTabTextActive: {
    color: COLORS.primary,
  },
  boardWrap: {
    flex: 1,
    marginTop: SPACING.sm,
  },
  feedWrap: {
    flex: 1,
    marginTop: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    position: 'relative',
    minHeight: 56,
  },
  backButton: {
    padding: 4,
    zIndex: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 2,
  },
  tournamentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(251,191,36,0.12)',
    borderColor: COLORS.coin,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  tournamentBtnText: {
    color: COLORS.coin,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    zIndex: 2,
  },
  headerIconBtn: {
    padding: 4,
  },
  headerBanner: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  headerInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
  messagesButton: {
    padding: 8,
  },
  chatContainer: {
    flex: 1,
  },
  messagesWrap: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  matteVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesList: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingHorizontal: 2,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  messageLineWrap: {
    flex: 1,
  },
  messageLine: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  senderName: {
    fontSize: 15,
    color: '#7c3aed',
    fontWeight: '700',
  },
  messageText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 21,
  },
  emptyMessages: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  profileSection: {
    flex: 1,
    backgroundColor: '#f3eee8',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: SPACING.sm,
    paddingTop: 4,
    paddingBottom: SPACING.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  profileSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 6,
    zIndex: 1,
  },
  profileSectionHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  profileSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  profileSectionHint: {
    fontSize: 9,
    color: '#ffffff',
    fontStyle: 'italic',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  profileGrid: {
    flex: 1,
    position: 'relative',
    zIndex: 1,
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
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
  },
  systemMessageText: {
    fontSize: 12,
    color: '#92400e',
    backgroundColor: 'rgba(255,255,255,0.7)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    overflow: 'hidden',
    fontWeight: '600',
  },
});
