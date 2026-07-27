"use client";

import React, { useEffect, useRef, useState } from "react";
import SpriteAnimator from "./SpriteAnimator";
import HPBar from "./HPBar";

interface Fighter {
  user_id: string;
  username: string;
  hp: number;
  profile_picture_url?: string | null;
}

interface CurrentQuestion {
  round_number: number;
  code_snippet: string;
  option_1: string;
  option_2: string;
  option_3: string;
  difficulty: "easy" | "medium" | "hard";
}

interface RoundResult {
  round_winner_id: string | null;
  correct_option_index: number;
  player1_answer_index: number | null;
  player2_answer_index: number | null;
  damage_dealt: number;
  player1_hp: number;
  player2_hp: number;
  explanation: string;
}

interface BattleArenaProps {
  player1: Fighter;
  player2: Fighter;
  phase: "idle" | "question" | "resolving" | "ended";
  currentQuestion: CurrentQuestion | null;
  roundResult: RoundResult | null;
  matchWinnerId: string | null;
  player1Id: string;
  player2Id: string;
  onMatchAnimationComplete: () => void;
}

type AnimState = "idle" | "attack" | "fainted";

export default function BattleArena({
  player1,
  player2,
  phase,
  currentQuestion,
  roundResult,
  matchWinnerId,
  player1Id,
  player2Id,
  onMatchAnimationComplete,
}: BattleArenaProps) {
  const [ryu, setRyu] = useState<AnimState>("idle");
  const [geki, setGeki] = useState<AnimState>("idle");
  const [screenShake, setScreenShake] = useState(false);
  const [hitFlash, setHitFlash] = useState<"ryu" | "geki" | null>(null);
  const [showKO, setShowKO] = useState(false);

  const hitFlashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const koTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effect 1 — react to a round resolving
  useEffect(() => {
    if (!roundResult) return;

    const { round_winner_id } = roundResult;

    if (round_winner_id === player1Id) {
      setRyu("attack");
      setHitFlash("geki");
    } else if (round_winner_id === player2Id) {
      setGeki("attack");
      setHitFlash("ryu");
    }
    // A draw (round_winner_id === null) means no damage was dealt — nothing
    // to animate, both fighters stay idle.

    if (round_winner_id) {
      setScreenShake(true);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      // The animate-screen-shake CSS animation only replays when its class is
      // re-applied; a boolean that's simply left `true` would only ever play
      // once since the class name never changes again.
      shakeTimeoutRef.current = setTimeout(() => setScreenShake(false), 500);
    }

    if (hitFlashTimeoutRef.current) clearTimeout(hitFlashTimeoutRef.current);
    hitFlashTimeoutRef.current = setTimeout(() => setHitFlash(null), 600);

    return () => {
      if (hitFlashTimeoutRef.current) clearTimeout(hitFlashTimeoutRef.current);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundResult]);

  // Effect 2 — react to the match ending
  useEffect(() => {
    if (!matchWinnerId) return;

    if (matchWinnerId === player1Id) {
      setGeki("fainted");
    } else {
      setRyu("fainted");
    }

    return () => {
      if (koTimeoutRef.current) clearTimeout(koTimeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchWinnerId]);

  useEffect(() => {
    return () => {
      if (hitFlashTimeoutRef.current) clearTimeout(hitFlashTimeoutRef.current);
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (koTimeoutRef.current) clearTimeout(koTimeoutRef.current);
    };
  }, []);

  const handleFaintComplete = () => {
    setShowKO(true);
    koTimeoutRef.current = setTimeout(onMatchAnimationComplete, 2000);
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Arena background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/sprites/arena-bg.jpg')" }}
      />

      {/* Dark overlay to make sprites pop */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Screen shake wrapper */}
      <div className={`absolute inset-0 ${screenShake ? "animate-screen-shake" : ""}`}>
        {/* TOP HUD — HP bars */}
        <div className="absolute top-0 left-0 right-0 z-20 p-4">
          <div className="flex items-center gap-4 max-w-4xl mx-auto">
            <div className="flex-1">
              <HPBar
                username={player1.username}
                hp={player1.hp}
                maxHp={100}
                side="left"
                profilePictureUrl={player1.profile_picture_url}
              />
            </div>

            <div className="flex flex-col items-center flex-shrink-0">
              <span className="text-yellow-400 font-black text-xl border-2 border-yellow-400 px-3 py-1 tracking-widest">
                VS
              </span>
            </div>

            <div className="flex-1">
              <HPBar
                username={player2.username}
                hp={player2.hp}
                maxHp={100}
                side="right"
                profilePictureUrl={player2.profile_picture_url}
              />
            </div>
          </div>
        </div>

        {/* CHARACTERS — positioned on ground plane */}
        <div className="absolute bottom-48 left-0 right-0 flex justify-between items-end px-16 md:px-32">
          {/* Ryu — Player 1 — left side */}
          <div className="relative">
            {hitFlash === "ryu" && (
              <div className="absolute inset-0 bg-red-500/70 animate-hit-flash z-10 pointer-events-none" />
            )}
            <SpriteAnimator
              src="/sprites/ryu-idle.png"
              frameCount={6}
              frameWidth={77}
              frameHeight={93}
              fps={8}
              loop={true}
              playing={ryu === "idle"}
              scale={2.5}
              flipped={false}
              className={ryu !== "idle" ? "hidden" : ""}
            />
            <SpriteAnimator
              src="/sprites/ryu-attack.png"
              frameCount={10}
              frameWidth={112}
              frameHeight={95}
              fps={12}
              loop={false}
              playing={ryu === "attack"}
              scale={2.5}
              flipped={false}
              onComplete={() => setRyu("idle")}
              className={ryu !== "attack" ? "hidden" : ""}
            />
            <SpriteAnimator
              src="/sprites/ryu-fainted.png"
              frameCount={5}
              frameWidth={130}
              frameHeight={70}
              fps={8}
              loop={false}
              playing={ryu === "fainted"}
              scale={2.5}
              flipped={false}
              onComplete={handleFaintComplete}
              className={ryu !== "fainted" ? "hidden" : ""}
            />
          </div>

          {/* Geki — Player 2 — right side */}
          <div className="relative">
            {hitFlash === "geki" && (
              <div className="absolute inset-0 bg-red-500/70 animate-hit-flash z-10 pointer-events-none" />
            )}
            <SpriteAnimator
              src="/sprites/geki-idle.png"
              frameCount={5}
              frameWidth={84}
              frameHeight={102}
              fps={8}
              loop={true}
              playing={geki === "idle"}
              scale={2.5}
              flipped={true}
              className={geki !== "idle" ? "hidden" : ""}
            />
            <SpriteAnimator
              src="/sprites/geki-attack.png"
              frameCount={10}
              frameWidth={112}
              frameHeight={98}
              fps={12}
              loop={false}
              playing={geki === "attack"}
              scale={2.5}
              flipped={true}
              onComplete={() => setGeki("idle")}
              className={geki !== "attack" ? "hidden" : ""}
            />
            <SpriteAnimator
              src="/sprites/geki-fainted.png"
              frameCount={6}
              frameWidth={118}
              frameHeight={93}
              fps={8}
              loop={false}
              playing={geki === "fainted"}
              scale={2.5}
              flipped={true}
              onComplete={handleFaintComplete}
              className={geki !== "fainted" ? "hidden" : ""}
            />
          </div>
        </div>

        {/* KO TEXT */}
        {showKO && (
          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div
              className="text-8xl md:text-9xl font-black tracking-widest animate-ko-appear"
              style={{
                color: "#FFD700",
                textShadow: "0 0 30px #FF6600, 0 0 60px #FF2200, 4px 4px 0 #000",
                fontFamily: "Impact, Arial Black, sans-serif",
              }}
            >
              K.O.
            </div>
          </div>
        )}

        {/* QUESTION OVERLAY — slides up from bottom when phase is 'question' */}
        <div
          className={`absolute bottom-0 left-0 right-0 z-20 transition-transform duration-500 ease-out ${
            phase === "question" ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="bg-black/85 backdrop-blur-sm border-t-2 border-yellow-400/50 px-6 py-4">
            {currentQuestion && (
              <>
                {/* Round info */}
                <div className="flex justify-between items-center mb-3">
                  <span className="text-yellow-400 font-bold text-sm tracking-widest uppercase">
                    Round {currentQuestion.round_number}
                  </span>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-widest ${
                      currentQuestion.difficulty === "easy"
                        ? "bg-green-600/50 text-green-300"
                        : currentQuestion.difficulty === "medium"
                        ? "bg-yellow-600/50 text-yellow-300"
                        : "bg-red-600/50 text-red-300"
                    }`}
                  >
                    {currentQuestion.difficulty}
                  </span>
                </div>

                {/* Code snippet */}
                <pre className="bg-gray-900/80 border border-gray-600 rounded p-3 text-green-400 text-sm font-mono mb-4 overflow-x-auto whitespace-pre-wrap">
                  {currentQuestion.code_snippet}
                </pre>

                {/* Answer options — Player 1 left, Player 2 right */}
                <div className="flex gap-4">
                  {/* Player 1 options */}
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-2 uppercase tracking-widest">
                      {player1.username} (A / S / D)
                    </div>
                    <div className="flex flex-col gap-1">
                      {[
                        { key: "A", option: currentQuestion.option_1 },
                        { key: "S", option: currentQuestion.option_2 },
                        { key: "D", option: currentQuestion.option_3 },
                      ].map(({ key, option }) => (
                        <div
                          key={key}
                          className="flex items-center gap-2 bg-blue-900/40 border border-blue-500/30 rounded px-2 py-1"
                        >
                          <span className="bg-blue-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded flex-shrink-0">
                            {key}
                          </span>
                          <span className="text-white text-xs">{option}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px bg-gray-600" />

                  {/* Player 2 options */}
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-2 uppercase tracking-widest text-right">
                      {player2.username} (J / K / L)
                    </div>
                    <div className="flex flex-col gap-1">
                      {[
                        { key: "J", option: currentQuestion.option_1 },
                        { key: "K", option: currentQuestion.option_2 },
                        { key: "L", option: currentQuestion.option_3 },
                      ].map(({ key, option }) => (
                        <div
                          key={key}
                          className="flex items-center gap-2 bg-red-900/40 border border-red-500/30 rounded px-2 py-1 flex-row-reverse"
                        >
                          <span className="bg-red-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded flex-shrink-0">
                            {key}
                          </span>
                          <span className="text-white text-xs text-right">{option}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
