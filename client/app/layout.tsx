import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Script Fighter: Arcade Edition",
  description: "Real-time 2-player educational hybrid game teaching Python Control Flow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
