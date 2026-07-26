"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectSocket } from "@/lib/socket";
import { Trophy, Shield, Loader2, Sparkles, Award, Zap, RotateCcw, History, BarChart2, Frown, User, Swords } from "lucide-react";

interface GameState {
  session_code: string;
  user_id: string;
  username: string;
  role: string;
}

interface MatchResultData {
  winner_id: string;
  winner_username: string;
  player1_final_hp: number;
  player2_final_hp: number;
}

export default function MatchResultPage() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultData | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Call disconnectSocket() on mount
    disconnectSocket();

    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }

    const storedResult = sessionStorage.getItem("sf_match_result");
    const storedState = sessionStorage.getItem("sf_game_state");

    if (!storedResult || !storedState) {
      router.push("/login");
      return;
    }

    try {
      const parsedResult: MatchResultData = JSON.parse(storedResult);
      const parsedState: GameState = JSON.parse(storedState);

      if (isMounted) {
        setMatchResult(parsedResult);
        setGameState(parsedState);
      }

      // Clean up sessionStorage
      sessionStorage.removeItem("sf_round_result");
      sessionStorage.removeItem("sf_match_result");
      sessionStorage.removeItem("sf_game_state");
    } catch (e) {
      router.push("/login");
    }

    return () => {
      isMounted = false;
    };
  }, [router]);

  if (!gameState || !matchResult) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-pulse">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-400 font-medium">Calculating Match Result...</p>
      </div>
    );
  }

  const isWinner = gameState.user_id === matchResult.winner_id;
  const isPlayer1 = gameState.role === "player1";
  const myFinalHpRaw = isPlayer1 ? matchResult.player1_final_hp : matchResult.player2_final_hp;
  const opponentFinalHpRaw = isPlayer1 ? matchResult.player2_final_hp : matchResult.player1_final_hp;

  // Final HP: show remaining HP (0 if lost, winner's HP if won)
  const displayHp = isWinner ? Math.max(0, myFinalHpRaw) : 0;
  const xpEarned = isWinner ? 120 : 40;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Background Glows */}
      <div className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700 ${
        isWinner ? "bg-amber-500/20" : "bg-rose-500/10"
      }`} />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 animate-fade-in text-center space-y-6">
        {/* Winner Banner / Header */}
        <div className="relative">
          {isWinner ? (
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <span className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping blur-sm" />
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/20 border-2 border-yellow-200">
                  <Trophy className="w-10 h-10 animate-bounce" />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-2 shadow-sm">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Match Complete</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-400 to-yellow-500 drop-shadow-sm">
                🏆 Victory!
              </h1>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400 mb-4 shadow-inner">
                <Frown className="w-10 h-10 text-slate-500" />
              </div>
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-400 text-xs font-extrabold uppercase tracking-widest mb-2">
                <span>Match Complete</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-300">
                Defeated
              </h1>
            </div>
          )}
        </div>

        {/* Winner Name */}
        <div className="py-2 border-y border-slate-800/80 bg-slate-950/40 rounded-2xl px-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
            Winner of the Arena
          </p>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-wide truncate">
            {matchResult.winner_username} Wins!
          </h2>
        </div>

        {/* Stats Grid (3 boxes) */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {/* Box 1: Final HP */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 text-center shadow-inner flex flex-col justify-center">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Final HP
            </span>
            <span className="font-mono text-lg sm:text-xl font-black text-emerald-400">
              {displayHp}
            </span>
          </div>

          {/* Box 2: XP Earned */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3 text-center shadow-inner flex flex-col justify-center relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-indigo-500 opacity-60" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 block flex items-center justify-center gap-1">
              <Zap className="w-3 h-3 text-indigo-400" />
              <span>XP Earned</span>
            </span>
            <span className="font-mono text-lg sm:text-xl font-black text-indigo-300">
              +{xpEarned}
            </span>
          </div>

          {/* Box 3: Outcome */}
          <div className={`border rounded-2xl p-3 text-center shadow-inner flex flex-col justify-center ${
            isWinner
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : "bg-slate-950/60 border-slate-800/80 text-slate-400"
          }`}>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider opacity-80 mb-1 block">
              Outcome
            </span>
            <span className="font-extrabold text-xs sm:text-sm uppercase tracking-wider">
              {isWinner ? "Victory" : "Defeat"}
            </span>
          </div>
        </div>

        {/* Final HP Bars */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 space-y-3 text-left">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-1">
            Final Battle HP
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Player 1 HP */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300 truncate">You ({isPlayer1 ? "P1" : "P2"})</span>
                <span className="font-mono text-emerald-400 font-extrabold">{Math.max(0, myFinalHpRaw)}</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, myFinalHpRaw))}%` }}
                />
              </div>
            </div>

            {/* Player 2 HP */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300 truncate">Opponent ({isPlayer1 ? "P2" : "P1"})</span>
                <span className="font-mono text-rose-400 font-extrabold">{Math.max(0, opponentFinalHpRaw)}</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full"
                  style={{ width: `${Math.min(100, Math.max(0, opponentFinalHpRaw))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Buttons Row */}
        <div className="space-y-3 pt-2">
          {/* Play Again (Primary) */}
          <button
            onClick={() => router.push("/lobby")}
            className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all duration-200 transform hover:-translate-y-0.5 active:translate-y-0 border border-indigo-400/30 text-sm sm:text-base"
          >
            <RotateCcw className="w-5 h-5" />
            <span>Play Again</span>
          </button>

          <div className="grid grid-cols-2 gap-3">
            {/* View History (Secondary) */}
            <button
              onClick={() => router.push("/history")}
              className="w-full bg-slate-800/80 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl border border-slate-700 flex items-center justify-center gap-2 transition-all duration-200 text-xs sm:text-sm shadow-md"
            >
              <History className="w-4 h-4 text-slate-400" />
              <span>View History</span>
            </button>

            {/* Leaderboard (Ghost) */}
            <button
              onClick={() => router.push("/leaderboard")}
              className="w-full bg-transparent hover:bg-slate-800/60 text-slate-300 hover:text-white font-semibold py-3 px-4 rounded-xl border border-slate-800/80 hover:border-slate-700 flex items-center justify-center gap-2 transition-all duration-200 text-xs sm:text-sm"
            >
              <BarChart2 className="w-4 h-4 text-indigo-400" />
              <span>Leaderboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
