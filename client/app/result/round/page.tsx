"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shield, Loader2, CheckCircle2, XCircle, HelpCircle, Clock, User, Swords, Sparkles } from "lucide-react";

interface GameState {
  session_code: string;
  user_id: string;
  username: string;
  role: string;
}

interface RoundResultData {
  round_winner_id: string | null;
  correct_option_index: number;
  damage_dealt?: number;
  player1_hp: number;
  player2_hp: number;
  explanation: string;
  player1_answer_index: number | null;
  player2_answer_index: number | null;
  code_snippet?: string;
  option_1?: string;
  option_2?: string;
  option_3?: string;
  difficulty?: string;
  round_number?: number;
  player1_response_ms?: number | null;
  player2_response_ms?: number | null;
}

export default function RoundResultPage() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResultData | null>(null);
  const [countdown, setCountdown] = useState<number>(5);

  useEffect(() => {
    let isMounted = true;

    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }

    const storedResult = sessionStorage.getItem("sf_round_result");
    const storedState = sessionStorage.getItem("sf_game_state");

    if (!storedResult || !storedState) {
      router.push("/login");
      return;
    }

    try {
      const parsedResult: RoundResultData = JSON.parse(storedResult);
      const parsedState: GameState = JSON.parse(storedState);

      if (isMounted) {
        setRoundResult(parsedResult);
        setGameState(parsedState);
      }
    } catch (e) {
      router.push("/login");
      return;
    }

    // Start 5-second countdown to redirect to /hud
    const timer = setInterval(() => {
      if (isMounted) {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    const redirectTimeout = setTimeout(() => {
      if (isMounted) {
        router.push("/hud");
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      clearTimeout(redirectTimeout);
    };
  }, [router]);

  if (!gameState || !roundResult) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-pulse">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-400 font-medium">Loading Round Result...</p>
      </div>
    );
  }

  const isPlayer1 = gameState.role === "player1";
  const myHp = isPlayer1 ? roundResult.player1_hp : roundResult.player2_hp;
  const opponentHp = isPlayer1 ? roundResult.player2_hp : roundResult.player1_hp;

  const myAnswerIndex = isPlayer1 ? roundResult.player1_answer_index : roundResult.player2_answer_index;
  const opponentAnswerIndex = isPlayer1 ? roundResult.player2_answer_index : roundResult.player1_answer_index;

  const formatTime = (ms: number | null | undefined) => {
    if (!ms) return "No answer";
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const bothCorrect =
    roundResult.player1_answer_index !== null &&
    roundResult.player1_answer_index !== undefined &&
    roundResult.player2_answer_index !== null &&
    roundResult.player2_answer_index !== undefined &&
    roundResult.player1_answer_index === roundResult.correct_option_index &&
    roundResult.player2_answer_index === roundResult.correct_option_index;

  const myResponseMs = isPlayer1 ? roundResult.player1_response_ms : roundResult.player2_response_ms;
  const opponentResponseMs = isPlayer1 ? roundResult.player2_response_ms : roundResult.player1_response_ms;
  const iWasRoundWinner = roundResult.round_winner_id === gameState.user_id;

  const options = [
    roundResult.option_1 || "Option 1",
    roundResult.option_2 || "Option 2",
    roundResult.option_3 || "Option 3",
  ];

  const getOptionText = (idx: number | null | undefined) => {
    if (idx === null || idx === undefined || idx < 0 || idx >= options.length) {
      return null;
    }
    return options[idx];
  };

  const myAnswerText = getOptionText(myAnswerIndex);
  const opponentAnswerText = getOptionText(opponentAnswerIndex);
  const correctAnswerText = getOptionText(roundResult.correct_option_index) || "Unknown Option";

  const isMyAnswerCorrect = myAnswerIndex !== null && myAnswerIndex !== undefined && myAnswerIndex === roundResult.correct_option_index;
  const isOpponentAnswerCorrect = opponentAnswerIndex !== null && opponentAnswerIndex !== undefined && opponentAnswerIndex === roundResult.correct_option_index;

  const getDifficultyColor = (diff?: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
      case "medium":
        return "bg-amber-500/10 border-amber-500/30 text-amber-400";
      case "hard":
        return "bg-rose-500/10 border-rose-500/30 text-rose-400";
      default:
        return "bg-indigo-500/10 border-indigo-500/30 text-indigo-400";
    }
  };

  const renderAnswerStatus = (text: string | null, isCorrect: boolean) => {
    if (text === null) {
      return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-400">
          <span className="text-xs sm:text-sm font-mono italic">No answer</span>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <HelpCircle className="w-4 h-4" />
            <span>Timed out</span>
          </div>
        </div>
      );
    }

    if (isCorrect) {
      return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/60 text-emerald-200 shadow-lg shadow-emerald-500/5">
          <span className="text-xs sm:text-sm font-mono font-bold truncate pr-2">{text}</span>
          <div className="flex items-center gap-1.5 text-xs font-extrabold text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>Correct!</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-3 rounded-xl bg-rose-950/50 border border-rose-500/60 text-rose-200 shadow-lg shadow-rose-500/5">
        <span className="text-xs sm:text-sm font-mono font-medium truncate pr-2 line-through opacity-80">{text}</span>
        <div className="flex items-center gap-1.5 text-xs font-extrabold text-rose-400 shrink-0">
          <XCircle className="w-4 h-4" />
          <span>Wrong</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 selection:bg-indigo-500 selection:text-white max-w-md mx-auto w-full relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Content Scrollable Area */}
      <div className="flex-1 flex flex-col z-10 animate-fade-in space-y-4 my-auto py-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-extrabold uppercase tracking-wider shadow-sm">
              Round {roundResult.round_number || 1} Result
            </span>
          </div>
          <span className={`px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest ${getDifficultyColor(roundResult.difficulty)}`}>
            {roundResult.difficulty || "MEDIUM"}
          </span>
        </div>

        {/* Code Block */}
        {roundResult.code_snippet && (
          <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-4 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60" />
            <pre className="font-mono text-xs sm:text-sm text-indigo-100 leading-relaxed overflow-x-auto whitespace-pre-wrap break-words py-1">
              <code>{roundResult.code_snippet}</code>
            </pre>
          </div>
        )}

        {/* Answers Comparison */}
        <div className="space-y-3">
          {/* Your Answer */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <span>Your Answer</span>
            </label>
            {renderAnswerStatus(myAnswerText, isMyAnswerCorrect)}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-400 text-xs">⏱ Response time:</span>
              <span className="text-white text-xs font-mono">{formatTime(myResponseMs)}</span>
              {bothCorrect && iWasRoundWinner && (
                <span className="text-yellow-400 text-xs font-bold">⚡ Faster!</span>
              )}
            </div>
          </div>

          {/* Opponent's Answer */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-purple-400" />
              <span>Opponent&apos;s Answer</span>
            </label>
            {renderAnswerStatus(opponentAnswerText, isOpponentAnswerCorrect)}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-400 text-xs">⏱ Response time:</span>
              <span className="text-white text-xs font-mono">{formatTime(opponentResponseMs)}</span>
              {bothCorrect && !iWasRoundWinner && (
                <span className="text-yellow-400 text-xs font-bold">⚡ Faster!</span>
              )}
            </div>
          </div>

          {/* Correct Answer Reveal */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Correct Answer</span>
            </label>
            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500 text-emerald-300 font-mono text-xs sm:text-sm font-bold shadow-md flex items-center justify-between">
              <span>{correctAnswerText}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
            </div>
          </div>

          {bothCorrect && (
            <div className="text-center text-xs text-yellow-400 mt-3 bg-yellow-400/10 rounded-lg px-3 py-2">
              ⚡ Both answered correctly — faster response wins the round
            </div>
          )}
        </div>

        {/* Explanation Box */}
        {roundResult.explanation && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-300 leading-relaxed shadow-inner">
            <span className="font-bold text-indigo-300 uppercase tracking-wider block mb-1 text-[10px]">
              Explanation
            </span>
            <p className="text-slate-300">{roundResult.explanation}</p>
          </div>
        )}

        {/* HP Update Row */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md shadow-xl mt-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Your HP */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300 truncate">Your HP:</span>
                <span className="font-mono text-emerald-400 font-extrabold">{Math.max(0, myHp)}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, myHp))}%` }}
                />
              </div>
            </div>

            {/* Right: Opponent HP */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300 truncate">Opponent HP:</span>
                <span className="font-mono text-rose-400 font-extrabold">{Math.max(0, opponentHp)}</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, opponentHp))}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown Footer */}
      <div className="z-10 pt-4 border-t border-slate-800/80 mt-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-2">
          <div className="flex items-center gap-1.5 text-indigo-300">
            <Clock className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
            <span>Next round in {countdown}…</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Auto-returning</span>
        </div>
        <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800/60">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
