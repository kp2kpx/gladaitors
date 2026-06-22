"use client";

import { useRouter } from "next/navigation";

/**
 * Back button — parchment/stone themed, top-left, consistent across all pages.
 * Uses router.back() to navigate to the previous page in history.
 */
export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      aria-label="Go back"
      title="Back"
      style={{
        background: "rgba(240,230,211,0.12)",
        border: "1px solid #c4a882",
        borderRadius: "6px",
        padding: "10px 10px",
        cursor: "pointer",
        fontSize: "13px",
        color: "#9a7a50",
        lineHeight: 1,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        transition: "color 150ms, border-color 150ms, background 150ms",
        flexShrink: 0,
        userSelect: "none",
        WebkitUserSelect: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "#c4a882";
        e.currentTarget.style.borderColor = "#b8860b";
        e.currentTarget.style.background = "rgba(240,230,211,0.2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "#9a7a50";
        e.currentTarget.style.borderColor = "#c4a882";
        e.currentTarget.style.background = "rgba(240,230,211,0.12)";
      }}
    >
      &#8592; Back
    </button>
  );
}
