"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import NavBar from "@/components/NavBar";
import UserAvatar from "@/components/UserAvatar";
import { Swords, Loader2, AlertCircle } from "lucide-react";

interface CurrentUser {
  user_id: string;
  username: string;
  profile_picture_url?: string | null;
}

interface MatchRecord {
  match_id: string;
  session_id: string;
  opponent_username: string;
  opponent_profile_picture_url?: string | null;
  result: "win" | "loss" | "draw";
  my_final_hp: number;
  opponent_final_hp: number;
  played_at: string;
}

interface MatchesResponse {
  matches: MatchRecord[];
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

const LIMIT = 10;

export default function HistoryPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const meRes = await api.get("/api/auth/me");
        if (isMounted) {
          setUserId(meRes.data.user_id);
          setCurrentUser(meRes.data);
        }
      } catch (err) {
        router.push("/login");
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const fetchMatches = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/api/users/${userId}/matches`, {
        params: { page, limit: LIMIT },
      });
      setData(res.data);
    } catch (err) {
      setError("Failed to load match history. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [userId, page]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
      " " +
      d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    );
  };

  const resultLabel = (result: MatchRecord["result"]) => {
    if (result === "win") {
      return <span className="font-heading font-800 text-sm px-3 py-2 flex-shrink-0 uppercase tracking-widest sf-gradient text-white">Win</span>;
    }
    if (result === "loss") {
      return <span className="font-heading font-800 text-sm px-3 py-2 flex-shrink-0 uppercase tracking-widest bg-gray-200 text-gray-600">Loss</span>;
    }
    return <span className="font-heading font-800 text-sm px-3 py-2 flex-shrink-0 uppercase tracking-widest bg-gray-300 text-gray-700">Draw</span>;
  };

  const totalPages = data?.total_pages ?? 0;

  return (
    <>
      <NavBar currentUser={currentUser} />
      <div className="sf-bg min-h-screen relative overflow-hidden pt-14 md:pt-16">
        <div className="sf-watermark" style={{ top: "5%", right: "2%" }}>
          HISTORY
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-8">
            <span className="sf-badge sf-badge-orange mb-3 block w-fit">Battle Record</span>
            <h1 className="sf-section-title">Match History</h1>
            {data && (
              <p className="font-body text-gray-500 text-sm mt-4">
                {data.total} total {data.total === 1 ? "match" : "matches"} recorded
              </p>
            )}
          </div>

          {/* Content */}
          {loading && !data ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="sf-card p-4 flex items-center gap-4 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-28 bg-gray-200 rounded" />
                    <div className="h-2.5 w-20 bg-gray-200 rounded" />
                  </div>
                  <div className="h-8 w-16 bg-gray-200" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-sf-red px-4 py-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-sf-red shrink-0" />
              <p className="font-body text-sm text-sf-red">{error}</p>
            </div>
          ) : !data || data.matches.length === 0 ? (
            <div className="sf-card flex flex-col items-center justify-center py-20 text-center">
              <Swords className="w-10 h-10 mb-3 text-gray-300" />
              <p className="font-heading font-700 text-sf-black">No matches played yet</p>
              <p className="font-body text-sm text-gray-500 mt-1">Head to the lobby to start a fight.</p>
            </div>
          ) : (
            <>
              {/* Match list */}
              <div className="space-y-3">
                {data.matches.map((match, i) => (
                  <div
                    key={match.match_id}
                    className="sf-card p-4 flex items-center gap-4 hover:border-sf-orange transition-colors animate-fade-in-up"
                    style={{ animationDelay: `${i * 0.05}s` }}
                  >
                    {resultLabel(match.result)}

                    {/* Opponent info */}
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <UserAvatar
                        username={match.opponent_username}
                        profile_picture_url={match.opponent_profile_picture_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="font-heading font-700 text-sm tracking-wide text-sf-black truncate">
                          vs {match.opponent_username}
                        </div>
                        <div className="font-body text-xs text-gray-400">{formatDate(match.played_at)}</div>
                      </div>
                    </div>

                    {/* Final HP */}
                    <div className="hidden sm:flex items-center gap-6 text-right shrink-0">
                      <div>
                        <div className="font-heading font-700 text-sm text-sf-black">
                          {Math.max(0, match.my_final_hp)} - {Math.max(0, match.opponent_final_hp)}
                        </div>
                        <div className="font-body text-xs text-gray-400">Final HP</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center gap-1 mt-8">
                  <button
                    className="sf-page-btn"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || loading}
                  >
                    ‹
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      className={`sf-page-btn ${page === p ? "active" : ""}`}
                      onClick={() => setPage(p)}
                      disabled={loading}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    className="sf-page-btn"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || loading}
                  >
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
