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
          flexDirection: "row",
          background: "radial-gradient(ellipse at 35% 50%, #f8f0e0 0%, #f0e6d3 45%, #e0d0b0 100%)",
          border: "10px solid #8b1a1a",
          fontFamily: "Georgia, serif",
          boxSizing: "border-box",
        }}
      >
        {/* Left content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "48px 32px 48px 60px",
            minWidth: 0,
          }}
        >
          {/* Branding row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: "bold",
                color: "#8b1a1a",
                letterSpacing: "0.3em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              ⚔ GLADAITORS ⚔
            </div>
          </div>

          {/* Title — 62px keeps "FIGHT CHALLENGE" on one line */}
          <div
            style={{
              fontSize: 62,
              fontWeight: "bold",
              color: "#b8860b",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: 1.05,
              marginBottom: "24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {title}
          </div>

          {/* Sub */}
          <div
            style={{
              fontSize: 26,
              color: "#6b4c2a",
              fontStyle: "italic",
              letterSpacing: "0.03em",
              marginBottom: "36px",
              display: "flex",
            }}
          >
            {sub}
          </div>

          {/* Footer row */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: "bold",
                color: "#ffffff",
                background: "#2a4a2a",
                padding: "4px 12px",
                borderRadius: "4px",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              FREE
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#9a7a50",
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              gladaitors.vercel.app
            </div>
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            width: "2px",
            background: "#c4a882",
            margin: "40px 0",
            display: "flex",
          }}
        />

        {/* Right — character */}
        <div
          style={{
            width: "340px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          {/* Stone circle */}
          <div
            style={{
              width: "280px",
              height: "280px",
              borderRadius: "50%",
              background: "radial-gradient(circle, #ddd0b0 0%, #c4a882 70%, #a8885a 100%)",
              border: "5px solid #8b1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${BASE}/characters/red/idle.png`}
              width={220}
              height={220}
              style={{
                imageRendering: "pixelated",
                objectFit: "contain",
              }}
            />
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
