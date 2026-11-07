import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { playWinSound, playMessageSound } from '../utils/sound';
import { Dices, Sparkles, Trophy, Coins, RotateCcw, AlertCircle, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface GamePanelProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
}

type MiniGameTab = 'higher_card' | 'dice_roll' | 'spin_wheel';

export default function GamePanel({ isOpen, onClose, roomId }: GamePanelProps) {
  const { user, addCoins, addXp } = useAuth();
  const [activeGame, setActiveGame] = useState<MiniGameTab>('higher_card');
  const [betAmount, setBetAmount] = useState<number>(10);
  const [playing, setPlaying] = useState(false);
  const [gameResult, setGameResult] = useState<{
    won: boolean;
    reward: number;
    playerVal?: string | number;
    houseVal?: string | number;
    message: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

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
    if (user.coins < betAmount) {
      setErrorMsg(`Not enough coins! You have ${user.coins} coins.`);
      return;
    }

    const deducted = addCoins(-betAmount, `Played Higher Card in room`, 'game_bet');
    if (!deducted) return;

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
        reward = Math.floor(betAmount * 2.2);
        addCoins(reward, `Won Higher Card (${getCardDisplay(playerCard)} vs ${getCardDisplay(houseCard)})`, 'game_win');
        addXp(15);
        playWinSound();
        confetti({ particleCount: 60, spread: 60 });
        message = `Victory! Your ${getCardDisplay(playerCard)} beat Dealer's ${getCardDisplay(houseCard)}!`;
      } else if (playerCard === houseCard) {
        // Push
        reward = betAmount;
        addCoins(reward, `Tied Higher Card — bet refunded`, 'game_win');
        message = `Tie! Both drew ${getCardDisplay(playerCard)}. Bet refunded.`;
      } else {
        won = false;
        message = `Dealer won with ${getCardDisplay(houseCard)} against your ${getCardDisplay(playerCard)}.`;
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
    if (user.coins < betAmount) {
      setErrorMsg(`Not enough coins! You have ${user.coins} coins.`);
      return;
    }

    const deducted = addCoins(-betAmount, `Played Dice Roll in room`, 'game_bet');
    if (!deducted) return;

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
        reward = Math.floor(betAmount * 2.1);
        addCoins(reward, `Won Dice Roll (${playerTotal} vs ${houseTotal})`, 'game_win');
        addXp(12);
        playWinSound();
        confetti({ particleCount: 50, spread: 60 });
        message = `Winner! Rolled [${p1}, ${p2}] (${playerTotal}) vs Dealer's [${h1}, ${h2}] (${houseTotal})!`;
      } else if (playerTotal === houseTotal) {
        reward = betAmount;
        addCoins(reward, `Tied Dice Roll — refunded`, 'game_win');
        message = `Push! Both rolled ${playerTotal}. Bet refunded.`;
      } else {
        won = false;
        message = `Dealer won with [${h1}, ${h2}] (${houseTotal}) against your [${p1}, ${p2}] (${playerTotal}).`;
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

    const deducted = addCoins(-spinCost, `Spin Wheel Game`, 'game_bet');
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
        <div className="p-4 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-purple-900/40 to-indigo-900/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-white">In-Room Mini Games</h3>
              <p className="text-xs text-zinc-400">Bet coins, win pot prizes & earn bonus XP!</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

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

          {/* Bet Selector (for Higher card and Dice) */}
          {activeGame !== 'spin_wheel' && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/90 border border-white/5">
              <span className="text-xs text-zinc-400 font-semibold">Select Bet</span>
              <div className="flex items-center gap-2">
                {[10, 25, 50].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setBetAmount(amt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1 transition-all ${
                      betAmount === amt
                        ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20 scale-105'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5 fill-current" />
                    <span>{amt}</span>
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
                    ? 'Dealing cards from deck...'
                    : activeGame === 'dice_roll'
                    ? 'Rolling dice across table...'
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
                    <span>+{gameResult.reward} Coins won!</span>
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
                    ? 'Higher Card Duel'
                    : activeGame === 'dice_roll'
                    ? '2-Dice High Roller'
                    : '10-Coin Wheel of Fortune'}
                </h4>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                  {activeGame === 'higher_card'
                    ? 'Draw a card higher than the house to win 2.2x your stake!'
                    : activeGame === 'dice_roll'
                    ? 'Roll higher sum than dealer to win 2.1x pot!'
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
                : `Play Round (${betAmount} Coins)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
