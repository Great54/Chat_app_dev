import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import { COLORS, SPACING } from '@/src/constants/theme';
import { VIP_STYLES } from '@/src/utils/vip';
import VipProSettingsModal from './VipProSettingsModal';
import { canCustomizeVipPro } from '@/src/utils/vipProCustomization';

interface VipTierConfig {
  id: 'pro' | 'elite';
  name: string;
  price: number;
  bonusCoins: number;
  voucherDiscount: number;
  vouchers: number;
  perks: string[];
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const showConfirm = (title: string, message: string, onConfirm: () => void) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
  } else {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: onConfirm },
    ]);
  }
};

export default function VipShopModal({ visible, onClose }: Props) {
  const { user, refreshUser } = useAuth();
  const [tiers, setTiers] = useState<VipTierConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [showVipProSettings, setShowVipProSettings] = useState(false);

  useEffect(() => {
    if (visible) loadTiers();
  }, [visible]);

  const loadTiers = async () => {
    try {
      const res = await api.get('/vip/tiers');
      // Ensure tiers is always an array
      setTiers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to load VIP tiers');
      setTiers([]);
    }
  };

  const handlePurchase = (tier: VipTierConfig) => {
    if (!user) return;
    const currentTier = user.vipTier;
    let price = tier.price;
    if (currentTier === 'pro' && tier.id === 'elite') {
      price = tier.price - 1000;
    }
    showConfirm(
      `Activate ${tier.name}`,
      `This will deduct ${price} coins and grant you ${tier.bonusCoins} bonus coins + ${tier.vouchers} vouchers.`,
      async () => {
        setLoading(true);
        try {
          await api.post('/vip/purchase', { tier: tier.id });
          await refreshUser();
          showAlert('Success! 🎉', `Welcome to ${tier.name}!`);
          onClose();
        } catch (e: any) {
          showAlert('Error', e.response?.data?.detail || 'Failed to activate VIP');
        } finally {
          setLoading(false);
        }
      }
    );
  };

  const renderTier = (tier: VipTierConfig) => {
    const styleConfig = VIP_STYLES[tier.id];
    const isCurrentTier = user?.vipTier === tier.id;
    const isUpgradePath = user?.vipTier === 'pro' && tier.id === 'elite';
    const isLocked = user?.vipTier === 'elite' && tier.id === 'pro';
    const price = isUpgradePath ? tier.price - 1000 : tier.price;

    return (
      <View key={tier.id} style={styles.tierCard} testID={`vip-tier-${tier.id}`}>
        <LinearGradient
          colors={styleConfig.borderColors as [string, string, ...string[]]}
          style={styles.tierGradientBorder}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.tierInner}>
            <View style={styles.tierHeader}>
              <Ionicons
                name={tier.id === 'elite' ? 'diamond' : 'star'}
                size={28}
                color={styleConfig.crownColor}
              />
              <View style={{ flex: 1, marginLeft: SPACING.sm }}>
                <Text style={[styles.tierName, { color: styleConfig.crownColor }]}>
                  {tier.name}
                </Text>
                <Text style={styles.tierPrice}>
                  {price} 🪙 coins
                  {isUpgradePath && (
                    <Text style={styles.upgradeNote}> (upgrade)</Text>
                  )}
                </Text>
              </View>
            </View>

            <View style={styles.perksList}>
              {tier.perks.map((perk, idx) => (
                <View key={idx} style={styles.perkRow}>
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={styleConfig.crownColor}
                  />
                  <Text style={styles.perkText}>{perk}</Text>
                </View>
              ))}
            </View>

            {isCurrentTier ? (
              <View style={[styles.button, styles.buttonActive]}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.text} />
                <Text style={styles.buttonText}>Active</Text>
              </View>
            ) : isLocked ? (
              <View style={[styles.button, styles.buttonLocked]}>
                <Text style={styles.buttonTextLocked}>Lower tier</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.button, { backgroundColor: styleConfig.crownColor }]}
                onPress={() => handlePurchase(tier)}
                disabled={loading}
                testID={`subscribe-${tier.id}`}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.background} />
                ) : (
                  <>
                    <Ionicons name="rocket" size={16} color={COLORS.background} />
                    <Text style={[styles.buttonText, { color: COLORS.background }]}>
                      {isUpgradePath ? 'Upgrade' : 'Subscribe'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.titleRow}>
              <Ionicons name="diamond" size={24} color={COLORS.coin} />
              <Text style={styles.modalTitle}>Go VIP</Text>
            </View>
            <TouchableOpacity onPress={onClose} testID="vip-close">
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Unlock exclusive perks & shopping vouchers
          </Text>

          {user && (
            <View style={styles.balanceRow}>
              <Ionicons name="wallet" size={16} color={COLORS.coin} />
              <Text style={styles.balanceText}>Your balance: {user.coins} coins</Text>
              {user.vipTier && (
                <View style={styles.currentVipBadge}>
                  <Ionicons name={user.vipTier === 'elite' ? 'diamond' : 'star'} size={12} color={COLORS.background} />
                  <Text style={styles.currentVipText}>
                    {VIP_STYLES[user.vipTier]?.name}
                  </Text>
                </View>
              )}
            </View>
          )}

          <ScrollView contentContainerStyle={styles.tiersContainer}>
            {canCustomizeVipPro(user?.vipTier) && (
              <TouchableOpacity
                style={styles.proSettingsBtn}
                onPress={() => setShowVipProSettings(true)}
                data-testid="open-vip-pro-settings"
              >
                <LinearGradient
                  colors={user?.vipTier === 'elite'
                    ? (["#fbbf24", "#dc2626", "#7c2d12"] as [string, string, ...string[]])
                    : (["#06b6d4", "#7c3aed"] as [string, string, ...string[]])}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.proSettingsBg}
                >
                  <Ionicons
                    name={user?.vipTier === 'elite' ? 'star' : 'color-palette'}
                    size={22}
                    color="#fff"
                  />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.proSettingsTitle}>
                      {user?.vipTier === 'elite' ? 'VIP Elite Customization' : 'VIP Pro Customization'}
                    </Text>
                    <Text style={styles.proSettingsSub}>
                      {user?.vipTier === 'elite'
                        ? 'Elite badges, premium aura, colors · 3,500 coins / month'
                        : 'Badge, aura, chat & username colors · 2,000 coins / month'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            )}
            {Array.isArray(tiers) && tiers.length > 0 ? (
              tiers.map(renderTier)
            ) : (
              <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />
            )}
          </ScrollView>
        </View>
      </View>
      <VipProSettingsModal
        visible={showVipProSettings}
        onClose={() => setShowVipProSettings(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: SPACING.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
  },
  balanceText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  currentVipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.coin,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  proSettingsBtn: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: 14,
    overflow: 'hidden',
  },
  proSettingsBg: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  proSettingsTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  proSettingsSub: {
    color: '#e5e7eb',
    fontSize: 11,
    marginTop: 2,
  },
  currentVipText: {
    color: COLORS.background,
    fontSize: 11,
    fontWeight: '700',
  },
  tiersContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  tierCard: {
    marginBottom: SPACING.md,
  },
  tierGradientBorder: {
    padding: 2,
    borderRadius: 16,
  },
  tierInner: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 14,
    padding: SPACING.md,
  },
  tierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  tierName: {
    fontSize: 22,
    fontWeight: '800',
  },
  tierPrice: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  upgradeNote: {
    color: COLORS.success,
    fontSize: 11,
  },
  perksList: {
    gap: 8,
    marginBottom: SPACING.md,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  perkText: {
    color: COLORS.text,
    fontSize: 13,
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  buttonActive: {
    backgroundColor: COLORS.success,
  },
  buttonLocked: {
    backgroundColor: COLORS.border,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  buttonTextLocked: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
});
