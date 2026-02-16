import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { loadFaceApiModels } from "@/services/FaceApiService";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CheckIn from "./pages/CheckIn";
import Schedule from "./pages/Schedule";
import Alerts from "./pages/Alerts";
import Profile from "./pages/Profile";
import EnrollmentForm from "./pages/EnrollmentForm";
import LeaveManagement from "./pages/LeaveManagement";
import PatrolMode from "./pages/PatrolMode";
import PersonalInfo from "./pages/PersonalInfo";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Face API model loading status context
export const FaceApiContext = {
  modelsLoaded: false,
  modelsError: null as string | null,
};

function FaceApiLoader({ children }: { children: React.ReactNode }) {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  useEffect(() => {
    loadFaceApiModels()
      .then(() => {
        FaceApiContext.modelsLoaded = true;
        setModelsLoaded(true);
        console.log('[App] Face API models loaded successfully');
      })
      .catch((err) => {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load face recognition models';
        FaceApiContext.modelsError = errorMsg;
        setModelsError(errorMsg);
        console.error('[App] Face API model loading failed:', err);
      });
  }, []);

  // Show loading state while models are loading
  if (!modelsLoaded && !modelsError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center glow-primary mb-4">
          <img src="/favicon.ico" alt="GuardSync" className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">GuardSync</h2>
        <p className="text-muted-foreground text-sm">Loading face recognition models...</p>
        <div className="mt-4 w-32 h-1 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: '60%' }}></div>
        </div>
      </div>
    );
  }

  // Continue even if models fail to load (will show error in FacialScanner)
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/enroll" element={<EnrollmentForm />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/check-in" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
      <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
      <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/personal-info" element={<ProtectedRoute><PersonalInfo /></ProtectedRoute>} />
      <Route path="/leave" element={<ProtectedRoute><LeaveManagement /></ProtectedRoute>} />
      <Route path="/patrol" element={<ProtectedRoute><PatrolMode /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <FaceApiLoader>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </FaceApiLoader>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
