import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import type { ResourceRecord, ResourceType } from "../types";

const FILTERS = [
  { label: "Everything", value: "" },
  { label: "Rooms", value: "room" },
  { label: "Equipment", value: "equipment" },
] as const;

export default function FacilitiesPage() {
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [type, setType] = useState<ResourceType | "">("");
  const [capacityMin, setCapacityMin] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (capacityMin) params.set("capacity_min", capacityMin);
    if (search.trim()) params.set("search", search.trim());
    params.set("page_size", "100");

    setStatus("loading");
    apiGet<{ resources: ResourceRecord[] }>(`/resources?${params.toString()}`)
      .then((response) => {
        setResources(response.resources);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [type, capacityMin, search]);

  return (
    <div>
      <h1>Rooms &amp; Equipment</h1>

      <form
        role="search"
        aria-label="Filter resources"
        onSubmit={(event) => event.preventDefault()}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1.5rem",
        }}
      >
        <label htmlFor="resource-search" style={labelStyle}>
          Search
          <input
            id="resource-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Boardroom, gym…"
            style={inputStyle}
          />
        </label>

        <label htmlFor="resource-type" style={labelStyle}>
          Type
          <select
            id="resource-type"
            value={type}
            onChange={(event) => setType(event.target.value as ResourceType | "")}
            style={inputStyle}
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="resource-capacity" style={labelStyle}>
          Minimum capacity
          <input
            id="resource-capacity"
            type="number"
            min={1}
            value={capacityMin}
            onChange={(event) => setCapacityMin(event.target.value)}
            style={inputStyle}
          />
        </label>
      </form>

      <p aria-live="polite" role="status">
        {status === "loading" ? "Loading resources…" : null}
        {status === "error" ? "Unable to load resources." : null}
        {status === "ready" && resources.length === 0
          ? "No resources match these filters."
          : null}
      </p>

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {resources.map((resource) => (
          <li key={resource.id} style={cardStyle}>
            <div style={cardHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{resource.name}</h2>
              <span style={badgeStyle}>
                {resource.type === "room" ? "Room" : "Equipment"}
              </span>
            </div>

            <p>{resource.description ?? "Part of the Riverside community hub."}</p>

            {resource.capacity ? (
              <p>
                <strong>Capacity:</strong> {resource.capacity}
              </p>
            ) : null}

            {resource.hourly_rate ? (
              <p>
                <strong>Rate:</strong> R{resource.hourly_rate}/hr
              </p>
            ) : null}

            <button
              type="button"
              style={buttonStyle}
              aria-label={`Book ${resource.name}`}
            >
              Book now
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const labelStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: "0.25rem",
  fontSize: "0.875rem",
  fontWeight: 600,
};

const inputStyle = {
  padding: "0.5rem 0.75rem",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontSize: "0.95rem",
  fontWeight: 400,
};

const cardStyle = {
  background: "white",
  borderRadius: 16,
  padding: "1.25rem",
  boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
};

const cardHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "1rem",
  marginBottom: "0.5rem",
};

const badgeStyle = {
  background: "#dcfce7",
  color: "#1f2937",
  padding: "0.35rem 0.7rem",
  borderRadius: 999,
  fontSize: "0.8rem",
  fontWeight: 700,
  whiteSpace: "nowrap" as const,
};

const buttonStyle = {
  background: "#1d3557",
  color: "white",
  border: "none",
  borderRadius: 10,
  padding: "0.7rem 1rem",
  fontWeight: 700,
  cursor: "pointer",
};