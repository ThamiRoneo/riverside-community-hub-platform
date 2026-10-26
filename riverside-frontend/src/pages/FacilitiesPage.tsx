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
      <h1 className="text-3xl font-bold mb-6">Rooms &amp; Equipment</h1>

      <form
        role="search"
        aria-label="Filter resources"
        onSubmit={(event) => event.preventDefault()}
        className="flex flex-wrap gap-4 mb-6"
      >
        <label htmlFor="resource-search" className="flex flex-col gap-1 text-sm font-semibold">
          Search
          <input
            id="resource-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Boardroom, gym…"
            className="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label htmlFor="resource-type" className="flex flex-col gap-1 text-sm font-semibold">
          Type
          <select
            id="resource-type"
            value={type}
            onChange={(event) => setType(event.target.value as ResourceType | "")}
            className="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FILTERS.map((filter) => (
              <option key={filter.value} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor="resource-capacity" className="flex flex-col gap-1 text-sm font-semibold">
          Minimum capacity
          <input
            id="resource-capacity"
            type="number"
            min={1}
            value={capacityMin}
            onChange={(event) => setCapacityMin(event.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </form>

      <p aria-live="polite" role="status" className="mb-4">
        {status === "loading" ? "Loading resources…" : null}
        {status === "error" ? "Unable to load resources." : null}
        {status === "ready" && resources.length === 0
          ? "No resources match these filters."
          : null}
      </p>

      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 list-none m-0 p-0">
        {resources.map((resource) => (
          <li key={resource.id} className="bg-white rounded-xl p-5 shadow-sm">
            <div className="flex justify-between items-start gap-4 mb-2">
              <h2 className="m-0 text-lg font-bold">{resource.name}</h2>
              <span className="bg-green-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap">
                {resource.type === "room" ? "Room" : "Equipment"}
              </span>
            </div>

            <p className="text-gray-700 mb-2">{resource.description ?? "Part of the Riverside community hub."}</p>

            {resource.capacity ? (
              <p className="text-sm text-gray-700">
                <strong>Capacity:</strong> {resource.capacity}
              </p>
            ) : null}

            {resource.hourly_rate ? (
              <p className="text-sm text-gray-700">
                <strong>Rate:</strong> R{resource.hourly_rate}/hr
              </p>
            ) : null}

            <button
              type="button"
              className="mt-4 bg-blue-900 text-white border-none rounded-lg px-4 py-2 font-bold hover:bg-blue-800 transition-colors"
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
