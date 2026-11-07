import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { INITIAL_TOURNAMENTS } from '../utils/storage';
import { Tournament, TournamentMatch } from '../types';
import { Trophy, Crown, Swords, Coins, X, Play, Sparkles, CheckCircle2 } from 'lucide-react';
import { playWinSound, playMessageSound } from '../utils/sound';
import confetti from 'canvas-confetti';

interface TournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

export default function TournamentModal({ isOpen, onClose, roomId }: TournamentModalProps) {
  const { user, addCoins, addXp } = useAuth();
  const [tournament, setTournament] = useState<Tournament>(INITIAL_TOURNAMENTS[0]);
  const [currentStep, setCurrentStep] = useState<'bracket' | 'create'>('bracket');
  const [newTourneyName, setNewTourneyName] = useState('Cosmic Clash Cup');
  const [newEntryFee, setNewEntryFee] = useState(25);
  const [simulating, setSimulating] = useState(false);

  if (!isOpen) return null;

  const handleSimulateNextRound = () => {
    setSimulating(true);
    playMessageSound();

    setTimeout(() => {
      setTournament((prev) => {
        const matches = [...prev.matches];
        // Check if final needs winner
        const finalMatch = matches.find((m) => m.round === 'final');
        if (finalMatch && !finalMatch.winnerId) {
          // Play final between player1 (Maya) and player2 (Alex/User)
          const userWins = Math.random() > 0.4; // 60% chance user wins
          const winner = userWins ? finalMatch.player2 : finalMatch.player1;
          finalMatch.winnerId = winner.id;
          finalMatch.player1.score = userWins ? 11 : 14;
          finalMatch.player2.score = userWins ? 14 : 11;

          if (userWins) {
            addCoins(prev.pot, `Won Tournament: ${prev.name}`, 'game_win');
            addXp(50);
            playWinSound();
            confetti({
              particleCount: 150,
              spread: 100,
              origin: { y: 0.5 },
              colors: ['#FFD700', '#FF6B9D', '#22D3EE'],
            });
          }

          return {
            ...prev,
            status: 'completed',
            champion: { id: winner.id, name: winner.name },
            matches,
          };
        }
        return prev;
      });
      setSimulating(false);
    }, 700);
  };

  const handleCreateTournament = () => {
    if (user.coins < newEntryFee) return;
    addCoins(-newEntryFee, `Created tournament: ${newTourneyName}`, 'game_bet');

    const created: Tournament = {
      id: `tourney-${Date.now()}`,
      name: newTourneyName,
      roomId,
      gameType: 'Higher Card',
      entryFee: newEntryFee,
      pot: newEntryFee * 8,
      status: 'in_progress',
      isPrivate: false,
      playersCount: 8,
      maxPlayers: 8,
      createdBy: user.displayName,
      matches: [
        { id: 'm1', round: 'quarters', player1: { id: 'p1', name: 'Luna Star', photoUrl: '/public/avatars/default-3-alien.png', score: 12 }, player2: { id: 'p2', name: 'Zack Blaze', photoUrl: '/public/avatars/default-1-panda.png', score: 9 }, winnerId: 'p1' },
        { id: 'm2', round: 'quarters', player1: { id: user.id, name: user.displayName, photoUrl: user.photoUrl, score: 14 }, player2: { id: 'p4', name: 'Sammy G', photoUrl: '/public/avatars/default-2-corgi.png', score: 8 }, winnerId: user.id },
        { id: 'm3', round: 'quarters', player1: { id: 'p5', name: 'Kai Nova', photoUrl: '/public/avatars/default-2-corgi.png', score: 10 }, player2: { id: 'p6', name: 'Cyber Fox', photoUrl: '/public/avatars/default-3-alien.png', score: 7 }, winnerId: 'p5' },
        { id: 'm4', round: 'quarters', player1: { id: 'p7', name: 'Maya Phoenix', photoUrl: '/public/avatars/default-3-alien.png', score: 13 }, player2: { id: 'p8', name: 'Shadow Ace', photoUrl: '/public/avatars/default-1-panda.png', score: 11 }, winnerId: 'p7' },
        { id: 'm5', round: 'semis', player1: { id: 'p1', name: 'Luna Star', photoUrl: '/public/avatars/default-3-alien.png', score: 9 }, player2: { id: user.id, name: user.displayName, photoUrl: user.photoUrl, score: 13 }, winnerId: user.id },
        { id: 'm6', round: 'semis', player1: { id: 'p5', name: 'Kai Nova', photoUrl: '/public/avatars/default-2-corgi.png', score: 8 }, player2: { id: 'p7', name: 'Maya Phoenix', photoUrl: '/public/avatars/default-3-alien.png', score: 12 }, winnerId: 'p7' },
        { id: 'm7', round: 'final', player1: { id: user.id, name: user.displayName, photoUrl: user.photoUrl }, player2: { id: 'p7', name: 'Maya Phoenix', photoUrl: '/public/avatars/default-3-alien.png' } },
      ],
    };
    setTournament(created);
    setCurrentStep('bracket');
  };

  const quarters = tournament.matches.filter((m) => m.round === 'quarters');
  const semis = tournament.matches.filter((m) => m.round === 'semis');
  const final = tournament.matches.find((m) => m.round === 'final');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#100d22] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-pink-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Trophy className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">{tournament.name}</h3>
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase">
                  8-Player Knockout
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5">
                <div className="flex items-center gap-1 text-amber-400 font-bold">
                  <Coins className="w-3.5 h-3.5 fill-amber-400" />
                  <span>Pot: {tournament.pot} Coins</span>
                </div>
                <span>• Entry: {tournament.entryFee} coins</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-5">
          {currentStep === 'create' ? (
            <div className="space-y-4 max-w-md mx-auto py-2">
              <h4 className="font-extrabold text-base text-white">Create New Knockout Cup</h4>
              <div>
                <label className="text-xs text-zinc-400 font-semibold block mb-1">Tournament Name</label>
                <input
                  type="text"
                  value={newTourneyName}
                  onChange={(e) => setNewTourneyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-400"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-400 font-semibold block mb-1">Entry Fee (Per Player)</label>
                <div className="flex gap-2">
                  {[15, 25, 50, 100].map((fee) => (
                    <button
                      key={fee}
                      onClick={() => setNewEntryFee(fee)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        newEntryFee === fee
                          ? 'bg-amber-400 text-zinc-950 border-amber-400 font-extrabold'
                          : 'bg-zinc-900 text-zinc-300 border-white/10'
                      }`}
                    >
                      {fee} Coins
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/20 text-xs text-purple-200">
                Champion wins entire pot of <strong className="text-amber-400">{newEntryFee * 8} Coins</strong> + Tournament Trophy badge!
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setCurrentStep('bracket')}
                  className="flex-1 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTournament}
                  className="flex-1 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white font-extrabold text-xs shadow-md shadow-purple-600/30"
                >
                  Launch Tournament
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Champion Banner if completed */}
              {tournament.champion && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-pink-500/20 to-purple-500/20 border border-amber-400/40 text-center space-y-1.5 animate-fadeIn">
                  <div className="flex items-center justify-center gap-2 text-amber-400">
                    <Crown className="w-6 h-6 fill-amber-400" />
                    <span className="font-extrabold text-lg text-white">
                      Champion: {tournament.champion.name}
                    </span>
                  </div>
                  <p className="text-xs text-amber-300 font-bold">
                    Awarded the Golden Trophy & {tournament.pot} Coins pot payout!
                  </p>
                </div>
              )}

              {/* Visual Knockout Bracket */}
              <div className="space-y-4">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Quarterfinals</span>
                  <span>Semifinals</span>
                  <span>Championship Final</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Quarters Column */}
                  <div className="space-y-2">
                    {quarters.map((m) => (
                      <div key={m.id} className="p-2.5 rounded-xl bg-zinc-900/90 border border-white/5 space-y-1 text-xs">
                        <div className={`flex items-center justify-between p-1 rounded ${m.winnerId === m.player1.id ? 'bg-amber-400/20 text-amber-300 font-bold' : 'text-zinc-400'}`}>
                          <span className="truncate max-w-[100px]">{m.player1.name}</span>
                          <span>{m.player1.score}</span>
                        </div>
                        <div className={`flex items-center justify-between p-1 rounded ${m.winnerId === m.player2.id ? 'bg-amber-400/20 text-amber-300 font-bold' : 'text-zinc-400'}`}>
                          <span className="truncate max-w-[100px]">{m.player2.name}</span>
                          <span>{m.player2.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Semis Column */}
                  <div className="space-y-4 sm:pt-4">
                    {semis.map((m) => (
                      <div key={m.id} className="p-2.5 rounded-xl bg-zinc-900/90 border border-purple-500/20 space-y-1 text-xs">
                        <div className={`flex items-center justify-between p-1 rounded ${m.winnerId === m.player1.id ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-zinc-400'}`}>
                          <span className="truncate max-w-[100px]">{m.player1.name}</span>
                          <span>{m.player1.score}</span>
                        </div>
                        <div className={`flex items-center justify-between p-1 rounded ${m.winnerId === m.player2.id ? 'bg-purple-500/20 text-purple-300 font-bold' : 'text-zinc-400'}`}>
                          <span className="truncate max-w-[100px]">{m.player2.name}</span>
                          <span>{m.player2.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Final Column */}
                  <div className="sm:pt-10">
                    {final && (
                      <div className="p-3.5 rounded-xl bg-gradient-to-b from-purple-900/40 to-pink-900/40 border border-amber-400/50 space-y-2 text-xs shadow-lg shadow-purple-500/20">
                        <div className="text-[10px] uppercase font-black text-amber-400 text-center tracking-wider">
                          🏆 Grand Final
                        </div>
                        <div className={`flex items-center justify-between p-1.5 rounded ${final.winnerId === final.player1.id ? 'bg-amber-400 text-zinc-950 font-black' : 'text-zinc-200 font-semibold'}`}>
                          <span>{final.player1.name}</span>
                          <span>{final.player1.score ?? '-'}</span>
                        </div>
                        <div className={`flex items-center justify-between p-1.5 rounded ${final.winnerId === final.player2.id ? 'bg-amber-400 text-zinc-950 font-black' : 'text-zinc-200 font-semibold'}`}>
                          <span>{final.player2.name}</span>
                          <span>{final.player2.score ?? '-'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Control Buttons */}
              <div className="flex gap-2 pt-2 border-t border-white/5">
                <button
                  onClick={() => setCurrentStep('create')}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-white/10 hover:border-purple-400 text-zinc-200 font-bold text-xs transition-colors"
                >
                  Create Tournament
                </button>
                <button
                  disabled={simulating || tournament.status === 'completed'}
                  onClick={handleSimulateNextRound}
                  className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 ${
                    tournament.status === 'completed'
                      ? 'bg-zinc-800 text-zinc-500 cursor-default'
                      : 'bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 shadow-md shadow-amber-500/20 hover:from-amber-300 hover:to-amber-400'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>
                    {simulating
                      ? 'Playing Match...'
                      : tournament.status === 'completed'
                      ? 'Tournament Concluded'
                      : 'Play Final Championship Match!'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
