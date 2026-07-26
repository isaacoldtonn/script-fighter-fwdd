"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import NavBar from "@/components/NavBar";
import UserAvatar from "@/components/UserAvatar";
import UserProfileModal from "@/components/UserProfileModal";
import { Shield, Trophy, Loader2, ArrowLeft, Crown, User } from "lucide-react";

interface CurrentUser {
  user_id: string;
  username: string;
  profile_picture_url?: string | null;
}

interface LeaderboardRow {
  user_id: string;
  username: string;
  profile_picture_url?: string | null;
  description?: string;
  rank: number;
  wins: number;
  total_matches: number;
  win_rate: number;
  xp: number;
}

interface LeaderboardResponse {
  leaderboard: LeaderboardRow[];
  current_user_id: string;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [meRes, lbRes] = await Promise.all([
          api.get("/api/auth/me"),
          api.get("/api/leaderboard"),
        ]);
        if (isMounted) {
          setCurrentUser(meRes.data);
          setData(lbRes.data);
        }
      } catch (err: any) {
        if (err.response?.status === 401) {
          router.push("/login");
          return;
        }
        if (isMounted) {
          setError("Failed to load leaderboard. Please try again.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const openProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowProfileModal(true);
  };

  const rankStyle = (rank: number) => {
    if (rank === 1) return "bg-amber-500/10 border-amber-500/40 text-amber-400";
    if (rank === 2) return "bg-slate-400/10 border-slate-400/40 text-slate-300";
    if (rank === 3) return "bg-orange-600/10 border-orange-600/40 text-orange-400";
    return "bg-slate-800/60 border-slate-700/60 text-slate-400";
  };

  return (
    <>
      <NavBar currentUser={currentUser} />
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 pt-24 selection:bg-indigo-500 selection:text-white">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/lobby"
              className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm font-semibold transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Lobby
            </Link>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
              <Shield className="w-4 h-4" />
              Script Fighter
            </div>
          </div>

          <div className="mb-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-white">Leaderboard</h1>
              <p className="text-slate-400 text-sm">Top 50 fighters by XP</p>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-4 p-3.5 rounded-2xl border border-slate-800/80 bg-slate-900/80 animate-pulse"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-800 shrink-0" />
                    <div className="w-9 h-9 rounded-full bg-slate-800 shrink-0" />
                    <div className="space-y-1.5">
                      <div className="h-3.5 w-24 bg-slate-800 rounded" />
                      <div className="h-2.5 w-32 bg-slate-800/70 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-14 bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
              {error}
            </div>
          ) : !data || data.leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
              <Trophy className="w-10 h-10 mb-3 text-slate-600" />
              <p className="font-semibold">No ranked fighters yet</p>
              <p className="text-sm text-slate-500 mt-1">Play a match to appear on the board.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.leaderboard.map((row) => {
                const isMe = row.user_id === data.current_user_id;
                return (
                  <button
                    key={row.user_id}
                    onClick={() => openProfile(row.user_id)}
                    className={`w-full text-left flex items-center justify-between gap-4 p-3.5 rounded-2xl border shadow-lg cursor-pointer transition-colors ${
                      isMe
                        ? "bg-indigo-500/10 border-indigo-500/50 hover:bg-indigo-500/15"
                        : "bg-slate-900/80 border-slate-800/80 hover:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg border flex items-center justify-center font-mono font-black text-sm shrink-0 ${rankStyle(
                          row.rank
                        )}`}
                      >
                        {row.rank <= 3 ? <Crown className="w-4 h-4" /> : row.rank}
                      </div>
                      <UserAvatar size="sm" username={row.username} profile_picture_url={row.profile_picture_url} />
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                          {row.username}
                          {isMe && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-extrabold uppercase tracking-wider">
                              <User className="w-2.5 h-2.5" />
                              You
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500">
                          {row.wins}W / {row.total_matches} played · {row.win_rate}% win rate
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono font-extrabold text-indigo-300">{row.xp} XP</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedUserId && (
        <UserProfileModal
          user_id={selectedUserId}
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </>
  );
}
