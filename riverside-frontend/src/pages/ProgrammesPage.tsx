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
      <h1 className="text-3xl font-bold mb-6">Programmes</h1>
      {status === "loading" ? <p>Loading programmes...</p> : null}
      {status === "error" ? (
        <p role="alert">Unable to load programmes.</p>
      ) : null}
      {status === "ready" && programmes.length === 0 ? (
        <p>No programmes are currently available.</p>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {programmes.map((programme) => (
          <article
            key={programme.id}
            className="bg-white p-4 rounded-xl shadow-sm"
          >
            <img
              src={
                programme.image_url ??
                "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80"
              }
              alt={programme.title}
              className="w-full h-48 object-cover rounded-lg"
            />
            <h3 className="font-bold text-lg mt-3 mb-1">{programme.title}</h3>
            <p className="text-sm text-gray-700 mb-1">
              <strong>Age range:</strong> {programme.age_range ?? "All ages"}
            </p>
            <p className="text-sm text-gray-700 mb-2">
              <strong>Schedule:</strong>{" "}
              {programme.schedule_info ?? "Schedule to be confirmed"}
            </p>
            <p className="text-sm text-gray-700 leading-relaxed">{programme.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

