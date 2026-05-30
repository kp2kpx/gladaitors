import type { ReactNode } from "react";
import type { Metadata } from "next";

const BASE_URL = "https://gladaitors.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}): Promise<Metadata> {
  const { matchId } = await params;
  const fightUrl = `${BASE_URL}/free-fight/${matchId}`;
  const ogUrl = `${BASE_URL}/api/og?title=FIGHT+CHALLENGE&sub=Someone+challenged+you+to+a+free+fight`;

  return {
    title: "GLADAITORS — Fight Challenge",
    description: "Someone challenged you to a free gladiator fight. Build your champion and fight back.",
    openGraph: {
      title: "GLADAITORS — Fight Challenge",
      description: "Build your gladiator and fight for glory.",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    other: {
      "fc:miniapp": JSON.stringify({
        version: "next",
        imageUrl: ogUrl,
        button: {
          title: "⚔️ Accept Challenge",
          action: {
            type: "launch_miniapp",
            name: "GLADAITORS",
            url: fightUrl,
            splashBackgroundColor: "#f0e6d3",
          },
        },
      }),
    },
  };
}

export default function FreeFightMatchLayout({ children }: { children: ReactNode }) {
  return children;
}
