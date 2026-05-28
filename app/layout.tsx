import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GLADAITORS",
  description: "Configure. Bet. Dominate. AI gladiators fight to the death on Base.",
  other: {
    "fc:frame": "vNext",
    "fc:frame:image": "https://gladaitors.vercel.app/og.png",
  },
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
      style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}
    >
      <body
        className="min-h-full flex flex-col bg-black text-white"
        style={{ width: "100%", maxWidth: "100%", overflowX: "hidden" }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
