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
          background: "#f0e6d3",
          fontFamily: "serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Parchment texture overlay — subtle inner shadow effect */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at 30% 50%, #f5edd8 0%, #f0e6d3 40%, #e4d4b8 100%)",
            display: "flex",
          }}
        />

        {/* Top crimson bar */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "8px",
            background: "#8b1a1a",
            display: "flex",
          }}
        />
        {/* Bottom crimson bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "8px",
            background: "#8b1a1a",
            display: "flex",
          }}
        />
        {/* Left side border */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "8px",
            bottom: 0,
            background: "#8b1a1a",
            display: "flex",
          }}
        />
        {/* Right side border */}
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: "8px",
            bottom: 0,
            background: "#8b1a1a",
            display: "flex",
          }}
        />

        {/* Left content column */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "60px 48px 60px 64px",
            zIndex: 1,
          }}
        >
          {/* ⚔ GLADAITORS ⚔ badge */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div style={{ width: "48px", height: "3px", background: "#8b1a1a", display: "flex" }} />
            <div
              style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#8b1a1a",
                letterSpacing: "0.35em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              ⚔ GLADAITORS ⚔
            </div>
            <div style={{ width: "48px", height: "3px", background: "#8b1a1a", display: "flex" }} />
          </div>

          {/* Main title */}
          <div
            style={{
              fontSize: 80,
              fontWeight: "bold",
              color: "#b8860b",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              lineHeight: 1.0,
              marginBottom: "28px",
              display: "flex",
              flexWrap: "wrap",
            }}
          >
            {title}
          </div>

          {/* Sub text */}
          <div
            style={{
              fontSize: 28,
              color: "#6b4c2a",
              letterSpacing: "0.04em",
              fontStyle: "italic",
              display: "flex",
            }}
          >
            {sub}
          </div>

          {/* Bottom tag */}
          <div
            style={{
              marginTop: "40px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: "bold",
                color: "#fff",
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
                fontSize: 14,
                color: "#9a7a50",
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              gladaitors.vercel.app
            </div>
          </div>
        </div>

        {/* Right column — character */}
        <div
          style={{
            width: "380px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
            paddingRight: "24px",
          }}
        >
          {/* Stone circle backdrop */}
          <div
            style={{
              position: "absolute",
              width: "320px",
              height: "320px",
              borderRadius: "50%",
              background: "radial-gradient(circle, #d8ccb4 0%, #c4a882 60%, #b89870 100%)",
              border: "4px solid #8b1a1a",
              display: "flex",
            }}
          />
          {/* Gladiator sprite */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`${BASE}/characters/red/idle.png`}
            width={260}
            height={260}
            style={{
              position: "relative",
              imageRendering: "pixelated",
              filter: "drop-shadow(0 8px 24px rgba(139,26,26,0.5))",
              objectFit: "contain",
            }}
          />
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
