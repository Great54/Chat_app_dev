import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  ScrollView, ActivityIndicator, Alert, Platform, TextInput,
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
  players: { userId: string; displayName: string; photoUrl?: string }[];
  bracket: any[];
  winners: { userId: string; displayName: string; placement: number; coinsWon?: number }[];
  createdBy: string;
  createdByName: string;
  createdAt?: string;
  completedAt?: string;
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

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, gRes] = await Promise.all([
        api.get(`/rooms/${roomId}/tournaments`),
        api.get('/games/types/list'),
      ]);
      setTournaments(Array.isArray(tRes.data) ? tRes.data : []);
      setGameTypes(Array.isArray(gRes.data) ? gRes.data : []);
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
      });
      setShowCreate(false);
      setPickedGame(null);
      setCreateName('');
      await loadAll();
      onUserUpdate();
      setOpenTournament(res.data);
    } catch (e: any) {
      showAlert('Cannot create', e.response?.data?.detail || 'Failed to create tournament');
    } finally {
      setCreating(false);
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
            <Text style={styles.headerSub}>Knockout · Top 3 win VIP & coins</Text>
          </View>
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
          <View style={styles.rewardItem}><Text style={styles.rewardEmoji}>🥇</Text><Text style={styles.rewardText}>50% pot + VIP Pro + 30pts</Text></View>
          <View style={styles.rewardItem}><Text style={styles.rewardEmoji}>🥈</Text><Text style={styles.rewardText}>50% pot + 20pts</Text></View>
          <View style={styles.rewardItem}><Text style={styles.rewardEmoji}>🥉</Text><Text style={styles.rewardText}>+10 pts</Text></View>
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
                    <Text style={styles.cardTitle}>{t.name}</Text>
                    <Text style={styles.cardSub}>by {t.createdByName} · {t.players.length}/{t.size} players · Pot {t.pot}🪙</Text>
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
                    const each = Math.floor(pot / 2);
                    const remainder = pot - each;
                    return (
                      <View style={styles.previewBox}>
                        <Text style={styles.previewTitle}>Reward preview</Text>
                        <Text style={styles.previewLine}>Max pot · <Text style={styles.previewStrong}>{pot}🪙</Text> ({sz} × {fee})</Text>
                        <Text style={styles.previewLine}>🏆 Winner · <Text style={styles.previewStrong}>{remainder}🪙 + VIP Pro 30 days + 30 pts</Text></Text>
                        <Text style={styles.previewLine}>🥈 Runner-up · <Text style={styles.previewStrong}>{each}🪙 + 20 pts</Text></Text>
                        <Text style={styles.previewSub}>Pot is split equally — pot dynamically recalculated if not all seats are filled.</Text>
                      </View>
                    );
                  })()}

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
      </View>
    </Modal>
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
            <Text style={detailStyles.sectionLabel}>Final Standings</Text>
            {tournament.winners.map((w: any) => {
              const isMe = w.userId === currentUserId;
              const medal = w.placement === 1 ? '🥇' : w.placement === 2 ? '🥈' : '🥉';
              const reward = w.placement === 1
                ? `+${w.coinsWon || tournament.winnerShare || 0}🪙 + VIP Pro + 30pts`
                : w.placement === 2
                ? `+${w.coinsWon || tournament.runnerShare || 0}🪙 + 20pts`
                : '+10pts';
              return (
                <View key={w.userId} style={[detailStyles.podiumRow, isMe && detailStyles.podiumRowMe]}>
                  <Text style={detailStyles.podiumMedal}>{medal}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={detailStyles.podiumName}>{w.displayName}{isMe ? ' (you)' : ''}</Text>
                    <Text style={detailStyles.podiumReward}>{reward}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

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
