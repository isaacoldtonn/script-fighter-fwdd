"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import api from "@/lib/axios";
import NavBar from "@/components/NavBar";
import BattleArena from "@/components/BattleArena";
import UserAvatar from "@/components/UserAvatar";
import { Loader2, AlertCircle } from "lucide-react";
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
        const meRes = await api.get("/api/auth/me");
        if (isMounted) {
          setUser(meRes.data);
        }

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
        <div className="min-h-screen sf-bg flex flex-col justify-center items-center p-4 pt-14 md:pt-16">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-sf-orange" />
            <p className="font-heading font-700 uppercase tracking-widest text-sf-black">
              Creating match lobby...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (error || !session || !user) {
    return (
      <>
        <NavBar currentUser={user} />
        <div className="min-h-screen sf-bg flex flex-col justify-center items-center p-4 pt-14 md:pt-16">
          <div className="max-w-md w-full sf-card p-8 text-center">
            <AlertCircle className="w-12 h-12 text-sf-red mx-auto mb-4" />
            <h2 className="font-heading font-800 text-xl uppercase tracking-wide text-sf-black mb-2">
              Lobby Error
            </h2>
            <p className="font-body text-gray-600 text-sm mb-6">
              {error || "Could not initialize lobby session."}
            </p>
            <button onClick={() => window.location.reload()} className="sf-btn-primary w-full">
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
        currentQuestion={battleState.currentQuestion}
        roundResult={battleState.roundResult}
        matchWinnerId={battleState.matchWinnerId}
        player1Id={player1.user_id}
        player2Id={player2.user_id}
        onMatchAnimationComplete={handleMatchAnimationComplete}
      />
    );
  }

  const playersReady = (player1 ? 1 : 0) + (player2 ? 1 : 0);

  return (
    <>
    <NavBar currentUser={user} />
    <div className="sf-bg min-h-screen relative overflow-hidden pt-14 md:pt-16">
      {/* Watermark */}
      <div className="sf-watermark" style={{ top: "5%", right: "2%" }}>
        LOBBY
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Section heading */}
        <div className="mb-8">
          <span className="sf-badge sf-badge-black mb-3 block w-fit">Host Mode</span>
          <h1 className="sf-section-title">Game Lobby</h1>
        </div>

        {/* Two column: QR on left, players on right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* QR code card */}
          <div className="sf-card p-6">
            <div className="font-heading font-700 text-xs uppercase tracking-widest text-gray-500 mb-4">
              Scan to Join
            </div>
            <div className="bg-white border-4 border-sf-black p-4 w-fit mx-auto mb-4">
              <QRCode value={session.qr_url} size={180} bgColor="#FFFFFF" fgColor="#000000" />
            </div>
            <div className="text-center">
              <div className="font-body text-xs text-gray-500 uppercase tracking-widest mb-1">
                Session Code
              </div>
              <div className="font-heading font-900 text-4xl tracking-[0.3em] text-sf-black">
                {session.session_code}
              </div>
              <p className="font-body text-xs text-gray-400 mt-3">
                Or enter this code manually on your phone
              </p>
            </div>
          </div>

          {/* Players card */}
          <div className="sf-card p-6">
            <div className="font-heading font-700 text-xs uppercase tracking-widest text-gray-500 mb-4">
              Players ({playersReady}/2)
            </div>
            <div className="space-y-3 mb-6">
              {/* P1 Slot */}
              <div className="flex items-center gap-3 border-2 border-sf-gray-border p-3">
                <span className="bg-blue-600 text-white font-heading font-700 text-xs px-2 py-1 flex-shrink-0">
                  P1
                </span>
                {player1 ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <UserAvatar username={player1.username} profile_picture_url={player1.profile_picture_url} size="sm" />
                    <span className="font-heading font-700 text-sm tracking-wide text-sf-black truncate">
                      {player1.username}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 font-body whitespace-nowrap">
                      Keys: A / S / D
                    </span>
                  </div>
                ) : (
                  <span className="font-body text-sm text-gray-400 italic animate-pulse">
                    Waiting for player...
                  </span>
                )}
              </div>

              {/* P2 Slot */}
              <div className="flex items-center gap-3 border-2 border-sf-gray-border p-3">
                <span className="bg-red-600 text-white font-heading font-700 text-xs px-2 py-1 flex-shrink-0">
                  P2
                </span>
                {player2 ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <UserAvatar username={player2.username} profile_picture_url={player2.profile_picture_url} size="sm" />
                    <span className="font-heading font-700 text-sm tracking-wide text-sf-black truncate">
                      {player2.username}
                    </span>
                    <span className="ml-auto text-xs text-gray-400 font-body whitespace-nowrap">
                      Keys: J / K / L
                    </span>
                  </div>
                ) : (
                  <span className="font-body text-sm text-gray-400 italic animate-pulse">
                    Waiting for player...
                  </span>
                )}
              </div>
            </div>

            {/* Start button */}
            <button
              onClick={handleStartMatch}
              disabled={playersReady < 2}
              className={`w-full py-3 font-heading font-800 text-sm uppercase tracking-[0.15em] transition-all ${
                playersReady >= 2 ? "sf-btn-primary" : "bg-gray-200 text-gray-400 cursor-not-allowed"
              }`}
            >
              {playersReady < 2 ? "Waiting for players..." : "Start Match ▶"}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
