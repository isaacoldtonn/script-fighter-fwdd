"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";
import UserAvatar from "./UserAvatar";
import { Menu, X, LogOut } from "lucide-react";

interface NavBarUser {
  user_id: string;
  username: string;
  profile_picture_url?: string | null;
}

interface NavBarProps {
  currentUser: NavBarUser | null;
}

const NAV_LINKS = [
  { href: "/lobby", label: "Host Lobby" },
  { href: "/history", label: "Match History" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export default function NavBar({ currentUser }: NavBarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } catch (e) {
      // Ignore — we're clearing local state and leaving regardless.
    }
    document.cookie = "sf_authed=; path=/; max-age=0";
    window.location.href = "/login";
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b-[3px] border-sf-orange">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 md:h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2 shrink-0">
          <span className="text-xl md:text-2xl">⚡</span>
          <div className="leading-none">
            <div className="font-heading font-800 text-lg md:text-xl uppercase tracking-wide text-sf-black">
              Script Fighter
            </div>
            <div className="font-heading font-700 text-[9px] text-sf-orange uppercase tracking-[0.2em]">
              Arcade Edition
            </div>
          </div>
        </Link>

        {/* Center nav links (desktop) */}
        <nav className="hidden md:flex items-stretch h-full">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-5 font-heading font-700 uppercase tracking-[0.1em] text-[13px] transition-colors duration-75 ${
                isActive(href) ? "bg-sf-black text-white" : "bg-white text-sf-black hover:bg-sf-black hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {currentUser && (
            <Link href="/profile" className="hidden sm:flex items-center gap-2.5 group">
              <UserAvatar
                profile_picture_url={currentUser.profile_picture_url}
                username={currentUser.username}
                size="sm"
              />
              <div className="leading-tight">
                <div className="font-heading font-700 text-sm text-sf-black max-w-[120px] truncate">
                  {currentUser.username}
                </div>
                <div className="font-heading font-700 text-[10px] text-sf-orange uppercase tracking-[0.15em] group-hover:underline">
                  Profile
                </div>
              </div>
            </Link>
          )}

          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 text-sf-black hover:text-sf-orange transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div ref={menuRef} className="md:hidden bg-sf-black px-4 py-3 space-y-1">
          {currentUser && (
            <Link
              href="/profile"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-3 border-b border-white/10 mb-1"
            >
              <UserAvatar profile_picture_url={currentUser.profile_picture_url} username={currentUser.username} size="sm" />
              <div>
                <div className="font-heading font-700 text-sm text-white">{currentUser.username}</div>
                <div className="font-heading font-700 text-[10px] text-sf-orange uppercase tracking-[0.15em]">
                  View Profile
                </div>
              </div>
            </Link>
          )}
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-3 font-heading font-700 uppercase tracking-[0.1em] text-sm ${
                isActive(href) ? "bg-sf-orange text-white" : "text-white hover:bg-white/10"
              }`}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-3 font-heading font-700 uppercase tracking-[0.1em] text-sm text-white hover:bg-white/10"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
