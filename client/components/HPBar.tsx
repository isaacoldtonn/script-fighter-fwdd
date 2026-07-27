"use client";

import React from "react";
import UserAvatar from "./UserAvatar";

interface HPBarProps {
  username: string;
  hp: number;
  maxHp: number;
  side: "left" | "right";
  profilePictureUrl?: string | null;
}

function hpColor(percent: number): string {
  if (percent > 50) return "#00FF41";
  if (percent > 25) return "#FFB800";
  return "#FF2020";
}

export default function HPBar({ username, hp, maxHp, side, profilePictureUrl }: HPBarProps) {
  const clampedHp = Math.max(0, Math.min(maxHp, hp));
  const percent = maxHp > 0 ? (clampedHp / maxHp) * 100 : 0;
  const color = hpColor(percent);
  const isLow = percent <= 25;
  const isLeft = side === "left";

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Name row */}
      <div className={`flex items-center gap-2.5 ${isLeft ? "" : "flex-row-reverse"}`}>
        <UserAvatar username={username} profile_picture_url={profilePictureUrl} size="md" />
        <span className="text-white font-bold text-base md:text-lg uppercase tracking-widest truncate">
          {username}
        </span>
      </div>

      {/* HP bar row — sits directly below the name */}
      <div className={`flex items-center gap-2 ${isLeft ? "" : "flex-row-reverse"}`}>
        <div
          className="flex-1 h-5 md:h-6 relative overflow-hidden"
          style={{ background: "#1a1a1a", border: "2px solid #444", borderRadius: 2 }}
        >
          <div
            className={`h-full transition-all duration-300 ease-out ${isLow ? "animate-hp-pulse" : ""}`}
            style={{
              width: `${percent}%`,
              backgroundColor: color,
              marginLeft: isLeft ? 0 : "auto",
            }}
          />
        </div>
        <span className="font-mono font-black text-base md:text-lg shrink-0" style={{ color }}>
          {clampedHp}
        </span>
      </div>
    </div>
  );
}
