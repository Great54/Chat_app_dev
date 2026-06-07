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
import AvatarWithAura from '@/src/components/AvatarWithAura';
import VipEliteWelcomeBanner from '@/src/components/VipEliteWelcomeBanner';
import { playRoomEnterSound, playMessageSound } from '@/src/utils/sound';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderPhoto?: string;
  messageText: string;
  createdAt: string;
  senderVipTier?: string | null;
  senderVipBadgeId?: string | null;
  senderAuraType?: string | null;
  senderAuraColor?: string | null;
  senderChatColor?: string | null;
  senderUsernameColor?: string | null;
  senderEnlargedAvatar?: boolean;
}

interface Member {
  userId: string;
  username: string;
  profilePhoto?: string;
  level: number;
  onlineStatus: boolean;
  vipTier?: string | null;
  vipBadgeId?: string | null;
  auraType?: string | null;
  auraColor?: string | null;
  usernameColor?: string | null;
  enlargedAvatar?: boolean;
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
  const [dmUnreadCount, setDmUnreadCount] = useState(0);
  const [activeRoomTab, setActiveRoomTab] = useState<'feed' | 'chat' | 'board'>('chat');
  const [tournamentModalOpen, setTournamentModalOpen] = useState(false);
  const [currentUserTarget, setCurrentUserTarget] = useState<{ x: number; y: number } | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const gameRef = useRef<GamePanelHandle>(null);

  // Refs to detect newly-arrived items between polls so we can play sounds.
  // We seed them on first load so the very first hydration is silent.
  const seenMemberIdsRef = useRef<Set<string> | null>(null);
  const seenMessageIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    loadRoomData();
    loadDmUnread();
    const interval = setInterval(() => {
      refreshRoomData();
      loadDmUnread();
    }, 3000);
    return () => {
      clearInterval(interval);
      handleLeaveRoom();
    };
  }, [id]);

  const loadDmUnread = async () => {
    try {
      const res = await api.get('/messages/direct/unread/total');
      const n = res.data?.unreadCount || 0;
      setDmUnreadCount(n);
    } catch {}
  };

  const loadRoomData = async () => {
    try {
      const [roomResponse, messagesResponse, membersResponse] = await Promise.all([
        api.get('/rooms'),
        api.get(`/messages/${id}`),
        api.get(`/rooms/${id}/members`),
      ]);
      const currentRoom = roomResponse.data.find((r: Room) => r.id === id);
      setRoom(currentRoom);
      const msgList: Message[] = Array.isArray(messagesResponse.data) ? messagesResponse.data : [];
      const memList: Member[] = Array.isArray(membersResponse.data) ? membersResponse.data : [];
      // Seed dedup sets silently on first load — no entry/message sounds for
      // history that already existed when we joined the room.
      seenMemberIdsRef.current = new Set(memList.map((m) => m.userId));
      seenMessageIdsRef.current = new Set(msgList.map((m) => m.id));
      setMessages(msgList);
      setMembers(memList);
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
      const msgList: Message[] = Array.isArray(messagesResponse.data) ? messagesResponse.data : [];
      const memList: Member[] = Array.isArray(membersResponse.data) ? membersResponse.data : [];

      // --- Detect new members and play the room-enter sound (excluding self).
      if (seenMemberIdsRef.current) {
        const prev = seenMemberIdsRef.current;
        let newEntries = 0;
        for (const m of memList) {
          if (!prev.has(m.userId) && m.userId !== user?.id) newEntries++;
        }
        if (newEntries > 0) playRoomEnterSound();
      }
      seenMemberIdsRef.current = new Set(memList.map((m) => m.userId));

      // --- Detect new messages and play the message sound (excluding ones
      //     the current user just sent themselves).
      if (seenMessageIdsRef.current) {
        const prev = seenMessageIdsRef.current;
        let newInbound = 0;
        for (const msg of msgList) {
          if (prev.has(msg.id)) continue;
          if (msg.senderId === user?.id) continue;
          newInbound++;
        }
        if (newInbound > 0) playMessageSound();
      }
      seenMessageIdsRef.current = new Set(msgList.map((m) => m.id));

      setMessages(msgList);
      setMembers(memList);
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
    // Always return to the Rooms tab. When the user enters a room via
    // auto-join we use `router.replace(...)`, which means there's no history
    // to go back to and `router.back()` becomes a no-op. Use a hard replace
    // so back always lands on the rooms list.
    router.replace('/(tabs)');
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
        <View testID={`msg-avatar-${item.senderId}`} style={styles.msgAvatarWrap}>
          <AvatarWithAura
            photoUrl={item.senderPhoto}
            displayName={item.senderName}
            size={40}
            vipTier={item.senderVipTier}
            vipBadgeId={item.senderVipBadgeId}
            auraType={item.senderAuraType}
            auraColor={item.senderAuraColor}
            enlargedAvatar={item.senderEnlargedAvatar}
            shape="square"
            showBadge
          />
        </View>
        <View style={styles.msgContentCol}>
          <Text
            style={[
              styles.senderName,
              item.senderUsernameColor ? { color: item.senderUsernameColor } : null,
            ]}
            numberOfLines={1}
          >
            {item.senderName}
          </Text>
          <Text
            style={[
              styles.messageText,
              item.senderChatColor ? { color: item.senderChatColor } : null,
            ]}
            numberOfLines={0}
          >
            {item.messageText}
          </Text>
        </View>
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

  // Tap on any user's avatar (including your own) → open profile popup
  const handleAvatarPress = (member: Member) => {
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
      {/* Full-screen room background image — floats behind header, chat, and input */}
      {room?.roomBackground ? (
        <Image
          source={{ uri: room.roomBackground }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : null}
      {/* Subtle veil so foreground text stays readable */}
      <LinearGradient
        colors={['rgba(15,10,31,0.55)', 'rgba(15,10,31,0.18)', 'rgba(15,10,31,0.55)']}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* VIP Elite Priority Welcome — slides down at top, never blocks chat */}
      <VipEliteWelcomeBanner roomId={id as string} />
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {activeRoomTab !== 'board' && (
            <TouchableOpacity onPress={handleBack} style={styles.backButton} testID="room-back-btn">
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          )}
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
            {dmUnreadCount > 0 && (
              <View style={styles.dmUnreadDot} testID="dm-unread-dot" />
            )}
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
            color={activeRoomTab === 'feed' ? '#7c3aed' : '#f1f5f9'}
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
            color={activeRoomTab === 'chat' ? '#7c3aed' : '#f1f5f9'}
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
            color={activeRoomTab === 'board' ? '#7c3aed' : '#f1f5f9'}
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
    position: 'relative',
  },
  roomTabs: {
    flexDirection: 'row',
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  roomTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  roomTabActive: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  roomTabText: {
    color: '#f1f5f9',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  roomTabTextActive: {
    color: '#7c3aed',
    textShadowColor: 'transparent',
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
    position: 'relative',
    minHeight: 56,
    backgroundColor: 'transparent',
    zIndex: 2,
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
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#f1f5f9',
    textAlign: 'center',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  messagesButton: {
    padding: 8,
    position: 'relative',
  },
  dmUnreadDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ec4899',
    borderWidth: 1.5,
    borderColor: '#0f0a1f',
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
    alignItems: 'center',          // vertically center name+text with the avatar
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  msgAvatarWrap: {
    marginRight: 10,
    alignSelf: 'center',           // keep the avatar visually anchored to the centerline
  },
  msgContentCol: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,                 // matches avatar height so name+text vertically center
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    overflow: 'hidden',
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  senderName: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '700',
    lineHeight: 18,
    marginBottom: 1,
  },
  messageText: {
    fontSize: 15,
    color: '#1f2937',
    lineHeight: 20,
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
    backgroundColor: 'transparent',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.30)',
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
