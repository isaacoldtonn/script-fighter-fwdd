"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { Loader2, CheckCircle2, XCircle, HelpCircle, Clock, User, Swords, Sparkles } from "lucide-react";

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

  // Safety net: the server starts the next round on its own 5s timer, independent
  // of this page's countdown. If round:question (or match:end) arrives while we're
  // still on this screen, there's no listener for it on /hud yet — stash it and
  // jump over early instead of letting the event get dropped.
  useEffect(() => {
    const socket = getSocket();

    const handleEarlyQuestion = (data: unknown) => {
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem("sf_pending_question", JSON.stringify(data));
      }
      router.push("/hud");
    };

    const handleEarlyMatchEnd = (data: unknown) => {
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem("sf_match_result", JSON.stringify(data));
      }
      router.push("/result/match");
    };

    socket.on("round:question", handleEarlyQuestion);
    socket.on("match:end", handleEarlyMatchEnd);

    return () => {
      socket.off("round:question", handleEarlyQuestion);
      socket.off("match:end", handleEarlyMatchEnd);
    };
  }, [router]);

  if (!gameState || !roundResult) {
    return (
      <div className="min-h-screen sf-bg flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-sf-orange mb-4" />
        <p className="font-heading font-700 uppercase tracking-widest text-sf-black">
          Loading Round Result...
        </p>
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
    if (idx === null || idx === undefined || idx < 1 || idx > options.length) {
      return null;
    }
    return options[idx - 1];
  };

  const myAnswerText = getOptionText(myAnswerIndex);
  const opponentAnswerText = getOptionText(opponentAnswerIndex);
  const correctAnswerText = getOptionText(roundResult.correct_option_index) || "Unknown Option";

  const isMyAnswerCorrect = myAnswerIndex !== null && myAnswerIndex !== undefined && myAnswerIndex === roundResult.correct_option_index;
  const isOpponentAnswerCorrect = opponentAnswerIndex !== null && opponentAnswerIndex !== undefined && opponentAnswerIndex === roundResult.correct_option_index;

  const getDifficultyBadge = (diff?: string) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "sf-badge-teal";
      case "medium":
        return "sf-badge-orange";
      case "hard":
        return "sf-badge-red";
      default:
        return "sf-badge-black";
    }
  };

  const renderAnswerStatus = (text: string | null, isCorrect: boolean) => {
    if (text === null) {
      return (
        <div className="flex items-center justify-between p-3 bg-gray-50 border-2 border-sf-gray-border text-gray-500">
          <span className="text-xs sm:text-sm font-mono italic">No answer</span>
          <div className="flex items-center gap-1.5 text-xs font-heading font-700 text-gray-400">
            <HelpCircle className="w-4 h-4" />
            <span>Timed out</span>
          </div>
        </div>
      );
    }

    if (isCorrect) {
      return (
        <div className="flex items-center justify-between p-3 bg-emerald-50 border-2 border-emerald-600 text-emerald-800">
          <span className="text-xs sm:text-sm font-mono font-bold truncate pr-2">{text}</span>
          <div className="flex items-center gap-1.5 text-xs font-heading font-800 text-emerald-600 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>Correct!</span>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-between p-3 bg-red-50 border-2 border-sf-red text-sf-red">
        <span className="text-xs sm:text-sm font-mono font-medium truncate pr-2 line-through opacity-70">{text}</span>
        <div className="flex items-center gap-1.5 text-xs font-heading font-800 text-sf-red shrink-0">
          <XCircle className="w-4 h-4" />
          <span>Wrong</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen sf-bg flex flex-col justify-between p-4 sm:p-6 max-w-md mx-auto w-full relative overflow-hidden">
      {/* Main Content Scrollable Area */}
      <div className="flex-1 flex flex-col z-10 space-y-4 my-auto py-2">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="sf-badge sf-badge-black">Round {roundResult.round_number || 1} Result</span>
          <span className={`sf-badge ${getDifficultyBadge(roundResult.difficulty)}`}>
            {roundResult.difficulty || "MEDIUM"}
          </span>
        </div>

        {/* Code Block */}
        {roundResult.code_snippet && (
          <div className="sf-code-panel p-4">
            <pre className="font-mono text-xs sm:text-sm text-sf-orange-lite leading-relaxed overflow-x-auto whitespace-pre-wrap break-words py-1">
              <code>{roundResult.code_snippet}</code>
            </pre>
          </div>
        )}

        {/* Answers Comparison */}
        <div className="space-y-3">
          {/* Your Answer */}
          <div>
            <label className="block text-[11px] font-heading font-700 uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-sf-orange" />
              <span>Your Answer</span>
            </label>
            {renderAnswerStatus(myAnswerText, isMyAnswerCorrect)}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500 text-xs font-body">⏱ Response time:</span>
              <span className="text-sf-black text-xs font-mono">{formatTime(myResponseMs)}</span>
              {bothCorrect && iWasRoundWinner && (
                <span className="text-sf-orange text-xs font-heading font-800">⚡ Faster!</span>
              )}
            </div>
          </div>

          {/* Opponent's Answer */}
          <div>
            <label className="block text-[11px] font-heading font-700 uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
              <Swords className="w-3.5 h-3.5 text-sf-red" />
              <span>Opponent&apos;s Answer</span>
            </label>
            {renderAnswerStatus(opponentAnswerText, isOpponentAnswerCorrect)}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-gray-500 text-xs font-body">⏱ Response time:</span>
              <span className="text-sf-black text-xs font-mono">{formatTime(opponentResponseMs)}</span>
              {bothCorrect && !iWasRoundWinner && (
                <span className="text-sf-orange text-xs font-heading font-800">⚡ Faster!</span>
              )}
            </div>
          </div>

          {/* Correct Answer Reveal */}
          <div>
            <label className="block text-[11px] font-heading font-700 uppercase tracking-wider text-emerald-600 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Correct Answer</span>
            </label>
            <div className="p-3 bg-emerald-50 border-2 border-emerald-600 text-emerald-800 font-mono text-xs sm:text-sm font-bold flex items-center justify-between">
              <span>{correctAnswerText}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />
            </div>
          </div>

          {bothCorrect && (
            <div className="text-center text-xs font-body text-sf-black mt-3 bg-sf-orange/10 border border-sf-orange px-3 py-2">
              ⚡ Both answered correctly — faster response wins the round
            </div>
          )}
        </div>

        {/* Explanation Box */}
        {roundResult.explanation && (
          <div className="sf-card p-3.5">
            <span className="font-heading font-800 text-sf-orange uppercase tracking-wider block mb-1 text-[10px]">
              Explanation
            </span>
            <p className="text-gray-700 text-xs font-body leading-relaxed">{roundResult.explanation}</p>
          </div>
        )}

        {/* HP Update Row */}
        <div className="sf-card p-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            {/* Left: Your HP */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-heading font-700">
                <span className="text-gray-600 truncate">Your HP:</span>
                <span className="font-mono text-emerald-600 font-extrabold">{Math.max(0, myHp)}</span>
              </div>
              <div className="sf-hp-bar">
                <div className="sf-hp-fill" style={{ width: `${Math.min(100, Math.max(0, myHp))}%` }} />
              </div>
            </div>

            {/* Right: Opponent HP */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-heading font-700">
                <span className="text-gray-600 truncate">Opponent HP:</span>
                <span className="font-mono text-sf-red font-extrabold">{Math.max(0, opponentHp)}</span>
              </div>
              <div className="sf-hp-bar">
                <div className="sf-hp-fill-red" style={{ width: `${Math.min(100, Math.max(0, opponentHp))}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Countdown Footer */}
      <div className="z-10 pt-4 border-t-2 border-sf-gray-border mt-2">
        <div className="flex items-center justify-between text-xs font-heading font-700 text-gray-500 mb-2">
          <div className="flex items-center gap-1.5 text-sf-orange">
            <Clock className="w-3.5 h-3.5 animate-pulse" />
            <span>Next round in {countdown}…</span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">Auto-returning</span>
        </div>
        <div className="w-full h-1.5 bg-gray-200 border border-sf-gray-border overflow-hidden">
          <div
            className="h-full sf-gradient transition-all duration-1000 ease-linear"
            style={{ width: `${(countdown / 5) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
