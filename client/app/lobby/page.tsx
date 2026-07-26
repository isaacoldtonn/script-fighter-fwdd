"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import api from "@/lib/axios";
import { Shield, Users, Loader2, Play, QrCode as QrIcon, AlertCircle } from "lucide-react";
import { getSocket, disconnectSocket } from "@/lib/socket";

interface UserProfile {
  user_id: string;
  username: string;
  email: string;
}

interface SessionData {
  session_id: string;
  session_code: string;
  qr_url: string;
}

export default function LobbyPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [player1, setPlayer1] = useState<{ username: string; user_id: string } | null>(null);
  const [player2, setPlayer2] = useState<{ username: string; user_id: string } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Slice 5 Live Game & Keyboard Controller States
  const [matchStarted, setMatchStarted] = useState<boolean>(false);
  const [p1Hp, setP1Hp] = useState<number>(100);
  const [p2Hp, setP2Hp] = useState<number>(100);
  const [roundNumber, setRoundNumber] = useState<number>(1);
  const [matchEnded, setMatchEnded] = useState<boolean>(false);
  const [winnerUsername, setWinnerUsername] = useState<string | null>(null);

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

          socket.on("session:player_joined", ({ user_id, username, role }: { user_id: string; username: string; role: string }) => {
            console.log("[lobby/page.tsx] session:player_joined listener fired! Payload:", { user_id, username, role });
            if (role === "player1") {
              setPlayer1({ username, user_id });
            } else if (role === "player2") {
              setPlayer2({ username, user_id });
            }
          });

          socket.on("round:question", (data: { round_number: number }) => {
            if (isMounted) setRoundNumber(data.round_number || 1);
          });

          socket.on("round:result", (data: { player1_hp: number; player2_hp: number }) => {
            if (isMounted) {
              setP1Hp(data.player1_hp);
              setP2Hp(data.player2_hp);
            }
          });

          socket.on("match:end", (data: { winner_username: string }) => {
            if (isMounted) {
              setMatchEnded(true);
              setWinnerUsername(data.winner_username || "Unknown");
            }
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
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-4 text-indigo-400 animate-pulse">
          <Loader2 className="w-12 h-12 animate-spin text-indigo-500" />
          <p className="text-lg font-semibold text-white tracking-wide">Creating match lobby...</p>
        </div>
      </div>
    );
  }

  if (error || !session || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4">
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
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col selection:bg-indigo-500 selection:text-white">
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
        {matchStarted ? (
          <div className="w-full max-w-4xl bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl backdrop-blur-xl flex flex-col items-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider mb-4">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              <span>{matchEnded ? "Match Ended!" : "Live Battle Arena"}</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-2">
              {matchEnded ? (winnerUsername ? `Winner: ${winnerUsername}!` : "Match Over!") : "Match In Progress"}
            </h1>
            <p className="text-slate-400 text-sm mb-8">
              {matchEnded ? "Check mobile devices for final results." : "Players are answering on their mobile devices and shared keyboard."}
            </p>

            {/* Round Badge */}
            {!matchEnded && (
              <div className="mb-8 px-6 py-2.5 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-200 font-mono font-extrabold text-xl shadow-lg shadow-indigo-500/10">
                Round {roundNumber}
              </div>
            )}

            {/* Player HP Bars Container */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mb-8">
              {/* P1 Card */}
              <div className="bg-slate-950/80 border border-indigo-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-500" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-indigo-500 text-white">P1</span>
                    <span className="font-bold text-white text-lg truncate max-w-[150px]">{player1?.username || "Player 1"}</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-extrabold text-lg">{Math.max(0, p1Hp)} HP</span>
                </div>
                <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.min(100, Math.max(0, p1Hp))}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Keys: A / S / D</span>
                  <span>{p1Hp <= 0 ? "ELIMINATED" : "ACTIVE"}</span>
                </div>
              </div>

              {/* P2 Card */}
              <div className="bg-slate-950/80 border border-purple-500/40 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-purple-500" />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-500 text-white">P2</span>
                    <span className="font-bold text-white text-lg truncate max-w-[150px]">{player2?.username || "Player 2"}</span>
                  </div>
                  <span className="font-mono text-rose-400 font-extrabold text-lg">{Math.max(0, p2Hp)} HP</span>
                </div>
                <div className="w-full h-4 bg-slate-900 rounded-full overflow-hidden border border-slate-800 p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-rose-600 to-rose-400 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${Math.min(100, Math.max(0, p2Hp))}%` }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500 font-mono">
                  <span>Keys: J / K / L</span>
                  <span>{p2Hp <= 0 ? "ELIMINATED" : "ACTIVE"}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              Arcade Cabinet Display • Session <span className="font-mono text-slate-400">{session.session_code}</span>
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </main>
    </div>
  );
}
