"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import api from "@/lib/axios";
import UserAvatar from "./UserAvatar";
import { Shield, Menu, X, ChevronDown, LogOut, Swords, History, Trophy, User } from "lucide-react";

interface NavBarUser {
  user_id: string;
  username: string;
  profile_picture_url?: string | null;
}

interface NavBarProps {
  currentUser: NavBarUser | null;
}

const NAV_LINKS = [
  { href: "/lobby", label: "Host Lobby", icon: Swords },
  { href: "/history", label: "Match History", icon: History },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

export default function NavBar({ currentUser }: NavBarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
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
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/home" className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Shield className="w-5 h-5" />
          </div>
          <span className="font-extrabold text-lg tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400 hidden sm:inline">
            Script Fighter
          </span>
        </Link>

        {/* Center nav links (desktop) */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                isActive(href)
                  ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"
                  : "text-slate-400 hover:text-white hover:bg-slate-900 border-transparent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1.5">
          {currentUser && (
            <div className="relative" ref={menuRef}>
              <div className="flex items-center gap-1">
                <Link
                  href="/profile"
                  className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full hover:bg-slate-900 transition-colors"
                >
                  <UserAvatar
                    profile_picture_url={currentUser.profile_picture_url}
                    username={currentUser.username}
                    size="sm"
                  />
                  <span className="text-sm font-semibold text-white hidden sm:inline max-w-[120px] truncate">
                    {currentUser.username}
                  </span>
                </Link>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-label="Account menu"
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
                >
                  <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>
              </div>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-fade-in">
                  <Link
                    href="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  >
                    <User className="w-4 h-4" />
                    View Profile
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium text-rose-400 hover:bg-slate-800 hover:text-rose-300 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Hamburger (mobile) */}
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 backdrop-blur-md px-4 py-3 space-y-1 animate-fade-in">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                isActive(href) ? "bg-indigo-500/15 text-indigo-300" : "text-slate-300 hover:bg-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
          <Link
            href="/profile"
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              isActive("/profile") ? "bg-indigo-500/15 text-indigo-300" : "text-slate-300 hover:bg-slate-900"
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold text-rose-400 hover:bg-slate-900 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      )}
    </header>
  );
}
