import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  TextInput, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  receiverId: string;
  receiverName: string;
  userCoins: number;
  onSuccess: () => void;
}

const PRESETS = [10, 50, 100, 250, 500];

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function SendCoinsModal({
  visible, onClose, receiverId, receiverName, userCoins, onSuccess,
}: Props) {
  const [amount, setAmount] = useState<string>('10');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ sentToday: number; dailyLimit: number; remainingToday: number; minPerSend: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    setAmount('10');
    setMessage('');
    (async () => {
      try {
        const r = await api.get('/coins/send-status');
        setStatus(r.data);
      } catch (e) {
        console.error('status fail', e);
      }
    })();
  }, [visible]);

  const numAmount = parseInt(amount, 10) || 0;
  const min = status?.minPerSend ?? 10;
  const remaining = status?.remainingToday ?? 1000;
  const canSend =
    numAmount >= min &&
    numAmount <= userCoins &&
    numAmount <= remaining;

  const handleSend = async () => {
    if (!canSend) {
      showAlert('Cannot send', `Amount must be ≥${min}, ≤${userCoins} (your wallet), and ≤${remaining} (daily cap remaining).`);
      return;
    }
    setLoading(true);
    try {
      const r = await api.post('/coins/send', { receiverId, amount: numAmount, message });
      onSuccess();
      onClose();
      showAlert('Sent!', r.data?.message || `Sent ${numAmount} coins to ${receiverName}`);
    } catch (e: any) {
      showAlert('Failed', e.response?.data?.detail || 'Could not send coins');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card} testID="send-coins-modal">
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="cash" size={28} color="#fbbf24" />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="close-send-coins">
              <Ionicons name="close" size={22} color="#1f2937" />
            </TouchableOpacity>
          </View>
          <Text style={styles.title}>Send coins</Text>
          <Text style={styles.subtitle}>to {receiverName}</Text>

          {status && (
            <View style={styles.limitRow}>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Your balance</Text>
                <Text style={styles.limitValue}>{userCoins}🪙</Text>
              </View>
              <View style={styles.limitItem}>
                <Text style={styles.limitLabel}>Daily remaining</Text>
                <Text style={styles.limitValue}>{status.remainingToday}🪙</Text>
              </View>
            </View>
          )}

          <Text style={styles.fieldLabel}>Amount (min {min})</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            style={styles.amountInput}
            placeholder="10"
            placeholderTextColor="#9ca3af"
            testID="send-coins-amount-input"
          />

          <View style={styles.presetsRow}>
            {PRESETS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.preset, numAmount === p && styles.presetActive]}
                onPress={() => setAmount(String(p))}
                testID={`preset-${p}`}
              >
                <Text style={[styles.presetText, numAmount === p && styles.presetTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Message (optional)</Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            style={styles.msgInput}
            multiline
            maxLength={200}
            placeholder="Add a note…"
            placeholderTextColor="#9ca3af"
            testID="send-coins-message-input"
          />

          <TouchableOpacity
            style={[styles.sendBtn, !canSend && { opacity: 0.4 }]}
            onPress={handleSend}
            disabled={!canSend || loading}
            testID="send-coins-submit"
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="send" size={16} color="#fff" />
                <Text style={styles.sendBtnText}>Send {numAmount}🪙</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Max 1000 coins per 24h. Min 10 per send.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,11,25,0.7)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  card: { backgroundColor: '#fdfcfa', borderRadius: 22, padding: SPACING.lg, width: '100%', maxWidth: 420 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#1f2937', marginTop: 10 },
  subtitle: { fontSize: 14, color: '#6b7280', marginTop: 2 },
  limitRow: { flexDirection: 'row', gap: 10, marginTop: SPACING.md },
  limitItem: { flex: 1, backgroundColor: '#f9fafb', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  limitLabel: { fontSize: 11, color: '#6b7280' },
  limitValue: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginTop: 4 },
  fieldLabel: { fontSize: 11, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.md, marginBottom: 6 },
  amountInput: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 22, fontWeight: '800', color: '#1f2937' },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  preset: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f3f4f6', borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb' },
  presetActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  presetText: { fontSize: 13, color: '#374151', fontWeight: '700' },
  presetTextActive: { color: '#fff' },
  msgInput: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1f2937', minHeight: 60, textAlignVertical: 'top' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 14, marginTop: SPACING.md },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  disclaimer: { textAlign: 'center', fontSize: 11, color: '#9ca3af', marginTop: 10 },
});

// keep COLORS reference for linter
void COLORS;
