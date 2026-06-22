"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useFarcasterAuth } from "@/lib/useFarcasterAuth";

/**
 * Small circular Farcaster PFP — top-right, navigates to /profile on click.
 * Consistent across all pages (except replay screen).
 */
export default function ProfileIcon() {
  const router = useRouter();
  const { pfpUrl, username } = useFarcasterAuth();

  return (
    <button
      onClick={() => router.push("/profile")}
      className="flex items-center gap-2 rounded-full border transition-colors px-2 py-1"
      style={{ borderColor: "#c4a882", flexShrink: 0 }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#b8860b")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#c4a882")}
      title="View profile"
    >
      {pfpUrl ? (
        <Image
          src={pfpUrl}
          alt={username ?? "profile"}
          width={28}
          height={28}
          className="rounded-full"
          unoptimized
        />
      ) : (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: "#d8ccb4", color: "#6b4c2a" }}
        >
          {username ? username[0].toUpperCase() : "?"}
        </div>
      )}
    </button>
  );
}
