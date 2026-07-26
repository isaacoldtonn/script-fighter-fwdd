"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { Shield, Loader2, Radio, User, Swords, AlertCircle, Clock } from "lucide-react";

interface GameState {
  session_code: string;
  user_id: string;
  username: string;
  role: string;
}

interface QuestionData {
  round_number: number;
  code_snippet: string;
  option_1: string;
  option_2: string;
  option_3: string;
  difficulty: string;
  timestamp_ms: number;
}

interface RoundResultData {
  round_winner_id: string | null;
  correct_option_index: number;
  damage_dealt: number;
  player1_hp: number;
  player2_hp: number;
  explanation: string;
  player1_answer_index: number;
  player2_answer_index: number;
  player1_response_ms?: number | null;
  player2_response_ms?: number | null;
}

export default function HudPage() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myHp, setMyHp] = useState<number>(100);
  const [opponentHp, setOpponentHp] = useState<number>(100);
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [phase, setPhase] = useState<"waiting" | "question" | "answered">("waiting");
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  const [roundResult, setRoundResult] = useState<RoundResultData | null>(null);
  const [countdown, setCountdown] = useState<number>(5);
  const [currentRoundNumber, setCurrentRoundNumber] = useState<number>(1);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(() => {
    if (typeof window !== "undefined" && window.sessionStorage) {
      return !!sessionStorage.getItem("sf_round_result");
    }
    return false;
  });
  const questionRef = useRef<QuestionData | null>(null);
  const currentRoundNumberRef = useRef<number>(1);

  useEffect(() => {
    let isMounted = true;

    if (typeof window === "undefined" || !window.sessionStorage) {
      return;
    }

    const storedState = sessionStorage.getItem("sf_game_state");
    if (!storedState) {
      router.push("/login");
      return;
    }

    let parsedState: GameState;
    try {
      parsedState = JSON.parse(storedState);
      if (isMounted) {
        setGameState(parsedState);
      }
    } catch (e) {
      router.push("/login");
      return;
    }

    const { session_code, user_id, username, role } = parsedState;
    const socket = getSocket();

    // If /result/round already caught the next round's question (or the match
    // ending) before we mounted, apply it immediately instead of waiting on a
    // live socket event that has already fired and won't fire again.
    const pendingQuestionRaw = sessionStorage.getItem("sf_pending_question");
    if (pendingQuestionRaw) {
      sessionStorage.removeItem("sf_pending_question");
      try {
        const pendingQuestion: QuestionData = JSON.parse(pendingQuestionRaw);
        questionRef.current = pendingQuestion;
        currentRoundNumberRef.current = pendingQuestion.round_number;
        setIsReconnecting(false);
        setQuestion(pendingQuestion);
        setCurrentRoundNumber(pendingQuestion.round_number);
        setPhase("question");
        setRoundStartTime(pendingQuestion.timestamp_ms || Date.now());
        setRoundResult(null);
      } catch (e) {
        // fall through to normal socket-driven flow
      }
    }

    const joinPayload = { session_code, user_id, username, role };
    if (socket.connected) {
      socket.emit("session:join", joinPayload);
    } else {
      socket.on("connect", () => {
        socket.emit("session:join", joinPayload);
      });
    }

    // Listener: round:question
    const handleQuestion = (data: QuestionData) => {
      if (!isMounted) return;
      setIsReconnecting(false);
      questionRef.current = data;
      currentRoundNumberRef.current = data.round_number;
      setQuestion(data);
      setCurrentRoundNumber(data.round_number);
      setPhase("question");
      setRoundStartTime(data.timestamp_ms || Date.now());
      setRoundResult(null);
    };

    // Listener: round:result
    const handleResult = (data: RoundResultData) => {
      if (!isMounted) return;
      setRoundResult(data);
      setPhase("answered");

      if (role === "player1") {
        setMyHp(data.player1_hp);
        setOpponentHp(data.player2_hp);
      } else if (role === "player2") {
        setMyHp(data.player2_hp);
        setOpponentHp(data.player1_hp);
      }

      if (typeof window !== "undefined" && window.sessionStorage) {
        const currentQuestion = questionRef.current;
        const mergedResult = {
          ...data,
          round_number: currentRoundNumberRef.current || currentQuestion?.round_number || 1,
          code_snippet: currentQuestion?.code_snippet || "",
          option_1: currentQuestion?.option_1 || "",
          option_2: currentQuestion?.option_2 || "",
          option_3: currentQuestion?.option_3 || "",
          difficulty: currentQuestion?.difficulty || "MEDIUM",
        };
        sessionStorage.setItem("sf_round_result", JSON.stringify(mergedResult));
      }

      if (isMounted) {
        router.push("/result/round");
      }
    };

    // Listener: match:end
    const handleMatchEnd = (data: any) => {
      if (!isMounted) return;
      if (typeof window !== "undefined" && window.sessionStorage) {
        sessionStorage.setItem("sf_match_result", JSON.stringify(data));
      }
      router.push("/result/match");
    };

    socket.on("round:question", handleQuestion);
    socket.on("round:result", handleResult);
    socket.on("match:end", handleMatchEnd);

    return () => {
      isMounted = false;
      socket.off("round:question", handleQuestion);
      socket.off("round:result", handleResult);
      socket.off("match:end", handleMatchEnd);
    };
  }, [router]);

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center animate-pulse">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-4" />
        <p className="text-slate-400 font-medium">Loading HUD...</p>
      </div>
    );
  }

  const isPlayer1 = gameState.role === "player1";
  const keyHints = isPlayer1 ? ["A", "S", "D"] : ["J", "K", "L"];

  // Helper for difficulty badge coloring
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white flex flex-col justify-between p-4 sm:p-6 selection:bg-indigo-500 selection:text-white max-w-md mx-auto w-full relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* PHASE: WAITING */}
      {phase === "waiting" && (
        isReconnecting ? (
          <div className="flex-1 flex items-center justify-center min-h-screen z-10 animate-fade-in">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4" />
              <p className="text-gray-400">Loading next round...</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center animate-fade-in z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold mb-6 uppercase tracking-wider shadow-sm">
              <Shield className="w-4 h-4" />
              <span>Script Fighter Arena</span>
            </div>

            <div className="relative flex items-center justify-center mb-6">
              <span className="absolute w-16 h-16 rounded-full bg-indigo-500/20 animate-ping" />
              <span className="relative w-12 h-12 rounded-full bg-indigo-500/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/20">
                <Radio className="w-6 h-6 animate-pulse" />
              </span>
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
              Script Fighter
            </h1>
            <p className="text-indigo-200 font-bold text-lg mb-2">
              Waiting for host to start…
            </p>
            <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
              You are connected as <span className="text-white font-bold">{gameState.username}</span> ({isPlayer1 ? "Player 1" : "Player 2"}). Keep this screen open!
            </p>

            <div className="mt-8 px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-xs text-slate-400">
              Session: <span className="text-indigo-400 font-bold">{gameState.session_code}</span>
            </div>
          </div>
        )
      )}

      {/* PHASE: QUESTION OR ANSWERED */}
      {(phase === "question" || phase === "answered") && (
        <div className="flex-1 flex flex-col justify-between z-10 animate-fade-in gap-4">
          {/* Top Section: HP Bars */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-md shadow-xl space-y-3">
            {/* Row 1: Your HP (Green Bar) */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <div className="flex items-center gap-1.5 text-white">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="truncate max-w-[150px]">{gameState.username} (You)</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 font-mono">
                    {isPlayer1 ? "P1" : "P2"}
                  </span>
                </div>
                <span className="font-mono text-emerald-400 font-extrabold text-sm">
                  {Math.max(0, myHp)} HP
                </span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(0, myHp))}%` }}
                />
              </div>
            </div>

            {/* Row 2: Opponent HP (Red Bar) */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                    <Swords className="w-3 h-3" />
                  </div>
                  <span>Opponent</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400 font-mono">
                    {isPlayer1 ? "P2" : "P1"}
                  </span>
                </div>
                <span className="font-mono text-rose-400 font-extrabold text-sm">
                  {Math.max(0, opponentHp)} HP
                </span>
              </div>
              <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500 shadow-sm"
                  style={{ width: `${Math.min(100, Math.max(0, opponentHp))}%` }}
                />
              </div>
            </div>
          </div>

          {/* Middle Section: Question */}
          <div className="flex-1 flex flex-col justify-center my-2">
            <div className="flex items-center justify-between mb-3">
              <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-extrabold uppercase tracking-wider shadow-sm">
                Round {question?.round_number || 1}
              </span>
              <span className={`px-2.5 py-1 rounded-full border text-[10px] font-extrabold uppercase tracking-widest ${getDifficultyColor(question?.difficulty)}`}>
                {question?.difficulty || "EASY"}
              </span>
            </div>

            {/* Code Block */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-4 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-60" />
              <pre className="font-mono text-xs sm:text-sm text-indigo-100 leading-relaxed overflow-x-auto whitespace-pre-wrap break-words py-2">
                <code>{question?.code_snippet || "Loading snippet..."}</code>
              </pre>
            </div>
          </div>

          {/* Bottom Section: Answers & Processing Overlay */}
          <div className="relative">
            {/* Processing / Countdown Overlay for Answered Phase */}
            {phase === "answered" && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center z-20 border border-indigo-500/30 p-4 text-center animate-fade-in shadow-2xl">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                <p className="text-white font-extrabold text-sm uppercase tracking-wider mb-1">
                  Processing…
                </p>
                <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-bold bg-indigo-950/80 border border-indigo-500/40 px-3 py-1.5 rounded-full mt-2">
                  <Clock className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                  <span>Showing result in {countdown}…</span>
                </div>
              </div>
            )}

            {/* Answers Grid */}
            <div className={`space-y-3 transition-opacity duration-300 ${phase === "answered" ? "opacity-30 pointer-events-none" : ""}`}>
              <div className="grid grid-cols-1 gap-2.5">
                {[question?.option_1, question?.option_2, question?.option_3].map((opt, idx) => (
                  <div
                    key={idx}
                    className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-3 flex items-center gap-3.5 select-none shadow-md"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-indigo-800 text-white font-mono font-black text-sm flex items-center justify-center shadow-inner border border-indigo-400/30 shrink-0">
                      {keyHints[idx]}
                    </div>
                    <span className="font-mono text-xs sm:text-sm font-semibold text-slate-200 truncate">
                      {opt || `Option ${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-1">
                Press your key on the shared keyboard to answer
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
