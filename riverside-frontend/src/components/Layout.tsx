import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Home" },
  { to: "/programmes", label: "Programmes" },
  { to: "/facilities", label: "Facilities" },
  { to: "/donate", label: "Donate" },
  { to: "/member", label: "Member" },
  { to: "/staff", label: "Staff" },
  { to: "/admin", label: "Admin" },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        color: "#14213d",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <header
        style={{
          background: "#1d3557",
          color: "white",
          padding: "1rem 2rem",
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <strong style={{ fontSize: "1.5rem" }}>
              Riverside Community Hub
            </strong>
          </div>

          <nav style={{ display: "flex", gap: "0.9rem", flexWrap: "wrap" }}>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  color: isActive ? "#ffd166" : "white",
                  textDecoration: "none",
                  fontWeight: 600,
                })}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            {user ? (
              <>
                <span>Hi, {user.fullName}</span>
                <button
                  type="button"
                  onClick={logout}
                  style={{
                    background: "#e63946",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    padding: "0.6rem 1rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  style={{
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  style={{
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 700,
                  }}
                >
                  Register
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main
        style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem 1rem 3rem" }}
      >
        <Outlet />
      </main>
    </div>
  );
}
