import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppNav from "@/app/components/app-nav";
import "./globals.css";

/** Avoid stale RSC cache edge cases after server actions (important for Tauri + standalone). */
export const dynamic = "force-dynamic";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Job Application Tracker",
  description: "Track applications, discover roles, and run lightweight AI insights.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <AppNav />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
