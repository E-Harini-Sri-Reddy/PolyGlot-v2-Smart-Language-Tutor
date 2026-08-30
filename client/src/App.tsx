import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./layouts/AppLayout";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { ChatPage } from "./pages/ChatPage";
import { DictionaryPage } from "./pages/DictionaryPage";
import { QuizPage } from "./pages/QuizPage";
import { ProgressPage } from "./pages/ProgressPage";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { useAuthStore } from "./store/authStore";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  if (!bootstrapped) {
    return (
      <div className="flex min-h-screen items-center justify-center text-ink-soft">
        Loading PolyGlot AI...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user && !user.onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }
  return children;
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <OnboardingGate>
              <AppLayout />
            </OnboardingGate>
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/dictionary" element={<DictionaryPage />} />
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/progress" element={<ProgressPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
