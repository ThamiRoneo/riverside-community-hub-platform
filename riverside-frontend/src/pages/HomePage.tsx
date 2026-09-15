import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import type { CampaignRecord, ProgrammeRecord } from "../types";

export default function HomePage() {
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    Promise.all([
      apiGet<{ campaigns: CampaignRecord[] }>("/campaigns"),
      apiGet<{ programmes: ProgrammeRecord[] }>("/programmes"),
    ])
      .then(([campaignResponse, programmeResponse]) => {
        setCampaign(campaignResponse.campaigns[0] ?? null);
        setProgrammes(programmeResponse.programmes.slice(0, 3));
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const progress = campaign?.goal_amount
    ? Math.min((campaign.current_amount / campaign.goal_amount) * 100, 100)
    : 0;

  return (
    <div>
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 0.8fr",
          gap: "2rem",
          alignItems: "center",
          background: "linear-gradient(135deg, #e0f2fe, #fef3c7)",
          borderRadius: 24,
          padding: "2rem",
          marginBottom: "2rem",
        }}
      >
        <div>
          <p
            style={{
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#1d4ed8",
              fontWeight: 700,
            }}
          >
            Community support
          </p>
          <h1 style={{ fontSize: "3rem", margin: "0.5rem 0 1rem" }}>
            A hub for learning, connection, and care.
          </h1>
          <p style={{ fontSize: "1.1rem", lineHeight: 1.6, maxWidth: 620 }}>
            Riverside Community Hub connects members, volunteers, and staff
            through youth programmes, shared resources, and compassionate local
            action.
          </p>

          <div
            style={{
              display: "flex",
              gap: "1rem",
              marginTop: "1.5rem",
              flexWrap: "wrap",
            }}
          >
            <Link
              to="/donate"
              style={{
                background: "#1d3557",
                color: "white",
                padding: "0.9rem 1.3rem",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Donate now
            </Link>
            <Link
              to="/programmes"
              style={{
                background: "white",
                color: "#1d3557",
                padding: "0.9rem 1.3rem",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              Explore programmes
            </Link>
          </div>
        </div>

        <div
          style={{
            background: "white",
            padding: "1.5rem",
            borderRadius: 20,
            boxShadow: "0 10px 30px rgba(0,0,0,0.06)",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Current campaign</h3>
          {status === "loading" ? <p>Loading campaign...</p> : null}
          {status === "error" ? (
            <p role="alert">Unable to load campaign data.</p>
          ) : null}
          {status === "ready" && !campaign ? (
            <p>No active campaign right now.</p>
          ) : null}
          {campaign ? (
            <>
              <p
                style={{
                  fontSize: "1.8rem",
                  fontWeight: 800,
                  margin: "0.25rem 0",
                }}
              >
                R{campaign.current_amount.toLocaleString()}
              </p>
              <p>
                Raised so far of R
                {campaign.goal_amount?.toLocaleString() ?? "the campaign goal"}
              </p>
              <div
                style={{
                  height: 12,
                  borderRadius: 999,
                  background: "#e5e7eb",
                  overflow: "hidden",
                  margin: "1rem 0",
                }}
              >
                <div
                  style={{
                    width: `${progress}%`,
                    height: "100%",
                    background: "#22c55e",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.9rem",
                  color: "#475569",
                }}
              >
                <span>{Math.round(progress)}% funded</span>
                <span>
                  Goal: R{campaign.goal_amount?.toLocaleString() ?? "TBC"}
                </span>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section style={{ marginTop: "2.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <h2 style={{ margin: 0 }}>Featured programmes</h2>
          <Link
            to="/programmes"
            style={{
              color: "#1d4ed8",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            View all
          </Link>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {programmes.map((programme) => (
            <article
              key={programme.id}
              style={{
                background: "white",
                borderRadius: 16,
                overflow: "hidden",
                boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
              }}
            >
              <img
                src={
                  programme.image_url ??
                  "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80"
                }
                alt={programme.title}
                style={{ width: "100%", height: 180, objectFit: "cover" }}
              />
              <div style={{ padding: "1rem" }}>
                <p style={{ color: "#1d4ed8", fontWeight: 700 }}>
                  {programme.age_range ?? "All ages"}
                </p>
                <h3 style={{ margin: "0.4rem 0" }}>{programme.title}</h3>
                <p style={{ color: "#475569", minHeight: 80 }}>
                  {programme.description}
                </p>
                <small
                  style={{
                    display: "block",
                    marginTop: "0.5rem",
                    color: "#334155",
                  }}
                >
                  {programme.schedule_info ?? "Schedule to be confirmed"}
                </small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
