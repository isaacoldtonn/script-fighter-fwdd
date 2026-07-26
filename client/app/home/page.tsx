"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import NavBar from "@/components/NavBar";
import {
  Shield,
  Swords,
  DoorOpen,
  QrCode,
  Loader2,
  ArrowRight,
  Trophy,
  AlertCircle,
} from "lucide-react";

interface CurrentUser {
  user_id: string;
  username: string;
  email: string;
  profile_picture_url?: string | null;
}

interface QuickStats {
  total_wins: number;
  total_matches: number;
  win_rate: number;
  rank: number;
}

const CODE_REGEX = /^[A-Z]{2}-\d{4}$/;

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const meRes = await api.get("/api/auth/me");
        if (!isMounted) return;
        setCurrentUser(meRes.data);

        try {
          const statsRes = await api.get(`/api/users/${meRes.data.user_id}/public-profile`);
          if (isMounted) {
            setStats({
              total_wins: statsRes.data.total_wins,
              total_matches: statsRes.data.total_matches,
              win_rate: statsRes.data.win_rate,
              rank: statsRes.data.rank,
            });
          }
        } catch {
          // Stats are a nice-to-have on this page; don't block on them.
        }
      } catch (err) {
        router.push("/login");
        return;
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase());
    setCodeError(null);
  };

  const handleJoin = async () => {
    setCodeError(null);

    if (!CODE_REGEX.test(code)) {
      setCodeError("Invalid code format. Example: ZT-6704");
      return;
    }

    setJoining(true);
    try {
      const res = await api.get(`/api/sessions/join/${code}`);
      const { qr_token } = res.data;
      router.push(`/join?token=${qr_token}`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setCodeError("Session not found. Check the code and try again.");
      } else if (err.response?.status === 400) {
        setCodeError("This session has already started or ended.");
      } else {
        setCodeError("Something went wrong. Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white selection:bg-indigo-500 selection:text-white">
      <NavBar currentUser={currentUser} />

      <main className="pt-28 pb-16 px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-4">
            <Shield className="w-4 h-4" />
            Python Control Flow Arena
          </div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
            Script Fighter
          </h1>
          <p className="text-slate-400 text-base mt-2 font-medium">Arcade Edition</p>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Host card */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-7 shadow-2xl backdrop-blur-xl flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <Swords className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-white mb-1.5">Host a Game</h2>
            <p className="text-slate-400 text-sm mb-6 flex-1">
              Create a new lobby and invite players via QR code
            </p>
            <button
              onClick={() => router.push("/lobby")}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all duration-200 transform hover:-translate-y-0.5"
            >
              Host Lobby
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Join card */}
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-7 shadow-2xl backdrop-blur-xl flex flex-col">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
              <DoorOpen className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-extrabold text-white mb-1.5">Join a Game</h2>
            <p className="text-slate-400 text-sm mb-4">
              Enter the session code from the host&apos;s screen
            </p>

            <div className="mb-2">
              <input
                type="text"
                value={code}
                onChange={handleCodeChange}
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                placeholder="Enter session code (e.g. ZT-6704)"
                maxLength={7}
                className={`w-full bg-slate-950/60 border ${
                  codeError ? "border-red-500/60" : "border-slate-800 focus:border-purple-500"
                } rounded-xl py-2.5 px-4 text-white placeholder-slate-600 text-sm font-mono tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200`}
              />
              {codeError && (
                <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {codeError}
                </p>
              )}
            </div>

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-purple-500/25 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {joining ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Join</span>}
            </button>

            <p className="text-xs text-slate-500 mt-4 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" />
              Or scan the QR code on the host&apos;s screen
            </p>
          </div>
        </div>

        {/* Quick stats */}
        {stats && (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 backdrop-blur-md text-center">
            <p className="text-sm text-slate-300 font-semibold flex items-center justify-center gap-2 flex-wrap">
              <Trophy className="w-4 h-4 text-amber-400" />
              Your Stats: {stats.total_wins} wins · {stats.total_matches} matches ·{" "}
              {stats.win_rate}% win rate · Rank #{stats.rank || "—"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
