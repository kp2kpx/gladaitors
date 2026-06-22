import type { ReactNode } from "react";
import type { Metadata } from "next";

const BASE_URL = "https://gladaitors.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}): Promise<Metadata> {
  const { matchId } = await params;
  const joinUrl = `${BASE_URL}/join/${matchId}`;
  const ogUrl = `${BASE_URL}/api/og?title=FIGHT+CHALLENGE&sub=Accept+my+GLADAITOR+challenge`;

  return {
    title: "GLADAITORS — Fight Challenge",
    description: "You've been challenged to a GLADAITOR fight. Build your gladiator and fight for USDC.",
    openGraph: {
      title: "GLADAITORS — Fight Challenge",
      description: "Accept the challenge. Lock your USDC. Fight to the death.",
      images: [{ url: ogUrl, width: 1200, height: 800 }],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "next",
        imageUrl: ogUrl,
        button: {
          title: "Accept Challenge",
          action: {
            type: "launch_miniapp",
            name: "GLADAITORS",
            url: joinUrl,
            splashImageUrl: `${BASE_URL}/logo.png`,
            splashBackgroundColor: "#1a0a00",
          },
        },
      }),
    },
  };
}

export default function JoinMatchLayout({ children }: { children: ReactNode }) {
  return children;
}
