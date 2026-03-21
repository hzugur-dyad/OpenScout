import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import type { HiringFitTag } from "@/lib/hiring-score";
import { fetchPublicCandidateProfileBySlug } from "@/lib/public-candidate-profile";
import { enforceRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const PRIMARY = "#D4A843";
const PRIMARY_DARK = "#B8912E";
const PRIMARY_MUTED = "rgba(212, 168, 67, 0.15)";
const BORDER = "rgba(0, 0, 0, 0.08)";

function fitBadgeStyle(tag: HiringFitTag): { backgroundColor: string; color: string } {
  switch (tag) {
    case "Strong Fit":
      return { backgroundColor: "#ecfdf5", color: "#065f46" };
    case "Good Fit":
      return { backgroundColor: "#e0f2fe", color: "#075985" };
    case "Average":
      return { backgroundColor: "#f3f4f6", color: "#374151" };
    case "Weak Fit":
    default:
      return { backgroundColor: "#ffedd5", color: "#9a3412" };
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const limited = await enforceRateLimit(request, null, {
    namespace: "og-profile-public",
    preset: "lenient",
  });
  if (limited) return limited;

  const { slug } = await params;
  const fetched = await fetchPublicCandidateProfileBySlug(slug ?? "");
  if (fetched.status !== "ok" || fetched.data.hidden) {
    return new Response("Not found", { status: 404 });
  }

  const d = fetched.data;
  const firstName = d.firstName?.trim() || "Candidate";
  const role = d.targetRole?.trim() || "OpenScout profile";
  const score = typeof d.bestScoutScore === "number" ? d.bestScoutScore : 0;
  const fitTag = d.hiringFitLabel ?? "Average";
  const badge = fitBadgeStyle(fitTag);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#ffffff",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "48px 56px 24px",
            borderBottom: `1px solid ${BORDER}`,
            backgroundColor: PRIMARY_MUTED,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 999,
                backgroundColor: PRIMARY,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 28,
                fontWeight: 700,
              }}
            >
              {score}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 14, color: "#6b7280" }}>OpenScout · Candidate profile</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>{firstName}</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: "#374151" }}>{role}</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: PRIMARY_DARK, textTransform: "uppercase" }}>
              Hiring signal
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#111827" }}>
              {typeof d.bestHiringScore === "number" ? d.bestHiringScore : "—"}
            </div>
            <div
              style={{
                marginTop: 4,
                padding: "8px 14px",
                borderRadius: 8,
                backgroundColor: badge.backgroundColor,
                color: badge.color,
                fontSize: 16,
                fontWeight: 600,
              }}
            >
              {fitTag}
            </div>
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "40px 56px 56px",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 22, color: "#374151", fontWeight: 600 }}>
            Best Scout Score · {score}/100
          </div>
          <div style={{ fontSize: 18, color: "#6b7280" }}>
            Verified practice and scoring on OpenScout — share your profile with employers.
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
