import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ApiError } from "@/services/api";
import { AppRoutes } from "@/routes/AppRoutes";

export const makeQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, refetchOnWindowFocus: false,
      // Don't retry client errors (4xx); they won't succeed on retry.
      retry: (count, err) => !(err instanceof ApiError && err.status < 500 && err.status !== 0) && count < 2,
    },
  },
});

const queryClient = makeQueryClient();

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
