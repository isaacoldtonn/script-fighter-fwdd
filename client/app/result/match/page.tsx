"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { disconnectSocket, getSocket } from "@/lib/socket";
import SpriteAnimator from "@/components/SpriteAnimator";
import UserAvatar from "@/components/UserAvatar";
import { Trophy, Skull } from "lucide-react";

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
  // Only present when the redirect came from the host's lobby, which already
  // knows both players' identities. A player's phone (hud.tsx) only ever
  // sends the fields above — this page falls back gracefully without them.
  player1_username?: string;
  player2_username?: string;
  player1_user_id?: string;
  player2_user_id?: string;
  player1_avatar?: string | null;
  player2_avatar?: string | null;
}

const MENU_ITEMS = [
  { label: "Rematch", action: "rematch" },
  { label: "Leaderboard", action: "leaderboard" },
  { label: "History", action: "history" },
  { label: "Back to Main", action: "home" },
] as const;

export default function MatchResultPage() {
  const router = useRouter();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResultData | null>(null);
  const [selectedMenu, setSelectedMenu] = useState(0);
  const selectedMenuRef = useRef(0);

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

  const handleMenuAction = (action: string) => {
    if (action === "rematch") {
      if (gameState) {
        // No server-side listener for this yet — harmless no-op emit that's
        // forward-compatible with a future "implement rematch" slice.
        getSocket().emit("rematch:request", { session_code: gameState.session_code });
      }
      router.push("/lobby");
    } else if (action === "leaderboard") {
      router.push("/leaderboard");
    } else if (action === "history") {
      router.push("/history");
    } else if (action === "home") {
      router.push("/home");
    }
  };

  // Keyboard nav re-attaches once gameState resolves (a single, one-time
  // transition from null), then reads the latest selection via a ref so
  // Enter doesn't act on a stale closure — same pattern as /lobby's
  // matchStartedRef documented in CLAUDE.md.
  useEffect(() => {
    selectedMenuRef.current = selectedMenu;
  }, [selectedMenu]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedMenu((prev) => (prev - 1 + MENU_ITEMS.length) % MENU_ITEMS.length);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedMenu((prev) => (prev + 1) % MENU_ITEMS.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleMenuAction(MENU_ITEMS[selectedMenuRef.current].action);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  if (!gameState || !matchResult) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white/60 text-sm uppercase tracking-widest">Loading result...</div>
      </div>
    );
  }

  const isHost = gameState.role === "host";
  const iAmPlayer1 = gameState.role === "player1";
  const iAmPlayer2 = gameState.role === "player2";

  const player1Username = matchResult.player1_username || (iAmPlayer1 ? gameState.username : "Player 1");
  const player2Username = matchResult.player2_username || (iAmPlayer2 ? gameState.username : "Player 2");
  const player1Avatar = matchResult.player1_avatar ?? null;
  const player2Avatar = matchResult.player2_avatar ?? null;

  const player1UserId = matchResult.player1_user_id || (iAmPlayer1 ? gameState.user_id : undefined);
  const player2UserId = matchResult.player2_user_id || (iAmPlayer2 ? gameState.user_id : undefined);

  const player1IsWinner = player1UserId
    ? matchResult.winner_id === player1UserId
    : player2UserId
    ? matchResult.winner_id !== player2UserId
    : matchResult.winner_username === player1Username;

  const player1Xp = player1IsWinner ? 120 : 40;
  const player2Xp = player1IsWinner ? 40 : 120;

  // Phones (player1/player2) get the SF light arcade theme, matching the rest
  // of the mobile flow (/join, /hud, /result/round). The host's shared
  // arcade-cabinet screen below stays in its own neon fighting-game finale —
  // it's a different surface (keyboard-nav menu, full-screen sprite reveal),
  // not a "page of the website" a player is browsing on their phone.
  if (!isHost) {
    const iWon = iAmPlayer1 ? player1IsWinner : !player1IsWinner;
    const myXp = iAmPlayer1 ? player1Xp : player2Xp;
    const opponentXp = iAmPlayer1 ? player2Xp : player1Xp;
    const myUsername = iAmPlayer1 ? player1Username : player2Username;
    const opponentUsername = iAmPlayer1 ? player2Username : player1Username;
    const myAvatar = iAmPlayer1 ? player1Avatar : player2Avatar;
    const opponentAvatar = iAmPlayer1 ? player2Avatar : player1Avatar;
    const myFinalHp = iAmPlayer1 ? matchResult.player1_final_hp : matchResult.player2_final_hp;
    const opponentFinalHp = iAmPlayer1 ? matchResult.player2_final_hp : matchResult.player1_final_hp;

    return (
      <div className="min-h-screen sf-bg flex flex-col justify-center items-center p-4 max-w-md mx-auto w-full relative overflow-hidden">
        <div className="sf-watermark" style={{ top: "6%", left: "4%" }}>
          {iWon ? "WIN" : "LOSE"}
        </div>

        <div className="w-full sf-card p-6 relative z-10">
          {/* Outcome badge */}
          <div className={`sf-badge inline-flex items-center gap-1.5 mb-4 ${iWon ? "sf-badge-orange" : "sf-badge-black"}`}>
            {iWon ? <Trophy className="w-3.5 h-3.5" /> : <Skull className="w-3.5 h-3.5" />}
            <span>{iWon ? "Victory" : "Defeat"}</span>
          </div>

          <h1 className="font-heading font-900 text-3xl uppercase tracking-tight text-sf-black mb-1">
            {iWon ? "You Won!" : "You Lost"}
          </h1>
          <p className="font-body text-gray-500 text-sm mb-6">
            {iWon ? "Well fought — victory is yours." : "Better luck in the rematch."}
          </p>

          {/* Score row */}
          <div className="flex items-center justify-between border-2 border-sf-black p-4 mb-4">
            <div className="flex flex-col items-center gap-2">
              <UserAvatar username={myUsername} profile_picture_url={myAvatar} size="lg" />
              <span className="font-heading font-700 text-xs uppercase tracking-wide text-sf-black truncate max-w-[90px]">
                {myUsername}
              </span>
              <span className={`font-heading font-800 text-[10px] uppercase px-2 py-0.5 text-white ${iWon ? "bg-blue-600" : "bg-gray-500"}`}>
                {iWon ? "Won" : "Lost"}
              </span>
            </div>

            <div className="font-heading font-900 text-2xl text-gray-300 px-2">VS</div>

            <div className="flex flex-col items-center gap-2">
              <UserAvatar username={opponentUsername} profile_picture_url={opponentAvatar} size="lg" />
              <span className="font-heading font-700 text-xs uppercase tracking-wide text-sf-black truncate max-w-[90px]">
                {opponentUsername}
              </span>
              <span className={`font-heading font-800 text-[10px] uppercase px-2 py-0.5 text-white ${!iWon ? "bg-blue-600" : "bg-gray-500"}`}>
                {!iWon ? "Won" : "Lost"}
              </span>
            </div>
          </div>

          {/* Final HP + XP */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-heading font-700">
                <span className="text-gray-600">Your Final HP</span>
                <span className="font-mono text-emerald-600 font-extrabold">{Math.max(0, myFinalHp)}</span>
              </div>
              <div className="sf-hp-bar">
                <div className="sf-hp-fill" style={{ width: `${Math.min(100, Math.max(0, myFinalHp))}%` }} />
              </div>
              <div className="text-[11px] font-body text-gray-500">
                XP earned: <span className="text-sf-orange font-bold">+{myXp}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-heading font-700">
                <span className="text-gray-600">Opponent Final HP</span>
                <span className="font-mono text-sf-red font-extrabold">{Math.max(0, opponentFinalHp)}</span>
              </div>
              <div className="sf-hp-bar">
                <div className="sf-hp-fill-red" style={{ width: `${Math.min(100, Math.max(0, opponentFinalHp))}%` }} />
              </div>
              <div className="text-[11px] font-body text-gray-500">
                XP earned: <span className="text-sf-orange font-bold">+{opponentXp}</span>
              </div>
            </div>
          </div>

          {/* Menu */}
          <div className="flex flex-col gap-3">
            <button onClick={() => handleMenuAction("rematch")} className="sf-btn-primary w-full">
              Rematch
            </button>
            <button onClick={() => handleMenuAction("leaderboard")} className="sf-btn-ghost w-full">
              Leaderboard
            </button>
            <button onClick={() => handleMenuAction("history")} className="sf-btn-ghost w-full">
              History
            </button>
            <button onClick={() => handleMenuAction("home")} className="sf-btn-ghost w-full">
              Back to Main
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-950 overflow-hidden">
      {/* Background — blurred arena */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-sm opacity-30"
        style={{ backgroundImage: "url('/sprites/arena-bg.jpg')" }}
      />

      {/* RESULT heading — top left, neon style */}
      <div className="absolute top-8 left-8 z-20">
        <h1
          className="text-6xl md:text-8xl font-black tracking-widest"
          style={{
            color: "transparent",
            WebkitTextStroke: "2px #E040FB",
            textShadow: "0 0 20px #E040FB, 0 0 40px #9C27B0",
            fontFamily: "var(--font-heading), Impact, Arial Black, sans-serif",
          }}
        >
          RESULT
        </h1>
      </div>

      {/* Winner character sprite — centre right, large */}
      <div className="absolute right-16 bottom-32 z-10">
        <SpriteAnimator
          src={player1IsWinner ? "/sprites/ryu-idle.png" : "/sprites/geki-idle.png"}
          frameCount={player1IsWinner ? 6 : 5}
          frameWidth={player1IsWinner ? 77 : 84}
          frameHeight={player1IsWinner ? 93 : 102}
          fps={6}
          loop={true}
          playing={true}
          scale={4}
          flipped={!player1IsWinner}
        />
      </div>

      {/* Left panel — winner label + menu */}
      <div className="absolute left-8 top-40 z-20 flex flex-col gap-2">
        <div className="text-fuchsia-300/70 font-bold text-xs uppercase tracking-widest mb-1">
          Winner
        </div>
        <div className="text-white font-bold text-lg uppercase tracking-widest mb-4">
          {player1IsWinner ? player1Username : player2Username}
        </div>

        {/* Menu items */}
        {MENU_ITEMS.map((item, index) => (
          <button
            key={item.action}
            onClick={() => handleMenuAction(item.action)}
            onMouseEnter={() => setSelectedMenu(index)}
            className={`text-left px-6 py-3 font-heading font-700 uppercase tracking-widest transition-all duration-150 border-l-4 ${
              selectedMenu === index
                ? "sf-gradient text-white border-transparent pl-8"
                : "bg-transparent text-white border-transparent hover:border-sf-orange hover:bg-sf-orange/10"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Bottom bar — WON X - Y LOST with avatars */}
      <div className="absolute bottom-0 left-0 right-0 z-20 bg-black/70 border-t border-gray-700 px-8 py-4">
        {/* Score row */}
        <div className="flex items-center justify-center gap-8 mb-3">
          {/* Player 1 */}
          <div className="flex items-center gap-3">
            <UserAvatar username={player1Username} profile_picture_url={player1Avatar} size="md" />
            <span className="text-white font-bold text-sm uppercase tracking-widest">
              {player1IsWinner ? "WON" : "LOST"}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center gap-4">
            <span className="text-4xl font-black text-white">{player1IsWinner ? 1 : 0}</span>
            <span className="text-2xl text-gray-500 font-bold">-</span>
            <span className="text-4xl font-black text-white">{player1IsWinner ? 0 : 1}</span>
          </div>

          {/* Player 2 */}
          <div className="flex items-center gap-3 flex-row-reverse">
            <UserAvatar username={player2Username} profile_picture_url={player2Avatar} size="md" />
            <span className="text-white font-bold text-sm uppercase tracking-widest">
              {player1IsWinner ? "LOST" : "WON"}
            </span>
          </div>
        </div>

        {/* Stats row — XP earned + final HP per player */}
        <div className="flex justify-center gap-10 text-sm flex-wrap">
          <span className="text-gray-400">
            {player1Username} XP:{" "}
            <span className="text-yellow-400 font-bold">+{player1Xp}</span>
          </span>
          <span className="text-gray-400">
            {player2Username} XP:{" "}
            <span className="text-yellow-400 font-bold">+{player2Xp}</span>
          </span>
          <span className="text-gray-400">
            Final HP:{" "}
            <span className="text-green-400 font-bold">
              {Math.max(0, matchResult.player1_final_hp)} - {Math.max(0, matchResult.player2_final_hp)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
