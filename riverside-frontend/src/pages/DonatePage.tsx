import { type FormEvent, useEffect, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import type { CampaignRecord, DonationType } from "../types";

export default function DonatePage() {
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [amount, setAmount] = useState(250);
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donationType, setDonationType] = useState<DonationType>("one_off");
  const [anonymous, setAnonymous] = useState(false);
  const [receiptOptIn, setReceiptOptIn] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

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
  const activeCampaign = campaign;

  // The server derives progress_pct so the list, the detail endpoint and this
  // page cannot disagree. Recomputing it here is what made the bar clamp at 100
  // and hide an overfunded campaign.
  const progress = campaign.progress_pct;
  const hasGoal = campaign.goal_amount !== null && progress !== null;
  const goalReached = hasGoal && progress >= 100;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitStatus("submitting");

    try {
      await apiPost("/donations", {
        campaign_id: activeCampaign.id,
        amount,
        donor_name: anonymous ? undefined : donorName || undefined,
        donor_email: anonymous ? undefined : donorEmail || undefined,
        donor_phone: anonymous ? undefined : donorPhone || undefined,
        type: donationType,
        anonymous,
        receipt_opt_in: receiptOptIn,
      });
      setSubmitStatus("success");
    } catch {
      setSubmitStatus("error");
    }
  }

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
          {hasGoal ? (
            <>
              {/* The visual bar is decorative; the sentence below is what a
                  screen reader and a colour-blind reader both rely on. */}
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${progress}% of the R${campaign.goal_amount?.toLocaleString()} goal`}
                aria-label={`Progress toward the R${campaign.goal_amount?.toLocaleString()} goal`}
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
                    width: `${Math.min(progress, 100)}%`,
                    height: "100%",
                    background: goalReached ? "#16a34a" : "#22c55e",
                  }}
                />
              </div>
              <p style={{ marginTop: "0.5rem" }}>
                {goalReached
                  ? `Goal reached — R${campaign.current_amount.toLocaleString()} raised against a R${campaign.goal_amount?.toLocaleString()} goal.`
                  : `${progress}% of the R${campaign.goal_amount?.toLocaleString()} goal.`}
              </p>
            </>
          ) : (
            <p style={{ marginTop: "0.5rem" }}>
              This campaign has no funding goal set.
            </p>
          )}
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
          <input
            type="checkbox"
            checked={receiptOptIn}
            onChange={(event) => setReceiptOptIn(event.target.checked)}
          />
          I would like a receipt
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
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <input
            placeholder="Full name"
            value={donorName}
            onChange={(event) => setDonorName(event.target.value)}
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />
          <input
            placeholder="Email address"
            type="email"
            value={donorEmail}
            onChange={(event) => setDonorEmail(event.target.value)}
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />
          <input
            placeholder="Phone number"
            value={donorPhone}
            onChange={(event) => setDonorPhone(event.target.value)}
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          />
          <select
            value={donationType}
            onChange={(event) =>
              setDonationType(event.target.value as DonationType)
            }
            style={{
              padding: "0.8rem",
              borderRadius: 10,
              border: "1px solid #cbd5e1",
            }}
          >
            <option value="one_off">One-off donation</option>
            <option value="pledge_intent">Adopt a parcel pledge</option>
          </select>
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
          >
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
            />
            Make this donation anonymous
          </label>
          {submitStatus === "error" ? (
            <p role="alert">Unable to submit donation. Please try again.</p>
          ) : null}
          {submitStatus === "success" ? (
            <p role="status">Thank you. Your donation has been recorded.</p>
          ) : null}
          <button
            type="submit"
            disabled={submitStatus === "submitting"}
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
            {submitStatus === "submitting"
              ? "Submitting..."
              : "Submit donation"}
          </button>
        </form>
      </section>
    </div>
  );
}
