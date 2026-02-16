import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import useSimulation from '@/hooks/useSimulation';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import LoginPage from "./pages/LoginPage";
import Index from "./pages/Index";
import LiveMapPage from "./pages/LiveMapPage";
import GuardsPage from "./pages/GuardsPage";
import GuardPage from "./pages/GuardPage";
import SitesPage from "./pages/SitesPage";
import ReportsPage from "./pages/ReportsPage";
import AlertsPage from "./pages/AlertsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import ManageSitePage from "./pages/ManageSitePage";
import SupportPage from "./pages/SupportPage";

const queryClient = new QueryClient();

const App = () => {
  // start simulation hook (listens to demo-mode-changed/localStorage)
  useSimulation();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SidebarProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                <Route path="/live-map" element={<ProtectedRoute><LiveMapPage /></ProtectedRoute>} />
                <Route path="/guards" element={<ProtectedRoute><GuardsPage /></ProtectedRoute>} />
                <Route path="/guards/:id" element={<ProtectedRoute><GuardPage /></ProtectedRoute>} />
                <Route path="/sites" element={<ProtectedRoute><SitesPage /></ProtectedRoute>} />
                <Route path="/manage-site/:id" element={<ProtectedRoute><ManageSitePage /></ProtectedRoute>} />
                <Route path="/support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><ReportsPage /></ProtectedRoute>} />
                <Route path="/alerts" element={<ProtectedRoute><AlertsPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </SidebarProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
