import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { playWinSound, playMessageSound } from '../utils/sound';
import { Dices, Sparkles, Trophy, Coins, RotateCcw, AlertCircle, X, Users, HeartHandshake } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GamePanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId?: string;
  initialGame?: 'higher_card' | 'dice_roll' | 'spin_wheel';
  friendOpponent?: { id: string; name: string; photoUrl: string; username?: string } | null;
  isFriendlyFreePlay?: boolean;
}

type MiniGameTab = 'higher_card' | 'dice_roll' | 'spin_wheel';

export default function GamePanel({
  isOpen,
  onClose,
  roomId = 'room-world',
  initialGame = 'higher_card',
  friendOpponent,
  isFriendlyFreePlay = false,
}: GamePanelProps) {
  const { user, addCoins, addXp } = useAuth();
  const [activeGame, setActiveGame] = useState<MiniGameTab>(initialGame);
  const [coinAmount, setCoinAmount] = useState<number>(isFriendlyFreePlay ? 0 : 10);
  const [playing, setPlaying] = useState(false);
  const [gameResult, setGameResult] = useState<{
    won: boolean;
    reward: number;
    playerVal?: string | number;
    houseVal?: string | number;
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialGame) {
      setActiveGame(initialGame);
      setGameResult(null);
    }
  }, [initialGame, isOpen]);

  const REAL_PLAYERS = [
    { id: 'user-maya', name: 'Maya Phoenix', username: 'maya_p', photoUrl: '/public/avatars/default-3-alien.png', level: 6, vipTier: 'elite' },
    { id: 'user-leo', name: 'Leo Vance', username: 'leo_v', photoUrl: '/public/avatars/default-1-panda.png', level: 5, vipTier: 'pro' },
    { id: 'user-kai', name: 'Kai Chen', username: 'kaichen', photoUrl: '/public/avatars/default-2-corgi.png', level: 4, vipTier: null },
    { id: 'user-chloe', name: 'Chloe Rivera', username: 'chloer', photoUrl: '/public/avatars/default-3-alien.png', level: 5, vipTier: 'elite' },
    { id: 'user-jordan', name: 'Jordan Taylor', username: 'jordant', photoUrl: '/public/avatars/default-2-corgi.png', level: 3, vipTier: null },
  ];

  const [matchedRealPlayer] = useState(() => {
    return REAL_PLAYERS[Math.floor(Math.random() * REAL_PLAYERS.length)];
  });

  const activeOpponent = friendOpponent || matchedRealPlayer;
  const opponentName = activeOpponent.name;
  const opponentPhoto = activeOpponent.photoUrl;

  const cardNames: Record<number, string> = {
    11: 'Jack',
    12: 'Queen',
    13: 'King',
    14: 'Ace',
  };

  const getCardDisplay = (val: number) => {
    return cardNames[val] || String(val);
  };

  const handlePlayHigherCard = () => {
    setErrorMsg(null);
    if (coinAmount > 0 && user.coins < coinAmount) {
      setErrorMsg(`Not enough coins! You have ${user.coins} coins.`);
      return;
    }

    if (coinAmount > 0) {
      const deducted = addCoins(-coinAmount, `Friendly Higher Card match`, 'game_bet');
      if (!deducted) return;
    }

    setPlaying(true);
    setGameResult(null);
    playMessageSound();

    setTimeout(() => {
      // Draw cards between 2 and 14
      const playerCard = Math.floor(Math.random() * 13) + 2;
      const houseCard = Math.floor(Math.random() * 13) + 2;

      let won = false;
      let reward = 0;
      let message = '';

      if (playerCard > houseCard) {
        won = true;
        reward = coinAmount > 0 ? Math.floor(coinAmount * 2.2) : 5;
        if (reward > 0) {
          addCoins(reward, `Won Friendly Higher Card (${getCardDisplay(playerCard)} vs ${getCardDisplay(houseCard)})`, 'game_win');
        }
        addXp(15);
        playWinSound();
        confetti({ particleCount: 60, spread: 60 });
        message = `Victory! Your ${getCardDisplay(playerCard)} beat ${opponentName}'s ${getCardDisplay(houseCard)}!`;
      } else if (playerCard === houseCard) {
        // Push
        reward = coinAmount;
        if (reward > 0) {
          addCoins(reward, `Friendly Draw — coins returned`, 'game_win');
        }
        message = `Friendly Draw! Both drew ${getCardDisplay(playerCard)}. Coins returned.`;
      } else {
        won = false;
        message = `${opponentName} won with ${getCardDisplay(houseCard)} against your ${getCardDisplay(playerCard)}. Good friendly match!`;
      }

      setGameResult({
        won,
        reward,
        playerVal: getCardDisplay(playerCard),
        houseVal: getCardDisplay(houseCard),
        message,
      });
      setPlaying(false);
    }, 800);
  };

  const handlePlayDiceRoll = () => {
    setErrorMsg(null);
    if (coinAmount > 0 && user.coins < coinAmount) {
      setErrorMsg(`Not enough coins! You have ${user.coins} coins.`);
      return;
    }

    if (coinAmount > 0) {
      const deducted = addCoins(-coinAmount, `Friendly Dice Roll match`, 'game_bet');
      if (!deducted) return;
    }

    setPlaying(true);
    setGameResult(null);
    playMessageSound();

    setTimeout(() => {
      const p1 = Math.floor(Math.random() * 6) + 1;
      const p2 = Math.floor(Math.random() * 6) + 1;
      const playerTotal = p1 + p2;

      const h1 = Math.floor(Math.random() * 6) + 1;
      const h2 = Math.floor(Math.random() * 6) + 1;
      const houseTotal = h1 + h2;

      let won = false;
      let reward = 0;
      let message = '';

      if (playerTotal > houseTotal) {
        won = true;
        reward = coinAmount > 0 ? Math.floor(coinAmount * 2.1) : 5;
        if (reward > 0) {
          addCoins(reward, `Won Friendly Dice Roll (${playerTotal} vs ${houseTotal})`, 'game_win');
        }
        addXp(12);
        playWinSound();
        confetti({ particleCount: 50, spread: 60 });
        message = `Winner! Rolled [${p1}, ${p2}] (${playerTotal}) vs ${opponentName}'s [${h1}, ${h2}] (${houseTotal})!`;
      } else if (playerTotal === houseTotal) {
        reward = coinAmount;
        if (reward > 0) {
          addCoins(reward, `Friendly Draw — coins returned`, 'game_win');
        }
        message = `Draw! Both rolled ${playerTotal}. Coins returned.`;
      } else {
        won = false;
        message = `${opponentName} won with [${h1}, ${h2}] (${houseTotal}) against your [${p1}, ${p2}] (${playerTotal}). Great match!`;
      }

      setGameResult({
        won,
        reward,
        playerVal: `${p1}+${p2} = ${playerTotal}`,
        houseVal: `${h1}+${h2} = ${houseTotal}`,
        message,
      });
      setPlaying(false);
    }, 800);
  };

  const handleSpinWheel = () => {
    setErrorMsg(null);
    const spinCost = 10;
    if (user.coins < spinCost) {
      setErrorMsg(`Spin costs 10 coins. You have ${user.coins} coins.`);
      return;
    }

    const deducted = addCoins(-spinCost, `Lucky Spin Wheel Game`, 'game_bet');
    if (!deducted) return;

    setPlaying(true);
    setGameResult(null);
    playMessageSound();

    setTimeout(() => {
      // Possible rewards: 0, 5, 10, 20, 50, 100
      const outcomes = [0, 5, 10, 15, 20, 25, 50, 100];
      const prize = outcomes[Math.floor(Math.random() * outcomes.length)];
      const won = prize > spinCost;

      if (prize > 0) {
        addCoins(prize, `Spin Wheel Prize: ${prize} coins`, 'game_win');
        if (won) {
          playWinSound();
          confetti({ particleCount: 80, spread: 70 });
        }
      }

      setGameResult({
        won,
        reward: prize,
        playerVal: `Prize: ${prize} coins`,
        message: prize >= spinCost ? `Jackpot! Won ${prize} coins!` : `Landed on ${prize} coins! Better luck next spin.`,
      });
      setPlaying(false);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#120e24] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-pink-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
              {friendOpponent ? <HeartHandshake className="w-5 h-5 text-pink-400" /> : <Dices className="w-5 h-5 text-amber-400" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base text-white">
                  1v1 Match vs {opponentName}
                </h3>
                <span className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {friendOpponent ? 'Friend' : 'Real Player'}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Playing 1v1 match against real player @{('username' in activeOpponent && activeOpponent.username) || opponentName.toLowerCase().replace(/\s+/g, '_')}!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Friend Match Banner if active */}
        {friendOpponent && (
          <div className="px-4 py-2.5 bg-pink-950/40 border-b border-pink-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-pink-200">
                Live 1v1 Friendly Room with @{friendOpponent.name}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-semibold">Casual Friendly Mode</span>
          </div>
        )}

        {/* Game Navigation Tabs */}
        <div className="p-3 border-b border-white/5 flex gap-2 bg-zinc-950/40">
          <button
            onClick={() => {
              setActiveGame('higher_card');
              setGameResult(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeGame === 'higher_card'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>🃏 Higher Card</span>
          </button>
          <button
            onClick={() => {
              setActiveGame('dice_roll');
              setGameResult(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeGame === 'dice_roll'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>🎲 Dice Roll</span>
          </button>
          <button
            onClick={() => {
              setActiveGame('spin_wheel');
              setGameResult(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeGame === 'spin_wheel'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-zinc-900/80 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>🎡 Lucky Spin</span>
          </button>
        </div>

        {/* Game Body */}
        <div className="p-5 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Versus Header */}
          <div className="flex items-center justify-center gap-6 py-1">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 p-0.5 ring-2 ring-purple-500/70 shadow-lg">
                <img src={user.photoUrl} alt="You" className="w-full h-full object-cover rounded-[10px]" />
              </div>
              <span className="text-[11px] font-bold text-white mt-1">You</span>
            </div>

            <div className="flex flex-col items-center">
              <span className="text-xs font-black px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                VS
              </span>
              <span className="text-[9px] text-zinc-500 font-semibold mt-1">Friendly Round</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-900 p-0.5 ring-2 ring-amber-500/70 shadow-lg">
                <img src={opponentPhoto} alt={opponentName} className="w-full h-full object-cover rounded-[10px]" />
              </div>
              <span className="text-[11px] font-bold text-white mt-1 truncate max-w-[90px]">
                {opponentName}
              </span>
              <span className="text-[8px] font-extrabold uppercase px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                {friendOpponent ? 'Friend' : 'Real Player'}
              </span>
            </div>
          </div>

          {/* Coin Entry Level Selector (for Higher card and Dice) */}
          {activeGame !== 'spin_wheel' && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-white/5">
              <span className="text-xs text-zinc-400 font-semibold">Coins Entry</span>
              <div className="flex items-center gap-2">
                {[0, 10, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setCoinAmount(amt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all ${
                      coinAmount === amt
                        ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20 scale-105'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {amt === 0 ? (
                      <span>Free</span>
                    ) : (
                      <>
                        <Coins className="w-3.5 h-3.5 fill-current" />
                        <span>{amt}</span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Arena Display */}
          <div className="p-6 rounded-2xl bg-zinc-950/80 border border-purple-500/20 text-center flex flex-col items-center justify-center min-h-[170px] relative overflow-hidden">
            {playing ? (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin mx-auto" />
                <p className="text-xs text-purple-300 font-bold animate-pulse">
                  {activeGame === 'higher_card'
                    ? `Dealing cards between you and ${opponentName}...`
                    : activeGame === 'dice_roll'
                    ? `Rolling dice across the friendly table...`
                    : 'Spinning the lucky wheel...'}
                </p>
              </div>
            ) : gameResult ? (
              <div className="space-y-2 animate-fadeIn">
                <div className="text-3xl sm:text-4xl">
                  {gameResult.won ? '🎉 🏆' : '🎲 🃏'}
                </div>
                <h4
                  className={`font-black text-lg ${
                    gameResult.won ? 'text-amber-400' : 'text-zinc-300'
                  }`}
                >
                  {gameResult.message}
                </h4>
                {gameResult.reward > 0 && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold text-sm">
                    <Coins className="w-4 h-4 fill-amber-400" />
                    <span>+{gameResult.reward} Coins earned!</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">
                  {activeGame === 'higher_card' ? '🂠' : activeGame === 'dice_roll' ? '🎲' : '🎡'}
                </div>
                <h4 className="font-extrabold text-base text-white">
                  {activeGame === 'higher_card'
                    ? 'Higher Card Friendly Duel'
                    : activeGame === 'dice_roll'
                    ? '2-Dice Friendly Roll'
                    : 'Lucky Wheel of Fortune'}
                </h4>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  {activeGame === 'higher_card'
                    ? `Draw a card higher than ${opponentName} to win 2.2x pot rewards!`
                    : activeGame === 'dice_roll'
                    ? `Roll higher sum than ${opponentName} to win 2.1x coins!`
                    : 'Spin to win up to 100 coins instantly.'}
                </p>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            disabled={playing}
            onClick={
              activeGame === 'higher_card'
                ? handlePlayHigherCard
                : activeGame === 'dice_roll'
                ? handlePlayDiceRoll
                : handleSpinWheel
            }
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:brightness-110 active:scale-98 text-white font-black text-sm tracking-wide shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {playing
                ? 'Playing...'
                : activeGame === 'spin_wheel'
                ? 'Spin (10 Coins)'
                : coinAmount === 0
                ? 'Play Free Friendly Round'
                : `Play Friendly Round (${coinAmount} Coins)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
