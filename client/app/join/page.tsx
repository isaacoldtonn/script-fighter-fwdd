"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { Shield, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Radio } from "lucide-react";
import { getSocket, disconnectSocket } from "@/lib/socket";

interface UserProfile {
  user_id: string;
  username: string;
  email: string;
}

interface SessionData {
  session_id: string;
  session_code: string;
  status: string;
  host_user_id: string;
}

function JoinContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const router = useRouter();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [assignedRole, setAssignedRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const joinSession = async () => {
      if (!token) {
        if (isMounted) {
          setError("This session is not available. Ask the host to create a new lobby.");
          setLoading(false);
        }
        return;
      }

      try {
        const meRes = await api.get("/api/auth/me");
        if (isMounted) {
          setUser(meRes.data);
        }

        const sessionRes = await api.get(`/api/sessions/${token}`);
        if (isMounted) {
          const sessionData = sessionRes.data;
          setSession(sessionData);
          setLoading(false);

          // Stash for the game screens further down the flow
          if (typeof window !== "undefined" && window.sessionStorage) {
            sessionStorage.setItem("session_id", sessionData.session_id);
            sessionStorage.setItem("session_code", sessionData.session_code);
            sessionStorage.setItem("user_id", meRes.data.user_id);
          }

          // Connect socket and emit session:join (without hardcoded role)
          const socket = getSocket();
          const joinPayload = {
            session_code: sessionData.session_code,
            user_id: meRes.data.user_id,
            username: meRes.data.username,
          };

          socket.on("session:player_joined", (data: { user_id: string; username: string; role: string }) => {
            if (data.user_id === meRes.data.user_id) {
              setAssignedRole(data.role);
              const gameState = {
                session_code: sessionData.session_code,
                user_id: meRes.data.user_id,
                username: meRes.data.username,
                role: data.role,
              };
              if (typeof window !== "undefined" && window.sessionStorage) {
                sessionStorage.setItem("sf_game_state", JSON.stringify(gameState));
              }
              router.push("/hud");
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
          sessionStorage.setItem("sf_redirect_after_login", window.location.href);
          router.push("/login");
        } else {
          if (isMounted) {
            setError("This session is not available. Ask the host to create a new lobby.");
            setLoading(false);
          }
        }
      }
    };

    joinSession();

    return () => {
      isMounted = false;
      const socket = getSocket();
      socket.off("session:player_joined");
      disconnectSocket();
    };
  }, [token, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Loader2 className="w-10 h-10 animate-spin text-sf-orange mb-4" />
        <h2 className="font-heading font-800 text-lg uppercase tracking-wide text-sf-black mb-1">
          Connecting to Arena...
        </h2>
        <p className="font-body text-gray-500 text-sm">Validating QR token and session status</p>
      </div>
    );
  }

  if (error || !session || !user) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-sf-red mx-auto mb-4" />
        <h2 className="font-heading font-800 text-xl uppercase tracking-wide text-sf-black mb-2">
          Join Failed
        </h2>
        <p className="font-body text-gray-600 text-sm leading-relaxed max-w-sm mx-auto mb-6">
          {error || "This session is not available. Ask the host to create a new lobby."}
        </p>
        <Link href="/login" className="sf-btn-ghost w-full">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 text-center">
      {/* Title */}
      <div className="sf-badge sf-badge-orange inline-flex items-center gap-1.5 mb-6">
        <Shield className="w-3.5 h-3.5" />
        <span>Script Fighter</span>
      </div>

      <div className="w-16 h-16 border-2 border-sf-orange flex items-center justify-center mx-auto mb-6 text-sf-orange">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <h1 className="font-heading font-900 text-3xl uppercase tracking-tight text-sf-black mb-2">
        Welcome, {user.username}!
      </h1>

      <p className="font-body text-gray-500 text-sm mb-6">You have connected to the battle arena</p>

      {/* Joined Session Badge */}
      <div className="bg-white border-2 border-sf-black p-4 mb-8 w-full max-w-xs mx-auto">
        <p className="font-body text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
          Joined Session
        </p>
        <p className="font-heading font-900 text-2xl text-sf-black tracking-[0.2em]">
          {session.session_code}
        </p>
      </div>

      {/* Role and Key Controls Display */}
      {assignedRole ? (
        <div className="border-2 border-sf-gray-border mb-6 overflow-hidden">
          <div
            className={`font-heading font-800 text-sm uppercase tracking-widest text-white py-2 ${
              assignedRole === "player1" ? "bg-blue-600" : "bg-red-600"
            }`}
          >
            {assignedRole === "player1" ? "Player 1" : "Player 2"}
          </div>
          <div className="p-5 flex flex-col items-center gap-3">
            <h2 className="font-heading font-800 text-base sm:text-lg text-sf-black tracking-wide">
              {assignedRole === "player1" ? "Keys: A / S / D" : "Keys: J / K / L"}
            </h2>
            <div className="flex items-center justify-center gap-3 my-1">
              {(assignedRole === "player1" ? ["A", "S", "D"] : ["J", "K", "L"]).map((key) => (
                <div
                  key={key}
                  className="w-12 h-12 border-2 border-sf-black font-heading font-900 text-xl text-sf-black flex items-center justify-center"
                >
                  {key}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Large Status Message with Animated Pulsing Indicator */}
      <div className="sf-card p-6">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-12 h-12 rounded-full bg-sf-orange/20 animate-ping" />
            <span className="relative w-10 h-10 rounded-full border-2 border-sf-orange flex items-center justify-center text-sf-orange">
              <Radio className="w-5 h-5 animate-pulse" />
            </span>
          </div>
          <p className="font-heading font-700 text-base uppercase tracking-wide text-sf-black mt-1">
            Waiting for the host to start the match…
          </p>
          <p className="font-body text-xs text-gray-500">
            Keep this screen open on your phone. The match will begin automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen sf-bg flex flex-col justify-center items-center p-4 relative overflow-hidden">
      <div className="sf-watermark" style={{ top: "6%", left: "4%" }}>
        JOIN
      </div>

      {/* Centered Card */}
      <div className="w-full max-w-md sf-card relative z-10">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-sf-orange mb-4" />
              <h2 className="font-heading font-800 text-lg uppercase tracking-wide text-sf-black mb-1">
                Loading Session...
              </h2>
            </div>
          }
        >
          <JoinContent />
        </Suspense>
      </div>
    </div>
  );
}
