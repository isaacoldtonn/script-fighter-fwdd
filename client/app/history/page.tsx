"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import {
  Shield,
  Swords,
  Trophy,
  XCircle,
  MinusCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  History as HistoryIcon,
} from "lucide-react";

interface MatchRecord {
  match_id: string;
  session_id: string;
  opponent_username: string;
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
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  const resultBadge = (result: MatchRecord["result"]) => {
    if (result === "win") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
          <Trophy className="w-3.5 h-3.5" />
          Win
        </span>
      );
    }
    if (result === "loss") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-extrabold uppercase tracking-wider">
          <XCircle className="w-3.5 h-3.5" />
          Loss
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-500/10 border border-slate-500/30 text-slate-400 text-xs font-extrabold uppercase tracking-wider">
        <MinusCircle className="w-3.5 h-3.5" />
        Draw
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-4 sm:p-6 selection:bg-indigo-500 selection:text-white">
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
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <HistoryIcon className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white">Match History</h1>
            <p className="text-slate-400 text-sm">Your past battles and results</p>
          </div>
        </div>

        {/* Content */}
        {loading && !data ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
            <p>Loading match history...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
            {error}
          </div>
        ) : !data || data.matches.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400">
            <Swords className="w-10 h-10 mb-3 text-slate-600" />
            <p className="font-semibold">No matches played yet</p>
            <p className="text-sm text-slate-500 mt-1">Head to the lobby to start a fight.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {data.matches.map((m) => (
                <div
                  key={m.match_id}
                  className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-lg"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                      <Swords className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        vs {m.opponent_username}
                      </p>
                      <p className="text-xs text-slate-500">{formatDate(m.played_at)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right text-xs font-mono text-slate-400 hidden sm:block">
                      <span className="text-emerald-400 font-bold">{Math.max(0, m.my_final_hp)}</span>
                      {" "}vs{" "}
                      <span className="text-rose-400 font-bold">{Math.max(0, m.opponent_final_hp)}</span>
                    </div>
                    {resultBadge(m.result)}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {data.total_pages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-sm font-semibold text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>
                <span className="text-xs font-mono text-slate-500">
                  Page {data.page} of {data.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                  disabled={page >= data.total_pages || loading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-800 text-sm font-semibold text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-slate-700 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
