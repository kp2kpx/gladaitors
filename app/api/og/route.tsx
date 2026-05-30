import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title") ?? "CHALLENGE AWAITS";
  const sub = searchParams.get("sub") ?? "Build your gladiator. Fight to the death.";

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
          background: "#1a0a00",
          fontFamily: "serif",
          padding: "40px",
        }}
      >
        {/* Top decorative bar */}
        <div style={{ display: "flex", width: "100%", height: "4px", background: "#8b1a1a", marginBottom: "32px" }} />

        <div style={{ fontSize: 28, color: "#c4a882", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: "16px" }}>
          ⚔️ GLADAITORS ⚔️
        </div>

        <div
          style={{
            fontSize: 52,
            fontWeight: "bold",
            color: "#b8860b",
            textAlign: "center",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: "20px",
            lineHeight: 1.1,
          }}
        >
          {title}
        </div>

        <div style={{ fontSize: 22, color: "#a08060", textAlign: "center", letterSpacing: "0.05em", marginBottom: "40px" }}>
          {sub}
        </div>

        <div style={{ display: "flex", width: "100%", height: "4px", background: "#8b1a1a", marginTop: "auto" }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
