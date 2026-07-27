"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import SpriteAnimator from "@/components/SpriteAnimator";
import { AlertCircle } from "lucide-react";

const registerSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(20, "Username must be at most 20 characters")
      .regex(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
    email: z.string().min(1, "Email is required").email("Invalid email address"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[0-9]/, "Password must contain at least one number")
      .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError(null);
    try {
      const response = await api.post("/api/auth/register", {
        username: data.username,
        email: data.email,
        password: data.password,
      });

      if (response.status === 201) {
        router.push("/login");
      }
    } catch (err: any) {
      if (err.response && err.response.status === 409) {
        setServerError("Username or email already taken");
      } else if (err.response && err.response.data && err.response.data.error) {
        setServerError(err.response.data.error);
      } else {
        setServerError("An error occurred during registration. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-screen sf-bg flex">
      {/* LEFT decorative panel */}
      <div className="hidden md:flex md:w-[40%] bg-sf-black relative flex-col justify-between p-10 lg:p-12 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(-45deg, transparent, transparent 14px, rgba(255,255,255,0.02) 14px, rgba(255,255,255,0.02) 28px)",
          }}
        />

        <div className="relative z-10">
          <h1 className="font-heading font-900 text-4xl lg:text-5xl uppercase tracking-wide text-white leading-[0.95]">
            Script
            <br />
            Fighter
          </h1>
          <p className="font-heading font-700 text-sf-orange uppercase tracking-[0.2em] text-sm mt-3">
            Arcade Edition
          </p>
        </div>

        <div className="relative z-10 flex justify-center">
          <SpriteAnimator
            src="/sprites/ryu-idle.png"
            frameCount={6}
            frameWidth={77}
            frameHeight={93}
            fps={6}
            loop={true}
            playing={true}
            scale={3.0}
          />
        </div>

        <div className="relative z-10">
          <span className="sf-badge sf-badge-orange">Python Control Flow Arena</span>
        </div>
      </div>

      {/* RIGHT form panel */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 lg:p-16 bg-white">
        <div className="w-full max-w-md">
          <h2 className="font-heading font-900 text-4xl uppercase tracking-[0.08em] text-sf-black">
            Create Account
          </h2>
          <div className="w-16 h-[3px] bg-sf-orange mt-3 mb-8" />

          {serverError && (
            <div className="mb-6 bg-red-50 border-l-4 border-sf-red px-3.5 py-2.5 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-sf-red" />
              <p className="font-body text-sm text-sf-red">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Username */}
            <div>
              <label className="block font-heading font-700 uppercase tracking-[0.1em] text-xs text-gray-500 mb-1.5">
                Username
              </label>
              <input
                type="text"
                {...register("username")}
                placeholder="codewarrior_01"
                className="sf-input"
                style={errors.username ? { borderColor: "#C0392B" } : undefined}
              />
              {errors.username && (
                <p className="font-body text-xs text-sf-red mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block font-heading font-700 uppercase tracking-[0.1em] text-xs text-gray-500 mb-1.5">
                Email
              </label>
              <input
                type="email"
                {...register("email")}
                placeholder="warrior@scriptfighter.com"
                className="sf-input"
                style={errors.email ? { borderColor: "#C0392B" } : undefined}
              />
              {errors.email && (
                <p className="font-body text-xs text-sf-red mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <label className="block font-heading font-700 uppercase tracking-[0.1em] text-xs text-gray-500 mb-1.5">
                Password
              </label>
              <input
                type="password"
                {...register("password")}
                placeholder="••••••••"
                className="sf-input"
                style={errors.password ? { borderColor: "#C0392B" } : undefined}
              />
              {errors.password && (
                <p className="font-body text-xs text-sf-red mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block font-heading font-700 uppercase tracking-[0.1em] text-xs text-gray-500 mb-1.5">
                Confirm Password
              </label>
              <input
                type="password"
                {...register("confirmPassword")}
                placeholder="••••••••"
                className="sf-input"
                style={errors.confirmPassword ? { borderColor: "#C0392B" } : undefined}
              />
              {errors.confirmPassword && (
                <p className="font-body text-xs text-sf-red mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button type="submit" disabled={isSubmitting} className="sf-btn-primary w-full">
                {isSubmitting ? "Creating account..." : "Register"}
              </button>
            </div>
          </form>

          {/* Footer Link */}
          <div className="mt-8 pt-6 border-t border-sf-gray-border text-center">
            <p className="font-body text-sm text-gray-600">
              Already have an account? <Link href="/login" className="sf-link">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
