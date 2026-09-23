import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        maxWidth: 520,
        margin: "0 auto",
        background: "white",
        borderRadius: 20,
        padding: "5rem",
        boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
      }}
    >
      <h1 style={{
        marginTop: 0,
        textAlign: "center" }}>Log in</h1>
      {error ? <p style={{ textAlign: "center", color: "red" }} role="alert">{error}</p> : null}
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
