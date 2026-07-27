"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import NavBar from "@/components/NavBar";
import UserAvatar from "@/components/UserAvatar";
import UserProfileModal from "@/components/UserProfileModal";
import { Trophy, Loader2, AlertCircle, RotateCw } from "lucide-react";

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

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

export default function LeaderboardPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, lbRes] = await Promise.all([
        api.get("/api/auth/me"),
        api.get("/api/leaderboard"),
      ]);
      setCurrentUser(meRes.data);
      setData(lbRes.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      if (err.response?.status === 401) {
        router.push("/login");
        return;
      }
      setError("Failed to load leaderboard. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const openProfile = (userId: string) => {
    setSelectedUserId(userId);
    setShowProfileModal(true);
  };

  return (
    <>
      <NavBar currentUser={currentUser} />
      <div className="sf-bg min-h-screen relative overflow-hidden pt-14 md:pt-16">
        <div className="sf-watermark" style={{ top: "5%", right: "-5%" }}>
          RANKING
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <span className="sf-badge sf-badge-orange mb-3 block w-fit">Global Rankings</span>
              <h1 className="sf-section-title">Leaderboard</h1>
            </div>
            <button onClick={fetchAll} disabled={loading} className="sf-btn-ghost text-sm inline-flex items-center gap-2">
              <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {loading && !data ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-sf-orange mb-3" />
              <p className="font-body text-sm text-gray-500">Loading leaderboard...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-sf-red px-4 py-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-sf-red shrink-0" />
              <p className="font-body text-sm text-sf-red">{error}</p>
            </div>
          ) : !data || data.leaderboard.length === 0 ? (
            <div className="sf-card flex flex-col items-center justify-center py-20 text-center">
              <Trophy className="w-10 h-10 mb-3 text-gray-300" />
              <p className="font-heading font-700 text-sf-black">No ranked fighters yet</p>
              <p className="font-body text-sm text-gray-500 mt-1">Play a match to appear on the board.</p>
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 mb-2 border-b-2 border-sf-black pb-2">
                <div className="col-span-1 font-heading font-700 text-xs uppercase tracking-widest text-gray-500">
                  Rank
                </div>
                <div className="col-span-4 font-heading font-700 text-xs uppercase tracking-widest text-gray-500">
                  Player
                </div>
                <div className="col-span-2 font-heading font-700 text-xs uppercase tracking-widest text-gray-500 text-right">
                  XP
                </div>
                <div className="col-span-2 font-heading font-700 text-xs uppercase tracking-widest text-gray-500 text-right">
                  Wins
                </div>
                <div className="col-span-3 font-heading font-700 text-xs uppercase tracking-widest text-gray-500 text-right">
                  Win Rate
                </div>
              </div>

              {/* Leaderboard rows */}
              {data.leaderboard.map((player, i) => {
                const isCurrentUser = player.user_id === data.current_user_id;
                return (
                  <div
                    key={player.user_id}
                    onClick={() => openProfile(player.user_id)}
                    className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-sf-gray-border cursor-pointer transition-all hover:bg-sf-orange/5 hover:border-l-4 hover:border-l-sf-orange hover:pl-3 animate-fade-in-up ${
                      isCurrentUser ? "bg-sf-orange/10 border-l-4 border-l-sf-orange" : "bg-white"
                    }`}
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    {/* Rank */}
                    <div className="col-span-2 sm:col-span-1 flex items-center">
                      {i < 3 ? (
                        <span className="text-xl">{RANK_MEDALS[i]}</span>
                      ) : (
                        <span className="font-heading font-700 text-sm text-gray-500">{player.rank}</span>
                      )}
                    </div>

                    {/* Player */}
                    <div className="col-span-10 sm:col-span-4 flex items-center gap-2 min-w-0">
                      <UserAvatar username={player.username} profile_picture_url={player.profile_picture_url} size="sm" />
                      <div className="min-w-0">
                        <div className="font-heading font-700 text-sm tracking-wide text-sf-black truncate">
                          {player.username}
                        </div>
                        {isCurrentUser && (
                          <span className="font-body text-xs text-sf-orange font-600">You</span>
                        )}
                      </div>
                    </div>

                    {/* XP */}
                    <div className="hidden sm:flex col-span-2 items-center justify-end">
                      <span className="font-heading font-700 text-sm text-sf-orange">{player.xp.toLocaleString()}</span>
                    </div>

                    {/* Wins */}
                    <div className="hidden sm:flex col-span-2 items-center justify-end">
                      <span className="font-heading font-700 text-sm text-sf-black">{player.wins}</span>
                    </div>

                    {/* Win rate bar */}
                    <div className="hidden sm:flex col-span-3 items-center gap-2 justify-end">
                      <div className="flex-1 sf-hp-bar" style={{ maxWidth: "80px" }}>
                        <div className="sf-hp-fill" style={{ width: `${player.win_rate}%` }} />
                      </div>
                      <span className="font-heading font-700 text-xs text-sf-black w-10 text-right flex-shrink-0">
                        {player.win_rate}%
                      </span>
                    </div>
                  </div>
                );
              })}

              {lastUpdated && (
                <div className="text-center mt-6">
                  <span className="font-body text-xs text-gray-400">
                    Last updated: {lastUpdated.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </>
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
