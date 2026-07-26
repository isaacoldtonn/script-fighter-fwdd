"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { Shield, Mail, Lock, ArrowRight, Loader2, AlertCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      const response = await api.post("/api/auth/login", {
        email: data.email,
        password: data.password,
      });

      if (response.status === 200) {
        const redirectTo = sessionStorage.getItem("sf_redirect_after_login");
        if (redirectTo) {
          sessionStorage.removeItem("sf_redirect_after_login");
          window.location.href = redirectTo;
        } else {
          router.push("/lobby");
        }
      }
    } catch (err: any) {
      if (err.response && err.response.status === 401) {
        setServerError("Invalid email or password");
      } else if (err.response && err.response.data && err.response.data.error) {
        setServerError(err.response.data.error);
      } else {
        setServerError("An error occurred during login. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      {/* Page Title */}
      <div className="mb-8 text-center relative z-10 animate-fade-in">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-sm font-semibold mb-3 backdrop-blur-md">
          <Shield className="w-4 h-4 text-indigo-400" />
          <span>Python Control Flow Arena</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
          Script Fighter
        </h1>
        <p className="text-slate-400 text-sm mt-1 font-medium">Arcade Edition</p>
      </div>

      {/* Centered Card */}
      <div className="w-full max-w-md bg-slate-900/80 border border-slate-800/80 rounded-2xl p-8 shadow-2xl backdrop-blur-xl relative z-10 transition-all duration-300 hover:border-slate-700/80">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold text-white tracking-wide">Welcome back</h2>
          <p className="text-slate-400 text-sm mt-1">Log in to continue your coding battles</p>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 animate-shake">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <span className="text-sm font-medium">{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Email
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                {...register("email")}
                placeholder="warrior@scriptfighter.com"
                className={`w-full bg-slate-950/60 border ${
                  errors.email ? "border-red-500/60 focus:ring-red-500/20" : "border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20"
                } rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 transition-all duration-200`}
              />
            </div>
            {errors.email && (
              <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className={`w-full bg-slate-950/60 border ${
                  errors.password ? "border-red-500/60 focus:ring-red-500/20" : "border-slate-800 focus:border-indigo-500 focus:ring-indigo-500/20"
                } rounded-xl py-2.5 pl-10 pr-4 text-white placeholder-slate-600 text-sm focus:outline-none focus:ring-2 transition-all duration-200`}
              />
            </div>
            {errors.password && (
              <p className="text-red-400 text-xs mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Logging in...</span>
                </>
              ) : (
                <>
                  <span>Log in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Footer Link */}
        <div className="mt-6 text-center border-t border-slate-800/80 pt-5">
          <p className="text-slate-400 text-sm">
            New here?{" "}
            <Link
              href="/register"
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors duration-150 underline decoration-indigo-500/30 hover:decoration-indigo-400"
            >
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
