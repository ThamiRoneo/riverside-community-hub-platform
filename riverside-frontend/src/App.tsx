import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import AdminDashboard from "./pages/AdminDashboard";
import DonatePage from "./pages/DonatePage";
import FacilitiesPage from "./pages/FacilitiesPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import MemberDashboard from "./pages/MemberDashboard";
import ProgrammesPage from "./pages/ProgrammesPage";
import RegisterPage from "./pages/RegisterPage";
import StaffDashboard from "./pages/StaffDashboard";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/programmes" element={<ProgrammesPage />} />
          <Route path="/facilities" element={<FacilitiesPage />} />
          <Route path="/donate" element={<DonatePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route element={<ProtectedRoute allowedRoles={["member"]} />}>
            <Route path="/member" element={<MemberDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["staff", "admin"]} />}>
            <Route path="/staff" element={<StaffDashboard />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
