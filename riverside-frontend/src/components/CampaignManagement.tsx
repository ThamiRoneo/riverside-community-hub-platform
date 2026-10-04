import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiGet, apiPatch, apiPost } from "../lib/api";
import type { CampaignRecord } from "../types";
import {
  errorStyle,
  formStyle,
  itemStyle,
  listStyle,
  metaStyle,
  rowStyle,
  sectionStyle,
} from "./adminStyles";

/**
 * Campaign administration: create and edit.
 *
 * There is no delete. The contract's create and update are admin-only, and the
 * delete was retired rather than implemented, because removing a campaign would
 * take the donation history behind it with it. Closing a campaign is what an
 * admin actually wants, which the `active` field already covers server-side.
 *
 * There is no active toggle here either: GET /api/campaigns returns only active
 * campaigns, so switching one off would drop it from this list with no way to
 * bring it back. That needs a backend list filter first.
 */

interface CampaignFields {
  title: string;
  description: string;
  goal_amount: string;
}

const EMPTY: CampaignFields = { title: "", description: "", goal_amount: "" };

/**
 * A blank goal is left out of the payload entirely. The update schema takes a
 * positive number or nothing at all, so it cannot accept null and an admin
 * cannot clear a goal through this form.
 */
function toPayload(fields: CampaignFields) {
  const payload: Record<string, string | number> = { title: fields.title };
  if (fields.description) payload.description = fields.description;
  if (fields.goal_amount) payload.goal_amount = Number(fields.goal_amount);
  return payload;
}

function fromRecord(campaign: CampaignRecord): CampaignFields {
  return {
    title: campaign.title,
    description: campaign.description ?? "",
    goal_amount:
      campaign.goal_amount === null ? "" : String(campaign.goal_amount),
  };
}

export default function CampaignManagement() {
  const [campaigns, setCampaigns] = useState<CampaignRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [createFields, setCreateFields] = useState<CampaignFields>(EMPTY);
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    fields: CampaignFields;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await apiGet<{ campaigns: CampaignRecord[] }>(
        "/campaigns",
      );
      setCampaigns(response.campaigns);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      await apiPost("/campaigns", toPayload(createFields));
      setMessage(`Added "${createFields.title}".`);
      setCreateFields(EMPTY);
      await load();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Unable to add the campaign",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      await apiPatch(`/campaigns/${editing.id}`, toPayload(editing.fields));
      setMessage(`Saved "${editing.fields.title}".`);
      setEditing(null);
      await load();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Unable to save the campaign",
      );
    } finally {
      setBusy(false);
    }
  }

  function updateEditingField(field: keyof CampaignFields, value: string) {
    setEditing((current) =>
      current
        ? { ...current, fields: { ...current.fields, [field]: value } }
        : current,
    );
  }

  return (
    <section aria-labelledby="campaign-management-heading" style={sectionStyle}>
      <h3 id="campaign-management-heading">Campaigns</h3>

      <form onSubmit={handleCreate} style={formStyle}>
        <label htmlFor="campaign-title">Add a campaign</label>
        <input
          id="campaign-title"
          required
          placeholder="Title"
          value={createFields.title}
          onChange={(event) =>
            setCreateFields({ ...createFields, title: event.target.value })
          }
        />
        <label htmlFor="campaign-goal">Goal amount</label>
        <input
          id="campaign-goal"
          type="number"
          min="1"
          step="1"
          placeholder="Leave blank for no goal"
          value={createFields.goal_amount}
          onChange={(event) =>
            setCreateFields({ ...createFields, goal_amount: event.target.value })
          }
        />
        <textarea
          aria-label="Description"
          placeholder="Description"
          rows={2}
          value={createFields.description}
          onChange={(event) =>
            setCreateFields({ ...createFields, description: event.target.value })
          }
        />
        <div style={rowStyle}>
          <button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Add campaign"}
          </button>
        </div>
      </form>

      {status === "error" ? (
        <p role="alert">Unable to load campaigns. Refresh to try again.</p>
      ) : status === "loading" ? (
        <p role="status">Loading campaigns...</p>
      ) : campaigns.length === 0 ? (
        <p role="status">No active campaigns yet.</p>
      ) : (
        <ul style={listStyle} role="list">
          {campaigns.map((campaign) => (
            <li key={campaign.id} style={itemStyle}>
              <div>
                <strong>{campaign.title}</strong>
                <p style={metaStyle}>
                  {campaign.goal_amount === null
                    ? "No goal set"
                    : `${campaign.current_amount.toLocaleString()} of ${campaign.goal_amount.toLocaleString()}`}
                  {/* Stated in words as well as a bar, since progress_pct is
                      null when no goal is set and has no meaning. */}
                  {campaign.progress_pct === null
                    ? ""
                    : ` · ${campaign.progress_pct}%`}
                </p>
              </div>
              <button
                type="button"
                aria-label={`Edit ${campaign.title}`}
                onClick={() =>
                  setEditing({
                    id: campaign.id,
                    title: campaign.title,
                    fields: fromRecord(campaign),
                  })
                }
              >
                Edit
              </button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <form onSubmit={handleEdit} style={formStyle}>
          <label htmlFor="campaign-edit-title">
            Edit campaign (was {editing.title})
          </label>
          <input
            id="campaign-edit-title"
            required
            aria-label="Title"
            value={editing.fields.title}
            onChange={(event) =>
              updateEditingField("title", event.target.value)
            }
          />
          <label htmlFor="campaign-edit-goal">Goal amount</label>
          <input
            id="campaign-edit-goal"
            type="number"
            min="1"
            step="1"
            value={editing.fields.goal_amount}
            onChange={(event) =>
              updateEditingField("goal_amount", event.target.value)
            }
          />
          <textarea
            aria-label="Description"
            rows={2}
            value={editing.fields.description}
            onChange={(event) =>
              updateEditingField("description", event.target.value)
            }
          />
          <div style={rowStyle}>
            <button type="submit" disabled={busy}>
              Save changes
            </button>
            <button type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
      {problem ? (
        <p role="alert" style={errorStyle}>
          {problem}
        </p>
      ) : null}
    </section>
  );
}