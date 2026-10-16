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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <section className="bg-white rounded-2xl p-6 shadow-sm">
        <h1 className="text-2xl font-bold mb-4">Support the campaign</h1>
        <p className="text-gray-700 mb-4">{campaign.description ?? "Support Riverside Community Hub."}</p>
        <div className="mb-4">
          <strong className="text-xl">R{campaign.current_amount.toLocaleString()}</strong> raised so
          far
          {hasGoal ? (
            <>
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${progress}% of the R${campaign.goal_amount?.toLocaleString()} goal`}
                aria-label={`Progress toward the R${campaign.goal_amount?.toLocaleString()} goal`}
                className="h-3 rounded-full bg-gray-200 overflow-hidden mt-3"
              >
                <div
                  className={`h-full transition-all ${goalReached ? "bg-green-600" : "bg-green-500"}`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-gray-700">
                {goalReached
                  ? `Goal reached — R${campaign.current_amount.toLocaleString()} raised against a R${campaign.goal_amount?.toLocaleString()} goal.`
                  : `${progress}% of the R${campaign.goal_amount?.toLocaleString()} goal.`}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-gray-700">
              This campaign has no funding goal set.
            </p>
          )}
        </div>

        <label className="block mb-2 font-bold">
          Donation amount
        </label>
        <input
          type="number"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <div className="flex flex-wrap gap-3 mb-4">
          {[50, 100, 250, 500].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setAmount(value)}
              className={`border-none rounded-full px-4 py-2 font-bold transition-colors ${
                amount === value
                  ? "bg-blue-900 text-white"
                  : "bg-gray-200 text-gray-900 hover:bg-gray-300"
              }`}
            >
              R{value}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 mb-4">
          <input
            type="checkbox"
            checked={receiptOptIn}
            onChange={(event) => setReceiptOptIn(event.target.checked)}
          />
          I would like a receipt
        </label>
      </section>

      <section className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-bold mb-4">Donor details</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            placeholder="Full name"
            value={donorName}
            onChange={(event) => setDonorName(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Email address"
            type="email"
            value={donorEmail}
            onChange={(event) => setDonorEmail(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            placeholder="Phone number"
            value={donorPhone}
            onChange={(event) => setDonorPhone(event.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={donationType}
            onChange={(event) =>
              setDonationType(event.target.value as DonationType)
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="one_off">One-off donation</option>
            <option value="pledge_intent">Adopt a parcel pledge</option>
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(event) => setAnonymous(event.target.checked)}
            />
            Make this donation anonymous
          </label>
          {submitStatus === "error" ? (
            <p role="alert" className="text-red-600">Unable to submit donation. Please try again.</p>
          ) : null}
          {submitStatus === "success" ? (
            <p role="status" className="text-green-600">Thank you. Your donation has been recorded.</p>
          ) : null}
          <button
            type="submit"
            disabled={submitStatus === "submitting"}
            className="bg-green-500 text-white rounded-lg py-3 font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
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
