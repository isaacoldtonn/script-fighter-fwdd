"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import NavBar from "@/components/NavBar";
import { Loader2, AlertCircle } from "lucide-react";

interface CurrentUser {
  user_id: string;
  username: string;
  email: string;
  profile_picture_url?: string | null;
}

interface QuickStats {
  total_wins: number;
  total_matches: number;
  win_rate: number;
  rank: number;
}

const CODE_REGEX = /^[A-Z]{2}-\d{4}$/;

export default function HomePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const meRes = await api.get("/api/auth/me");
        if (!isMounted) return;
        setCurrentUser(meRes.data);

        try {
          const statsRes = await api.get(`/api/users/${meRes.data.user_id}/public-profile`);
          if (isMounted) {
            setStats({
              total_wins: statsRes.data.total_wins,
              total_matches: statsRes.data.total_matches,
              win_rate: statsRes.data.win_rate,
              rank: statsRes.data.rank,
            });
          }
        } catch {
          // Stats are a nice-to-have on this page; don't block on them.
        }
      } catch (err) {
        router.push("/login");
        return;
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    init();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(e.target.value.toUpperCase());
    setCodeError(null);
  };

  const handleJoin = async () => {
    setCodeError(null);

    if (!CODE_REGEX.test(code)) {
      setCodeError("Invalid code format. Example: ZT-6704");
      return;
    }

    setJoining(true);
    try {
      const res = await api.get(`/api/sessions/join/${code}`);
      const { qr_token } = res.data;
      router.push(`/join?token=${qr_token}`);
    } catch (err: any) {
      if (err.response?.status === 404) {
        setCodeError("Session not found. Check the code and try again.");
      } else if (err.response?.status === 400) {
        setCodeError("This session has already started or ended.");
      } else {
        setCodeError("Something went wrong. Please try again.");
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen sf-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-sf-orange" />
      </div>
    );
  }

  const statTiles = [
    { label: "Total Matches", value: stats?.total_matches ?? 0 },
    { label: "Total Wins", value: stats?.total_wins ?? 0 },
    { label: "Win Rate", value: `${stats?.win_rate ?? 0}%` },
    { label: "Global Rank", value: `#${stats?.rank || "—"}` },
  ];

  return (
    <>
      <NavBar currentUser={currentUser} />
      <main className="sf-bg min-h-screen relative overflow-hidden pt-14 md:pt-16">
        {/* Watermark */}
        <div className="sf-watermark" style={{ top: "10%", right: "2%" }}>
          FIGHT
        </div>

        <section className="relative z-10 max-w-6xl mx-auto px-6 py-16">
          {/* Page heading */}
          <div className="mb-12">
            <span className="sf-badge sf-badge-orange mb-3 block w-fit">
              Python Control Flow Arena
            </span>
            <h1 className="sf-section-title mb-2">Ready to Fight?</h1>
            <p className="font-body text-gray-600 text-lg mt-4">
              Master Python Control Flow through real-time arcade battles
            </p>
          </div>

          {/* Two action cards side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
            {/* HOST card */}
            <div className="sf-card p-8">
              <div className="text-4xl mb-4">⚔️</div>
              <h2 className="font-heading font-800 text-2xl uppercase tracking-wider text-sf-black mb-3">
                Host a Game
              </h2>
              <div className="w-10 h-0.5 bg-sf-orange mb-4" />
              <p className="font-body text-gray-600 text-sm mb-6 leading-relaxed">
                Create a new lobby. Players join by scanning your QR code or entering the
                session code.
              </p>
              <button onClick={() => router.push("/lobby")} className="sf-btn-primary w-full">
                Host Lobby →
              </button>
            </div>

            {/* JOIN card */}
            <div className="sf-card p-8">
              <div className="text-4xl mb-4">🎮</div>
              <h2 className="font-heading font-800 text-2xl uppercase tracking-wider text-sf-black mb-3">
                Join a Game
              </h2>
              <div className="w-10 h-0.5 bg-sf-orange mb-4" />
              <p className="font-body text-gray-600 text-sm mb-4 leading-relaxed">
                Enter the session code shown on the host&apos;s screen.
              </p>
              <div className="flex gap-0">
                <input
                  type="text"
                  value={code}
                  onChange={handleCodeChange}
                  placeholder="ZT-6704"
                  maxLength={7}
                  className="sf-input flex-1 font-heading font-700 text-lg tracking-widest"
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                />
                <button onClick={handleJoin} disabled={joining} className="sf-btn-primary px-6" style={{ clipPath: "none" }}>
                  {joining ? "..." : "JOIN"}
                </button>
              </div>
              {codeError && (
                <p className="font-body text-sm text-sf-red mt-2 border-l-2 border-sf-red pl-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {codeError}
                </p>
              )}
              <p className="font-body text-xs text-gray-400 mt-3">
                Or scan the QR code on the host&apos;s screen
              </p>
            </div>
          </div>

          {/* Quick stats bar */}
          <div className="border-t-2 border-sf-gray-border pt-6">
            <div className="flex flex-wrap gap-8">
              {statTiles.map(({ label, value }) => (
                <div key={label}>
                  <div className="font-heading font-700 text-2xl text-sf-black">{value}</div>
                  <div className="font-body text-xs text-gray-500 uppercase tracking-widest mt-0.5">
                    {label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
