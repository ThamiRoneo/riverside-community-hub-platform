import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiDelete, apiGet, apiPatch, apiPost } from "../lib/api";
import type { ResourceRecord, ResourceType } from "../types";
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
 * Resource administration: create, edit and delete.
 *
 * This replaces the create-only form that used to live inside StaffDashboard.
 * The type cannot be changed by an edit: the contract's update body has no
 * `type`, because moving a room to the equipment table would be a different
 * record, not an edit of this one. Changing it means deleting and creating.
 *
 * Only an admin may delete. Staff and admins may both create and edit.
 */

interface ResourceFields {
  name: string;
  capacity: string;
  description: string;
}

const EMPTY: ResourceFields = { name: "", capacity: "", description: "" };

function toPayload(fields: ResourceFields) {
  const payload: Record<string, string | number> = { name: fields.name };
  if (fields.capacity) payload.capacity = Number(fields.capacity);
  if (fields.description) payload.description = fields.description;
  return payload;
}

function fromRecord(resource: ResourceRecord): ResourceFields {
  return {
    name: resource.name,
    capacity: resource.capacity === null ? "" : String(resource.capacity),
    description: resource.description ?? "",
  };
}

export default function InventoryManagement() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [createFields, setCreateFields] = useState<ResourceFields>(EMPTY);
  const [resourceType, setResourceType] = useState<ResourceType>("room");
  const [editing, setEditing] = useState<{
    id: string;
    title: string;
    fields: ResourceFields;
  } | null>(null);
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");

  const load = useCallback(async () => {
    try {
      // The catalogue is paginated and this panel renders every row it is
      // given, so ask for the server's maximum rather than the default ten.
      const response = await apiGet<{ resources: ResourceRecord[] }>(
        "/resources?page_size=100",
      );
      setResources(response.resources);
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
      await apiPost("/resources", {
        ...toPayload(createFields),
        type: resourceType,
      });
      setMessage(`Added "${createFields.name}".`);
      setCreateFields(EMPTY);
      await load();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Unable to add the resource",
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
      await apiPatch(`/resources/${editing.id}`, toPayload(editing.fields));
      setMessage(`Saved "${editing.fields.name}".`);
      setEditing(null);
      await load();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Unable to save the resource",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setBusy(true);
    setMessage("");
    setProblem("");
    try {
      await apiDelete(`/resources/${deleting.id}`);
      setMessage(`Deleted "${deleting.title}".`);
      setDeleting(null);
      await load();
    } catch (error) {
      setProblem(
        error instanceof Error ? error.message : "Unable to delete the resource",
      );
    } finally {
      setBusy(false);
    }
  }

  function updateEditingField(field: keyof ResourceFields, value: string) {
    setEditing((current) =>
      current
        ? { ...current, fields: { ...current.fields, [field]: value } }
        : current,
    );
  }

  return (
    <section aria-labelledby="inventory-heading" style={sectionStyle}>
      <h2 id="inventory-heading">Inventory overview</h2>

      <form onSubmit={handleCreate} style={formStyle}>
        <label htmlFor="resource-name">Add a room or piece of equipment</label>
        <input
          id="resource-name"
          required
          placeholder="Name"
          value={createFields.name}
          onChange={(event) =>
            setCreateFields({ ...createFields, name: event.target.value })
          }
        />
        <label htmlFor="resource-type">Type</label>
        <select
          id="resource-type"
          value={resourceType}
          onChange={(event) =>
            setResourceType(event.target.value as ResourceType)
          }
        >
          <option value="room">Room</option>
          <option value="equipment">Equipment</option>
        </select>
        <label htmlFor="resource-capacity">Capacity</label>
        <input
          id="resource-capacity"
          type="number"
          min="1"
          max="1000"
          step="1"
          placeholder="Leave blank for no limit"
          value={createFields.capacity}
          onChange={(event) =>
            setCreateFields({ ...createFields, capacity: event.target.value })
          }
        />
        <label htmlFor="resource-description">Description</label>
        <input
          id="resource-description"
          value={createFields.description}
          onChange={(event) =>
            setCreateFields({ ...createFields, description: event.target.value })
          }
        />
        <div style={rowStyle}>
          <button type="submit" disabled={busy}>
            {busy ? "Saving..." : "Add resource"}
          </button>
        </div>
      </form>

      {status === "error" ? (
        <p role="alert">Unable to load resources. Refresh to try again.</p>
      ) : status === "loading" ? (
        <p role="status">Loading resources...</p>
      ) : resources.length === 0 ? (
        <p role="status">No rooms or equipment yet. Add one with the form above.</p>
      ) : (
        <ul style={listStyle} role="list">
          {resources.map((resource) => (
            <li key={resource.id} style={itemStyle}>
              <div>
                <strong>{resource.name}</strong>
                <p style={metaStyle}>
                  {resource.type === "room" ? "Room" : "Equipment"} ·{" "}
                  {resource.capacity
                    ? `Up to ${resource.capacity} people`
                    : "No capacity limit"}
                </p>
                {resource.description ? (
                  <p style={metaStyle}>{resource.description}</p>
                ) : null}
              </div>
              <div style={rowStyle}>
                <button
                  type="button"
                  aria-label={`Edit ${resource.name}`}
                  onClick={() =>
                    setEditing({
                      id: resource.id,
                      title: resource.name,
                      fields: fromRecord(resource),
                    })
                  }
                >
                  Edit
                </button>
                {isAdmin ? (
                  <button
                    type="button"
                    aria-label={`Delete ${resource.name}`}
                    onClick={() =>
                      setDeleting({ id: resource.id, title: resource.name })
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
          <label htmlFor="resource-edit-name">
            Edit resource (was {editing.title})
          </label>
          <input
            id="resource-edit-name"
            required
            aria-label="Name"
            value={editing.fields.name}
            onChange={(event) => updateEditingField("name", event.target.value)}
          />
          <label htmlFor="resource-edit-capacity">Capacity</label>
          <input
            id="resource-edit-capacity"
            type="number"
            min="1"
            max="1000"
            step="1"
            value={editing.fields.capacity}
            onChange={(event) =>
              updateEditingField("capacity", event.target.value)
            }
          />
          <label htmlFor="resource-edit-description">Description</label>
          <input
            id="resource-edit-description"
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
          <p>
            Delete "{deleting.title}"? Bookings already made against it are kept,
            but it can no longer be booked.
          </p>
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
      {problem ? (
        <p role="alert" style={errorStyle}>
          {problem}
        </p>
      ) : null}
    </section>
  );
}