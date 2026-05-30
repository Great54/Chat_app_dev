import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

interface GameResult {
  reward?: number;
  message?: string;
  playerCard?: number;
  houseCard?: number;
  result?: string;
}

export default function GamesScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);

  const playSpinWheel = async () => {
    if (!user || user.coins < 10) {
      Alert.alert('Insufficient Coins', 'You need at least 10 coins to play');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/games/spin-wheel');
      setGameResult(response.data);
      await refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to play game');
    } finally {
      setLoading(false);
    }
  };

  const playCardGame = async () => {
    if (!user || user.coins < 10) {
      Alert.alert('Insufficient Coins', 'You need at least 10 coins to play');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/games/card-game/draw');
      setGameResult(response.data);
      await refreshUser();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to play game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mini Games</Text>
        {user && (
          <View style={styles.coinDisplay}>
            <Ionicons name="wallet" size={20} color={COLORS.coin} />
            <Text style={styles.coinText}>{user.coins}</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.gameCard}>
          <View style={styles.gameIcon}>
            <Ionicons name="disc" size={48} color={COLORS.primary} />
          </View>
          <Text style={styles.gameTitle}>Spin the Wheel</Text>
          <Text style={styles.gameDescription}>
            Spin to win random coin rewards! Cost: 10 coins
          </Text>
          <TouchableOpacity
            style={styles.playButton}
            onPress={playSpinWheel}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="play" size={20} color={COLORS.text} />
                <Text style={styles.playButtonText}>Play (10 coins)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.gameCard}>
          <View style={styles.gameIcon}>
            <Ionicons name="card" size={48} color={COLORS.accent} />
          </View>
          <Text style={styles.gameTitle}>Card Game</Text>
          <Text style={styles.gameDescription}>
            Draw a card and beat the house! Higher card wins. Cost: 10 coins
          </Text>
          <TouchableOpacity
            style={styles.playButton}
            onPress={playCardGame}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.text} />
            ) : (
              <>
                <Ionicons name="play" size={20} color={COLORS.text} />
                <Text style={styles.playButtonText}>Play (10 coins)</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.comingSoonCard}>
          <View style={styles.gameIcon}>
            <Ionicons name="grid" size={48} color={COLORS.textSecondary} />
          </View>
          <Text style={styles.comingSoonTitle}>More Games Coming Soon!</Text>
          <Text style={styles.comingSoonText}>Ludo, Snake & Ladder, and more...</Text>
        </View>

        {gameResult && (
          <View style={styles.resultCard}>
            <Ionicons
              name={gameResult.reward && gameResult.reward > 0 ? 'trophy' : 'close-circle'}
              size={48}
              color={gameResult.reward && gameResult.reward > 0 ? COLORS.success : COLORS.error}
            />
            <Text style={styles.resultText}>{gameResult.message}</Text>
            {gameResult.playerCard !== undefined && (
              <View style={styles.cardsDisplay}>
                <View style={styles.cardBox}>
                  <Text style={styles.cardLabel}>Your Card</Text>
                  <Text style={styles.cardValue}>{gameResult.playerCard}</Text>
                </View>
                <View style={styles.cardBox}>
                  <Text style={styles.cardLabel}>House Card</Text>
                  <Text style={styles.cardValue}>{gameResult.houseCard}</Text>
                </View>
              </View>
            )}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setGameResult(null)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
  },
  coinDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  coinText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  content: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  gameCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
  },
  gameIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  gameDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  playButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  comingSoonCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    opacity: 0.6,
  },
  comingSoonTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  comingSoonText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    padding: SPACING.lg,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  resultText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  cardsDisplay: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
  cardBox: {
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 80,
  },
  cardLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 32,
    fontWeight: '700',
    color: COLORS.text,
  },
  closeButton: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  closeButtonText: {
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});