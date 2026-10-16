import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setSubmitting(true);
    try {
      await register(fullName, email, password);
      setMessage("Account created. Check your email before signing in.");
      navigate("/login");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to create account",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto bg-white rounded-2xl p-6 sm:p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-center mb-4">Become a member</h1>
      {error ? <p className="text-center text-red-600 mb-4" role="alert">{error}</p> : null}
      {message ? <p className="text-center text-green-600 mb-4" role="status">{message}</p> : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          placeholder="Full name"
          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={submitting}
          className="bg-green-500 text-white rounded-lg py-3 font-bold hover:bg-green-600 transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-4 text-center">
        Already a member? <Link to="/login" className="text-blue-700 hover:underline font-semibold">Sign in</Link>
      </p>
    </div>
  );
}

