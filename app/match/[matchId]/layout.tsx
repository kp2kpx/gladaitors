import type { ReactNode } from "react";
import type { Metadata } from "next";

const BASE_URL = "https://gladaitors.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ matchId: string }>;
}): Promise<Metadata> {
  const { matchId } = await params;
  const matchUrl = `${BASE_URL}/match/${matchId}`;
  const ogUrl = `${BASE_URL}/api/og?title=FIGHT+%23${matchId}&sub=Watch+the+battle+unfold`;

  return {
    title: `GLADAITORS — Fight #${matchId}`,
    description: `GLADAITORS fight #${matchId} — watch the battle unfold on Base.`,
    other: {
      "fc:miniapp": JSON.stringify({
        version: "1",
        imageUrl: ogUrl,
        button: {
          title: `Watch Fight #${matchId}`,
          action: {
            type: "launch_miniapp",
            name: "GLADAITORS",
            url: matchUrl,
            splashImageUrl: `${BASE_URL}/logo.png`,
            splashBackgroundColor: "#1a0a00",
          },
        },
      }),
    },
  };
}

export default function MatchLayout({ children }: { children: ReactNode }) {
  return children;
}
