"use client";

import React, { useEffect, useState } from "react";
import api from "@/lib/axios";
import UserAvatar from "./UserAvatar";
import { X, Loader2, Trophy, Swords, Percent, Hash } from "lucide-react";

interface PublicProfile {
  username: string;
  profile_picture_url?: string | null;
  description?: string | null;
  total_wins: number;
  created_at: string;
  rank: number;
  xp: number;
  total_matches: number;
  win_rate: number;
}

interface UserProfileModalProps {
  user_id: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function UserProfileModal({ user_id, isOpen, onClose }: UserProfileModalProps) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !user_id) return;

    let isMounted = true;
    setLoading(true);
    setError(null);
    setProfile(null);

    api
      .get(`/api/users/${user_id}/public-profile`)
      .then((res) => {
        if (isMounted) setProfile(res.data);
      })
      .catch(() => {
        if (isMounted) setError("Failed to load profile.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user_id, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  // Cosmetic progress bar towards the next 500xp milestone.
  const xpIntoLevel = profile ? profile.xp % 500 : 0;
  const xpPercent = profile ? Math.min(100, (xpIntoLevel / 500) * 100) : 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-indigo-500" />
            <p className="text-sm">Loading profile...</p>
          </div>
        ) : error || !profile ? (
          <div className="py-16 text-center text-rose-400 text-sm font-medium">
            {error || "Profile not found."}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <UserAvatar profile_picture_url={profile.profile_picture_url} username={profile.username} size="xl" />
            <h2 className="text-xl font-extrabold text-white mt-4">{profile.username}</h2>
            {profile.description && (
              <p className="text-sm text-slate-400 italic mt-1.5 max-w-xs">{profile.description}</p>
            )}

            <div className="w-full h-px bg-slate-800 my-5" />

            <div className="w-full grid grid-cols-2 gap-3">
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Games</p>
                <p className="text-lg font-extrabold text-white flex items-center justify-center gap-1.5">
                  <Swords className="w-4 h-4 text-indigo-400" />
                  {profile.total_matches}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Total Wins</p>
                <p className="text-lg font-extrabold text-white flex items-center justify-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  {profile.total_wins}
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Win Rate</p>
                <p className="text-lg font-extrabold text-white flex items-center justify-center gap-1.5">
                  <Percent className="w-4 h-4 text-emerald-400" />
                  {profile.win_rate}%
                </p>
              </div>
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Rank</p>
                <p className="text-lg font-extrabold text-white flex items-center justify-center gap-1.5">
                  <Hash className="w-4 h-4 text-purple-400" />
                  {profile.rank || "—"}
                </p>
              </div>
            </div>

            <div className="w-full mt-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 mb-1.5">
                <span>XP: {profile.xp}</span>
                <span className="font-mono text-slate-500">{xpIntoLevel}/500</span>
              </div>
              <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 mt-4">Member since {formatDate(profile.created_at)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
