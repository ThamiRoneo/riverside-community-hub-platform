import { programmes } from "../data/mockData";

export default function ProgrammesPage() {
  return (
    <div>
      <h1>Programmes</h1>
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
              src={programme.image}
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
              <strong>Age range:</strong> {programme.ageRange}
            </p>
            <p>
              <strong>Schedule:</strong> {programme.schedule}
            </p>
            <p>{programme.description}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
