import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import type { EquipmentRecord, FacilityRecord } from "../types";

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<FacilityRecord[]>([]);
  const [equipment, setEquipment] = useState<EquipmentRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    Promise.all([
      apiGet<{ facilities: FacilityRecord[] }>("/facilities"),
      apiGet<{ equipment: EquipmentRecord[] }>("/equipment"),
    ])
      .then(([facilityResponse, equipmentResponse]) => {
        setFacilities(facilityResponse.facilities);
        setEquipment(equipmentResponse.equipment);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      <h1>Facilities & Equipment</h1>
      {status === "loading" ? <p>Loading resources...</p> : null}
      {status === "error" ? (
        <p role="alert">Unable to load resources.</p>
      ) : null}
      {status === "ready" &&
      facilities.length === 0 &&
      equipment.length === 0 ? (
        <p>No resources are currently available.</p>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {facilities.map((resource) => (
          <article
            key={resource.id}
            style={{
              background: "white",
              borderRadius: 16,
              padding: "1.25rem",
              boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <h3 style={{ marginTop: 0 }}>{resource.name}</h3>
              <span
                style={{
                  background: "#dcfce7",
                  color: "#1f2937",
                  padding: "0.35rem 0.7rem",
                  borderRadius: 999,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                Available
              </span>
            </div>

            <p>{resource.description ?? "Community facility"}</p>
            {resource.capacity ? (
              <p>
                <strong>Capacity:</strong> {resource.capacity}
              </p>
            ) : null}
            <p>
              <strong>Type:</strong> Room
            </p>
            <p>
              <strong>Rate:</strong> R{resource.hourly_rate}/hr
            </p>
            <button
              type="button"
              style={{
                background: "#1d3557",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "0.7rem 1rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Book now
            </button>
          </article>
        ))}
        {equipment.map((resource) => (
          <article
            key={resource.id}
            style={{
              background: "white",
              borderRadius: 16,
              padding: "1.25rem",
              boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>{resource.name}</h3>
            <p>{resource.description ?? "Community equipment"}</p>
            <p>
              <strong>Type:</strong> Equipment
            </p>
            <p>
              <strong>Quantity:</strong> {resource.quantity}
            </p>
            <button
              type="button"
              style={{
                background: "#1d3557",
                color: "white",
                border: "none",
                borderRadius: 10,
                padding: "0.7rem 1rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Book now
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
