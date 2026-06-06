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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

interface GamePlayer {
  userId: string;
  username: string;
  displayName: string;
  photoUrl?: string;
  result?: number;
}

interface Game {
  id: string;
  roomId: string;
  gameType: string;
  gameTypeName: string;
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
  const [tick, setTick] = useState(0);
  const [resultsShown, setResultsShown] = useState<Set<string>>(new Set());
  const [resultModalGame, setResultModalGame] = useState<Game | null>(null);

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
  }, [roomId]);

  const loadGames = async () => {
    try {
      const res = await api.get(`/rooms/${roomId}/games`);
      const newGames: Game[] = Array.isArray(res.data) ? res.data : [];
      
      // Detect newly completed/aborted games for showing results
      newGames.forEach((g) => {
        if ((g.status === 'completed' || g.status === 'aborted') && !resultsShown.has(g.id)) {
          // Is current user a player? Show result modal
          const isPlayer = g.players.some((p) => p.userId === currentUserId);
          if (isPlayer && !resultModalGame) {
            setResultModalGame(g);
            setResultsShown((prev) => new Set(prev).add(g.id));
            onGameUpdate(); // Refresh user coins
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
      await api.post(`/rooms/${roomId}/games`, { gameType: gameTypeId });
      setHostModalOpen(false);
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
      await api.post(`/games/${gameId}/join`);
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
                  Hosted by {game.hostName} · {game.players.length}/{game.maxPlayers} players · Pot: {game.pot} coins
                </Text>
                <View style={styles.playerAvatars}>
                  {game.players.slice(0, 6).map((p, idx) => (
                    <View key={p.userId} style={[styles.playerDot, { marginLeft: idx === 0 ? 0 : -8 }]}>
                      <Ionicons name="person" size={10} color={COLORS.text} />
                    </View>
                  ))}
                  {game.players.length < game.minPlayers && (
                    <Text style={styles.minPlayersText}>
                      Need {game.minPlayers - game.players.length} more
                    </Text>
                  )}
                </View>
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
                <View style={styles.joinedBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
                  <Text style={styles.joinedText}>Joined</Text>
                </View>
              )}
              {!isJoined && isFull && (
                <View style={styles.fullBadge}>
                  <Text style={styles.fullText}>FULL</Text>
                </View>
              )}
            </View>
          );
        })}

        {!hasActiveGame && !compact && (
          <TouchableOpacity
            style={styles.hostButton}
            onPress={() => setHostModalOpen(true)}
            disabled={loading}
            testID="host-game-button"
          >
            <Ionicons name="game-controller" size={18} color={COLORS.text} />
            <Text style={styles.hostButtonText}>Host a Game</Text>
          </TouchableOpacity>
        )}
        </View>
      )}

      {/* Game Type Selection Modal */}
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
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose a Game</Text>
              <TouchableOpacity onPress={() => setHostModalOpen(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              Players have 20 seconds to join after you host
            </Text>

            {gameTypes.map((type) => (
              <TouchableOpacity
                key={type.id}
                style={styles.gameTypeCard}
                onPress={() => handleHost(type.id)}
                disabled={loading || userCoins < type.entryFee}
                testID={`host-${type.id}`}
              >
                <View style={styles.gameTypeIcon}>
                  <Ionicons
                    name={type.id === 'card_higher' ? 'card' : 'dice'}
                    size={28}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.gameTypeInfo}>
                  <Text style={styles.gameTypeName}>{type.name}</Text>
                  <Text style={styles.gameTypeDesc}>
                    {type.minPlayers}-{type.maxPlayers} players · {type.entryFee} coins entry
                  </Text>
                  <Text style={styles.gameTypeRule}>
                    {type.id === 'card_higher'
                      ? 'Highest card (1-13) wins pot'
                      : 'Highest dice roll (2-12) wins pot'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
            ))}

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

      {/* Game Result Modal */}
      <Modal
        visible={!!resultModalGame}
        transparent
        animationType="fade"
        onRequestClose={() => setResultModalGame(null)}
      >
        <View style={styles.modalOverlay}>
          {resultModalGame && (
            <View style={styles.resultModalContent}>
              {resultModalGame.status === 'aborted' ? (
                <>
                  <Ionicons name="alert-circle" size={64} color={COLORS.warning} />
                  <Text style={styles.resultTitle}>Game Aborted</Text>
                  <Text style={styles.resultBody}>
                    Not enough players joined. Your entry fee has been refunded.
                  </Text>
                </>
              ) : (
                <>
                  <Ionicons
                    name={resultModalGame.winnerId === currentUserId ? 'trophy' : 'sad'}
                    size={64}
                    color={resultModalGame.winnerId === currentUserId ? COLORS.coin : COLORS.textSecondary}
                  />
                  <Text style={styles.resultTitle}>
                    {resultModalGame.winnerId === currentUserId
                      ? '🎉 You Won!'
                      : `${resultModalGame.winnerName} Won`}
                  </Text>
                  <Text style={styles.resultBody}>
                    {resultModalGame.gameTypeName}
                  </Text>
                  <Text style={styles.resultPot}>+{resultModalGame.pot} coins</Text>

                  <View style={styles.resultsList}>
                    {resultModalGame.players
                      .sort((a, b) => (b.result || 0) - (a.result || 0))
                      .map((p) => (
                        <View
                          key={p.userId}
                          style={[
                            styles.resultRow,
                            p.userId === resultModalGame.winnerId && styles.resultRowWinner,
                          ]}
                        >
                          <View style={styles.resultAvatar}>
                            <Ionicons name="person" size={14} color={COLORS.primary} />
                          </View>
                          <Text style={styles.resultName}>{p.displayName}</Text>
                          <Text style={styles.resultValue}>{p.result}</Text>
                          {p.userId === resultModalGame.winnerId && (
                            <Ionicons name="trophy" size={16} color={COLORS.coin} />
                          )}
                        </View>
                      ))}
                  </View>
                </>
              )}

              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setResultModalGame(null)}
                testID="close-result-modal"
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
});

export default GamePanel;

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
  gameInfo: {
    flex: 1,
  },
  gameHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  gameName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  timerText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  gameDetails: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  playerAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.background,
  },
  minPlayersText: {
    fontSize: 10,
    color: COLORS.warning,
    marginLeft: 6,
    fontWeight: '600',
  },
  joinButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 6,
    alignItems: 'center',
    minWidth: 60,
  },
  joinButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  entryFeeText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  joinedBadge: {
    alignItems: 'center',
    gap: 2,
  },
  joinedText: {
    color: COLORS.success,
    fontSize: 11,
    fontWeight: '600',
  },
  fullBadge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 6,
  },
  fullText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  hostButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '30',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 6,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
  },
  hostButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  gameTypeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  gameTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameTypeInfo: {
    flex: 1,
  },
  gameTypeName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  gameTypeDesc: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  gameTypeRule: {
    fontSize: 11,
    color: COLORS.primary,
    fontStyle: 'italic',
  },
  resultModalContent: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: SPACING.lg,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  resultBody: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  resultPot: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.coin,
    marginBottom: SPACING.md,
  },
  resultsList: {
    width: '100%',
    marginBottom: SPACING.md,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.sm,
    borderRadius: 8,
    marginBottom: 4,
    gap: SPACING.sm,
  },
  resultRowWinner: {
    backgroundColor: COLORS.primary + '30',
    borderWidth: 1,
    borderColor: COLORS.coin,
  },
  resultAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultName: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  resultValue: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    minWidth: 30,
    textAlign: 'right',
  },
  closeButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  closeButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
