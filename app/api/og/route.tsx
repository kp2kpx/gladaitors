import { ImageResponse } from "next/og";

export const runtime = "edge";

const BASE = "https://gladaitors.vercel.app";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "FIGHT CHALLENGE";
  const sub = searchParams.get("sub") ?? "I challenge you for a free fight";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(ellipse at 50% 40%, #f8f0e0 0%, #f0e6d3 50%, #deccaa 100%)",
          border: "14px solid #8b1a1a",
          boxSizing: "border-box",
          fontFamily: "Georgia, serif",
          gap: "0px",
        }}
      >
        {/* Top — logo */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "32px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BASE}/logo.png`}
            width={120}
            height={120}
            style={{ objectFit: "contain" }}
          />
        </div>

        {/* Character — centered, large */}
        <div
          style={{
            width: "420px",
            height: "420px",
            borderRadius: "50%",
            background: "radial-gradient(circle, #ddd0b0 0%, #c4a882 65%, #a88860 100%)",
            border: "8px solid #8b1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "40px",
            boxShadow: "0 0 60px rgba(139,26,26,0.3)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BASE}/characters/red/idle.png`}
            width={340}
            height={340}
            style={{ imageRendering: "pixelated", objectFit: "contain" }}
          />
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 72,
            fontWeight: "bold",
            color: "#b8860b",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textAlign: "center",
            marginBottom: "20px",
            display: "flex",
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 30,
            color: "#6b4c2a",
            fontStyle: "italic",
            letterSpacing: "0.04em",
            textAlign: "center",
            marginBottom: "36px",
            display: "flex",
          }}
        >
          {sub}
        </div>

      </div>
    ),
    {
      width: 1200,
      height: 1200,
    }
  );
}
