import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/src/contexts/AuthContext';
import { VIP_STYLES } from '@/src/utils/vip';
import VipShopModal from '@/src/components/VipShopModal';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

export default function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [loading, setLoading] = useState(false);
  const [vipModalOpen, setVipModalOpen] = useState(false);
  const vipStyle = user?.vipTier ? VIP_STYLES[user.vipTier] : null;

  useEffect(() => {
    if (editing && user) {
      setDisplayName(user.displayName);
      setBio(user.bio || '');
    }
  }, [editing, user]);

  const pickImage = async (target: 'photoUrl' | 'bannerUrl') => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: target === 'photoUrl' ? [1, 1] : [16, 9],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      try {
        await api.put('/users/profile', { [target]: base64Image });
        await refreshUser();
      } catch (error) {
        Alert.alert('Error', 'Failed to update image');
      }
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/users/profile', { displayName, bio });
      await refreshUser();
      setEditing(false);
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('Are you sure you want to logout?')) logout();
    } else {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout },
      ]);
    }
  };

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Banner / Background Image Section */}
        <View style={styles.bannerSection}>
          {user.bannerUrl ? (
            <Image source={{ uri: user.bannerUrl }} style={styles.banner} contentFit="cover" />
          ) : (
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent, COLORS.secondary]}
              style={styles.banner}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.5)', COLORS.background]}
            style={styles.bannerGradient}
          />
          <TouchableOpacity
            style={styles.bannerEditButton}
            onPress={() => pickImage('bannerUrl')}
            testID="edit-banner-btn"
          >
            <Ionicons name="image" size={16} color={COLORS.text} />
            <Text style={styles.bannerEditText}>Edit Banner</Text>
          </TouchableOpacity>
          {!editing && (
            <TouchableOpacity
              style={styles.headerEditButton}
              onPress={() => setEditing(true)}
              testID="edit-profile-btn"
            >
              <Ionicons name="pencil" size={18} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>

        {/* Avatar overlapping banner */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={() => pickImage('photoUrl')}
            style={[
              styles.avatarContainer,
              vipStyle && { transform: [{ scale: vipStyle.avatarScale }] },
            ]}
            testID="edit-avatar-btn"
          >
            {user.photoUrl ? (
              <Image
                source={{ uri: user.photoUrl }}
                style={[
                  styles.avatarImg,
                  vipStyle && { borderColor: vipStyle.borderColor, borderWidth: 4 },
                ]}
              />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  vipStyle && { borderColor: vipStyle.borderColor, borderWidth: 4 },
                ]}
              >
                <Ionicons name="person" size={56} color={COLORS.textSecondary} />
              </View>
            )}
            {vipStyle && (
              <View style={[styles.vipCrownOnAvatar, { backgroundColor: vipStyle.crownColor }]}>
                <Ionicons name={vipStyle.badgeIcon} size={14} color={COLORS.background} />
              </View>
            )}
            <View style={styles.cameraIcon}>
              <Ionicons name="camera" size={14} color={COLORS.text} />
            </View>
          </TouchableOpacity>
          <Text
            style={[
              styles.displayName,
              vipStyle && { color: vipStyle.nameColor, fontWeight: '800' },
            ]}
          >
            {user.displayName}
            {vipStyle && (
              <Text style={{ color: vipStyle.nameColor }}> {vipStyle.badgeIcon === 'diamond' ? '💎' : '⭐'}</Text>
            )}
          </Text>
          <Text style={styles.username}>@{user.username}</Text>
          {vipStyle && (
            <View style={[styles.vipTagPill, { borderColor: vipStyle.crownColor }]}>
              <Ionicons name={vipStyle.badgeIcon} size={12} color={vipStyle.crownColor} />
              <Text style={[styles.vipTagText, { color: vipStyle.crownColor }]}>
                {vipStyle.name}
              </Text>
            </View>
          )}
        </View>

        {/* Stats Row - no XP/Level, replaced with VIP */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="wallet" size={22} color={COLORS.coin} />
            <Text style={styles.statValue}>{user.coins}</Text>
            <Text style={styles.statLabel}>Coins</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.statBox,
              vipStyle && { borderWidth: 1.5, borderColor: vipStyle.crownColor },
            ]}
            onPress={() => setVipModalOpen(true)}
            testID="profile-vip-stat"
          >
            <Ionicons
              name={user.vipTier === 'elite' ? 'diamond' : user.vipTier === 'pro' ? 'star' : 'diamond-outline'}
              size={22}
              color={vipStyle ? vipStyle.crownColor : COLORS.coin}
            />
            <Text style={[styles.statValue, vipStyle && { color: vipStyle.crownColor }]}>
              {user.vipTier ? (user.vipTier === 'elite' ? 'ELITE' : 'PRO') : 'Get VIP'}
            </Text>
            <Text style={styles.statLabel}>VIP Status</Text>
          </TouchableOpacity>
          <View style={styles.statBox}>
            <Ionicons name="gift" size={22} color={COLORS.accent} />
            <Text style={styles.statValue}>{user.vouchers || 0}</Text>
            <Text style={styles.statLabel}>Vouchers</Text>
          </View>
        </View>

        {editing ? (
          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Display Name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholderTextColor={COLORS.textSecondary}
                testID="display-name-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                placeholderTextColor={COLORS.textSecondary}
                placeholder="Tell us about yourself..."
                testID="bio-input"
              />
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => setEditing(false)}
              >
                <Text style={styles.buttonSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.buttonPrimary]}
                onPress={handleSave}
                disabled={loading}
                testID="save-profile-btn"
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.text} />
                ) : (
                  <Text style={styles.buttonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.infoSection}>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Bio</Text>
              <Text style={styles.infoValue}>{user.bio || 'No bio yet'}</Text>
            </View>
            <View style={styles.infoBox}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>

      <VipShopModal visible={vipModalOpen} onClose={() => setVipModalOpen(false)} />
    </SafeAreaView>
  );
}

const BANNER_HEIGHT = 180;
const AVATAR_SIZE = 110;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingBottom: SPACING.lg,
  },
  bannerSection: {
    width: '100%',
    height: BANNER_HEIGHT,
    position: 'relative',
    backgroundColor: COLORS.cardBg,
  },
  banner: {
    width: '100%',
    height: '100%',
  },
  bannerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
  },
  bannerEditButton: {
    position: 'absolute',
    bottom: SPACING.sm,
    right: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  bannerEditText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  headerEditButton: {
    position: 'absolute',
    top: SPACING.md + 30,
    right: SPACING.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    marginTop: -AVATAR_SIZE / 2,
    paddingHorizontal: SPACING.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  avatarImg: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: COLORS.background,
  },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: COLORS.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.background,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  vipCrownOnAvatar: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  vipTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  vipTagText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  username: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
    gap: 8,
  },
  statBox: {
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  form: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: SPACING.md,
    color: COLORS.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  button: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: COLORS.primary,
  },
  buttonSecondary: {
    backgroundColor: COLORS.cardBg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonSecondaryText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  infoSection: {
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  infoBox: {
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderRadius: 12,
  },
  infoLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: COLORS.text,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cardBg,
    padding: SPACING.md,
    borderRadius: 12,
    marginTop: SPACING.lg,
    marginHorizontal: SPACING.md,
    gap: SPACING.xs,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
  },
});
