import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("Aisha Member");
  const [email, setEmail] = useState("member@riverside.example");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    register({
      email,
      fullName,
      role: "member",
      membershipTier: "Standard",
      joinedAt: new Date().toISOString(),
    });
    navigate("/member");
  };

  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        background: "white",
        borderRadius: 20,
        padding: "2rem",
        boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Become a member</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          style={{
            padding: "0.85rem",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
          }}
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          style={{
            padding: "0.85rem",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
          }}
        />
        <input
          type="password"
          placeholder="Password"
          style={{
            padding: "0.85rem",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
          }}
        />
        <button
          type="submit"
          style={{
            background: "#22c55e",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "0.9rem",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Create account
        </button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Already a member? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}
