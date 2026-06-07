import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  VIP_PRO_BADGES,
  VIP_PRO_AURAS,
  CHAT_COLORS,
  USERNAME_COLORS,
  AURA_COLORS,
  PM_BOX_COLORS,
  VIP_PRO_MONTHLY_COINS,
  canCustomizeVipPro,
  findBadge,
  getAuraStyle,
  getBadgesForTier,
  getTierConfig,
} from '@/src/utils/vipProCustomization';
import AvatarWithAura from './AvatarWithAura';

type PickerType = null | 'badge' | 'aura' | 'auraColor' | 'chatColor' | 'usernameColor' | 'pmBoxColor';

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface SettingsState {
  vipBadgeId?: string | null;
  auraType?: string | null;
  auraColor?: string | null;
  chatColor?: string | null;
  usernameColor?: string | null;
  pmBoxColor?: string | null;
  enlargedAvatar?: boolean;
  nextGrantInDays?: number | null;
}

const ACCENT = '#5dd9ff';

export default function VipProSettingsModal({ visible, onClose }: Props) {
  const { user, refreshUser } = useAuth();
  const [picker, setPicker] = useState<PickerType>(null);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<SettingsState>({});

  const eligible = canCustomizeVipPro(user?.vipTier);
  const tierCfg = getTierConfig(user?.vipTier);
  const availableBadges = getBadgesForTier(user?.vipTier);
  const monthlyCoins = tierCfg?.monthlyCoins ?? VIP_PRO_MONTHLY_COINS;
  const tierLabel = tierCfg?.label || 'VIP';

  useEffect(() => {
    if (visible && eligible) {
      loadSettings();
    }
  }, [visible, eligible]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/vip-pro/settings');
      setSettings({
        vipBadgeId: data.vipBadgeId,
        auraType: data.auraType,
        auraColor: data.auraColor,
        chatColor: data.chatColor,
        usernameColor: data.usernameColor,
        pmBoxColor: data.pmBoxColor,
        enlargedAvatar: !!data.enlargedAvatar,
        nextGrantInDays: data.nextGrantInDays,
      });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (patch: Partial<SettingsState>) => {
    const merged = { ...settings, ...patch };
    setSettings(merged);
    try {
      await api.put('/vip-pro/settings', {
        vipBadgeId: merged.vipBadgeId ?? '',
        auraType: merged.auraType ?? '',
        auraColor: merged.auraColor ?? '',
        chatColor: merged.chatColor ?? '',
        usernameColor: merged.usernameColor ?? '',
        pmBoxColor: merged.pmBoxColor ?? '',
        enlargedAvatar: !!merged.enlargedAvatar,
      });
      await refreshUser();
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.detail || 'Failed to save');
      setSettings(settings); // revert
    }
  };

  const selectedBadge = useMemo(() => findBadge(settings.vipBadgeId), [settings.vipBadgeId]);

  if (!visible) return null;

  if (!eligible) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={[styles.card, { padding: 32, alignItems: 'center' }]}>
            <Ionicons name="diamond" size={48} color={ACCENT} />
            <Text style={styles.title}>VIP Pro Required</Text>
            <Text style={styles.subtitle}>
              Upgrade to VIP Pro or Elite to unlock custom badges, auras, and chat colors.
            </Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={onClose} data-testid="vip-pro-required-close">
              <Text style={styles.primaryBtnText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="diamond" size={22} color={ACCENT} />
              <Text style={styles.title}>{tierLabel} Customization</Text>
            </View>
            <TouchableOpacity onPress={onClose} data-testid="vip-pro-settings-close">
              <Ionicons name="close" size={28} color="#ef4444" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16 }}>
              {/* Preview */}
              <View style={styles.previewBox}>
                <AvatarWithAura
                  photoUrl={user?.photoUrl}
                  displayName={user?.displayName}
                  size={88}
                  vipBadgeId={settings.vipBadgeId}
                  auraType={settings.auraType}
                  auraColor={settings.auraColor}
                  enlargedAvatar={settings.enlargedAvatar}
                />
                <Text
                  style={[
                    styles.previewName,
                    { color: settings.usernameColor || '#fff' },
                  ]}
                  data-testid="vip-pro-preview-username"
                >
                  {user?.displayName || user?.username}
                </Text>
                <View
                  style={[
                    styles.previewChatBubble,
                    { backgroundColor: settings.pmBoxColor || '#1f1730' },
                  ]}
                >
                  <Text
                    style={{ color: settings.chatColor || '#fff', fontWeight: '600' }}
                    data-testid="vip-pro-preview-chat"
                  >
                    Hi! This is how my chat looks 💎
                  </Text>
                </View>
              </View>

              {/* Monthly bonus card */}
              <View style={styles.bonusCard}>
                <Ionicons name="gift" size={22} color="#fbbf24" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.bonusTitle}>Monthly {tierLabel} Bonus</Text>
                  <Text style={styles.bonusSub}>
                    {monthlyCoins.toLocaleString()} coins every 30 days
                    {typeof settings.nextGrantInDays === 'number'
                      ? ` · next in ${settings.nextGrantInDays}d`
                      : ' · claim on next login'}
                  </Text>
                </View>
              </View>

              {/* Setting rows */}
              <SettingRow
                testID="row-badge"
                icon="ribbon"
                label="VIP Badge"
                value={selectedBadge?.label || 'None'}
                preview={
                  selectedBadge ? (
                    <View
                      style={[
                        styles.badgeChip,
                        { backgroundColor: selectedBadge.bg },
                      ]}
                    >
                      <Text style={{ fontSize: 18 }}>{selectedBadge.emoji}</Text>
                    </View>
                  ) : null
                }
                onPress={() => setPicker('badge')}
              />
              <SettingRow
                testID="row-aura"
                icon="sparkles"
                label="Aura Type"
                value={
                  VIP_PRO_AURAS.find((a) => a.id === (settings.auraType || 'none'))?.label || 'None'
                }
                onPress={() => setPicker('aura')}
              />
              <SettingRow
                testID="row-aura-color"
                icon="color-palette"
                label="Aura Color"
                value={settings.auraColor || 'Default'}
                preview={
                  settings.auraColor ? (
                    <View
                      style={[styles.colorDot, { backgroundColor: settings.auraColor }]}
                    />
                  ) : null
                }
                onPress={() => setPicker('auraColor')}
              />
              <SettingRow
                testID="row-chat-color"
                icon="chatbubbles"
                label="Chat Text Color"
                value={settings.chatColor || 'Default'}
                preview={
                  settings.chatColor ? (
                    <View style={[styles.colorDot, { backgroundColor: settings.chatColor }]} />
                  ) : null
                }
                onPress={() => setPicker('chatColor')}
              />
              <SettingRow
                testID="row-username-color"
                icon="person"
                label="Username Color"
                value={settings.usernameColor || 'Default'}
                preview={
                  settings.usernameColor ? (
                    <View style={[styles.colorDot, { backgroundColor: settings.usernameColor }]} />
                  ) : null
                }
                onPress={() => setPicker('usernameColor')}
              />
              <SettingRow
                testID="row-pm-color"
                icon="mail"
                label="PM Box Color"
                value={settings.pmBoxColor || 'Default'}
                preview={
                  settings.pmBoxColor ? (
                    <View style={[styles.colorDot, { backgroundColor: settings.pmBoxColor }]} />
                  ) : null
                }
                onPress={() => setPicker('pmBoxColor')}
              />

              {/* Enlarged avatar toggle */}
              <View style={styles.row}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <Ionicons name="resize" size={18} color={ACCENT} />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.rowLabel}>Enlarged Avatar</Text>
                    <Text style={styles.rowSub}>Show my profile picture 25% larger</Text>
                  </View>
                </View>
                <Switch
                  value={!!settings.enlargedAvatar}
                  onValueChange={(v) => saveSettings({ enlargedAvatar: v })}
                  trackColor={{ true: ACCENT, false: '#3f3f46' }}
                  thumbColor="#fff"
                  testID="toggle-enlarged-avatar"
                />
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Sub-pickers */}
      <PickerModal
        visible={picker === 'badge'}
        title="Pick Badge"
        onClose={() => setPicker(null)}
      >
        <View style={styles.gridBadges}>
          <TouchableOpacity
            style={[styles.badgeItem, { borderColor: '#ef4444' }]}
            onPress={() => {
              saveSettings({ vipBadgeId: null });
              setPicker(null);
            }}
            data-testid="badge-none"
          >
            <Ionicons name="close-circle" size={32} color="#ef4444" />
          </TouchableOpacity>
          {availableBadges.map((b) => {
            const isElite = b.id.startsWith('elite_');
            const selected = settings.vipBadgeId === b.id;
            return (
              <TouchableOpacity
                key={b.id}
                onPress={() => {
                  saveSettings({ vipBadgeId: b.id });
                  setPicker(null);
                }}
                style={[
                  styles.badgeItem,
                  { backgroundColor: b.bg },
                  isElite && { borderColor: '#fbbf24', borderWidth: 2 },
                  selected && { borderColor: ACCENT, borderWidth: 3 },
                ]}
                data-testid={`badge-${b.id}`}
              >
                <Text style={{ fontSize: 30 }}>{b.emoji}</Text>
                {isElite && (
                  <View style={styles.eliteRibbon}>
                    <Text style={styles.eliteRibbonText}>ELITE</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </PickerModal>

      <PickerModal
        visible={picker === 'aura'}
        title="Pick Aura Type"
        onClose={() => setPicker(null)}
      >
        <View style={styles.gridAuras}>
          {VIP_PRO_AURAS.map((a) => {
            const selected = (settings.auraType || 'none') === a.id;
            const aura = getAuraStyle(a.id, settings.auraColor || '#FFD700');
            return (
              <TouchableOpacity
                key={a.id}
                onPress={() => {
                  saveSettings({ auraType: a.id === 'none' ? null : a.id });
                  setPicker(null);
                }}
                style={styles.auraItem}
                data-testid={`aura-${a.id}`}
              >
                <View
                  style={[
                    styles.auraPreview,
                    aura,
                    selected && { borderColor: ACCENT, borderWidth: 2 },
                  ]}
                >
                  {user?.photoUrl ? (
                    <View style={styles.auraImg} />
                  ) : (
                    <Text style={styles.auraInitial}>
                      {(user?.displayName || '?').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <Text style={styles.auraLabel}>{a.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </PickerModal>

      <ColorPicker
        visible={picker === 'auraColor'}
        title="Pick Aura Color"
        colors={AURA_COLORS}
        selected={settings.auraColor}
        onPick={(c) => {
          saveSettings({ auraColor: c });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
        testIDPrefix="aura-color"
      />
      <ColorPicker
        visible={picker === 'chatColor'}
        title="Pick Chat Color"
        colors={CHAT_COLORS}
        selected={settings.chatColor}
        onPick={(c) => {
          saveSettings({ chatColor: c });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
        testIDPrefix="chat-color"
      />
      <ColorPicker
        visible={picker === 'usernameColor'}
        title="Pick Username Color"
        colors={USERNAME_COLORS}
        selected={settings.usernameColor}
        onPick={(c) => {
          saveSettings({ usernameColor: c });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
        testIDPrefix="username-color"
      />
      <ColorPicker
        visible={picker === 'pmBoxColor'}
        title="Pick PM Box Color"
        colors={PM_BOX_COLORS}
        selected={settings.pmBoxColor}
        onPick={(c) => {
          saveSettings({ pmBoxColor: c });
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
        testIDPrefix="pm-color"
      />
    </Modal>
  );
}

interface SettingRowProps {
  icon: any;
  label: string;
  value: string;
  preview?: React.ReactNode;
  onPress: () => void;
  testID?: string;
}
function SettingRow({ icon, label, value, preview, onPress, testID }: SettingRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} data-testid={testID}>
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <Ionicons name={icon} size={18} color={ACCENT} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowSub} numberOfLines={1}>{value}</Text>
        </View>
      </View>
      {preview}
      <Ionicons name="chevron-forward" size={18} color="#71717a" />
    </TouchableOpacity>
  );
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}
function PickerModal({ visible, title, onClose, children }: PickerModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerCard}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} data-testid="picker-close">
              <Ionicons name="close" size={26} color="#ef4444" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 14 }}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

interface ColorPickerProps {
  visible: boolean;
  title: string;
  colors: string[];
  selected?: string | null;
  onPick: (c: string | null) => void;
  onClose: () => void;
  testIDPrefix: string;
}
function ColorPicker({ visible, title, colors, selected, onPick, onClose, testIDPrefix }: ColorPickerProps) {
  return (
    <PickerModal visible={visible} title={title} onClose={onClose}>
      <View style={styles.colorGrid}>
        <TouchableOpacity
          style={[styles.colorPill, { backgroundColor: '#fff', position: 'relative' }]}
          onPress={() => onPick(null)}
          data-testid={`${testIDPrefix}-none`}
        >
          <View style={styles.colorSlash} />
        </TouchableOpacity>
        {colors.map((c, i) => {
          const isSel = selected === c;
          return (
            <TouchableOpacity
              key={`${c}-${i}`}
              style={[
                styles.colorPill,
                { backgroundColor: c },
                isSel && { borderWidth: 3, borderColor: ACCENT },
              ]}
              onPress={() => onPick(c)}
              data-testid={`${testIDPrefix}-${c.replace('#', '')}`}
            />
          );
        })}
      </View>
    </PickerModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: 12,
  },
  card: {
    backgroundColor: '#0f0a1f',
    borderRadius: 18,
    overflow: 'hidden',
    maxHeight: '92%',
    borderWidth: 2,
    borderColor: ACCENT,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1730',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
  },
  subtitle: {
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnText: { color: '#0f0a1f', fontWeight: '700' },
  previewBox: {
    alignItems: 'center',
    paddingVertical: 18,
    backgroundColor: '#1a1230',
    borderRadius: 14,
    marginBottom: 14,
  },
  previewName: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: '700',
  },
  previewChatBubble: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    maxWidth: '85%',
  },
  bonusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1730',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fbbf2444',
  },
  bonusTitle: { color: '#fff', fontWeight: '700' },
  bonusSub: { color: '#a1a1aa', fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1230',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 8,
    gap: 10,
  },
  rowLabel: { color: '#fff', fontWeight: '600' },
  rowSub: { color: '#a1a1aa', fontSize: 12, marginTop: 2 },
  badgeChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  colorDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#fff4',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 14,
  },
  pickerCard: {
    backgroundColor: '#1a1230',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: ACCENT,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0f0a1f',
  },
  pickerTitle: { color: '#fff', fontWeight: '700', fontSize: 18 },
  gridBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 6,
  },
  badgeItem: {
    width: '22%',
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#1f1730',
    borderWidth: 1,
    borderColor: '#3f3f4666',
    position: 'relative',
    overflow: 'hidden',
  },
  eliteRibbon: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#fbbf24',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderBottomLeftRadius: 6,
  },
  eliteRibbonText: {
    color: '#0f0a1f',
    fontWeight: '800',
    fontSize: 8,
    letterSpacing: 0.5,
  },
  gridAuras: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  auraItem: {
    width: '31%',
    alignItems: 'center',
    marginBottom: 14,
  },
  auraPreview: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2a2240',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  auraImg: { width: 70, height: 70, backgroundColor: '#52525b', borderRadius: 35 },
  auraInitial: { color: '#fff', fontWeight: '800', fontSize: 28 },
  auraLabel: { color: '#fff', fontSize: 12, marginTop: 6 },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  colorPill: {
    width: 46,
    height: 32,
    borderRadius: 16,
    marginRight: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fff3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSlash: {
    position: 'absolute',
    width: 50,
    height: 3,
    backgroundColor: '#ef4444',
    transform: [{ rotate: '-25deg' }],
  },
});
