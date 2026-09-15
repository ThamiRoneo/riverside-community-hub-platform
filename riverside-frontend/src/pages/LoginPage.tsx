import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("member@riverside.example");
  const [password, setPassword] = useState("Password123");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    login({
      email,
      fullName: "Aisha Member",
      role: "member",
      membershipTier: "Standard",
      joinedAt: "2026-02-01T00:00:00.000Z",
    });
    navigate("/member");
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        background: "white",
        borderRadius: 20,
        padding: "2rem",
        boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Log in</h1>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
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
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
            background: "#1d3557",
            color: "white",
            border: "none",
            borderRadius: 10,
            padding: "0.9rem",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Sign in
        </button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Need an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
