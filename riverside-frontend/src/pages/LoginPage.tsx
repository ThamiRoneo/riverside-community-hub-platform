import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("member@riverside.example");
  const [password, setPassword] = useState("Password123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/member");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to sign in",
      );
    } finally {
      setSubmitting(false);
    }
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
      {error ? <p role="alert">{error}</p> : null}
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
          disabled={submitting}
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
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p style={{ marginTop: "1rem" }}>
        Need an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}
