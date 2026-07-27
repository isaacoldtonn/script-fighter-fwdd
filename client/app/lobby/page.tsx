"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import api from "@/lib/axios";
import NavBar from "@/components/NavBar";
import BattleArena from "@/components/BattleArena";
import { Shield, Users, Loader2, Play, QrCode as QrIcon, AlertCircle } from "lucide-react";
import { getSocket, disconnectSocket } from "@/lib/socket";

interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  profile_picture_url?: string | null;
}

interface SessionData {
  session_id: string;
  session_code: string;
  qr_url: string;
}

interface PlayerInfo {
  user_id: string;
  username: string;
  profile_picture_url?: string | null;
}

interface RoundQuestionPayload {
  round_number: number;
  code_snippet: string;
  option_1: string;
  option_2: string;
  option_3: string;
  difficulty: "easy" | "medium" | "hard";
  timestamp_ms: number;
}

interface RoundResultPayload {
  round_winner_id: string | null;
  correct_option_index: number;
  player1_answer_index: number | null;
  player2_answer_index: number | null;
  damage_dealt: number;
  player1_hp: number;
  player2_hp: number;
  explanation: string;
}

interface MatchEndPayload {
  winner_id: string;
  winner_username: string;
  player1_final_hp: number;
  player2_final_hp: number;
}

interface BattleState {
  player1Hp: number;
  player2Hp: number;
  phase: "idle" | "question" | "resolving" | "ended";
  currentQuestion: RoundQuestionPayload | null;
  roundResult: RoundResultPayload | null;
  matchWinnerId: string | null;
}

export default function LobbyPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [player1, setPlayer1] = useState<PlayerInfo | null>(null);
  const [player2, setPlayer2] = useState<PlayerInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Keyboard gate — kept separate from matchPhase (below) so the keydown
  // listener's dependency array doesn't churn on every arena render.
  const [matchStarted, setMatchStarted] = useState<boolean>(false);

  const [matchPhase, setMatchPhase] = useState<"lobby" | "playing" | "ended">("lobby");
  const [battleState, setBattleState] = useState<BattleState>({
    player1Hp: 100,
    player2Hp: 100,
    phase: "idle",
    currentQuestion: null,
    roundResult: null,
    matchWinnerId: null,
  });

  useEffect(() => {
    if (!session) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (!['a', 's', 'd', 'j', 'k', 'l'].includes(key)) return;

      event.preventDefault();

      if (!matchStarted) return;

      const keyMap: Record<string, number> = {
        'a': 1, 's': 2, 'd': 3,
        'j': 1, 'k': 2, 'l': 3,
      };

      const player = ['a', 's', 'd'].includes(key) ? 'player1' : 'player2';
      const optionIndex = keyMap[key];

      console.log(`Key: ${key} | Player: ${player} | Option: ${optionIndex}`);

      getSocket().emit('round:key_strike', {
        session_code: session.session_code,
        player,
        key,
        timestamp_ms: Date.now(),
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [matchStarted, session]);

  const handleStartMatch = () => {
    if (!session || !player1 || !player2) return;
    const socket = getSocket();
    socket.emit("session:ready", {
      session_code: session.session_code,
      session_id: session.session_id,
      player1_id: player1.user_id,
      player2_id: player2.user_id,
    });
    setMatchStarted(true);
    setMatchPhase("playing");
  };

  const handleMatchAnimationComplete = () => {
    if (!player1 || !player2 || !session || !user) return;

    // The host's browser never goes through /join, so sf_game_state was
    // never set here — /result/match requires it to be present, same as it
    // is for players. Mirror what /join does for the phone flow.
    sessionStorage.setItem(
      "sf_game_state",
      JSON.stringify({
        session_code: session.session_code,
        user_id: user.user_id,
        username: user.username,
        role: "host",
      })
    );

    sessionStorage.setItem(
      "sf_match_result",
      JSON.stringify({
        winner_id: battleState.matchWinnerId,
        winner_username:
          battleState.matchWinnerId === player1.user_id ? player1.username : player2.username,
        player1_final_hp: battleState.player1Hp,
        player2_final_hp: battleState.player2Hp,
        // The host already knows both players' identities (unlike a phone,
        // which only ever knows its own) — pass them through so /result/match
        // can show real names/avatars on both sides instead of falling back.
        player1_username: player1.username,
        player2_username: player2.username,
        player1_user_id: player1.user_id,
        player2_user_id: player2.user_id,
        player1_avatar: player1.profile_picture_url ?? null,
        player2_avatar: player2.profile_picture_url ?? null,
      })
    );

    router.push("/result/match");
  };

  useEffect(() => {
    let isMounted = true;

    const initLobby = async () => {
      try {
        // 1. Call GET /api/auth/me
        const meRes = await api.get("/api/auth/me");
        if (isMounted) {
          setUser(meRes.data);
        }

        // 2. Call POST /api/sessions
        const sessionRes = await api.post("/api/sessions");
        if (isMounted) {
          const sessionData = sessionRes.data;
          setSession(sessionData);
          setLoading(false);

          // Connect socket and join room as host
          const socket = getSocket();
          const joinPayload = {
            session_code: sessionData.session_code,
            user_id: meRes.data.user_id,
            username: meRes.data.username,
            role: "host",
          };

          socket.on("session:player_joined", async ({ user_id, username, role }: { user_id: string; username: string; role: string }) => {
            console.log("[lobby/page.tsx] session:player_joined listener fired! Payload:", { user_id, username, role });
            if (role !== "player1" && role !== "player2") return;

            let profile_picture_url: string | null = null;
            try {
              const profRes = await api.get(`/api/users/${user_id}/public-profile`);
              profile_picture_url = profRes.data.profile_picture_url || null;
            } catch {
              // Avatar is a nice-to-have for the arena HUD — UserAvatar falls
              // back to initials if this fetch fails.
            }
            if (!isMounted) return;

            const playerInfo: PlayerInfo = { user_id, username, profile_picture_url };
            if (role === "player1") {
              setPlayer1(playerInfo);
            } else {
              setPlayer2(playerInfo);
            }
          });

          socket.on("round:question", (data: RoundQuestionPayload) => {
            if (!isMounted) return;
            setBattleState((prev) => ({
              ...prev,
              phase: "question",
              currentQuestion: data,
              roundResult: null,
            }));
          });

          socket.on("round:result", (data: RoundResultPayload) => {
            if (!isMounted) return;
            setBattleState((prev) => ({
              ...prev,
              phase: "resolving",
              player1Hp: data.player1_hp,
              player2Hp: data.player2_hp,
              roundResult: data,
            }));
            // Enough time for the attack animation + a brief pause before the
            // next question overlay slides up.
            setTimeout(() => {
              if (!isMounted) return;
              setBattleState((prev) => ({ ...prev, phase: "idle", roundResult: null }));
            }, 4000);
          });

          socket.on("match:end", (data: MatchEndPayload) => {
            if (!isMounted) return;
            setMatchPhase("ended");
            setBattleState((prev) => ({
              ...prev,
              phase: "ended",
              matchWinnerId: data.winner_id,
            }));
          });

          if (socket.connected) {
            socket.emit("session:join", joinPayload);
          } else {
            socket.on("connect", () => {
              socket.emit("session:join", joinPayload);
            });
          }
        }
      } catch (err: any) {
        if (err.response && err.response.status === 401) {
          router.push("/login");
        } else {
          if (isMounted) {
            setError("Failed to create session. Please make sure you are logged in and try again.");
            setLoading(false);
          }
        }
      }
    };

    initLobby();

    return () => {
      isMounted = false;
      const socket = getSocket();
      socket.off("session:player_joined");
      socket.off("round:question");
      socket.off("round:result");
      socket.off("match:end");
      disconnectSocket();
    };
  }, [router]);

  if (loading) {
    return (
      <>
        <NavBar currentUser={user} />
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4 pt-16">
          <div className="flex flex-col items-center gap-4 text-indigo-400 animate-pulse">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
            <p className="text-lg font-semibold text-white tracking-wide">Creating match lobby...</p>
          </div>
        </div>
      </>
    );
  }

  if (error || !session || !user) {
    return (
      <>
        <NavBar currentUser={user} />
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4 pt-16">
          <div className="max-w-md w-full bg-slate-900/80 border border-red-500/30 rounded-2xl p-8 text-center backdrop-blur-xl shadow-2xl">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Lobby Error</h2>
            <p className="text-slate-400 text-sm mb-6">{error || "Could not initialize lobby session."}</p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-indigo-500/25"
            >
              Retry
            </button>
          </div>
        </div>
      </>
    );
  }

  // Full-screen battle arena replaces the lobby UI entirely once the host
  // starts the match — no NavBar here, this is the shared arcade-cabinet
  // display, not a normal app page.
  if ((matchPhase === "playing" || matchPhase === "ended") && player1 && player2) {
    return (
      <BattleArena
        player1={{
          user_id: player1.user_id,
          username: player1.username,
          hp: battleState.player1Hp,
          profile_picture_url: player1.profile_picture_url,
        }}
        player2={{
          user_id: player2.user_id,
          username: player2.username,
          hp: battleState.player2Hp,
          profile_picture_url: player2.profile_picture_url,
        }}
        phase={battleState.phase}
        currentQuestion={battleState.currentQuestion}
        roundResult={battleState.roundResult}
        matchWinnerId={battleState.matchWinnerId}
        player1Id={player1.user_id}
        player2Id={player2.user_id}
        onMatchAnimationComplete={handleMatchAnimationComplete}
      />
    );
  }

  return (
    <>
    <NavBar currentUser={user} />
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white pt-16">
      {/* Background glow effects */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top bar */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
              Script Fighter
            </span>
            <span className="hidden sm:inline text-xs font-semibold uppercase tracking-widest text-indigo-400 ml-2.5 px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
              Arcade Edition
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-sm">
            <span className="text-slate-400">Host:</span>
            <span className="font-bold text-white">{user.username}</span>
          </div>
          <span className="px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-indigo-500/20">
            Host
          </span>
        </div>
      </header>

      {/* Main Content Centered */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <QrIcon className="w-3.5 h-3.5" />
            <span>Live Match Lobby</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
            Scan to Join
          </h1>
          <p className="text-slate-400 text-sm md:text-base mt-2">
            Players can scan this QR code with their camera to enter the arena
          </p>
        </div>

        {/* QR Code Container */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center max-w-md w-full mb-8 relative group hover:border-slate-700 transition-all duration-300">
          <div className="p-5 bg-white rounded-2xl shadow-xl mb-6 transform transition-transform duration-300 group-hover:scale-105">
            <QRCode
              value={session.qr_url}
              size={200}
              bgColor="#FFFFFF"
              fgColor="#000000"
            />
          </div>

          <div className="w-full text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-2">
              Session Code
            </p>
            <div className="font-mono text-3xl font-extrabold tracking-widest text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 rounded-xl py-3 px-6 shadow-inner inline-block w-full">
              {session.session_code}
            </div>
            <p className="text-slate-500 text-xs mt-3 font-medium">
              Or enter this code manually on your phone
            </p>
          </div>
        </div>

        {/* Players Panel */}
        <div className="w-full max-w-2xl bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-md mb-8">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>Players Joined ({(player1 ? 1 : 0) + (player2 ? 1 : 0)}/2)</span>
            </div>
            {(player1 && player2) ? (
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Ready to Start!
              </span>
            ) : (
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                Waiting for players…
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* P1 Slot */}
            <div className={`flex items-center gap-3.5 p-4 rounded-xl border transition-all duration-300 ${player1 ? 'bg-indigo-950/50 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/10' : 'bg-slate-950/50 border-slate-800/80 border-dashed text-slate-400'}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold font-mono ${player1 ? 'bg-indigo-500 text-white shadow-md' : 'bg-slate-900 border border-slate-800 text-slate-500'}`}>
                P1
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${player1 ? 'text-white' : 'text-slate-400'}`}>
                  {player1 ? player1.username : 'Waiting…'}
                </p>
                <p className={`text-xs ${player1 ? 'text-indigo-300 font-semibold' : 'text-slate-600'}`}>
                  {player1 ? 'Player 1 Joined' : 'Player 1 Slot'}
                </p>
              </div>
            </div>

            {/* P2 Slot */}
            <div className={`flex items-center gap-3.5 p-4 rounded-xl border transition-all duration-300 ${player2 ? 'bg-purple-950/50 border-purple-500/50 text-white shadow-lg shadow-purple-500/10' : 'bg-slate-950/50 border-slate-800/80 border-dashed text-slate-400'}`}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold font-mono ${player2 ? 'bg-purple-500 text-white shadow-md' : 'bg-slate-900 border border-slate-800 text-slate-500'}`}>
                P2
              </div>
              <div className="flex-1">
                <p className={`text-sm font-bold ${player2 ? 'text-white' : 'text-slate-400'}`}>
                  {player2 ? player2.username : 'Waiting…'}
                </p>
                <p className={`text-xs ${player2 ? 'text-purple-300 font-semibold' : 'text-slate-600'}`}>
                  {player2 ? 'Player 2 Joined' : 'Player 2 Slot'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Start Match Button */}
        <div className="w-full max-w-2xl">
          <button
            onClick={handleStartMatch}
            disabled={!(player1 && player2)}
            className={`w-full py-4 px-6 rounded-2xl font-bold flex items-center justify-center gap-2.5 transition-all duration-200 ${
              (player1 && player2)
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-xl shadow-indigo-500/25 cursor-pointer transform hover:-translate-y-0.5'
                : 'text-slate-500 bg-slate-800/50 border border-slate-700/50 cursor-not-allowed shadow-none'
            }`}
          >
            <Play className={`w-5 h-5 ${(player1 && player2) ? 'text-white fill-current' : 'text-slate-600'}`} />
            <span>{(player1 && player2) ? 'Start Match' : 'Waiting for players…'}</span>
          </button>
        </div>
      </main>
    </div>
    </>
  );
}
