import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';
import type { Gift } from '@/src/types/profile';
import { useAuth } from '@/src/contexts/AuthContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  receiverId: string | null;
  receiverName?: string;
  onSent?: () => void;
}

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

export default function GiftSendModal({ visible, onClose, receiverId, receiverName, onSent }: Props) {
  const { user, refreshUser } = useAuth();
  const [catalog, setCatalog] = useState<Gift[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/gifts/catalog');
      setCatalog(res.data);
    } catch (e) {
      console.error('Failed to load gifts', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadCatalog();
      setSelectedId(null);
      setMessage('');
    }
  }, [visible, loadCatalog]);

  const selected = catalog.find((g) => g.id === selectedId) || null;

  const handleSend = async () => {
    if (!selected || !receiverId) return;
    if ((user?.coins || 0) < selected.price) {
      showAlert('Not enough coins', `You need ${selected.price} coins. You have ${user?.coins || 0}.`);
      return;
    }
    setSending(true);
    try {
      await api.post('/gifts/send', {
        receiverId,
        giftId: selected.id,
        message: message.trim() || undefined,
      });
      await refreshUser();
      showAlert('🎉 Gift sent!', `Sent a ${selected.name} to ${receiverName || 'them'}.`);
      onSent?.();
      onClose();
    } catch (e: any) {
      showAlert('Error', e?.response?.data?.detail || 'Failed to send gift');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Ionicons name="gift" size={22} color={COLORS.accent} />
              <Text style={styles.headerTitle}>Send a gift</Text>
            </View>
            <TouchableOpacity onPress={onClose} testID="gift-modal-close">
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.balanceRow}>
            <Ionicons name="wallet" size={14} color={COLORS.coin} />
            <Text style={styles.balanceText}>Your coins: {user?.coins || 0}</Text>
            {receiverName ? (
              <Text style={styles.recipientText}>To: {receiverName}</Text>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
              {catalog.map((gift) => {
                const isSelected = gift.id === selectedId;
                const isAffordable = (user?.coins || 0) >= gift.price;
                return (
                  <TouchableOpacity
                    key={gift.id}
                    onPress={() => setSelectedId(gift.id)}
                    style={[
                      styles.giftCard,
                      isSelected && { borderColor: gift.color, backgroundColor: '#1f1830' },
                      !isAffordable && { opacity: 0.45 },
                    ]}
                    activeOpacity={0.8}
                    testID={`gift-${gift.id}`}
                  >
                    <View style={[styles.giftIconWrap, { backgroundColor: gift.color + '22' }]}>
                      <Ionicons name={gift.icon as any} size={28} color={gift.color} />
                    </View>
                    <Text style={styles.giftName} numberOfLines={1}>{gift.name}</Text>
                    <View style={styles.priceRow}>
                      <Ionicons name="logo-bitcoin" size={11} color={COLORS.coin} />
                      <Text style={styles.priceText}>{gift.price}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {selected && (
            <View style={styles.composeBox}>
              <TextInput
                style={styles.composeInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Add a message (optional)"
                placeholderTextColor={COLORS.textSecondary}
                maxLength={140}
              />
            </View>
          )}

          <TouchableOpacity
            disabled={!selected || sending}
            onPress={handleSend}
            style={[styles.sendBtn, (!selected || sending) && { opacity: 0.5 }]}
            testID="gift-send-confirm"
          >
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtnGradient}
            >
              {sending ? (
                <ActivityIndicator color={COLORS.text} />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color={COLORS.text} />
                  <Text style={styles.sendBtnText}>
                    {selected ? `Send ${selected.name} · ${selected.price}🪙` : 'Pick a gift'}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#15101f',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3a2f4d',
    alignSelf: 'center',
    marginBottom: SPACING.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  balanceText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  recipientText: {
    marginLeft: 'auto',
    color: COLORS.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  loadingBox: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    justifyContent: 'flex-start',
  },
  giftCard: {
    width: '30%',
    backgroundColor: '#1a1226',
    borderRadius: 14,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  giftIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  giftName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  priceRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  priceText: {
    color: COLORS.coin,
    fontSize: 11,
    fontWeight: '700',
  },
  composeBox: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  composeInput: {
    backgroundColor: '#1a1226',
    borderRadius: 12,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2240',
  },
  sendBtn: {
    marginTop: SPACING.md,
    marginHorizontal: SPACING.lg,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sendBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: 14,
  },
  sendBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
});
