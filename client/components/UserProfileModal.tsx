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
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-sf-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="sf-card w-full max-w-sm p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-sf-orange transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mb-3 text-sf-orange" />
            <p className="font-body text-sm">Loading profile...</p>
          </div>
        ) : error || !profile ? (
          <div className="py-16 text-center text-sf-red font-body text-sm font-semibold">
            {error || "Profile not found."}
          </div>
        ) : (
          <div className="flex flex-col items-center text-center">
            <UserAvatar profile_picture_url={profile.profile_picture_url} username={profile.username} size="xl" />
            <h2 className="font-heading font-800 text-xl uppercase tracking-wide text-sf-black mt-4">
              {profile.username}
            </h2>
            {profile.description && (
              <p className="font-body text-sm text-gray-500 italic mt-1.5 max-w-xs">{profile.description}</p>
            )}

            <div className="w-full h-px bg-sf-gray-border my-5" />

            <div className="w-full grid grid-cols-2 gap-3">
              <div className="bg-sf-gray-card border border-sf-gray-border p-3">
                <p className="font-heading font-700 text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                  Total Games
                </p>
                <p className="font-heading font-800 text-lg text-sf-black flex items-center justify-center gap-1.5">
                  <Swords className="w-4 h-4 text-sf-orange" />
                  {profile.total_matches}
                </p>
              </div>
              <div className="bg-sf-gray-card border border-sf-gray-border p-3">
                <p className="font-heading font-700 text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                  Total Wins
                </p>
                <p className="font-heading font-800 text-lg text-sf-black flex items-center justify-center gap-1.5">
                  <Trophy className="w-4 h-4 text-sf-orange-lite" />
                  {profile.total_wins}
                </p>
              </div>
              <div className="bg-sf-gray-card border border-sf-gray-border p-3">
                <p className="font-heading font-700 text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                  Win Rate
                </p>
                <p className="font-heading font-800 text-lg text-sf-black flex items-center justify-center gap-1.5">
                  <Percent className="w-4 h-4 text-sf-teal" />
                  {profile.win_rate}%
                </p>
              </div>
              <div className="bg-sf-gray-card border border-sf-gray-border p-3">
                <p className="font-heading font-700 text-[10px] uppercase tracking-widest text-gray-500 mb-1">
                  Rank
                </p>
                <p className="font-heading font-800 text-lg text-sf-black flex items-center justify-center gap-1.5">
                  <Hash className="w-4 h-4 text-sf-red" />
                  {profile.rank || "—"}
                </p>
              </div>
            </div>

            <div className="w-full mt-4">
              <div className="flex items-center justify-between font-heading font-700 text-xs text-gray-500 mb-1.5">
                <span>XP: {profile.xp}</span>
                <span className="text-gray-400">{xpIntoLevel}/500</span>
              </div>
              <div className="w-full h-2.5 bg-sf-gray-bg border border-sf-gray-border overflow-hidden">
                <div
                  className="h-full sf-gradient transition-all duration-500"
                  style={{ width: `${xpPercent}%` }}
                />
              </div>
            </div>

            <p className="font-body text-xs text-gray-400 mt-4">Member since {formatDate(profile.created_at)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
