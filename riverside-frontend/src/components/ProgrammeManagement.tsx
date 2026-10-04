import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import type { ProgrammeRecord } from "../types";
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
 * Programme administration: create, edit and delete.
 *
 * Staff and admins may both create and edit; only an admin may delete, per the
 * contract, so the delete button is hidden from staff rather than left to fail
 * with a 403.
 *
 * There is deliberately no "active" toggle. GET /api/programmes only returns
 * active programmes, so switching one off here would remove it from this list
 * with no way to bring it back through the UI. That needs a backend filter
 * before it can be offered.
 */

interface ProgrammeFields {
  title: string;
  description: string;
  age_range: string;
  schedule_info: string;
}

const EMPTY: ProgrammeFields = {
  title: "",
  description: "",
  age_range: "",
  schedule_info: "",
};

/** The wire body omits blank optional fields rather than sending empty strings. */
function toPayload(fields: ProgrammeFields) {
  const payload: Record<string, string> = { title: fields.title };
  if (fields.description) payload.description = fields.description;
  if (fields.age_range) payload.age_range = fields.age_range;
  if (fields.schedule_info) payload.schedule_info = fields.schedule_info;
  return payload;
}

function fromRecord(programme: ProgrammeRecord): ProgrammeFields {
  return {
    title: programme.title,
    description: programme.description ?? "",
    age_range: programme.age_range ?? "",
    schedule_info: programme.schedule_info ?? "",
  };
}

export default function ProgrammeManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [createFields, setCreateFields] = useState<ProgrammeFields>(EMPTY);
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    fields: ProgrammeFields;
  } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await apiGet<{ programmes: ProgrammeRecord[] }>(
        "/programmes",
      );
      setProgrammes(response.programmes);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function report(error: unknown, fallback: string) {
    setMessage("");
    setProblem(error instanceof Error ? error.message : fallback);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setProblem("");
    try {
      await apiPost("/programmes", toPayload(createFields));
      setCreateFields(EMPTY);
      setMessage(`Added "${createFields.title}".`);
      await load();
    } catch (error) {
      report(error, "Unable to add the programme");
    } finally {
      setBusy(false);
    }
  }

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setBusy(true);
    setProblem("");
    try {
      await apiPatch(`/programmes/${editing.id}`, toPayload(editing.fields));
      setMessage(`Saved "${editing.fields.title}".`);
      setEditing(null);
      await load();
    } catch (error) {
      report(error, "Unable to save the programme");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setProblem("");
    try {
      await apiDelete(`/programmes/${deleting.id}`);
      setMessage(`Deleted "${deleting.title}".`);
      setDeleting(null);
      await load();
    } catch (error) {
      report(error, "Unable to delete the programme");
    } finally {
      setBusy(false);
    }
  }

  function updateEditingField(field: keyof ProgrammeFields, value: string) {
    setEditing((current) =>
      current ? { ...current, fields: { ...current.fields, [field]: value } } : current,
    );
  }

  return (
    <section aria-labelledby="programme-management-heading" style={sectionStyle}>
      <h3 id="programme-management-heading">Programmes</h3>

      <form onSubmit={handleCreate} style={formStyle}>
        <label htmlFor="programme-title">Add a programme</label>
        <input
          id="programme-title"
          required
          placeholder="Title"
          value={createFields.title}
          onChange={(event) =>
            setCreateFields({ ...createFields, title: event.target.value })
          }
        />
        <input
          aria-label="Age range"
          placeholder="Age range, e.g. 5-12"
          value={createFields.age_range}
          onChange={(event) =>
            setCreateFields({ ...createFields, age_range: event.target.value })
          }
        />
        <input
          aria-label="Schedule"
          placeholder="Schedule, e.g. Mondays 16:00"
          value={createFields.schedule_info}
          onChange={(event) =>
            setCreateFields({ ...createFields, schedule_info: event.target.value })
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
            {busy ? "Saving..." : "Add programme"}
          </button>
        </div>
      </form>

      {status === "error" ? (
        <p role="alert">Unable to load programmes. Refresh to try again.</p>
      ) : status === "loading" ? (
        <p role="status">Loading programmes...</p>
      ) : programmes.length === 0 ? (
        <p role="status">No active programmes yet.</p>
      ) : (
        <ul style={listStyle} role="list">
          {programmes.map((programme) => (
            <li key={programme.id} style={itemStyle}>
              <div>
                <strong>{programme.title}</strong>
                <p style={metaStyle}>
                  {[programme.age_range, programme.schedule_info]
                    .filter(Boolean)
                    .join(" · ") || "No age range or schedule set"}
                </p>
                {programme.description ? (
                  <p style={metaStyle}>{programme.description}</p>
                ) : null}
              </div>
              <div style={rowStyle}>
                <button
                  type="button"
                  aria-label={`Edit ${programme.title}`}
                  onClick={() =>
                    setEditing({
                      id: programme.id,
                      title: programme.title,
                      fields: fromRecord(programme),
                    })
                  }
                >
                  Edit
                </button>
                {isAdmin ? (
                  <button
                    type="button"
                    aria-label={`Delete ${programme.title}`}
                    onClick={() =>
                      setDeleting({ id: programme.id, title: programme.title })
                    }
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <form onSubmit={handleEdit} style={formStyle}>
          <label htmlFor="programme-edit-title">
            Edit programme (was {editing.title})
          </label>
          <input
            id="programme-edit-title"
            required
            aria-label="Title"
            value={editing.fields.title}
            onChange={(event) =>
              updateEditingField("title", event.target.value)
            }
          />
          <input
            aria-label="Age range"
            value={editing.fields.age_range}
            onChange={(event) =>
              updateEditingField("age_range", event.target.value)
            }
          />
          <input
            aria-label="Schedule"
            value={editing.fields.schedule_info}
            onChange={(event) =>
              updateEditingField("schedule_info", event.target.value)
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

      {deleting ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleDelete();
          }}
          style={formStyle}
        >
          <p>Delete "{deleting.title}"? This cannot be undone.</p>
          <div style={rowStyle}>
            <button type="submit" disabled={busy}>
              Yes, delete it
            </button>
            <button type="button" onClick={() => setDeleting(null)}>
              Keep it
            </button>
          </div>
        </form>
      ) : null}

      {message ? <p role="status">{message}</p> : null}
      {problem ? <p role="alert" style={errorStyle}>{problem}</p> : null}
    </section>
  );
}