
import { useState } from "react";
import axios from "./api/axios";
import "./styles/App.css";
import Dashboard from "./Dashboard";
import Events from "./Events";

function App() {
  const [page, setPage] = useState("login");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  if (
    window.location.pathname === "/dashboard" ||
    window.location.pathname === "/admin"
  ) {
      return <Dashboard />;
  }
  if (window.location.pathname === "/events") {
    return <Events />;
  }

  function handleChange(event) {
    setForm({ ...form, [event.target.name]: event.target.value });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    const email = form.email.trim();
    const validEmail = /^[^@\s]+@[^@\s]+\.com$/i.test(email);

    if (!validEmail) {
      setError("Enter an email address in the format text@text.com.");
      return;
    }

    if (page === "register") {
      if (!form.first_name.trim() || !form.last_name.trim()) {
        setError("Enter your first and last name.");
        return;
      }

      if (form.password.length < 8 || form.password.length > 128) {
        setError("Your password must be between 8 and 128 characters.");
        return;
      }

      if (form.password !== form.confirm_password) {
        setError("Passwords do not match.");
        return;
      }
    } else if (!form.password || form.password.length > 128) {
      setError("Enter your password (up to 128 characters).");
      return;
    }

    setLoading(true);

    try {
      if (page === "register") {
        await axios.post("/api/auth/register", {
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email,
        });
        setMessage("Account created successfully! You can now log in.");
        setPage("login");
        setForm({
          first_name: "",
          last_name: "",
          email,
          password: "",
          confirm_password: "",
        });
      } else {
        const response = await axios.post("/api/auth/login", {
          email,
          password: form.password,
        });

        const { access_token, user } = response.data;

        localStorage.setItem("access_token", access_token);
        localStorage.setItem("user", JSON.stringify(user));

        window.location.href =
          user.Role === "Admin" ? "/admin" : "/dashboard";
      }
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(
        Array.isArray(detail)
          ? detail.map((item) => item.msg).join(" ")
          : detail || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          <div className="brand-icon">C</div>
          <h1>CampusMeet</h1>
          <p>Connect with your university community.</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={page === "login" ? "active" : ""}
            onClick={() => {
              setPage("login");
              setError("");
              setMessage("");
            }}
          >
            Log in
          </button>
          <button
            type="button"
            className={page === "register" ? "active" : ""}
            onClick={() => {
              setPage("register");
              setError("");
              setMessage("");
            }}
          >
            Sign up
          </button>
        </div>

        <h2>{page === "login" ? "Welcome back!" : "Create your account"}</h2>
        <p className="subtitle">
          {page === "login"
            ? "Log in to your CampusMeet account."
            : "Join your university community."}
        </p>

        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}

        <form onSubmit={handleSubmit}>
          {page === "register" && (
            <>
              <label htmlFor="first_name">First name</label>
              <input
                id="first_name"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                maxLength={50}
                autoComplete="given-name"
                required
              />

              <label htmlFor="last_name">Last name</label>
              <input
                id="last_name"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                maxLength={50}
                autoComplete="family-name"
                required
              />
            </>
          )}

          <label htmlFor="email">Email address</label>
          <input
            id="email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            pattern="[^@\s]+@[^@\s]+\.com"
            maxLength={254}
            autoComplete="email"
            title="Enter an email address in the format text@text.com."
            onInvalid={(event) =>
              event.currentTarget.setCustomValidity(
                "Enter an email address in the format text@text.com."
              )
            }
            onInput={(event) => event.currentTarget.setCustomValidity("")}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            minLength={page === "register" ? 8 : undefined}
            maxLength={128}
            autoComplete={page === "login" ? "current-password" : "new-password"}
            required
          />

          {page === "register" && (
            <>
              <label htmlFor="confirm_password">Confirm password</label>
              <input
                id="confirm_password"
                name="confirm_password"
                type="password"
                value={form.confirm_password}
                onChange={handleChange}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </>
          )}

          {page === "register" && (
            <p className="form-hint">Use at least 8 characters.</p>
          )}

          <button className="submit-button" type="submit" disabled={loading}>
            {loading
              ? "Please wait..."
              : page === "login"
                ? "Log in"
                : "Create account"}
          </button>
        </form>

        <p className="switch-text">
          {page === "login"
            ? "New to CampusMeet?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setPage(page === "login" ? "register" : "login");
              setError("");
              setMessage("");
            }}
          >
            {page === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </section>
    </main>
  );
}

export default App;
