"use client";

import { useRouter } from "next/navigation";

export default function Footer() {
  const router = useRouter();

  function openKpx() {
    window.open("https://warpcast.com/kpx", "_blank", "noopener,noreferrer");
  }

  return (
    <footer
      className="w-full overflow-x-hidden"
      style={{
        background: "#0a0a0a",
        borderTop: "1px solid #1f1f1f",
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingLeft: "1rem",
        paddingRight: "1rem",
        flexShrink: 0,
      }}
    >
      <span className="text-xs text-gray-600">
        created by{" "}
        <button
          onClick={openKpx}
          className="text-amber-600 hover:text-amber-400 transition-colors font-semibold"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          @kpx
        </button>
      </span>
      <button
        onClick={() => router.push("/docs")}
        className="text-xs text-amber-600 hover:text-amber-400 transition-colors font-bold tracking-widest uppercase"
        style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
      >
        DOCS &rarr;
      </button>
    </footer>
  );
}
