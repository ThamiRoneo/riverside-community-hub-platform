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
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-blue-900 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <strong className="text-xl sm:text-2xl">
              Riverside Community Hub
            </strong>
          </div>

          <nav className="flex gap-3 sm:gap-4 flex-wrap">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `font-semibold no-underline transition-colors ${
                    isActive ? "text-yellow-300" : "text-white hover:text-gray-200"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 flex-wrap">
            {user ? (
              <>
                <span className="text-sm sm:text-base">Hi, {user.fullName}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="bg-red-600 text-white border-none rounded-lg px-4 py-2 font-semibold hover:bg-red-700 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className="text-white no-underline font-semibold hover:text-gray-200"
                >
                  Login
                </NavLink>
                <NavLink
                  to="/register"
                  className="text-white no-underline font-semibold hover:text-gray-200"
                >
                  Register
                </NavLink>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}

