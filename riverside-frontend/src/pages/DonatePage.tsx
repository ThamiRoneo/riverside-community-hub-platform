import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import type { CampaignRecord } from "../types";

export default function DonatePage() {
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [amount, setAmount] = useState(250);

  useEffect(() => {
    apiGet<{ campaigns: CampaignRecord[] }>("/campaigns")
      .then((response) => {
        setCampaign(response.campaigns[0] ?? null);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  if (status === "loading") return <p>Loading donation campaign...</p>;
  if (status === "error")
    return <p role="alert">Unable to load donation campaign.</p>;
  if (!campaign) return <p>No active donation campaign is available.</p>;

  const progress = Math.min(
    campaign.goal_amount
      ? (campaign.current_amount / campaign.goal_amount) * 100
      : 0,
    100,
  );

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}
    >
      <section
        style={{
          background: "white",
          borderRadius: 20,
          padding: "1.5rem",
          boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
        }}
      >
        <h1>Support the campaign</h1>
        <p>{campaign.description ?? "Support Riverside Community Hub."}</p>
        <div style={{ marginBottom: "1rem" }}>
          <strong>R{campaign.current_amount.toLocaleString()}</strong> raised so
          far
          <div
            style={{
              height: 12,
              borderRadius: 999,
              background: "#e5e7eb",
              overflow: "hidden",
              marginTop: "0.75rem",
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
        </div>

        <label
          style={{ display: "block", marginBottom: "0.5rem", fontWeight: 700 }}
        >
          Donation amount
        </label>
        <input
          type="number"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
          style={{
            width: "100%",
            padding: "0.8rem",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            marginBottom: "1rem",
          }}
        />

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            marginBottom: "1rem",
            flexWrap: "wrap",
          }}
        >
          {[50, 100, 250, 500].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              style={{
                background: amount === value ? "#1d3557" : "#e2e8f0",
                color: amount === value ? "white" : "#0f172a",
                border: "none",
                borderRadius: 999,
                padding: "0.6rem 1rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              R{value}
            </button>
          ))}
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <input type="checkbox" />I would like a receipt
        </label>
      </section>

      <section
        style={{
          background: "white",
          borderRadius: 20,
          padding: "1.5rem",
          boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
        }}
      >
        <h2>Donor details</h2>
        <form style={{ display: "grid", gap: "1rem" }}>
          <input
            placeholder="Full name"
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />
          <input
            placeholder="Email address"
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />
          <input
            placeholder="Phone number"
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />
          <select
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          >
            <option>One-off donation</option>
            <option>Adopt a parcel pledge</option>
          </select>
          <button
            type="submit"
            style={{
              background: "#22c55e",
              color: "white",
              border: "none",
              borderRadius: 10,
              padding: "0.9rem 1.2rem",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Submit donation
          </button>
        </form>
      </section>
    </div>
  );
}
