"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;

    api
      .get("/api/auth/me")
      .then(() => {
        if (isMounted) router.replace("/home");
      })
      .catch(() => {
        if (isMounted) router.replace("/login");
      });

    return () => {
      isMounted = false;
    };
  }, [router]);

  return <main className="min-h-screen bg-slate-950" />;
}
