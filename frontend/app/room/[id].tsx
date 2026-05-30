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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import GamePanel from '@/src/components/GamePanel';
import { COLORS, SPACING } from '@/src/constants/theme';

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
}

interface Room {
  id: string;
  roomName: string;
  roomCategory: string;
  currentUserCount: number;
  maxCapacity: number;
}

export default function RoomScreen() {
  const { id } = useLocalSearchParams();
  const { user, refreshUser } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadRoomData();
    const interval = setInterval(() => {
      refreshRoomData();
    }, 3000); // Refresh every 3 seconds for real-time feel
    
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
      setMessages(messagesResponse.data);
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
      
      setMessages(messagesResponse.data);
      setMembers(membersResponse.data);
      
      const currentRoom = roomsResponse.data.find((r: Room) => r.id === id);
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
    const isOwnMessage = item.senderId === user?.id;
    const isSystem = item.senderId === 'system';
    
    if (isSystem) {
      return (
        <View style={styles.systemMessageContainer}>
          <Text style={styles.systemMessageText}>{item.messageText}</Text>
        </View>
      );
    }
    
    return (
      <View style={[styles.messageContainer, isOwnMessage && styles.ownMessage]}>
        {!isOwnMessage && (
          <View style={styles.avatar}>
            <Ionicons name="person" size={16} color={COLORS.textSecondary} />
          </View>
        )}
        <View style={[styles.messageBubble, isOwnMessage && styles.ownMessageBubble]}>
          {!isOwnMessage && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <Text style={styles.messageText}>{item.messageText}</Text>
        </View>
      </View>
    );
  };

  const renderMemberGrid = () => {
    const maxSlots = room?.maxCapacity || 36;
    const slots = [];
    
    // Fill with actual members
    for (let i = 0; i < members.length; i++) {
      slots.push(
        <View key={`member-${i}`} style={styles.memberSlot}>
          <View style={styles.memberAvatar}>
            <Ionicons name="person" size={16} color={COLORS.primary} />
          </View>
          <Text style={styles.memberLevel}>Lv{members[i].level}</Text>
        </View>
      );
    }
    
    // Fill empty slots
    for (let i = members.length; i < maxSlots; i++) {
      slots.push(
        <View key={`empty-${i}`} style={[styles.memberSlot, styles.emptySlot]}>
          <Ionicons name="person-outline" size={16} color={COLORS.border} />
        </View>
      );
    }
    
    return <View style={styles.memberGrid}>{slots}</View>;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{room?.roomName}</Text>
          <Text style={styles.headerSubtitle}>
            {room?.currentUserCount || 0}/{room?.maxCapacity || 36} members
          </Text>
        </View>
        <TouchableOpacity onPress={loadRoomData}>
          <Ionicons name="refresh" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      {renderMemberGrid()}

      {user && (
        <GamePanel
          roomId={id as string}
          currentUserId={user.id}
          userCoins={user.coins}
          onGameUpdate={refreshUser}
        />
      )}

      <KeyboardAvoidingView
        style={styles.chatContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>No messages yet. Start the conversation!</Text>
            </View>
          }
        />

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
            <Ionicons name="send" size={20} color={COLORS.text} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  memberGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.sm,
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    height: 140,
    overflow: 'hidden',
  },
  memberSlot: {
    width: '16.66%',
    height: 60,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatar: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 4,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  memberLevel: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  emptySlot: {
    opacity: 0.3,
  },
  chatContainer: {
    flex: 1,
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
  senderName: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 20,
  },
  emptyMessages: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    fontSize: 16,
    maxHeight: 100,
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
    color: COLORS.accent,
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    overflow: 'hidden',
  },
});
