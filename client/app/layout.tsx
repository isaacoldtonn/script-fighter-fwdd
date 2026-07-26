import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
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
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: "#0f172a",
              color: "#fff",
              border: "1px solid #1e293b",
            },
          }}
        />
      </body>
    </html>
  );
}
