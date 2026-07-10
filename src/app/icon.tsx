import { ImageResponse } from "next/og";

// Replaces the default Next.js favicon with the brand mark — Aposta
// Nacional blue rounded square + white "AN" monogram — matching the
// sidebar logo in `src/components/layout/sidebar.tsx`. Next.js renders
// this at build time and auto-injects <link rel="icon"> into <head>.
//
// This route takes precedence over src/app/favicon.ico, which is the
// Next.js default and can stay on disk harmlessly (or be removed).

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#024997", // Aposta Nacional primary blue
          borderRadius: 6,
        }}
      >
        <span
          style={{
            color: "#ffffff",
            fontSize: 15,
            fontWeight: 900,
            letterSpacing: "-0.06em",
          }}
        >
          AN
        </span>
      </div>
    ),
    { ...size },
  );
}
