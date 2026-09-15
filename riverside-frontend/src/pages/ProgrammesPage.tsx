import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";
import type { ProgrammeRecord } from "../types";

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState<ProgrammeRecord[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    apiGet<{ programmes: ProgrammeRecord[] }>("/programmes")
      .then((response) => {
        setProgrammes(response.programmes);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  return (
    <div>
      <h1>Programmes</h1>
      {status === "loading" ? <p>Loading programmes...</p> : null}
      {status === "error" ? (
        <p role="alert">Unable to load programmes.</p>
      ) : null}
      {status === "ready" && programmes.length === 0 ? (
        <p>No programmes are currently available.</p>
      ) : null}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {programmes.map((programme) => (
          <article
            key={programme.id}
            style={{
              background: "white",
              padding: "1rem",
              borderRadius: 16,
              boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
            }}
          >
            <img
              src={
                programme.image_url ??
                "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80"
              }
              alt={programme.title}
              style={{
                width: "100%",
                height: 180,
                objectFit: "cover",
                borderRadius: 12,
              }}
            />
            <h3>{programme.title}</h3>
            <p>
              <strong>Age range:</strong> {programme.age_range ?? "All ages"}
            </p>
            <p>
              <strong>Schedule:</strong>{" "}
              {programme.schedule_info ?? "Schedule to be confirmed"}
            </p>
            <p>{programme.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
