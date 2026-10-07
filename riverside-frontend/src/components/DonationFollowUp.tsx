import { useCallback, useEffect, useState } from "react";

import { apiDownload, apiGet, apiPatch } from "../lib/api";
import type { DonationRecord } from "../types";

interface DonationFollowUpProps {
  onActionMessage: (message: string) => void;
}

export default function DonationFollowUp({ onActionMessage }: DonationFollowUpProps) {
  const [donations, setDonations] = useState<DonationRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(20);
  const [followUpNote, setFollowUpNote] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const loadDonations = useCallback(async (pageNum: number) => {
    setStatus("loading");
    try {
      const response = await apiGet<{ donations: DonationRecord[]; total: number }>(
        `/donations?page=${pageNum}&page_size=${pageSize}`,
      );
      setDonations(response.donations);
      setTotal(response.total);
      setPage(pageNum);
    } catch {
      onActionMessage("Unable to load donations");
      setStatus("error");
    } finally {
      setStatus("ready");
    }
  }, [onActionMessage, pageSize]);

  useEffect(() => {
    loadDonations(1);
  }, [loadDonations]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function completeFollowUp(id: string) {
    const staffNote = followUpNote[id]?.trim();

    try {
      await apiPatch(`/donations/${id}/follow-up`, {
        ...(staffNote ? { staff_note: staffNote } : {}),
      });
      setDonations((current) =>
        current.map((donation) =>
          donation.id === id
            ? {
                ...donation,
                status: "followed_up",
                ...(staffNote ? { staff_note: staffNote } : {}),
              }
            : donation,
        ),
      );
      onActionMessage("Donation follow-up completed.");
    } catch (error) {
      onActionMessage(
        error instanceof Error ? error.message : "Unable to complete follow-up",
      );
    }
  }

  async function exportDonations() {
    try {
      const { blob, filename } = await apiDownload("/donations/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename ?? "donations.csv";
      a.click();
      URL.revokeObjectURL(url);
      onActionMessage(`Donation export downloaded as ${filename ?? "donations.csv"}.`);
    } catch (error) {
      onActionMessage(
        error instanceof Error ? error.message : "Unable to export donations",
      );
    }
  }

  return (
    <section
      style={{
        background: "white",
        borderRadius: 18,
        padding: "1.5rem",
        boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
      }}
    >
      <h3>Donation follow-up</h3>
      <button type="button" onClick={exportDonations}>
        Export donations CSV
      </button>
      {status === "loading" ? <p>Loading donations...</p> : null}
      {status === "error" ? (
        <p role="alert">Unable to load donations.</p>
      ) : null}
      {donations.length === 0 && status === "ready" ? (
        <p>No donations found.</p>
      ) : null}
      <ul>
        {donations.map((donation) => (
          <li key={donation.id} style={{ marginBottom: "1rem" }}>
            <strong>
              R{Number(donation.amount).toLocaleString()} -{" "}
              {donation.campaigns?.title ?? "Campaign"}
            </strong>
            <div>
              {donation.donor_name ?? "Anonymous donor"} ({donation.status})
            </div>
            {donation.status === "pending_followup" ? (
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "0.4rem",
                }}
              >
                <input
                  aria-label={`Follow-up note for donation ${donation.id}`}
                  placeholder="Staff note"
                  value={followUpNote[donation.id] ?? ""}
                  onChange={(event) =>
                    setFollowUpNote((current) => ({
                      ...current,
                      [donation.id]: event.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  onClick={() => completeFollowUp(donation.id)}
                >
                  Complete follow-up
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            type="button"
            onClick={() => loadDonations(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => loadDonations(page + 1)}
            disabled={page >= totalPages}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
