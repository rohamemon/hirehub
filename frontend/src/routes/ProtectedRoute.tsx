import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "@/components/ui/Feedback";
import { homeFor, useAuth } from "@/features/auth/AuthContext";
import type { Role } from "@/types";

/**
 * Client-side guard for UX only. The real enforcement is on the FastAPI server:
 * every endpoint re-checks the token and role.
 */
export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner label="Checking your session" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return <Outlet />;
}
