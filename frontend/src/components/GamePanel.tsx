import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

interface GamePlayer {
  userId: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  result?: number;
  placement?: number;
  coinsWon?: number;
  pointsEarned?: number;
}

interface Game {
  id: string;
  roomId: string;
  gameType: string;
  gameTypeName: string;
  image?: string;
  icon?: string;
  tagline?: string;
  hostId: string;
  hostName: string;
  players: GamePlayer[];
  status: 'waiting' | 'completed' | 'aborted';
  minPlayers: number;
  maxPlayers: number;
  entryFee: number;
  pot: number;
  winnerId?: string;
  winnerName?: string;
  runnerUpId?: string;
  runnerUpName?: string;
  winnerShare?: number;
  runnerShare?: number;
  secondsRemaining: number;
  createdAt: string;
  completedAt?: string;
}

interface GameType {
  id: string;
  name: string;
  minPlayers: number;
  maxPlayers: number;
  entryFee: number;
  image?: string;
  icon?: string;
  tagline?: string;
}

interface Props {
  roomId: string;
  currentUserId: string;
  userCoins: number;
  onGameUpdate: () => void;
  compact?: boolean;
}

export interface GamePanelHandle {
  openHost: () => void;
}

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const GamePanel = forwardRef<GamePanelHandle, Props>(function GamePanel(
  { roomId, currentUserId, userCoins, onGameUpdate, compact = false },
  ref,
) {
  const [games, setGames] = useState<Game[]>([]);
  const [gameTypes, setGameTypes] = useState<GameType[]>([]);
  const [hostModalOpen, setHostModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [, setTick] = useState(0);
  const [resultsShown, setResultsShown] = useState<Set<string>>(new Set());
  const [resultModalGame, setResultModalGame] = useState<Game | null>(null);
  const [playArenaGame, setPlayArenaGame] = useState<Game | null>(null);

  useImperativeHandle(ref, () => ({
    openHost: () => setHostModalOpen(true),
  }));

  useEffect(() => {
    loadGames();
    loadGameTypes();
    const interval = setInterval(() => {
      loadGames();
      setTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const loadGames = async () => {
    try {
      const res = await api.get(`/rooms/${roomId}/games`);
      const newGames: Game[] = Array.isArray(res.data) ? res.data : [];

      newGames.forEach((g) => {
        const isPlayer = g.players.some((p) => p.userId === currentUserId);
        // Show arena when current user is in a waiting game
        if (g.status === 'waiting' && isPlayer) {
          setPlayArenaGame((prev) => (prev?.id === g.id ? g : prev || g));
        }
        if ((g.status === 'completed' || g.status === 'aborted') && !resultsShown.has(g.id)) {
          if (isPlayer && !resultModalGame) {
            setResultModalGame(g);
            setPlayArenaGame((prev) => (prev?.id === g.id ? null : prev));
            setResultsShown((prev) => new Set(prev).add(g.id));
            onGameUpdate();
          } else {
            setResultsShown((prev) => new Set(prev).add(g.id));
          }
        }
      });

      setGames(newGames);
    } catch (error) {
      console.error('Failed to load games:', error);
      setGames([]);
    }
  };

  const loadGameTypes = async () => {
    try {
      const res = await api.get('/games/types/list');
      setGameTypes(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error('Failed to load game types:', error);
      setGameTypes([]);
    }
  };

  const handleHost = async (gameTypeId: string) => {
    setLoading(true);
    try {
      const res = await api.post(`/rooms/${roomId}/games`, { gameType: gameTypeId });
      setHostModalOpen(false);
      // Open arena immediately for the host
      if (res.data) {
        setPlayArenaGame(res.data);
      }
      await loadGames();
      onGameUpdate();
    } catch (error: any) {
      showAlert('Cannot Host', error.response?.data?.detail || 'Failed to host game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (gameId: string) => {
    setLoading(true);
    try {
      const res = await api.post(`/games/${gameId}/join`);
      if (res.data) {
        setPlayArenaGame(res.data);
      }
      await loadGames();
      onGameUpdate();
    } catch (error: any) {
      showAlert('Cannot Join', error.response?.data?.detail || 'Failed to join');
    } finally {
      setLoading(false);
    }
  };

  const activeGames = games.filter((g) => g.status === 'waiting');
  const hasActiveGame = activeGames.length > 0;

  return (
    <>
      {(!compact || hasActiveGame) && (
        <View style={styles.container}>
          {activeGames.map((game) => {
            const isJoined = game.players.some((p) => p.userId === currentUserId);
            const isFull = game.players.length >= game.maxPlayers;

            return (
              <View key={game.id} style={styles.gameBanner} testID={`game-${game.id}`}>
                <View style={styles.gameInfo}>
                  <View style={styles.gameHeader}>
                    <Ionicons name="game-controller" size={18} color={COLORS.accent} />
                    <Text style={styles.gameName}>{game.gameTypeName}</Text>
                    <View style={styles.timerBadge}>
                      <Ionicons name="time" size={12} color={COLORS.text} />
                      <Text style={styles.timerText}>{game.secondsRemaining}s</Text>
                    </View>
                  </View>
                  <Text style={styles.gameDetails}>
                    Hosted by {game.hostName} · {game.players.length}/{game.maxPlayers} players · Pot: {game.pot}🪙
                  </Text>
                </View>

                {!isJoined && !isFull && (
                  <TouchableOpacity
                    style={styles.joinButton}
                    onPress={() => handleJoin(game.id)}
                    disabled={loading || userCoins < game.entryFee}
                    testID={`join-game-${game.id}`}
                  >
                    <Text style={styles.joinButtonText}>Join</Text>
                    <Text style={styles.entryFeeText}>{game.entryFee}🪙</Text>
                  </TouchableOpacity>
                )}
                {isJoined && (
                  <TouchableOpacity style={styles.joinedBadge} onPress={() => setPlayArenaGame(game)} testID={`view-arena-${game.id}`}>
                    <Ionicons name="play-circle" size={28} color={COLORS.success} />
                    <Text style={styles.joinedText}>Open</Text>
                  </TouchableOpacity>
                )}
                {!isJoined && isFull && (
                  <View style={styles.fullBadge}>
                    <Text style={styles.fullText}>FULL</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Game Type Selection Modal — light theme with images */}
      <Modal
        visible={hostModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setHostModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setHostModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.lightModalContent}>
            <View style={styles.lightModalHeader}>
              <Text style={styles.lightModalTitle}>Pick a Game</Text>
              <TouchableOpacity onPress={() => setHostModalOpen(false)} testID="close-host-modal">
                <Ionicons name="close" size={24} color="#1f2937" />
              </TouchableOpacity>
            </View>

            <Text style={styles.lightModalSubtitle}>
              Spend 10🪙 to host · Winner & runner-up split the pot
            </Text>

            <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
              {gameTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={styles.gameTypeCardLight}
                  onPress={() => handleHost(type.id)}
                  disabled={loading || userCoins < type.entryFee}
                  testID={`host-${type.id}`}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: type.image }}
                    style={styles.gameTypeImage}
                    contentFit="cover"
                    transition={150}
                  />
                  <View style={styles.gameTypeOverlay}>
                    <View style={styles.gameTypeBadge}>
                      <Ionicons name={(type.icon || 'game-controller') as any} size={16} color="#fff" />
                      <Text style={styles.gameTypeBadgeText}>{type.entryFee}🪙</Text>
                    </View>
                  </View>
                  <View style={styles.gameTypeBody}>
                    <Text style={styles.gameTypeName}>{type.name}</Text>
                    <Text style={styles.gameTypeDesc}>
                      {type.minPlayers}-{type.maxPlayers} players · {type.entryFee} coins entry
                    </Text>
                    {!!type.tagline && (
                      <Text style={styles.gameTypeRule}>{type.tagline}</Text>
                    )}
                    <View style={styles.hostCtaBtn}>
                      <Text style={styles.hostCtaText}>Host now</Text>
                      <Ionicons name="arrow-forward" size={14} color="#fff" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading && (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={{ marginTop: SPACING.md }}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Game Play Arena — light theme */}
      <Modal
        visible={!!playArenaGame}
        transparent
        animationType="slide"
        onRequestClose={() => setPlayArenaGame(null)}
      >
        {playArenaGame && (
          <PlayArena
            game={playArenaGame}
            currentUserId={currentUserId}
            onClose={() => setPlayArenaGame(null)}
          />
        )}
      </Modal>

      {/* Game Result Modal — light theme */}
      <Modal
        visible={!!resultModalGame}
        transparent
        animationType="fade"
        onRequestClose={() => setResultModalGame(null)}
      >
        <View style={styles.modalOverlay}>
          {resultModalGame && (
            <View style={styles.resultModalLight}>
              {resultModalGame.status === 'aborted' ? (
                <>
                  <View style={styles.resultIconCircle}>
                    <Ionicons name="alert-circle" size={48} color="#f59e0b" />
                  </View>
                  <Text style={styles.resultTitleLight}>Game Aborted</Text>
                  <Text style={styles.resultBodyLight}>
                    Not enough players joined. Your entry fee has been refunded.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.resultIconCircle}>
                    <Ionicons
                      name={resultModalGame.winnerId === currentUserId ? 'trophy' : 'medal'}
                      size={48}
                      color={resultModalGame.winnerId === currentUserId ? '#f59e0b' : '#6366f1'}
                    />
                  </View>
                  <Text style={styles.resultTitleLight}>
                    {resultModalGame.winnerId === currentUserId
                      ? '🎉 You Won!'
                      : resultModalGame.runnerUpId === currentUserId
                      ? '🥈 Runner-up!'
                      : `${resultModalGame.winnerName} Won`}
                  </Text>
                  <Text style={styles.resultBodyLight}>{resultModalGame.gameTypeName}</Text>

                  <View style={styles.payoutRow}>
                    <View style={styles.payoutBox}>
                      <Ionicons name="trophy" size={20} color="#f59e0b" />
                      <Text style={styles.payoutLabel}>Winner</Text>
                      <Text style={styles.payoutValue}>+{resultModalGame.winnerShare ?? resultModalGame.pot} 🪙</Text>
                      <Text style={styles.payoutSub}>+10 pts</Text>
                    </View>
                    <View style={styles.payoutBox}>
                      <Ionicons name="medal" size={20} color="#6366f1" />
                      <Text style={styles.payoutLabel}>Runner-up</Text>
                      <Text style={styles.payoutValue}>+{resultModalGame.runnerShare ?? 0} 🪙</Text>
                      <Text style={styles.payoutSub}>+5 pts</Text>
                    </View>
                  </View>

                  <View style={styles.resultsList}>
                    {[...resultModalGame.players]
                      .sort((a, b) => (a.placement || 999) - (b.placement || 999))
                      .map((p) => {
                        const place = p.placement || 0;
                        const isWinner = p.userId === resultModalGame.winnerId;
                        const isRunner = p.userId === resultModalGame.runnerUpId;
                        return (
                          <View
                            key={p.userId}
                            style={[
                              styles.resultRowLight,
                              isWinner && styles.resultRowWinner,
                              isRunner && styles.resultRowRunner,
                            ]}
                          >
                            <Text style={styles.placementBadge}>
                              {place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : `#${place}`}
                            </Text>
                            <Text style={styles.resultNameLight} numberOfLines={1}>{p.displayName}</Text>
                            <Text style={styles.resultValueLight}>{p.result}</Text>
                            {(p.coinsWon || 0) > 0 ? (
                              <Text style={styles.resultCoinsLight}>+{p.coinsWon}🪙</Text>
                            ) : (
                              <Text style={styles.resultEliminated}>—</Text>
                            )}
                          </View>
                        );
                      })}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={styles.closeButtonLight}
                onPress={() => setResultModalGame(null)}
                testID="close-result-modal"
              >
                <Text style={styles.closeButtonTextLight}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
});

export default GamePanel;

/* ---------------- Play Arena (light themed) ---------------- */

function PlayArena({
  game,
  currentUserId,
  onClose,
}: {
  game: Game;
  currentUserId: string;
  onClose: () => void;
}) {
  const isCardGame = game.gameType === 'card_higher';
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);

  const isPlayer = game.players.some((p) => p.userId === currentUserId);
  const needsMore = Math.max(0, game.minPlayers - game.players.length);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <View style={arenaStyles.root}>
      <View style={arenaStyles.headerBar}>
        <TouchableOpacity onPress={onClose} style={arenaStyles.closeIcon} testID="close-arena">
          <Ionicons name="chevron-down" size={26} color="#374151" />
        </TouchableOpacity>
        <View style={arenaStyles.headerCenter}>
          <Text style={arenaStyles.headerTitle}>{game.gameTypeName}</Text>
          <Text style={arenaStyles.headerSub}>Pot: {game.pot}🪙 · {game.entryFee}🪙 entry</Text>
        </View>
        <View style={arenaStyles.timerPill}>
          <Ionicons name="time" size={14} color="#7c3aed" />
          <Text style={arenaStyles.timerPillText}>{game.secondsRemaining}s</Text>
        </View>
      </View>

      <View style={arenaStyles.heroWrap}>
        {!!game.image && (
          <Image source={{ uri: game.image }} style={arenaStyles.hero} contentFit="cover" />
        )}
        <View style={arenaStyles.heroVeil} />
        <View style={arenaStyles.heroBadge}>
          <Ionicons name={isCardGame ? 'card' : 'dice'} size={20} color="#fff" />
          <Text style={arenaStyles.heroBadgeText}>{game.gameTypeName}</Text>
        </View>
        <Text style={arenaStyles.heroTagline}>{game.tagline}</Text>
      </View>

      <View style={arenaStyles.body}>
        <View style={arenaStyles.statusCard}>
          <Animated.View style={[arenaStyles.statusDot, { transform: [{ scale }] }]} />
          <Text style={arenaStyles.statusText}>
            Waiting for players — auto-resolves in {game.secondsRemaining}s
          </Text>
        </View>

        {needsMore > 0 ? (
          <Text style={arenaStyles.needMore}>Need {needsMore} more player{needsMore > 1 ? 's' : ''} to play</Text>
        ) : (
          <Text style={arenaStyles.readyText}>Ready! Game resolves at zero — sit tight 🎲</Text>
        )}

        <Text style={arenaStyles.playersLabel}>
          Players in this round ({game.players.length}/{game.maxPlayers})
        </Text>
        <ScrollView style={{ maxHeight: 280 }} contentContainerStyle={{ paddingBottom: 16 }}>
          {game.players.map((p, idx) => {
            const isMe = p.userId === currentUserId;
            return (
              <View key={p.userId} style={[arenaStyles.playerRow, isMe && arenaStyles.playerRowMe]}>
                <View style={arenaStyles.playerAvatar}>
                  <Ionicons name="person" size={18} color="#7c3aed" />
                </View>
                <Text style={arenaStyles.playerName} numberOfLines={1}>
                  {p.displayName}{isMe ? ' (you)' : ''}
                </Text>
                {idx === 0 && (
                  <View style={arenaStyles.hostPill}>
                    <Ionicons name="ribbon" size={11} color="#7c3aed" />
                    <Text style={arenaStyles.hostPillText}>HOST</Text>
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        <View style={arenaStyles.rulesCard}>
          <Text style={arenaStyles.rulesTitle}>How it works</Text>
          <Text style={arenaStyles.rulesItem}>• Spend 10🪙 to enter, players join within 20s</Text>
          <Text style={arenaStyles.rulesItem}>• Highest roll/card wins 70% of pot · +10 points</Text>
          <Text style={arenaStyles.rulesItem}>• Runner-up wins 30% of pot · +5 points</Text>
          <Text style={arenaStyles.rulesItem}>• Everyone else is eliminated</Text>
        </View>

        {!isPlayer && (
          <Text style={arenaStyles.spectator}>You are spectating — entry fee already deducted only for players.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  gameBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: SPACING.sm,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.accent + '40',
  },
  gameInfo: { flex: 1 },
  gameHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  gameName: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.text },
  timerBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.accent, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 4, gap: 2,
  },
  timerText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },
  gameDetails: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  joinButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 6,
    alignItems: 'center', minWidth: 60,
  },
  joinButtonText: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  entryFeeText: { color: COLORS.text, fontSize: 10, fontWeight: '600', marginTop: 2 },
  joinedBadge: { alignItems: 'center', gap: 2, paddingHorizontal: 6 },
  joinedText: { color: COLORS.success, fontSize: 11, fontWeight: '700' },
  fullBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: 6,
  },
  fullText: { color: COLORS.text, fontSize: 11, fontWeight: '700' },

  // Light theme modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 11, 25, 0.7)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.lg,
  },
  lightModalContent: {
    backgroundColor: '#fdfcfa',
    borderRadius: 20, padding: SPACING.lg, width: '100%', maxWidth: 420,
  },
  lightModalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  lightModalTitle: { fontSize: 22, fontWeight: '800', color: '#1f2937' },
  lightModalSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: SPACING.md },
  gameTypeCardLight: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f0b19',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  gameTypeImage: { width: '100%', height: 130 },
  gameTypeOverlay: { position: 'absolute', top: 10, right: 10 },
  gameTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(15,11,25,0.85)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  gameTypeBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  gameTypeBody: { padding: SPACING.md, gap: 4 },
  gameTypeName: { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  gameTypeDesc: { fontSize: 12, color: '#6b7280' },
  gameTypeRule: { fontSize: 12, color: '#7c3aed', fontStyle: 'italic', marginTop: 4 },
  hostCtaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#7c3aed', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 999, marginTop: 8,
  },
  hostCtaText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  // Result modal light theme
  resultModalLight: {
    backgroundColor: '#fdfcfa',
    borderRadius: 22, padding: SPACING.lg,
    width: '100%', maxWidth: 440, alignItems: 'center',
  },
  resultIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  resultTitleLight: { fontSize: 22, fontWeight: '800', color: '#1f2937', marginBottom: 4 },
  resultBodyLight: { fontSize: 14, color: '#6b7280', marginBottom: SPACING.md, textAlign: 'center' },
  payoutRow: { flexDirection: 'row', gap: 10, marginBottom: SPACING.md, width: '100%' },
  payoutBox: {
    flex: 1, backgroundColor: '#f9fafb',
    borderRadius: 14, padding: SPACING.sm, alignItems: 'center',
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  payoutLabel: { fontSize: 11, color: '#6b7280', marginTop: 4 },
  payoutValue: { fontSize: 16, fontWeight: '800', color: '#1f2937', marginTop: 2 },
  payoutSub: { fontSize: 10, color: '#7c3aed', fontWeight: '700', marginTop: 2 },
  resultsList: { width: '100%', marginBottom: SPACING.md },
  resultRowLight: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', padding: SPACING.sm,
    borderRadius: 10, marginBottom: 4,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  resultRowWinner: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  resultRowRunner: { backgroundColor: '#eef2ff', borderColor: '#c7d2fe' },
  placementBadge: { fontSize: 18, width: 32, textAlign: 'center' },
  resultNameLight: { flex: 1, fontSize: 14, color: '#1f2937', fontWeight: '600' },
  resultValueLight: {
    fontSize: 16, fontWeight: '800', color: '#1f2937',
    minWidth: 36, textAlign: 'right',
  },
  resultCoinsLight: { fontSize: 12, fontWeight: '700', color: '#10b981', minWidth: 60, textAlign: 'right' },
  resultEliminated: { fontSize: 12, color: '#9ca3af', minWidth: 60, textAlign: 'right' },
  closeButtonLight: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    borderRadius: 999, minWidth: 140, alignItems: 'center',
  },
  closeButtonTextLight: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

const arenaStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fdfcfa' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: '#f1efea',
    gap: 8,
  },
  closeIcon: { padding: 4 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1f2937' },
  headerSub: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  timerPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999,
  },
  timerPillText: { color: '#5b21b6', fontSize: 12, fontWeight: '800' },
  heroWrap: {
    margin: SPACING.md, borderRadius: 18, overflow: 'hidden',
    height: 160, backgroundColor: '#e5e7eb', position: 'relative',
  },
  hero: { width: '100%', height: '100%' },
  heroVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,11,25,0.35)',
  },
  heroBadge: {
    position: 'absolute', top: 12, left: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(15,11,25,0.65)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
  },
  heroBadgeText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  heroTagline: {
    position: 'absolute', left: 16, right: 16, bottom: 12,
    color: '#fff', fontSize: 13, fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 4,
  },
  body: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md, flex: 1 },
  statusCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#ecfdf5', padding: SPACING.sm,
    borderRadius: 10, borderWidth: 1, borderColor: '#a7f3d0',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' },
  statusText: { color: '#065f46', fontSize: 12, fontWeight: '700', flex: 1 },
  needMore: { color: '#b45309', fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  readyText: { color: '#7c3aed', fontSize: 13, fontWeight: '700', marginTop: 6, textAlign: 'center' },
  playersLabel: {
    fontSize: 11, color: '#6b7280', marginTop: SPACING.md, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '800',
  },
  playerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ffffff', borderRadius: 10, padding: 10,
    marginBottom: 6, borderWidth: 1, borderColor: '#f3f4f6',
  },
  playerRowMe: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  playerAvatar: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#ede9fe',
    alignItems: 'center', justifyContent: 'center',
  },
  playerName: { flex: 1, fontSize: 14, color: '#1f2937', fontWeight: '600' },
  hostPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#ede9fe', paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  hostPillText: { color: '#5b21b6', fontSize: 10, fontWeight: '800' },
  rulesCard: {
    marginTop: SPACING.sm,
    backgroundColor: '#fff7ed',
    borderRadius: 12, padding: SPACING.sm,
    borderWidth: 1, borderColor: '#fed7aa',
  },
  rulesTitle: { fontSize: 12, fontWeight: '800', color: '#9a3412', marginBottom: 4 },
  rulesItem: { fontSize: 11, color: '#7c2d12', marginTop: 2 },
  spectator: { marginTop: SPACING.sm, fontSize: 11, color: '#9ca3af', textAlign: 'center' },
});
