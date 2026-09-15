import { resources } from "../data/mockData";

export default function FacilitiesPage() {
  return (
    <div>
      <h1>Facilities & Equipment</h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "1.5rem",
        }}
      >
        {resources.map((resource) => (
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
                  background:
                    resource.availability === "Available"
                      ? "#dcfce7"
                      : resource.availability === "Limited"
                        ? "#fef3c7"
                        : "#fee2e2",
                  color: "#1f2937",
                  padding: "0.35rem 0.7rem",
                  borderRadius: 999,
                  fontSize: "0.8rem",
                  fontWeight: 700,
                }}
              >
                {resource.availability}
              </span>
            </div>

            <p>{resource.description}</p>
            {resource.capacity ? (
              <p>
                <strong>Capacity:</strong> {resource.capacity}
              </p>
            ) : null}
            <p>
              <strong>Type:</strong> {resource.type}
            </p>
            <p>
              <strong>Rate:</strong> R{resource.hourlyRate}/hr
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
