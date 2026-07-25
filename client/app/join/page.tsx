"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { Shield, Loader2, CheckCircle2, AlertCircle, ArrowLeft, Radio } from "lucide-react";

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
        // 1. Call GET /api/auth/me (Player must be logged in)
        const meRes = await api.get("/api/auth/me");
        if (isMounted) {
          setUser(meRes.data);
        }

        // 2. Call GET /api/sessions/${token}
        const sessionRes = await api.get(`/api/sessions/${token}`);
        if (isMounted) {
          const sessionData = sessionRes.data;
          setSession(sessionData);
          setLoading(false);

          // Store session_id and session_code in sessionStorage for use in Slice 3
          if (typeof window !== "undefined" && window.sessionStorage) {
            sessionStorage.setItem("session_id", sessionData.session_id);
            sessionStorage.setItem("session_code", sessionData.session_code);
          }
        }
      } catch (err: any) {
        if (err.response && err.response.status === 401) {
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
    };
  }, [token, router]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center animate-pulse">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
        <h2 className="text-lg font-bold text-white mb-1">Connecting to Arena...</h2>
        <p className="text-slate-400 text-sm">Validating QR token and session status</p>
      </div>
    );
  }

  if (error || !session || !user) {
    return (
      <div className="p-8 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-5 text-red-400">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Join Failed</h2>
        <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-sm mx-auto mb-8">
          {error || "This session is not available. Ask the host to create a new lobby."}
        </p>
        <Link
          href="/login"
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3.5 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 border border-slate-700 shadow-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Go Back to Login</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-8 text-center animate-fade-in">
      {/* Title */}
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6 backdrop-blur-md">
        <Shield className="w-3.5 h-3.5" />
        <span>Script Fighter</span>
      </div>

      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-lg shadow-emerald-500/10">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-white mb-2">
        Welcome, {user.username}!
      </h1>

      <p className="text-slate-400 text-sm mb-6">You have connected to the battle arena</p>

      {/* Joined Session Badge */}
      <div className="bg-slate-950/80 border border-indigo-500/30 rounded-2xl p-4 mb-8 inline-block w-full max-w-xs shadow-inner">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Joined Session
        </p>
        <p className="font-mono text-2xl font-black text-indigo-300 tracking-wider">
          {session.session_code}
        </p>
      </div>

      {/* Large Status Message with Animated Pulsing Indicator */}
      <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-2xl p-6 relative overflow-hidden">
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-12 h-12 rounded-full bg-indigo-500/20 animate-ping" />
            <span className="relative w-10 h-10 rounded-full bg-indigo-500/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </span>
          </div>
          <p className="text-base font-bold text-indigo-200 mt-1">
            Waiting for the host to start the match…
          </p>
          <p className="text-xs text-slate-400">
            Keep this screen open on your phone. The match will begin automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Centered Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-3xl shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300">
        <Suspense
          fallback={
            <div className="flex flex-col items-center justify-center p-12 text-center animate-pulse">
              <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
              <h2 className="text-lg font-bold text-white mb-1">Loading Session...</h2>
            </div>
          }
        >
          <JoinContent />
        </Suspense>
      </div>
    </div>
  );
}
