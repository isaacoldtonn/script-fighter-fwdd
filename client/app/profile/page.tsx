"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import api from "@/lib/axios";
import NavBar from "@/components/NavBar";
import UserAvatar from "@/components/UserAvatar";
import {
  Loader2,
  Camera,
  Upload,
  Save,
  CheckCircle2,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react";

interface CurrentUser {
  user_id: string;
  username: string;
  email: string;
  profile_picture_url?: string | null;
  description?: string | null;
}

interface PublicStats {
  total_wins: number;
  total_matches: number;
  win_rate: number;
  rank: number;
  xp: number;
  created_at: string;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

// REC4 — resize client-side to max 400x400 before upload, to save bandwidth
// and storage. Keeps PNGs as PNG (transparency), re-encodes everything else
// as JPEG.
function resizeImage(file: File, maxSize = 400): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Canvas not supported"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(blob);
          else reject(new Error("Failed to process image"));
        },
        outputType,
        0.9
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image"));
    };

    img.src = objectUrl;
  });
}

function passwordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "bg-gray-200" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  if (password.length >= 12) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-sf-red" };
  if (score <= 3) return { score, label: "Okay", color: "bg-sf-orange-lite" };
  if (score <= 4) return { score, label: "Good", color: "bg-sf-teal" };
  return { score, label: "Strong", color: "bg-emerald-500" };
}

export default function ProfilePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- Card 1: avatar ----
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // ---- Card 2: profile info ----
  const [username, setUsername] = useState("");
  const [description, setDescription] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMessage, setInfoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [infoDirty, setInfoDirty] = useState(false);

  // ---- Card 3: password ----
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const meRes = await api.get("/api/auth/me");
        if (!isMounted) return;
        setCurrentUser(meRes.data);
        setUsername(meRes.data.username || "");
        setDescription(meRes.data.description || "");

        try {
          const statsRes = await api.get(`/api/users/${meRes.data.user_id}/public-profile`);
          if (isMounted) setStats(statsRes.data);
        } catch {
          // stats are secondary; profile page still works without them
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

  // REC3 — warn before leaving the tab/window with unsaved edits.
  const hasUnsavedChanges =
    !!pendingAvatarFile ||
    infoDirty ||
    currentPassword.length > 0 ||
    newPassword.length > 0 ||
    confirmPassword.length > 0;

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUnsavedChanges]);

  // ---------- Card 1: avatar ----------
  const handleFileSelected = async (file: File | undefined | null) => {
    setAvatarError(null);
    if (!file) return;

    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      setAvatarError("Only JPEG, PNG, or WEBP images are allowed.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError("Image must be 2MB or smaller.");
      return;
    }

    setPendingAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    handleFileSelected(e.dataTransfer.files?.[0]);
  };

  const handleSaveAvatar = async () => {
    if (!pendingAvatarFile || !currentUser) return;

    setAvatarSaving(true);
    setAvatarError(null);
    try {
      const resizedBlob = await resizeImage(pendingAvatarFile);
      const formData = new FormData();
      formData.append("avatar", resizedBlob, pendingAvatarFile.name);

      const res = await api.patch(`/api/users/${currentUser.user_id}/profile`, formData);
      const newUrl = res.data.profile_picture_url as string;

      setCurrentUser((prev) => (prev ? { ...prev, profile_picture_url: newUrl } : prev));
      setPendingAvatarFile(null);
      setAvatarPreview(null);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to upload profile picture.";
      setAvatarError(msg);
      toast.error(msg);
    } finally {
      setAvatarSaving(false);
    }
  };

  // ---------- Card 2: profile info ----------
  const handleSaveInfo = async () => {
    if (!currentUser) return;
    setInfoMessage(null);
    setInfoSaving(true);
    try {
      const res = await api.patch(`/api/users/${currentUser.user_id}/profile`, {
        username,
        description,
      });
      setCurrentUser((prev) => (prev ? { ...prev, username: res.data.username, description: res.data.description } : prev));
      setInfoDirty(false);
      setInfoMessage({ type: "success", text: "Profile updated!" });
      toast.success("Profile updated!");
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to update profile.";
      setInfoMessage({ type: "error", text: msg });
      toast.error(msg);
    } finally {
      setInfoSaving(false);
    }
  };

  // ---------- Card 3: password ----------
  const isValidNewPassword = (pw: string) =>
    pw.length >= 8 && /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw);

  const handleChangePassword = async () => {
    if (!currentUser) return;
    setPasswordMessage(null);

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }
    if (!isValidNewPassword(newPassword)) {
      setPasswordMessage({
        type: "error",
        text: "New password needs 8+ characters, an uppercase letter, a digit, and a special character.",
      });
      return;
    }

    setPasswordSaving(true);
    try {
      await api.patch(`/api/users/${currentUser.user_id}/profile`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordMessage({ type: "success", text: "Password changed successfully!" });
      toast.success("Password changed successfully!");
    } catch (err: any) {
      const msg = err.response?.data?.error || "Failed to change password.";
      setPasswordMessage({ type: "error", text: msg });
      toast.error(msg);
      // Do NOT clear fields on error — user shouldn't have to retype everything.
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading || !currentUser) {
    return (
      <div className="min-h-screen sf-bg flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-sf-orange" />
      </div>
    );
  }

  const strength = passwordStrength(newPassword);
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  return (
    <>
      <NavBar currentUser={currentUser} />
      <div className="sf-bg min-h-screen relative overflow-hidden pt-14 md:pt-16 pb-16">
        <div className="sf-watermark" style={{ top: "5%", right: "-5%" }}>
          PROFILE
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
          {/* Header */}
          <div className="mb-8">
            <span className="sf-badge sf-badge-black mb-3 block w-fit">Player Profile</span>
            <h1 className="sf-section-title">My Profile</h1>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* LEFT: Profile preview */}
            <div className="md:col-span-1">
              <div className="sf-card p-6 text-center mb-4">
                <UserAvatar
                  username={currentUser.username}
                  profile_picture_url={avatarPreview || currentUser.profile_picture_url}
                  size="xl"
                  className="mx-auto mb-4"
                />
                <div className="font-heading font-800 text-xl uppercase tracking-wide text-sf-black mb-1">
                  {currentUser.username}
                </div>
                {currentUser.description && (
                  <p className="font-body text-sm text-gray-500 italic mb-4">{currentUser.description}</p>
                )}

                {stats && (
                  <div className="border-t-2 border-sf-gray-border pt-4 space-y-2 mt-4">
                    {[
                      ["Total Matches", stats.total_matches],
                      ["Wins", stats.total_wins],
                      ["Win Rate", `${stats.win_rate}%`],
                      ["Global Rank", `#${stats.rank || "—"}`],
                      ["XP", stats.xp],
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="font-body text-xs text-gray-500 uppercase tracking-widest">{label}</span>
                        <span className="font-heading font-700 text-sm text-sf-black">{value}</span>
                      </div>
                    ))}
                    <div className="border-t border-sf-gray-border pt-2 mt-2">
                      <span className="font-body text-xs text-gray-400">
                        Member since {formatDate(stats.created_at)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Edit cards */}
            <div className="md:col-span-2 space-y-4">
              {/* Card 1 — Profile Picture */}
              <div className="sf-card p-6">
                <h2 className="font-heading font-700 text-sm uppercase tracking-widest text-gray-500 border-b border-sf-gray-border pb-3 mb-4 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-sf-orange" />
                  Profile Picture
                </h2>

                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <UserAvatar
                    username={currentUser.username}
                    profile_picture_url={avatarPreview || currentUser.profile_picture_url}
                    size="xl"
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`flex-1 w-full border-2 border-dashed p-5 text-center cursor-pointer transition-colors ${
                      dragActive ? "border-sf-orange bg-sf-orange/5" : "border-sf-gray-border hover:border-sf-orange"
                    }`}
                  >
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="font-body text-sm font-semibold text-gray-600">Click to upload or drag & drop</p>
                    <p className="font-body text-xs text-gray-400 mt-1">JPEG, PNG, or WEBP — max 2MB</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFileSelected(e.target.files?.[0])}
                    />
                  </div>
                </div>

                {avatarError && (
                  <p className="font-body text-xs text-sf-red mt-3 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {avatarError}
                  </p>
                )}

                {pendingAvatarFile && (
                  <div className="mt-4 flex items-center gap-4">
                    <button
                      onClick={handleSaveAvatar}
                      disabled={avatarSaving}
                      className="sf-btn-primary inline-flex items-center gap-2"
                    >
                      {avatarSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Picture
                    </button>
                    <button
                      onClick={() => {
                        setPendingAvatarFile(null);
                        setAvatarPreview(null);
                        setAvatarError(null);
                      }}
                      disabled={avatarSaving}
                      className="font-body text-sm font-semibold text-gray-500 hover:text-sf-black transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Card 2 — Profile Info */}
              <div className="sf-card p-6">
                <h2 className="font-heading font-700 text-sm uppercase tracking-widest text-gray-500 border-b border-sf-gray-border pb-3 mb-4">
                  Profile Info
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block font-heading font-700 text-xs uppercase tracking-widest text-gray-500 mb-1.5">
                      Username
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setInfoDirty(true);
                        setInfoMessage(null);
                      }}
                      className="sf-input"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-heading font-700 text-xs uppercase tracking-widest text-gray-500">
                        Description
                      </label>
                      <span className="font-body text-xs text-gray-400">{description.length}/200</span>
                    </div>
                    <textarea
                      value={description}
                      maxLength={200}
                      rows={3}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setInfoDirty(true);
                        setInfoMessage(null);
                      }}
                      placeholder="Tell other fighters about yourself..."
                      className="sf-input resize-none"
                    />
                  </div>

                  {infoMessage && (
                    <p
                      className={`font-body text-xs flex items-center gap-1.5 ${
                        infoMessage.type === "success" ? "text-emerald-600" : "text-sf-red"
                      }`}
                    >
                      {infoMessage.type === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      {infoMessage.text}
                    </p>
                  )}

                  <button
                    onClick={handleSaveInfo}
                    disabled={infoSaving || !username.trim()}
                    className="sf-btn-primary inline-flex items-center gap-2"
                  >
                    {infoSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Changes
                  </button>
                </div>
              </div>

              {/* Card 3 — Change Password */}
              <div className="sf-card p-6">
                <h2 className="font-heading font-700 text-sm uppercase tracking-widest text-gray-500 border-b border-sf-gray-border pb-3 mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-sf-orange" />
                  Change Password
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block font-heading font-700 text-xs uppercase tracking-widest text-gray-500 mb-1.5">
                      Current Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          setPasswordMessage(null);
                        }}
                        className="sf-input pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords((v) => !v)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-sf-black"
                        tabIndex={-1}
                      >
                        {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-heading font-700 text-xs uppercase tracking-widest text-gray-500 mb-1.5">
                      New Password
                    </label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordMessage(null);
                      }}
                      className="sf-input"
                    />
                    {newPassword && (
                      <div className="mt-2">
                        <div className="w-full h-1.5 bg-gray-200 overflow-hidden">
                          <div
                            className={`h-full ${strength.color} transition-all duration-300`}
                            style={{ width: `${(strength.score / 5) * 100}%` }}
                          />
                        </div>
                        <p className="font-body text-[11px] text-gray-500 mt-1">{strength.label}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-heading font-700 text-xs uppercase tracking-widest text-gray-500 mb-1.5">
                      Confirm New Password
                    </label>
                    <input
                      type={showPasswords ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        setPasswordMessage(null);
                      }}
                      className="sf-input"
                    />
                  </div>

                  {passwordMessage && (
                    <p
                      className={`font-body text-xs flex items-center gap-1.5 ${
                        passwordMessage.type === "success" ? "text-emerald-600" : "text-sf-red"
                      }`}
                    >
                      {passwordMessage.type === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5" />
                      )}
                      {passwordMessage.text}
                    </p>
                  )}

                  <button
                    onClick={handleChangePassword}
                    disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
                    className="sf-btn-primary inline-flex items-center gap-2"
                  >
                    {passwordSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
