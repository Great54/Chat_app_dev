import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator, Alert, Platform, TextInput, Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import api from '@/src/api/client';
import { COLORS, SPACING } from '@/src/constants/theme';

interface Tournament {
  id: string;
  roomId: string;
  gameType: string;
  gameTypeName: string;
  image?: string;
  icon?: string;
  name: string;
  status: 'lobby' | 'running' | 'completed';
  size: number;
  entryFee: number;
  pot: number;
  winnerShare?: number;
  runnerShare?: number;
  prizeShares?: number[];
  players: { userId: string; displayName: string; photoUrl?: string }[];
  bracket: any[];
  winners: { userId: string; displayName: string; placement: number; coinsWon?: number }[];
  createdBy: string;
  createdByName: string;
  createdAt?: string;
  completedAt?: string;
  isPrivate?: boolean;
  joinCode?: string | null;
}

interface GameType {
  id: string;
  name: string;
  image?: string;
  icon?: string;
  tagline?: string;
}

const TOURNAMENT_SIZE_PRESETS = [2, 4, 8, 16, 32];
const TOURNAMENT_FEE_PRESETS = [10, 25, 50, 100, 250, 500];

// Mirror of backend: how many players are paid out based on tournament size.
function winnersCount(n: number): number {
  if (n <= 4) return 1;
  if (n <= 10) return 2;
  return Math.max(3, Math.ceil(0.3 * n));
}

// Mirror of backend: prize split shares (in coins) given pot & number of players.
function prizeShares(pot: number, n: number): number[] {
  const k = winnersCount(n);
  if (pot <= 0 || k <= 0) return new Array(Math.max(k, 1)).fill(0);
  if (k === 1) return [pot];
  if (k === 2) {
    const runner = Math.floor((pot * 30) / 100);
    return [pot - runner, runner];
  }
  const weights: number[] = [];
  for (let i = k; i >= 1; i--) weights.push(i);
  const totalW = weights.reduce((a, b) => a + b, 0);
  const shares = weights.map((w) => Math.floor((pot * w) / totalW));
  shares[0] += pot - shares.reduce((a, b) => a + b, 0);
  return shares;
}

interface Props {
  visible: boolean;
  roomId: string;
  currentUserId: string;
  userCoins: number;
  onClose: () => void;
  onUserUpdate: () => void;
}

const showAlert = (title: string, msg: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(`${title}\n\n${msg}`);
  else Alert.alert(title, msg);
};

export default function TournamentModal({
  visible, roomId, currentUserId, userCoins, onClose, onUserUpdate,
}: Props) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [gameTypes, setGameTypes] = useState<GameType[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [openTournament, setOpenTournament] = useState<Tournament | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [pickedGame, setPickedGame] = useState<GameType | null>(null);
  const [createSize, setCreateSize] = useState('4');
  const [createFee, setCreateFee] = useState('10');
  const [createName, setCreateName] = useState('');
  const [createPrivate, setCreatePrivate] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myWinStats, setMyWinStats] = useState<{ wins: number; coinsWon: number; rank: number | null }>({ wins: 0, coinsWon: 0, rank: null });
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, gRes, lRes] = await Promise.all([
        api.get(`/rooms/${roomId}/tournaments`),
        api.get('/games/types/list'),
        api.get('/tournaments/wins/leaderboard', { params: { limit: 10 } }).catch(() => ({ data: null })),
      ]);
      setTournaments(Array.isArray(tRes.data) ? tRes.data : []);
      setGameTypes(Array.isArray(gRes.data) ? gRes.data : []);
      if (lRes?.data) {
        setLeaderboard(lRes.data.leaderboard || []);
        setMyWinStats({
          wins: lRes.data.me?.wins ?? 0,
          coinsWon: lRes.data.me?.coinsWon ?? 0,
          rank: lRes.data.me?.rank ?? null,
        });
      }
    } catch (e) {
      console.error('Tournament load failed', e);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    if (!visible) return;
    loadAll();
    const i = setInterval(loadAll, 3000);
    return () => clearInterval(i);
  }, [visible, loadAll]);

  // Auto-open detail if user is in a tournament that just completed
  useEffect(() => {
    if (openTournament) {
      const fresh = tournaments.find((t) => t.id === openTournament.id);
      if (fresh) setOpenTournament(fresh);
    }
  }, [tournaments, openTournament]);

  const handleCreate = async () => {
    if (!pickedGame) return;
    const sizeN = parseInt(createSize, 10) || 0;
    const feeN = parseInt(createFee, 10) || 0;
    if (sizeN < 2 || sizeN > 32) {
      showAlert('Invalid size', 'Tournament size must be between 2 and 32 players');
      return;
    }
    if (feeN < 1) {
      showAlert('Invalid entry fee', 'Entry fee must be at least 1 coin');
      return;
    }
    if (userCoins < feeN) {
      showAlert('Not enough coins', `You need ${feeN} coins to host & enter`);
      return;
    }
    setCreating(true);
    try {
      const res = await api.post(`/rooms/${roomId}/tournaments`, {
        gameType: pickedGame.id,
        size: sizeN,
        entryFee: feeN,
        name: createName.trim() || undefined,
        isPrivate: createPrivate,
      });
      setShowCreate(false);
      setPickedGame(null);
      setCreateName('');
      setCreatePrivate(false);
      await loadAll();
      onUserUpdate();
      setOpenTournament(res.data);
    } catch (e: any) {
      showAlert('Cannot create', e.response?.data?.detail || 'Failed to create tournament');
    } finally {
      setCreating(false);
    }
  };

  const handleJoinByCode = async () => {
    const code = joinCodeInput.trim().toUpperCase();
    if (code.length < 4) {
      showAlert('Invalid code', 'Enter the 6-character tournament code shared by the creator');
      return;
    }
    setJoiningCode(true);
    try {
      const res = await api.post('/tournaments/join-by-code', { code });
      setShowJoinCode(false);
      setJoinCodeInput('');
      await loadAll();
      onUserUpdate();
      setOpenTournament(res.data);
    } catch (e: any) {
      showAlert('Cannot join', e.response?.data?.detail || 'Invalid or expired code');
    } finally {
      setJoiningCode(false);
    }
  };

  const handleJoin = async (t: Tournament) => {
    try {
      const res = await api.post(`/tournaments/${t.id}/join`);
      await loadAll();
      onUserUpdate();
      setOpenTournament(res.data);
    } catch (e: any) {
      showAlert('Cannot join', e.response?.data?.detail || 'Failed to join');
    }
  };

  const handleStart = async (t: Tournament) => {
    try {
      const res = await api.post(`/tournaments/${t.id}/start`);
      await loadAll();
      onUserUpdate();
      setOpenTournament(res.data);
    } catch (e: any) {
      showAlert('Cannot start', e.response?.data?.detail || 'Failed to start');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerIcon} testID="close-tournaments">
            <Ionicons name="chevron-down" size={26} color="#374151" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Tournaments</Text>
            <Text style={styles.headerSub}>Knockout · Top {`>10p:30%`} of players win</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowLeaderboard(true)}
            style={styles.hallBtn}
            testID="open-hall-of-champions"
          >
            <Ionicons name="trophy" size={16} color="#a16207" />
            <Text style={styles.hallBtnText}>Hall</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowJoinCode(true)}
            style={styles.codeBtn}
            testID="open-join-code-btn"
          >
            <Ionicons name="key" size={16} color="#7c3aed" />
            <Text style={styles.codeBtnText}>Code</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={styles.createBtn}
            disabled={userCoins < 10}
            testID="create-tournament-btn"
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.createBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {/* Rewards banner */}
        <View style={styles.rewardsBanner}>
          <View style={styles.rewardItem}><Text style={styles.rewardEmoji}>🏆</Text><Text style={styles.rewardText}>≤4p · 1 winner takes all</Text></View>
          <View style={styles.rewardItem}><Text style={styles.rewardEmoji}>🥈</Text><Text style={styles.rewardText}>5-10p · 70 / 30 split</Text></View>
          <View style={styles.rewardItem}><Text style={styles.rewardEmoji}>🎖</Text><Text style={styles.rewardText}>{`>10p · 30% win (k:k-1:…)`}</Text></View>
        </View>

        {loading && tournaments.length === 0 ? (
          <View style={styles.empty}><ActivityIndicator color="#7c3aed" /></View>
        ) : tournaments.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="trophy-outline" size={56} color="#9ca3af" />
            <Text style={styles.emptyText}>No tournaments yet — be the first to schedule one!</Text>
            <TouchableOpacity style={styles.bigCreateBtn} onPress={() => setShowCreate(true)} testID="empty-create-tournament-btn">
              <Ionicons name="trophy" size={18} color="#fff" />
              <Text style={styles.bigCreateText}>Create tournament</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {tournaments.map((t) => {
              const joined = t.players.some((p) => p.userId === currentUserId);
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.card}
                  onPress={() => setOpenTournament(t)}
                  activeOpacity={0.85}
                  testID={`tournament-card-${t.id}`}
                >
                  <Image source={{ uri: t.image }} style={styles.cardImage} contentFit="cover" />
                  <View style={styles.cardImageVeil} />
                  <View style={styles.cardImageBadges}>
                    <View style={[styles.statusPill, t.status === 'lobby' ? styles.statusLobby : t.status === 'running' ? styles.statusRunning : styles.statusDone]}>
                      <Text style={styles.statusText}>{t.status.toUpperCase()}</Text>
                    </View>
                    <View style={styles.entryPill}>
                      <Ionicons name="cash" size={11} color="#fff" />
                      <Text style={styles.entryPillText}>{t.entryFee}🪙</Text>
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTitleRow}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{t.name}</Text>
                      {t.isPrivate ? (
                        <View style={styles.privatePill}>
                          <Ionicons name="lock-closed" size={10} color="#fff" />
                          <Text style={styles.privatePillText}>PRIVATE</Text>
                        </View>
                      ) : (
                        <View style={styles.publicPill}>
                          <Ionicons name="globe" size={10} color="#fff" />
                          <Text style={styles.privatePillText}>PUBLIC</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.cardSub}>by {t.createdByName} · {t.players.length}/{t.size} players · Pot {t.pot}🪙</Text>
                    {/* Show join code to creator/joined */}
                    {t.joinCode && (currentUserId === t.createdBy || t.players.some((p) => p.userId === currentUserId)) ? (
                      <View style={styles.codeBadge} testID={`tournament-code-${t.id}`}>
                        <Ionicons name="key" size={12} color="#7c3aed" />
                        <Text style={styles.codeBadgeText}>Invite code: {t.joinCode}</Text>
                      </View>
                    ) : null}
                    <View style={styles.cardActions}>
                      {t.status === 'lobby' && !joined && (
                        <TouchableOpacity
                          style={[styles.joinBtn, userCoins < t.entryFee && { opacity: 0.5 }]}
                          onPress={() => handleJoin(t)}
                          disabled={userCoins < t.entryFee}
                          testID={`tournament-join-${t.id}`}
                        >
                          <Text style={styles.joinBtnText}>Join {t.entryFee}🪙</Text>
                        </TouchableOpacity>
                      )}
                      {t.status === 'lobby' && joined && currentUserId === t.createdBy && t.players.length >= 2 && (
                        <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(t)} testID={`tournament-start-${t.id}`}>
                          <Ionicons name="play" size={14} color="#fff" />
                          <Text style={styles.startBtnText}>Start now</Text>
                        </TouchableOpacity>
                      )}
                      {t.status === 'completed' && (
                        <View style={styles.completedPill}>
                          <Text style={styles.completedText}>🏆 {t.winners[0]?.displayName}</Text>
                        </View>
                      )}
                      <Text style={styles.tapHint}>Tap to view →</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Create modal */}
        <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => { setShowCreate(false); setPickedGame(null); }}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowCreate(false); setPickedGame(null); }}>
            <TouchableOpacity activeOpacity={1} style={styles.createCard}>
              {!pickedGame ? (
                <>
                  <View style={styles.createHeader}>
                    <Text style={styles.createTitle}>Pick a game</Text>
                    <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={22} color="#1f2937" /></TouchableOpacity>
                  </View>
                  <Text style={styles.createSub}>Step 1 of 2 — choose your tournament game</Text>
                  {gameTypes.map((g) => (
                    <TouchableOpacity
                      key={g.id}
                      style={styles.gameRow}
                      onPress={() => setPickedGame(g)}
                      testID={`create-tournament-${g.id}`}
                    >
                      <Image source={{ uri: g.image }} style={styles.gameRowImg} contentFit="cover" />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.gameRowName}>{g.name}</Text>
                        <Text style={styles.gameRowDesc}>{g.tagline}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#7c3aed" />
                    </TouchableOpacity>
                  ))}
                </>
              ) : (
                <>
                  <View style={styles.createHeader}>
                    <TouchableOpacity onPress={() => setPickedGame(null)} testID="back-to-game-pick">
                      <Ionicons name="chevron-back" size={22} color="#1f2937" />
                    </TouchableOpacity>
                    <Text style={styles.createTitle}>Set up</Text>
                    <TouchableOpacity onPress={() => { setShowCreate(false); setPickedGame(null); }}><Ionicons name="close" size={22} color="#1f2937" /></TouchableOpacity>
                  </View>
                  <View style={styles.pickedHero}>
                    <Image source={{ uri: pickedGame.image }} style={styles.pickedHeroImg} contentFit="cover" />
                    <View style={styles.pickedHeroOverlay} />
                    <Text style={styles.pickedHeroText}>{pickedGame.name}</Text>
                  </View>

                  <Text style={styles.fieldLabel}>Tournament name (optional)</Text>
                  <TextInput
                    value={createName}
                    onChangeText={setCreateName}
                    placeholder={`${pickedGame.name} Knockout`}
                    placeholderTextColor="#9ca3af"
                    style={styles.input}
                    maxLength={50}
                    testID="tournament-name-input"
                  />

                  <Text style={styles.fieldLabel}>Number of players (2–32)</Text>
                  <TextInput
                    value={createSize}
                    onChangeText={(t) => setCreateSize(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    style={[styles.input, styles.numInput]}
                    placeholder="4"
                    placeholderTextColor="#9ca3af"
                    testID="tournament-size-input"
                  />
                  <View style={styles.presetsRow}>
                    {TOURNAMENT_SIZE_PRESETS.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[styles.preset, parseInt(createSize, 10) === s && styles.presetActive]}
                        onPress={() => setCreateSize(String(s))}
                        testID={`preset-size-${s}`}
                      >
                        <Text style={[styles.presetText, parseInt(createSize, 10) === s && styles.presetTextActive]}>{s}p</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.fieldLabel}>Entry fee per player (coins)</Text>
                  <TextInput
                    value={createFee}
                    onChangeText={(t) => setCreateFee(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    style={[styles.input, styles.numInput]}
                    placeholder="10"
                    placeholderTextColor="#9ca3af"
                    testID="tournament-fee-input"
                  />
                  <View style={styles.presetsRow}>
                    {TOURNAMENT_FEE_PRESETS.map((f) => (
                      <TouchableOpacity
                        key={f}
                        style={[styles.preset, parseInt(createFee, 10) === f && styles.presetActive]}
                        onPress={() => setCreateFee(String(f))}
                        testID={`preset-fee-${f}`}
                      >
                        <Text style={[styles.presetText, parseInt(createFee, 10) === f && styles.presetTextActive]}>{f}🪙</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {(() => {
                    const sz = parseInt(createSize, 10) || 0;
                    const fee = parseInt(createFee, 10) || 0;
                    const pot = sz * fee;
                    const shares = prizeShares(pot, sz);
                    const medals = ['🏆', '🥈', '🥉'];
                    return (
                      <View style={styles.previewBox}>
                        <Text style={styles.previewTitle}>Reward preview · {shares.length} winner{shares.length > 1 ? 's' : ''}</Text>
                        <Text style={styles.previewLine}>Max pot · <Text style={styles.previewStrong}>{pot}🪙</Text> ({sz} × {fee})</Text>
                        {shares.map((s, i) => {
                          const medal = i < 3 ? medals[i] : `#${i + 1}`;
                          const extras = i === 0 ? ' + VIP Pro 30 days + 30 pts'
                                       : i === 1 ? ' + 20 pts'
                                       : i === 2 ? ' + 10 pts'
                                       : ` + ${Math.max(5, 35 - (i + 1) * 5)} pts`;
                          return (
                            <Text key={i} style={styles.previewLine}>
                              {medal} #{i + 1} · <Text style={styles.previewStrong}>{s}🪙{extras}</Text>
                            </Text>
                          );
                        })}
                        <Text style={styles.previewSub}>
                          {sz <= 4 && 'Winner takes the entire pot.'}
                          {sz > 4 && sz <= 10 && 'Top 2 share the pot · 70 / 30.'}
                          {sz > 10 && `Top ${shares.length} win, ratios ${shares.length}:${shares.length - 1}:…:1.`}
                        </Text>
                      </View>
                    );
                  })()}

                  {/* Public / Private toggle */}
                  <View style={styles.visibilityRow}>
                    <TouchableOpacity
                      onPress={() => setCreatePrivate(false)}
                      style={[styles.visibilityChip, !createPrivate && styles.visibilityChipActive]}
                      testID="visibility-public"
                    >
                      <Ionicons name="globe" size={14} color={!createPrivate ? '#fff' : '#7c3aed'} />
                      <Text style={[styles.visibilityText, !createPrivate && styles.visibilityTextActive]}>Public — anyone can join</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setCreatePrivate(true)}
                      style={[styles.visibilityChip, createPrivate && styles.visibilityChipActive]}
                      testID="visibility-private"
                    >
                      <Ionicons name="lock-closed" size={14} color={createPrivate ? '#fff' : '#7c3aed'} />
                      <Text style={[styles.visibilityText, createPrivate && styles.visibilityTextActive]}>Private — invite code only</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.createSubmit, (creating || userCoins < (parseInt(createFee, 10) || 0)) && { opacity: 0.5 }]}
                    onPress={handleCreate}
                    disabled={creating || userCoins < (parseInt(createFee, 10) || 0)}
                    testID="confirm-create-tournament"
                  >
                    {creating ? <ActivityIndicator color="#fff" /> : (
                      <>
                        <Ionicons name="trophy" size={18} color="#fff" />
                        <Text style={styles.createSubmitText}>Create & enter ({createFee}🪙)</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Detail modal */}
        <Modal visible={!!openTournament} transparent animationType="slide" onRequestClose={() => setOpenTournament(null)}>
          {openTournament && (
            <TournamentDetail
              tournament={openTournament}
              currentUserId={currentUserId}
              userCoins={userCoins}
              onClose={() => setOpenTournament(null)}
              onJoin={() => handleJoin(openTournament)}
              onStart={() => handleStart(openTournament)}
            />
          )}
        </Modal>

        {/* Join by code modal */}
        <Modal visible={showJoinCode} transparent animationType="fade" onRequestClose={() => setShowJoinCode(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowJoinCode(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.createCard, { maxWidth: 360 }]}>
              <View style={styles.createHeader}>
                <Text style={styles.createTitle}>Join with code</Text>
                <TouchableOpacity onPress={() => setShowJoinCode(false)} testID="close-join-code"><Ionicons name="close" size={22} color="#1f2937" /></TouchableOpacity>
              </View>
              <Text style={styles.createSub}>Enter the 6-character invite code shared by the tournament host.</Text>
              <TextInput
                value={joinCodeInput}
                onChangeText={(t) => setJoinCodeInput(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC123"
                placeholderTextColor="#9ca3af"
                style={[styles.input, { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: 6 }]}
                autoCapitalize="characters"
                maxLength={6}
                testID="join-code-input"
              />
              <TouchableOpacity
                style={[styles.createSubmit, (joiningCode || joinCodeInput.length < 4) && { opacity: 0.5 }]}
                onPress={handleJoinByCode}
                disabled={joiningCode || joinCodeInput.length < 4}
                testID="confirm-join-code"
              >
                {joiningCode ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Ionicons name="enter" size={18} color="#fff" />
                    <Text style={styles.createSubmitText}>Join tournament</Text>
                  </>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>

        {/* Hall of Champions — global "Tournaments You've Won" leaderboard */}
        <Modal visible={showLeaderboard} transparent animationType="slide" onRequestClose={() => setShowLeaderboard(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowLeaderboard(false)}>
            <TouchableOpacity activeOpacity={1} style={[styles.createCard, { maxWidth: 420, maxHeight: '85%' }]} testID="hall-of-champions-modal">
              <View style={styles.createHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="trophy" size={22} color="#a16207" />
                  <Text style={styles.createTitle}>Hall of Champions</Text>
                </View>
                <TouchableOpacity onPress={() => setShowLeaderboard(false)} testID="close-hall"><Ionicons name="close" size={22} color="#1f2937" /></TouchableOpacity>
              </View>
              <Text style={styles.createSub}>Most #1 finishes in the last 30 days · across every room</Text>

              {/* My stats card */}
              <View style={styles.myWinCard} testID="my-win-stats">
                <View style={styles.myWinRankBubble}>
                  <Text style={styles.myWinRankNum}>{myWinStats.rank ? `#${myWinStats.rank}` : '—'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myWinTitle}>Your record</Text>
                  <Text style={styles.myWinSub}>
                    {myWinStats.wins} win{myWinStats.wins === 1 ? '' : 's'} · +{myWinStats.coinsWon}🪙 earned
                  </Text>
                </View>
                {myWinStats.wins > 0 ? <Text style={{ fontSize: 26 }}>🏆</Text> : <Text style={{ fontSize: 22, opacity: 0.5 }}>🎯</Text>}
              </View>

              <ScrollView style={{ marginTop: SPACING.md, maxHeight: 360 }}>
                {leaderboard.length === 0 ? (
                  <View style={styles.lbEmpty}>
                    <Ionicons name="hourglass-outline" size={28} color="#9ca3af" />
                    <Text style={styles.lbEmptyText}>No champions yet — be the first to win a knockout!</Text>
                  </View>
                ) : (
                  leaderboard.map((row: any) => {
                    const isMe = row.userId === currentUserId;
                    const isTop3 = row.rank <= 3;
                    return (
                      <View
                        key={row.userId}
                        style={[styles.lbRow, isMe && styles.lbRowMe, isTop3 && styles.lbRowTop3]}
                        testID={`lb-row-${row.rank}`}
                      >
                        <Text style={[styles.lbRank, isTop3 && styles.lbRankTop3]}>
                          {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : `#${row.rank}`}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.lbName} numberOfLines={1}>
                            {row.displayName}{isMe ? ' (you)' : ''}
                          </Text>
                          <Text style={styles.lbSub}>+{row.coinsWon}🪙 earned</Text>
                        </View>
                        <View style={styles.lbWinsPill}>
                          <Ionicons name="trophy" size={11} color="#92400e" />
                          <Text style={styles.lbWinsText}>{row.wins}</Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

function PodiumRow({
  w,
  index,
  isMe,
  total,
}: {
  w: any;
  index: number;
  isMe: boolean;
  total: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(30)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  useEffect(() => {
    // Staggered top-down reveal: champion first, then runner-up, etc.
    const delay = index * 220;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 380, delay, useNativeDriver: true }),
      Animated.spring(translate, { toValue: 0, friction: 7, tension: 60, delay, useNativeDriver: true }),
      Animated.spring(scale,     { toValue: 1, friction: 6, tension: 80, delay, useNativeDriver: true }),
    ]).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const medal = w.placement === 1 ? '🏆' : w.placement === 2 ? '🥈' : w.placement === 3 ? '🥉' : `#${w.placement}`;
  const extras = w.placement === 1 ? ' + VIP Pro 30d + 30pts'
              : w.placement === 2 ? ' + 20pts'
              : w.placement === 3 ? ' + 10pts'
              : ` + ${Math.max(5, 35 - w.placement * 5)}pts`;
  // Highlight color tier
  const tier = w.placement === 1
    ? { bg: '#fef3c7', border: '#facc15' }
    : w.placement === 2
    ? { bg: '#f1f5f9', border: '#94a3b8' }
    : w.placement === 3
    ? { bg: '#fef2e7', border: '#fb923c' }
    : { bg: '#fffbeb', border: '#fde68a' };

  return (
    <Animated.View
      style={[
        detailStyles.podiumRow,
        { backgroundColor: tier.bg, borderColor: tier.border },
        isMe && detailStyles.podiumRowMe,
        { opacity, transform: [{ translateY: translate }, { scale }] },
      ]}
      testID={`podium-row-${w.placement}`}
    >
      <Text style={detailStyles.podiumMedal}>{medal}</Text>
      <View style={{ flex: 1 }}>
        <Text style={detailStyles.podiumName}>{w.displayName}{isMe ? ' (you)' : ''}</Text>
        <Text style={detailStyles.podiumReward}>+{w.coinsWon || 0}🪙{extras}</Text>
      </View>
      {w.placement === 1 && index === 0 && total > 1 ? (
        <View style={detailStyles.champBadge}>
          <Ionicons name="trophy" size={11} color="#fff" />
          <Text style={detailStyles.champBadgeText}>CHAMP</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function TournamentDetail({
  tournament,
  currentUserId,
  userCoins,
  onClose,
  onJoin,
  onStart,
}: {
  tournament: Tournament;
  currentUserId: string;
  userCoins: number;
  onClose: () => void;
  onJoin: () => void;
  onStart: () => void;
}) {
  const joined = tournament.players.some((p) => p.userId === currentUserId);
  return (
    <View style={detailStyles.root}>
      <View style={detailStyles.header}>
        <TouchableOpacity onPress={onClose} testID="close-tournament-detail"><Ionicons name="chevron-down" size={26} color="#374151" /></TouchableOpacity>
        <Text style={detailStyles.title}>{tournament.name}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={detailStyles.body}>
        <Image source={{ uri: tournament.image }} style={detailStyles.hero} contentFit="cover" />
        <View style={detailStyles.metaRow}>
          <View style={detailStyles.metaPill}><Ionicons name="cash" size={14} color="#7c3aed" /><Text style={detailStyles.metaText}>Pot {tournament.pot}🪙</Text></View>
          <View style={detailStyles.metaPill}><Ionicons name="people" size={14} color="#7c3aed" /><Text style={detailStyles.metaText}>{tournament.players.length}/{tournament.size}</Text></View>
          <View style={[detailStyles.metaPill, { backgroundColor: tournament.status === 'completed' ? '#ecfdf5' : '#ede9fe' }]}>
            <Text style={[detailStyles.metaText, { color: tournament.status === 'completed' ? '#065f46' : '#5b21b6' }]}>
              {tournament.status.toUpperCase()}
            </Text>
          </View>
        </View>

        {tournament.status === 'completed' && tournament.winners.length > 0 && (
          <View style={detailStyles.podium}>
            <Text style={detailStyles.sectionLabel}>Final Standings · {tournament.winners.length} winner{tournament.winners.length > 1 ? 's' : ''}</Text>
            {tournament.winners.map((w: any, i: number) => (
              <PodiumRow
                key={w.userId}
                w={w}
                index={i}
                isMe={w.userId === currentUserId}
                total={tournament.winners.length}
              />
            ))}
          </View>
        )}

        {/* Invite code section (creator + joined players only) */}
        {tournament.status === 'lobby' && tournament.joinCode && (currentUserId === tournament.createdBy || tournament.players.some((p) => p.userId === currentUserId)) ? (
          <View style={detailStyles.codeCard} testID="tournament-detail-code">
            <View style={detailStyles.codeIconWrap}>
              <Ionicons name="key" size={18} color="#7c3aed" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={detailStyles.codeCardLabel}>Share this invite code</Text>
              <Text style={detailStyles.codeCardValue} selectable>{tournament.joinCode}</Text>
            </View>
            {tournament.isPrivate && (
              <View style={detailStyles.privateBadge}>
                <Ionicons name="lock-closed" size={10} color="#fff" />
                <Text style={detailStyles.privateBadgeText}>PRIVATE</Text>
              </View>
            )}
          </View>
        ) : null}

        <Text style={detailStyles.sectionLabel}>Players</Text>
        {tournament.players.map((p) => (
          <View key={p.userId} style={detailStyles.playerRow}>
            <View style={detailStyles.playerAvatar}><Ionicons name="person" size={16} color="#7c3aed" /></View>
            <Text style={detailStyles.playerName}>{p.displayName}{p.userId === currentUserId ? ' (you)' : ''}</Text>
            {p.userId === tournament.createdBy && (
              <View style={detailStyles.hostPill}><Text style={detailStyles.hostPillText}>HOST</Text></View>
            )}
          </View>
        ))}

        {tournament.bracket && tournament.bracket.length > 0 && (
          <>
            <Text style={detailStyles.sectionLabel}>Bracket</Text>
            {tournament.bracket.map((round: any, ri: number) => (
              <View key={ri} style={detailStyles.roundBlock}>
                <Text style={detailStyles.roundLabel}>{(round.round || `Round ${ri + 1}`).toUpperCase()}</Text>
                {(round.matches || []).map((m: any, mi: number) => {
                  const winnerName = m.winner === m.p1?.userId ? m.p1?.displayName : m.p2?.displayName;
                  return (
                    <View key={mi} style={[detailStyles.matchRow, m.thirdPlace && detailStyles.matchRowThird]}>
                      <Text style={detailStyles.matchPlayer}>{m.p1?.displayName} ({m.scoreP1})</Text>
                      <Text style={detailStyles.vs}>vs</Text>
                      <Text style={detailStyles.matchPlayer}>{m.p2?.displayName} ({m.scoreP2})</Text>
                      <View style={detailStyles.winnerPill}>
                        <Ionicons name="trophy" size={11} color="#92400e" />
                        <Text style={detailStyles.winnerPillText}>{winnerName}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {tournament.status === 'lobby' && (
        <View style={detailStyles.footer}>
          {!joined ? (
            <TouchableOpacity
              style={[detailStyles.actionBtn, userCoins < tournament.entryFee && { opacity: 0.5 }]}
              onPress={onJoin}
              disabled={userCoins < tournament.entryFee}
              testID="detail-join-tournament"
            >
              <Ionicons name="enter" size={18} color="#fff" />
              <Text style={detailStyles.actionText}>Join {tournament.entryFee}🪙</Text>
            </TouchableOpacity>
          ) : currentUserId === tournament.createdBy && tournament.players.length >= 2 ? (
            <TouchableOpacity style={detailStyles.actionBtn} onPress={onStart} testID="detail-start-tournament">
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={detailStyles.actionText}>Start tournament</Text>
            </TouchableOpacity>
          ) : (
            <View style={detailStyles.waitingBanner}>
              <ActivityIndicator color="#7c3aed" />
              <Text style={detailStyles.waitingText}>Waiting for more players… auto-starts at {tournament.size}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fdfcfa' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.sm,
    borderBottomWidth: 1, borderBottomColor: '#f1efea',
    gap: SPACING.sm,
  },
  headerIcon: { padding: 4 },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937' },
  headerSub: { fontSize: 11, color: '#6b7280', marginTop: 1 },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#7c3aed', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  codeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: '#c4b5fd',
  },
  codeBtnText: { color: '#5b21b6', fontWeight: '800', fontSize: 12 },
  hallBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 999,
    borderWidth: 1, borderColor: '#facc15',
  },
  hallBtnText: { color: '#92400e', fontWeight: '800', fontSize: 12 },
  myWinCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1.5,
    borderRadius: 14, padding: 12, marginTop: SPACING.md,
  },
  myWinRankBubble: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: '#fbbf24', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  myWinRankNum: { color: '#1f2937', fontSize: 14, fontWeight: '900' },
  myWinTitle: { color: '#1f2937', fontSize: 14, fontWeight: '800' },
  myWinSub: { color: '#92400e', fontSize: 12, fontWeight: '700', marginTop: 2 },
  lbEmpty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  lbEmptyText: { color: '#6b7280', fontSize: 13, fontWeight: '600', textAlign: 'center', paddingHorizontal: 24 },
  lbRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fafafa', borderRadius: 12, marginBottom: 6,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  lbRowTop3: { backgroundColor: '#fef3c7', borderColor: '#facc15' },
  lbRowMe: { borderColor: '#7c3aed', borderWidth: 1.5 },
  lbRank: { fontSize: 18, fontWeight: '900', width: 36, color: '#374151', textAlign: 'center' },
  lbRankTop3: { fontSize: 22 },
  lbName: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
  lbSub: { fontSize: 11, color: '#6b7280', fontWeight: '700', marginTop: 1 },
  lbWinsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#fde68a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, borderColor: '#facc15',
  },
  lbWinsText: { color: '#7c2d12', fontWeight: '900', fontSize: 13 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privatePill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#7c3aed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  publicPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#10b981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8,
  },
  privatePillText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  codeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start',
    backgroundColor: '#ede9fe', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    borderWidth: 1, borderColor: '#c4b5fd',
  },
  codeBadgeText: { color: '#5b21b6', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  visibilityRow: { gap: 6, marginTop: SPACING.md },
  visibilityChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: '#c4b5fd', backgroundColor: '#f5f3ff',
  },
  visibilityChipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  visibilityText: { color: '#5b21b6', fontSize: 13, fontWeight: '700' },
  visibilityTextActive: { color: '#ffffff' },
  rewardsBanner: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 12,
    marginHorizontal: SPACING.md, marginVertical: SPACING.sm, padding: SPACING.sm,
  },
  rewardItem: { alignItems: 'center', gap: 2 },
  rewardEmoji: { fontSize: 18 },
  rewardText: { color: '#92400e', fontWeight: '800', fontSize: 11 },
  list: { padding: SPACING.md, gap: SPACING.md, paddingBottom: 80 },
  card: {
    backgroundColor: '#ffffff', borderRadius: 16, overflow: 'hidden',
    borderWidth: 1, borderColor: '#e5e7eb', marginBottom: SPACING.md,
  },
  cardImage: { width: '100%', height: 110 },
  cardImageVeil: { ...StyleSheet.absoluteFillObject, height: 110, backgroundColor: 'rgba(15,11,25,0.25)' },
  cardImageBadges: { position: 'absolute', top: 8, left: 8, right: 8, flexDirection: 'row', justifyContent: 'space-between' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusLobby: { backgroundColor: '#7c3aed' },
  statusRunning: { backgroundColor: '#10b981' },
  statusDone: { backgroundColor: '#6b7280' },
  statusText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  entryPill: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(15,11,25,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  entryPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  cardBody: { padding: SPACING.md },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#1f2937' },
  cardSub: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, gap: 8 },
  joinBtn: { backgroundColor: '#7c3aed', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  startBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  completedPill: { backgroundColor: '#fef3c7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  completedText: { color: '#92400e', fontWeight: '800', fontSize: 12 },
  tapHint: { marginLeft: 'auto', color: '#9ca3af', fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.lg, gap: 12 },
  emptyText: { color: '#6b7280', fontSize: 14, textAlign: 'center' },
  bigCreateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#7c3aed', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999 },
  bigCreateText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  overlay: { flex: 1, backgroundColor: 'rgba(15,11,25,0.65)', justifyContent: 'center', alignItems: 'center', padding: SPACING.lg },
  createCard: { backgroundColor: '#fff', borderRadius: 20, padding: SPACING.lg, width: '100%', maxWidth: 420 },
  createHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  createTitle: { fontSize: 20, fontWeight: '800', color: '#1f2937' },
  createSub: { fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: SPACING.md },
  gameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: 12, marginBottom: 8, backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#f3f4f6' },
  gameRowImg: { width: 56, height: 56, borderRadius: 10 },
  gameRowName: { fontSize: 15, fontWeight: '800', color: '#1f2937' },
  gameRowDesc: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  pickedHero: { height: 90, borderRadius: 12, overflow: 'hidden', marginBottom: SPACING.sm, marginTop: 4, position: 'relative' },
  pickedHeroImg: { width: '100%', height: '100%' },
  pickedHeroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,11,25,0.45)' },
  pickedHeroText: { position: 'absolute', left: 12, bottom: 10, color: '#fff', fontSize: 16, fontWeight: '800' },
  fieldLabel: { fontSize: 11, color: '#6b7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: SPACING.sm, marginBottom: 6 },
  input: { backgroundColor: '#ffffff', borderWidth: 1.5, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1f2937' },
  numInput: { fontSize: 20, fontWeight: '800' },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  preset: { paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#f3f4f6', borderRadius: 999, borderWidth: 1, borderColor: '#e5e7eb' },
  presetActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  presetText: { fontSize: 12, color: '#374151', fontWeight: '700' },
  presetTextActive: { color: '#fff' },
  previewBox: { backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: 12, padding: SPACING.sm, marginTop: SPACING.md },
  previewTitle: { fontSize: 12, fontWeight: '800', color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  previewLine: { fontSize: 12, color: '#7c2d12', marginTop: 2 },
  previewStrong: { fontWeight: '800', color: '#92400e' },
  previewSub: { fontSize: 10, color: '#a16207', marginTop: 6, fontStyle: 'italic' },
  createSubmit: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 14, marginTop: SPACING.md },
  createSubmitText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

const detailStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fdfcfa' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.md, paddingTop: SPACING.xl, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: '#f1efea' },
  title: { fontSize: 17, fontWeight: '800', color: '#1f2937', flex: 1, textAlign: 'center' },
  body: { padding: SPACING.md, paddingBottom: 100 },
  hero: { width: '100%', height: 140, borderRadius: 14, marginBottom: SPACING.sm, backgroundColor: '#e5e7eb' },
  metaRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md, flexWrap: 'wrap' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ede9fe', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  metaText: { color: '#5b21b6', fontSize: 12, fontWeight: '800' },
  sectionLabel: { fontSize: 11, color: '#6b7280', fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginTop: SPACING.md, marginBottom: 6 },
  podium: { marginTop: SPACING.sm },
  podiumRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fffbeb', padding: 10, borderRadius: 12, marginBottom: 6, borderWidth: 1, borderColor: '#fde68a' },
  podiumRowMe: { borderColor: '#7c3aed', backgroundColor: '#f5f3ff' },
  podiumMedal: { fontSize: 22 },
  podiumName: { fontSize: 15, fontWeight: '800', color: '#1f2937' },
  podiumReward: { fontSize: 11, color: '#92400e', fontWeight: '700', marginTop: 1 },
  champBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  champBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  codeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ede9fe', borderColor: '#c4b5fd', borderWidth: 1.5,
    borderRadius: 14, padding: 12, marginTop: SPACING.sm,
  },
  codeIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#c4b5fd',
  },
  codeCardLabel: { color: '#5b21b6', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  codeCardValue: { color: '#1f2937', fontSize: 22, fontWeight: '900', letterSpacing: 4, marginTop: 2 },
  privateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#7c3aed', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8,
  },
  privateBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ffffff', padding: 10, borderRadius: 10, marginBottom: 4, borderWidth: 1, borderColor: '#f3f4f6' },
  playerAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#ede9fe', alignItems: 'center', justifyContent: 'center' },
  playerName: { flex: 1, fontSize: 13, color: '#1f2937', fontWeight: '600' },
  hostPill: { backgroundColor: '#ede9fe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  hostPillText: { color: '#5b21b6', fontSize: 10, fontWeight: '800' },
  roundBlock: { marginTop: 4 },
  roundLabel: { fontSize: 10, color: '#7c3aed', fontWeight: '800', letterSpacing: 0.6, marginTop: 6, marginBottom: 4 },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#ffffff', padding: 8, borderRadius: 10, marginBottom: 4, borderWidth: 1, borderColor: '#f3f4f6', flexWrap: 'wrap' },
  matchRowThird: { backgroundColor: '#fef3c7', borderColor: '#fde68a' },
  matchPlayer: { fontSize: 12, color: '#1f2937', fontWeight: '700' },
  vs: { fontSize: 10, color: '#9ca3af' },
  winnerPill: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  winnerPillText: { color: '#92400e', fontSize: 11, fontWeight: '800' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: SPACING.md, backgroundColor: '#fdfcfa', borderTopWidth: 1, borderTopColor: '#f1efea' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 14 },
  actionText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  waitingBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f3ff', padding: 12, borderRadius: 12, justifyContent: 'center' },
  waitingText: { color: '#5b21b6', fontWeight: '700', fontSize: 12 },
});
