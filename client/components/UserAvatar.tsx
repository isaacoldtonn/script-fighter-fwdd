"use client";

import React, { useState, useEffect } from "react";

type AvatarSize = "sm" | "md" | "lg" | "xl";

interface UserAvatarProps {
  profile_picture_url?: string | null;
  username: string;
  size?: AvatarSize;
  className?: string;
}

const SIZE_PX: Record<AvatarSize, number> = {
  sm: 28,
  md: 36,
  lg: 48,
  xl: 80,
};

const COLORS = [
  "bg-indigo-500",
  "bg-purple-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-cyan-500",
];

function colorForUsername(username: string): string {
  const code = username ? username.charCodeAt(0) : 0;
  return COLORS[code % COLORS.length];
}

export default function UserAvatar({
  profile_picture_url,
  username,
  size = "md",
  className = "",
}: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);

  // Reset the error flag when a new URL comes in (e.g. after a fresh upload)
  // so a previously-broken image doesn't stay stuck on the initials fallback.
  useEffect(() => {
    setImgError(false);
  }, [profile_picture_url]);

  const px = SIZE_PX[size];
  const showImage = !!profile_picture_url && !imgError;

  if (showImage) {
    return (
      <img
        src={profile_picture_url as string}
        alt={username}
        onError={() => setImgError(true)}
        style={{ width: px, height: px }}
        className={`rounded-full object-cover ring-2 ring-slate-800 shrink-0 ${className}`}
      />
    );
  }

  const fontSize = Math.max(10, Math.round(px * 0.42));

  return (
    <div
      style={{ width: px, height: px, fontSize }}
      className={`rounded-full ${colorForUsername(
        username
      )} ring-2 ring-slate-800 flex items-center justify-center font-bold text-white shrink-0 select-none ${className}`}
    >
      {(username || "?").charAt(0).toUpperCase()}
    </div>
  );
}
