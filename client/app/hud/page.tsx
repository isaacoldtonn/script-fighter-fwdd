"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { Shield, Loader2, Radio, User, Swords, Clock } from "lucide-react";

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
      <div className="min-h-screen sf-bg flex flex-col items-center justify-center p-6 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-sf-orange mb-4" />
        <p className="font-heading font-700 uppercase tracking-widest text-sf-black">Loading HUD...</p>
      </div>
    );
  }

  const isPlayer1 = gameState.role === "player1";
  const keyHints = isPlayer1 ? ["A", "S", "D"] : ["J", "K", "L"];

  // Helper for difficulty badge coloring
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

  return (
    <div className="min-h-screen sf-bg flex flex-col justify-between p-4 sm:p-6 selection:bg-sf-orange selection:text-white max-w-md mx-auto w-full relative overflow-hidden">
      {/* PHASE: WAITING */}
      {phase === "waiting" && (
        isReconnecting ? (
          <div className="flex-1 flex items-center justify-center min-h-screen z-10">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-sf-orange mx-auto mb-4" />
              <p className="font-heading font-700 uppercase tracking-widest text-sf-black">
                Loading next round...
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center z-10">
            <div className="sf-badge sf-badge-orange inline-flex items-center gap-1.5 mb-6">
              <Shield className="w-3.5 h-3.5" />
              <span>Script Fighter Arena</span>
            </div>

            <div className="relative flex items-center justify-center mb-6">
              <span className="absolute w-16 h-16 rounded-full bg-sf-orange/20 animate-ping" />
              <span className="relative w-12 h-12 rounded-full border-2 border-sf-orange flex items-center justify-center text-sf-orange">
                <Radio className="w-6 h-6 animate-pulse" />
              </span>
            </div>

            <h1 className="font-heading font-900 text-3xl uppercase tracking-tight text-sf-black mb-2">
              Script Fighter
            </h1>
            <p className="font-heading font-700 text-lg text-sf-black mb-2">
              Waiting for host to start…
            </p>
            <p className="font-body text-gray-500 text-xs max-w-xs leading-relaxed">
              You are connected as <span className="text-sf-black font-bold">{gameState.username}</span> ({isPlayer1 ? "Player 1" : "Player 2"}). Keep this screen open!
            </p>

            <div className="mt-8 bg-white border-2 border-sf-black px-4 py-2 font-heading text-xs text-gray-500">
              Session: <span className="text-sf-orange font-bold">{gameState.session_code}</span>
            </div>
          </div>
        )
      )}

      {/* PHASE: QUESTION OR ANSWERED */}
      {(phase === "question" || phase === "answered") && (
        <div className="flex-1 flex flex-col justify-between z-10 gap-4">
          {/* Top Section: HP Bars */}
          <div className="sf-card p-4 space-y-3">
            {/* Row 1: Your HP (Green Bar) */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <div className="flex items-center gap-1.5 text-sf-black">
                  <div className="w-5 h-5 border-2 border-sf-black flex items-center justify-center text-sf-black">
                    <User className="w-3 h-3" />
                  </div>
                  <span className="font-heading truncate max-w-[150px]">{gameState.username} (You)</span>
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-heading text-white ${
                      isPlayer1 ? "bg-blue-600" : "bg-red-600"
                    }`}
                  >
                    {isPlayer1 ? "P1" : "P2"}
                  </span>
                </div>
                <span className="font-mono text-emerald-600 font-extrabold text-sm">
                  {Math.max(0, myHp)} HP
                </span>
              </div>
              <div className="sf-hp-bar">
                <div className="sf-hp-fill" style={{ width: `${Math.min(100, Math.max(0, myHp))}%` }} />
              </div>
            </div>

            {/* Row 2: Opponent HP (Red Bar) */}
            <div>
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <div className="w-5 h-5 border-2 border-sf-gray-border flex items-center justify-center text-sf-red">
                    <Swords className="w-3 h-3" />
                  </div>
                  <span className="font-heading">Opponent</span>
                  <span
                    className={`px-1.5 py-0.2 text-[10px] font-heading text-white ${
                      isPlayer1 ? "bg-red-600" : "bg-blue-600"
                    }`}
                  >
                    {isPlayer1 ? "P2" : "P1"}
                  </span>
                </div>
                <span className="font-mono text-sf-red font-extrabold text-sm">
                  {Math.max(0, opponentHp)} HP
                </span>
              </div>
              <div className="sf-hp-bar">
                <div className="sf-hp-fill-red" style={{ width: `${Math.min(100, Math.max(0, opponentHp))}%` }} />
              </div>
            </div>
          </div>

          {/* Middle Section: Question */}
          <div className="flex-1 flex flex-col justify-center my-2">
            <div className="flex items-center justify-between mb-3">
              <span className="sf-badge sf-badge-black">Round {question?.round_number || 1}</span>
              <span className={`sf-badge ${getDifficultyBadge(question?.difficulty)}`}>
                {question?.difficulty || "EASY"}
              </span>
            </div>

            {/* Code Block */}
            <div className="sf-code-panel p-4">
              <pre className="font-mono text-xs sm:text-sm text-sf-orange-lite leading-relaxed overflow-x-auto whitespace-pre-wrap break-words py-2">
                <code>{question?.code_snippet || "Loading snippet..."}</code>
              </pre>
            </div>
          </div>

          {/* Bottom Section: Answers & Processing Overlay */}
          <div className="relative">
            {/* Processing / Countdown Overlay for Answered Phase */}
            {phase === "answered" && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center z-20 border-2 border-sf-black p-4 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-sf-orange mb-2" />
                <p className="font-heading font-800 text-sf-black text-sm uppercase tracking-wider mb-1">
                  Processing…
                </p>
                <div className="flex items-center gap-1.5 text-sf-orange text-xs font-bold border-2 border-sf-orange px-3 py-1.5 mt-2">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
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
                    className="w-full bg-white border-2 border-sf-black p-3 flex items-center gap-3.5 select-none"
                  >
                    <div className="w-8 h-8 sf-gradient text-white font-heading font-900 text-sm flex items-center justify-center shrink-0">
                      {keyHints[idx]}
                    </div>
                    <span className="font-mono text-xs sm:text-sm font-semibold text-sf-black truncate">
                      {opt || `Option ${idx + 1}`}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-center text-[11px] font-heading font-700 uppercase tracking-wider text-gray-500 pt-1">
                Press your key on the shared keyboard to answer
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
